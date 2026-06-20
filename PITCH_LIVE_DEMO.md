# THEMIS — Live Demo Pitch Script (~3.5 min)

**Live:** https://themis-agent-trust.netlify.app
**One line:** _Trust layer for agent commerce — who your agent should pay, and who to avoid._

> Stage directions in `[brackets]`. Spoken lines in plain text.
> Total ~3.5 min. Optional trims marked **(cut for 2-min)**.

---

## 0 · Cold open — the hook (~20s)
[Stand on the **Trust Explorer** home page, already loaded. Don't talk over the load.]

"In a few years, billions of AI agents will be spending real money on each other's
APIs — autonomously. Here's the problem nobody's solved: **how does an agent know
which service to trust before it pays?**

Star ratings? An agent can fake a thousand of those for free. So we built the thing
that can't be faked."

---

## 1 · The thesis (~25s)
[Point at the hero line and the gold "Reviews are claims" strip.]

"Reviews are claims. THEMIS requires three things before a reputation moves:
a **real payment**, an **independent verification**, and an **on-chain attestation**
on ERC-8004. No payment, no verification — no score.

And the key insight: we never say _payment proves quality_ — that's attackable.
We score two things separately."

[Point at the two columns: **Quality** and **Wash Risk**.]

"**Quality** — did the output pass independent verification.
**Wash Risk** — could this reputation have been _manufactured_."

---

## 2 · Read the board (~30s)
[Gesture down the ranked list — this is all real on-chain data.]

"Everything here is read live from Base. Nine real attestations, three ERC-721 agent
identities. **Apollo and Minerva** — 100% quality, low wash risk, **Trusted**.
At the bottom, **Clado** — zero percent. Three paid calls, three failed verifications.
**Proven unreliable**, on-chain."

[Hover the green/red **provenance bar** on Apollo.]

"Each segment is one real attestation — pay transaction, verify transaction,
on-chain feedback. Every score disassembles into its evidence. **(cut for 2-min)**"

---

## 3 · Catch a fake — the wow (~45s)
[Click **Helix Signals** → service detail page. Let the page land.]

"Now watch the part judges should care about. Helix Signals shows **100% quality**.
A naïve reputation system says: trust it.

THEMIS says **Suspicious** — wash risk **88**."

[Point at the red flags under "Why this verdict".]

"Because it looked underneath. The buyer that's paying for these calls is funded by the
**seller's own treasury** — a circular payment loop. And the verifier? It **only ever
validates this one seller.** That's not reputation. That's a service paying to launder
its own credibility — and we flag it automatically.

[Point at the gold 'Simulated scenario' banner.]
This one's a simulated scenario so you can see the detector fire — clearly labeled.
The on-chain receipts on the other services are real."

---

## 4 · From analytics to enforcement (~40s)
[Click **Policy Engine** in the nav.]

"But analytics isn't the product. **Enforcement** is. This is the wallet policy engine.

I set the rules my agent should live by —"
[Drag a slider, e.g. min quality 80, max wash risk 40.]
"— and THEMIS decides, per service, before a cent moves: **Pay, Trial, or Refuse**,
and tells me why."

[Point at the rows: Apollo/Minerva PAY, Nimbus TRIAL, Helix & Clado REFUSE.]

"Apollo clears every rule — pay it. Clado's quality is too low — refuse. Helix?
Refused: wash risk 88 exceeds my ceiling.

And it's not just a dashboard —"
[Point at the **Enforceable policy** JSON block; click _copy JSON_.]
"— it exports the exact config an agent wallet can enforce. This is infrastructure,
not a chart."

---

## 5 · See it happen live (~40s)
[Click **Live Run** → hit **▶ Replay the two-agent demo**.]

"Here's an agent actually doing it. It discovers leads, checks reputation, pays Apollo
and Minerva in USDC through a Circle Agent Wallet — keyless; the model proposes,
Circle signs behind a policy.

Then it reaches Clado —"
[Let the red **"Payment blocked before spend"** card appear.]

"— and **refuses to pay, before any money moves**, because Clado failed verification
on-chain. That's the whole pitch in one moment: the agent didn't get burned and learn.
It avoided the bad actor in advance. Money saved, bad data avoided."

---

## 6 · Close + the ask (~25s)
[Back to the home page, or the About page bounty list.]

"Everything you saw is live on Base Sepolia — every score links to BaseScan; don't
trust us, verify it.

THEMIS is the trust layer the agent economy needs to be safe at scale:
**Circle** for payments, **ERC-8004** for identity and reputation, **Nebius** for the
agent brain, **Tavily** for discovery.

A trillion-dollar agent economy can't run on reputation you can fake. So we made
reputation you can't. Thanks."

---

## Quick reference — demo path
1. **Trust Explorer** (`/`) — hook + two-score thesis + real board
2. **Helix Signals** (`/service/helix-signals`) — wash-trading detection
3. **Policy Engine** (`/policy`) — pay/trial/refuse + export JSON
4. **Live Run** (`/live`) → **Replay** — refusal before spend
5. **About** (`/about`) — bounties + on-chain proof

## If something breaks
- **Live Run shows "Idle":** that's fine — hit **Replay**; it's self-contained, no backend needed.
- **Net is down:** the same views run locally — `cd web && npm run dev`.
- **Judge asks "is the data real?":** Yes — 9 attestations, 3 ERC-721 identities on Base
  Sepolia, all linking to BaseScan. The two _simulated_ services are badged; they only
  exist to show the Suspicious/Unproven categories. Actor funding-root clustering is
  modeled for the demo (stated on each service page); production reads it from tx senders
  via RPC — the scoring math is identical.

## Numbers to know cold
- **9** real attestations · **3** on-chain identities (#7100 Apollo, #7101 Minerva, #7102 Clado)
- Apollo / Minerva **100%** · Clado **0%** · Helix (sim) wash risk **88**
- Payments: **$0.02–0.05 USDC** per verified call · ReputationRegistry `0x8004B6…8713`
