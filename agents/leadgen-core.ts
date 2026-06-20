// Single source of truth for the lead-gen agent's tools.
//
// Each tool is a neutral { name, description, shape (zod), spend?, handler }.
// Two adapters consume this list:
//   - leadgen-tools.ts        → Claude Agent SDK in-process MCP server
//   - leadgen-agent-nebius.ts → OpenAI-compatible function-calling loop on Nebius
//
// Handlers return plain objects (or throw). Shared run state (budget policy +
// spend ledger) lives here so both adapters enforce the same wallet policy,
// including the rogue-catch blocklist.

import { z } from "zod";
import * as circle from "@agent-stack-ecosystem-kits/circle-tools";
import { selectPayChain, ensureDeployed, selectGatewayChain, selectDepositMethod } from "@agent-stack-ecosystem-kits/kit-core/tools";
import { discoverCandidates } from "../lib/tavily.ts";
import { qualify, validate } from "../lib/nebius.ts";
import { SpendPolicy } from "../lib/policy.ts";
import { Ledger } from "../lib/ledger.ts";
import { emit } from "../lib/events.ts";

export const policy = new SpendPolicy(Number(process.env.BUDGET_USDC ?? 2.0), Number(process.env.APPROVAL_OVER_USDC ?? 1.0));
export const ledger = new Ledger();

export interface ToolDef {
  name: string;
  description: string;
  shape: z.ZodRawShape;
  /** True for tools that move USDC (gated by human approval in both adapters). */
  spend?: boolean;
  handler: (args: any) => Promise<unknown>;
}

const log = (l: string) => console.log(`  [tool] ${l}`);
const chainEnum = z.enum(["BASE", "POLYGON"]);

export const TOOLS: ToolDef[] = [
  // ---------- Circle Agent Wallet + Marketplace ----------
  { name: "circle_list_wallets", description: "List existing Circle agent wallets on Base. Returns [{address}].", shape: {},
    handler: () => circle.listWallets() },

  { name: "circle_create_wallet", description: "Create a new Circle agent wallet on Base. Returns {address}.", shape: {},
    handler: () => circle.createWallet() },

  { name: "circle_get_balance", description: "Check USDC + token balances for a wallet. Defaults to Base.",
    shape: { address: z.string(), chain: chainEnum.optional() },
    handler: ({ address, chain }) => circle.getBalance({ address, chain }) },

  { name: "circle_deploy_wallet",
    description: "Deploy an agent wallet's smart account via a one-time zero-value self-transfer. A fresh wallet is counterfactual and cannot sign x402 payments until deployed. Idempotent, gas-abstracted. Call before the first circle_pay_service.",
    shape: { address: z.string(), chain: chainEnum.optional() },
    handler: ({ address, chain }) => circle.deployWallet({ address, chain }) },

  { name: "circle_search_services", description: "Discover x402 lead-enrichment services on the Circle Agent Marketplace by keyword.",
    shape: { keyword: z.string() },
    handler: ({ keyword }) => circle.searchServices({ keyword }) },

  { name: "circle_inspect_service", description: "Inspect an x402 service: pricing, input schema, HTTP method, health. Always call before paying.",
    shape: { url: z.string() },
    handler: ({ url }) => circle.inspectService({ url }) },

  // ---------- The guarded nanopayment (policy enforced here) ----------
  { name: "circle_pay_service", spend: true,
    description: "Pay an x402 service with a Circle USDC nanopayment, then return its data + a receipt. ENFORCES the wallet policy: refuses payees that are blocklisted (sold bad data earlier) or that would exceed the budget cap. Pass payTo, serviceId, amountUsdc, a clear reason, and the inspected method.",
    shape: {
      url: z.string(), address: z.string(),
      payTo: z.string().describe("The service's receiving address, for policy/blocklist tracking."),
      serviceId: z.string().describe("Stable id/name of the service, for reputation tracking."),
      amountUsdc: z.number().describe("Expected price in USDC (from inspect)."),
      reason: z.string().describe("Why the agent is buying this record."),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
      dataJson: z.string().describe('JSON payload matching the service schema, e.g. {"candidate":{...}}.'),
    },
    handler: async ({ url, address, payTo, serviceId, amountUsdc, reason, method, dataJson }) => {
      await emit({ type: "consider", service: serviceId, price: amountUsdc, reputation: policy.score(serviceId) });
      const auth = policy.authorize(payTo, amountUsdc);
      if (!auth.ok) { await emit({ type: "blocked", service: serviceId, reason: auth.reason! }); throw new Error(`policy blocked payment: ${auth.reason}`); }

      let data: Record<string, unknown>;
      try { data = JSON.parse(dataJson); } catch (e) { throw new Error(`invalid dataJson: ${(e as Error).message}`); }

      const httpMethod = (method ?? "POST").toUpperCase();
      const picked = await selectPayChain(url, httpMethod, log);
      if (!picked.ok) throw new Error(picked.message);
      const dep = await ensureDeployed(address, picked.chain, log);
      if (!dep.ok) throw new Error(dep.message);

      const r = await circle.payService({ url, address, data, method: httpMethod, chain: picked.chain });
      policy.recordSpend(amountUsdc);
      const receipt = { service: serviceId, amountUsdc, txHash: r.txHash, ts: Date.now(), reason };
      await emit({ type: "payment", from: "agent-wallet", to: serviceId, usdc: amountUsdc, txHash: r.txHash, reason });
      await emit({ type: "budget", spent: policy.policy.spentUsdc, cap: policy.policy.budgetUsdc, remaining: policy.remaining() });
      let body: any = r.response; try { body = JSON.parse(r.response); } catch { /* keep text */ }
      return { receipt, data: body };
    } },

  { name: "circle_gateway_deposit", spend: true,
    description: "Fund the wallet's Circle Gateway balance so it can pay a seller that requires Gateway (batched) x402. Pass the service URL; the kit confirms the requirement and picks the chain. Spends USDC.",
    shape: { url: z.string(), address: z.string(), amount: z.number().positive(), method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional() },
    handler: async ({ url, address, amount, method }) => {
      const picked = await selectGatewayChain(url, (method ?? "POST").toUpperCase(), log);
      if (!picked.ok) throw new Error(picked.message);
      return circle.gatewayDeposit({ address, amount, chain: picked.chain, method: selectDepositMethod(picked.chain) });
    } },

  // ---------- Domain tools ----------
  { name: "tavily_discover", description: "Discover candidate companies/people matching an ICP description, via Tavily web search. Returns [{company,domain,source}].",
    shape: { description: z.string(), count: z.number().optional() },
    handler: async ({ description, count }) => {
      const candidates = await discoverCandidates({ description, count: count ?? 10 });
      await emit({ type: "discover", count: candidates.length, query: description });
      return candidates;
    } },

  { name: "nebius_qualify", description: "Score an enriched lead 0..1 against the ICP. Returns {score}.",
    shape: { leadJson: z.string(), icp: z.string() },
    handler: async ({ leadJson, icp }) => ({ score: await qualify(JSON.parse(leadJson), { description: icp, count: 1 }) }) },

  { name: "validate_lead",
    description: "Validate an enriched lead for fabricated/implausible data. If invalid, rates the selling service DOWN and may BLOCKLIST its payee in the wallet policy (self-defending spend). Returns {valid,reason,blocklisted}.",
    shape: { leadJson: z.string(), serviceId: z.string(), payTo: z.string() },
    handler: async ({ leadJson, serviceId, payTo }) => {
      const lead = JSON.parse(leadJson);
      const v = await validate(lead);
      const good = v.valid && (lead.score ?? 1) >= 0.4;
      const { blocklisted } = policy.rate(serviceId, payTo, good);
      await emit({ type: "lead", service: serviceId, score: lead.score ?? 0, valid: v.valid, preview: `${lead.company} — ${lead.title} <${lead.email}>` });
      if (blocklisted) await emit({ type: "policy", service: serviceId, action: "blocklist", reason: v.reason || "low quality" });
      return { ...v, blocklisted };
    } },

  { name: "ledger_record", description: "Record a completed purchase to the spend ledger (receipt + whether the data was good). Call after validate_lead.",
    shape: { serviceId: z.string(), amountUsdc: z.number(), reason: z.string(), txHash: z.string().optional(), ok: z.boolean() },
    handler: async ({ serviceId, amountUsdc, reason, txHash, ok: good }) => {
      ledger.record({ service: serviceId, amountUsdc, txHash, ts: Date.now(), reason }, good);
      return { recorded: true, total: ledger.total };
    } },

  { name: "budget_status", description: "Report remaining budget, total spent, and the current payee blocklist.", shape: {},
    handler: async () => ({ cap: policy.policy.budgetUsdc, spent: policy.policy.spentUsdc, remaining: policy.remaining(), blocklist: policy.policy.blocklist }) },
];

/** Tool names that move USDC — gated by approval in both adapters. */
export const SPEND_TOOL_NAMES = TOOLS.filter((t) => t.spend).map((t) => t.name);

/**
 * The mission prompt, shared by both agent drivers (Nebius + Claude).
 * It hardcodes the verified StableEnrich endpoints + exact request schemas so the
 * agent sends correct POST bodies — x402 charges before the request resolves, so a
 * malformed body would still spend USDC. The agent also runs circle_search_services
 * live to show discovery, but these known-good specs keep every paid call valid.
 */
export function buildMission(goal: string): string {
  const cap = policy.policy.budgetUsdc;
  const approve = policy.policy.requireApprovalOverUsdc ?? 1.0;
  return `You are an autonomous B2B lead-generation agent operating a Circle Agent Wallet on Base.
Your wallet is your identity AND your budget. Hard spend cap: $${cap} USDC. Payments under $${approve} auto-approve; larger ones need human approval. Be frugal — every paid call spends real USDC, and x402 charges BEFORE the response, so never send a malformed body.

GOAL: ${goal}

You buy data from real x402 services on the Circle Agent Marketplace (provider: StableEnrich, all POST, ~$0.02–0.05 each, settle to 0x325bdF6F7efAB24a2210c48c1b64cAb2eAe1d430 on Base). Known endpoints and EXACT request bodies:

1. Apollo People Search — https://stableenrich.dev/api/apollo/people-search ($0.02)
   body: {"person_titles":["CTO","VP Engineering"],"person_seniorities":["c_suite","vp"],"person_locations":["Europe"],"q_keywords":"fintech","per_page":10}
   returns: people[] with {name,email,title,organization:{name}}
2. Apollo People Enrich — https://stableenrich.dev/api/apollo/people-enrich ($0.0495)  [use only when a person has no email]
   body: {"name":"<full name>","organization_name":"<company>","domain":"<company domain>"}
   returns: person {name,email,title,organization:{name}}
3. Hunter Email Verifier — https://stableenrich.dev/api/hunter/email-verifier ($0.03)  [verify a promising lead's email]
   body: {"email":"<email>"}
   returns: {status} ("completed" or "pending"); treat "pending" as UNVERIFIED (accept, note it), do not block on it.

Workflow — call tools yourself, one step at a time:
1. circle_list_wallets (create with circle_create_wallet if none); circle_get_balance and circle_get_gateway_balance for the wallet address.
2. circle_search_services "lead enrichment" — confirm the StableEnrich services are discoverable (discovery on the record).
3. circle_pay_service the Apollo People Search once for the ICP (method POST; payTo 0x325b...d430; serviceId "apollo-people-search"; amountUsdc 0.02; reason; dataJson per schema above). If it fails needing a Gateway balance, call circle_gateway_deposit for that URL then retry once.
4. For each returned person, until you hit the lead target or budget runs low (check budget_status):
   a. nebius_qualify the person against the ICP.
   b. If qualified and the person has an email, optionally circle_pay_service Hunter to verify it; record the result.
   c. If the person has NO email, circle_pay_service Apollo People Enrich to get one, then qualify/verify.
   d. validate_lead (free format check) and ledger_record each purchase (ok = qualified && email present/verified).
5. Stop at the lead target or when budget_status shows no remaining budget.
6. Finish with a summary: qualified leads (name, title, company, email), total USDC spent vs cap, and how many emails you verified.

Never pay a URL you haven't inspected or that isn't listed above. Prefer one People Search (cheap, returns many) over many Enrich calls.`;
}
