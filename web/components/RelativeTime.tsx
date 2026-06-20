"use client";

// Renders "12 minutes ago" on the client so static export doesn't freeze it at
// build time. Falls back to the absolute date before hydration.
import { useEffect, useState } from "react";

function rel(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function RelativeTime({ ts }: { ts: number }) {
  const [label, setLabel] = useState<string>(new Date(ts).toISOString().slice(0, 10));
  useEffect(() => {
    const tick = () => setLabel(rel(ts));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [ts]);
  return <span suppressHydrationWarning>{label}</span>;
}
