// Deterministic lead-gen agent — the reliable on-stage path. Same Circle Agent
// Wallet, same real StableEnrich pipeline, same budget policy + spend ledger as the
// LLM-driven agent, but the orchestration is hardcoded so it can't wander or
// over-claim. Runs free under SIMULATE=1 (mocked rail) and live with SIMULATE=0.
//
// Flow: wallet → pay Apollo People Search once → per person (qualify with Nebius →
// enrich if no email → pay Hunter to verify → keep only verified) → ledger + leads.

import "dotenv/config";
import * as rail from "../lib/rail.ts";
import { qualify, validate } from "../lib/nebius.ts";
import { SpendPolicy } from "../lib/policy.ts";
import { Ledger } from "../lib/ledger.ts";
import { emit } from "../lib/events.ts";
import { SERVICES } from "./services.config.ts";
import type { Lead } from "../lib/types.ts";

const GOAL = process.argv.slice(2).join(" ") || "Series A fintech CTOs in Europe, 5 leads";
const TARGET = Number((GOAL.match(/(\d+)\s*leads?/i) ?? [])[1] ?? 5);
const BUDGET_USDC = Number(process.env.BUDGET_USDC ?? 2.0);

const SVC = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
const PAYTO = SERVICES[0].payTo; // all StableEnrich services settle to one seller

const policy = new SpendPolicy(BUDGET_USDC, Number(process.env.APPROVAL_OVER_USDC ?? 1.0));
const ledger = new Ledger();

/** Pay a service through the rail, enforce the budget policy, log to the ledger. */
async function pay(svcId: string, data: Record<string, unknown>, reason: string): Promise<any | null> {
  const svc = SVC[svcId];
  const auth = policy.authorize(PAYTO, svc.pricePerCallUsdc);
  await emit({ type: "consider", service: svcId, price: svc.pricePerCallUsdc, reputation: policy.score(svcId) });
  if (!auth.ok) { await emit({ type: "blocked", service: svcId, reason: auth.reason! }); return null; }

  const { response, txHash } = await rail.payService({ url: svc.url, address: WALLET, data, method: "POST" });
  policy.recordSpend(svc.pricePerCallUsdc);
  ledger.record({ service: svcId, amountUsdc: svc.pricePerCallUsdc, txHash, ts: Date.now(), reason }, true);
  await emit({ type: "payment", from: "agent-wallet", to: svcId, usdc: svc.pricePerCallUsdc, txHash, reason });
  await emit({ type: "budget", spent: policy.policy.spentUsdc, cap: BUDGET_USDC, remaining: policy.remaining() });
  try { return JSON.parse(response); } catch { return response; }
}

let WALLET = "";

async function main() {
  console.log(`\n🎯 Goal: ${TARGET} verified leads — "${GOAL}" | budget $${BUDGET_USDC}\n`);

  // 1. Wallet
  const wallets = await rail.listWallets().catch(() => []);
  WALLET = (wallets[0] ?? (await rail.createWallet())).address;
  const bal = await rail.getBalance(WALLET).catch(() => ({ tokens: [] as any[] }));
  const usdc = bal.tokens?.find((t: any) => t.symbol?.toUpperCase() === "USDC")?.amount ?? "?";
  console.log(`👛 Wallet ${WALLET} — USDC ${usdc}\n`);

  // 2. One paid Apollo People Search for the ICP
  const search = await pay("apollo-people-search", {
    person_titles: ["CTO", "VP Engineering", "Chief Technology Officer"],
    person_seniorities: ["c_suite", "vp", "founder"],
    person_locations: ["Europe"],
    q_keywords: GOAL.replace(/,?\s*\d+\s*leads?/i, "").trim(),
    per_page: Math.max(TARGET * 2, 10),
  }, `discover prospects for "${GOAL}"`);
  const people: any[] = search?.people ?? [];
  await emit({ type: "discover", count: people.length, query: GOAL });
  console.log(`🔎 ${people.length} prospects returned\n`);

  // 3. Per-person: qualify → enrich if needed → verify email → keep verified
  const collected: Lead[] = [];
  for (const person of people) {
    if (collected.length >= TARGET || policy.remaining() <= 0) break;
    let lead: any = { ...person, company: person.organization?.name ?? person.company };

    lead.score = await qualify(lead, { description: GOAL, count: 1 });
    if (lead.score < 0.5) { console.log(`  · skip ${lead.name} (score ${lead.score})`); continue; }

    // enrich if no email
    if (!lead.email) {
      const e = await pay("apollo-people-enrich", { name: lead.name, organization_name: lead.company, domain: "" }, `enrich ${lead.name}`);
      if (e?.person?.email) { lead.email = e.person.email; lead.title = e.person.title ?? lead.title; }
    }
    if (!lead.email) { console.log(`  · skip ${lead.name} (no email)`); continue; }

    // pay to verify deliverability
    const v = await pay("hunter-email-verifier", { email: lead.email }, `verify email for ${lead.name}`);
    const deliverable = v?.result ? v.result === "deliverable" : v?.status !== "pending";
    const fmt = await validate(lead);
    lead.valid = deliverable && fmt.valid;

    await emit({ type: "lead", service: "hunter-email-verifier", score: lead.score, valid: lead.valid, preview: `${lead.company} — ${lead.title} <${lead.email}>` });
    if (lead.valid) collected.push(lead as Lead);
    else console.log(`  ✗ drop ${lead.name} — ${deliverable ? fmt.reason : "email not deliverable"}`);
  }

  // 4. Report
  console.log(`\n✅ ${collected.length}/${TARGET} verified leads.`);
  ledger.print();
  console.log(`📄 ledger saved to ${ledger.save()}`);
  console.table(collected.map((l: any) => ({ name: l.name, title: l.title, company: l.company, email: l.email, score: l.score })));
}

main().catch((e) => { console.error(e); process.exit(1); });
