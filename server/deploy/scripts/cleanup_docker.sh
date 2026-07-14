#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_command docker

STAGE="${1:-}"
LOCK_DIR="${DOCKER_GC_LOCK_DIR:-/tmp/shared-docker-gc.lock}"
PROTECTED_CONTAINERS="${DOCKER_GC_PROTECTED_CONTAINERS:-mysql redis my-resume hw-sence claude-trigger nxdi-server}"
CRITICAL_CONTAINERS="${DOCKER_GC_CRITICAL_CONTAINERS:-mysql redis}"
BUILD_CACHE_RETENTION="${DOCKER_GC_BUILD_CACHE_RETENTION:-24h}"
CONTAINER_RETENTION_SECONDS="${DOCKER_GC_CONTAINER_RETENTION_SECONDS:-86400}"

case "$STAGE" in
  stop|post-deploy)
    ;;
  *)
    echo "Usage: $0 <stop|post-deploy>" >&2
    exit 64
    ;;
esac

if [[ ! "$CONTAINER_RETENTION_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "DOCKER_GC_CONTAINER_RETENTION_SECONDS must be a non-negative integer." >&2
  exit 64
fi

lock_acquired=false
snapshot_dir=""

release_lock() {
  if [[ -n "$snapshot_dir" ]]; then
    rm -rf "$snapshot_dir"
  fi

  if [[ "$lock_acquired" == "true" ]]; then
    rm -rf "$LOCK_DIR"
  fi
}

trap release_lock EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    lock_acquired=true
    printf '%s\n' "$$" > "${LOCK_DIR}/pid"
    return 0
  fi

  local owner_pid=""
  if [[ -f "${LOCK_DIR}/pid" ]]; then
    owner_pid="$(sed -n '1p' "${LOCK_DIR}/pid" 2>/dev/null || true)"
  fi

  if [[ ! "$owner_pid" =~ ^[0-9]+$ ]]; then
    echo "Docker cleanup lock exists without a valid owner PID: ${LOCK_DIR}" >&2
    exit 75
  fi

  if kill -0 "$owner_pid" 2>/dev/null; then
    echo "Another Docker cleanup is running with PID ${owner_pid}." >&2
    exit 75
  fi

  echo "Removing stale Docker cleanup lock: ${LOCK_DIR}" >&2
  rm -rf "$LOCK_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "Failed to acquire Docker cleanup lock: ${LOCK_DIR}" >&2
    exit 75
  fi

  lock_acquired=true
  printf '%s\n' "$$" > "${LOCK_DIR}/pid"
}

critical_gate() {
  local container
  local running
  local health

  for container in $CRITICAL_CONTAINERS; do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      echo "Critical container is missing: ${container}" >&2
      return 73
    fi

    running="$(docker inspect --format '{{.State.Running}}' "$container")"
    if [[ "$running" != "true" ]]; then
      echo "Critical container is not running: ${container}" >&2
      return 73
    fi

    health="$(docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
      "$container")"
    if [[ "$health" == "unhealthy" ]]; then
      echo "Critical container is unhealthy: ${container}" >&2
      return 73
    fi
  done
}

is_protected_container() {
  local candidate="$1"
  local protected

  for protected in $PROTECTED_CONTAINERS; do
    if [[ "$candidate" == "$protected" ]]; then
      return 0
    fi
  done

  return 1
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

rfc3339_to_epoch() {
  local value="$1"
  local without_fraction
  local normalized

  without_fraction="${value%%.*}"
  normalized="${without_fraction%Z}"

  if date -j -u -f '%Y-%m-%dT%H:%M:%S' "$normalized" '+%s' 2>/dev/null; then
    return 0
  fi

  date -u -d "$value" '+%s' 2>/dev/null
}

best_effort() {
  local description="$1"
  shift

  echo "Docker cleanup: ${description}"
  if ! "$@"; then
    echo "Docker cleanup warning: ${description} failed." >&2
  fi
}

snapshot_critical_volumes() {
  local container

  snapshot_dir="$(mktemp -d "${TMPDIR:-/tmp}/nxdi-docker-gc.XXXXXX")"
  : > "${snapshot_dir}/critical-volumes"

  for container in $CRITICAL_CONTAINERS; do
    docker inspect \
      --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}' \
      "$container" >> "${snapshot_dir}/critical-volumes"
  done

  sort -u "${snapshot_dir}/critical-volumes" -o "${snapshot_dir}/critical-volumes"
}

verify_critical_volumes() {
  local volume

  while IFS= read -r volume; do
    [[ -n "$volume" ]] || continue
    if ! docker volume inspect "$volume" >/dev/null 2>&1; then
      echo "Critical Docker volume disappeared during cleanup: ${volume}" >&2
      return 73
    fi
  done < "${snapshot_dir}/critical-volumes"
}

remove_safe_stopped_containers() {
  local id
  local state
  local name
  local mount_count
  local keep_label
  local nxdi_keep_label
  local reference_at
  local reference_epoch
  local now_epoch
  local age_seconds

  now_epoch="$(date -u '+%s')"

  for id in $(docker ps -aq \
    --filter status=created \
    --filter status=exited \
    --filter status=dead); do
    state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
    case "$state" in
      created|exited|dead)
        ;;
      *)
        echo "Skipping container whose state changed during cleanup: ${id} (${state:-unknown})"
        continue
        ;;
    esac

    name="$(docker inspect --format '{{.Name}}' "$id")"
    name="${name#/}"
    if is_protected_container "$name"; then
      echo "Skipping protected stopped container: ${name}"
      continue
    fi

    if [[ "$state" == "created" ]]; then
      reference_at="$(docker inspect --format '{{.Created}}' "$id")"
    else
      reference_at="$(docker inspect --format '{{.State.FinishedAt}}' "$id")"
    fi
    if ! reference_epoch="$(rfc3339_to_epoch "$reference_at")"; then
      echo "Skipping stopped container with an unparseable retention time: ${name} (${reference_at})" >&2
      continue
    fi

    age_seconds=$((now_epoch - reference_epoch))
    if (( age_seconds < CONTAINER_RETENTION_SECONDS )); then
      echo "Skipping recent stopped container: ${name} (${age_seconds}s old)"
      continue
    fi

    mount_count="$(docker inspect --format '{{len .Mounts}}' "$id")"
    if [[ "$mount_count" != "0" ]]; then
      echo "Skipping stopped container with mounts: ${name}"
      continue
    fi

    keep_label="$(docker inspect \
      --format '{{with .Config.Labels}}{{index . "gc.keep"}}{{end}}' \
      "$id" 2>/dev/null || true)"
    nxdi_keep_label="$(docker inspect \
      --format '{{with .Config.Labels}}{{index . "com.nxdi.gc.keep"}}{{end}}' \
      "$id" 2>/dev/null || true)"
    if is_truthy "$keep_label" || is_truthy "$nxdi_keep_label"; then
      echo "Skipping keep-labelled stopped container: ${name}"
      continue
    fi

    if ! docker rm "$id"; then
      echo "Docker cleanup warning: failed to remove stopped container ${name}." >&2
    fi
  done
}

prune_volumes() {
  best_effort "anonymous dangling volumes" docker volume prune --force
  best_effort "opt-in dangling named volumes" \
    docker volume prune --all --force --filter "label=com.nxdi.gc.prunable=true"
}

prune_build_cache() {
  if docker buildx version >/dev/null 2>&1; then
    best_effort "build cache unused for ${BUILD_CACHE_RETENTION}" \
      docker buildx prune --all --force --filter "until=${BUILD_CACHE_RETENTION}"
  else
    best_effort "build cache unused for ${BUILD_CACHE_RETENTION}" \
      docker builder prune --all --force --filter "until=${BUILD_CACHE_RETENTION}"
  fi
}

prune_images() {
  if [[ "$STAGE" == "stop" ]]; then
    best_effort "dangling images" docker image prune --force
  else
    best_effort "all unused images" docker image prune --all --force
  fi
}

acquire_lock
docker info >/dev/null
critical_gate
snapshot_critical_volumes

echo "Docker disk usage before ${STAGE} cleanup:"
best_effort "disk usage report before cleanup" docker system df

remove_safe_stopped_containers
prune_volumes
prune_images
prune_build_cache

critical_gate
verify_critical_volumes

echo "Docker disk usage after ${STAGE} cleanup:"
best_effort "disk usage report after cleanup" docker system df

echo "Docker ${STAGE} cleanup completed safely."
