import type { PaymentGraph as Graph } from "@/lib/intel";

// Buyer → Service → Verifier → ERC-8004, laid out as columns. Wash loops
// (e.g. service funds its own buyer) render as a red back-edge + warning.
const KIND_STYLE: Record<string, string> = {
  buyer: "border-hairline text-text",
  service: "border-gold/50 text-gold bg-gold/5",
  verifier: "border-hairline text-text",
  registry: "border-verified-dim text-verified bg-verified/5",
};

export function PaymentGraph({ graph }: { graph: Graph }) {
  const cols: Array<{ kind: string; title: string }> = [
    { kind: "buyer", title: "Buyers" },
    { kind: "service", title: "Service" },
    { kind: "verifier", title: "Verifiers" },
    { kind: "registry", title: "Registry" },
  ];

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-2">
        {cols.map((c, ci) => (
          <div key={c.kind} className="contents">
            <div className="flex flex-col gap-2">
              <span className="label !text-faint text-center">{c.title}</span>
              {graph.nodes.filter((n) => n.kind === c.kind).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-[2px] border px-2 py-2 text-center text-[12px] font-medium ${KIND_STYLE[n.kind]}`}
                >
                  {n.label}
                </div>
              ))}
              {graph.nodes.filter((n) => n.kind === c.kind).length === 0 && (
                <div className="rounded-[2px] border border-dashed border-hairline px-2 py-2 text-center text-[12px] text-faint">
                  none
                </div>
              )}
            </div>
            {ci < cols.length - 1 && <Arrow warn={c.kind === "verifier" && graph.warnings.length > 0} />}
          </div>
        ))}
      </div>

      {graph.warnings.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {graph.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-failed">
              <span aria-hidden>⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Arrow({ warn }: { warn?: boolean }) {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden className={warn ? "text-failed" : "text-faint"}>
      <path d="M0 6h18M14 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
