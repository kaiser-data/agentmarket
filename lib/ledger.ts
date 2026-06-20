// Spend ledger — the auditable record of every nanopayment the agent made,
// what it bought, why, and whether the purchased work was any good.
// This is a required deliverable ("receipt, payment log, or spend ledger") and
// the backbone of the demo's UX ("understand what the agent did and why").

import { writeFileSync } from "node:fs";
import type { LedgerEntry, Receipt } from "./types.ts";

export class Ledger {
  private entries: LedgerEntry[] = [];

  record(receipt: Receipt, ok: boolean) {
    this.entries.push({ ...receipt, amountUsdc: Number(receipt.amountUsdc) || 0, ok });
  }

  get total() {
    return this.entries.reduce((s, e) => s + e.amountUsdc, 0);
  }
  get wasted() {
    return this.entries.filter((e) => !e.ok).reduce((s, e) => s + e.amountUsdc, 0);
  }
  all() {
    return this.entries;
  }

  /** Human-readable summary for the demo + a machine-readable JSON artifact. */
  print() {
    console.log("\n=== SPEND LEDGER ===");
    for (const e of this.entries) {
      const mark = e.ok ? "✓" : "✗";
      console.log(
        `${mark} $${e.amountUsdc.toFixed(3)}  ${e.service.padEnd(14)} ${e.reason}` +
          (e.txHash ? `  [${e.txHash.slice(0, 14)}…]` : ""),
      );
    }
    console.log(
      `--- total $${this.total.toFixed(3)} USDC (wasted on bad data: $${this.wasted.toFixed(3)}) ---\n`,
    );
  }

  save(path = "ledger.json") {
    writeFileSync(path, JSON.stringify(this.entries, null, 2));
    return path;
  }
}
