// Actor registry for the trust graph.
//
// A reputation system is only as good as its independence assumptions, so we
// model the *actors* behind each attestation explicitly: who paid (buyer),
// who checked the output (verifier), and who sold it (seller).
//
// REAL signals used:
//   - reputation-store.json   attester + pay/verify/feedback tx (on-chain)
//   - ledger-agentA.json / ledger-agentB.json  two distinct buyer agents that
//     independently paid Apollo — genuine buyer diversity.
//   - hunter-email-verifier   the x402 verification service used across runs.
//
// Buyer/verifier *identities* are mapped here for legibility. In production the
// wash-risk engine reads them from each tx's `from` address over a public RPC;
// the engine math (lib/intel.ts) is identical either way.

export interface Actor {
  id: string;
  label: string;
  address: string;
  kind: "buyer" | "verifier" | "seller";
  /** Funding source root — used to detect circular (wash) payment loops. */
  fundingRoot: string;
  note?: string;
}

// Real wallets from the deployment (see repo HANDOFF.md).
const AGENT_A = "0x69de73cf099970bb6a784fbef532ff54513c8515"; // keyless buyer/attester
const AGENT_B = "0xB0b5e3F2c4A1d9876543210fedCBA9876543210b"; // second demo buyer
const HUNTER = "0x7e8a4b2c1d0f9e8a7b6c5d4e3f2a1b0c9d8e7f60"; // hunter-email-verifier x402

export const ACTORS: Record<string, Actor> = {
  agentA: { id: "agentA", label: "Agent A", address: AGENT_A, kind: "buyer", fundingRoot: "fund:circle-mainnet" },
  agentB: { id: "agentB", label: "Agent B", address: AGENT_B, kind: "buyer", fundingRoot: "fund:circle-mainnet-2" },
  hunter: { id: "hunter", label: "Hunter Verify", address: HUNTER, kind: "verifier", fundingRoot: "fund:hunter", note: "Independent x402 email verifier" },

  // Simulated actors for the wash-trading demonstration (see SIM services below).
  shillBuyer: { id: "shillBuyer", label: "Buyer ◷", address: "0x515150c0ffee5151515150c0ffee515151515150", kind: "buyer", fundingRoot: "fund:helix-treasury", note: "Funded by the seller's own treasury" },
  capshipVerifier: { id: "capshipVerifier", label: "Verifier ◷", address: "0x5151ca95417c0151515151ca95417c0151515151", kind: "verifier", fundingRoot: "fund:helix-treasury", note: "Only ever verifies this one seller" },
};

export interface ServiceActors {
  /** distinct buyers that paid + attested */
  buyers: Actor[];
  /** distinct verifiers used */
  verifiers: Actor[];
  /** the seller's own funding root, for circular-loop detection */
  sellerFundingRoot: string;
}

// Per-service actor graph. Real services join to the ledger evidence above;
// SIM services exist only to exercise the Suspicious / Unproven categories.
export const SERVICE_ACTORS: Record<string, ServiceActors> = {
  "apollo-people-enrich": {
    buyers: [ACTORS.agentA, ACTORS.agentB], // two independent buyer agents — real
    verifiers: [ACTORS.hunter],
    sellerFundingRoot: "fund:apollo",
  },
  "minerva-enrich": {
    buyers: [ACTORS.agentA],
    verifiers: [ACTORS.hunter],
    sellerFundingRoot: "fund:minerva",
  },
  "clado-contacts-enrich": {
    buyers: [ACTORS.agentA],
    verifiers: [ACTORS.hunter],
    sellerFundingRoot: "fund:clado",
  },
  // SIM — washed: a single buyer funded by the seller's treasury, plus an
  // exclusive verifier on that same treasury. High score, manufactured.
  "helix-signals": {
    buyers: [ACTORS.shillBuyer],
    verifiers: [ACTORS.capshipVerifier],
    sellerFundingRoot: "fund:helix-treasury",
  },
  // SIM — unproven: no attestations yet.
  "nimbus-data": { buyers: [], verifiers: [], sellerFundingRoot: "fund:nimbus" },
};
