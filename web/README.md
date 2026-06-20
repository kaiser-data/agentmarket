# Proof Terminal — frontend

The product layer for AgentMarket: a **Trust Explorer for the agent economy**.
"Reputation you can't fake." Next.js 16 (App Router) + Tailwind v4.

## Run

```bash
cd web
npm run dev        # http://localhost:3000
```

The terminal demos at the repo root keep working unchanged — this is additive.

## Views

- **`/` Trust Explorer** — services ranked by on-chain ERC-8004 reputation. Each row is
  an ERC-721 identity (7100/7101/7102) with its score, verdict, and the **Provenance Bar**:
  one segment per real attestation, hover to inspect pay/verify/feedback tx, click → BaseScan.
- **`/feed` Attestation Feed** — the verifiable log; every attestation with all three tx links.
- **`/live` Live Run** — subscribes to the existing SSE bus (`dashboard/server.ts`).
  Start a run to populate it:
  ```bash
  # from the repo root
  npm run dashboard
  SIMULATE=1 ONCHAIN_REPUTATION=1 npm run network-demo
  ```

## Data

`/` and `/feed` read the **real receipts** the agent writes at the repo root —
`../erc8004-agents.json` (identities) and `../reputation-store.json` (attestations) — via
`lib/data.ts`. No keys, no spends: the frontend only renders evidence and listens to events.

> Deploy note: for Vercel, swap the file reads in `lib/data.ts` for an API route that calls
> `getSummary`/`getClients` over a public RPC (see root `lib/erc8004.ts`) — same shapes.

## Design system

Tokens live in `app/globals.css` (`@theme`). "The Proof Terminal": graphite ink, a mint-gold
signature (reputation is *minted*), and an honest green/red pass-fail axis that comes straight
from the data. Type: Archivo (wide display) · IBM Plex Sans (UI) · IBM Plex Mono (all data).
