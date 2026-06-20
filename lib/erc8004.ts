// ERC-8004 on Base (IdentityRegistry + ReputationRegistry).
//
// KEYLESS BY DESIGN. This module never holds or uses a private key:
//   - reads (getSummary) go through a public RPC client (no signer)
//   - writes (register, giveFeedback) are only ENCODED here as calldata; the agent
//     hands that calldata to the Circle Agent Wallet via `circle wallet execute`,
//     so Circle's MPC signs it behind the wallet's on-chain spending policy.
//
// This enforces the rule: the model proposes a transaction, the policy-bound signer
// decides. A prompt-injected agent cannot move funds or write off-policy.
//
// Exact signatures (from vendored ABIs):
//   IdentityRegistry.register(string agentURI) -> uint256 agentId
//   ReputationRegistry.giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals,
//     string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)
//   ReputationRegistry.getSummary(uint256 agentId, address[] clients, string tag1, string tag2)
//     -> (uint64 count, int128 summaryValue, uint8 decimals)

import "dotenv/config";
import { createPublicClient, http, keccak256, toHex, decodeEventLog } from "viem";
import { baseSepolia, base } from "viem/chains";
import ID_ABI from "../vendor/erc8004-abi/IdentityRegistry.json" with { type: "json" };
import REP_ABI from "../vendor/erc8004-abi/ReputationRegistry.json" with { type: "json" };

// ERC-8004 is deployed at the same-ish vanity addresses on both Base networks.
const NET = (process.env.ERC8004_NETWORK ?? "base-sepolia").toLowerCase();
const ONCHAIN = NET === "base"
  ? { chain: base, identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", rpc: process.env.RPC_BASE ?? "https://mainnet.base.org" }
  : { chain: baseSepolia, identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e", reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713", rpc: process.env.RPC_BASE_SEPOLIA ?? "https://sepolia.base.org" };

export const IDENTITY = ONCHAIN.identity as `0x${string}`;
export const REPUTATION = ONCHAIN.reputation as `0x${string}`;
export const TAG1 = "proof-of-quality";
const SCAN = `https://${NET === "base" ? "" : "sepolia."}basescan.org`;
export const explorerTx = (tx: string) => `${SCAN}/tx/${tx}`;
/** Link to a service's ERC-721 agent-identity token (IdentityRegistry is an NFT). */
export const identityToken = (agentId: string | bigint) => `${SCAN}/token/${IDENTITY}?a=${agentId}`;

const pub = createPublicClient({ chain: ONCHAIN.chain, transport: http(ONCHAIN.rpc) });

/** keccak256 commitment binding payment + verification evidence to the score. */
export function evidenceHash(payTx?: string, verifyTx?: string, outcome?: string): `0x${string}` {
  return keccak256(toHex(JSON.stringify({ payTx: payTx ?? "", verifyTx: verifyTx ?? "", outcome: outcome ?? "" })));
}

// ---- WRITE INTENTS ----
// The agent proposes an intent: a contract + function signature + params. It is
// NOT signed here. `circle wallet execute "<sig>" <params...> --contract ...` hands
// it to Circle MPC, which encodes + signs behind the wallet's on-chain policy.

export interface ExecuteIntent { contract: `0x${string}`; signature: string; params: string[]; description: string }

export function encodeRegister(agentURI: string): ExecuteIntent {
  return {
    contract: IDENTITY,
    signature: "register(string)",
    params: [agentURI],
    description: `IdentityRegistry.register("${agentURI}")`,
  };
}

export function encodeGiveFeedback(agentId: bigint, scorePct: number, opts: { tag2?: string; endpoint?: string; feedbackURI?: string; feedbackHash: `0x${string}` }): ExecuteIntent {
  return {
    contract: REPUTATION,
    signature: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    params: [String(agentId), String(Math.round(scorePct)), "0", TAG1, opts.tag2 ?? "", opts.endpoint ?? "", opts.feedbackURI ?? "", opts.feedbackHash],
    description: `ReputationRegistry.giveFeedback(agent ${agentId}, ${scorePct}%)`,
  };
}

/** Read an agentId out of a register() tx receipt (keyless). */
export async function agentIdFromTx(txHash: `0x${string}`): Promise<bigint> {
  const rcpt = await pub.waitForTransactionReceipt({ hash: txHash });
  for (const lg of rcpt.logs) {
    try {
      const d: any = decodeEventLog({ abi: ID_ABI as any, data: lg.data, topics: lg.topics });
      if (d.eventName === "Registered") return d.args.agentId as bigint;
    } catch { /* not our event */ }
  }
  throw new Error("agentIdFromTx: no Registered event in receipt");
}

// ---- READ (keyless public RPC) ----
export async function getSummary(agentId: bigint): Promise<{ count: number; score: number }> {
  // getSummary requires the client list (it reverts on []), so fetch it first.
  const clients = (await pub.readContract({
    address: REPUTATION, abi: REP_ABI as any, functionName: "getClients", args: [agentId],
  })) as `0x${string}`[];
  if (!clients.length) return { count: 0, score: 0.5 };
  const [count, value, decimals] = (await pub.readContract({
    address: REPUTATION, abi: REP_ABI as any, functionName: "getSummary", args: [agentId, clients, TAG1, ""],
  })) as [bigint, bigint, number];
  const n = Number(count);
  // summaryValue is the aggregate of feedback values (0 or 100 here); normalise to 0..1.
  return { count: n, score: n === 0 ? 0.5 : Number(value) / 10 ** Number(decimals) / 100 };
}
