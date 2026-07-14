#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_command curl

wait_for_url() {
  local description="$1"
  local url="$2"
  local host_header="${3:-}"
  local attempt

  for attempt in $(seq 1 30); do
    if [[ -n "$host_header" ]]; then
      if curl --fail --silent --show-error --max-time 5 \
        --header "Host: ${host_header}" "$url" >/dev/null; then
        echo "${description} is healthy."
        return 0
      fi
    elif curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      echo "${description} is healthy."
      return 0
    fi

    sleep 2
  done

  echo "${description} did not become healthy: ${url}" >&2
  return 1
}

wait_for_url "NXDI container" "http://127.0.0.1:10104/health"
wait_for_url "NXDI Nginx route" "http://127.0.0.1/nxdi-api/health" "kimtaeeun.site"

"${SCRIPT_DIR}/cleanup_docker.sh" post-deploy
