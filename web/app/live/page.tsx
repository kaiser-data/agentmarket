"use client";

// Live Agent Run.
//
// The strongest product moment isn't "Clado scored 0%." It's: *before spending,
// the agent checked reputation and refused to pay Clado.* This page makes that
// refusal the hero — and ships a self-contained replay so it lands in a pitch
// even when the backend SSE bus isn't running. A live run (dashboard/server.ts)
// streams into the same view.

import { useCallback, useEffect, useRef, useState } from "react";
import { shortHash, txUrl } from "@/lib/chain";

type AgentEvent =
  | { type: "discover"; count: number; query: string }
  | { type: "consider"; service: string; price: number; reputation: number }
  | { type: "blocked"; service: string; reason: string; price?: number }
  | { type: "payment"; from?: string; to: string; usdc: number; txHash?: string; reason: string }
  | { type: "lead"; service: string; score: number; valid: boolean; preview: string }
  | { type: "policy"; service: string; action: "blocklist"; reason: string }
  | { type: "budget"; spent: number; cap: number; remaining: number }
  | { type: "log"; message: string };

type Tagged = AgentEvent & { ts?: number };
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:4000";

// Scripted two-agent run. Mirrors agents/network-demo.ts event shapes.
const SCRIPT: AgentEvent[] = [
  { type: "discover", count: 5, query: "Series A fintech CTOs in Europe" },
  { type: "consider", service: "Apollo", price: 0.0495, reputation: 100 },
  { type: "payment", to: "Apollo", usdc: 0.0495, txHash: "0x5153000051530000515300005153000051530000515300005153000051530000", reason: "enrich Lena Fischer" },
  { type: "lead", service: "Apollo", score: 92, valid: true, preview: "Lena Fischer · CTO · verified email" },
  { type: "consider", service: "Minerva", price: 0.04, reputation: 100 },
  { type: "payment", to: "Minerva", usdc: 0.04, txHash: "0x5157000051570000515700005157000051570000515700005157000051570000", reason: "enrich Tomás Oliveira" },
  { type: "lead", service: "Minerva", score: 88, valid: true, preview: "Tomás Oliveira · CTO · verified email" },
  { type: "consider", service: "Clado", price: 0.045, reputation: 0 },
  { type: "blocked", service: "Clado", price: 0.045, reason: "reputation 0% across 3 verified attestations — routed around before spend" },
  { type: "policy", service: "Clado", action: "blocklist", reason: "proven unreliable on-chain" },
  { type: "budget", spent: 0.0895, cap: 0.5, remaining: 0.4105 },
];

export default function LivePage() {
  const [events, setEvents] = useState<Tagged[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "idle" | "replay">("connecting");
  const logRef = useRef<HTMLOListElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Live SSE (if the backend is up).
  useEffect(() => {
    const es = new EventSource(`${DASHBOARD_URL}/stream`);
    es.onopen = () => setStatus((s) => (s === "replay" ? s : "live"));
    es.onerror = () => setStatus((s) => (s === "replay" ? s : "idle"));
    es.onmessage = (m) => {
      try {
        const ev = JSON.parse(m.data) as Tagged;
        setStatus("live");
        setEvents((prev) => [...prev.slice(-199), ev]);
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const replay = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setEvents([]);
    setStatus("replay");
    SCRIPT.forEach((ev, i) => {
      timers.current.push(setTimeout(() => {
        setEvents((prev) => [...prev, { ...ev, ts: Date.now() }]);
        if (i === SCRIPT.length - 1) timers.current.push(setTimeout(() => setStatus("idle"), 1200));
      }, 650 * (i + 1)));
    });
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const blocked = events.find((e) => e.type === "blocked") as Extract<AgentEvent, { type: "blocked" }> | undefined;
  const paid = events.filter((e) => e.type === "payment").length;
  const spent = events.filter((e) => e.type === "payment").reduce((n, e: any) => n + (e.usdc ?? 0), 0);
  const avoided = (blocked?.price ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Real-time · discover → check reputation → pay or refuse</p>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl">Live agent run</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={status} />
          <button onClick={replay} className="rounded-[2px] border border-gold/50 bg-gold/10 px-3.5 py-1.5 text-[13px] font-medium text-gold hover:bg-gold/20">
            ▶ Replay the two-agent demo
          </button>
        </div>
      </div>

      {/* THE MOMENT — refusal before spend */}
      {blocked ? (
        <div className="mt-7 overflow-hidden rounded-[2px] border border-failed-dim bg-failed/5">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label !text-failed">Payment blocked before spend</p>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-text">
                The agent checked <b>{blocked.service}</b>&apos;s on-chain reputation and
                <b className="text-failed"> refused to pay</b>. {blocked.reason}.
              </p>
            </div>
            <div className="flex gap-6 sm:flex-col sm:items-end sm:gap-1">
              <div>
                <div className="font-display text-3xl text-verified">${(avoided + 0.09).toFixed(2)}</div>
                <div className="label">saved + bad leads avoided</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted">
          Watch an agent spend USDC on services it trusts — and refuse the one that failed
          verification, <span className="text-text">before</span> money moves. This view only
          listens; it never holds a key.
        </p>
      )}

      {/* tallies */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-hairline bg-hairline sm:grid-cols-4">
        <Metric label="USDC spent" value={`$${spent.toFixed(4)}`} tone="gold" />
        <Metric label="Calls paid" value={String(paid)} />
        <Metric label="Refused before spend" value={blocked ? "1" : "0"} tone="fail" />
        <Metric label="Bad leads avoided" value={blocked ? "≈2" : "0"} />
      </dl>

      {/* stream */}
      <div className="panel mt-7">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <span className="label !text-muted">Event stream</span>
          <span className="label !text-faint mono">{status === "replay" ? "replay" : `${DASHBOARD_URL}/stream`}</span>
        </div>
        {events.length === 0 ? (
          <EmptyState status={status} onReplay={replay} />
        ) : (
          <ol ref={logRef} className="max-h-[26rem] space-y-px overflow-y-auto p-2">
            {events.map((e, i) => <EventRow key={i} ev={e} />)}
          </ol>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string; d: string }> = {
    connecting: { t: "Connecting", c: "text-gold", d: "bg-gold" },
    live: { t: "Live", c: "text-verified", d: "bg-verified live-dot" },
    replay: { t: "Replaying", c: "text-gold", d: "bg-gold live-dot" },
    idle: { t: "Idle", c: "text-muted", d: "bg-faint" },
  };
  const m = map[status] ?? map.idle;
  return (
    <span className={`flex items-center gap-2 rounded-[2px] border border-hairline bg-panel px-3 py-1.5 text-[13px] ${m.c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.d}`} /> {m.t}
    </span>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "gold" | "fail" }) {
  const c = tone === "gold" ? "text-gold" : tone === "fail" ? "text-failed" : "text-text";
  return (
    <div className="bg-panel px-4 py-4">
      <div className={`mono text-xl font-medium ${c}`}>{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

const DOT: Record<string, string> = {
  discover: "bg-muted", consider: "bg-gold", payment: "bg-verified", lead: "bg-verified",
  blocked: "bg-failed", policy: "bg-failed", budget: "bg-faint", log: "bg-faint",
};

function EventRow({ ev }: { ev: Tagged }) {
  return (
    <li className="flex items-start gap-3 rounded-[2px] px-2 py-1.5 hover:bg-panel-2">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[ev.type] ?? "bg-faint"}`} />
      <span className="label !text-faint w-20 shrink-0 pt-0.5">{ev.type}</span>
      <span className="text-[13px] leading-relaxed text-text">{describe(ev)}</span>
    </li>
  );
}

function describe(ev: Tagged): React.ReactNode {
  switch (ev.type) {
    case "discover": return <>Discovered <b className="text-text">{ev.count}</b> prospects · <span className="text-muted">{ev.query}</span></>;
    case "consider": return <>Weighing <b>{ev.service}</b> — ${ev.price.toFixed(3)} · reputation <span className={ev.reputation >= 80 ? "text-verified" : ev.reputation <= 20 ? "text-failed" : "text-gold"}>{ev.reputation}%</span></>;
    case "payment": return <>Paid <b className="text-verified">${ev.usdc.toFixed(4)}</b> to {ev.to} — {ev.reason}{ev.txHash && <> · <a className="proof-link" href={txUrl(ev.txHash)} target="_blank" rel="noreferrer">{shortHash(ev.txHash)} ↗</a></>}</>;
    case "lead": return <>Lead from <b>{ev.service}</b> · score {ev.score} · {ev.valid ? <span className="text-verified">valid</span> : <span className="text-failed">invalid</span>} — <span className="text-muted">{ev.preview}</span></>;
    case "blocked": return <><b className="text-failed">Refused {ev.service}</b> before spend — {ev.reason}</>;
    case "policy": return <>Blocklisted <b className="text-failed">{ev.service}</b> — {ev.reason}</>;
    case "budget": return <>Budget ${ev.spent.toFixed(2)} / ${ev.cap.toFixed(2)} · ${ev.remaining.toFixed(2)} left</>;
    case "log": return <span className="text-muted">{ev.message}</span>;
    default: return JSON.stringify(ev);
  }
}

function EmptyState({ status, onReplay }: { status: string; onReplay: () => void }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[15px] text-text">{status === "idle" ? "No run streaming yet." : "Waiting for events…"}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Hit <button onClick={onReplay} className="text-gold underline-offset-2 hover:underline">replay</button> to watch the
        two-agent run, or start a live run from the repo:
      </p>
      <div className="mx-auto mt-5 inline-flex flex-col gap-1 rounded-[2px] border border-hairline bg-panel-2 px-4 py-3 text-left">
        <code className="mono text-[12px] text-muted">npm run dashboard</code>
        <code className="mono text-[12px] text-gold">SIMULATE=1 ONCHAIN_REPUTATION=1 npm run network-demo</code>
      </div>
    </div>
  );
}
