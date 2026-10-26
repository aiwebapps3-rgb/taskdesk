/**
 * Starts the real built server (dist/index.js) as a child process and talks to it
 * over stdio with the official MCP client, exactly like Claude Code does.
 * `npm test` builds first (pretest), so dist/ is always fresh.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let dir: string;
let client: Client;

type TextResult = { isError?: boolean; content: { type: string; text: string }[] };
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as TextResult;
const text = (r: TextResult) => r.content[0]?.text ?? "";

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "taskdesk-it-"));
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  Object.assign(env, {
    TASKDESK_DB_PATH: path.join(dir, "test.db"),
    TASKDESK_AUDIT_PATH: path.join(dir, "audit.jsonl"),
    TASKDESK_TIMEZONE: "Asia/Karachi",
    TASKDESK_LOG_LEVEL: "warn",
  });
  client = new Client({ name: "taskdesk-integration-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, "dist/index.js")], env, stderr: "pipe" }),
  );
});

afterAll(async () => {
  await client?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("TaskDesk over stdio", () => {
  it("lists all 8 tools with the right safety annotations", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["add_note", "create_task", "daily_report", "delete_task", "get_task", "list_tasks", "search_tasks", "update_task_status"],
    );
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName.list_tasks?.annotations?.readOnlyHint).toBe(true);
    expect(byName.delete_task?.annotations?.destructiveHint).toBe(true);
    // Every input field carries a description for the agent.
    for (const t of tools) {
      for (const [field, schema] of Object.entries(t.inputSchema.properties ?? {})) {
        expect((schema as { description?: string }).description, `${t.name}.${field}`).toBeTruthy();
      }
    }
  });

  it("dry run create writes nothing", async () => {
    const preview = await call("create_task", { title: "Test webhook", dry_run: true });
    expect(text(preview)).toMatch(/Dry run/);
    expect(text(await call("list_tasks"))).toMatch(/No tasks match/);
  });

  it("creates, updates and reads a task", async () => {
    const created = await call("create_task", { title: "Fix login bug", priority: "high", due_date: "2026-10-30" });
    expect(text(created)).toMatch(/Created task 1/);
    await call("update_task_status", { id: 1, status: "blocked", note: "Waiting for QA" });
    const got = await call("get_task", { id: 1 });
    expect(text(got)).toContain('"status": "blocked"');
    expect(text(got)).toContain("Waiting for QA");
  });

  it("delete without confirm keeps the task; with confirm removes it", async () => {
    const preview = await call("delete_task", { id: 1 });
    expect(preview.isError).toBeFalsy();
    expect(text(preview)).toMatch(/Nothing has been deleted yet/);
    expect((await call("get_task", { id: 1 })).isError).toBeFalsy();

    expect(text(await call("delete_task", { id: 1, confirm: true }))).toMatch(/Deleted task 1/);
    const gone = await call("get_task", { id: 1 });
    expect(gone.isError).toBe(true);
    expect(text(gone)).toBe("Task 1 not found.");
  });

  it("rejects bad input with a clear error, not a crash", async () => {
    const bad = await call("create_task", { title: "x", due_date: "tomorrow" });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toMatch(/YYYY-MM-DD/);
    // The server is still alive afterwards.
    expect((await call("list_tasks")).isError).toBeFalsy();
  });

  it("serves the task resource and the daily_standup prompt", async () => {
    await call("create_task", { title: "Resource check" });
    const { resources } = await client.listResources();
    expect(resources.some((r) => r.uri.startsWith("taskdesk://tasks/"))).toBe(true);
    const uri = resources[0]!.uri;
    const read = await client.readResource({ uri });
    expect((read.contents[0] as { text: string }).text).toContain('"title"');

    const prompt = await client.getPrompt({ name: "daily_standup", arguments: {} });
    expect(JSON.stringify(prompt.messages)).toContain("daily_report");
  });

  it("returns the daily report", async () => {
    expect(text(await call("daily_report"))).toMatch(/^Daily report for \d{4}-\d{2}-\d{2} \(Asia\/Karachi\)/);
  });

  it("writes one audit line per tool call", () => {
    const lines = readFileSync(path.join(dir, "audit.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.some((l) => l.tool === "delete_task" && l.outcome === "preview")).toBe(true);
    expect(lines.every((l) => typeof l.durationMs === "number")).toBe(true);
  });

  it("audits calls the SDK rejects before any handler runs", async () => {
    await call("create_task", { title: "x", due_date: "next friday" });
    await call("no_such_tool");
    const lines = readFileSync(path.join(dir, "audit.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.some((l) => l.tool === "create_task" && l.outcome === "invalid" && /due_date/.test(l.message))).toBe(true);
    expect(lines.some((l) => l.tool === "no_such_tool" && l.outcome === "invalid")).toBe(true);
  });
});
