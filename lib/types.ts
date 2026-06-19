// Shared domain types for AgentMarket.

export interface ICP {
  // Ideal Customer Profile — the consumer agent's goal.
  description: string;        // e.g. "Series A fintech CTOs in Europe"
  count: number;             // how many qualified leads to gather
  filters?: Record<string, string>;
}

export interface Candidate {
  // Raw discovery hit before enrichment.
  company?: string;
  name?: string;
  domain?: string;
  source: string;            // where Tavily found it
}

export interface Lead extends Candidate {
  // Enriched + qualified record bought from a service.
  title?: string;
  email?: string;
  linkedin?: string;
  firmographics?: Record<string, string>;
  serviceId: string;         // marketplace service that sold it
  pricePaidUsdc: number;
  receipt?: Receipt;         // Circle nanopayment receipt
  score?: number;            // 0..1 ICP fit (Nebius)
  valid?: boolean;           // passed validation (Nebius / format check)
}

// ---- Circle Agent Marketplace ----
export interface ServiceListing {
  id: string;                // logical id, e.g. "clearleads"
  label: string;
  url: string;               // x402-compatible endpoint
  payTo: string;             // wallet/recipient the nanopayment settles to
  pricePerCallUsdc: number;
  schema?: Record<string, unknown>; // from `circle services inspect`
  behavior?: "honest" | "rogue";    // demo only
}

// ---- Circle Agent Wallet payment artifacts ----
export interface Receipt {
  service: string;
  amountUsdc: number;
  txHash?: string;           // settlement hash (batched via Gateway)
  paymentId?: string;        // Circle payment/authorization id
  ts: number;
  reason: string;            // WHY the agent paid — for the human-readable ledger
}

export interface LedgerEntry extends Receipt {
  ok: boolean;               // did the purchased work pass validation?
}

export interface WalletPolicy {
  budgetUsdc: number;        // hard spend cap for the run
  spentUsdc: number;
  blocklist: string[];       // payTo addresses the wallet refuses (set on rogue-catch)
  requireApprovalOverUsdc?: number; // human approval threshold
}
