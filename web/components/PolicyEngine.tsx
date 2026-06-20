"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Service } from "@/lib/intel";
import { CategoryBadge, RiskBadge } from "@/components/badges";

interface Policy {
  minQuality: number;
  maxWashRisk: number;
  minAttestations: number;
  requireKnownVerifier: boolean;
  trialUnknown: boolean; // allow a capped trial for unproven services
  maxTrial: number;
}

const DEFAULT: Policy = {
  minQuality: 80,
  maxWashRisk: 40,
  minAttestations: 3,
  requireKnownVerifier: true,
  trialUnknown: true,
  maxTrial: 0.02,
};

type Decision = { verdict: "pay" | "trial" | "refuse"; reason: string; allowance: string };

function decide(s: Service, p: Policy): Decision {
  if (s.count === 0) {
    return p.trialUnknown
      ? { verdict: "trial", reason: "Unproven — cleared for a capped trial to earn its first attestation.", allowance: `$${p.maxTrial.toFixed(2)} trial` }
      : { verdict: "refuse", reason: "Unproven and trials are disabled.", allowance: "$0.00" };
  }
  if (s.quality < p.minQuality)
    return { verdict: "refuse", reason: `Quality ${s.quality}% is below your ${p.minQuality}% floor.`, allowance: "$0.00" };
  if (s.wash.score > p.maxWashRisk)
    return { verdict: "refuse", reason: `Wash risk ${s.wash.score} exceeds your ${p.maxWashRisk} ceiling — reputation looks manufactured.`, allowance: "$0.00" };
  if (s.count < p.minAttestations)
    return { verdict: "refuse", reason: `Only ${s.count} attestations — below your minimum of ${p.minAttestations}.`, allowance: "$0.00" };
  if (p.requireKnownVerifier && s.verifiers.length === 0)
    return { verdict: "refuse", reason: "No known verifier on record.", allowance: "$0.00" };
  return { verdict: "pay", reason: "Clears every rule — quality high, wash risk low, independently verified.", allowance: s.policy.maxSpend };
}

export function PolicyEngine({ services }: { services: Service[] }) {
  const [p, setP] = useState<Policy>(DEFAULT);
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setP((c) => ({ ...c, [k]: v }));

  const rows = useMemo(() => services.map((s) => ({ s, d: decide(s, p) })), [services, p]);
  const counts = rows.reduce(
    (acc, r) => ((acc[r.d.verdict]++), acc),
    { pay: 0, trial: 0, refuse: 0 } as Record<Decision["verdict"], number>,
  );

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_1fr]">
      {/* Controls */}
      <div className="panel h-fit p-5">
        <h2 className="label !text-muted mb-4">Wallet rules</h2>
        <Slider label="Min quality score" value={p.minQuality} suffix="%" onChange={(v) => set("minQuality", v)} />
        <Slider label="Max wash risk" value={p.maxWashRisk} onChange={(v) => set("maxWashRisk", v)} />
        <Stepper label="Min attestations" value={p.minAttestations} onChange={(v) => set("minAttestations", Math.max(0, v))} />
        <Toggle label="Require a known verifier" value={p.requireKnownVerifier} onChange={(v) => set("requireKnownVerifier", v)} />
        <Toggle label="Allow capped trial for unknown" value={p.trialUnknown} onChange={(v) => set("trialUnknown", v)} />
        {p.trialUnknown && (
          <Slider label="Max trial spend" value={Math.round(p.maxTrial * 100)} suffix="¢" min={0} max={10} onChange={(v) => set("maxTrial", v / 100)} />
        )}
        <button
          onClick={() => setP(DEFAULT)}
          className="mt-4 w-full rounded-[2px] border border-hairline px-3 py-1.5 text-[13px] text-muted hover:text-text hover:border-faint"
        >
          Reset to defaults
        </button>

        <PolicyExport policy={p} />
      </div>

      {/* Decisions */}
      <div>
        <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-hairline bg-hairline">
          <Tally label="Pay" n={counts.pay} tone="text-verified" />
          <Tally label="Trial" n={counts.trial} tone="text-gold" />
          <Tally label="Refuse" n={counts.refuse} tone="text-failed" />
        </div>

        <ul className="panel divide-y divide-hairline">
          {rows.map(({ s, d }) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <Verdict d={d} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/service/${s.id}`} className="text-[14px] font-medium text-text hover:text-gold">{s.name}</Link>
                  <CategoryBadge category={s.category} />
                  <RiskBadge level={s.wash.level} />
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{d.reason}</p>
              </div>
              <span className="mono text-[13px] text-text">{d.allowance}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Exportable config (#8) — the rule an agent wallet could actually enforce.
function PolicyExport({ policy }: { policy: Policy }) {
  const [copied, setCopied] = useState(false);
  const config = {
    minQuality: policy.minQuality,
    maxWashRisk: policy.maxWashRisk,
    minAttestations: policy.minAttestations,
    requireKnownVerifier: policy.requireKnownVerifier,
    trialUnknownMaxUsdc: policy.trialUnknown ? policy.maxTrial : 0,
  };
  const json = JSON.stringify(config, null, 2);
  const copy = () => {
    navigator.clipboard?.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="label !text-faint">Enforceable policy</span>
        <button onClick={copy} className="text-[12px] text-gold hover:underline">
          {copied ? "copied ✓" : "copy JSON"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-[2px] border border-hairline bg-panel-2 p-3 text-[11.5px] leading-relaxed text-muted">
        <code className="mono">{json}</code>
      </pre>
      <p className="mt-1.5 text-[11px] text-faint">Hand this to an agent wallet to gate spend before it pays.</p>
    </div>
  );
}

function Verdict({ d }: { d: Decision }) {
  const map = {
    pay: { t: "PAY", c: "text-verified border-verified-dim bg-verified/5" },
    trial: { t: "TRIAL", c: "text-gold border-gold-dim bg-gold/5" },
    refuse: { t: "REFUSE", c: "text-failed border-failed-dim bg-failed/5" },
  }[d.verdict];
  return <span className={`w-16 shrink-0 rounded-[2px] border py-1 text-center text-[11px] font-semibold ${map.c}`}>{map.t}</span>;
}

function Tally({ label, n, tone }: { label: string; n: number; tone: string }) {
  return (
    <div className="bg-panel px-4 py-3 text-center">
      <div className={`font-display text-2xl ${tone}`}>{n}</div>
      <div className="label mt-0.5">{label}</div>
    </div>
  );
}

function Slider({ label, value, onChange, suffix = "", min = 0, max = 100 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number }) {
  return (
    <label className="mb-4 block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="mono text-[13px] text-gold">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
    </label>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(value - 1)} className="h-6 w-6 rounded-[2px] border border-hairline text-muted hover:text-text">−</button>
        <span className="mono w-5 text-center text-[13px] text-text">{value}</span>
        <button onClick={() => onChange(value + 1)} className="h-6 w-6 rounded-[2px] border border-hairline text-muted hover:text-text">+</button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="mb-4 flex w-full items-center justify-between text-left">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-verified/30" : "bg-panel-2 border border-hairline"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${value ? "left-4 bg-verified" : "left-0.5 bg-faint"}`} />
      </span>
    </button>
  );
}
