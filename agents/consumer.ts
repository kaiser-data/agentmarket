// Consumer agent — a budget-governed lead-gen agent built on the Circle Agent
// Stack (Claude Agent SDK kit). The Agent Wallet is its payment identity AND its
// operating budget.
//
// Workflow (a repeatable job, not a one-off payment):
//   1. Load/create the Agent Wallet, check balance.
//   2. Discover candidate companies (Tavily).
//   3. Discover paid enrichment services (Circle Agent Marketplace).
//   4. For each candidate: pick a service by price × reputation, run it through
//      the spend policy (budget cap + blocklist + approval), pay via Nanopayment,
//      get a receipt.
//   5. Qualify + validate the result (Nebius). Record to the spend ledger.
//   6. On a bad/fabricated result: rate the service down → BLOCKLIST its payee in
//      the wallet policy → the agent stops paying the scammer (self-defending spend).
//   7. Stop at the lead target or the budget cap. Print receipts + spend ledger.

import "dotenv/config";
import { discoverCandidates } from "../lib/tavily.ts";
import { qualify, validate } from "../lib/nebius.ts";
import { listAgentWallets, createAgentWallet, getBalance, searchServices, payService } from "../lib/circle-cli.ts";
import { SpendPolicy } from "../lib/policy.ts";
import { Ledger } from "../lib/ledger.ts";
import { emit } from "../lib/events.ts";
import { SERVICES } from "./services.config.ts";
import type { ICP, Lead, ServiceListing } from "../lib/types.ts";

const ICP: ICP = { description: process.argv.slice(2).join(" ") || "Series A fintech CTOs in Europe", count: 10 };
const BUDGET_USDC = Number(process.env.BUDGET_USDC ?? 2.0);
const LOCAL = process.env.LOCAL_SERVICES === "1";

async function getWallet() {
  const wallets = await listAgentWallets().catch(() => []);
  const w = wallets[0] ?? (await createAgentWallet());
  const address = (w as any).address;
  const balance = await getBalance(address).catch(() => 0);
  console.log(`👛 Agent Wallet ${address} — balance $${balance} USDC, budget cap $${BUDGET_USDC}`);
  return { address, balance };
}

async function discoverServices(): Promise<ServiceListing[]> {
  // This deterministic path runs the LOCAL catalog (the agent path does real
  // Marketplace discovery). Marketplace `Service[]` lacks payTo/price-per-call,
  // so map by id when present, else fall back to the bundled catalog.
  if (LOCAL) return SERVICES;
  const found = await searchServices("b2b lead enrichment").catch(() => []);
  if (!found.length) return SERVICES;
  return found.map((s, i) => ({
    id: s.name ?? `svc-${i}`,
    label: s.name ?? s.url,
    url: s.url,
    payTo: s.url, // marketplace settles by URL; use it as the policy key
    pricePerCallUsdc: Number((s.price ?? "0").replace(/[^0-9.]/g, "")) || 0.1,
    behavior: "honest" as const,
  }));
}

function pickService(services: ServiceListing[], policy: SpendPolicy): ServiceListing | undefined {
  return services
    .filter((s) => policy.authorize(s.payTo, s.pricePerCallUsdc).ok) // skip blocklisted / over-budget
    .sort((a, b) => a.pricePerCallUsdc / Math.max(0.1, policy.score(a.id)) - b.pricePerCallUsdc / Math.max(0.1, policy.score(b.id)))[0];
}

async function main() {
  console.log(`\n🎯 Goal: ${ICP.count} qualified leads — "${ICP.description}"\n`);
  const wallet = await getWallet();
  const policy = new SpendPolicy(BUDGET_USDC, Number(process.env.APPROVAL_OVER_USDC ?? 1.0));
  const ledger = new Ledger();

  const candidates = await discoverCandidates(ICP);
  await emit({ type: "discover", count: candidates.length, query: ICP.description });
  const services = await discoverServices();

  const collected: Lead[] = [];
  for (const candidate of candidates) {
    if (collected.length >= ICP.count) break;

    const svc = pickService(services, policy);
    if (!svc) { await emit({ type: "log", message: "no eligible service (budget exhausted or all blocklisted)" }); break; }

    const auth = policy.authorize(svc.payTo, svc.pricePerCallUsdc);
    await emit({ type: "consider", service: svc.id, price: svc.pricePerCallUsdc, reputation: policy.score(svc.id) });
    if (auth.needsApproval) await emit({ type: "log", message: `approval required for $${svc.pricePerCallUsdc} to ${svc.id} (auto-approved in demo)` });

    // --- Pay via Circle Nanopayment ---
    let lead: Lead;
    try {
      const reason = `enrich "${candidate.company}" for ICP "${ICP.description}"`;
      const { result, receipt } = await payService(svc.url, wallet.address, { candidate }, {
        service: svc.id, amountUsdc: svc.pricePerCallUsdc, reason,
      });
      policy.recordSpend(svc.pricePerCallUsdc);
      lead = { ...candidate, ...result, serviceId: svc.id, pricePaidUsdc: svc.pricePerCallUsdc, receipt };
      await emit({ type: "payment", from: "agent-wallet", to: svc.id, usdc: svc.pricePerCallUsdc, txHash: receipt.txHash, reason });
      await emit({ type: "budget", spent: policy.policy.spentUsdc, cap: BUDGET_USDC, remaining: policy.remaining() });

      // --- Validate the work bought ---
      lead.score = await qualify(lead, ICP);
      const v = await validate(lead);
      lead.valid = v.valid;
      ledger.record(receipt, v.valid);
      await emit({ type: "lead", service: svc.id, score: lead.score, valid: lead.valid, preview: `${lead.company} — ${lead.title} <${lead.email}>` });

      // --- Reputation → wallet policy (the self-defending spend beat) ---
      const { blocklisted } = policy.rate(svc.id, svc.payTo, v.valid && lead.score >= 0.4);
      if (blocklisted) await emit({ type: "policy", service: svc.id, action: "blocklist", reason: v.reason || "low quality" });

      if (v.valid && lead.score >= 0.5) collected.push(lead);
      else console.log(`  ✗ dropped (${v.reason || "low score"}) — paid $${svc.pricePerCallUsdc} to ${svc.label}`);
    } catch (e) {
      await emit({ type: "log", message: `pay/enrich failed (${svc.id}): ${e}` });
      continue;
    }
  }

  console.log(`\n✅ ${collected.length}/${ICP.count} qualified leads collected.`);
  ledger.print();
  console.log(`📄 ledger saved to ${ledger.save()}`);
  console.table(collected.map((l) => ({ company: l.company, title: l.title, email: l.email, score: l.score, paid: l.pricePaidUsdc, service: l.serviceId })));
}

main().catch((e) => { console.error(e); process.exit(1); });
