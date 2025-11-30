# Docker Web Management Interface

## Overview

This project is a self-hosted web interface designed to manage Docker
environments using real Docker CLI and Docker Compose commands. It
intentionally avoids the stack-ownership model used by platforms like
Portainer by interacting directly with filesystem-based
`docker-compose.yaml` files.

The system exposes a clean UI for managing:

-   Compose stacks (file-based)
-   Containers
-   Networks
-   Volumes
-   Images

All actions are executed through the host's Docker Engine using the
Docker socket and the real directory structure on disk.

------------------------------------------------------------------------

## Core Features

### Compose Management

-   List all compose stacks by scanning a defined root directory (uses a
    sensible default but can be overridden in a config file).

-   Inspect stack containers using:

    -   `docker compose ls`
    -   `docker compose -f <path> ps`

-   Start/stop/restart entire stacks.

-   Start/stop/restart individual stack containers.

-   Real-time logs and shell access for each container.

-   All destructive stack actions (e.g., stop/down/delete) require a
    confirmation prompt before execution.

-   Create new stacks by choosing:

    -   Stack directory (e.g. `/mnt/storage/yaml`)
    -   Stack name
    -   Compose file content
    -   Environment variables to write into an adjacent `.env`

-   Automatically writes:

        /mnt/storage/yaml/<stackName>/docker-compose.yaml
        /mnt/storage/yaml/<stackName>/.env

    and runs `docker compose up -d` with streamed terminal output.

### Container Management

-   List all containers (running and stopped).
-   Start, stop, delete containers.
-   Live logs via WebSocket.
-   Shell access into any container using `docker exec`.
-   Every destructive action (delete/stop) surfaces a confirmation
    prompt before execution.

### Volumes

-   List volumes.
-   Delete individual volumes.
-   Cleanup unused volumes via `docker volume prune`.
-   All deletions and prunes require explicit confirmation prompts.

### Networks

-   List networks.
-   Delete unused networks.
-   Cleanup dangling networks via `docker network prune`.
-   All deletions and prunes require explicit confirmation prompts.

### Images

-   List images.
-   Delete images.
-   Cleanup unused images via `docker image prune`.
-   All deletions and prunes require explicit confirmation prompts.

### System Cleanup

A cleanup dialog with checkboxes for: - Containers (unchecked by
default) - Volumes - Networks - Images

Shows space reclaimed using: - `docker system df` before/after
operations. All cleanup actions surface a confirmation dialog prior to
execution.

------------------------------------------------------------------------

## Tech Stack

### Backend

-   Language: Python (preferred for the initial implementation)
-   Interfaces:
    -   Docker Engine API (`/var/run/docker.sock`)
    -   Subprocess execution of `docker` and `docker compose`
-   WebSocket channels for:
    -   Logs
    -   Terminal shell streaming
    -   Deployment output streaming
-   Responsibilities:
    -   Stack discovery
    -   Compose command execution
    -   Container/volume/network/image CRUD
    -   Cleanup operations
    -   Validation and file operations for stack directories
    -   Reading runtime configuration (e.g., stack root, frontend port)
        from a config file

### Frontend

-   Framework: React (recommended)
-   Features:
    -   Left sidebar navigation: Compose, Containers, Volumes, Networks,
        Images
    -   Data tables for each resource type
    -   YAML editor for new stack creation (captures environment
        variables into a generated `.env` adjacent to each
        `docker-compose.yaml`)
    -   Embedded terminal via xterm.js
    -   Real-time logs via WebSocket
    -   Frontend served on port `18675` by default

### Deployment

Recommended Docker Compose deployment (frontend exposed on port 18675):

``` yaml
services:
  webui:
    image: your/name
    ports:
      - "18675:18675"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /mnt/storage/yaml:/mnt/storage/yaml
```

------------------------------------------------------------------------

## Development Timeline

### Stage 1 --- Backend Foundations

-   Project structure setup
-   Integrate Docker Engine API (or CLI wrappers)
-   Implement endpoints for:
    -   Container list/start/stop/logs
    -   Volume list/delete
    -   Network list/delete
    -   Image list/delete
-   Create WebSocket log streaming
-   Ensure `/var/run/docker.sock` is accessible

### Stage 2 --- Compose Stack Engine

-   Implement stack discovery by scanning root directory
-   Implement:
    -   `compose ls`
    -   `compose ps`
    -   `compose up -d`
    -   `compose down`
-   Build endpoints for per-stack operations
-   Add real-time deployment output

### Stage 3 --- Frontend Base UI

-   Build navigation layout
-   Add pages:
    -   Containers
    -   Volumes
    -   Networks
    -   Images
-   Build tables and action buttons
-   Integrate log viewer component

### Stage 4 --- Compose UI

-   Compose list page
-   Container sublist per stack
-   YAML editor for new stacks
-   Terminal-style output for deployments
-   Add edit/update stack file features

### Stage 5 --- Shell Access

-   Implement backend PTY creation via `docker exec`
-   WebSocket transport for bidirectional shell interaction
-   Integrate frontend terminal (xterm.js)

### Stage 6 --- System Cleanup & Stats

-   Implement cleanup dialog with checkboxes
-   Use `docker system df` to measure reclaimed space
-   Display summary to user

### Stage 7 --- Polishing & Security

-   Add authentication layer with a simple username/password flow: the
    first login prompts creation of a single administrator account
    (single-user for now, multi-user later)
-   Rate limit dangerous actions
-   Add configuration page for stack root, frontend port, theme, etc.
-   Write documentation & finalize UI/UX polish

------------------------------------------------------------------------

## License

MIT (or any license you prefer)

## Contributions

PRs, issues, and feature requests are welcome.
