"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";

const ROUTES = [
  { href: "/", label: "Trust Explorer" },
  { href: "/policy", label: "Policy Engine" },
  { href: "/live", label: "Live Run" },
  { href: "/feed", label: "Feed" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* Themis holds the scales — the product weighs evidence and renders a verdict. */}
          <span className="grid h-6 w-6 place-items-center rounded-[2px] border border-gold/50 bg-gold/10 text-gold">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v17M7 20h10M5 7h14M12 5l-7 2 2.4 4.5a2.6 2.6 0 0 1-4.8 0L5 7M12 5l7 2-2.4 4.5a2.6 2.6 0 0 0 4.8 0L19 7" />
            </svg>
          </span>
          <span className="font-display text-sm tracking-tight text-text">{BRAND.name}<span className="text-gold">·</span></span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {ROUTES.map((r) => {
            const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-[2px] px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-panel text-text"
                    : "text-muted hover:text-text hover:bg-panel/60"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
