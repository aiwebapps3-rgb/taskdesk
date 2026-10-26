import { assertIsoDate, dateInZone } from "../lib/dates.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { NewTask, Note, Priority, Status, Task, TaskStore } from "../store/taskStore.js";

/** Every write returns either a preview (nothing changed) or the result of the change. */
export type WriteResult<T> = { kind: "preview"; message: string; planned: unknown } | { kind: "done"; message: string; value: T };

export interface TaskWithNotes extends Task {
  notes: Note[];
}

export interface DailyReport {
  date: string;
  timezone: string;
  done: Task[];
  inProgress: Task[];
  blocked: (Task & { reason: string | null })[];
  overdue: Task[];
  next: Task[];
}

export interface ServiceOptions {
  timezone: string;
  /** Injected clock so tests can fix "today". */
  now?: () => Date;
}

const MAX_LIST = 100;
const REPORT_SCAN_LIMIT = 1000;

/**
 * Business rules live here, not in the tools and not in the store.
 * Safety rules (dry run, delete confirmation) are enforced in this class so that
 * no tool, prompt or agent can skip them.
 */
export class TaskService {
  private readonly now: () => Date;
  readonly timezone: string;

  constructor(
    private readonly store: TaskStore,
    opts: ServiceOptions,
  ) {
    this.now = opts.now ?? (() => new Date());
    this.timezone = opts.timezone;
  }

  // ---------- reads ----------

  listTasks(input: { status?: Status; assignee?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_LIST);
    const filter = { status: input.status, assignee: input.assignee };
    const tasks = this.store.listTasks({ ...filter, limit, offset: input.offset ?? 0 });
    const total = this.store.countTasks(filter);
    return { tasks, total, returned: tasks.length, offset: input.offset ?? 0 };
  }

  getTask(id: number): TaskWithNotes {
    const task = this.store.getTask(id);
    if (!task) throw new NotFoundError("Task", id);
    return { ...task, notes: this.store.getNotes(id) };
  }

  searchTasks(query: string, limit = 20): Task[] {
    const q = query.trim();
    if (q.length < 2) throw new ValidationError("Search query must be at least 2 characters.");
    return this.store.searchTasks(q, Math.min(Math.max(limit, 1), MAX_LIST));
  }

  today(): string {
    return dateInZone(this.now(), this.timezone);
  }

  dailyReport(date?: string): DailyReport {
    const day = date ?? this.today();
    assertIsoDate(day, "date");

    const all = this.store.listTasks({ limit: REPORT_SCAN_LIMIT });
    const localDay = (iso: string) => dateInZone(new Date(iso), this.timezone);
    const open = (t: Task) => t.status !== "done";

    const blocked = all
      .filter((t) => t.status === "blocked")
      .map((t) => {
        const notes = this.store.getNotes(t.id);
        return { ...t, reason: notes.at(-1)?.text ?? null };
      });

    const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    const next = all
      .filter((t) => t.status === "todo")
      .sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"),
      )
      .slice(0, 5);

    return {
      date: day,
      timezone: this.timezone,
      done: all.filter((t) => t.status === "done" && localDay(t.updatedAt) === day),
      inProgress: all.filter((t) => t.status === "in_progress"),
      blocked,
      overdue: all.filter((t) => open(t) && t.dueDate !== null && t.dueDate < day),
      next,
    };
  }

  // ---------- writes ----------

  createTask(input: NewTask, dryRun: boolean): WriteResult<Task> {
    const title = input.title.trim();
    if (!title) throw new ValidationError("Title can't be empty.");
    if (input.dueDate) assertIsoDate(input.dueDate, "due_date");

    const planned: NewTask = {
      title,
      description: input.description?.trim() || null,
      priority: input.priority ?? "medium",
      assignee: input.assignee?.trim() || null,
      dueDate: input.dueDate ?? null,
      status: "todo",
    };

    if (dryRun) {
      return {
        kind: "preview",
        message: `Dry run: would create task "${title}" (priority ${planned.priority}${planned.assignee ? `, assignee ${planned.assignee}` : ""}${planned.dueDate ? `, due ${planned.dueDate}` : ""}). Nothing was saved.`,
        planned,
      };
    }
    const task = this.store.createTask(planned, this.now().toISOString());
    return { kind: "done", message: `Created task ${task.id} "${task.title}".`, value: task };
  }

  updateTaskStatus(input: { id: number; status: Status; note?: string }, dryRun: boolean): WriteResult<Task> {
    const task = this.store.getTask(input.id);
    if (!task) throw new NotFoundError("Task", input.id);
    const note = input.note?.trim() || null;

    if (input.status === "blocked" && !note) {
      throw new ValidationError("A note explaining why is required when marking a task blocked.");
    }
    if (task.status === input.status && !note) {
      throw new ValidationError(`Task ${task.id} is already ${task.status}.`);
    }

    const change = `task ${task.id} "${task.title}" from ${task.status} to ${input.status}${note ? " and add a note" : ""}`;
    if (dryRun) {
      return { kind: "preview", message: `Dry run: would change ${change}. Nothing was saved.`, planned: { ...input, note } };
    }
    const updated = this.store.updateStatus(task.id, input.status, note, this.now().toISOString());
    return { kind: "done", message: `Changed ${change.replace(/ and add a note$/, "")}${note ? " with a note" : ""}.`, value: updated };
  }

  addNote(input: { taskId: number; text: string }, dryRun: boolean): WriteResult<Note> {
    const task = this.store.getTask(input.taskId);
    if (!task) throw new NotFoundError("Task", input.taskId);
    const text = input.text.trim();
    if (!text) throw new ValidationError("Note text can't be empty.");

    if (dryRun) {
      return { kind: "preview", message: `Dry run: would add a note to task ${task.id} "${task.title}". Nothing was saved.`, planned: { taskId: task.id, text } };
    }
    const note = this.store.addNote(task.id, text, this.now().toISOString());
    return { kind: "done", message: `Added note ${note.id} to task ${task.id}.`, value: note };
  }

  /**
   * Deleting is destructive, so it needs explicit confirmation.
   * Without confirm: true this only describes what would be deleted.
   */
  deleteTask(input: { id: number; confirm?: boolean }): WriteResult<{ id: number }> {
    const task = this.store.getTask(input.id);
    if (!task) throw new NotFoundError("Task", input.id);
    const noteCount = this.store.getNotes(task.id).length;
    const what = `task ${task.id} "${task.title}" and ${noteCount} note${noteCount === 1 ? "" : "s"}`;

    if (input.confirm !== true) {
      return {
        kind: "preview",
        message: `This will permanently delete ${what}. Nothing has been deleted yet. Ask the user to confirm, then call delete_task again with confirm: true.`,
        planned: { id: task.id, notes: noteCount },
      };
    }
    this.store.deleteTask(task.id);
    return { kind: "done", message: `Deleted ${what}.`, value: { id: task.id } };
  }
}
