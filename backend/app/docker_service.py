import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import docker
from docker import errors

logger = logging.getLogger(__name__)


class DockerService:
    """Wrapper around the Docker SDK with utilities used by the API layer."""

    def __init__(self, stack_root: str | Path | None = None) -> None:
        try:
            self.client = docker.from_env()
            self.low_level = docker.APIClient.from_env()
            # Validate connection early so we fail fast if the socket is missing.
            self.client.ping()
        except Exception as exc:  # pragma: no cover - connectivity depends on host
            logger.exception("Unable to connect to the Docker Engine")
            raise RuntimeError("Docker Engine is not reachable via /var/run/docker.sock") from exc

        root = stack_root or os.environ.get("STACK_ROOT", "/mnt/storage/yaml")
        self.stack_root = Path(root).expanduser()

    # Containers
    def list_containers(self) -> List[Dict]:
        containers = self.client.containers.list(all=True)
        results = []
        for container in containers:
            results.append(
                {
                    "id": container.id,
                    "name": container.name,
                    "status": container.status,
                    "image": container.image.tags or [container.image.short_id],
                    "labels": container.labels,
                    "ports": container.ports,
                }
            )
        return results

    def start_container(self, container_id: str) -> None:
        container = self.client.containers.get(container_id)
        container.start()

    def stop_container(self, container_id: str, timeout: Optional[int] = None) -> None:
        container = self.client.containers.get(container_id)
        container.stop(timeout=timeout)

    def stream_logs(self, container_id: str, tail: int = 200) -> Iterable[str]:
        container = self.client.containers.get(container_id)
        return container.logs(stream=True, follow=True, tail=tail)

    # Volumes
    def list_volumes(self) -> List[Dict]:
        volumes = self.client.volumes.list()
        return [self._format_volume(volume) for volume in volumes]

    def delete_volume(self, name: str, force: bool = False) -> None:
        volume = self.client.volumes.get(name)
        volume.remove(force=force)

    # Networks
    def list_networks(self) -> List[Dict]:
        networks = self.client.networks.list()
        return [self._format_network(network) for network in networks]

    def delete_network(self, network_id: str) -> None:
        network = self.client.networks.get(network_id)
        network.remove()

    # Images
    def list_images(self) -> List[Dict]:
        images = self.client.images.list()
        return [self._format_image(image) for image in images]

    def delete_image(self, image_id: str, force: bool = False, noprune: bool = False) -> None:
        self.low_level.remove_image(image_id, force=force, noprune=noprune)

    # Compose stacks
    def discover_stacks(self) -> List[Dict]:
        """Scan the configured stack root for compose projects."""
        if not self.stack_root.exists():
            logger.warning("Stack root %s does not exist", self.stack_root)
            return []

        stacks: List[Dict] = []
        for child in self.stack_root.iterdir():
            if not child.is_dir():
                continue
            compose_file = self._compose_file_for_directory(child)
            if compose_file:
                stacks.append(
                    {
                        "name": child.name,
                        "path": str(child),
                        "compose_file": str(compose_file),
                    }
                )
        return sorted(stacks, key=lambda stack: stack["name"])

    def compose_ls(self) -> List[Dict]:
        """Run `docker compose ls` to list projects known to the engine."""
        output = self._run_command(["docker", "compose", "ls", "--format", "json"])
        try:
            return json.loads(output)
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            raise RuntimeError("Unable to parse compose ls output") from exc

    def compose_ps(self, stack_name: str) -> List[Dict]:
        compose_file = self._compose_file_for_stack(stack_name)
        output = self._run_command(
            ["docker", "compose", "-f", str(compose_file), "ps", "--format", "json"]
        )
        try:
            return json.loads(output)
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            raise RuntimeError("Unable to parse compose ps output") from exc

    def compose_up(self, stack_name: str) -> List[str]:
        """Run `docker compose up -d` and return combined stdout/stderr lines."""
        compose_file = self._compose_file_for_stack(stack_name)
        return self._run_command(
            ["docker", "compose", "-f", str(compose_file), "up", "-d"],
            split_lines=True,
        )

    def compose_down(self, stack_name: str) -> List[str]:
        compose_file = self._compose_file_for_stack(stack_name)
        return self._run_command(
            ["docker", "compose", "-f", str(compose_file), "down"],
            split_lines=True,
        )

    def compose_up_stream(self, stack_name: str) -> Iterable[str]:
        compose_file = self._compose_file_for_stack(stack_name)
        return self._stream_command(["docker", "compose", "-f", str(compose_file), "up", "-d"])

    def compose_down_stream(self, stack_name: str) -> Iterable[str]:
        compose_file = self._compose_file_for_stack(stack_name)
        return self._stream_command(["docker", "compose", "-f", str(compose_file), "down"])

    # Helpers
    @staticmethod
    def _format_volume(volume: docker.models.volumes.Volume) -> Dict:
        return {
            "name": volume.name,
            "mountpoint": volume.attrs.get("Mountpoint"),
            "driver": volume.attrs.get("Driver"),
            "labels": volume.attrs.get("Labels") or {},
            "scope": volume.attrs.get("Scope"),
        }

    @staticmethod
    def _format_network(network: docker.models.networks.Network) -> Dict:
        return {
            "id": network.id,
            "name": network.name,
            "driver": network.attrs.get("Driver"),
            "scope": network.attrs.get("Scope"),
            "labels": network.attrs.get("Labels") or {},
        }

    @staticmethod
    def _format_image(image: docker.models.images.Image) -> Dict:
        return {
            "id": image.id,
            "tags": image.tags,
            "short_id": image.short_id,
            "labels": image.attrs.get("Config", {}).get("Labels") or {},
            "size": image.attrs.get("Size"),
        }

    def _compose_file_for_stack(self, stack_name: str) -> Path:
        compose_file = self._compose_file_for_directory(self.stack_root / stack_name)
        if not compose_file:
            raise errors.NotFound(f"Stack '{stack_name}' not found in {self.stack_root}")
        return compose_file

    @staticmethod
    def _compose_file_for_directory(directory: Path) -> Path | None:
        for candidate in ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"):
            compose_file = directory / candidate
            if compose_file.exists():
                return compose_file
        return None

    def _run_command(self, cmd: List[str], split_lines: bool = False) -> List[str] | str:
        logger.info("Running command: %s", " ".join(cmd))
        try:
            output = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
            return output.splitlines() if split_lines else output
        except subprocess.CalledProcessError as exc:  # pragma: no cover - depends on host Docker
            logger.error("Command failed: %s", exc.output)
            raise RuntimeError(exc.output.strip()) from exc

    def _stream_command(self, cmd: List[str]) -> Iterable[str]:
        logger.info("Streaming command: %s", " ".join(cmd))
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

        if not process.stdout:  # pragma: no cover - defensive
            return []

        def _iterator() -> Iterable[str]:
            for line in process.stdout:
                yield line.rstrip("\n")
            return_code = process.wait()
            if return_code != 0:
                raise RuntimeError(f"Command {' '.join(cmd)} failed with exit code {return_code}")

        return _iterator()


def get_docker_service() -> DockerService:
    """Simple accessor used by route dependencies."""
    return DockerService()


def translate_docker_error(exc: Exception) -> Exception:
    """Normalize docker errors into something the API layer can handle."""
    if isinstance(exc, errors.NotFound):
        return errors.NotFound(str(exc))
    if isinstance(exc, errors.APIError):
        return errors.APIError(str(exc), response=exc.response)
    return exc
