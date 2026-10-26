import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { MemoryAuditSink, withAudit } from "../../src/lib/audit.js";
import { dateInZone, isIsoDate } from "../../src/lib/dates.js";
import { NotFoundError } from "../../src/lib/errors.js";
import { redact, REDACTED } from "../../src/lib/redact.js";

describe("redact", () => {
  it("hides sensitive keys at any depth, in any letter case", () => {
    const input = {
      title: "ok",
      api_key: "abc",
      nested: { Authorization: "Bearer xyz", list: [{ password: "p" }, { NOTION_TOKEN: "t" }] },
    };
    const out = redact(input);
    expect(out.title).toBe("ok");
    expect(out.api_key).toBe(REDACTED);
    expect(out.nested.Authorization).toBe(REDACTED);
    expect(out.nested.list[0]?.password).toBe(REDACTED);
    expect(out.nested.list[1]?.NOTION_TOKEN).toBe(REDACTED);
  });

  it("hides key-shaped strings inside normal fields", () => {
    const fakeKey = "sk-" + "a".repeat(24); // built at runtime so no key-like text sits in the repo
    const out = redact({ note: `use ${fakeKey} for now` });
    expect(out.note).toBe(`use ${REDACTED} for now`);
  });

  it("does not change the original object", () => {
    const input = { token: "t" };
    redact(input);
    expect(input.token).toBe("t");
  });
});

describe("dates", () => {
  it("accepts real dates only", () => {
    expect(isIsoDate("2026-10-30")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false); // 2026 is not a leap year
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("tomorrow")).toBe(false);
  });

  it("formats the local date in a time zone", () => {
    const instant = new Date("2026-10-25T20:30:00Z");
    expect(dateInZone(instant, "Asia/Karachi")).toBe("2026-10-26");
    expect(dateInZone(instant, "America/New_York")).toBe("2026-10-25");
  });
});

describe("withAudit", () => {
  it("logs successful calls with redacted args and duration", async () => {
    const sink = new MemoryAuditSink();
    const wrapped = withAudit("demo", sink, async () => ({ text: "fine", outcome: "preview" as const }));
    const res = await wrapped({ title: "x", secret: "s" });
    expect(res.isError).toBeUndefined();
    expect(sink.entries[0]).toMatchObject({ tool: "demo", outcome: "preview", args: { title: "x", secret: REDACTED } });
    expect(typeof sink.entries[0]?.durationMs).toBe("number");
  });

  it("returns expected errors as readable isError results", async () => {
    const sink = new MemoryAuditSink();
    const wrapped = withAudit("demo", sink, async () => {
      throw new NotFoundError("Task", 9);
    });
    const res = await wrapped({});
    expect(res).toEqual({ isError: true, content: [{ type: "text", text: "Task 9 not found." }] });
    expect(sink.entries[0]?.outcome).toBe("error");
  });

  it("hides unexpected errors behind a reference id", async () => {
    const sink = new MemoryAuditSink();
    const wrapped = withAudit("demo", sink, async () => {
      throw new Error("SQLITE_BUSY at C:\\secret\\path.db");
    });
    const res = await wrapped({});
    const text = (res.content[0] as { text: string }).text;
    expect(res.isError).toBe(true);
    expect(text).not.toContain("SQLITE");
    expect(text).not.toContain("path.db");
    expect(text).toMatch(/ref [0-9a-f]{8}/);
    expect(sink.entries[0]?.outcome).toBe("bug");
  });
});

describe("config", () => {
  it("uses safe defaults", () => {
    const c = loadConfig({}, []);
    expect(c.transport).toBe("stdio");
    expect(c.timezone).toBe("Asia/Karachi");
    expect(c.dbPath).toMatch(/data[\\/]taskdesk\.db$/);
  });

  it("rejects an unknown time zone", () => {
    expect(() => loadConfig({ TASKDESK_TIMEZONE: "Mars/Olympus" }, [])).toThrow(/TASKDESK_TIMEZONE/);
  });

  it("requires a long token in http mode", () => {
    expect(() => loadConfig({}, ["--http"])).toThrow(/TASKDESK_HTTP_TOKEN/);
    expect(loadConfig({ TASKDESK_HTTP_TOKEN: "x".repeat(32) }, ["--http"]).transport).toBe("http");
  });
});
