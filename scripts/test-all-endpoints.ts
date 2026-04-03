/**
 * Comprehensive endpoint test — exercises the MCP server across all 35 categories.
 * Calls search_actions for every category, then execute_action for representative endpoints.
 *
 * Usage: GHL_TOKEN=pit-xxx GHL_LOCATION=xxx npx tsx scripts/test-all-endpoints.ts
 */

const MCP_URL = "http://localhost:8787/mcp";
const TOKEN = process.env.GHL_TOKEN || "";
const LOCATION_ID = process.env.GHL_LOCATION || "";

if (!TOKEN || !LOCATION_ID) {
  console.error("Usage: GHL_TOKEN=pit-xxx GHL_LOCATION=xxx npx tsx scripts/test-all-endpoints.ts");
  process.exit(1);
}

let SESSION_ID = "";
let requestId = 0;

// ── MCP helpers ──

async function mcpCall(method: string, params: Record<string, unknown> = {}) {
  requestId++;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "X-GHL-Token": TOKEN,
  };
  if (SESSION_ID) headers["mcp-session-id"] = SESSION_ID;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
  });

  // Extract session ID from headers
  const sid = res.headers.get("mcp-session-id");
  if (sid) SESSION_ID = sid;

  const text = await res.text();
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      if (data.result) return data.result;
      if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
    }
  }
  // Try plain JSON response
  try {
    const json = JSON.parse(text);
    if (json.result) return json.result;
    if (json.error) throw new Error(`MCP error: ${JSON.stringify(json.error)}`);
  } catch {}
  throw new Error(`Unexpected response: ${text.slice(0, 200)}`);
}

async function initialize() {
  return mcpCall("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-harness", version: "1.0" },
  });
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const result = await mcpCall("tools/call", { name, arguments: args });
  const text = result.content?.[0]?.text || "";
  return { text, isError: result.isError || false };
}

// ── Test runner ──

interface TestResult {
  category: string;
  action: string;
  method: string;
  path: string;
  status: string;
  ok: boolean;
}

const results: TestResult[] = [];
const PASS = "✓";
const FAIL = "✗";
const SKIP = "⊘";

async function testSearch(category: string) {
  const { text } = await callTool("search_actions", { intent: category, category, limit: 25 });
  try {
    const actions = JSON.parse(text);
    return actions as Array<{
      id: string;
      method: string;
      path: string;
      summary: string;
      parameters: Array<{ name: string; in: string; required: boolean }>;
    }>;
  } catch {
    return [];
  }
}

async function testExecute(
  category: string,
  actionId: string,
  method: string,
  path: string,
  params: Record<string, unknown>
): Promise<TestResult> {
  try {
    const { text, isError } = await callTool("execute_action", {
      action_id: actionId,
      params,
    });

    // Extract status code from response
    const statusMatch = text.match(/→ (\d{3})/);
    const httpStatus = statusMatch ? statusMatch[1] : "???";

    // Also check for MCP-level errors
    const errorMatch = text.match(/GHL API error \(HTTP (\d{3})\)/);
    const errorStatus = errorMatch ? errorMatch[1] : null;

    const finalStatus = errorStatus || httpStatus;
    const ok =
      finalStatus.startsWith("2") ||
      finalStatus === "404" || // Not found is expected for many endpoints without data
      finalStatus === "422"; // Validation error means the endpoint works, just missing data

    return { category, action: actionId, method, path, status: finalStatus, ok };
  } catch (err: any) {
    return {
      category,
      action: actionId,
      method,
      path,
      status: `ERR: ${err.message.slice(0, 60)}`,
      ok: false,
    };
  }
}

// ── Build default params for common patterns ──

function buildParams(
  action: {
    parameters: Array<{ name: string; in: string; required: boolean }>;
    method: string;
    path: string;
  }
): Record<string, unknown> | null {
  const params: Record<string, unknown> = {};

  for (const p of action.parameters) {
    if (p.name === "locationId") {
      params.locationId = LOCATION_ID;
    } else if (p.name === "limit") {
      params.limit = 1;
    } else if (p.name === "skip" || p.name === "offset") {
      params[p.name] = 0;
    } else if (p.required && p.in === "path") {
      // Use a placeholder ID — will get 404 but proves routing works
      params[p.name] = "test-placeholder-id";
    } else if (p.required && p.in === "query") {
      if (p.name === "altId" || p.name === "altType") {
        params[p.name] = "location";
      } else if (p.name === "locationId") {
        params.locationId = LOCATION_ID;
      } else {
        params[p.name] = "test";
      }
    }
  }

  // Always include locationId for GHL
  if (!params.locationId) {
    params.locationId = LOCATION_ID;
  }

  return params;
}

// ── Main ──

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  GHL MCP Server — Full Endpoint Test Suite");
  console.log("═══════════════════════════════════════════════\n");

  // Initialize MCP session
  console.log("Initializing MCP session...");
  await initialize();
  console.log(`Session: ${SESSION_ID.slice(0, 16)}...\n`);

  // Get all categories
  const { text: catText } = await callTool("list_categories");
  const categoryLines = catText.split("\n").filter((l) => l.includes(": "));
  const categories = categoryLines
    .map((l) => l.split(":")[0].trim())
    .filter((c) => c && !c.includes("total"));

  console.log(`Testing ${categories.length} categories\n`);

  let totalTested = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const category of categories) {
    console.log(`\n── ${category.toUpperCase()} ──`);

    // Search for all actions in this category
    const actions = await testSearch(category);
    if (actions.length === 0) {
      console.log(`  ${SKIP} No actions found`);
      totalSkipped++;
      continue;
    }

    console.log(`  Found ${actions.length} actions`);

    // Test each action
    for (const action of actions) {
      const params = buildParams(action);
      if (!params) {
        console.log(`  ${SKIP} ${action.id} — skipped (complex params)`);
        totalSkipped++;
        continue;
      }

      // For POST/PUT/PATCH that create/modify, add minimal body
      if (["POST", "PUT", "PATCH"].includes(action.method)) {
        // Add minimal required fields for common create operations
        if (action.id.includes("create-contact")) {
          params.firstName = "Test";
          params.lastName = "Endpoint";
          params.email = "test-endpoint@throwaway.test";
        } else if (action.id.includes("create-note")) {
          params.body = "Test note from endpoint testing";
        } else if (action.id.includes("create-task")) {
          params.title = "Test task";
          params.body = "Test task body";
          params.dueDate = "2026-12-31";
        }
      }

      const result = await testExecute(
        category,
        action.id,
        action.method,
        action.path,
        params
      );
      results.push(result);

      const icon = result.ok ? PASS : FAIL;
      console.log(
        `  ${icon} ${action.method.padEnd(6)} ${result.status.padEnd(4)} ${action.id}`
      );

      totalTested++;
      if (result.ok) totalPassed++;
      else totalFailed++;

      // Small delay to avoid hammering
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════\n");
  console.log(`  Total tested:  ${totalTested}`);
  console.log(`  Passed:        ${totalPassed} ${PASS}`);
  console.log(`  Failed:        ${totalFailed} ${FAIL}`);
  console.log(`  Skipped:       ${totalSkipped} ${SKIP}`);
  console.log(`  Pass rate:     ${((totalPassed / totalTested) * 100).toFixed(1)}%\n`);

  // Show failures
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.log("── FAILURES ──\n");
    for (const f of failures) {
      console.log(`  ${FAIL} ${f.method.padEnd(6)} ${f.status.padEnd(20)} ${f.action}`);
      console.log(`    Path: ${f.path}`);
    }
  }

  // Category breakdown
  console.log("\n── PER-CATEGORY BREAKDOWN ──\n");
  const byCat: Record<string, { pass: number; fail: number }> = {};
  for (const r of results) {
    if (!byCat[r.category]) byCat[r.category] = { pass: 0, fail: 0 };
    if (r.ok) byCat[r.category].pass++;
    else byCat[r.category].fail++;
  }
  for (const [cat, { pass, fail }] of Object.entries(byCat).sort(([a], [b]) => a.localeCompare(b))) {
    const total = pass + fail;
    const pct = ((pass / total) * 100).toFixed(0);
    const bar = fail > 0 ? ` (${fail} failed)` : "";
    console.log(`  ${cat.padEnd(25)} ${pass}/${total} ${pct}%${bar}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
