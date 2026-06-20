// The policy-bound signer boundary.
//
// The agent PROPOSES a transaction (an encoded calldata intent); this hands it to
// the Circle Agent Wallet to SIGN via `circle wallet execute`. Circle's MPC holds
// the key and enforces the wallet's on-chain spending policy (allowlist + caps,
// set by the human via OTP) BEFORE signing. The model never holds a key and cannot
// move funds or write off-policy, even if prompt-injected.
//
// SIMULATE=1 returns a mock tx so the flow runs free.
//
// Real CLI (confirmed via `circle wallet execute --help`):
//   circle wallet execute "<fnSignature>" <params...> --contract <addr> \
//     --address <wallet> --chain <CHAIN> --output json
// The CLI ABI-encodes the call itself, so we pass the signature + params, not calldata.

import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SIMULATE } from "./rail.ts";
import type { ExecuteIntent } from "./erc8004.ts";

const exec = promisify(execFile);

let simN = 9000;
function simTx() {
  simN += 1;
  return "0x" + ("e8ec" + simN).padEnd(8, "0").repeat(8).replace(/[^0-9a-f]/g, "e").slice(0, 64);
}

/**
 * Submit an encoded write intent to the Circle Agent Wallet for signing.
 * Returns the on-chain tx hash. The agent never sees a key.
 */
export async function executeViaCircle(intent: ExecuteIntent, opts: { address: string; chain?: string }): Promise<string> {
  if (SIMULATE) return simTx();
  const chain = opts.chain ?? process.env.ERC8004_CHAIN_CLI ?? "BASE-SEPOLIA";
  const { stdout } = await exec("circle", [
    "wallet", "execute",
    intent.signature, ...intent.params,
    "--contract", intent.contract,
    "--address", opts.address,
    "--chain", chain,
    "--output", "json",
  ], { env: process.env, maxBuffer: 8 * 1024 * 1024 });
  const out = stdout.trim();
  try {
    const j = JSON.parse(out);
    return j.data?.txHash ?? j.txHash ?? j.data?.id ?? out;
  } catch {
    return (out.match(/0x[a-fA-F0-9]{64}/) ?? [out])[0];
  }
}
