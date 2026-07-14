#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_command docker

"${SCRIPT_DIR}/cleanup_docker.sh" stop

if [[ -f "$COMPOSE_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" down --remove-orphans
fi
