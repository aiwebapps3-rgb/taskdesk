# TaskDesk MCP

An MCP server that lets an AI agent read and manage a team task list safely. It's built in TypeScript on the official MCP SDK, with SQLite storage, and was built and reviewed with Claude Code.

## What it does

TaskDesk gives an agent (Claude Code, Claude Desktop or any MCP client) eight tools, one resource and one prompt.

| Tool | What it does | Safety |
| --- | --- | --- |
| `list_tasks` | List tasks, filter by status or assignee, with paging | read-only |
| `get_task` | One task with all its notes | read-only |
| `search_tasks` | Search titles, descriptions and notes | read-only |
| `create_task` | Create a task | `dry_run` |
| `update_task_status` | Change status, optional note (required for blocked) | `dry_run` |
| `add_note` | Add a note to a task | `dry_run` |
| `delete_task` | Delete one task and its notes | preview first, then `confirm: true` |
| `daily_report` | Done today, in progress, blocked with reason, overdue, next | read-only |

- **Resource:** `taskdesk://tasks/{id}`, a task with notes as JSON
- **Prompt:** `daily_standup`, which writes the daily update from `daily_report`

## Safety design

| Risk | What stops it |
| --- | --- |
| Agent saves something it should only preview | `dry_run` is checked in the service layer. Tests spy on the store to prove no write method runs. |
| Agent deletes without asking | `delete_task` returns a preview unless `confirm: true`. Enforced in code, not just in the description. No bulk delete exists. |
| Agent changes many tasks at once | Write tools change one task per call. The server instructions tell the agent to check with the user first. |
| Bad input | Every field is validated with zod. Dates must be real `YYYY-MM-DD` dates. Lengths and limits are capped. |
| SQL injection | Parameterised SQL only, checked by a hook and a test. `LIKE` wildcards are escaped. |
| Leaking internals | Expected errors return short messages (`Task 9 not found.`). Unexpected ones return a reference id; details go to stderr only. |
| Leaking secrets | Config comes from env vars. The audit log redacts sensitive keys and key-shaped strings. |
| Breaking the stdio protocol | Nothing writes to stdout. Blocked by an ESLint rule and a Claude Code hook. |
| Not knowing what the agent did | Every tool call goes to `logs/audit.jsonl` with time, tool, redacted arguments, outcome and duration, including calls rejected by validation (`outcome: "invalid"`). |

## Requirements

- Node.js 22.12 or newer (`node -v`)
- Claude Code, to use it with an agent

## Setup

```bash
npm install
npm run build
npm run seed
```

**Windows without Visual Studio:** if `npm install` fails with a `node-gyp` "Could not find any Visual Studio installation" error, run `npm install --ignore-scripts` instead. `better-sqlite3` 13 ships a ready-made `win32-x64` binary inside the package, but npm still runs `node-gyp`, which looks for Visual Studio before it checks for that binary. Skipping install scripts loads the bundled binary directly.

**PowerShell says "running scripts is disabled":** run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once, or use `npm.cmd` instead of `npm`.

Optional: copy `.env.example` to `.env` to change paths, time zone or transport. The defaults work without it.

## Try it

**MCP Inspector** (opens in the browser):

```bash
npm run inspect
```

**Claude Code:** the repo includes `.mcp.json`. Open this folder in Claude Code, approve the `taskdesk` server when asked, then run `/mcp` to check it's connected. Try:

- "What is blocked right now and why?"
- "Show me what you'd create for a webhook test task, but don't save it."
- "Delete the old onboarding task."
- `/daily-standup`

More cases with expected results are in `tests/agent-cases.md`.

**Claude Desktop:** open Settings → Developer → Edit Config and add this at the top level of `claude_desktop_config.json`, using your own path to the repo. Then fully quit and reopen Claude Desktop.

```json
"mcpServers": {
  "taskdesk": {
    "command": "node",
    "args": ["C:\\path\\to\\task_mcp\\dist\\index.js"]
  }
}
```

The server finds `data/` and `logs/` relative to its own folder, so no other settings are needed.

**HTTP mode** (optional, for a hosted setup):

```bash
# PowerShell: $env:TASKDESK_HTTP_TOKEN = "<long random value>"
TASKDESK_HTTP_TOKEN=<long random value> npm run start:http
```

This serves `http://127.0.0.1:3333/mcp`, and requests without `Authorization: Bearer <token>` are rejected. A real shared deployment should use OAuth per user, as the MCP authorization spec describes, not a shared token.

## Tests

```bash
npm test        # builds first, then runs everything
npm run typecheck
npm run lint
```

There are 47 tests:

- **Store:** CHECK constraints, cascade delete, SQL injection text stored as plain text, search escaping, sorting, paging.
- **Service:** dry run writes nothing (spies on the store), delete needs confirm, a note is required for blocked, date validation, time zone for "today", daily report grouping.
- **Lib:** redaction (nested keys, key-shaped strings), dates, audit wrapper error handling, config validation.
- **Integration:** starts the built server and talks to it over stdio with the official MCP client. Covers tool list and annotations, a description on every field, dry run, delete with and without confirm, bad input, resource, prompt, daily report and the audit log.

CI runs typecheck, lint and tests on Ubuntu and Windows with Node 22 and 24.

## Project layout

```
src/
  index.ts        entry point: stdio or HTTP transport, clean shutdown
  server.ts       registers tools, resource and prompt; wraps every tool with withAudit
  config.ts       env vars validated with zod, paths resolved from the project root
  tools/          one file per tool, plus the registry
  services/       business rules (dry run, confirm, report)
  store/          TaskStore interface and the SQLite implementation
  resources/      taskdesk://tasks/{id}
  prompts/        daily_standup
  lib/            audit, redact, errors, dates, stderr logger
tests/            unit and integration tests, agent cases
scripts/seed.ts   demo data (only wipes a database inside data/)
```

Architecture, design patterns and decisions are in `docs/`.

## How this was built

It was built with Claude Code, with guardrails set up before any code:

- `CLAUDE.md` holds the project rules: no stdout in stdio mode, zod everywhere, dry run in the service layer, parameterised SQL, no secrets.
- `.claude/hooks/guard.mjs` blocks edits to `.env`, hard-coded secrets, stdout writes in server code, and SQL built with template strings.
- `.claude/agents/` has `code-reviewer` and `security-reviewer` subagents for independent review.
- `.claude/skills/` has `/start-phase`, `/review-phase`, `/log-mistake`, and a read-only `daily-standup` skill.
- `BUILD_LOG.md` records real mistakes found during the build and what changed because of them.

## Local or hosted?

stdio (the default) suits a personal server: it's simple to run, and keys stay on your own machine. For a shared team server, run over Streamable HTTP with OAuth per user, so each person only sees what they're allowed to see.

## Ready-made or custom?

Use a maintained connector first when one exists with sensible scopes. Build custom when the tools you need are missing, the connector asks for too much access, or the system is internal. TaskDesk is custom because it demonstrates the whole pattern end to end.

## Known limits

- One local SQLite file, so it's single-user. Fine for a personal stdio server, not for a team.
- The daily report scans up to 1,000 tasks in memory.
- HTTP mode uses one shared bearer token and runs stateless. It's a demo, not production auth.
- No user identity: anyone who can call the server can change any task.
- The audit log grows forever. Rotation isn't implemented.

## Next steps

- OAuth for HTTP mode
- A Notion or CRM backend behind `TaskStore`
- Per-user permissions, for example only the assignee can close a task
