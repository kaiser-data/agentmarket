// One-time setup for the REAL on-chain reputation demo (keyless).
//
// Registers each enrichment service as an ERC-8004 agent identity (an ERC-721),
// SIGNED BY A CIRCLE WALLET via `circle wallet execute` — no private key is ever
// held here. Writes serviceId -> agentId to erc8004-agents.json.
//
// Uses a REGISTRAR wallet that is DIFFERENT from the buyer/attester wallet, because
// the ReputationRegistry blocks self-feedback (an agent's owner can't review it).
//
// Prereqs (.env):
//   ERC8004_NETWORK=base-sepolia            (free testnet) or base (mainnet)
//   REGISTRAR_WALLET_ADDRESS=0x...          a Circle agent wallet (owns the identities)
//   AGENT_WALLET_ADDRESS=0x...              a DIFFERENT Circle wallet (gives feedback)
//   (testnet ETH for gas: https://www.alchemy.com/faucets/base-sepolia)
//
//   npm run register-services

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { encodeRegister, agentIdFromTx } from "../lib/erc8004.ts";
import { executeViaCircle } from "../lib/circle-execute.ts";
import { SERVICES } from "../agents/services.config.ts";

const MAP = process.env.ERC8004_AGENT_MAP ?? "erc8004-agents.json";
const TO_REGISTER = ["apollo-people-enrich", "minerva-enrich", "clado-contacts-enrich"];

async function main() {
  const registrar = process.env.REGISTRAR_WALLET_ADDRESS;
  if (!registrar) throw new Error("REGISTRAR_WALLET_ADDRESS not set (a Circle wallet, distinct from AGENT_WALLET_ADDRESS).");
  if (registrar === process.env.AGENT_WALLET_ADDRESS) throw new Error("REGISTRAR_WALLET_ADDRESS must differ from AGENT_WALLET_ADDRESS (registry blocks self-feedback).");

  const map: Record<string, string> = existsSync(MAP) ? JSON.parse(readFileSync(MAP, "utf8")) : {};
  for (const id of TO_REGISTER) {
    if (map[id]) { console.log(`✓ ${id} already registered → agentId ${map[id]}`); continue; }
    const svc = SERVICES.find((s) => s.id === id)!;
    console.log(`registering ${id} (${svc.url}) via Circle wallet ${registrar} ...`);
    const intent = encodeRegister(svc.url);                       // agent encodes (no key)
    const txHash = await executeViaCircle(intent, { address: registrar }); // Circle MPC signs
    const agentId = await agentIdFromTx(txHash as `0x${string}`);  // keyless receipt read
    map[id] = agentId.toString();
    writeFileSync(MAP, JSON.stringify(map, null, 2));
    console.log(`  → agentId ${agentId}  (tx ${txHash})`);
  }
  console.log(`\nSaved ${MAP}:`, map);
}

main().catch((e) => { console.error("register-services failed:", e instanceof Error ? e.message : e); process.exit(1); });
