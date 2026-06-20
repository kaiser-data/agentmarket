// Claude Agent SDK adapter: wraps the shared tool core (leadgen-core.ts) as an
// in-process MCP server. The Nebius adapter uses the same core, so tool logic
// and the wallet policy are defined once.

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { TOOLS, SPEND_TOOL_NAMES, policy, ledger } from "./leadgen-core.ts";

export const MCP_SERVER_NAME = "leadgen";
export const SPEND_TOOLS = SPEND_TOOL_NAMES.map((n) => `mcp__${MCP_SERVER_NAME}__${n}`);
export { policy, ledger };

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export function buildLeadgenServer() {
  const tools = TOOLS.map((t) =>
    tool(t.name, t.description, t.shape, async (args: unknown): Promise<ToolResult> => {
      try {
        const result = await t.handler(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }], isError: true };
      }
    }),
  );
  return createSdkMcpServer({ name: MCP_SERVER_NAME, version: "0.1.0", tools });
}
