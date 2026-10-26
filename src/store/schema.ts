// Kept as a TypeScript string, not a .sql file: tsc does not copy .sql files into dist/.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 4000),
  status      TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo','in_progress','blocked','done')),
  priority    TEXT NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high')),
  assignee    TEXT,
  due_date    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_notes_task ON notes(task_id);
`;
