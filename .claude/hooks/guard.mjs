#!/usr/bin/env node
// PreToolUse guard for Edit, Write and MultiEdit.
// Exit 2 blocks the edit and sends the message on stderr back to Claude.
// Exit 0 lets the edit continue.

import { readFileSync } from "node:fs";

function block(message) {
  process.stderr.write(`Blocked by guard hook: ${message}\n`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // If the hook can't read its input, don't break the session.
  process.exit(0);
}

const toolInput = input.tool_input ?? {};
const filePath = String(toolInput.file_path ?? "").replace(/\\/g, "/");
const fileName = filePath.split("/").pop() ?? "";

const newText = [
  toolInput.content,
  toolInput.new_string,
  ...(Array.isArray(toolInput.edits) ? toolInput.edits.map((e) => e?.new_string) : []),
]
  .filter((t) => typeof t === "string")
  .join("\n");

// 1. Never touch real env files. .env.example is allowed.
if (/^\.env(\..+)?$/.test(fileName) && fileName !== ".env.example") {
  block(`${fileName} holds secrets and must be edited by a human, not by the agent.`);
}

// 2. Secrets pasted into any file.
const secretPatterns = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: "a private key" },
  { re: /\bsk-(ant-)?[A-Za-z0-9_-]{20,}/, why: "something that looks like an API key (sk-...)" },
  { re: /\bntn_[A-Za-z0-9]{20,}|\bsecret_[A-Za-z0-9]{30,}/, why: "something that looks like a Notion token" },
  {
    re: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i,
    why: "a hard-coded secret value",
  },
];
for (const { re, why } of secretPatterns) {
  if (re.test(newText)) {
    block(`the change contains ${why}. Read secrets from environment variables instead.`);
  }
}

// 3. stdout is reserved for the MCP protocol in server code.
const isServerCode = /(^|\/)src\/.+\.(ts|js|mjs)$/.test(filePath);
if (isServerCode && /\bconsole\.log\s*\(|process\.stdout\.write\s*\(/.test(newText)) {
  block(
    "server code must not write to stdout (console.log / process.stdout.write). " +
      "In stdio mode stdout carries the MCP protocol. Use the stderr logger in src/lib/logger.ts.",
  );
}

// 4. SQL built with template literals in the store.
const isStore = /(^|\/)src\/store\//.test(filePath);
if (isStore && /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{/i.test(newText)) {
  block("SQL must use parameters (? or @name), not ${...} inside a template literal.");
}

process.exit(0);
