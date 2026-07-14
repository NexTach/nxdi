#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

require_command awk

NGINX_CONFIG="${NXDI_NGINX_CONFIG:-/opt/homebrew/etc/nginx/servers/kimtaeeun.conf}"
NGINX_BIN="${NXDI_NGINX_BIN:-/opt/homebrew/bin/nginx}"
LOCK_DIR="/tmp/nxdi-nginx-config.lock"
BEGIN_MARKER="# >>> nxdi-api >>>"
END_MARKER="# <<< nxdi-api <<<"

if [[ ! -f "$NGINX_CONFIG" ]]; then
  echo "Nginx server configuration not found: $NGINX_CONFIG" >&2
  exit 1
fi

if [[ ! -x "$NGINX_BIN" ]]; then
  echo "Nginx executable not found: $NGINX_BIN" >&2
  exit 1
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another Nginx configuration update is in progress." >&2
  exit 1
fi

cleaned="$(mktemp)"
block="$(mktemp)"
candidate="$(mktemp)"
backup="${NGINX_CONFIG}.nxdi-backup"

cleanup() {
  rm -f "$cleaned" "$block" "$candidate"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
  index($0, begin) { skipping = 1; next }
  skipping && index($0, end) { skipping = 0; next }
  !skipping { print }
  END { if (skipping) exit 42 }
' "$NGINX_CONFIG" > "$cleaned"

cat > "$block" <<'NGINX_BLOCK'
    # >>> nxdi-api >>>
    # managed by NXDI server deployment
    location = /nxdi-api {
        return 308 /nxdi-api/;
    }

    location /nxdi-api/ {
        proxy_pass         http://127.0.0.1:10104/;
        proxy_http_version 1.1;
        proxy_set_header   Host                $host;
        proxy_set_header   X-Real-IP           $remote_addr;
        proxy_set_header   X-Forwarded-For     $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto   $http_x_forwarded_proto;
        proxy_set_header   X-Forwarded-Prefix  /nxdi-api;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
    # <<< nxdi-api <<<
NGINX_BLOCK

awk -v block_file="$block" '
  { lines[NR] = $0 }
  END {
    closing = 0
    for (i = NR; i >= 1; i--) {
      if (lines[i] ~ /^[[:space:]]*}[[:space:]]*$/) {
        closing = i
        break
      }
    }
    if (closing == 0) exit 43
    for (i = 1; i <= NR; i++) {
      if (i == closing) {
        while ((getline block_line < block_file) > 0) print block_line
        close(block_file)
      }
      print lines[i]
    }
  }
' "$cleaned" > "$candidate"

cp "$NGINX_CONFIG" "$backup"
cp "$candidate" "$NGINX_CONFIG"

if ! "$NGINX_BIN" -t; then
  cp "$backup" "$NGINX_CONFIG"
  "$NGINX_BIN" -t
  echo "Nginx validation failed; the previous configuration was restored." >&2
  exit 1
fi

"$NGINX_BIN" -s reload
rm -f "$backup"
