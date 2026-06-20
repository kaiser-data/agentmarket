// Simulation mode (SIMULATE=1): mock the Circle wallet + marketplace + payments so
// the WHOLE agent loop — Nebius reasoning, tool calls, qualify/validate, ledger,
// dashboard, budget policy — runs end to end for FREE, with no CLI, no login, no
// USDC. Flip SIMULATE off to run the identical flow against real services.
//
// The mock returns realistic StableEnrich-shaped data so the agent behaves exactly
// as it will live. Fictional people only.

const SIM_ADDR = "0x5111111111111111111111111111111111111111";

// Fake tx hashes that are clearly simulated but shaped like real ones.
let txN = 0;
function simTx(): string {
  txN += 1;
  return "0x" + ("51m" + txN).padEnd(8, "0").repeat(8).replace(/[^0-9a-f]/g, "5").slice(0, 64);
}

// Fictional ICP-matching prospects. Some lack an email (to exercise enrichment).
const PEOPLE = [
  { name: "Lena Fischer", title: "CTO", email: "lena.fischer@klarwise.io", organization: { name: "Klarwise" } },
  { name: "Tomás Oliveira", title: "VP Engineering", email: "", organization: { name: "PagaFlexPay" } },
  { name: "Sofia Rossi", title: "Chief Technology Officer", email: "sofia.rossi@lunafin.eu", organization: { name: "Lunafin" } },
  { name: "Jonas Berg", title: "Co-founder & CTO", email: "", organization: { name: "Nordbit Payments" } },
  { name: "Amélie Laurent", title: "CTO", email: "amelie.laurent@credipulse.fr", organization: { name: "Crédipulse" } },
  { name: "Markus Vogel", title: "Head of Engineering", email: "markus.vogel@zahltech.at", organization: { name: "Zahltech" } },
];

export async function listWallets() { return [{ address: SIM_ADDR }]; }
export async function createWallet() { return { address: SIM_ADDR }; }
export async function getBalance(_address: string) {
  return { address: SIM_ADDR, tokens: [{ symbol: "USDC", amount: "5.000000" }] };
}
export async function gatewayBalance(_address: string) { return { address: SIM_ADDR, total: "5.0" }; }

const CATALOG = [
  { url: "https://stableenrich.dev/api/apollo/people-search", name: "Apollo People Search", description: "Find prospects by filters", price: "0.02 USDC" },
  { url: "https://stableenrich.dev/api/apollo/people-enrich", name: "Apollo People Enrich", description: "Enrich single person by email/name/domain", price: "0.0495 USDC" },
  { url: "https://stableenrich.dev/api/hunter/email-verifier", name: "Hunter Email Verifier", description: "Verify email deliverability", price: "0.03 USDC" },
];
export async function searchServices(_keyword: string) { return CATALOG; }
export async function inspectService(url: string) {
  const s = CATALOG.find((c) => c.url === url) ?? CATALOG[0];
  return { url, name: s.name, description: s.description, price: s.price, method: "POST", health: "healthy", schema: {} };
}

/** Mock a paid call: return StableEnrich-shaped data for the given endpoint. */
export async function payService(url: string, data: Record<string, unknown>, _method: string) {
  const txHash = simTx();
  let response: unknown;

  // Match on the URL PATH only — the provider domain "stableenrich.dev" contains
  // the substring "enrich", which would otherwise match every endpoint.
  let path = url;
  try { path = new URL(url).pathname; } catch { /* keep raw */ }
  if (path.includes("people-search")) {
    const per = Number((data as any).per_page ?? 6);
    response = { people: PEOPLE.slice(0, Math.min(per, PEOPLE.length)) };
  } else if (path.includes("email-verifier") || path.includes("validate-emails")) {
    const email = String((data as any).email ?? "");
    const bad = /@(gmail|yahoo|hotmail|outlook)\.com$/i.test(email) || /pagaflex/i.test(email);
    response = { status: "completed", result: bad ? "undeliverable" : "deliverable", score: bad ? 0.12 : 0.97 };
  } else if (path.includes("enrich") || path.includes("clado")) {
    // Three competing enrichment services with DIFFERENT quality, so the reputation
    // layer has something real to measure:
    //   apollo / minerva → accurate corporate emails (verify as deliverable)
    //   clado            → sloppy personal-domain emails (verify as undeliverable)
    const name = String((data as any).name || "Unknown Person");
    const org = String((data as any).organization_name || (data as any).domain || "example");
    const corp = String((data as any).domain || org.toLowerCase().replace(/[^a-z]/g, "") + ".com");
    const handle = name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().replace(/ +/g, ".");
    const domain = url.includes("clado") ? "gmail.com" : corp; // clado returns weak personal emails
    response = { person: { name, title: "CTO", email: `${handle}@${domain}`, organization: { name: org } } };
  } else {
    response = { ok: true };
  }
  return { response: JSON.stringify(response), txHash, chain: "BASE" as const };
}

export async function gatewayDeposit(amount: number) {
  return { amount: String(amount), txId: simTx(), method: "direct" as const };
}
