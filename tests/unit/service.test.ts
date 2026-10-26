import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../src/lib/errors.js";
import { TaskService } from "../../src/services/taskService.js";
import { SqliteTaskStore } from "../../src/store/sqliteTaskStore.js";

// 2026-10-25 21:00 UTC is already 2026-10-26 02:00 in Karachi.
const FIXED_NOW = new Date("2026-10-25T21:00:00.000Z");

let store: SqliteTaskStore;
let service: TaskService;

beforeEach(() => {
  store = new SqliteTaskStore(":memory:");
  service = new TaskService(store, { timezone: "Asia/Karachi", now: () => FIXED_NOW });
});
afterEach(() => store.close());

/** Spies on every store method that writes, so tests can prove nothing was written. */
function spyOnWrites() {
  return [
    vi.spyOn(store, "createTask"),
    vi.spyOn(store, "updateStatus"),
    vi.spyOn(store, "addNote"),
    vi.spyOn(store, "deleteTask"),
  ];
}
const noWrites = (spies: ReturnType<typeof spyOnWrites>) => spies.forEach((s) => expect(s).not.toHaveBeenCalled());

describe("dry run", () => {
  it("create_task dry run returns a preview and writes nothing", () => {
    const spies = spyOnWrites();
    const r = service.createTask({ title: "Test webhook", priority: "high" }, true);
    expect(r.kind).toBe("preview");
    expect(r.message).toMatch(/Dry run.*Nothing was saved/);
    noWrites(spies);
    expect(store.countTasks()).toBe(0);
  });

  it("update_task_status dry run writes nothing", () => {
    const t = store.createTask({ title: "x" }, "2026-10-20T00:00:00Z");
    const spies = spyOnWrites();
    const r = service.updateTaskStatus({ id: t.id, status: "done", note: "finished" }, true);
    expect(r.kind).toBe("preview");
    noWrites(spies);
    expect(store.getTask(t.id)?.status).toBe("todo");
    expect(store.getNotes(t.id)).toHaveLength(0);
  });

  it("add_note dry run writes nothing", () => {
    const t = store.createTask({ title: "x" }, "2026-10-20T00:00:00Z");
    const spies = spyOnWrites();
    expect(service.addNote({ taskId: t.id, text: "hello" }, true).kind).toBe("preview");
    noWrites(spies);
  });
});

describe("delete confirmation", () => {
  it("without confirm returns a preview with the note count and deletes nothing", () => {
    const t = store.createTask({ title: "Old onboarding" }, "2026-10-20T00:00:00Z");
    store.addNote(t.id, "a", "2026-10-20T00:00:00Z");
    const spies = spyOnWrites();
    const r = service.deleteTask({ id: t.id });
    expect(r.kind).toBe("preview");
    expect(r.message).toContain('"Old onboarding" and 1 note');
    noWrites(spies);
    expect(store.getTask(t.id)).toBeDefined();
  });

  it("confirm: false is treated the same as no confirm", () => {
    const t = store.createTask({ title: "x" }, "2026-10-20T00:00:00Z");
    expect(service.deleteTask({ id: t.id, confirm: false }).kind).toBe("preview");
    expect(store.getTask(t.id)).toBeDefined();
  });

  it("with confirm: true deletes the task", () => {
    const t = store.createTask({ title: "x" }, "2026-10-20T00:00:00Z");
    expect(service.deleteTask({ id: t.id, confirm: true }).kind).toBe("done");
    expect(store.getTask(t.id)).toBeUndefined();
  });

  it("a missing task is reported as not found, even without confirm", () => {
    expect(() => service.deleteTask({ id: 9999 })).toThrow("Task 9999 not found.");
  });
});

describe("validation rules", () => {
  it("rejects a due date that is not YYYY-MM-DD or not a real date", () => {
    expect(() => service.createTask({ title: "x", dueDate: "tomorrow" }, false)).toThrow(ValidationError);
    expect(() => service.createTask({ title: "x", dueDate: "2026-02-30" }, false)).toThrow(/real date/);
  });

  it("rejects an empty title after trimming", () => {
    expect(() => service.createTask({ title: "   " }, false)).toThrow(/Title/);
  });

  it("requires a note when marking a task blocked", () => {
    const t = store.createTask({ title: "x" }, "2026-10-20T00:00:00Z");
    expect(() => service.updateTaskStatus({ id: t.id, status: "blocked" }, false)).toThrow(/note explaining why/);
  });

  it("rejects a no-op status change", () => {
    const t = store.createTask({ title: "x" }, "2026-10-20T00:00:00Z");
    expect(() => service.updateTaskStatus({ id: t.id, status: "todo" }, false)).toThrow(/already todo/);
  });

  it("caps list limit at 100", () => {
    const spy = vi.spyOn(store, "listTasks");
    service.listTasks({ limit: 5000 });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it("rejects a one-character search", () => {
    expect(() => service.searchTasks(" a ")).toThrow(/at least 2/);
  });

  it("getTask on a missing id throws NotFoundError", () => {
    expect(() => service.getTask(7)).toThrow(NotFoundError);
  });
});

describe("daily report", () => {
  it("uses the configured time zone for 'today'", () => {
    // 21:00 UTC on the 25th is the 26th in Karachi.
    expect(service.today()).toBe("2026-10-26");
    const utc = new TaskService(store, { timezone: "UTC", now: () => FIXED_NOW });
    expect(utc.today()).toBe("2026-10-25");
  });

  it("groups tasks and uses the latest note as the blocked reason", () => {
    const at = FIXED_NOW.toISOString();
    store.createTask({ title: "done today", status: "done" }, at);
    store.createTask({ title: "done long ago", status: "done" }, "2026-10-01T00:00:00Z");
    store.createTask({ title: "working", status: "in_progress" }, at);
    const b = store.createTask({ title: "stuck", status: "blocked" }, at);
    store.addNote(b.id, "old reason", "2026-10-24T00:00:00Z");
    store.addNote(b.id, "waiting for OAuth approval", "2026-10-25T00:00:00Z");
    store.createTask({ title: "late", dueDate: "2026-10-20" }, at);
    store.createTask({ title: "urgent", priority: "high" }, at);

    const r = service.dailyReport();
    expect(r.date).toBe("2026-10-26");
    expect(r.done.map((t) => t.title)).toEqual(["done today"]);
    expect(r.inProgress.map((t) => t.title)).toEqual(["working"]);
    expect(r.blocked[0]).toMatchObject({ title: "stuck", reason: "waiting for OAuth approval" });
    expect(r.overdue.map((t) => t.title)).toEqual(["late"]);
    expect(r.next[0]?.title).toBe("urgent");
  });

  it("rejects a badly formatted report date", () => {
    expect(() => service.dailyReport("26/10/2026")).toThrow(ValidationError);
  });
});
