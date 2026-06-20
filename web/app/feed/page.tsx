import { getAttestations } from "@/lib/data";
import { txUrl, addrUrl, shortHash } from "@/lib/chain";

export default function FeedPage() {
  const feed = getAttestations();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="label">Verifiable log · ERC-8004 giveFeedback</p>
      <h1 className="font-display mt-3 text-3xl sm:text-4xl">Attestation feed</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
        Every row is one on-chain attestation: the payment that bought the call, the
        independent verification, and the feedback written to Base. All clickable.
        Nothing here is editable — that&apos;s the point.
      </p>

      <div className="panel mt-8 overflow-hidden">
        {/* header */}
        <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-hairline px-4 py-2.5 sm:grid">
          <span className="label !text-faint">outcome</span>
          <span className="label !text-faint">service</span>
          <span className="label !text-faint">pay tx</span>
          <span className="label !text-faint">verify tx</span>
          <span className="label !text-faint text-right">feedback tx</span>
        </div>

        <ul className="divide-y divide-hairline">
          {feed.map((a, i) => {
            const pass = a.outcome === "pass";
            return (
              <li
                key={a.onchainTx + i}
                className="grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:grid-cols-[auto_1fr_auto_auto_auto]"
              >
                <span
                  className={`flex items-center gap-2 text-[13px] font-medium ${pass ? "text-verified" : "text-failed"}`}
                >
                  <span className="h-2 w-2 rounded-[1px]" style={{ background: "currentColor" }} />
                  {pass ? "PASS" : "FAIL"}
                </span>

                <div className="min-w-0 text-right sm:text-left">
                  <span className="text-[14px] text-text">{a.service.name}</span>{" "}
                  <a
                    href={addrUrl(a.attester)}
                    target="_blank"
                    rel="noreferrer"
                    className="proof-link mono text-[11px]"
                  >
                    by {shortHash(a.attester)}
                  </a>
                </div>

                <TxLink href={txUrl(a.payTx)} hash={a.payTx} k="pay" />
                <TxLink href={txUrl(a.verifyTx)} hash={a.verifyTx} k="verify" />
                <div className="text-right">
                  <TxLink href={a.explorer || txUrl(a.onchainTx)} hash={a.onchainTx} k="feedback" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TxLink({ href, hash, k }: { href: string; hash: string; k: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="proof-link mono inline-flex items-center gap-1 text-[12px]">
      <span className="text-faint sm:hidden">{k} </span>
      {shortHash(hash)} <span aria-hidden>↗</span>
    </a>
  );
}
