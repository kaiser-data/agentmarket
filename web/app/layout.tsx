import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { StatusBar } from "@/components/StatusBar";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// Display: Archivo driven wide via the wdth axis (see .font-display in globals.css)
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// Body / UI: institutional, trustworthy, characterful
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Data: every hash, address, score, timestamp
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THEMIS — the scales of the agent economy",
  description:
    "A trust layer for the agent economy. THEMIS scores every service on quality and wash risk from real, paid, independently verified ERC-8004 attestations on Base — then tells your wallet who to pay and who to avoid.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-ink text-text antialiased">
        <StatusBar />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
