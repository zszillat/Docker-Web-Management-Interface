import logging
from contextlib import suppress
from typing import Annotated

from docker import errors
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.websockets import WebSocketState
import anyio
from anyio import from_thread
from anyio.abc import CancelScope
from pydantic import BaseModel

from .docker_service import DockerService, get_docker_service, translate_docker_error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Docker Web Management API", version="0.1.0")

DockerDependency = Annotated[DockerService, Depends(get_docker_service)]


class StackCreateRequest(BaseModel):
    name: str
    compose_content: str
    env_content: str | None = None
    overwrite: bool = False


class StackUpdateRequest(BaseModel):
    compose_content: str
    env_content: str | None = None


class CleanupRequest(BaseModel):
    containers: bool = False
    volumes: bool = False
    networks: bool = False
    images: bool = False


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/containers")
def list_containers(docker_service: DockerDependency):
    try:
        return {"containers": docker_service.list_containers()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.post("/containers/{container_id}/start")
def start_container(container_id: str, docker_service: DockerDependency):
    try:
        docker_service.start_container(container_id)
        return {"status": "started", "id": container_id}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.post("/containers/{container_id}/stop")
def stop_container(container_id: str, docker_service: DockerDependency, timeout: int | None = None):
    try:
        docker_service.stop_container(container_id, timeout=timeout)
        return {"status": "stopped", "id": container_id}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.websocket("/ws/containers/{container_id}/logs")
async def container_logs(container_id: str, websocket: WebSocket, docker_service: DockerDependency):
    await websocket.accept()
    try:
        log_stream = docker_service.stream_logs(container_id)
        async with anyio.create_task_group() as tg:
            await tg.start(_forward_logs, websocket, log_stream)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for container %s", container_id)
    except Exception as exc:  # pragma: no cover - depends on host Docker
        await _send_error(websocket, exc)
        await websocket.close()


@app.websocket("/ws/containers/{container_id}/shell")
async def container_shell(container_id: str, websocket: WebSocket, docker_service: DockerDependency):
    await websocket.accept()
    try:
        shell_socket = docker_service.start_shell(container_id)
        await _bridge_shell(websocket, shell_socket)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for container shell %s", container_id)
    except Exception as exc:  # pragma: no cover - depends on host Docker
        await _send_error(websocket, exc)
        await websocket.close()


@app.get("/volumes")
def list_volumes(docker_service: DockerDependency):
    try:
        return {"volumes": docker_service.list_volumes()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.delete("/volumes/{name}")
def delete_volume(name: str, docker_service: DockerDependency, force: bool = False):
    try:
        docker_service.delete_volume(name, force=force)
        return {"status": "deleted", "name": name}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.get("/networks")
def list_networks(docker_service: DockerDependency):
    try:
        return {"networks": docker_service.list_networks()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.delete("/networks/{network_id}")
def delete_network(network_id: str, docker_service: DockerDependency):
    try:
        docker_service.delete_network(network_id)
        return {"status": "deleted", "id": network_id}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.get("/images")
def list_images(docker_service: DockerDependency):
    try:
        return {"images": docker_service.list_images()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.delete("/images/{image_id}")
def delete_image(image_id: str, docker_service: DockerDependency, force: bool = False, noprune: bool = False):
    try:
        docker_service.delete_image(image_id, force=force, noprune=noprune)
        return {"status": "deleted", "id": image_id}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.get("/system/df")
def system_df(docker_service: DockerDependency):
    try:
        return {"summary": docker_service.system_df_summary()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.post("/cleanup")
def cleanup_resources(payload: CleanupRequest, docker_service: DockerDependency):
    try:
        before = docker_service.system_df_summary()
        results = docker_service.prune_resources(
            containers=payload.containers,
            volumes=payload.volumes,
            networks=payload.networks,
            images=payload.images,
        )
        after = docker_service.system_df_summary()
        reclaimed = max((before.get("total_size") or 0) - (after.get("total_size") or 0), 0)
        return {
            "before": before,
            "after": after,
            "reclaimed_bytes": reclaimed,
            "results": results,
        }
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.get("/stacks")
def discover_stacks(docker_service: DockerDependency):
    try:
        return {"root": str(docker_service.stack_root), "stacks": docker_service.discover_stacks()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.post("/stacks")
def create_stack(payload: StackCreateRequest, docker_service: DockerDependency):
    try:
        stack = docker_service.create_stack(
            payload.name,
            compose_content=payload.compose_content,
            env_content=payload.env_content,
            overwrite=payload.overwrite,
        )
        return {"stack": stack}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.get("/compose/ls")
def compose_ls(docker_service: DockerDependency):
    try:
        return {"projects": docker_service.compose_ls()}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.get("/stacks/{stack_name}/ps")
def compose_ps(stack_name: str, docker_service: DockerDependency):
    try:
        return {"stack": stack_name, "containers": docker_service.compose_ps(stack_name)}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.post("/stacks/{stack_name}/up")
def compose_up(stack_name: str, docker_service: DockerDependency):
    try:
        output = docker_service.compose_up(stack_name)
        return {"stack": stack_name, "status": "running", "output": output}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.post("/stacks/{stack_name}/down")
def compose_down(stack_name: str, docker_service: DockerDependency):
    try:
        output = docker_service.compose_down(stack_name)
        return {"stack": stack_name, "status": "stopped", "output": output}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.websocket("/ws/stacks/{stack_name}/deploy")
async def compose_deploy(stack_name: str, websocket: WebSocket, docker_service: DockerDependency, action: str = "up"):
    await websocket.accept()
    try:
        stream = (
            docker_service.compose_down_stream(stack_name)
            if action == "down"
            else docker_service.compose_up_stream(stack_name)
        )
        await _stream_command_output(websocket, stream)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for stack %s", stack_name)
    except Exception as exc:  # pragma: no cover - depends on host Docker
        await _send_error(websocket, exc)
        await websocket.close()


@app.get("/stacks/{stack_name}/files")
def read_stack_files(stack_name: str, docker_service: DockerDependency):
    try:
        return {"stack": stack_name, **docker_service.read_stack_files(stack_name)}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


@app.put("/stacks/{stack_name}")
def update_stack(stack_name: str, payload: StackUpdateRequest, docker_service: DockerDependency):
    try:
        details = docker_service.update_stack_files(
            stack_name,
            compose_content=payload.compose_content,
            env_content=payload.env_content,
        )
        return {"stack": stack_name, **details}
    except Exception as exc:  # pragma: no cover - depends on host Docker
        raise _http_error_from_docker(exc)


async def _forward_logs(websocket: WebSocket, log_stream):
    async def _send_lines():
        try:
            for line in log_stream:
                if websocket.application_state != WebSocketState.CONNECTED:
                    break
                await websocket.send_text(line.decode("utf-8", errors="ignore"))
        finally:
            await websocket.close()

    await anyio.to_thread.run_sync(lambda: anyio.run(_send_lines))


async def _send_error(websocket: WebSocket, exc: Exception):
    try:
        await websocket.send_json({"error": str(exc)})
    except Exception:  # pragma: no cover - defensive
        logger.exception("Failed to send websocket error")


def _http_error_from_docker(exc: Exception) -> HTTPException:
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    exc = translate_docker_error(exc)
    if isinstance(exc, errors.NotFound):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, errors.APIError):
        return HTTPException(status_code=500, detail=str(exc))
    return HTTPException(status_code=500, detail="Unexpected Docker error")


async def _stream_command_output(websocket: WebSocket, stream):
    def _run_stream():
        with from_thread.start_blocking_portal() as portal:
            try:
                for line in stream:
                    if websocket.application_state != WebSocketState.CONNECTED:
                        break
                    portal.call(websocket.send_text, line)
            finally:
                if websocket.application_state == WebSocketState.CONNECTED:
                    portal.call(websocket.close)

    await anyio.to_thread.run_sync(_run_stream)


async def _bridge_shell(websocket: WebSocket, shell_socket):
    async with anyio.create_task_group() as tg:
        tg.start_soon(_forward_shell_output, websocket, shell_socket, tg.cancel_scope)
        tg.start_soon(_forward_shell_input, websocket, shell_socket, tg.cancel_scope)


async def _forward_shell_output(websocket: WebSocket, shell_socket, cancel_scope: CancelScope):
    try:
        while True:
            data = await anyio.to_thread.run_sync(shell_socket.recv, 4096)
            if not data:
                break
            await websocket.send_text(data.decode("utf-8", errors="ignore"))
    except Exception:  # pragma: no cover - depends on host Docker
        logger.exception("Error streaming shell output")
    finally:
        cancel_scope.cancel()
        if websocket.application_state == WebSocketState.CONNECTED:
            with suppress(Exception):
                await websocket.close()


async def _forward_shell_input(websocket: WebSocket, shell_socket, cancel_scope: CancelScope):
    try:
        while True:
            message = await websocket.receive_text()
            await anyio.to_thread.run_sync(shell_socket.send, message.encode())
    except WebSocketDisconnect:
        logger.info("Shell websocket disconnected")
    except Exception:  # pragma: no cover - depends on host Docker
        logger.exception("Error forwarding shell input")
    finally:
        cancel_scope.cancel()
        with suppress(Exception):
            shell_socket.close()
