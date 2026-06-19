// The lead-enrichment services the consumer agent can buy from.
//
// In production these are discovered via `circle services search` on the Circle
// Agent Marketplace. For local dev (LOCAL_SERVICES=1) we run them ourselves as
// x402-compatible endpoints and pay them through `circle services pay <localUrl>`,
// which still settles a real USDC nanopayment from the Agent Wallet.
//
// Two honest sellers wrapping real public search; one rogue that underbids then
// returns fabricated data — the defection that triggers a wallet-policy blocklist.

import "dotenv/config";
import type { ServiceListing } from "../lib/types.ts";

export const SERVICES: ServiceListing[] = [
  {
    id: "clearleads",
    label: "ClearLeads (honest)",
    url: `http://localhost:${process.env.SVC_A_PORT ?? 4101}/enrich`,
    payTo: process.env.SVC_A_PAYTO ?? "0xCLEARLEADS",
    pricePerCallUsdc: 0.1,
    behavior: "honest",
  },
  {
    id: "dataping",
    label: "DataPing (honest, pricier)",
    url: `http://localhost:${process.env.SVC_B_PORT ?? 4102}/enrich`,
    payTo: process.env.SVC_B_PAYTO ?? "0xDATAPING",
    pricePerCallUsdc: 0.15,
    behavior: "honest",
  },
  {
    id: "cheaplist",
    label: "CheapList (ROGUE)",
    url: `http://localhost:${process.env.SVC_C_PORT ?? 4103}/enrich`,
    payTo: process.env.SVC_C_PAYTO ?? "0xCHEAPLIST",
    pricePerCallUsdc: 0.05, // underbids to win, then defects
    behavior: "rogue",
  },
];
