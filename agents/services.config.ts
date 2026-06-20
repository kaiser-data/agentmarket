// Real Circle Agent Marketplace services used by the deterministic consumer path
// (agents/consumer.ts). The agent path discovers these live via circle_search_services;
// this catalog lets the deterministic path hit the same real endpoints.
//
// All settle to the StableEnrich seller on Base. Prices verified via `circle services
// inspect` (June 2026). Request schemas are documented in buildMission() in leadgen-core.ts.

import "dotenv/config";
import type { ServiceListing } from "../lib/types.ts";

const STABLEENRICH_PAYTO = "0x325bdF6F7efAB24a2210c48c1b64cAb2eAe1d430";

export const SERVICES: ServiceListing[] = [
  {
    id: "apollo-people-search",
    label: "Apollo People Search (StableEnrich)",
    url: "https://stableenrich.dev/api/apollo/people-search",
    payTo: STABLEENRICH_PAYTO,
    pricePerCallUsdc: 0.02,
    behavior: "honest",
  },
  {
    id: "apollo-people-enrich",
    label: "Apollo People Enrich (StableEnrich)",
    url: "https://stableenrich.dev/api/apollo/people-enrich",
    payTo: STABLEENRICH_PAYTO,
    pricePerCallUsdc: 0.0495,
    behavior: "honest",
  },
  {
    id: "hunter-email-verifier",
    label: "Hunter Email Verifier (StableEnrich)",
    url: "https://stableenrich.dev/api/hunter/email-verifier",
    payTo: STABLEENRICH_PAYTO,
    pricePerCallUsdc: 0.03,
    behavior: "honest",
  },
];
