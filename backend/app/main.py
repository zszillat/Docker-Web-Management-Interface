import logging
from typing import Annotated

from docker import errors
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.websockets import WebSocketState
import anyio

from .docker_service import DockerService, get_docker_service, translate_docker_error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Docker Web Management API", version="0.1.0")

DockerDependency = Annotated[DockerService, Depends(get_docker_service)]


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
    exc = translate_docker_error(exc)
    if isinstance(exc, errors.NotFound):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, errors.APIError):
        return HTTPException(status_code=500, detail=str(exc))
    return HTTPException(status_code=500, detail="Unexpected Docker error")
