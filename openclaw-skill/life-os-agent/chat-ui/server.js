#!/usr/bin/env node
/**
 * Life OS Chat UI — tiny proxy server
 * Serves the chat UI and proxies messages to: openclaw agent --agent life-os
 */
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

const execAsync = promisify(exec);
const __dir = dirname(fileURLToPath(import.meta.url));
const PORT = 3737;

// Per-connection session IDs so each browser tab gets its own conversation
const sessions = new Map();

const html = readFileSync(join(__dir, "index.html"), "utf8");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Serve chat page
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  // Chat endpoint
  if (req.method === "POST" && url.pathname === "/chat") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { message, sessionId } = JSON.parse(body);
        if (!message?.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "message required" }));
          return;
        }

        // Get or create session
        const sid = sessionId || randomBytes(8).toString("hex");
        if (!sessions.has(sid)) sessions.set(sid, sid);

        // Escape message for shell
        const escaped = message.replace(/'/g, "'\\''");
        const cmd = `openclaw agent --agent life-os --session-id life-os-chat-${sid} --message '${escaped}'`;

        const { stdout, stderr } = await execAsync(cmd, {
          timeout: 120_000,
          env: { ...process.env, PATH: process.env.PATH },
        });

        const reply = stdout.trim() || stderr.trim() || "(no response)";

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply, sessionId: sid }));
      } catch (err) {
        const msg = err.stdout?.trim() || err.stderr?.trim() || err.message || "Agent error";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`\n  Life OS Chat UI → http://localhost:${PORT}\n`);
});
