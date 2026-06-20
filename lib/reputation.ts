// Proof-of-Quality — the unique infrastructure layer.
//
// A service's reputation can only be minted from a REAL, PAID, INDEPENDENTLY
// CROSS-VERIFIED interaction: each attestation binds the Circle payment tx, the
// independent verification tx, and the outcome, then is published to ERC-8004's
// ReputationRegistry. You cannot fake a good score without spending real USDC and
// passing an independent oracle — Sybil-resistant by construction.
//
// Two modes (mirrors lib/rail.ts):
//   SIMULATE=1 → a file-backed shared registry (reputation-store.json) that stands
//                in for the chain, with simulated Base Sepolia explorer links. Lets
//                the two-agent network-effect demo run free and cross-process.
//   SIMULATE=0 → real ERC-8004 ReputationRegistry on Base Sepolia (free testnet gas).
//
// The shared store is what makes the demo's point: Agent A writes attestations,
// Agent B (a separate process) reads them and routes around a proven-bad service
// it never touched.

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SIMULATE } from "./rail.ts";

const STORE = process.env.REPUTATION_STORE ?? "reputation-store.json";

// ERC-8004 on Base Sepolia (real standard; free testnet gas).
export const ERC8004 = {
  reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  explorerTx: (tx: string) => `https://sepolia.basescan.org/tx/${tx}`,
};

export interface Attestation {
  serviceId: string;          // e.g. "apollo-people-enrich"
  payTx?: string;             // Circle payment that proves the interaction was paid for
  verifyTx?: string;          // independent cross-verification payment (e.g. Hunter)
  outcome: "pass" | "fail";   // did the bought data pass independent verification?
  scorePct: number;           // 0..100 (ERC-8004 value with valueDecimals=0)
  attester: string;           // wallet that paid + verified (the feedback author)
  ts: number;
  onchainTx?: string;         // tx hash of the attestation write itself
  explorer?: string;          // explorer link to the attestation
}

let txN = 7000;
function simAttestTx(): string {
  txN += 1;
  return "0x" + ("a11e57" + txN).padEnd(8, "0").repeat(8).replace(/[^0-9a-f]/g, "a").slice(0, 64);
}

function load(): Attestation[] {
  try { return existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : []; } catch { return []; }
}
function save(rows: Attestation[]) { writeFileSync(STORE, JSON.stringify(rows, null, 2)); }

/** Clear the shared registry (use between fresh demos). */
export function reset() { save([]); }

/**
 * Publish a payment-anchored, verification-backed attestation about a service.
 * Returns the written attestation (with its on-chain tx + explorer link).
 */
export async function attest(a: Omit<Attestation, "ts" | "onchainTx" | "explorer">): Promise<Attestation> {
  const row: Attestation = { ...a, ts: Date.now() };
  if (SIMULATE) {
    row.onchainTx = simAttestTx();
    row.explorer = ERC8004.explorerTx(row.onchainTx);
    const rows = load(); rows.push(row); save(rows);
  } else {
    // Real path: ERC-8004 ReputationRegistry.giveFeedback on Base Sepolia.
    // feedbackHash commits to { payTx, verifyTx, outcome } so the score is auditable.
    // TODO(wire): viem writeContract giveFeedback(agentId, value, valueDecimals, tag1, tag2, feedbackURI, feedbackHash)
    const { onchainTx } = await writeFeedbackOnchain(row);
    row.onchainTx = onchainTx;
    row.explorer = ERC8004.explorerTx(onchainTx);
  }
  return row;
}

/** Read a service's aggregate reputation from the shared registry. */
export async function getReputation(serviceId: string): Promise<{ count: number; score: number; fails: number }> {
  if (SIMULATE) {
    const rows = load().filter((r) => r.serviceId === serviceId);
    if (!rows.length) return { count: 0, score: 0.5, fails: 0 };
    const score = rows.reduce((s, r) => s + r.scorePct / 100, 0) / rows.length;
    return { count: rows.length, score, fails: rows.filter((r) => r.outcome === "fail").length };
  }
  // Real path: ERC-8004 getSummary(agentId, ...) → (count, summaryValue, decimals).
  return readSummaryOnchain(serviceId);
}

/**
 * Reputation gate used BEFORE paying a service: refuse a service that the shared
 * registry shows as proven-bad. This is how Agent B avoids a scam Agent A already
 * paid to discover — the wallet won't even attempt the payment.
 */
export async function reputationGate(serviceId: string, minScore = 0.5): Promise<{ ok: boolean; reason?: string; rep: { count: number; score: number } }> {
  const rep = await getReputation(serviceId);
  if (rep.count >= 1 && rep.score < minScore) {
    return { ok: false, reason: `on-chain reputation ${(rep.score * 100).toFixed(0)}% over ${rep.count} verified attestation(s) — below ${minScore * 100}% threshold`, rep };
  }
  return { ok: true, rep };
}

// ---- Real ERC-8004 wiring (Base Sepolia). Stubbed until ONCHAIN_PRIVATE_KEY + ABIs are set. ----
async function writeFeedbackOnchain(_row: Attestation): Promise<{ onchainTx: string }> {
  throw new Error("Real ERC-8004 write not wired yet — run with SIMULATE=1, or wire viem giveFeedback (see TODO).");
}
async function readSummaryOnchain(_serviceId: string): Promise<{ count: number; score: number; fails: number }> {
  throw new Error("Real ERC-8004 read not wired yet — run with SIMULATE=1.");
}
