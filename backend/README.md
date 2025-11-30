# Backend Service

FastAPI application that exposes Docker management endpoints for the web interface. The service communicates directly with the host Docker Engine via `/var/run/docker.sock`.

## Running locally

1. Create a virtual environment and install dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Start the API server:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   Ensure the process can reach `/var/run/docker.sock` (for example by running inside Docker with the socket mounted).

## Available endpoints

- `GET /health` — basic readiness check.
- `GET /containers` — list all containers.
- `POST /containers/{container_id}/start` — start a container.
- `POST /containers/{container_id}/stop` — stop a container.
- `WS /ws/containers/{container_id}/logs` — stream live container logs.
- `GET /volumes` — list volumes.
- `DELETE /volumes/{name}` — delete a volume (supports `force=true`).
- `GET /networks` — list networks.
- `DELETE /networks/{network_id}` — delete a network.
- `GET /images` — list images.
- `DELETE /images/{image_id}` — delete an image (supports `force`/`noprune`).

These endpoints form the foundations for Stage 1 of the project timeline.
