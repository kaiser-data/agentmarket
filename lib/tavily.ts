// Tavily search adapter — the consumer agent's lead-discovery engine.
// Docs: https://docs.tavily.com/

import "dotenv/config";
import type { Candidate, ICP } from "./types.ts";

const API = "https://api.tavily.com/search";

export async function tavilySearch(query: string, maxResults = 8) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: "advanced",
    }),
  });
  if (!r.ok) throw new Error(`tavily failed: ${r.status} ${await r.text()}`);
  const json = await r.json();
  return json.results as Array<{ title: string; url: string; content: string }>;
}

/** Turn an ICP into candidate companies/people to enrich. */
export async function discoverCandidates(icp: ICP): Promise<Candidate[]> {
  const results = await tavilySearch(
    `companies and decision-makers matching: ${icp.description}. List company names and domains.`,
    icp.count * 2,
  );
  // Light heuristic extraction; the consumer can refine with Nebius if needed.
  return results.map((r) => ({
    company: r.title,
    domain: safeDomain(r.url),
    source: r.url,
  }));
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
