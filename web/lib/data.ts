// Data layer.
//
// Reads the REAL on-chain receipts the agent wrote — snapshotted into web/data
// so the app deploys anywhere (no repo-root file access at runtime). The
// receipts are the source of truth; lib/intel.ts derives the trust signals.
//
// Two SIM services (helix-signals, nimbus-data) are added *only* to exercise
// the Suspicious and Unproven categories — they carry source: "simulated" and
// are badged as such everywhere. Every on-chain number comes from the receipts.

// Static imports so the receipts are bundled into the build — works in any
// deploy target (Netlify, Vercel, static export) with no runtime file access.
import erc8004Agents from "../data/erc8004-agents.json";
import reputationStore from "../data/reputation-store.json";
import { buildService, type Attestation, type Service, type VerifierStats } from "./intel";

interface Meta {
  name: string;
  capability: string;
  endpoint: string;
  source: "on-chain" | "simulated";
  sellerIdentity: string | null;
}

const META: Record<string, Meta> = {
  "apollo-people-enrich": { name: "Apollo", capability: "People enrichment", endpoint: "POST /v1/people/enrich", source: "on-chain", sellerIdentity: null },
  "minerva-enrich": { name: "Minerva", capability: "Contact enrichment", endpoint: "POST /v1/contacts/enrich", source: "on-chain", sellerIdentity: null },
  "clado-contacts-enrich": { name: "Clado", capability: "Contacts enrichment", endpoint: "POST /v1/contacts/lookup", source: "on-chain", sellerIdentity: null },
};

// Illustrative-only. Never written on-chain; present so the trust taxonomy is
// legible end-to-end. Flagged source: "simulated".
const SIM: Record<string, Meta> = {
  "helix-signals": { name: "Helix Signals", capability: "Intent data", endpoint: "POST /v1/intent", source: "simulated", sellerIdentity: null },
  "nimbus-data": { name: "Nimbus Data", capability: "Firmographics", endpoint: "POST /v1/firmographics", source: "simulated", sellerIdentity: null },
};

// A washed score for the SIM "suspicious" service: high pass rate, but the
// actor graph (lib/actors.ts) makes it circular. Deterministic, not on-chain.
function simAttestations(serviceId: string, n: number, outcome: "pass" | "fail"): Attestation[] {
  return Array.from({ length: n }, (_, i) => ({
    serviceId,
    payTx: "0x" + "5".repeat(64),
    verifyTx: "0x" + "5".repeat(64),
    outcome,
    scorePct: outcome === "pass" ? 100 : 0,
    attester: "0x5151515151515151515151515151515151515151",
    ts: 1781948000000 + i * 1000,
    onchainTx: "0x" + "5".repeat(64),
    explorer: "",
  }));
}

let cache: Service[] | null = null;

export function getServices(): Service[] {
  if (cache) return cache;

  const ids = erc8004Agents as Record<string, string>;
  const records = reputationStore as Attestation[];
  const byService = new Map<string, Attestation[]>();
  for (const r of records) {
    const list = byService.get(r.serviceId) ?? [];
    list.push(r);
    byService.set(r.serviceId, list);
  }

  const real = Object.entries(META).map(([id, m]) =>
    buildService({ id, ...m, agentId: ids[id] ?? null }, byService.get(id) ?? []),
  );

  const sim = [
    buildService({ id: "helix-signals", ...SIM["helix-signals"], agentId: null }, simAttestations("helix-signals", 5, "pass")),
    buildService({ id: "nimbus-data", ...SIM["nimbus-data"], agentId: null }, []),
  ];

  // Rank: on-chain trusted first, then by quality, then most-evidenced.
  const order: Record<string, number> = { trusted: 0, unproven: 1, suspicious: 2, unreliable: 3 };
  cache = [...real, ...sim].sort(
    (a, b) =>
      order[a.category] - order[b.category] ||
      b.quality - a.quality ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  );
  return cache;
}

export function getService(id: string): Service | undefined {
  return getServices().find((s) => s.id === id);
}

// Verifier trust (#6): coverage = how many services a verifier checks; an
// exclusive verifier (covers exactly one seller) carries conflict risk.
export function getVerifierStats(verifierId: string): VerifierStats {
  const coverage = getServices().filter((s) => s.verifiers.some((v) => v.id === verifierId)).length;
  return {
    trust: coverage >= 2 ? "Established" : "New",
    coverage,
    conflictRisk: coverage >= 2 ? "Low" : coverage === 1 ? "Elevated" : "Medium",
  };
}

export function getAttestations(): (Attestation & { service: Service })[] {
  const services = getServices().filter((s) => s.source === "on-chain");
  const byId = new Map(services.map((s) => [s.id, s]));
  return services
    .flatMap((s) => s.attestations)
    .sort((a, b) => b.ts - a.ts)
    .map((a) => ({ ...a, service: byId.get(a.serviceId)! }));
}

export interface Totals {
  services: number;
  onchain: number;
  attestations: number;
  passes: number;
  fails: number;
}

export function getTotals(): Totals {
  const all = getServices();
  const onchain = all.filter((s) => s.source === "on-chain");
  return {
    services: all.length,
    onchain: onchain.length,
    attestations: onchain.reduce((n, s) => n + s.count, 0),
    passes: onchain.reduce((n, s) => n + s.passes, 0),
    fails: onchain.reduce((n, s) => n + s.fails, 0),
  };
}

export type { Service, Attestation };
