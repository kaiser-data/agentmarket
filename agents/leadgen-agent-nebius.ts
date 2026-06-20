// Lead-gen agent driven by Nebius Token Factory (OpenAI-compatible function
// calling). Zero Anthropic cost — runs on your free Nebius credits — and makes
// Nebius the agent's brain, maximizing the "best use of Nebius" prize.
//
// Same Circle Agent Wallet, same tool core (leadgen-core.ts), same budget +
// blocklist policy as the Claude path; only the driver model differs.
//
//   npm run agent "Series A fintech CTOs in Europe, 8 leads"

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import OpenAI from "openai";
import { ensureSession } from "@agent-stack-ecosystem-kits/circle-tools";
import { TOOLS, SPEND_TOOL_NAMES, policy, ledger, buildMission } from "./leadgen-core.ts";

const GOAL = process.argv.slice(2).join(" ") || "Series A fintech CTOs in Europe, 8 leads";
const APPROVAL_OVER = Number(process.env.APPROVAL_OVER_USDC ?? 1.0);
const MODEL = process.env.NEBIUS_MODEL || "meta-llama/Llama-3.3-70B-Instruct";
const MAX_STEPS = Number(process.env.MAX_AGENT_STEPS ?? 50);

const client = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
});

// Build OpenAI tool specs from the shared core (zod 4 → JSON Schema).
const toolSpecs = TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: z.toJSONSchema(z.object(t.shape)) as Record<string, unknown>,
  },
}));
const byName = new Map(TOOLS.map((t) => [t.name, t]));

const SYSTEM = buildMission(GOAL);

function log(l: string) { console.log(`[agent] ${l}`); }

async function main() {
  log(`driver=Nebius model=${MODEL} | goal="${GOAL}" | budget=$${policy.policy.budgetUsdc}`);
  if (!process.env.NEBIUS_API_KEY) throw new Error("NEBIUS_API_KEY is not set (this is the agent driver).");

  const ask = async (q: string): Promise<string> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { const a = await rl.question(q); if (a.trim().toLowerCase() === "exit") process.exit(0); return a; }
    finally { rl.close(); }
  };

  // Budget-aware approval: read tools + sub-cap payments run unattended; an
  // over-cap payment or a Gateway deposit pauses for y/N.
  async function approve(name: string, args: any): Promise<boolean> {
    if (!SPEND_TOOL_NAMES.includes(name)) return true;
    const amount = Number(args?.amountUsdc ?? args?.amount ?? 0);
    if (name === "circle_pay_service" && amount > 0 && amount <= APPROVAL_OVER) {
      log(`auto-approved $${amount} ≤ $${APPROVAL_OVER} cap`);
      return true;
    }
    console.log(`\n⚠️  approval required: ${name}\n`, JSON.stringify(args, null, 2));
    const a = (await ask("Approve this spend? [y/N] ")).trim().toLowerCase();
    return a === "y" || a === "yes";
  }

  await ensureSession({ ask, log });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: "Begin. Work the goal end to end, then summarize." },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.chat.completions.create({
      model: MODEL, messages, tools: toolSpecs, tool_choice: "auto", temperature: 0.2,
    });
    const msg = res.choices[0].message;
    messages.push(msg as OpenAI.Chat.ChatCompletionMessageParam);

    if (msg.content?.trim()) console.log(`\n--- agent ---\n${msg.content.trim()}`);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) { log("agent finished (no more tool calls)"); break; }

    for (const call of calls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      let args: any = {};
      try { args = call.function.arguments ? JSON.parse(call.function.arguments) : {}; } catch { /* bad args */ }
      const tdef = byName.get(name);

      let resultText: string;
      if (!tdef) {
        resultText = JSON.stringify({ error: `unknown tool ${name}` });
      } else if (!(await approve(name, args))) {
        resultText = JSON.stringify({ error: "user rejected this spend" });
      } else {
        log(`${name}(${JSON.stringify(args).slice(0, 100)})`);
        try { resultText = JSON.stringify(await tdef.handler(args)); }
        catch (e) { resultText = JSON.stringify({ error: e instanceof Error ? e.message : String(e) }); }
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: resultText });
    }

    if (policy.remaining() <= 0) { log("budget exhausted — stopping"); break; }
  }

  ledger.print();
  log(`ledger saved to ${ledger.save()}`);
  if (policy.policy.blocklist.length) log(`blocklisted payees: ${policy.policy.blocklist.join(", ")}`);
}

main().catch((e) => { console.error("[agent] FATAL:", e instanceof Error ? e.message : e); process.exit(1); });
