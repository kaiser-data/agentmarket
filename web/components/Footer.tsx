import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { CHAIN } from "@/lib/chain";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-sm text-text">{BRAND.name}<span className="text-gold">·</span></div>
          <p className="mt-0.5 text-[12px] text-faint">{BRAND.tagline} · {CHAIN.name}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <Link href="/" className="hover:text-text">Explorer</Link>
          <Link href="/policy" className="hover:text-text">Policy Engine</Link>
          <Link href="/live" className="hover:text-text">Live Run</Link>
          <Link href="/feed" className="hover:text-text">Feed</Link>
          <Link href="/about" className="hover:text-text">About</Link>
        </nav>
      </div>
    </footer>
  );
}
