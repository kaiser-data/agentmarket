# 🛰️ AgentMarket — Proof-of-Quality: trustworthy commerce for AI agents

**The problem:** an AI agent with a wallet can pay any service on the marketplace — but it pays
**blind**. There's no trustworthy signal of whether a service's data is accurate or whether it's a
scam, and any "reputation" is gameable by Sybils. Agents have money and discovery; they're missing
a **trust layer**.

**The infrastructure (two primitives):**

1. **Payment-anchored, verification-backed reputation.** A service's reputation can only be minted
   from a **real, paid, independently cross-verified** interaction. Each attestation binds the
   **Circle payment tx** + an **independent verification tx** + the outcome, and is published to the
   **ERC-8004 ReputationRegistry** (real standard, deployed on Base). *You cannot fake a good score
   without spending real USDC and passing an independent oracle* — Sybil-resistant by construction.

2. **Keyless, policy-bound spending.** The AI model **never holds a key and never signs.** It only
   *proposes* a transaction; the **Circle Agent Wallet** (MPC) signs it behind the wallet's on-chain
   spending policy (allowlist + caps, set by the human via OTP). A **prompt-injected agent cannot
   move funds or write off-policy** — the signer refuses.

**The payoff (network effect):** Agent A pays 3 competing enrichment services, cross-verifies each,
and attests on-chain — one proves bad. An **independent Agent B queries reputation *before paying*,
and its wallet refuses the proven-bad service it never touched.** Agent A spent ~$0.67 to learn that;
because it's on-chain and verification-backed, **Agent B pays $0 to benefit.** One agent's paid lesson
becomes a public good.

```bash
npm run network-demo:sim     # watch it end-to-end, free (no keys, no USDC)
```

> **Reference consumer:** a budget-governed **B2B lead-gen agent** demonstrates the layer — it
> discovers prospects (Tavily), buys enrichment per-record via **Circle Nanopayments**, **pays Hunter
> to verify** each email, qualifies with **Nebius**, and only trusts services with proven on-chain
> reputation. Identity is an **ERC-721** (ERC-8004), so a verified track record is an ownable asset.

See **[PITCH.md](./PITCH.md)** for the demo script and **[PLAN.md](./PLAN.md)** for build notes.

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
| Budget / spend cap / approval / **policy-based behavior** | `lib/policy.ts` + keyless Circle signer (`lib/circle-execute.ts`) |
| "What it paid for & why" | every payment carries a `reason`; shown in ledger + dashboard |

## Infrastructure track usage (verifiable reputation + identity)
| Element | Where |
|---|---|
| **ERC-8004** Identity (ERC-721) + Reputation registries | `lib/erc8004.ts` (real ABIs vendored, deployed Base Sepolia `0x8004…`) |
| **Payment-anchored attestations** (Sybil-resistant) | `lib/reputation.ts` — binds pay tx + verify tx + outcome via `feedbackHash` |
| **Reputation gate** (route around proven-bad services) | `reputationGate()` → wallet refuses below-threshold payees |
| **Keyless signing** (model proposes, MPC signs behind policy) | `lib/circle-execute.ts` → `circle wallet execute` |
| **Verifiable logs / explorer proof** | BaseScan tx + ERC-721 identity-token links in demo output |
| **Cross-verification oracle** | one paid service independently checks another (Hunter verifies Apollo) |

## Architecture
```
   AI model (Nebius / Claude)         ← reasons, PROPOSES intents. Holds NO key.
            │  proposes
            ▼
   SpendPolicy (advisory, app-layer)  ← fast UX check (lib/policy.ts)
            │
            ▼
   Circle Agent Wallet (MPC signer)   ← AUTHORITATIVE. On-chain allowlist + caps.
            │  signs only what passes policy   Prompt injection can't get past here.
     ┌──────┴───────┐
     ▼              ▼
  x402 pay      wallet execute
  (services)    (ERC-8004 write)
     │              │
     ▼              ▼
  StableEnrich   ReputationRegistry + IdentityRegistry (ERC-8004, Base)
  (real data)    ← payment-anchored, cross-verified attestations
```

## Run it
**The infrastructure demo (the headline):**
```bash
npm run network-demo:sim     # two agents + on-chain reputation, free — no keys, no USDC
```

**The reference consumer (lead-gen agent) — three drivers, same tools + wallet policy:**
- **`npm run agent`** — default. The agent loop runs on **Nebius Token Factory**
  (OpenAI-compatible function calling). **Zero Anthropic cost** (runs on free Nebius credits)
  and makes Nebius the agent's brain → maximizes the "best use of Nebius" prize.
- **`npm run agent:claude`** — the same loop driven by the **Claude Agent SDK** instead
  (needs `ANTHROPIC_API_KEY`). Most reliable tool-caller; use if you have Anthropic budget.
- **`npm run consumer`** — a deterministic orchestrator over the same tools. No agent-LLM at
  all (only Nebius for qualify/validate). Reliable on-stage fallback.

All three share one tool core (`agents/leadgen-core.ts`) and the **vendored, official
`circle-tools`** (`vendor/`), so wallet creation, the counterfactual-SCA deploy, Gateway
routing, and x402 v1/v2 are handled correctly, not re-guessed. Switching the driver never
changes the wallet, the budget cap, or the blocklist logic.

> **Cost:** the default (Nebius) needs only `NEBIUS_API_KEY` for the LLM work — no paid
> Anthropic key. Default model `NEBIUS_MODEL=deepseek-ai/DeepSeek-V3.2`, which tested as the
> most reliable tool-caller (drove the full paid loop unprompted). Llama-3.3-70B works but is
> lazier (leans on the completion nudge); Qwen3 ignored tools and hallucinated — avoid it.

> ⚠️ **Networks:** the reputation layer runs on **Base Sepolia** (free testnet — default for the
> infra demo). Circle Marketplace **payments** are **Base mainnet** (real USDC, cents per call) —
> keep `BUDGET_USDC` small. Everything runs free under `SIMULATE=1` until you're ready to spend.

## Quickstart
```bash
npm install --legacy-peer-deps    # openai@4 optionally peers zod@3; SDK needs zod@4 (harmless)
# Circle Agent Stack setup:
#   npm i -g @circle-fin/cli       # requires Node 20.18.2+
#   circle wallet login <email> --type agent --init   # email+OTP (npm run agent also does this inline)
#   circle skill install
#   circle wallet create --chain BASE && circle wallet fund ...   # fund a little USDC
cp .env.example .env               # add ANTHROPIC_API_KEY, TAVILY_API_KEY, (NEBIUS_API_KEY)

npm run typecheck                  # should pass clean

# Agentic demo
npm run dashboard                  # terminal A: http://localhost:4000 (budget bar, payments, blocklist)
npm run agent "Series A fintech CTOs in Europe, 8 leads"
```

## Going on-chain for real (ERC-8004 on Base Sepolia — free testnet)
Everything above runs free in simulation. To make the attestations + explorer links real:
```bash
# .env:
#   SIMULATE=0
#   ERC8004_NETWORK=base-sepolia
#   AGENT_WALLET_ADDRESS=0x...        a Circle agent wallet (the buyer/attester)
#   REGISTRAR_WALLET_ADDRESS=0x...    a DIFFERENT Circle wallet (owns the service identities;
#                                     the registry blocks self-feedback, so it must differ)
# Fund both with a little Base Sepolia ETH (free): https://www.alchemy.com/faucets/base-sepolia

npm run register-services    # mints ERC-721 identities via `circle wallet execute` (keyless)
SIMULATE=0 npm run network-demo
```
No private key is ever held by this code: the agent encodes the call, **Circle MPC signs it**
behind the wallet's policy. The model proposes; the signer decides.

## Layout
```
vendor/     circle-tools + kit-core (official Circle kits) · erc8004-abi (real ERC-8004 ABIs)
lib/        reputation (Proof-of-Quality attestations) · erc8004 (keyless encode + read) ·
            circle-execute (keyless MPC signer boundary) · rail (real|sim payment routing) ·
            sim (free mock) · policy (budget+blocklist) · ledger · tavily · nebius · events
agents/     network-demo (THE infra demo: two agents + on-chain reputation) ·
            leadgen-core (shared tool defs) · leadgen-agent-nebius (default driver) ·
            leadgen-agent + leadgen-tools (Claude SDK) · consumer (deterministic) · services.config
scripts/    register-services (mint ERC-721 identities) · spike-payment (go/no-go)
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
