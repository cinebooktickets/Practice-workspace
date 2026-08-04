---
name: docker-only-execution
description: The Dev Container is the sandbox — toolchains inside it are normal; installing anything on the host is forbidden. Use when running builds, tests, or services, or when scaffolding a Dockerfile or compose.yaml. Uses compose.yaml (v2 standard), not docker-compose.yml.
---

# Container-only execution

The host machine has VS Code, Git, and Docker Desktop. **That's all.**
Everything else — Java 17/Maven, Node 20, Python 3.12/uv, graphify, jq —
lives inside the Dev Container, which is itself a Docker container. That is
how the same workspace runs identically on Windows and macOS.

## Know where you are

```bash
{ [ -f /.dockerenv ] || [ -n "${REMOTE_CONTAINERS:-}" ]; } && echo in-container || echo ON-HOST
```

- **Inside the Dev Container** (the normal case): `npm install`, `mvn test`,
  `uv run pytest` are correct and encouraged — they are already containerized.
  Nothing you install here touches the host.
- **On a bare host**: install nothing. Ask the human to "Reopen in Container",
  or wrap the command in a disposable container:

```bash
docker run --rm -it -v "$PWD:/work" -w /work python:3.12-slim python -m pytest
```

PowerShell needs braces so `:` doesn't bind into the variable name:

```powershell
docker run --rm -it -v "${PWD}:/work" -w /work python:3.12-slim python -m pytest
```

## Repos that ship their own Docker setup

Run their `docker compose` from inside the Dev Container (it has its own
inner Docker daemon). Prefer compose-defined services for anything
long-running — databases, app stacks:

```bash
docker compose up --build <service>
docker compose run --rm <service> <cmd>
```

## Compose, not docker-compose

`compose.yaml` is the standard filename. Avoid `docker-compose.yml` (legacy)
and the `docker-compose` CLI (legacy — use `docker compose`, no hyphen).

## What you'll never see here

- `npm install` / `pip install` / `cargo build` / `go install` **on the host**
- A README that says "first install Node 20, Python 3.11, and Postgres locally"

If a dependency is missing, it belongs in the Dev Container config or a
Dockerfile — never on the host. The `block-dangerous-bash` hook enforces this
for Claude Code.
