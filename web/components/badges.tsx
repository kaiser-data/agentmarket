import { CATEGORY_META, RISK_META, STRENGTH_META, type Category, type RiskLevel, type Strength } from "@/lib/intel";

const TONE: Record<string, string> = {
  good: "text-verified border-verified-dim bg-verified/5",
  warn: "text-gold border-gold-dim bg-gold/5",
  risk: "text-orange-300 border-orange-900 bg-orange-500/5",
  bad: "text-failed border-failed-dim bg-failed/5",
  muted: "text-muted border-hairline bg-panel-2",
};

export function CategoryBadge({ category, className = "" }: { category: Category; className?: string }) {
  const m = CATEGORY_META[category];
  return (
    <span className={`inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[11px] font-medium ${TONE[m.tone]} ${className}`}>
      {m.label}
    </span>
  );
}

export function RiskBadge({ level, className = "" }: { level: RiskLevel; className?: string }) {
  const m = RISK_META[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 text-[11px] font-medium ${TONE[m.tone]} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
      {m.label}
    </span>
  );
}

export function StrengthBadge({ strength, className = "" }: { strength: Strength; className?: string }) {
  const m = STRENGTH_META[strength];
  const dots = strength === "high" ? 3 : strength === "medium" ? 2 : 1;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 text-[11px] font-medium ${TONE[m.tone]} ${className}`} title={`Evidence strength: ${m.label}`}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-0.5 rounded-full" style={{ background: i < dots ? "currentColor" : "var(--color-hairline)" }} />
        ))}
      </span>
      {m.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: "on-chain" | "simulated" }) {
  return source === "on-chain" ? (
    <span className="label !text-verified !tracking-[0.14em]" title="Backed by real receipts on Base Sepolia">
      ⛓ on-chain
    </span>
  ) : (
    <span
      className="label !text-faint !tracking-[0.14em]"
      title="Illustrative only — not written on-chain. Shown so every trust category is legible."
    >
      ◷ simulated
    </span>
  );
}

// Quality as a thin meter, color keyed to the value.
export function QualityMeter({ value, className = "" }: { value: number; className?: string }) {
  const color = value >= 80 ? "var(--color-verified)" : value <= 20 ? "var(--color-failed)" : "var(--color-gold)";
  return (
    <div className={className}>
      <div className="h-1 w-full overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
