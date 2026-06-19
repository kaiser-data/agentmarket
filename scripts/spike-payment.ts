// CP0 — MONEY SPIKE (GO / NO-GO) for the Circle Agent Stack.
//
// Proves the wallet path end-to-end:
//   1. find or create an Agent Wallet
//   2. check balance (fund the Gateway balance first if 0 — see README)
//   3. pay a tiny x402 service via Nanopayment and print the receipt/tx hash
//
// Default target is the local ClearLeads service (start it with `npm run services`).
// Set SPIKE_SERVICE_URL to hit a real Marketplace service instead.
//
// If this prints a receipt, the project is viable. If not, escalate immediately.
//
//   npm run services   # in another terminal (for the local target)
//   npm run spike

import "dotenv/config";
import { listAgentWallets, createAgentWallet, getBalance, payService } from "../lib/circle-cli.ts";

const target = process.env.SPIKE_SERVICE_URL ?? `http://localhost:${process.env.SVC_A_PORT ?? 4101}/enrich`;

async function main() {
  console.log("1) wallet…");
  const wallets = await listAgentWallets().catch(() => []);
  const w = wallets[0] ?? (await createAgentWallet());
  const address = w.address;
  console.log("   wallet:", address);

  console.log("2) balance…");
  const bal = await getBalance(address).catch((e) => { console.warn("   balance check failed:", e.message); return 0; });
  console.log("   balance:", bal, "USDC");
  if (!bal) console.warn("   ⚠️  fund the Agent Wallet / Gateway balance before paying (see README).");

  console.log(`3) pay ${target} …`);
  const { result, receipt } = await payService(target, address, { candidate: { company: "Acme", domain: "acme.com" } }, {
    service: "spike", amountUsdc: 0.1, reason: "go/no-go money spike",
  });
  console.log("   result:", result);
  console.log("\n💸 receipt:", JSON.stringify(receipt, null, 2));
  console.log(receipt.txHash || receipt.paymentId ? "\n✅ GO — Agent Wallet nanopayment works." : "\n⚠️  NO-GO — no receipt; check Circle CLI / Gateway funding.");
  process.exit(0);
}

main().catch((e) => { console.error("\n❌ NO-GO:", e); process.exit(1); });
