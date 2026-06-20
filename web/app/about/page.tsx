import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { CHAIN, addrUrl } from "@/lib/chain";

export const metadata = { title: `About — ${BRAND.name}` };

const BOUNTIES = [
  {
    tag: "Primary",
    sponsor: "Circle — Agentic Commerce",
    prize: "$1,000 · 1st place",
    fit: "The agent pays real x402 nanopayments in USDC from a Circle Agent Wallet (MPC, keyless — the model proposes, Circle signs behind an on-chain policy). Gas-abstracted, sub-cent settlement per verified call.",
    tone: "good",
  },
  {
    tag: "Primary",
    sponsor: "Agent Infrastructure — ERC-8004",
    prize: "Reputation & verifiable logs",
    fit: "Identities are ERC-721 tokens; reputation is real giveFeedback attestations read back via getSummary/getClients. Themis is the missing trust + monitoring layer on top: quality vs wash-risk scoring, verifiable attestation feed, policy engine.",
    tone: "good",
  },
  {
    tag: "Sponsor",
    sponsor: "Nebius TokenFactory",
    prize: "$500 ×2 · best use",
    fit: "The agent brain runs on Nebius (DeepSeek-V3.2 via TokenFactory) for tool-calling — discover, decide, cross-verify. Free open-model inference keeps the agent loop running at zero marginal cost.",
    tone: "warn",
  },
  {
    tag: "Sponsor",
    sponsor: "Tavily",
    prize: "$500 · best use",
    fit: "Tavily powers prospect discovery — the first step of every run, before the agent decides which paid service to trust with the enrichment.",
    tone: "warn",
  },
  {
    tag: "Bonus",
    sponsor: "Blockchain for Good",
    prize: "$500 · social impact",
    fit: "A trillion-dollar agent economy needs fraud resistance to be safe. Themis makes reputation Sybil-resistant by requiring paid interactions, independent verification, and wash-risk analysis — protecting buyers from wash-traded trust.",
    tone: "risk",
  },
];

const TONE: Record<string, string> = {
  good: "border-verified-dim", warn: "border-gold-dim", risk: "border-failed-dim",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="label">About · {BRAND.name}</p>
      <h1 className="font-display mt-3 text-3xl sm:text-5xl">A trust &amp; policy layer for autonomous agent commerce.</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        Before an agent pays an unknown service, Themis tells the wallet whether to{" "}
        <span className="text-verified">pay</span>, <span className="text-gold">trial</span>, or{" "}
        <span className="text-failed">refuse</span> — and why.
      </p>

      {/* Thesis — the four-part chain, hard to attack */}
      <div className="panel mt-8 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Pillar n="Payment" t="proves it happened" d="A real USDC nanopayment settles on-chain. The interaction is not hypothetical." />
          <Pillar n="Verification" t="proves it was good" d="A second, independent agent checks the output. Cross-verification, not self-report." />
          <Pillar n="Wash-risk" t="asks if it was earned" d="Circular payments, exclusive verifiers, and thin buyer diversity flag reputation that was manufactured." />
          <Pillar n="Policy" t="decides the spend" d="The verdict becomes an enforceable rule: pay, trial, or refuse — before a cent moves." />
        </div>
        <p className="mt-5 border-t border-hairline pt-4 text-[14px] leading-relaxed text-muted">
          We never claim &ldquo;payment proves quality&rdquo; — that&apos;s attackable.{" "}
          <span className="text-text">Payment proves the interaction happened. Verification proves
          whether it was good. Wash-risk analysis asks whether the reputation was honestly earned.
          The wallet policy decides whether to spend.</span> That makes reputation Sybil-resistant by
          requiring paid interactions, independent verification, and wash-risk analysis — not by
          assertion.
        </p>
      </div>

      {/* Bounties */}
      <h2 className="font-display mt-12 text-2xl">Bounty submission</h2>
      <p className="mt-2 text-[14px] text-muted">Agents Hackathon 2026 · 42berlin · what this project is submitting for, and why it fits.</p>
      <ul className="mt-5 space-y-3">
        {BOUNTIES.map((b) => (
          <li key={b.sponsor} className={`panel border-l-2 p-5 ${TONE[b.tone]}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="label !text-faint">{b.tag}</span>
                <h3 className="text-[15px] font-semibold text-text">{b.sponsor}</h3>
              </div>
              <span className="mono text-[13px] text-gold">{b.prize}</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{b.fit}</p>
          </li>
        ))}
      </ul>

      {/* On-chain proof */}
      <h2 className="font-display mt-12 text-2xl">Verify it yourself</h2>
      <div className="panel mt-4 divide-y divide-hairline">
        <Fact k="Network" v={CHAIN.name} />
        <Fact k="ReputationRegistry" v={CHAIN.reputation} href={addrUrl(CHAIN.reputation)} />
        <Fact k="IdentityRegistry (ERC-721)" v={CHAIN.identity} href={addrUrl(CHAIN.identity)} />
        <Fact k="Attestation tag" v={CHAIN.tag} />
      </div>
      <p className="mt-4 text-[13px] text-faint">
        Don&apos;t trust us — every score on the{" "}
        <Link href="/" className="text-gold hover:underline">explorer</Link> links to its
        transactions on BaseScan.
      </p>
    </div>
  );
}

function Pillar({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div>
      <div className="font-display text-[15px] text-gold">{n}</div>
      <div className="text-[13px] font-medium text-text">{t}</div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{d}</p>
    </div>
  );
}

function Fact({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="label !text-faint">{k}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="proof-link mono text-[12px]">{v} ↗</a>
      ) : (
        <span className="mono text-[12px] text-muted">{v}</span>
      )}
    </div>
  );
}
