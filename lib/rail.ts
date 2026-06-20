// Payment-rail abstraction. Routes every wallet / marketplace / payment call to
// either the real vendored Circle Agent Stack (`circle-tools`) or the free mock
// (`sim.ts`), based on SIMULATE. For real payments it also runs the kit's
// preflight (chain selection + counterfactual-wallet deploy) so callers don't
// have to. The agent's tool core (leadgen-core.ts) talks only to this module, so
// SIMULATE=1 reroutes the entire flow with zero changes elsewhere.

import "dotenv/config";
import * as circle from "@agent-stack-ecosystem-kits/circle-tools";
import { selectPayChain, ensureDeployed, selectGatewayChain, selectDepositMethod } from "@agent-stack-ecosystem-kits/kit-core/tools";
import * as sim from "./sim.ts";

export const SIMULATE = process.env.SIMULATE === "1";
const log = (l: string) => console.log(`  [rail] ${l}`);

export async function listWallets() {
  return SIMULATE ? sim.listWallets() : circle.listWallets();
}
export async function createWallet() {
  return SIMULATE ? sim.createWallet() : circle.createWallet();
}
export async function getBalance(address: string, chain?: "BASE" | "POLYGON") {
  return SIMULATE ? sim.getBalance(address) : circle.getBalance({ address, chain });
}
export async function gatewayBalance(address: string, chain?: "BASE" | "POLYGON") {
  return SIMULATE ? sim.gatewayBalance(address) : circle.gatewayBalance({ address, chain });
}
export async function deployWallet(address: string, chain?: "BASE" | "POLYGON") {
  return SIMULATE ? { address, deployed: true, alreadyDeployed: true } : circle.deployWallet({ address, chain });
}
export async function searchServices(keyword: string) {
  return SIMULATE ? sim.searchServices(keyword) : circle.searchServices({ keyword });
}
export async function inspectService(url: string) {
  return SIMULATE ? sim.inspectService(url) : circle.inspectService({ url });
}

export interface PayResult { response: string; txHash?: string; chain?: string }

/** Pay an x402 service. Real path runs chain-select + deploy preflight first. */
export async function payService(opts: { url: string; address: string; data: Record<string, unknown>; method?: string }): Promise<PayResult> {
  const method = (opts.method ?? "POST").toUpperCase();
  if (SIMULATE) return sim.payService(opts.url, opts.data, method);

  const picked = await selectPayChain(opts.url, method, log);
  if (!picked.ok) throw new Error(picked.message);
  const dep = await ensureDeployed(opts.address, picked.chain, log);
  if (!dep.ok) throw new Error(dep.message);
  const r = await circle.payService({ url: opts.url, address: opts.address, data: opts.data, method, chain: picked.chain });
  return { response: r.response, txHash: r.txHash, chain: picked.chain };
}

export async function gatewayDeposit(opts: { url: string; address: string; amount: number; method?: string }) {
  if (SIMULATE) return sim.gatewayDeposit(opts.amount);
  const picked = await selectGatewayChain(opts.url, (opts.method ?? "POST").toUpperCase(), log);
  if (!picked.ok) throw new Error(picked.message);
  return circle.gatewayDeposit({ address: opts.address, amount: opts.amount, chain: picked.chain, method: selectDepositMethod(picked.chain) });
}
