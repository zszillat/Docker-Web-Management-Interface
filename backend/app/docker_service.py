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
            # The low-level client is exposed via the high-level client's API attribute.
            # docker.APIClient.from_env() is not available in all SDK versions.
            self.low_level = self.client.api
            # Validate connection early so we fail fast if the socket is missing.
            self.client.ping()
        except Exception as exc:  # pragma: no cover - connectivity depends on host
            logger.exception("Unable to connect to the Docker Engine")
            raise RuntimeError("Docker Engine is not reachable via /var/run/docker.sock") from exc

        root = stack_root or os.environ.get("STACK_ROOT", "/mnt/storage/yaml")
        self.stack_root = Path(root).expanduser()

    # System info
    def system_df(self) -> Dict:
        return self.low_level.df()

    def system_df_summary(self) -> Dict:
        data = self.system_df()

        def _sum(items, key, nested: str | None = None):
            total = 0
            for item in items or []:
                target = item.get(nested, {}) if nested else item
                total += target.get(key) or 0
            return total

        images = data.get("Images") or []
        containers = data.get("Containers") or []
        volumes = data.get("Volumes") or []
        build_cache = data.get("BuildCache") or []

        return {
            "total_size": (data.get("LayersSize") or 0)
            + _sum(containers, "SizeRootFs")
            + _sum(volumes, "Size", nested="UsageData")
            + _sum(build_cache, "Size"),
            "images": {"count": len(images), "size": _sum(images, "Size")},
            "containers": {"count": len(containers), "size": _sum(containers, "SizeRootFs")},
            "volumes": {"count": len(volumes), "size": _sum(volumes, "Size", nested="UsageData")},
            "build_cache": {"count": len(build_cache), "size": _sum(build_cache, "Size")},
        }

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

    def start_shell(self, container_id: str, command: Optional[List[str]] | None = None):
        """Create an interactive exec session for a container."""

        container = self.client.containers.get(container_id)
        exec_id = self.low_level.exec_create(
            container.id,
            cmd=command or ["/bin/sh"],
            tty=True,
            stdin=True,
        )
        return self.low_level.exec_start(exec_id, tty=True, stream=False, socket=True)

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

    def prune_resources(
        self,
        *,
        containers: bool = False,
        volumes: bool = False,
        networks: bool = False,
        images: bool = False,
    ) -> Dict:
        results: Dict[str, Dict] = {}
        if containers:
            results["containers"] = self.client.containers.prune()
        if volumes:
            results["volumes"] = self.client.volumes.prune()
        if networks:
            results["networks"] = self.client.networks.prune()
        if images:
            # Include all unused images, not just dangling layers
            results["images"] = self.client.images.prune(filters={"dangling": False})
        return results

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

    # Stack file management
    def create_stack(self, name: str, compose_content: str, env_content: str | None = None, overwrite: bool = False) -> Dict:
        safe_name = self._validate_stack_name(name)
        stack_dir = self.stack_root / safe_name

        if stack_dir.exists() and not overwrite:
            raise ValueError(f"Stack '{safe_name}' already exists at {stack_dir}")

        stack_dir.mkdir(parents=True, exist_ok=True)
        compose_path = stack_dir / "docker-compose.yaml"
        compose_path.write_text(compose_content)

        if env_content is not None:
            env_path = stack_dir / ".env"
            env_path.write_text(env_content)

        return {
            "name": safe_name,
            "path": str(stack_dir),
            "compose_file": str(compose_path),
        }

    def read_stack_files(self, stack_name: str) -> Dict:
        compose_file = self._compose_file_for_stack(stack_name)
        env_file = compose_file.parent / ".env"
        return {
            "compose_content": compose_file.read_text(),
            "env_content": env_file.read_text() if env_file.exists() else "",
        }

    def update_stack_files(self, stack_name: str, compose_content: str, env_content: str | None = None) -> Dict:
        compose_file = self._compose_file_for_stack(stack_name)
        compose_file.write_text(compose_content)

        env_file = compose_file.parent / ".env"
        if env_content is not None:
            env_file.write_text(env_content)
        elif env_file.exists():
            env_file.unlink()

        return {
            "name": stack_name,
            "compose_file": str(compose_file),
            "env_file": str(env_file),
        }

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

    @staticmethod
    def _validate_stack_name(name: str) -> str:
        candidate = Path(name).name
        if candidate != name or not candidate:
            raise ValueError("Invalid stack name")
        return candidate


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
