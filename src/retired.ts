/**
 * The hosted Worker, retired.
 *
 * The replacement is the npm package, a local stdio server, and no HTTP response can
 * make a remote MCP client launch a local process. So this Worker cannot redirect an MCP
 * connection. It does the next best thing: it still speaks just enough MCP to be
 * connected to, and every tool call answers with a link to the repository, which the
 * calling agent reads and relays to its user.
 *
 * It keeps the old tool names on purpose. A client that cached them calls them as
 * before and gets the notice back, where a missing tool would only produce an opaque
 * "tool not found".
 *
 * No SDK and no catalog: the old entry loaded a 2.2 MB catalog and built a search index
 * per isolate, and that pushed it past the free plan's CPU limit. This file does neither.
 *
 * Browser visits to any other path get a 301 to the repository.
 */

import { REPO_URL, RETIRED_NOTICE } from "./retired-notice.js";

// The tools the live Worker registered (src/tools.ts). The schema accepts anything, so a
// call with the old arguments still reaches the handler and receives the notice.
const OLD_TOOLS = [
  "list_categories",
  "list_locations",
  "describe_action",
  "search_actions",
  "execute_action",
].map((name) => ({
  name,
  description: `RETIRED. ${RETIRED_NOTICE}`,
  inputSchema: { type: "object", properties: {}, additionalProperties: true },
}));

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function answer(msg: JsonRpcMessage): object | null {
  // Notifications (no id) and client responses get no reply.
  if (msg.id === undefined || msg.id === null || typeof msg.method !== "string") return null;
  const id = msg.id;

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: typeof requested === "string" ? requested : DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "ghl-mcp-server (retired)", version: "0.1.0" },
          instructions: RETIRED_NOTICE,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: OLD_TOOLS } };
    case "tools/call":
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: RETIRED_NOTICE }], isError: true },
      };
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: RETIRED_NOTICE } };
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleMcp(request: Request): Promise<Response> {
  // No server-initiated stream and no sessions to end: the spec's answer to GET and
  // DELETE on a server that offers neither is 405.
  if (request.method !== "POST") {
    return new Response(RETIRED_NOTICE, { status: 405, headers: { Allow: "POST" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: RETIRED_NOTICE } }, 400);
  }

  if (Array.isArray(body)) {
    const replies = body.map((m) => answer(m as JsonRpcMessage)).filter((r) => r !== null);
    return replies.length ? json(replies) : new Response(null, { status: 202 });
  }
  const reply = answer(body as JsonRpcMessage);
  return reply ? json(reply) : new Response(null, { status: 202 });
}

export default {
  fetch(request: Request): Promise<Response> | Response {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") return handleMcp(request);
    return Response.redirect(REPO_URL, 301);
  },
};
