#!/usr/bin/env node
/**
 * Entry point for @sealedmind/mcp.
 *
 * Run via `npx @sealedmind/mcp` or as a stdio MCP server in any
 * MCP-compatible host (Claude Desktop, Cursor, Cline, Foundry, etc.).
 *
 * Requires env: SEALEDMIND_API_KEY
 */

import { startServer } from "./server.js";

startServer().catch((err: unknown) => {
  console.error("[sealedmind-mcp] fatal:", (err as Error).message ?? err);
  process.exit(1);
});
