"use client";

// THE SIGNATURE ELEMENT.
//
// A score is not a claim here — it's the sum of its evidence. Each segment is
// one real on-chain attestation (green = pass, red = fail). Hover to inspect
// its pay/verify/feedback transactions; click to open the proof on BaseScan.
// "Reputation you can't fake" made structural, not stated.

import { useState } from "react";
import type { Attestation } from "@/lib/data";
import { txUrl, shortHash } from "@/lib/chain";

export function ProvenanceBar({
  attestations,
  size = "md",
}: {
  attestations: Attestation[];
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState<number | null>(null);
  const h = size === "sm" ? "h-6" : "h-9";

  if (attestations.length === 0) {
    return (
      <div className={`flex ${h} items-center gap-1`}>
        <span className="label !text-faint">no attestations yet</span>
      </div>
    );
  }

  return (
    <div className={`flex ${h} items-stretch gap-[3px]`} role="list" aria-label="On-chain attestations">
      {attestations.map((a, i) => {
        const pass = a.outcome === "pass";
        return (
          <a
            key={a.onchainTx + i}
            href={txUrl(a.onchainTx)}
            target="_blank"
            rel="noreferrer"
            role="listitem"
            aria-label={`Attestation ${i + 1}: ${a.outcome}. Open on BaseScan.`}
            onMouseEnter={() => setOpen(i)}
            onMouseLeave={() => setOpen((c) => (c === i ? null : c))}
            onFocus={() => setOpen(i)}
            onBlur={() => setOpen((c) => (c === i ? null : c))}
            className="group relative flex-1 min-w-[10px] rounded-[1px] transition-transform duration-150 hover:-translate-y-0.5"
            style={{
              background: pass ? "var(--color-verified)" : "var(--color-failed)",
              boxShadow: `0 0 0 1px ${pass ? "var(--color-verified-dim)" : "var(--color-failed-dim)"} inset`,
            }}
          >
            {open === i && <Tooltip a={a} index={i} pass={pass} />}
          </a>
        );
      })}
    </div>
  );
}

function Tooltip({ a, index, pass }: { a: Attestation; index: number; pass: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2">
      <div className="panel !bg-panel-2 px-3 py-2.5 shadow-xl shadow-black/50">
        <div className="flex items-center justify-between">
          <span className="label !text-faint">Attestation #{index + 1}</span>
          <span className={`label ${pass ? "!text-verified" : "!text-failed"}`}>
            {pass ? "PASS" : "FAIL"}
          </span>
        </div>
        <dl className="mt-2 space-y-1 text-[11px]">
          <Row k="pay" v={shortHash(a.payTx)} />
          <Row k="verify" v={shortHash(a.verifyTx)} />
          <Row k="feedback" v={shortHash(a.onchainTx)} />
        </dl>
        <div className="mt-2 border-t border-hairline pt-1.5 label !text-gold">
          open on basescan →
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-faint">{k}</span>
      <span className="mono text-muted">{v}</span>
    </div>
  );
}
