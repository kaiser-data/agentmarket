# AgentMarket — Budget-Governed Lead-Gen Agent (Circle Agent Stack)

**One-liner:** An AI agent whose Circle Agent Wallet is its payment identity *and* budget.
It discovers paid lead-enrichment services on the Circle Agent Marketplace, pays per-record
via Nanopayments, returns a receipt/spend ledger — and when a service sells fabricated data,
it blocklists that payee in the wallet policy so the wallet won't pay the scammer again.

**Targets the "Best Agent Wallet Application with Circle Agent Wallet" prize** and stacks
Tavily (discovery) + Nebius (qualify/validate) + Blockchain-for-Good (grant-finder reframe).

---

## Why this wins on the stated judging criteria
| Criterion | How |
|---|---|
| Agentic usefulness | Real, repeatable job: turn a goal into qualified leads + an itemized receipt ledger |
| Wallet integration | Wallet is identity + budget; every cycle checks balance, authorizes, pays, records |
| Payment design | Each Nanopayment carries a `reason`; spend ledger shows what/why; budget cap enforced |
| Technical execution | End-to-end via the Claude Agent SDK starter kit + Circle CLI |
| UX | Live dashboard (budget bar, payments-with-reason, blocklist) + `ledger.json` |
| **Originality** | **Self-defending wallet**: validation failure → wallet-policy blocklist, live on stage |

---

## Verified stack (June 2026)
- **Starter kit:** Claude Agent SDK kit from `akelani-circle/agent-stack-ecosystem-kits`
  (siblings: OpenAI Agents, LangChain, Mastra, Vercel AI, Google ADK).
- **circle-tools commands** (we wrap these in `lib/circle-cli.ts`):
  `wallet create|list|balance`, `services search|inspect|pay` — all `--output json`.
- **Chain:** BASE. **Nanopayments:** gasless, x402 over Circle Gateway, batched settlement.
- **Skills/CLI:** `circle login`, `circle skill install`, global Circle CLI.

---

## Task 0 — Setup & go/no-go (FIRST, ~60 min)
- [ ] Install Circle CLI globally; `circle login`; `circle skill install`. **TODO(verify) package name.**
- [ ] Keys: `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, optional `NEBIUS_API_KEY` ($100 credits).
- [ ] `circle wallet create --type agent --chain BASE`; **fund its Gateway USDC balance**.
- [ ] **CP0 MONEY SPIKE (GO/NO-GO):** `npm run services` then `npm run spike` →
      wallet pays a local x402 service via `circle services pay`, prints a receipt/tx.
      **If a receipt prints, the project is viable. If not, escalate now.**
- [ ] While spiking, fix the `TODO(verify)` markers: exact CLI flags + JSON field names
      (balance, receipt txHash/paymentId) + the wallet-policy/blocklist command.

---

## Checkpoints (each is a shippable demo)
### CP1 — Wallet does one real paid job (~3h)
Consumer: goal → Tavily discovers candidates → pay **1 service** via Nanopayment → real lead →
Nebius qualifies → **spend ledger with a receipt**. *Valid demo on its own.*

### CP2 — Marketplace discovery + budget (~3h)
`circle services search` (or local catalog) returns ≥2 services. Pick by price × reputation.
Enforce the **budget cap** + approval threshold. Budget bar on the dashboard.

### CP3 — THE WINNING BEAT: rogue → wallet-policy blocklist (~2h)
Rogue service underbids, returns fabricated data → Nebius validation flags it → rate down →
**blocklist its payee in the wallet policy** → spend reroutes to honest services. *Prioritize this.*

### CP4 — Dashboard + pitch (~2h)
Polish the live view (payments-with-reason, budget, blocklist turning a service red). Export
`ledger.json`. **Rehearse the pitch 3×.** Keep the grant-finder social-impact line ready.

---

## Demo choreography
1. Show the Agent Wallet + budget cap (identity + budget).
2. Goal in → Tavily candidates → Marketplace services with prices (discovery + pricing).
3. **Real USDC Nanopayments flow, each line says *why* it paid** (payment design).
4. Rogue underbids, wins, defects → caught → **blocklisted in wallet policy live** → reroute (originality).
5. Final: N qualified leads + itemized receipt ledger, total spend under cap (usefulness + UX).

---

## Files
```
lib/   circle-cli · policy · ledger · tavily · nebius · events · types
agents/ consumer · service · services.config · run-services
scripts/ spike-payment
dashboard/ server · index.html
```

## Fallback ladder (never drop the two non-negotiables)
**Non-negotiable:** (1) one real Agent-Wallet Nanopayment with a returned receipt, (2) the
rogue-catch → wallet-policy blocklist. Drop in order: dashboard → terminal ledger · real
Marketplace listing → local x402 services paid via `circle services pay` · Nebius validate →
deterministic format/domain check (already in `lib/nebius.ts`) · 3 services → 2.

## Honest framing
Local services stand in for Marketplace listings we may not get registered in 48h — but they're
paid through the **real** Circle Agent Wallet + Nanopayment, so the receipts and wallet policy
are genuine. The reusable part is the budget+policy+ledger layer any agent can adopt.
```
