#!/usr/bin/env bash
#
# scripts/dev.sh
#
# 実機 iPhone 向け開発環境（Cloudflare Tunnel + Expo Dev Server）を管理する。
# 引数なしで呼ぶと冪等に「停止 → cloudflared 起動 → URL 抽出 → expo 起動」を実行する。
#
# Usage:
#   ./scripts/dev.sh           # 起動（既存プロセスがあれば再起動）
#   ./scripts/dev.sh stop      # 停止
#   ./scripts/dev.sh status    # 状態確認
#   ./scripts/dev.sh url       # 現在の trycloudflare URL を表示
#   ./scripts/dev.sh qr        # expo ペインのキャプチャ（QR コード含む）
#
# 前提:
#   - tmux, cloudflared, npx (Node.js) がインストール済み
#   - プロジェクトルートに .env が存在（Expo が読み込む）

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT/.dev-tunnel"
URL_FILE="$STATE_DIR/url.txt"
SESSION="goshuin-dev"
CF_WINDOW="cloudflared"
EXPO_WINDOW="expo"
PORT=8081

mkdir -p "$STATE_DIR"

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

session_exists() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

capture_window() {
  local win="$1"
  # -J: join any wrapped lines so long URLs are not split at the pane width.
  tmux capture-pane -p -J -t "$SESSION:$win" -S -500 2>/dev/null || true
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: '$1' is required but not installed." >&2
    exit 1
  fi
}

# ------------------------------------------------------------------
# Core
# ------------------------------------------------------------------

stop_all() {
  if session_exists; then
    echo "Killing tmux session '$SESSION'..."
    tmux kill-session -t "$SESSION" 2>/dev/null || true
  fi

  # Safety net: kill anything still bound to port 8081
  local leftover
  leftover="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$leftover" ]; then
    echo "Killing leftover processes on port $PORT: $leftover"
    echo "$leftover" | xargs kill -9 2>/dev/null || true
  fi

  # Safety net: kill stray cloudflared tunnels pointing at our port
  pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORT" 2>/dev/null || true

  rm -f "$URL_FILE"
}

start_cloudflared() {
  echo "Starting cloudflared in tmux window '$CF_WINDOW'..."
  # -x/-y: set a wide virtual terminal so long lines (URLs, QR) don't get wrapped awkwardly.
  tmux new-session -d -s "$SESSION" -n "$CF_WINDOW" -x 220 -y 50 \
    "cloudflared tunnel --url http://127.0.0.1:$PORT"
}

wait_for_url() {
  local timeout=30
  local elapsed=0
  local url=""
  echo "Waiting for trycloudflare URL (max ${timeout}s)..."
  while [ "$elapsed" -lt "$timeout" ]; do
    url="$(capture_window "$CF_WINDOW" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1 || true)"
    if [ -n "$url" ]; then
      echo "$url" >"$URL_FILE"
      echo "URL: $url"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "ERROR: Failed to capture trycloudflare URL within ${timeout}s" >&2
  echo "--- cloudflared output (last 30 lines) ---" >&2
  capture_window "$CF_WINDOW" | tail -30 >&2
  return 1
}

start_expo() {
  local url
  url="$(cat "$URL_FILE")"
  echo "Starting expo in tmux window '$EXPO_WINDOW' (EXPO_PACKAGER_PROXY_URL=$url)..."
  # cd to project root inside the new window and launch expo.
  # The window will source the user's shell rc, so nvm/default-node are picked up automatically.
  tmux new-window -t "$SESSION:" -n "$EXPO_WINDOW" \
    "cd '$ROOT' && export EXPO_PACKAGER_PROXY_URL='$url' && npx expo start --dev-client --port $PORT"
}

wait_for_expo_ready() {
  local timeout=90
  local elapsed=0
  echo "Waiting for Metro Bundler (max ${timeout}s)..."
  while [ "$elapsed" -lt "$timeout" ]; do
    local out
    out="$(capture_window "$EXPO_WINDOW")"
    if echo "$out" | grep -q "Waiting on http://localhost:$PORT"; then
      echo "Metro ready."
      return 0
    fi
    if echo "$out" | grep -q "Logs for your project will appear below"; then
      echo "Metro ready."
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "WARN: Metro did not report ready within ${timeout}s. It may still be starting." >&2
  return 0
}

# ------------------------------------------------------------------
# Commands
# ------------------------------------------------------------------

cmd_start() {
  require_cmd tmux
  require_cmd cloudflared
  require_cmd npx
  require_cmd lsof

  stop_all
  start_cloudflared
  if ! wait_for_url; then
    stop_all
    exit 1
  fi
  start_expo
  wait_for_expo_ready || true

  echo ""
  echo "================================================================"
  echo "  Dev tunnel ready"
  echo "  URL: $(cat "$URL_FILE")"
  echo ""
  echo "  Attach tmux to see QR code / press 'r' for reload:"
  echo "    tmux attach -t $SESSION"
  echo "    (Ctrl-b then n to switch windows, Ctrl-b then d to detach)"
  echo ""
  echo "  Capture QR code (non-interactive):"
  echo "    ./scripts/dev.sh qr"
  echo ""
  echo "  Stop:"
  echo "    ./scripts/dev.sh stop"
  echo "================================================================"
}

cmd_stop() {
  stop_all
  echo "Stopped."
}

cmd_status() {
  if session_exists; then
    echo "tmux session '$SESSION': running"
    echo "  windows:"
    tmux list-windows -t "$SESSION" -F "    #{window_index}: #{window_name}" 2>/dev/null || true
    if [ -f "$URL_FILE" ]; then
      echo "URL: $(cat "$URL_FILE")"
    fi
  else
    echo "tmux session '$SESSION': stopped"
  fi
}

cmd_url() {
  if [ -f "$URL_FILE" ]; then
    cat "$URL_FILE"
  else
    echo "not running" >&2
    exit 1
  fi
}

cmd_qr() {
  if ! session_exists; then
    echo "Dev tunnel is not running. Start with: ./scripts/dev.sh" >&2
    exit 1
  fi
  capture_window "$EXPO_WINDOW"
}

# ------------------------------------------------------------------
# Dispatch
# ------------------------------------------------------------------

case "${1:-start}" in
  start | restart | "")
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  status)
    cmd_status
    ;;
  url)
    cmd_url
    ;;
  qr)
    cmd_qr
    ;;
  *)
    echo "Usage: $0 [start|stop|status|url|qr]" >&2
    exit 1
    ;;
esac
