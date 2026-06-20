// The trust engine.
//
// Positioning we can defend: payment proves the interaction *happened*;
// verification proves whether it was *good*; reputation binds both. So we never
// collapse those into one number. Each service gets:
//   - Quality Score — verified pass rate (was the output good?)
//   - Wash Risk    — likelihood the reputation was manufactured
//   - a Category, plain-language reasons, and a recommended wallet policy.

import type { Actor, ServiceActors } from "./actors";
import { SERVICE_ACTORS } from "./actors";

export type Outcome = "pass" | "fail";

export interface Attestation {
  serviceId: string;
  payTx: string;
  verifyTx: string;
  outcome: Outcome;
  scorePct: number;
  attester: string;
  ts: number;
  onchainTx: string;
  explorer: string;
}

export type Category = "trusted" | "unproven" | "suspicious" | "unreliable";
export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "na";

export interface Reason {
  ok: boolean; // true = supports trust, false = a flag
  text: string;
}

export interface WashSignals {
  buyerCount: number;
  verifierCount: number;
  circularPayment: boolean; // buyer and seller share a funding root
  exclusiveVerifier: boolean; // verifier only ever validates this seller
  selfAttestation: boolean; // attester == seller identity
}

export interface Wash {
  score: number; // 0–100, higher = riskier
  level: RiskLevel;
  signals: WashSignals;
}

export interface Policy {
  maxSpend: string;
  requireVerification: boolean;
  note: string;
}

export type Strength = "high" | "medium" | "low";

export interface Service {
  id: string;
  name: string;
  capability: string;
  endpoint: string;
  agentId: string | null;
  source: "on-chain" | "simulated";

  quality: number; // 0–100 verified pass rate
  count: number;
  passes: number;
  fails: number;

  wash: Wash;
  category: Category;
  reasons: Reason[];
  policy: Policy;
  verdictLine: string; // one-sentence decision
  strength: Strength; // confidence in the score (evidence depth)
  lastTs: number | null; // most recent attestation
  nextStep: string | null; // onboarding action for unproven services

  buyers: Actor[];
  verifiers: Actor[];
  attestations: Attestation[]; // newest first
}

export const STRENGTH_META: Record<Strength, { label: string; tone: "good" | "warn" | "muted" }> = {
  high: { label: "High", tone: "good" },
  medium: { label: "Medium", tone: "warn" },
  low: { label: "Low", tone: "muted" },
};

export const CATEGORY_META: Record<Category, { label: string; tone: "good" | "warn" | "risk" | "bad" }> = {
  trusted: { label: "Trusted", tone: "good" },
  unproven: { label: "Unproven", tone: "warn" },
  suspicious: { label: "Suspicious", tone: "risk" },
  unreliable: { label: "Proven unreliable", tone: "bad" },
};

export const RISK_META: Record<RiskLevel, { label: string; tone: "good" | "warn" | "risk" | "bad" | "muted" }> = {
  low: { label: "Low", tone: "good" },
  moderate: { label: "Moderate", tone: "warn" },
  elevated: { label: "Elevated", tone: "risk" },
  high: { label: "High", tone: "bad" },
  na: { label: "—", tone: "muted" },
};

// ── Wash-risk engine ──────────────────────────────────────────────────
function washFor(atts: Attestation[], a: ServiceActors, sellerIdentity: string | null): Wash {
  const signals: WashSignals = {
    buyerCount: a.buyers.length,
    verifierCount: a.verifiers.length,
    circularPayment: a.buyers.some((b) => b.fundingRoot === a.sellerFundingRoot),
    exclusiveVerifier:
      a.verifiers.length > 0 && a.verifiers.every((v) => v.fundingRoot === a.sellerFundingRoot),
    selfAttestation:
      sellerIdentity != null && atts.some((x) => x.attester.toLowerCase() === sellerIdentity.toLowerCase()),
  };

  if (atts.length === 0) return { score: 0, level: "na", signals };

  let score = 0;
  if (signals.circularPayment) score += 45; // strongest wash tell
  if (signals.selfAttestation) score += 40;
  if (signals.exclusiveVerifier) score += 25;
  if (signals.buyerCount <= 1) score += 18; // thin buyer diversity
  if (signals.verifierCount <= 1 && !signals.exclusiveVerifier) score += 8;
  // independent diversity pulls risk back down
  score -= Math.min(20, (Math.max(0, signals.buyerCount - 1) + Math.max(0, signals.verifierCount - 1)) * 8);
  score = Math.max(0, Math.min(100, score));

  const level: RiskLevel =
    score >= 75 ? "high" : score >= 50 ? "elevated" : score >= 25 ? "moderate" : "low";
  return { score, level, signals };
}

// ── Category ──────────────────────────────────────────────────────────
function categoryFor(quality: number, count: number, wash: Wash): Category {
  if (count === 0) return "unproven";
  if (quality <= 20) return "unreliable";
  if (wash.score >= 55) return "suspicious";
  if (quality >= 80 && wash.score < 30) return "trusted";
  return "unproven";
}

// ── Plain-language reasoning (#3) ─────────────────────────────────────
function reasonsFor(s: { quality: number; count: number; passes: number; fails: number }, wash: Wash, buyers: number, verifiers: number): Reason[] {
  const r: Reason[] = [];
  if (s.count === 0) {
    r.push({ ok: false, text: "No verified attestations yet — reputation is unestablished." });
    return r;
  }
  r.push({
    ok: s.quality >= 80,
    text: `${s.passes}/${s.count} outputs ${s.quality >= 80 ? "passed" : "failed"} independent verification.`,
  });
  r.push({
    ok: buyers > 1,
    text: buyers > 1
      ? `Payments came from ${buyers} independent buyer agents.`
      : "Payments came from a single buyer — diversity unproven.",
  });
  r.push({
    ok: !wash.signals.circularPayment,
    text: wash.signals.circularPayment
      ? "Buyer and seller share a funding source — circular payment pattern."
      : "No circular payment pattern detected.",
  });
  r.push({
    ok: !wash.signals.exclusiveVerifier,
    text: wash.signals.exclusiveVerifier
      ? "Verifier exclusively validates this seller — possible collusion."
      : `Verifier has no exclusive relationship with the seller (${verifiers} used).`,
  });
  return r;
}

// ── Recommended wallet policy (#7) ────────────────────────────────────
function policyFor(category: Category): Policy {
  switch (category) {
    case "trusted":
      return { maxSpend: "$0.05 / call", requireVerification: true, note: "Cleared for routine spend. Keep verification on." };
    case "unproven":
      return { maxSpend: "$0.02 trial", requireVerification: true, note: "Unknown service — cap a single trial call, require verification, no bulk spend." };
    case "suspicious":
      return { maxSpend: "$0.00 — hold", requireVerification: true, note: "Reputation looks manufactured. Hold spend pending an independent buyer." };
    case "unreliable":
      return { maxSpend: "$0.00 — refuse", requireVerification: true, note: "Proven to fail verification. Route around it." };
  }
}

// ── Evidence strength (#4) — confidence, not score ────────────────────
// A 100% from 1 attestation must not read like 100% from 50. Strength rolls up
// attestation depth + buyer diversity + verifier diversity.
function strengthFor(count: number, buyers: number, verifiers: number): Strength {
  if (count === 0) return "low";
  let pts = 0;
  pts += count >= 6 ? 2 : count >= 3 ? 1 : 0;
  pts += buyers > 1 ? 1 : 0;
  pts += verifiers > 1 ? 1 : 0;
  return pts >= 3 ? "high" : pts >= 1 ? "medium" : "low";
}

// ── One-sentence verdict (#2) ─────────────────────────────────────────
function verdictFor(s: { name: string; capability: string; quality: number; count: number; passes: number; fails: number }, category: Category, wash: Wash): string {
  const cap = s.capability.toLowerCase();
  switch (category) {
    case "trusted":
      return `Pay ${s.name} for routine ${cap}, but keep verification required.`;
    case "unproven":
      return s.count === 0
        ? `Trial ${s.name} with a capped call — it has no verified history yet.`
        : `Trial ${s.name} carefully — its evidence is still thin.`;
    case "suspicious":
      return `Hold ${s.name}: quality looks high, but wash risk is ${RISK_META[wash.level].label.toLowerCase()} — the reputation may be manufactured.`;
    case "unreliable":
      return `Refuse ${s.name} because ${s.fails}/${s.count} verified interactions failed.`;
  }
}

// ── Verifier trust (#6) — verification isn't blindly trusted ──────────
export interface VerifierStats {
  trust: "Established" | "New";
  coverage: number; // services this verifier covers
  conflictRisk: "Low" | "Medium" | "Elevated";
}

// ── Payment graph (#9) ────────────────────────────────────────────────
export interface GraphNode { id: string; label: string; kind: "buyer" | "service" | "verifier" | "registry" }
export interface GraphEdge { from: string; to: string; label: string; warn?: boolean }
export interface PaymentGraph { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] }

export function paymentGraph(s: Service): PaymentGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  s.buyers.forEach((b) => nodes.push({ id: b.id, label: b.label, kind: "buyer" }));
  nodes.push({ id: "svc", label: s.name, kind: "service" });
  s.verifiers.forEach((v) => nodes.push({ id: v.id, label: v.label, kind: "verifier" }));
  nodes.push({ id: "erc8004", label: "ERC-8004", kind: "registry" });

  s.buyers.forEach((b) => edges.push({ from: b.id, to: "svc", label: "pays USDC" }));
  s.verifiers.forEach((v) => edges.push({ from: "svc", to: v.id, label: "output checked" }));
  s.verifiers.forEach((v) => edges.push({ from: v.id, to: "erc8004", label: "attests" }));

  if (s.wash.signals.circularPayment) {
    warnings.push("Buyer and seller share a funding source.");
    s.buyers.forEach((b) => edges.push({ from: "svc", to: b.id, label: "funds", warn: true }));
  }
  if (s.wash.signals.exclusiveVerifier) {
    warnings.push("Verifier only validates this seller.");
  }
  return { nodes, edges, warnings };
}

// ── Assemble one service from raw inputs ──────────────────────────────
export function buildService(
  base: { id: string; name: string; capability: string; endpoint: string; agentId: string | null; source: "on-chain" | "simulated"; sellerIdentity: string | null },
  atts: Attestation[],
): Service {
  const a = SERVICE_ACTORS[base.id] ?? { buyers: [], verifiers: [], sellerFundingRoot: `fund:${base.id}` };
  const sorted = [...atts].sort((x, y) => y.ts - x.ts);
  const passes = sorted.filter((x) => x.outcome === "pass").length;
  const fails = sorted.length - passes;
  const quality = sorted.length ? Math.round((passes / sorted.length) * 100) : 0;
  const wash = washFor(sorted, a, base.sellerIdentity);
  const category = categoryFor(quality, sorted.length, wash);

  return {
    ...base,
    quality,
    count: sorted.length,
    passes,
    fails,
    wash,
    category,
    reasons: reasonsFor({ quality, count: sorted.length, passes, fails }, wash, a.buyers.length, a.verifiers.length),
    policy: policyFor(category),
    verdictLine: verdictFor({ name: base.name, capability: base.capability, quality, count: sorted.length, passes, fails }, category, wash),
    strength: strengthFor(sorted.length, a.buyers.length, a.verifiers.length),
    lastTs: sorted.length ? sorted[0].ts : null,
    nextStep:
      category === "unproven" && sorted.length === 0
        ? `Run one $0.02 trial call, verify the output, then attest — that mints ${base.name}'s first on-chain reputation.`
        : null,
    buyers: a.buyers,
    verifiers: a.verifiers,
    attestations: sorted,
  };
}
