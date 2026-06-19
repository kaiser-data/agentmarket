// Wallet spend policy + provider reputation.
//
// Two jobs, both straight from the Circle prize brief ("budgets, spend caps,
// approvals, or policy-based payment behavior"):
//   1. Enforce a hard budget cap and an approval threshold before any payment.
//   2. Track per-service reputation; on the rogue-catch, BLOCKLIST the bad payee
//      so the Agent Wallet itself refuses further payments to it.
//
// In production the blocklist is pushed to the Circle Agent Wallet policy
// (address blocklist) via the CLI; here we also enforce it client-side so the
// demo works without round-tripping every change. TODO(verify): CLI command to
// update wallet spending policy / blocklist.

import type { WalletPolicy } from "./types.ts";

export class SpendPolicy {
  policy: WalletPolicy;
  private rep = new Map<string, { up: number; down: number }>();

  constructor(budgetUsdc: number, requireApprovalOverUsdc?: number) {
    this.policy = { budgetUsdc, spentUsdc: 0, blocklist: [], requireApprovalOverUsdc };
  }

  /** Gate a payment BEFORE it happens. Returns reason if blocked. */
  authorize(payTo: string, amountUsdc: number): { ok: boolean; reason?: string; needsApproval?: boolean } {
    if (this.policy.blocklist.includes(payTo)) return { ok: false, reason: "payee blocklisted (failed validation earlier)" };
    if (this.policy.spentUsdc + amountUsdc > this.policy.budgetUsdc) return { ok: false, reason: "would exceed budget cap" };
    const needsApproval = this.policy.requireApprovalOverUsdc != null && amountUsdc > this.policy.requireApprovalOverUsdc;
    return { ok: true, needsApproval };
  }

  recordSpend(amountUsdc: number) {
    this.policy.spentUsdc += amountUsdc;
  }

  /** Feedback after work is validated; auto-blocklists a payee that keeps failing. */
  rate(serviceId: string, payTo: string, good: boolean) {
    const r = this.rep.get(serviceId) ?? { up: 0, down: 0 };
    good ? r.up++ : r.down++;
    this.rep.set(serviceId, r);
    // One clear defection is enough to stop paying it (demo-tuned).
    if (!good && r.down >= 1 && !this.policy.blocklist.includes(payTo)) {
      this.policy.blocklist.push(payTo);
      return { blocklisted: true };
    }
    return { blocklisted: false };
  }

  score(serviceId: string) {
    const r = this.rep.get(serviceId) ?? { up: 0, down: 0 };
    const t = r.up + r.down;
    return t === 0 ? 0.5 : r.up / t;
  }

  remaining() {
    return this.policy.budgetUsdc - this.policy.spentUsdc;
  }
}
