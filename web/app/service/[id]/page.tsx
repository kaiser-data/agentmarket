import { notFound } from "next/navigation";
import Link from "next/link";
import { getServices, getService, getVerifierStats } from "@/lib/data";
import { paymentGraph } from "@/lib/intel";
import { CategoryBadge, RiskBadge, SourceBadge, StrengthBadge, QualityMeter } from "@/components/badges";
import { ProvenanceBar } from "@/components/ProvenanceBar";
import { PaymentGraph } from "@/components/PaymentGraph";
import { RelativeTime } from "@/components/RelativeTime";
import { tokenUrl, txUrl, addrUrl, shortHash } from "@/lib/chain";

export function generateStaticParams() {
  return getServices().map((s) => ({ id: s.id }));
}

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getService(id);
  if (!s) notFound();

  const graph = paymentGraph(s);
  const qColor = s.quality >= 80 ? "text-verified" : s.quality <= 20 ? "text-failed" : "text-gold";

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/" className="proof-link text-[13px]">← All services</Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl sm:text-4xl">{s.name}</h1>
            <SourceBadge source={s.source} />
          </div>
          <p className="mt-1 text-[15px] text-muted">{s.capability}</p>
          <p className="mono mt-1 text-[12px] text-faint">{s.endpoint}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CategoryBadge category={s.category} className="!text-[12px] !px-2.5 !py-1" />
          {s.agentId ? (
            <a href={tokenUrl(s.agentId)} target="_blank" rel="noreferrer" className="proof-link mono text-[12px]">
              ERC-721 #{s.agentId} ↗
            </a>
          ) : (
            <span className="mono text-[12px] text-faint">no identity minted</span>
          )}
        </div>
      </div>

      {/* Simulated scenario — make it impossible to miss (#3) */}
      {s.source === "simulated" && (
        <div className="mt-5 rounded-[2px] border border-gold-dim bg-gold/5 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-gold">
            <b>Simulated scenario.</b> {s.id === "helix-signals" ? "Demonstrates wash-trading detection — a high pass rate manufactured through a circular buyer/verifier loop." : "Demonstrates an unproven service with no verified history."} Not an on-chain score; no real attestations exist.
          </p>
        </div>
      )}

      {/* One-sentence verdict (#2) */}
      <div className="mt-5 flex items-start gap-3 rounded-[2px] border border-hairline bg-panel-2 px-4 py-3.5">
        <span className="label !text-faint mt-0.5 shrink-0">Verdict</span>
        <p className="text-[15px] leading-relaxed text-text">{s.verdictLine}</p>
      </div>

      {/* Two scores */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <div className="flex items-baseline justify-between">
            <span className="label">Quality Score</span>
            <span className="label !text-faint">verified pass rate</span>
          </div>
          <div className={`font-display mt-2 text-5xl ${qColor}`}>{s.count ? `${s.quality}%` : "—"}</div>
          <QualityMeter value={s.quality} className="mt-3" />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StrengthBadge strength={s.strength} />
            <span className="text-[12px] text-muted">{s.passes} passed · {s.fails} failed · {s.count} attestations</span>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            {s.lastTs ? <>Last verified <RelativeTime ts={s.lastTs} /> · reputation window: last 30 days</> : "No verified history yet"}
          </p>
        </div>
        <div className="panel p-5">
          <div className="flex items-baseline justify-between">
            <span className="label">Wash Risk</span>
            <span className="label !text-faint">manufactured-reputation likelihood</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-display text-5xl text-text">{s.wash.level === "na" ? "—" : `${s.wash.score}`}</span>
            <RiskBadge level={s.wash.level} className="!text-[12px] !px-2.5 !py-1" />
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {s.buyers.length} independent buyer{s.buyers.length === 1 ? "" : "s"} ·{" "}
            {s.verifiers.length} verifier{s.verifiers.length === 1 ? "" : "s"} ·{" "}
            {s.wash.signals.circularPayment ? "circular loop detected" : "no circular loop"}
          </p>
        </div>
      </div>

      {/* Why this verdict (#3) */}
      <Section title={s.category === "trusted" ? "Why this service is trusted" : "Why this verdict"}>
        <ul className="space-y-2.5">
          {s.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px]">
              <span className={`mt-0.5 ${r.ok ? "text-verified" : "text-failed"}`} aria-hidden>
                {r.ok ? "✓" : "✕"}
              </span>
              <span className={r.ok ? "text-text" : "text-text"}>{r.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Recommended wallet policy (#7) */}
      <Section title="Recommended wallet policy">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex gap-6">
            <Stat k="Max spend" v={s.policy.maxSpend} />
            <Stat k="Verification" v={s.policy.requireVerification ? "Required" : "Off"} />
          </div>
          <p className="text-[13px] leading-relaxed text-muted sm:border-l sm:border-hairline sm:pl-4">
            {s.policy.note}
          </p>
        </div>
        {s.nextStep && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[2px] border border-gold-dim bg-gold/5 px-3.5 py-2.5">
            <span className="text-gold" aria-hidden>→</span>
            <p className="text-[13px] leading-relaxed text-gold"><b>Recommended next step:</b> {s.nextStep}</p>
          </div>
        )}
      </Section>

      {/* Payment graph (#9) */}
      <Section title="Payment graph">
        <PaymentGraph graph={graph} />
      </Section>

      {/* Verifiers (#8) — verification isn't blindly trusted */}
      <Section title="Verifiers">
        {s.verifiers.length === 0 ? (
          <p className="text-[13px] text-faint">No verifier on record yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {s.verifiers.map((v) => {
              const vs = getVerifierStats(v.id);
              const conflictColor = vs.conflictRisk === "Low" ? "text-verified" : vs.conflictRisk === "Elevated" ? "text-failed" : "text-gold";
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                  <div className="min-w-0">
                    <span className="text-[14px] text-text">{v.label}</span>
                    {v.note && <span className="ml-2 text-[12px] text-muted">{v.note}</span>}
                  </div>
                  <div className="flex items-center gap-5">
                    <VStat k="Trust" v={vs.trust} cls={vs.trust === "Established" ? "text-verified" : "text-gold"} />
                    <VStat k="Coverage" v={`${vs.coverage} service${vs.coverage === 1 ? "" : "s"}`} cls="text-text" />
                    <VStat k="Conflict" v={vs.conflictRisk} cls={conflictColor} />
                    <a href={addrUrl(v.address)} target="_blank" rel="noreferrer" className="proof-link mono text-[12px]">
                      {shortHash(v.address)} ↗
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Data provenance (#10) — be explicit about what's real vs modeled */}
      <Section title="Data provenance">
        <p className="text-[13px] leading-relaxed text-muted">
          On-chain receipts (payment, verification, and attestation transactions) are{" "}
          <span className="text-verified">real</span> and link to BaseScan. Actor clustering —
          which buyers and verifiers share a funding root — is currently{" "}
          <span className="text-gold">modeled for the demo</span>; in production the wash-risk
          engine reads funding roots from each transaction&apos;s sender over a public RPC. The
          scoring math is identical either way.
        </p>
      </Section>

      {/* Evidence breakdown (#2) */}
      <Section title="Evidence breakdown">
        <div className="mb-3">
          <ProvenanceBar attestations={s.attestations} />
        </div>
        {s.attestations.length === 0 ? (
          <p className="text-[13px] text-faint">No attestations yet — this service is unproven.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {["outcome", "pay tx", "verify tx", "attest tx", "buyer", "independent", "time"].map((h) => (
                    <th key={h} className="label !text-faint py-2 pr-4 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.attestations.map((a, i) => {
                  const pass = a.outcome === "pass";
                  const buyer = s.buyers[i % Math.max(1, s.buyers.length)];
                  const independent = s.source === "on-chain" && !s.wash.signals.circularPayment;
                  return (
                    <tr key={a.onchainTx + i} className="border-b border-hairline-soft last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className={`text-[12px] font-medium ${pass ? "text-verified" : "text-failed"}`}>
                          {pass ? "PASS" : "FAIL"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4"><Tx h={a.payTx} sim={s.source === "simulated"} /></td>
                      <td className="py-2.5 pr-4"><Tx h={a.verifyTx} sim={s.source === "simulated"} /></td>
                      <td className="py-2.5 pr-4"><Tx h={a.onchainTx} sim={s.source === "simulated"} /></td>
                      <td className="py-2.5 pr-4 mono text-[12px] text-muted">{buyer?.label ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-[12px] ${independent ? "text-verified" : "text-failed"}`}>
                          {independent ? "yes" : "no"}
                        </span>
                      </td>
                      <td className="py-2.5 mono text-[12px] text-faint">{new Date(a.ts).toISOString().slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel mt-5 p-5">
      <h2 className="label !text-muted mb-3.5">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="mono text-[15px] font-medium text-text">{v}</div>
      <div className="label mt-0.5">{k}</div>
    </div>
  );
}

function VStat({ k, v, cls }: { k: string; v: string; cls: string }) {
  return (
    <div className="text-right">
      <div className={`text-[13px] font-medium ${cls}`}>{v}</div>
      <div className="label mt-0.5 !text-faint">{k}</div>
    </div>
  );
}

function Tx({ h, sim }: { h: string; sim?: boolean }) {
  if (sim) return <span className="mono text-[12px] text-faint">{shortHash(h)}</span>;
  return (
    <a href={txUrl(h)} target="_blank" rel="noreferrer" className="proof-link mono text-[12px]">
      {shortHash(h)} ↗
    </a>
  );
}
