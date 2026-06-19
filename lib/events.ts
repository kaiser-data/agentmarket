// Fire-and-forget event emitter for the live dashboard.
// Agents POST events; the dashboard server fans them out over SSE.

import "dotenv/config";

export type AgentEvent =
  | { type: "discover"; count: number; query: string }
  | { type: "consider"; service: string; price: number; reputation: number }
  | { type: "blocked"; service: string; reason: string }
  | { type: "payment"; from: string; to: string; usdc: number; txHash?: string; reason: string }
  | { type: "lead"; service: string; score: number; valid: boolean; preview: string }
  | { type: "policy"; service: string; action: "blocklist"; reason: string }
  | { type: "budget"; spent: number; cap: number; remaining: number }
  | { type: "log"; message: string };

const url = (process.env.DASHBOARD_URL ?? "http://localhost:4000") + "/event";

export async function emit(ev: AgentEvent) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ev, ts: Date.now() }),
    });
  } catch {
    /* dashboard optional — never block the agent loop */
  }
  console.log(`[${ev.type}]`, JSON.stringify(ev));
}
