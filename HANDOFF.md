# HANDOFF — AgentMarket / Proof-of-Quality

_Last updated: 2026-06-20 · repo: https://github.com/kaiser-data/agentmarket (private, branch `main`)_

## TL;DR
A trust layer for the agent economy. An AI agent buys data from real paid services, but
**reputation can only be minted from a real, paid, independently cross-verified interaction**,
published to **ERC-8004 on Base** — Sybil-resistant by construction. The AI **never holds a key**;
it proposes, the **Circle Agent Wallet (MPC)** signs behind an on-chain policy.

**Status: working end-to-end, including REAL on-chain reputation on Base Sepolia.**
**Next step (what the owner wants): an astonishing product frontend.** See the last section.

---

## What's real right now ✅
- **Circle Agent Wallet** payments (x402 nanopayments) — code complete; live mainnet run still
  pending wallet funding (USDC). Simulated payments work for free.
- **ERC-8004 on-chain reputation — REAL on Base Sepolia, verified:**
  - 3 service identities minted (ERC-721) via keyless `circle wallet execute`:
    `apollo=7100`, `minerva=7101`, `clado=7102`.
  - 9 real `giveFeedback` attestations written; `getSummary` reads back **apollo 100%, minerva 100%,
    clado 0%** (verified live).
- **Keyless signer** architecture (model proposes → Circle MPC signs behind policy).
- **Two-agent network effect** demo (`agents/network-demo.ts`): Agent A attests, Agent B routes
  around the proven-bad service.
- **Reference consumer** (lead-gen agent): 3 drivers (Nebius default / Claude / deterministic), all
  share `agents/leadgen-core.ts`.
- Everything **typechecks**; runs **free under simulation**.

## Run commands
```bash
npm run network-demo:sim        # THE infra demo, free (no keys/USDC) — best quick look
SIMULATE=1 ONCHAIN_REPUTATION=1 npm run network-demo   # real on-chain attestations (Base Sepolia)
npm run agent "Series A fintech CTOs in Europe, 5 leads"   # reference consumer (Nebius)
npm run consumer "..."          # deterministic fallback (reliable on stage)
npm run dashboard               # current basic SSE dashboard → http://localhost:4000
npm run register-services       # one-time: mint ERC-721 identities on-chain
npm run typecheck
```

## Wallets & on-chain facts
- **Mainnet payment wallet:** `0xe83154a6655614e6921af24d1d2726892bd10c43` (needs ~$3 USDC on Base to
  do a real payment run; on-ramp via `circle wallet fund` hit Transak KYC — easiest is to send USDC
  on Base from any exchange, or ask the Circle booth).
- **Testnet (Base Sepolia) wallets:**
  - REGISTRAR (owns identities): `0x8328849a06a236115019f860c455d7ec69d63693`
  - AGENT / buyer / attester (keyless signer): `0x69de73cf099970bb6a784fbef532ff54513c8515`
- **ERC-8004 (Base Sepolia):** Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e` (ERC-721),
  Reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713`.
- **Proof:** register tx `https://sepolia.basescan.org/tx/0x500e24e18bf16d401b5b4f1bcfee2e83bfa9dab7050ad968c596d645d9ff6983`
  · identity NFT `https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=7100`

## .env keys that matter
```
SIMULATE=1                 # payments mocked (mainnet-only otherwise)
ONCHAIN_REPUTATION=1       # real ERC-8004 writes/reads on Base Sepolia (independent of SIMULATE)
ERC8004_NETWORK=base-sepolia
ERC8004_CHAIN_CLI=BASE-SEPOLIA
REGISTRAR_WALLET_ADDRESS=0x8328849a06a236115019f860c455d7ec69d63693
AGENT_WALLET_ADDRESS=0x69de73cf099970bb6a784fbef532ff54513c8515
NEBIUS_API_KEY=… NEBIUS_MODEL=deepseek-ai/DeepSeek-V3.2   # agent brain (free credits)
TAVILY_API_KEY=…           # discovery
```

## Gotchas discovered (don't relearn these)
- `circle wallet login <email> --type agent` (NOT `circle login`). Testnet is a separate session:
  `circle wallet login <email> --testnet`.
- `circle skill install --tool claude-code` (needs `--tool`).
- `circle wallet create` makes a **mainnet** SCA across all EVM chains; `circle wallet create --testnet`
  makes the testnet one. Agent wallets capped at 5 per environment.
- `circle wallet execute "<sig>" <params...> --contract <addr> --address <wallet> --chain <CHAIN>` —
  pass the **function signature + params**, the CLI ABI-encodes (no raw calldata). It **auto-deploys**
  the counterfactual SCA and **sponsors gas** on testnet (no Sepolia ETH needed — confirmed).
- ERC-8004 `getSummary` **reverts on empty `clientAddresses`** — call `getClients(agentId)` first
  (done in `lib/erc8004.ts`).
- Circle marketplace payments are **Base mainnet** (real USDC, ~$0.02–0.05/call); reputation is
  **Base Sepolia** (free). They're decoupled via `SIMULATE` vs `ONCHAIN_REPUTATION`.
- StableEnrich provider domain contains the substring "enrich" — match on URL **path**, not the
  whole URL (bit us in `lib/sim.ts`).
- Open-model tool-calling: **DeepSeek-V3.2** best; Llama-3.3-70B lazy (needs the nudge); Qwen3
  hallucinated tools — avoid.

## Architecture map (files)
- `lib/rail.ts` — payment routing (real `circle-tools` vs `lib/sim.ts` mock), via `SIMULATE`.
- `lib/reputation.ts` — Proof-of-Quality attestations; on-chain via `ONCHAIN_REPUTATION`.
- `lib/erc8004.ts` — KEYLESS: encodes register/giveFeedback, reads getSummary/getClients.
- `lib/circle-execute.ts` — `circle wallet execute` boundary (Circle MPC signs).
- `lib/policy.ts` `lib/ledger.ts` — budget cap/blocklist + spend ledger.
- `agents/network-demo.ts` — the two-agent network-effect demo.
- `agents/leadgen-core.ts` + `leadgen-agent-nebius.ts` / `leadgen-agent.ts` / `consumer.ts`.
- `dashboard/` — current basic SSE view (to be replaced by the product frontend).
- `docs/architecture.svg` — architecture diagram (in README).
- `PITCH.md` — demo script mapped to judging criteria.

---

# 🎯 NEXT SESSION: build the astonishing product frontend

**Goal:** turn this from "a demo that runs in a terminal" into a product people believe is real.
The product is a **Trust Explorer for the agent economy** — "reputation you can't fake."

### Product concept
A live web app with three views, all reading the **real on-chain data** already written:
1. **Trust Explorer (hero):** services ranked by on-chain reputation. Each card = an ERC-721 agent
   identity, its score, # verified attestations, sparkline, and BaseScan links. Clado visibly at the
   bottom (0%, "proven unreliable"). Make "every score is backed by a real payment + independent
   verification" the emotional hook.
2. **Live Agent Run:** watch an agent work in real time — discover → pay → cross-verify → attest →
   (Agent B) route around the bad service. Animated money flow + a reputation graph that updates as
   attestations land. Wire to the existing SSE event bus (`lib/events.ts` already emits
   payment/lead/policy/budget/blocked events).
3. **Attestation Feed / proof:** a verifiable log — each attestation with payTx + verifyTx + outcome
   + on-chain tx, all clickable to BaseScan. "Don't trust us — verify."

### Suggested build
- **Next.js + TypeScript + Tailwind**, deployed on Vercel. Design system first (see the
  `artifact-design` / `frontend-design` skills) — aim for a distinctive, intentional look, not a
  template. Dark, data-dense, "Bloomberg-terminal-meets-Linear" energy fits the trust/finance theme.
- **Data sources (all exist):** on-chain reads via `lib/erc8004.ts` `getSummary`/`getClients`
  (public RPC, no key); the SSE stream from `dashboard/server.ts` for live runs; `ledger.json` /
  `erc8004-agents.json` for receipts + identity links.
- **Backend:** a thin API route that proxies `getSummary` per service + serves the SSE feed. Keep the
  agent runs server-side (they hold the Circle session); the frontend just renders.
- **Don't break the keyless principle:** the frontend reads on-chain + listens to events. It never
  holds keys or triggers spends without the existing approval boundary.

### First moves for the frontend session
1. Read `HANDOFF.md` (this file), `README.md`, `docs/architecture.svg`, `PITCH.md`.
2. Use a design skill to set a token system + visual direction before coding.
3. Scaffold Next.js; build the **Trust Explorer** view first (reads real agentIds 7100/7101/7102 →
   instant real data on screen). That single view is the "wow" — ship it, then add Live Run + Feed.
4. Keep the terminal demos working; the frontend is an additive product layer.
