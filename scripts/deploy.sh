#!/usr/bin/env bash
# Pre-flight everything, then publish to GitHub Pages. Nothing is deployed unless
# every check passes, and what ships is the exact artifact the checks ran against.
#
#   pnpm deploy:gh        checks, then deploy
#   pnpm deploy:gh --check   checks only (no deploy)
#
# Steps are sequential and fail fast, so no task runner is needed. `set -m` puts the
# dev server in its own process group so we kill only OUR server — never pattern-kill
# `react-router dev`, which would take out a dev server running in tmux.
set -euo pipefail
set -m

cd "$(dirname "$0")/.."

CHECK_ONLY=false
[[ "${1:-}" == "--check" || "${1:-}" == "--check-only" ]] && CHECK_ONLY=true

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

DEV_PID=""
DEV_LOG="$(mktemp -t faqminder-dev.XXXXXX)"
cleanup() {
  [[ -n "$DEV_PID" ]] && kill -- -"$DEV_PID" 2>/dev/null || true
  rm -f "$DEV_LOG"
}
trap cleanup EXIT

step "Typecheck"
pnpm typecheck

step "Tests (unit + browser)"
pnpm test

step "Layer boundaries"
pnpm depcruise

step "End-to-end (real browser)"
pnpm dev >"$DEV_LOG" 2>&1 &
DEV_PID=$!
# Never assume the port: another Vite project may hold 5173, so read the port this
# server actually picked out of its own output.
PORT=""
for _ in $(seq 1 60); do
  PORT="$(grep -oE 'localhost:[0-9]+' "$DEV_LOG" | head -1 | cut -d: -f2 || true)"
  [[ -n "$PORT" ]] && break
  kill -0 "$DEV_PID" 2>/dev/null || { cat "$DEV_LOG"; fail "dev server exited during startup"; }
  sleep 0.5
done
[[ -n "$PORT" ]] || { cat "$DEV_LOG"; fail "dev server never reported a port"; }
echo "  dev server on :$PORT"
PORT="$PORT" node scripts/verify-e2e.mjs
kill -- -"$DEV_PID" 2>/dev/null || true
DEV_PID=""

# Builds, then drives that build in a browser: base paths, update flow, offline.
step "Production build (base paths, update flow, offline)"
pnpm verify:prod

[[ -f build/client/index.html ]] || fail "build/client/index.html missing — nothing to deploy"
[[ -f build/client/404.html ]] || fail "build/client/404.html missing — deep links would 404"
[[ -f build/client/sw.js ]] || fail "build/client/sw.js missing — no offline shell"
[[ -f build/client/version.json ]] || fail "build/client/version.json missing — clients could never detect this deploy"

if $CHECK_ONLY; then
  printf '\n\033[1;32m✔ All checks passed (--check: not deploying)\033[0m\n'
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  printf '\n\033[1;33m!  Working tree is dirty — deploying the built artifact anyway.\033[0m\n'
fi

step "Deploy → GitHub Pages"
pnpm exec gh-pages -d build/client
printf '\n\033[1;32m✔ Deployed\033[0m\n'
