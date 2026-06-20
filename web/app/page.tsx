import Link from "next/link";
import { getServices, getTotals } from "@/lib/data";
import { type Service } from "@/lib/intel";
import { ProvenanceBar } from "@/components/ProvenanceBar";
import { CategoryBadge, RiskBadge, SourceBadge, StrengthBadge, QualityMeter } from "@/components/badges";
import { tokenUrl } from "@/lib/chain";
import { BRAND } from "@/lib/brand";

export default function TrustExplorer() {
  const services = getServices();
  const totals = getTotals();

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-16 sm:pt-20">
          <p className="label">{BRAND.name} · {BRAND.tagline} · ERC-8004 · Base</p>
          <h1 className="font-display mt-4 max-w-4xl text-4xl leading-[1.05] sm:text-6xl">
            Who your agent<br />should pay — and<br />
            <span className="text-gold">who to avoid.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
            Payment proves the interaction <span className="text-text">happened</span>.
            Verification proves whether it was <span className="text-text">good</span>.
            Reputation binds both — and we score them separately, so manufactured
            reputation has nowhere to hide.
          </p>
          <p className="mt-4 max-w-2xl border-l-2 border-gold-dim pl-3 text-[13px] leading-relaxed text-faint">
            {BRAND.notReviews}
          </p>

          <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4">
            <Stat value={totals.attestations} label="verified attestations" />
            <Stat value={totals.onchain} label="on-chain identities (ERC-721)" />
            <Stat value="$0.02–0.05" label="USDC per verified call" mono />
          </dl>
        </div>
      </section>

      {/* ── Console ── */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="label !text-muted">Services · ranked by trust</h2>
          <Link href="/policy" className="proof-link text-[13px] !text-gold">
            Run the wallet policy engine →
          </Link>
        </div>

        {/* column header */}
        <div className="panel overflow-hidden">
          <div className="hidden grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1.4fr)_7rem_7rem_auto] items-center gap-4 border-b border-hairline px-4 py-2.5 lg:grid">
            <span className="label !text-faint">#</span>
            <span className="label !text-faint">service</span>
            <span className="label !text-faint">evidence</span>
            <span className="label !text-faint">quality</span>
            <span className="label !text-faint">wash risk</span>
            <span className="label !text-faint text-right">verdict</span>
          </div>

          <ol className="divide-y divide-hairline">
            {services.map((s, i) => (
              <ServiceRow key={s.id} service={s} rank={i + 1} />
            ))}
          </ol>
        </div>

        <Legend />
      </section>
    </div>
  );
}

function Stat({ value, label, mono }: { value: number | string; label: string; mono?: boolean }) {
  return (
    <div>
      <dd className={mono ? "mono text-2xl font-medium text-text" : "font-display text-2xl text-text"}>{value}</dd>
      <dt className="label mt-0.5">{label}</dt>
    </div>
  );
}

function ServiceRow({ service: s, rank }: { service: Service; rank: number }) {
  const qColor = s.quality >= 80 ? "text-verified" : s.quality <= 20 ? "text-failed" : "text-gold";

  return (
    <li className="grid grid-cols-2 items-center gap-x-4 gap-y-3 px-4 py-5 lg:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1.4fr)_7rem_7rem_auto] lg:gap-x-4">
      <span className="font-display text-lg text-faint lg:order-none">{String(rank).padStart(2, "0")}</span>

      {/* identity */}
      <div className="order-2 col-span-2 min-w-0 lg:order-none lg:col-span-1">
        <div className="flex items-center gap-2">
          <Link href={`/service/${s.id}`} className="truncate text-[15px] font-semibold text-text hover:text-gold">
            {s.name}
          </Link>
          <SourceBadge source={s.source} />
        </div>
        <p className="truncate text-[13px] text-muted">{s.capability}</p>
        {s.agentId ? (
          <a href={tokenUrl(s.agentId)} target="_blank" rel="noreferrer" className="proof-link mono mt-1 inline-flex items-center gap-1 text-[11px]">
            ERC-721 #{s.agentId} <span aria-hidden>↗</span>
          </a>
        ) : (
          <span className="mono mt-1 inline-block text-[11px] text-faint">no identity minted</span>
        )}
      </div>

      {/* evidence */}
      <div className="order-3 col-span-2 lg:order-none lg:col-span-1">
        <ProvenanceBar attestations={s.attestations} size="sm" />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="label !text-verified">{s.passes} pass</span>
          {s.fails > 0 && <span className="label !text-failed">{s.fails} fail</span>}
          <span className="label !text-faint">
            {s.buyers.length} buyer{s.buyers.length === 1 ? "" : "s"} · {s.verifiers.length} verifier{s.verifiers.length === 1 ? "" : "s"}
          </span>
          <StrengthBadge strength={s.strength} />
        </div>
      </div>

      {/* quality */}
      <div className="order-4 lg:order-none">
        <div className={`mono text-xl font-medium ${qColor}`}>{s.count ? `${s.quality}%` : "—"}</div>
        <QualityMeter value={s.quality} className="mt-1.5 w-16" />
      </div>

      {/* wash risk */}
      <div className="order-5 lg:order-none">
        <RiskBadge level={s.wash.level} />
      </div>

      {/* verdict */}
      <div className="order-6 flex items-center justify-end gap-2 lg:order-none">
        <Link href={`/service/${s.id}`} className="flex flex-col items-end gap-1.5">
          <CategoryBadge category={s.category} />
          <span className="label !text-faint hidden sm:inline">inspect →</span>
        </Link>
      </div>
    </li>
  );
}

function Legend() {
  const items = [
    { c: "trusted", d: "verified, diverse buyers, no wash signals" },
    { c: "unproven", d: "too little evidence yet — trial cautiously" },
    { c: "suspicious", d: "high score, but reputation looks manufactured" },
    { c: "unreliable", d: "proven to fail independent verification" },
  ] as const;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.c} className="panel !bg-panel-2 px-3 py-2.5">
          <CategoryBadge category={it.c} />
          <p className="mt-1.5 text-[12px] leading-snug text-muted">{it.d}</p>
        </div>
      ))}
    </div>
  );
}
