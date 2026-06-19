// Nebius Token Factory adapter — the agents' brain (OpenAI-compatible).
// Docs: https://docs.tokenfactory.nebius.com/quickstart

import "dotenv/config";
import OpenAI from "openai";
import type { ICP, Lead } from "./types.ts";

const client = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
});

const MODEL = process.env.NEBIUS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";

async function jsonChat(system: string, user: string) {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  return JSON.parse(res.choices[0].message.content ?? "{}");
}

/** Score a lead 0..1 against the ICP. */
export async function qualify(lead: Lead, icp: ICP): Promise<number> {
  const out = await jsonChat(
    "You score B2B sales leads against an Ideal Customer Profile. Return JSON {\"score\": number 0..1, \"reason\": string}.",
    `ICP: ${icp.description}\nLead: ${JSON.stringify(lead)}`,
  );
  return Math.max(0, Math.min(1, Number(out.score) || 0));
}

/**
 * Validate an enriched record — the rogue-catch primitive.
 * Flags implausible / fabricated data (malformed email, mismatched domain,
 * title that doesn't fit the company, obviously synthetic values).
 */
export async function validate(lead: Lead): Promise<{ valid: boolean; reason: string }> {
  // Cheap deterministic checks first.
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
    return { valid: false, reason: "malformed email" };
  }
  if (lead.email && lead.domain && !lead.email.endsWith("@" + lead.domain)) {
    // Not always invalid, but a strong rogue signal for the demo.
    return { valid: false, reason: "email domain does not match company domain" };
  }
  const out = await jsonChat(
    "You audit B2B lead records for fabricated/implausible data. Return JSON {\"valid\": boolean, \"reason\": string}.",
    `Record: ${JSON.stringify(lead)}`,
  );
  return { valid: Boolean(out.valid), reason: String(out.reason ?? "") };
}
