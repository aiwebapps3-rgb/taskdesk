/**
 * Storage contract. The service only talks to this interface, so SQLite can be
 * swapped for Notion, a CRM or an HTTP API by writing one new class.
 * Implementations do data access only: no business rules here.
 */

export const STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assignee: string | null;
  dueDate: string | null; // YYYY-MM-DD
  createdAt: string; // ISO timestamp, UTC
  updatedAt: string; // ISO timestamp, UTC
}

export interface Note {
  id: number;
  taskId: number;
  text: string;
  createdAt: string;
}

export interface NewTask {
  title: string;
  description?: string | null;
  priority?: Priority;
  assignee?: string | null;
  dueDate?: string | null;
  status?: Status;
}

export interface TaskFilter {
  status?: Status;
  assignee?: string;
  limit: number;
  offset?: number;
}

export interface TaskStore {
  listTasks(filter: TaskFilter): Task[];
  countTasks(filter?: Omit<TaskFilter, "limit" | "offset">): number;
  getTask(id: number): Task | undefined;
  getNotes(taskId: number): Note[];
  searchTasks(query: string, limit: number): Task[];

  createTask(input: NewTask, now: string): Task;
  /** Changes status and optionally adds a note, as one transaction. */
  updateStatus(id: number, status: Status, note: string | null, now: string): Task;
  addNote(taskId: number, text: string, now: string): Note;
  deleteTask(id: number): void;

  close(): void;
}
