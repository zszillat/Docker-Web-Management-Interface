import logging
from typing import Dict, Iterable, List, Optional

import docker
from docker import errors

logger = logging.getLogger(__name__)


class DockerService:
    """Wrapper around the Docker SDK with utilities used by the API layer."""

    def __init__(self) -> None:
        try:
            self.client = docker.from_env()
            self.low_level = docker.APIClient.from_env()
            # Validate connection early so we fail fast if the socket is missing.
            self.client.ping()
        except Exception as exc:  # pragma: no cover - connectivity depends on host
            logger.exception("Unable to connect to the Docker Engine")
            raise RuntimeError("Docker Engine is not reachable via /var/run/docker.sock") from exc

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
