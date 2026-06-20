#!/usr/bin/env bash
#
# AgentMarket setup — idempotent. Safe to re-run.
#
# Handles the mechanical steps automatically (deps, .env, typecheck, Circle CLI)
# and GUIDES you through the interactive / real-money steps (Circle login,
# wallet funding) instead of doing them for you.
#
#   ./setup.sh            # full setup
#   ./setup.sh --wallet   # also create + report an agent wallet at the end
#
# NOTE: the Circle Agent Stack runs on Base MAINNET — funding uses real USDC.
# This script never moves money; it only prints the commands for you to run.

set -euo pipefail
cd "$(dirname "$0")"

# ---- pretty output ----
bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m✗\033[0m %s\n" "$1"; }
step() { printf "\n\033[36m▶ %s\033[0m\n" "$1"; }

CREATE_WALLET=0
[ "${1:-}" = "--wallet" ] && CREATE_WALLET=1

# ---- 0. prerequisites ----
step "Checking prerequisites"
command -v node >/dev/null 2>&1 || { err "node not found — install Node 20+"; exit 1; }
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 20 ] && ok "node $(node -v)" || { err "Node 20+ required (have $(node -v))"; exit 1; }
command -v npm >/dev/null 2>&1 && ok "npm $(npm -v)" || { err "npm not found"; exit 1; }

# ---- 1. dependencies ----
step "Installing npm dependencies"
# openai@4 optionally peers zod@3 while the Agent SDK needs zod@4 — harmless, so legacy-peer-deps.
npm install --legacy-peer-deps >/dev/null 2>&1 && ok "dependencies installed" || { err "npm install failed — run it manually to see why"; exit 1; }

# ---- 2. .env ----
step "Environment file"
if [ -f .env ]; then
  ok ".env already exists (left untouched)"
else
  cp .env.example .env && ok "created .env from .env.example"
fi
# Report which required keys are still blank.
MISSING=""
for KEY in ANTHROPIC_API_KEY TAVILY_API_KEY; do
  VAL=$(grep -E "^${KEY}=" .env | head -1 | cut -d= -f2-)
  [ -z "$VAL" ] && MISSING="$MISSING $KEY"
done
NEBIUS=$(grep -E "^NEBIUS_API_KEY=" .env | head -1 | cut -d= -f2-)
[ -z "$NEBIUS" ] && warn "NEBIUS_API_KEY blank (optional — bonus prize; falls back to format checks)"
if [ -n "$MISSING" ]; then
  warn "set these in .env before running the agent:$MISSING"
else
  ok "required keys present (ANTHROPIC_API_KEY, TAVILY_API_KEY)"
fi

# ---- 3. typecheck ----
step "Type-checking the project"
npm run typecheck >/dev/null 2>&1 && ok "typecheck passed" || { err "typecheck failed — run 'npm run typecheck'"; exit 1; }

# ---- 4. Circle CLI ----
step "Circle CLI"
if command -v circle >/dev/null 2>&1; then
  ok "circle CLI found ($(circle --version 2>/dev/null | head -1 || echo 'version unknown'))"
else
  warn "circle CLI not found. Install it globally, then re-run this script:"
  echo "      npm i -g @circle-fin/cli      # TODO(verify): confirm the package name"
  echo "    (Circle Agent Stack docs: https://developers.circle.com/agent-stack)"
fi

# ---- 5. Circle session + skill (interactive — guidance only) ----
if command -v circle >/dev/null 2>&1; then
  step "Circle session"
  if circle wallet status --type agent --output json >/dev/null 2>&1; then
    ok "a Circle session exists (the agent will reuse it)"
  else
    warn "no valid Circle session. Log in (email + OTP) before running the agent:"
    echo "      circle login"
  fi
  step "Circle agent skill"
  echo "    Install the agent skill once (no-op if already installed):"
  echo "      circle skill install"

  # ---- 6. optional wallet creation ----
  if [ "$CREATE_WALLET" = "1" ]; then
    step "Creating an agent wallet on Base"
    if circle wallet status --type agent --output json >/dev/null 2>&1; then
      circle wallet create --chain BASE --output json || warn "wallet create failed (are you logged in?)"
      echo
      warn "Fund it with a little USDC (real money — Base mainnet), e.g.:"
      echo "      circle wallet fund --address <ADDR> --chain BASE --amount 2 --token usdc --method fiat"
    else
      warn "log in first (circle login), then re-run: ./setup.sh --wallet"
    fi
  fi
fi

# ---- done ----
bold ""
bold "Setup complete. Next steps:"
echo "  1. Fill any blank keys in .env"
[ "$(command -v circle >/dev/null 2>&1; echo $?)" = "0" ] || echo "  2. Install + log in to the Circle CLI (see above)"
echo "  3. Create + fund an agent wallet:   ./setup.sh --wallet"
echo "  4. Run it:"
echo "       npm run dashboard      # terminal A — http://localhost:4000"
echo "       npm run agent \"Series A fintech CTOs in Europe, 8 leads\""
echo
echo "  (deterministic fallback path: npm run consumer \"...\")"
