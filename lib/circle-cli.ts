// Thin adapter over the vendored, battle-tested `circle-tools` package (from the
// official Circle Agent Stack starter kits). Gives the deterministic orchestrator
// (agents/consumer.ts) simple signatures while delegating all the hard parts —
// {data} envelopes, counterfactual-wallet deploy, Gateway routing, x402 v1/v2,
// atomic USDC — to the real implementation.
//
// The agentic path (agents/leadgen-agent.ts) uses circle-tools directly via an
// MCP server instead of this adapter.

import "dotenv/config";
import * as circle from "@agent-stack-ecosystem-kits/circle-tools";
import { ensureDeployed } from "@agent-stack-ecosystem-kits/kit-core/tools";
import type { Receipt } from "./types.ts";

const noopLog = (_: string) => {};

export async function listAgentWallets() {
  return circle.listWallets();
}
export async function createAgentWallet() {
  return circle.createWallet();
}
export async function getBalance(address: string): Promise<number> {
  const b = await circle.getBalance({ address });
  const usdc = b.tokens.find((t) => t.symbol?.toUpperCase() === "USDC");
  return Number(usdc?.amount ?? 0);
}
export async function searchServices(keyword: string) {
  return circle.searchServices({ keyword });
}
export async function inspectService(url: string) {
  return circle.inspectService({ url });
}

/**
 * Pay an x402 service from the Agent Wallet and return a normalized receipt.
 * Deploys the SCA on the settlement chain first if needed (counterfactual wallets
 * cannot sign x402 until their first outbound tx).
 */
export async function payService(
  url: string,
  fromAddress: string,
  data: Record<string, unknown>,
  meta: { service: string; amountUsdc: number; reason: string; method?: string },
): Promise<{ result: any; receipt: Receipt }> {
  const method = (meta.method ?? "POST").toUpperCase();
  // Best-effort deploy on Base before paying; a flaky RPC is treated as a pass.
  await ensureDeployed(fromAddress, "BASE", noopLog).catch(() => {});
  const r = await circle.payService({ url, address: fromAddress, data, method, chain: "BASE" });
  let parsed: any = r.response;
  try { parsed = JSON.parse(r.response); } catch { /* non-JSON body */ }
  const receipt: Receipt = {
    service: meta.service,
    amountUsdc: meta.amountUsdc,
    txHash: r.txHash,
    ts: Date.now(),
    reason: meta.reason,
  };
  return { result: parsed, receipt };
}
