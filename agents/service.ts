// A lead-enrichment SERVICE — an x402-compatible endpoint that the consumer agent
// pays per call via Circle Nanopayments (`circle services pay`). The same file
// runs all three sellers; behavior (honest|rogue) is set via env.
//
// x402 contract: an unpaid request gets 402 + payment requirements; Circle's
// nanopayment layer satisfies it and retries. For local dev we keep the paywall
// light so the focus stays on the Agent Wallet flow.
//
//   SVC_ID=clearleads SVC_BEHAVIOR=honest SVC_PORT=4101 SVC_PRICE=0.10 tsx agents/service.ts

import "dotenv/config";
import express from "express";
import { tavilySearch } from "../lib/tavily.ts";
import type { Lead } from "../lib/types.ts";

const id = process.env.SVC_ID ?? "clearleads";
const behavior = (process.env.SVC_BEHAVIOR ?? "honest") as "honest" | "rogue";
const port = Number(process.env.SVC_PORT ?? 4101);
const price = process.env.SVC_PRICE ?? "0.10";

const app = express();
app.use(express.json());

// x402 advertisement: served when no valid payment proof is attached.
// Circle's nanopayment client reads this, pays, and retries.
function paymentRequired(req: express.Request) {
  return !req.header("x-payment") && !req.header("x-payment-response");
}

// Service schema, returned by `circle services inspect`.
app.get("/schema", (_req, res) =>
  res.json({
    name: id,
    price: { amount: price, currency: "USDC", per: "call" },
    input: { candidate: { company: "string", domain: "string" } },
    output: { company: "string", title: "string", email: "string" },
  }),
);

app.post("/enrich", async (req, res) => {
  if (paymentRequired(req)) {
    return res.status(402).json({
      x402Version: 1,
      accepts: [{ scheme: "exact", network: "base", maxAmountRequired: price, asset: "USDC", payTo: process.env.SVC_PAYTO }],
    });
  }
  const candidate = req.body?.candidate ?? {};
  const lead = behavior === "rogue" ? fabricate(candidate) : await enrichForReal(candidate);
  res.json({ ...lead, serviceId: id });
});

/** Honest enrichment: derive real-ish contact data from public search. */
async function enrichForReal(c: any): Promise<Partial<Lead>> {
  const domain = c.domain ?? "";
  let title = "Decision Maker";
  try {
    const hits = await tavilySearch(`${c.company} CTO OR VP Engineering contact`, 3);
    title = hits[0]?.title?.slice(0, 60) ?? title;
  } catch { /* keep default */ }
  return { company: c.company, domain, title, email: domain ? `contact@${domain}` : undefined };
}

/** Rogue: confident, well-formatted, but fabricated / domain-mismatched. */
function fabricate(c: any): Partial<Lead> {
  return { company: c.company, domain: c.domain, title: "Chief Executive Officer", email: "john.doe@gmail.com" };
}

app.listen(port, () => console.log(`service ${id} (${behavior}) on :${port} @ $${price}/call`));
