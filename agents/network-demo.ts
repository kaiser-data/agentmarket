// THE INFRASTRUCTURE DEMO — Proof-of-Quality reputation network effect.
//
// Two independent agents, one shared ERC-8004 reputation registry:
//   Agent A pays three competing enrichment services, independently cross-verifies
//     each result (Hunter), and publishes payment-anchored attestations on-chain.
//     One service (Clado) proves low-quality and earns a bad on-chain reputation.
//   Agent B — a separate run — queries reputation BEFORE paying, and its wallet
//     refuses to even attempt the proven-bad service. It never touches the scam.
//
// The point: Agent A spent real USDC to learn a service is bad. Because that lesson
// is on-chain and verification-backed, Agent B (and every future agent) avoids it
// for free. One agent's cost becomes a public good.
//
//   SIMULATE=1 npm run network-demo        # free rehearsal (file-backed registry)

import "dotenv/config";
import * as rail from "../lib/rail.ts";
import { validate } from "../lib/nebius.ts";
import { Ledger } from "../lib/ledger.ts";
import { SpendPolicy } from "../lib/policy.ts";
import { emit } from "../lib/events.ts";
import { attest, getReputation, reputationGate, reset, ERC8004 } from "../lib/reputation.ts";
import { SERVICES } from "./services.config.ts";

const SVC = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
const PAYTO = SERVICES[0].payTo;
const ENRICHERS = ["apollo-people-enrich", "minerva-enrich", "clado-contacts-enrich"];
const HUNTER = "hunter-email-verifier";

// People to enrich (no emails yet — the enrichers compete to supply them).
const PEOPLE = [
  { name: "Lena Fischer", company: "Klarwise" },
  { name: "Sofia Rossi", company: "Lunafin" },
  { name: "Jonas Berg", company: "Nordbit Payments" },
];

let WALLET = "";

/** Pay a service via the rail under a budget policy + ledger. Returns parsed data + the pay tx. */
async function pay(policy: SpendPolicy, ledger: Ledger, svcId: string, data: Record<string, unknown>, reason: string) {
  const svc = SVC[svcId];
  const { response, txHash } = await rail.payService({ url: svc.url, address: WALLET, data, method: "POST" });
  policy.recordSpend(svc.pricePerCallUsdc);
  ledger.record({ service: svcId, amountUsdc: svc.pricePerCallUsdc, txHash, ts: Date.now(), reason }, true);
  await emit({ type: "payment", from: "agent-wallet", to: svcId, usdc: svc.pricePerCallUsdc, txHash, reason });
  let body: any = response; try { body = JSON.parse(response); } catch { /* text */ }
  return { body, txHash };
}

function bar(label: string) { console.log(`\n${"─".repeat(64)}\n  ${label}\n${"─".repeat(64)}`); }

async function main() {
  reset(); // fresh shared registry for the demo
  const wallets = await rail.listWallets().catch(() => []);
  WALLET = (wallets[0] ?? (await rail.createWallet())).address;

  // ============ AGENT A — earns the reputation ============
  bar("AGENT A · pays 3 competing enrichers, cross-verifies, attests on-chain");
  const aPolicy = new SpendPolicy(5, 1); const aLedger = new Ledger();
  for (const svcId of ENRICHERS) {
    for (const person of PEOPLE) {
      const { body: e, txHash: payTx } = await pay(aPolicy, aLedger, svcId, { name: person.name, organization_name: person.company, domain: "" }, `enrich ${person.name} via ${svcId}`);
      const email = e?.person?.email ?? e?.email;
      const { body: v, txHash: verifyTx } = await pay(aPolicy, aLedger, HUNTER, { email }, `verify ${person.name}'s email`);
      const pass = (v?.result ?? "") === "deliverable";
      const a = await attest({ serviceId: svcId, payTx, verifyTx, outcome: pass ? "pass" : "fail", scorePct: pass ? 100 : 0, attester: WALLET });
      await emit({ type: "log", message: `attest ${svcId} → ${pass ? "PASS" : "FAIL"} ${a.explorer}` });
      console.log(`  ${pass ? "✓" : "✗"} ${svcId.padEnd(22)} ${String(email).padEnd(34)} → attested ${a.onchainTx?.slice(0, 14)}…`);
    }
  }

  bar("ON-CHAIN REPUTATION (ERC-8004 ReputationRegistry, Base Sepolia)");
  for (const svcId of ENRICHERS) {
    const r = await getReputation(svcId);
    console.log(`  ${svcId.padEnd(24)} score ${(r.score * 100).toFixed(0)}%  (${r.count} attestations, ${r.fails} fails)`);
  }
  console.log(`  registry: ${ERC8004.reputation}`);
  console.log(`\n  Agent A spent $${aLedger.total.toFixed(3)} USDC to establish these quality signals.`);

  // ============ AGENT B — benefits from it, pays nothing to learn ============
  bar("AGENT B · independent run · queries reputation BEFORE paying");
  const bPolicy = new SpendPolicy(5, 1); const bLedger = new Ledger();
  let avoidedSpend = 0;
  for (const person of PEOPLE.slice(0, 2)) {
    // choose the best-reputation enricher; refuse proven-bad ones outright
    const ranked: { id: string; score: number }[] = [];
    for (const id of ENRICHERS) {
      const gate = await reputationGate(id, 0.5);
      if (!gate.ok) {
        avoidedSpend += SVC[id].pricePerCallUsdc + SVC[HUNTER].pricePerCallUsdc;
        await emit({ type: "blocked", service: id, reason: gate.reason! });
        console.log(`  🚫 ${person.name}: skip ${id} — ${gate.reason}`);
        continue;
      }
      ranked.push({ id, score: gate.rep.score });
    }
    const best = ranked.sort((a, b) => b.score - a.score)[0];
    if (!best) { console.log(`  ⚠️  ${person.name}: every enricher is below the reputation threshold — skipping`); continue; }
    console.log(`  → ${person.name}: routing to ${best.id} (best on-chain reputation ${(best.score * 100).toFixed(0)}%)`);
    const { body: e } = await pay(bPolicy, bLedger, best.id, { name: person.name, organization_name: person.company, domain: "" }, `enrich ${person.name} via ${best.id} (reputation-routed)`);
    const email = e?.person?.email ?? e?.email;
    const { body: v } = await pay(bPolicy, bLedger, HUNTER, { email }, `verify ${person.name}'s email`);
    const ok = (v?.result ?? "") === "deliverable" && (await validate({ email } as any)).valid;
    console.log(`  ${ok ? "✓" : "✗"} ${person.name.padEnd(16)} via ${best.id} → ${email}`);
  }

  // ============ THE PAYOFF ============
  bar("THE NETWORK EFFECT");
  console.log(`  Agent A paid $${aLedger.total.toFixed(3)} — including the wasted spend that proved Clado is bad.`);
  console.log(`  Agent B paid $${bLedger.total.toFixed(3)}, skipped the proven-bad service, and avoided ~$${avoidedSpend.toFixed(3)} of wasted spend + every bad lead.`);
  console.log(`  Agent B paid $0 to LEARN any of this — it read A's verification-backed attestations on-chain.`);
  console.log(`\n  → One agent's paid lesson became a public good. That is the infrastructure.\n`);
  aLedger.save("ledger-agentA.json");
  bLedger.save("ledger-agentB.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
