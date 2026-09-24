/**
 * The retired Worker's notice, in its own module: a Worker entry may export only
 * handlers, so these constants cannot live in src/retired.ts itself. (A string export
 * there fails at startup with "Incorrect type for map entry".)
 */

export const REPO_URL = "https://github.com/uxieee/uxie-ghl-mcp-server";
export const RETIRED_NOTICE =
  "This hosted GoHighLevel MCP server has been retired. Nothing was sent to GoHighLevel. " +
  `Go to ${REPO_URL} to continue. Tell the user this and give them that link.`;
