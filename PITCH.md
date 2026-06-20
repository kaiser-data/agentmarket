# AgentMarket — Demo-Day Pitch

**Prize target:** Best Agent Wallet Application with Circle Agent Wallet
**Stacks:** Tavily (discovery) · Nebius (agent brain + qualify/validate) · Blockchain-for-Good (grant-finder reframe)

---

## The 30-second hook (say this first)
> "AI agents can think, but they can't *buy*. The moment an agent needs data it has no
> subscription for, it hits a wall — no card, no account, no way to pay per use. AgentMarket
> gives an agent a Circle Agent Wallet as its identity **and** its budget, and sends it to do
> a real job: build a list of qualified sales leads. On its own, it discovers real paid data
> services on the Circle Marketplace, **pays Apollo to find prospects, pays to enrich them,
> and pays Hunter to verify the emails** so it never keeps bad data — all under a hard budget
> cap, returning an itemized on-chain receipt for every cent. Real USDC, real services, no
> human in the billing loop. Let me show you."

---

## Live demo — 8 beats (≈3 min)
Run `npm run dashboard` (projector) + `npm run agent "Series A fintech CTOs in Europe, 8 leads"`.

| # | What you show | What you say | Judging criterion it hits |
|---|---|---|---|
| 1 | Wallet address + budget cap on screen | "This is the agent's Circle Agent Wallet on Base. Its whole operating budget is $X — a hard cap it cannot exceed." | **Wallet integration** |
| 2 | `circle_search_services` results | "On its own it discovers real paid data services on the Circle Marketplace — here's StableEnrich's Apollo + Hunter endpoints." | Agentic usefulness |
| 3 | inspect shows price + schema | "It inspects price and the input schema before spending a cent — $0.02 to search, $0.05 to enrich, $0.03 to verify." | Payment design |
| 4 | **USDC payment line + tx, budget bar moves** | "Real USDC nanopayment, gasless on Base. It just paid Apollo to find CTOs at European fintechs. Every line says what it bought and why." | **Payment design** (the Circle moment) |
| 5 | Leads stream in, Nebius scores them | "Nebius scores each prospect against the brief — free reasoning, paid only for data." | Agentic usefulness (Nebius) |
| 6 | **Pays Hunter to verify an email → row turns green/red** | "It spends $0.03 to *verify* a lead's email before trusting it. Unverifiable ones are dropped — it won't pay to keep bad data." | **Originality** (pays for its own QA) |
| 7 | Budget bar near cap → agent stops | "Watch — it's near the cap, so it stops buying. The wallet policy is a hard ceiling, not a suggestion." | **Policy-based payment behavior** |
| 8 | Final: N verified leads + itemized receipt ledger, total < cap | "7 qualified, email-verified leads. $0.61 total, every payment receipted on-chain, under budget." | **UX + technical execution** |

**The one moment that wins:** beat 6. Most teams demo an agent that *spends*. We demo an agent
that spends to **verify its own work** and refuses to keep data it paid for but can't trust —
real autonomous quality control with money, under a hard budget.

---

## Required-elements checklist (have this slide ready)
- ✅ **Circle Agent Wallet** — payment identity + budget (`vendor/circle-tools`, `lib/policy.ts`)
- ✅ **Wallet action** — create / balance / deploy / **pay** (nanopayment) / gateway deposit
- ✅ **Agent framework starter kit** — built on the **Claude Agent SDK** kit; agent loop also
  runs on **Nebius** (OpenAI-compatible) — same tool core
- ✅ **Circle Marketplace** — `circle services search` + `inspect`
- ✅ **Agent Nanopayments** — gasless USDC via Gateway / x402
- ✅ **Circle CLI + Skills** — session, skill install, all wallet ops
- ✅ **Receipt / spend ledger** — `ledger.json` + on-screen, every payment has a `reason`
- ✅ **A real workflow, not a payment script** — discover → inspect → pay → qualify → validate → blocklist, looped to a goal

---

## Architecture one-liner (for the technical judge)
> "One tool core, three drivers. The agent loop runs on Nebius for cost, the Claude Agent SDK
> for reliability, or fully deterministic as a fallback — but the Circle wallet, the budget cap,
> the receipt ledger, and the blocklist are identical across all three. The Circle integration is
> the official `circle-tools`, so the counterfactual-wallet deploy, Gateway routing, and x402 v1/v2
> are handled correctly, not hand-waved."

---

## Q&A — anticipated questions
- **"Couldn't you just call the APIs directly?"** → "For a fixed provider, yes. The point is the
  *open market*: the agent pays services it discovered at runtime, with no account, and uses
  reputation as the quality filter. That's the part card rails structurally can't do."
- **"Is the payment real?"** → "Yes — real USDC on Base mainnet, here's the tx hash. We keep the
  budget tiny so a demo costs cents."
- **"What stops it draining the wallet?"** → "Three things: a hard budget cap, a per-call
  auto-approve threshold above which a human must say yes, and the blocklist."
- **"What's the rogue, exactly?"** → "A service that underbids then returns a domain-mismatched
  email. Validation flags it; the wallet policy does the rest. The cheating is simple on purpose —
  the value is the *catching*."

---

## Fail-safes for the live demo
- If the model gets wobbly mid-loop → switch to `npm run consumer` (deterministic, same dashboard).
- If the network/marketplace stalls → local x402 services (`npm run services`) give a controllable run.
- Pre-fund the wallet and **rehearse the full run 3×** before going on stage. Half of demos break live; rehearsal is the edge.
- Keep `ledger.json` from a good run open in a tab as a backup artifact.

---

## Social-impact variant (if pitching Blockchain-for-Good too)
> "Same engine, swap the goal: a grant-finding agent for nonprofits that pays per query for
> funding-opportunity data and produces a transparent, receipted spend log. The auditable
> on-chain ledger *is* the social value — every disbursement is verifiable."
