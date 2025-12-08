# Backend Service

FastAPI application that exposes Docker management endpoints for the web interface. The service communicates directly with the host Docker Engine via `/var/run/docker.sock`.

## Running locally

1. Create a virtual environment and install dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. (Optional) Create a `.env` file to override the bind host/port used by uvicorn:

   ```bash
   cp ../.env.example .env
   # Edit BIND_HOST and BIND_PORT if you need custom values
   ```

3. Start the API server (defaults to `0.0.0.0:8003`):

   ```bash
   uvicorn app.main:app --reload --host "${BIND_HOST:-0.0.0.0}" --port "${BIND_PORT:-8003}" --env-file .env
   ```

   Ensure the process can reach `/var/run/docker.sock` (for example by running inside Docker with the socket mounted).

   When running directly via Python, `python -m app.main` will also bind to `0.0.0.0:8003` by default, honoring `BIND_HOST`/`BIND_PORT` if set. Running `uvicorn app.main:app` without the flags above will fall back to uvicorn's built-in default of `8000`.

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

## Compose stack endpoints (Stage 2)

- `GET /stacks` — discover compose projects under the configured stack root (defaults to `/mnt/storage/yaml` or `STACK_ROOT`).
- `GET /compose/ls` — run `docker compose ls` for a global view of compose projects.
- `GET /stacks/{stack_name}/ps` — list services for a specific stack via `docker compose ps`.
- `POST /stacks/{stack_name}/up` — run `docker compose up -d` for the stack.
- `POST /stacks/{stack_name}/down` — stop the stack with `docker compose down`.
- `WS /ws/stacks/{stack_name}/deploy` — stream compose `up`/`down` output in real time (set `action=down` query param to stream `down`).

These endpoints form the foundations for Stages 1 and 2 of the project timeline.
