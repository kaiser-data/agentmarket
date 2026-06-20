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
import * as rail from "../lib/rail.ts";
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
    handler: () => rail.listWallets() },

  { name: "circle_create_wallet", description: "Create a new Circle agent wallet on Base. Returns {address}.", shape: {},
    handler: () => rail.createWallet() },

  { name: "circle_get_balance", description: "Check USDC + token balances for a wallet. Defaults to Base.",
    shape: { address: z.string(), chain: chainEnum.optional() },
    handler: ({ address, chain }) => rail.getBalance(address, chain) },

  { name: "circle_get_gateway_balance", description: "Check the wallet's Circle Gateway balance (the off-chain batched-payment pool, separate from the on-chain balance). Defaults to Base.",
    shape: { address: z.string(), chain: chainEnum.optional() },
    handler: ({ address, chain }) => rail.gatewayBalance(address, chain) },

  { name: "circle_deploy_wallet",
    description: "Deploy an agent wallet's smart account via a one-time zero-value self-transfer. A fresh wallet is counterfactual and cannot sign x402 payments until deployed. Idempotent, gas-abstracted. Call before the first circle_pay_service.",
    shape: { address: z.string(), chain: chainEnum.optional() },
    handler: ({ address, chain }) => rail.deployWallet(address, chain) },

  { name: "circle_search_services", description: "Discover x402 lead-enrichment services on the Circle Agent Marketplace by keyword.",
    shape: { keyword: z.string() },
    handler: ({ keyword }) => rail.searchServices(keyword) },

  { name: "circle_inspect_service", description: "Inspect an x402 service: pricing, input schema, HTTP method, health. Always call before paying.",
    shape: { url: z.string() },
    handler: ({ url }) => rail.inspectService(url) },

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
      amountUsdc = Number(amountUsdc) || 0; // models sometimes emit numbers as strings
      await emit({ type: "consider", service: serviceId, price: amountUsdc, reputation: policy.score(serviceId) });
      const auth = policy.authorize(payTo, amountUsdc);
      if (!auth.ok) { await emit({ type: "blocked", service: serviceId, reason: auth.reason! }); throw new Error(`policy blocked payment: ${auth.reason}`); }

      let data: Record<string, unknown>;
      try { data = JSON.parse(dataJson); } catch (e) { throw new Error(`invalid dataJson: ${(e as Error).message}`); }

      const httpMethod = (method ?? "POST").toUpperCase();
      const r = await rail.payService({ url, address, data, method: httpMethod });
      policy.recordSpend(amountUsdc);
      const receipt = { service: serviceId, amountUsdc, txHash: r.txHash, ts: Date.now(), reason };
      // Auto-record EVERY payment to the ledger here, where the money actually moves,
      // so the spend ledger always matches reality (never relies on the model to log).
      ledger.record(receipt, true);
      await emit({ type: "payment", from: "agent-wallet", to: serviceId, usdc: amountUsdc, txHash: r.txHash, reason });
      await emit({ type: "budget", spent: policy.policy.spentUsdc, cap: policy.policy.budgetUsdc, remaining: policy.remaining() });
      let body: any = r.response; try { body = JSON.parse(r.response); } catch { /* keep text */ }
      return { receipt, data: body };
    } },

  { name: "circle_gateway_deposit", spend: true,
    description: "Fund the wallet's Circle Gateway balance so it can pay a seller that requires Gateway (batched) x402. Pass the service URL; the kit confirms the requirement and picks the chain. Spends USDC.",
    shape: { url: z.string(), address: z.string(), amount: z.number().positive(), method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional() },
    handler: ({ url, address, amount, method }) => rail.gatewayDeposit({ url, address, amount, method }) },

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
      const company = lead.company ?? lead.organization?.name ?? "?";
      await emit({ type: "lead", service: serviceId, score: lead.score ?? 0, valid: v.valid, preview: `${company} — ${lead.title} <${lead.email}>` });
      if (blocklisted) await emit({ type: "policy", service: serviceId, action: "blocklist", reason: v.reason || "low quality" });
      return { ...v, blocklisted };
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

Workflow — call tools yourself, one step at a time. Do NOT skip steps and do NOT summarize early:
1. circle_list_wallets (create with circle_create_wallet if none); circle_get_balance and circle_get_gateway_balance for the wallet address.
2. circle_search_services "lead enrichment" — confirm the StableEnrich services are discoverable (discovery on the record).
3. circle_pay_service the Apollo People Search ONCE (method POST; payTo 0x325bdF6F7efAB24a2210c48c1b64cAb2eAe1d430; serviceId "apollo-people-search"; amountUsdc 0.02; reason; dataJson per schema above). If it fails needing a Gateway balance, call circle_gateway_deposit for that URL then retry once. It returns a people[] list.
4. Now process the people list ONE PERSON AT A TIME until you have the target number of FULLY PROCESSED leads (or budget_status shows no remaining budget). For EACH person you must, in order:
   a. nebius_qualify(leadJson = that person, icp). Keep the returned score.
   b. If qualified (score >= 0.5): if the person has no email, circle_pay_service Apollo People Enrich to get one. Then circle_pay_service Hunter Email Verifier on the email (serviceId "hunter-email-verifier", amountUsdc 0.03) — if result is "deliverable" the lead is verified; if "undeliverable"/"risky" the lead is REJECTED (do not count it).
   c. validate_lead(leadJson = the person WITH its score merged in, serviceId, payTo). (Every payment is logged to the spend ledger automatically — you do not record it yourself.)
   Only after finishing a person do you move to the next one.
5. Stop when you have verified the target number of leads, or budget_status shows no remaining budget.
6. Summary — be strictly honest: list ONLY leads you actually qualified AND verified AND recorded (name, title, company, email, "verified"). State total USDC spent vs cap and how many emails you verified. NEVER list a person you did not fully process.

Never pay a URL you haven't inspected or that isn't listed above. One People Search (cheap) then enrich/verify per lead.`;
}
