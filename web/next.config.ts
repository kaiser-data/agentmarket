import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root to this app — several lockfiles exist up the tree.
  turbopack: { root: here },
  // Fully static: data is bundled, every route is static/SSG, SSE is
  // client-side — so we export a static site and deploy it as-is (e.g. Netlify).
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
