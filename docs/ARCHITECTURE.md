# Architecture

TaskDesk is a small layered service. Each layer has one job and only talks to the layer below it. That keeps the MCP part thin, makes the business rules easy to test, and lets us swap SQLite for Notion or a CRM later without touching the tools.

## Layers

```
 Claude Code / Claude Desktop / MCP Inspector      (MCP client)
                     |
                     |  JSON-RPC over stdio  (Streamable HTTP later)
                     v
 +---------------------------------------------------------------+
 | 1. Transport      src/index.ts                                 |
 |    Picks stdio or HTTP from config, starts the server          |
 +---------------------------------------------------------------+
 | 2. MCP adapter    src/server.ts                                |
 |    Registers tools, resource and prompt from the registry      |
 |    Wraps every handler with withAudit + error mapping          |
 +---------------------------------------------------------------+
 | 3. Tools          src/tools/*.ts                               |
 |    zod input schema, description, annotations, thin handler    |
 |    Calls the service and formats the result for the agent      |
 +---------------------------------------------------------------+
 | 4. Service        src/services/taskService.ts                  |
 |    Business rules: dry run, confirm, status rules, reports     |
 |    Throws typed domain errors                                  |
 +---------------------------------------------------------------+
 | 5. Store          src/store/taskStore.ts  (interface)          |
 |                   src/store/sqliteTaskStore.ts                 |
 |    Data access only. Parameterised SQL. No business rules      |
 +---------------------------------------------------------------+
                     |
                     v
              data/taskdesk.db (SQLite)
```

## Design patterns and why each one is here

| Pattern | Where | Why it matters (say this in the interview) |
| --- | --- | --- |
| Layered architecture | whole project | MCP code stays thin. Rules live in one place and are tested without starting a server. |
| Repository | `TaskStore` interface | The service never knows it is SQLite. A Notion or CRM backend is a new class, not a rewrite. |
| Dependency injection | `createServer({ service, audit, config })` | Tests pass an in-memory store, so they are fast and never touch real data. |
| Tool registry | `src/tools/index.ts` exports an array of `ToolDefinition` | Adding a tool is one file plus one line. The server loops over the list, so every tool gets the same wrapping. |
| Decorator (middleware) | `withAudit(name, handler)` in `src/lib/audit.ts` | Logging, timing, redaction and error mapping are applied to every tool the same way. No tool can forget them. |
| Typed domain errors | `src/lib/errors.ts` | `NotFoundError`, `ValidationError`, `ConfirmationRequiredError` map to short agent-friendly messages. Raw errors never leak. |
| Preview then commit | service write methods | Dry run and delete confirmation share one code path: build the plan, return it, only write when allowed. |
| Strategy | transport selection in `src/index.ts` | stdio for local use, Streamable HTTP for a hosted version, same server underneath. |
| Config object | `src/config.ts` | All env vars read and validated in one place at startup. Missing config fails fast with a clear message. |

## Folder layout

```
task_mcp/
  CLAUDE.md                     rules for Claude Code
  README.md                     how to install, run, connect, demo
  BUILD_LOG.md                  real mistakes found while building (written by me)
  .mcp.json                     connects this server to Claude Code
  .env.example                  config keys with fake values
  .gitignore
  .editorconfig
  .claude/
    settings.json               permissions and hooks for Claude Code
    hooks/guard.mjs             blocks unsafe edits (secrets, stdout, .env, SQL templates)
    agents/
      code-reviewer.md          independent reviewer subagent
      security-reviewer.md      secrets, auth and injection review subagent
    skills/
      daily-standup/SKILL.md    uses TaskDesk to write the daily update
      start-phase/SKILL.md      /start-phase: runs one phase of docs/PLAN.md
      review-phase/SKILL.md     /review-phase: review checklist before commit
      log-mistake/SKILL.md      /log-mistake: drafts a BUILD_LOG entry for me to edit
  docs/
    PLAN.md                     phases, prompts, checks
    ARCHITECTURE.md             this file
    DECISIONS.md                short decision records
    DEMO_SCRIPT.md              5-minute interview demo
  scripts/
    seed.ts                     demo data
  src/
    index.ts                    entry point, transport strategy
    server.ts                   createServer(): registers everything
    config.ts                   env parsing with zod
    tools/
      index.ts                  tool registry
      types.ts                  ToolDefinition type
      listTasks.ts  getTask.ts  searchTasks.ts
      createTask.ts updateTaskStatus.ts addNote.ts
      deleteTask.ts dailyReport.ts
    resources/taskResource.ts   taskdesk://tasks/{id}
    prompts/dailyStandup.ts     daily_standup prompt
    services/taskService.ts     business rules
    store/
      taskStore.ts              interface + types
      sqliteTaskStore.ts        SQLite implementation
      schema.sql
    lib/
      audit.ts                  withAudit decorator + JSONL writer
      redact.ts                 secret redaction
      errors.ts                 domain errors + mapping
      dates.ts                  date helpers, timezone aware
      logger.ts                 stderr-only logger
  tests/
    unit/                       service, store, redact, dates
    integration/                real server over stdio via SDK client
    agent-cases.md              natural language cases run in Claude Code
  data/                         SQLite file (git ignored)
  logs/                         audit.jsonl (git ignored)
```

## Request flow (example: `delete_task` without confirm)

1. Claude Code sends `tools/call` with `{ id: 7 }`.
2. The SDK validates input against the zod schema.
3. `withAudit` starts a timer and records the redacted arguments.
4. The tool handler calls `service.deleteTask({ id: 7, confirm: false })`.
5. The service loads task 7 and its notes, sees `confirm` is false, and returns a preview. No store write runs.
6. The handler returns text: `This will delete task 7 "Fix login bug" and 3 notes. Call again with confirm: true.`
7. `withAudit` writes one line to `logs/audit.jsonl` with result `preview` and the duration.

## Tools, resource and prompt

| Name | Kind | Annotation | Safety |
| --- | --- | --- | --- |
| `list_tasks` | tool | read-only | `limit` default 20, max 100 |
| `get_task` | tool | read-only | |
| `search_tasks` | tool | read-only | |
| `create_task` | tool | write | `dry_run` |
| `update_task_status` | tool | write | `dry_run` |
| `add_note` | tool | write | `dry_run` |
| `delete_task` | tool | destructive | `confirm` required |
| `daily_report` | tool | read-only | |
| `taskdesk://tasks/{id}` | resource | | read-only |
| `daily_standup` | prompt | | |

## Data model

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT,
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
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

Foreign keys must be switched on per connection in SQLite (`PRAGMA foreign_keys = ON`), or the cascade does nothing. Worth checking in Phase 1.

## Testing strategy

| Level | What | Tool |
| --- | --- | --- |
| Unit | Service rules (dry run, confirm, status changes, report grouping), redaction, dates | vitest with in-memory SQLite |
| Store | SQL constraints, cascade delete, injection strings stored as text | vitest with a temp DB file |
| Integration | Start the built server, connect with the SDK client over stdio, list and call tools | vitest + MCP SDK client |
| Manual | Schemas, descriptions, error messages | MCP Inspector |
| Agent | Real prompts, check which tools were called | Claude Code + `tests/agent-cases.md` |
