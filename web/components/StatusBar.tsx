// Persistent on-chain status bar — Bloomberg DNA, but every field is true.
import { CHAIN, addrUrl, shortHash } from "@/lib/chain";
import { getTotals } from "@/lib/data";

export function StatusBar() {
  const totals = getTotals();
  return (
    <div className="border-b border-hairline bg-panel-2/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-x-5 gap-y-1 overflow-x-auto whitespace-nowrap px-5 py-1.5">
        <span className="flex items-center gap-1.5 label !text-verified">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-verified" />
          {CHAIN.name}
        </span>
        <Field label="Reputation">
          <a className="proof-link mono" href={addrUrl(CHAIN.reputation)} target="_blank" rel="noreferrer">
            {shortHash(CHAIN.reputation)}
          </a>
        </Field>
        <Field label="Identity">
          <a className="proof-link mono" href={addrUrl(CHAIN.identity)} target="_blank" rel="noreferrer">
            {shortHash(CHAIN.identity)}
          </a>
        </Field>
        <Field label="Attestations">
          <span className="mono text-text">{totals.attestations}</span>
        </Field>
        <Field label="Verified">
          <span className="mono text-verified">{totals.passes}</span>
          <span className="text-faint"> / </span>
          <span className="mono text-failed">{totals.fails}</span>
        </Field>
        <span className="ml-auto label !text-faint hidden sm:inline">tag · {CHAIN.tag}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="label !text-faint">{label}</span>
      <span className="text-xs">{children}</span>
    </span>
  );
}
