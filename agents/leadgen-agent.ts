// Lead-gen agent — built on the Claude Agent SDK + Circle Agent Stack.
//
// The Agent Wallet is the agent's payment identity AND operating budget. The
// model drives the whole workflow through the MCP tools in leadgen-tools.ts;
// this file wires the query loop, the mission prompt, and the human-in-the-loop
// approval policy.
//
// Approval policy (policy-based payment behavior): read-only tools auto-approve;
// a nanopayment UNDER the per-call cap auto-approves so the agent runs
// autonomously; a payment OVER the cap (or a Gateway deposit) pauses for y/N.
//
//   npm run agent "Series A fintech CTOs in Europe, 8 leads"

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { query, type CanUseTool, type PermissionResult, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { ensureSession } from "@agent-stack-ecosystem-kits/circle-tools";
import { buildLeadgenServer, MCP_SERVER_NAME, SPEND_TOOLS, policy, ledger } from "./leadgen-tools.ts";

const GOAL = process.argv.slice(2).join(" ") || "Series A fintech CTOs in Europe, 8 leads";
const APPROVAL_OVER = Number(process.env.APPROVAL_OVER_USDC ?? 1.0);
const MODEL = process.env.LLM_MODEL || "claude-sonnet-4-6";

const MISSION = `You are an autonomous B2B lead-generation agent operating a Circle Agent Wallet on Base.
Your wallet is both your identity and your budget. Spend cap: $${policy.policy.budgetUsdc} USDC. Per-call auto-approve under $${APPROVAL_OVER}.

GOAL: ${GOAL}

Run this repeatable workflow, calling tools yourself:
1. circle_list_wallets (create one with circle_create_wallet if none); circle_get_balance. Note the wallet address.
2. tavily_discover the candidate companies for the ICP.
3. circle_search_services for lead-enrichment services on the Marketplace. (If none are returned, the operator may have started LOCAL services — try those URLs.)
4. For each candidate, until you hit the lead target or the budget cap:
   a. Pick the best service by price (and avoid any the policy has blocklisted — check budget_status).
   b. circle_inspect_service to get price, schema, and HTTP method.
   c. circle_pay_service to buy the enriched record. Always pass payTo, serviceId, amountUsdc, a clear reason, and the inspected method. If it fails needing a Gateway balance, call circle_gateway_deposit then retry once.
   d. nebius_qualify the returned lead against the ICP.
   e. validate_lead — if it comes back invalid, the selling service is rated down and may be BLOCKLISTED; do NOT buy from a blocklisted payee again.
   f. ledger_record the purchase (ok = valid && score>=0.5).
5. Stop at the lead target or when budget_status shows no remaining budget.
6. Finish with a short summary: how many qualified leads, total USDC spent, which services were blocklisted and why.

Be frugal: every payment spends real budget. Never pay a service you haven't inspected. Prefer cheaper services but stop paying any that sell invalid data.`;

function log(l: string) { console.log(`[agent] ${l}`); }

async function main() {
  log(`model=${MODEL} | goal="${GOAL}" | budget=$${policy.policy.budgetUsdc}`);

  const ask = async (q: string): Promise<string> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const a = await rl.question(q);
      if (a.trim().toLowerCase() === "exit") { log("exit"); process.exit(0); }
      return a;
    } finally { rl.close(); }
  };

  // Human-in-the-loop with a budget-aware policy: read tools and small payments
  // run unattended; a payment over the cap or a Gateway deposit needs y/N.
  const canUseTool: CanUseTool = async (toolName, input): Promise<PermissionResult> => {
    if (!SPEND_TOOLS.includes(toolName)) return { behavior: "allow", updatedInput: input };
    const amount = Number((input as any)?.amountUsdc ?? (input as any)?.amount ?? 0);
    if (toolName.endsWith("circle_pay_service") && amount > 0 && amount <= APPROVAL_OVER) {
      log(`auto-approved $${amount} ≤ $${APPROVAL_OVER} cap`);
      return { behavior: "allow", updatedInput: input };
    }
    console.log(`\n⚠️  approval required: ${toolName}\n`, JSON.stringify(input, null, 2));
    const a = (await ask("Approve this spend? [y/N] ")).trim().toLowerCase();
    return a === "y" || a === "yes"
      ? { behavior: "allow", updatedInput: input }
      : { behavior: "deny", message: "User rejected this spend." };
  };

  // Ensure a valid Circle CLI session (email + OTP if needed) before running.
  await ensureSession({ ask, log });

  const session = query({
    prompt: MISSION,
    options: {
      model: MODEL,
      mcpServers: { [MCP_SERVER_NAME]: buildLeadgenServer() },
      tools: [],
      canUseTool,
      permissionMode: "default",
      settingSources: [],
      stderr: (d: string) => { const t = d.trimEnd(); if (t) console.error("[claude-code stderr]", t); },
    },
  });

  for await (const msg of session as AsyncIterable<SDKMessage>) {
    if (msg.type === "assistant") {
      for (const b of (msg.message.content as any[]) ?? []) if (b.type === "text" && b.text.trim()) console.log(`\n--- agent ---\n${b.text.trimEnd()}`);
    } else if (msg.type === "result") {
      const secs = ((msg as any).duration_ms / 1000).toFixed(1);
      log(`done (${secs}s${(msg as any).total_cost_usd ? `, $${(msg as any).total_cost_usd.toFixed(4)}` : ""})`);
    }
  }

  ledger.print();
  log(`ledger saved to ${ledger.save()}`);
  if (policy.policy.blocklist.length) log(`blocklisted payees: ${policy.policy.blocklist.join(", ")}`);
}

main().catch((e) => { console.error("[agent] FATAL:", e instanceof Error ? e.message : e); process.exit(1); });
