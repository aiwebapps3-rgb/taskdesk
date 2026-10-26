import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../../src/lib/errors.js";
import { SqliteTaskStore } from "../../src/store/sqliteTaskStore.js";

const NOW = "2026-10-25T10:00:00.000Z";
let store: SqliteTaskStore;

beforeEach(() => {
  store = new SqliteTaskStore(":memory:");
});
afterEach(() => store.close());

describe("SqliteTaskStore", () => {
  it("creates and reads a task with defaults", () => {
    const t = store.createTask({ title: "Write README" }, NOW);
    expect(t).toMatchObject({ id: 1, title: "Write README", status: "todo", priority: "medium", createdAt: NOW });
    expect(store.getTask(1)).toEqual(t);
  });

  it("rejects an invalid status at the database level", () => {
    // Bypass TypeScript on purpose to prove the CHECK constraint works.
    expect(() => store.createTask({ title: "x", status: "finished" as never }, NOW)).toThrow(/CHECK constraint/);
  });

  it("stores SQL injection text as plain text", () => {
    const evil = "'); DROP TABLE tasks; --";
    const t = store.createTask({ title: evil }, NOW);
    expect(store.getTask(t.id)?.title).toBe(evil);
    expect(store.countTasks()).toBe(1);
  });

  it("deletes notes with their task (foreign keys are on)", () => {
    const t = store.createTask({ title: "With notes" }, NOW);
    store.addNote(t.id, "one", NOW);
    store.addNote(t.id, "two", NOW);
    store.deleteTask(t.id);
    expect(store.getNotes(t.id)).toEqual([]);
  });

  it("refuses a note for a missing task", () => {
    expect(() => store.addNote(999, "orphan", NOW)).toThrow(/FOREIGN KEY/);
  });

  it("updates status and adds a note in one transaction", () => {
    const t = store.createTask({ title: "Ship it" }, NOW);
    const later = "2026-10-25T12:00:00.000Z";
    const u = store.updateStatus(t.id, "done", "Shipped", later);
    expect(u.status).toBe("done");
    expect(u.updatedAt).toBe(later);
    expect(store.getNotes(t.id).map((n) => n.text)).toEqual(["Shipped"]);
  });

  it("throws NotFoundError when updating or deleting a missing task", () => {
    expect(() => store.updateStatus(42, "done", null, NOW)).toThrow(NotFoundError);
    expect(() => store.deleteTask(42)).toThrow(NotFoundError);
  });

  it("filters by status and assignee, case-insensitively", () => {
    store.createTask({ title: "a", assignee: "Usman", status: "blocked" }, NOW);
    store.createTask({ title: "b", assignee: "Sara", status: "blocked" }, NOW);
    store.createTask({ title: "c", assignee: "usman", status: "todo" }, NOW);
    expect(store.listTasks({ status: "blocked", limit: 10 }).map((t) => t.title)).toEqual(["a", "b"]);
    expect(store.listTasks({ assignee: "USMAN", limit: 10 })).toHaveLength(2);
    expect(store.countTasks({ status: "blocked" })).toBe(2);
  });

  it("sorts blocked first, then by priority", () => {
    store.createTask({ title: "low todo", priority: "low" }, NOW);
    store.createTask({ title: "high todo", priority: "high" }, NOW);
    store.createTask({ title: "blocked", status: "blocked" }, NOW);
    expect(store.listTasks({ limit: 10 }).map((t) => t.title)).toEqual(["blocked", "high todo", "low todo"]);
  });

  it("searches titles, descriptions and notes, treating % and _ literally", () => {
    store.createTask({ title: "Invoice check", description: "March" }, NOW);
    const t = store.createTask({ title: "Other" }, NOW);
    store.addNote(t.id, "mentions INVOICE in a note", NOW);
    store.createTask({ title: "100% done" }, NOW);
    store.createTask({ title: "100 done" }, NOW);
    expect(store.searchTasks("invoice", 10)).toHaveLength(2);
    expect(store.searchTasks("100%", 10).map((x) => x.title)).toEqual(["100% done"]);
  });

  it("pages with limit and offset", () => {
    for (let i = 0; i < 5; i++) store.createTask({ title: `t${i}` }, NOW);
    expect(store.listTasks({ limit: 2, offset: 2 }).map((t) => t.title)).toEqual(["t2", "t3"]);
  });
});
