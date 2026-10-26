import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { NotFoundError } from "../lib/errors.js";
import { SCHEMA_SQL } from "./schema.js";
import type { NewTask, Note, Status, Task, TaskFilter, TaskStore } from "./taskStore.js";

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Task["priority"];
  assignee: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface NoteRow {
  id: number;
  task_id: number;
  text: string;
  created_at: string;
}

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  assignee: r.assignee,
  dueDate: r.due_date,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toNote = (r: NoteRow): Note => ({ id: r.id, taskId: r.task_id, text: r.text, createdAt: r.created_at });

/** Escapes LIKE wildcards so a search for "50%" means the text "50%". */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);



// Lists sort open work first (blocked, in progress, todo, done), then priority, then due date.
export class SqliteTaskStore implements TaskStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    // SQLite ignores ON DELETE CASCADE unless this is switched on for each connection.
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
  }

  listTasks(filter: TaskFilter): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE (@status IS NULL OR status = @status)
           AND (@assignee IS NULL OR lower(assignee) = lower(@assignee))
         ORDER BY CASE status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
                  CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  due_date IS NULL, due_date, id
         LIMIT @limit OFFSET @offset`,
      )
      .all({
        status: filter.status ?? null,
        assignee: filter.assignee ?? null,
        limit: filter.limit,
        offset: filter.offset ?? 0,
      }) as TaskRow[];
    return rows.map(toTask);
  }

  countTasks(filter: { status?: Status; assignee?: string } = {}): number {
    const row = this.db
      .prepare(
        `SELECT count(*) AS n FROM tasks
         WHERE (@status IS NULL OR status = @status)
           AND (@assignee IS NULL OR lower(assignee) = lower(@assignee))`,
      )
      .get({ status: filter.status ?? null, assignee: filter.assignee ?? null }) as { n: number };
    return row.n;
  }

  getTask(id: number): Task | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
    return row ? toTask(row) : undefined;
  }

  getNotes(taskId: number): Note[] {
    const rows = this.db
      .prepare("SELECT * FROM notes WHERE task_id = ? ORDER BY created_at, id")
      .all(taskId) as NoteRow[];
    return rows.map(toNote);
  }

  searchTasks(query: string, limit: number): Task[] {
    const pattern = `%${escapeLike(query)}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE title LIKE @p ESCAPE '\\' OR description LIKE @p ESCAPE '\\'
            OR id IN (SELECT task_id FROM notes WHERE text LIKE @p ESCAPE '\\')
         ORDER BY CASE status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
                  CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  due_date IS NULL, due_date, id
         LIMIT @limit`,
      )
      .all({ p: pattern, limit }) as TaskRow[];
    return rows.map(toTask);
  }

  createTask(input: NewTask, now: string): Task {
    const info = this.db
      .prepare(
        `INSERT INTO tasks (title, description, status, priority, assignee, due_date, created_at, updated_at)
         VALUES (@title, @description, @status, @priority, @assignee, @dueDate, @now, @now)`,
      )
      .run({
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        assignee: input.assignee ?? null,
        dueDate: input.dueDate ?? null,
        now,
      });
    return this.mustGet(Number(info.lastInsertRowid));
  }

  updateStatus(id: number, status: Status, note: string | null, now: string): Task {
    const tx = this.db.transaction(() => {
      const res = this.db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
      if (res.changes === 0) throw new NotFoundError("Task", id);
      if (note) {
        this.db.prepare("INSERT INTO notes (task_id, text, created_at) VALUES (?, ?, ?)").run(id, note, now);
      }
    });
    tx();
    return this.mustGet(id);
  }

  addNote(taskId: number, text: string, now: string): Note {
    const tx = this.db.transaction(() => {
      const info = this.db
        .prepare("INSERT INTO notes (task_id, text, created_at) VALUES (?, ?, ?)")
        .run(taskId, text, now);
      // Adding a note counts as activity on the task.
      this.db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(now, taskId);
      return Number(info.lastInsertRowid);
    });
    const noteId = tx();
    const row = this.db.prepare("SELECT * FROM notes WHERE id = ?").get(noteId) as NoteRow;
    return toNote(row);
  }

  deleteTask(id: number): void {
    const res = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (res.changes === 0) throw new NotFoundError("Task", id);
  }

  /** Test and seed helper: remove everything. */
  reset(): void {
    this.db.exec("DELETE FROM notes; DELETE FROM tasks; DELETE FROM sqlite_sequence WHERE name IN ('tasks','notes');");
  }

  close(): void {
    if (this.db.open) this.db.close();
  }

  private mustGet(id: number): Task {
    const t = this.getTask(id);
    if (!t) throw new NotFoundError("Task", id);
    return t;
  }
}
