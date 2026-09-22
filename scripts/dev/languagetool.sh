#!/usr/bin/env bash
# LanguageTool local editorial engine — GOAP-273 Phase A1 / ADR-274.
#
# Provisions and runs the official embedded HTTP server ON DEMAND for Wave 4
# spelling/grammar qualification (ADR-999 D5: deployment-local, not
# browser-offline). Deliberately not wired into devcontainer postCreate or CI:
# the JRE + distribution cost ~793MB on disk (zip 251 + unpacked 406 + JRE 136)
# and no default gate needs a running engine.
#
# Commands:
#   up       provision (JRE + distribution) and start with health wait (default)
#   down     stop the server started via this script (pidfile)
#   health   probe /v2/check and show version + bind
#   status   provisioning state + run state
#   corpus   run the ADR-999 §3 corpus harness (requires `up`)
#
# Environment:
#   LT_HOME  storage root (default: ${XDG_CACHE_HOME:-$HOME/.cache}/do-epub-studio/languagetool)
#   LT_PORT  server port (default: 8081)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LT_HOME="${LT_HOME:-${XDG_CACHE_HOME:-$HOME/.cache}/do-epub-studio/languagetool}"
# Pin discipline (ADR-274 D3): upstream ships a rolling "latest snapshot" URL,
# so the content is verified against a pinned digest. Drift fails loudly and
# is re-pinned consciously in both constants — never silently updated.
LT_PIN_VERSION="6.9-SNAPSHOT"
LT_PIN_SHA256="8efc9fca82aacbd4ab68d46f4317ec3fb96542bceaaace254aeeefecf839b13d"
LT_ZIP_URL="https://languagetool.org/download/snapshots/LanguageTool-latest-snapshot.zip"
# JRE: major pinned to 17+ (LanguageTool requirement), patch floats so security
# updates flow in (ADR-274 D4).
ADOPTIUM_URL="https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jre/hotspot/normal/eclipse"

LT_PORT="${LT_PORT:-8081}"
LT_BASE="http://127.0.0.1:${LT_PORT}"
SERVER_DIR="$LT_HOME/LanguageTool-$LT_PIN_VERSION"
JRE_DIR="$LT_HOME/jre17"
TARBALL="$LT_HOME/.jre17.tar.gz"
PID_FILE="$LT_HOME/server.pid"
LOG_FILE="$LT_HOME/server.log"
JAVA_BIN=""

log() { printf '%s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

usage() {
  log "Usage: $0 {up|down|health|status|corpus}"
  log "  LT_HOME=$LT_HOME  LT_PORT=$LT_PORT"
}

java_major() {
  java -version 2>&1 | sed -nE 's/.*version "([0-9]+)(\.[0-9]+)?.*/\1/p' | head -n1
}

ensure_jre() {
  if [ -x "$JRE_DIR/bin/java" ]; then
    JAVA_BIN="$JRE_DIR/bin/java"
    return 0
  fi
  if command -v java >/dev/null 2>&1; then
    local major
    major="$(java_major || true)"
    if [ -n "$major" ] && [ "$major" -ge 17 ] 2>/dev/null; then
      JAVA_BIN="$(command -v java)"
      log "  JRE: system $(java -version 2>&1 | head -n1)"
      return 0
    fi
    log "  JRE: system java is ${major:-unknown} (<17) — provisioning Temurin 17"
  fi
  if command -v apt-get >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    log "  JRE: trying apt openjdk-17-jre-headless (works on bookworm images)..."
    if sudo -n apt-get install -y -qq --no-install-recommends openjdk-17-jre-headless >/dev/null 2>&1 \
      && command -v java >/dev/null 2>&1 \
      && [ "$(java_major || echo 0)" -ge 17 ] 2>/dev/null; then
      JAVA_BIN="$(command -v java)"
      log "  JRE: apt ok ($(java -version 2>&1 | head -n1))"
      return 0
    fi
    log "  JRE: apt failed (stale/removed dist mirror — observed on bullseye 2026-09-22)"
  fi
  log "  JRE: downloading Temurin 17 JRE to $JRE_DIR ..."
  mkdir -p "$JRE_DIR"
  curl -fsSL -o "$TARBALL" "$ADOPTIUM_URL" || die "Temurin download failed"
  tar -xzf "$TARBALL" -C "$JRE_DIR" --strip-components=1 || die "Temurin extract failed"
  rm -f "$TARBALL"
  [ -x "$JRE_DIR/bin/java" ] || die "java missing after Temurin install"
  JAVA_BIN="$JRE_DIR/bin/java"
  log "  JRE: $("$JAVA_BIN" -version 2>&1 | head -n1)"
}

ensure_lt() {
  mkdir -p "$LT_HOME"
  if [ -f "$SERVER_DIR/languagetool-server.jar" ]; then
    return 0
  fi
  local zip="$LT_HOME/lt.zip"
  if [ ! -f "$zip" ]; then
    log "  LT: downloading distribution (~251MB)..."
    curl -fsSL -o "$zip" "$LT_ZIP_URL" || die "LanguageTool download failed"
  fi
  printf '%s  %s\n' "$LT_PIN_SHA256" "$zip" | sha256sum -c - >/dev/null 2>&1 ||
    die "sha256 mismatch for $zip (pinned $LT_PIN_SHA256) — the snapshot moved on: consciously re-pin LT_PIN_VERSION + LT_PIN_SHA256 in $0 (ADR-274 D3)"
  log "  LT: digest ok — unpacking $LT_PIN_VERSION"
  unzip -qo "$zip" -d "$LT_HOME" || die "unzip failed"
  [ -f "$SERVER_DIR/languagetool-server.jar" ] ||
    die "expected $SERVER_DIR/languagetool-server.jar after unzip"
}

probe() {
  curl -fsS "$LT_BASE/v2/check?language=en-US&text=hello" -o /dev/null 2>/dev/null
}

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

print_health() {
  local info version
  info="$(curl -fsS "$LT_BASE/v2/check?language=en-US&text=hello" 2>/dev/null)" ||
    { log "  health: DOWN ($LT_BASE)"; return 1; }
  version="$(printf '%s' "$info" | sed -nE 's/.*"software":\{[^}]*"version":"([^"]+)".*/\1/p')"
  log "  health: UP  version=${version:-unknown}  base=$LT_BASE"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -m1 ":${LT_PORT}" | sed 's/^/  bind:   /' ||
      log "  bind:   (listener not found via ss)"
  fi
}

cmd_up() {
  command -v curl >/dev/null 2>&1 || die "curl is required"
  ensure_jre
  ensure_lt
  if is_running; then
    log "  server already running (pid $(cat "$PID_FILE"))"
    print_health || true
    return 0
  fi
  if probe; then
    log "  a LanguageTool server already answers $LT_BASE (started outside this script)"
    print_health || true
    return 0
  fi
  # Empty server.properties: no fastText model, language supplied per request —
  # keeps processing local and the footprint at its minimum (ADR-274 D1/D5).
  touch "$SERVER_DIR/server.properties"
  log "  starting: loopback only (no --public / --allow-origin), heap 1g, log $LOG_FILE"
  (
    cd "$SERVER_DIR"
    nohup "$JAVA_BIN" -Xmx1g -cp languagetool-server.jar \
      org.languagetool.server.HTTPServer \
      --config server.properties --port "$LT_PORT" >"$LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$PID_FILE"
  )
  local i=0
  while [ "$i" -lt 30 ]; do
    probe && break
    i=$((i + 1))
    sleep 2
  done
  probe || {
    tail -n 5 "$LOG_FILE" >&2 || true
    die "server did not become healthy within 60s (see $LOG_FILE)"
  }
  log "  server up:"
  print_health || true
}

cmd_down() {
  local pid i
  if is_running; then
    pid="$(cat "$PID_FILE")"
    kill "$pid" 2>/dev/null || true
    i=0
    while [ "$i" -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
      i=$((i + 1))
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    log "  stopped (pid $pid)"
  elif probe; then
    log "  a server answers $LT_BASE but has no pidfile from this script — stop it manually"
    return 0
  else
    log "  not running"
  fi
  rm -f "$PID_FILE"
}

cmd_status() {
  log "LT_HOME=$LT_HOME"
  log "pin: $LT_PIN_VERSION  sha256=${LT_PIN_SHA256:0:16}..."
  if [ -x "$JRE_DIR/bin/java" ]; then
    log "JRE: bundled $("$JRE_DIR/bin/java" -version 2>&1 | head -n1)"
  elif command -v java >/dev/null 2>&1; then
    log "JRE: system $(java -version 2>&1 | head -n1)"
  else
    log "JRE: not provisioned"
  fi
  if [ -d "$SERVER_DIR" ]; then
    log "LT: provisioned ($SERVER_DIR)"
  else
    log "LT: not provisioned"
  fi
  if is_running; then
    log "server: running (pid $(cat "$PID_FILE"))"
  else
    log "server: no pidfile"
  fi
  print_health || true
}

cmd_corpus() {
  command -v node >/dev/null 2>&1 || die "node is required for the corpus harness"
  probe || die "server not answering $LT_BASE — run: $0 up"
  node "$SCRIPT_DIR/languagetool-corpus.mjs"
}

main() {
  local cmd="${1:-up}"
  case "$cmd" in
    up) cmd_up ;;
    down) cmd_down ;;
    health) print_health ;;
    status) cmd_status ;;
    corpus) cmd_corpus ;;
    -h | --help | help) usage ;;
    *) usage >&2; die "unknown command: $cmd" ;;
  esac
}

main "$@"
