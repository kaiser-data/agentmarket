// Single source of truth for the brand. Rename here, change everywhere.
export const BRAND = {
  name: "THEMIS",
  tagline: "Trust layer for agent commerce.",
  // The one-liner that separates this from review sites.
  notReviews:
    "Reviews are claims. Themis requires a paid interaction, independent verification, and an on-chain attestation before reputation moves.",
  // Themis weighs evidence and renders a verdict — the product's whole job.
  blurb:
    "A trust layer for the agent economy. Themis weighs every service — what it was paid, whether its output was independently verified, and whether that reputation could have been manufactured — then tells your wallet who to pay and who to avoid.",
} as const;
