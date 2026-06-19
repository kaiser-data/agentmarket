// The in-process MCP server the lead-gen agent drives. It exposes the real Circle
// Agent Stack tools (wallet, marketplace discovery, x402 nanopayment — vendored
// circle-tools) PLUS the domain tools that make this a real workflow:
// Tavily discovery, Nebius qualify/validate, a spend ledger, and a budget+policy
// guard that BLOCKLISTS a payee in the wallet policy when it sells bad data.
//
// The budget/policy guard sits INSIDE circle_pay_service: every payment is
// authorized against the cap + blocklist before the USDC moves. That is the
// "policy-based payment behavior" the prize asks for, enforced in code.

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import * as circle from "@agent-stack-ecosystem-kits/circle-tools";
import { selectPayChain, ensureDeployed, selectGatewayChain, selectDepositMethod } from "@agent-stack-ecosystem-kits/kit-core/tools";
import { discoverCandidates } from "../lib/tavily.ts";
import { qualify, validate } from "../lib/nebius.ts";
import { SpendPolicy } from "../lib/policy.ts";
import { Ledger } from "../lib/ledger.ts";
import { emit } from "../lib/events.ts";

export const MCP_SERVER_NAME = "leadgen";
export const SPEND_TOOLS = ["circle_pay_service", "circle_gateway_deposit"].map((n) => `mcp__${MCP_SERVER_NAME}__${n}`);

// Shared run state across tool calls.
export const policy = new SpendPolicy(Number(process.env.BUDGET_USDC ?? 2.0), Number(process.env.APPROVAL_OVER_USDC ?? 1.0));
export const ledger = new Ledger();

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };
const ok = (v: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(v) }] });
const fail = (e: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }], isError: true });
const log = (l: string) => console.log(`  [tool] ${l}`);
const chainEnum = z.enum(["BASE", "POLYGON"]);

// ---------- Circle Agent Wallet + Marketplace ----------
const listWallets = tool("circle_list_wallets", "List existing Circle agent wallets on Base. Returns [{address}].", {}, async () => {
  try { return ok(await circle.listWallets()); } catch (e) { return fail(e); }
});

const createWallet = tool("circle_create_wallet", "Create a new Circle agent wallet on Base. Returns {address}.", {}, async () => {
  try { return ok(await circle.createWallet()); } catch (e) { return fail(e); }
});

const getBalance = tool("circle_get_balance", "Check USDC + token balances for a wallet. Defaults to Base.", {
  address: z.string(), chain: chainEnum.optional(),
}, async ({ address, chain }) => {
  try { return ok(await circle.getBalance({ address, chain })); } catch (e) { return fail(e); }
});

const deployWallet = tool("circle_deploy_wallet",
  "Deploy an agent wallet's smart account via a one-time zero-value self-transfer. A fresh wallet is counterfactual and cannot sign x402 payments until deployed. Idempotent, gas-abstracted. Call before the first circle_pay_service.",
  { address: z.string(), chain: chainEnum.optional() },
  async ({ address, chain }) => { try { return ok(await circle.deployWallet({ address, chain })); } catch (e) { return fail(e); } },
);

const searchServices = tool("circle_search_services", "Discover x402 lead-enrichment services on the Circle Agent Marketplace by keyword.", {
  keyword: z.string(),
}, async ({ keyword }) => { try { return ok(await circle.searchServices({ keyword })); } catch (e) { return fail(e); } });

const inspectService = tool("circle_inspect_service", "Inspect an x402 service: pricing, input schema, HTTP method, health. Always call before paying.", {
  url: z.string(),
}, async ({ url }) => { try { return ok(await circle.inspectService({ url })); } catch (e) { return fail(e); } });

// ---------- The guarded nanopayment (policy enforced here) ----------
const payService = tool("circle_pay_service",
  "Pay an x402 service with a Circle USDC nanopayment, then return its data + a receipt. ENFORCES the wallet policy: refuses payees that are blocklisted (sold bad data earlier) or that would exceed the budget cap. Pass `reason` (why this purchase) and the inspected `method`.",
  {
    url: z.string(),
    address: z.string(),
    payTo: z.string().describe("The service's receiving address, for policy/blocklist tracking."),
    serviceId: z.string().describe("Stable id/name of the service, for reputation tracking."),
    amountUsdc: z.number().describe("Expected price in USDC (from inspect)."),
    reason: z.string().describe("Why the agent is buying this record."),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
    dataJson: z.string().describe('JSON payload matching the service schema, e.g. {"candidate":{...}}.'),
  },
  async ({ url, address, payTo, serviceId, amountUsdc, reason, method, dataJson }) => {
    // 1) Policy gate BEFORE any money moves.
    const auth = policy.authorize(payTo, amountUsdc);
    if (!auth.ok) { await emit({ type: "blocked", service: serviceId, reason: auth.reason! }); return fail(new Error(`policy blocked payment: ${auth.reason}`)); }

    let data: Record<string, unknown>;
    try { data = JSON.parse(dataJson); } catch (e) { return fail(new Error(`invalid dataJson: ${(e as Error).message}`)); }

    const httpMethod = (method ?? "POST").toUpperCase();
    const picked = await selectPayChain(url, httpMethod, log);
    if (!picked.ok) return fail(new Error(picked.message));
    const dep = await ensureDeployed(address, picked.chain, log);
    if (!dep.ok) return fail(new Error(dep.message));

    try {
      const r = await circle.payService({ url, address, data, method: httpMethod, chain: picked.chain });
      policy.recordSpend(amountUsdc);
      const receipt = { service: serviceId, amountUsdc, txHash: r.txHash, ts: Date.now(), reason };
      await emit({ type: "payment", from: "agent-wallet", to: serviceId, usdc: amountUsdc, txHash: r.txHash, reason });
      await emit({ type: "budget", spent: policy.policy.spentUsdc, cap: policy.policy.budgetUsdc, remaining: policy.remaining() });
      let body: any = r.response; try { body = JSON.parse(r.response); } catch { /* keep text */ }
      return ok({ receipt, data: body });
    } catch (e) { return fail(e); }
  },
);

const gatewayDeposit = tool("circle_gateway_deposit",
  "Fund the wallet's Circle Gateway balance so it can pay a seller that requires Gateway (batched) x402. Pass the service URL; the kit confirms the requirement and picks the chain. Spends USDC.",
  { url: z.string(), address: z.string(), amount: z.number().positive(), method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional() },
  async ({ url, address, amount, method }) => {
    const picked = await selectGatewayChain(url, (method ?? "POST").toUpperCase(), log);
    if (!picked.ok) return fail(new Error(picked.message));
    try { return ok(await circle.gatewayDeposit({ address, amount, chain: picked.chain, method: selectDepositMethod(picked.chain) })); } catch (e) { return fail(e); }
  },
);

// ---------- Domain tools ----------
const discover = tool("tavily_discover", "Discover candidate companies/people matching an ICP description, via Tavily web search. Returns [{company,domain,source}].", {
  description: z.string(), count: z.number().optional(),
}, async ({ description, count }) => {
  try { return ok(await discoverCandidates({ description, count: count ?? 10 })); } catch (e) { return fail(e); }
});

const qualifyLead = tool("nebius_qualify", "Score an enriched lead 0..1 against the ICP (Nebius). Returns {score}.", {
  leadJson: z.string(), icp: z.string(),
}, async ({ leadJson, icp }) => {
  try { const lead = JSON.parse(leadJson); return ok({ score: await qualify(lead, { description: icp, count: 1 }) }); } catch (e) { return fail(e); }
});

const validateLead = tool("validate_lead",
  "Validate an enriched lead for fabricated/implausible data (Nebius + format checks). If invalid, rates the selling service DOWN and may BLOCKLIST its payee in the wallet policy (self-defending spend). Returns {valid,reason,blocklisted}.",
  { leadJson: z.string(), serviceId: z.string(), payTo: z.string() },
  async ({ leadJson, serviceId, payTo }) => {
    try {
      const lead = JSON.parse(leadJson);
      const v = await validate(lead);
      const good = v.valid && (lead.score ?? 1) >= 0.4;
      const { blocklisted } = policy.rate(serviceId, payTo, good);
      await emit({ type: "lead", service: serviceId, score: lead.score ?? 0, valid: v.valid, preview: `${lead.company} — ${lead.title} <${lead.email}>` });
      if (blocklisted) await emit({ type: "policy", service: serviceId, action: "blocklist", reason: v.reason || "low quality" });
      return ok({ ...v, blocklisted });
    } catch (e) { return fail(e); }
  },
);

const recordLedger = tool("ledger_record", "Record a completed purchase to the spend ledger (receipt + whether the data was good). Call after validate_lead.", {
  serviceId: z.string(), amountUsdc: z.number(), reason: z.string(), txHash: z.string().optional(), ok: z.boolean(),
}, async ({ serviceId, amountUsdc, reason, txHash, ok: good }) => {
  ledger.record({ service: serviceId, amountUsdc, txHash, ts: Date.now(), reason }, good);
  return ok({ recorded: true, total: ledger.total });
});

const budgetStatus = tool("budget_status", "Report remaining budget, total spent, and the current payee blocklist.", {}, async () =>
  ok({ cap: policy.policy.budgetUsdc, spent: policy.policy.spentUsdc, remaining: policy.remaining(), blocklist: policy.policy.blocklist }),
);

export function buildLeadgenServer() {
  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "0.1.0",
    tools: [
      listWallets, createWallet, getBalance, deployWallet,
      searchServices, inspectService, payService, gatewayDeposit,
      discover, qualifyLead, validateLead, recordLedger, budgetStatus,
    ],
  });
}
