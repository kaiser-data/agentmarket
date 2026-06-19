# 🛰️ AgentMarket — a budget-governed lead-gen agent on the Circle Agent Stack

An AI agent whose **Circle Agent Wallet is both its payment identity and its operating
budget**. Given a goal ("20 Series-A fintech CTOs in Europe"), it runs a repeatable job:

1. **Discovers** candidate companies with **Tavily**.
2. **Discovers paid enrichment services** on the **Circle Agent Marketplace**, inspects pricing.
3. **Pays per record** via **Circle Nanopayments** (gasless USDC, x402 via Gateway) — each
   payment justified and logged.
4. **Qualifies + validates** each result (**Nebius** / Claude). Records a **spend ledger** with receipts.
5. **Self-defends its budget:** when a service returns fabricated data, it rates it down and
   **blocklists that payee in the Agent Wallet policy** — the wallet refuses to pay the scammer again.
6. Stops at the lead target **or the budget cap**, then returns the leads + an itemized receipt ledger.

> Built on the **Claude Agent SDK** starter kit from the Circle Agent Stack ecosystem kits.
> Goes beyond "send USDC once": the wallet is part of the agent's job, every cycle.

See **[PLAN.md](./PLAN.md)** for checkpoints and the fallback ladder.

## Circle Agent Stack usage (prize requirements)
| Requirement | Where |
|---|---|
| Circle **Agent Wallet** (payment identity + budget) | `lib/circle-cli.ts`, `lib/policy.ts` |
| Wallet action (create/list/balance/pay) | `circle wallet …`, `circle services pay …` wrappers |
| Circle **Agent Marketplace** (discover + inspect + price) | `searchServices` / `inspectService` |
| **Nanopayments** (gasless USDC, x402) | `payService` → `circle services pay` |
| **Circle CLI** + **Skills** | CLI wrappers; `circle skill install` in setup |
| **Starter kit** | Claude Agent SDK kit (`@anthropic-ai/claude-agent-sdk`) |
| Receipt / spend ledger | `lib/ledger.ts` → console + `ledger.json` |
| Budget / spend cap / approval / **policy-based behavior** | `lib/policy.ts` (cap, approval threshold, auto-blocklist) |
| "What it paid for & why" | every payment carries a `reason`; shown in ledger + dashboard |

## Two ways to run it
- **`npm run agent`** — the headline: the **Claude Agent SDK** drives the whole workflow,
  calling the Circle MCP tools itself (wallet → discover → inspect → pay → qualify → validate →
  blocklist). Human-in-the-loop approves spends; payments under the per-call cap auto-approve.
- **`npm run consumer`** — a deterministic orchestrator over the same tools. Reliable fallback
  for a live demo if you don't want to depend on model behavior on stage.

Both call the **vendored, official `circle-tools`** (`vendor/`) — so wallet creation, the
counterfactual-SCA deploy, Gateway routing, and x402 v1/v2 are handled correctly, not re-guessed.

> ⚠️ The Circle Agent Stack runs on **Base mainnet** (real USDC, tiny amounts). Keep the budget
> cap small (`BUDGET_USDC`). There is no testnet faucet path here; fund via `circle wallet fund`.

## Quickstart
```bash
npm install --legacy-peer-deps    # openai@4 optionally peers zod@3; SDK needs zod@4 (harmless)
# Circle Agent Stack setup:
#   npm i -g @circle-fin/cli       # TODO(verify) exact package name
#   circle login                   # email + OTP (the agent can also do this inline)
#   circle skill install
#   circle wallet create --chain BASE && circle wallet fund ...   # fund a little USDC
cp .env.example .env               # add ANTHROPIC_API_KEY, TAVILY_API_KEY, (NEBIUS_API_KEY)

npm run typecheck                  # should pass clean

# Agentic demo
npm run dashboard                  # terminal A: http://localhost:4000 (budget bar, payments, blocklist)
npm run agent "Series A fintech CTOs in Europe, 8 leads"
```

## Layout
```
vendor/     circle-tools + kit-core  (vendored from the official Circle Agent Stack kits)
agents/     leadgen-agent (Claude Agent SDK loop) · leadgen-tools (MCP server: Circle + domain tools)
            · consumer (deterministic path) · service/run-services (local x402 sellers) · services.config
lib/        circle-cli (thin adapter over circle-tools) · policy (budget cap + blocklist)
            · ledger (receipts) · tavily · nebius · events · types
scripts/    spike-payment (go/no-go)
dashboard/  server (SSE) · index.html
```

## The original beat (judging: "originality" + "policy-based payment behavior")
Most entries demo a happy-path payment. AgentMarket demos a **self-defending wallet**: a rogue
service underbids to win the job, returns fabricated data, gets caught at validation, and is
**blocklisted in the wallet policy on stage** — spend reroutes to honest providers automatically.

## `TODO(verify)` markers
Grep for `TODO(verify)` — exact Circle CLI flags, JSON field names (balance, receipt), and the
wallet-policy/blocklist command to confirm against the installed CLI during the spike.

## Social-impact variant (Blockchain-for-Good)
Swap the ICP goal + service catalog to a **grant/RFP finder for nonprofits** — same engine.
