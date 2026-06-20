// On-chain constants for the Proof Terminal. Single source of truth for
// contract addresses + BaseScan links. Mirrors the testnet config in the
// root project's lib/erc8004.ts (Base Sepolia).

export const CHAIN = {
  name: "Base Sepolia",
  scan: "https://sepolia.basescan.org",
  identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  tag: "proof-of-quality",
} as const;

export const txUrl = (tx: string) => `${CHAIN.scan}/tx/${tx}`;
export const addrUrl = (a: string) => `${CHAIN.scan}/address/${a}`;
export const tokenUrl = (agentId: string) =>
  `${CHAIN.scan}/token/${CHAIN.identity}?a=${agentId}`;

// 0x5151…1000 — keep hashes legible without losing their on-chain identity.
export const shortHash = (h: string, head = 6, tail = 4) =>
  h.length <= head + tail + 2 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
