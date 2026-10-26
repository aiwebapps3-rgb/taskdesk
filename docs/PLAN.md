# Build plan

> **Status, 2026-10-25:** phases 0 to 9 were built in one Claude Code session (including the Streamable HTTP stretch goal). 47 tests pass. What's left for you: Phase 6's live agent cases in Claude Code, and pushing to GitHub (Phase 8). The phases below stay as the record of how the project was structured.

Nine phases. Each one ends with something you can run and check. Use `/start-phase <n>` in Claude Code to begin a phase and `/review-phase` before committing.

Times are rough estimates, not promises. Sunday target: phases 0 to 6. Monday morning: 7 and 8. Phase 9 only if there is spare time.

## How every phase runs

1. `/start-phase <n>`. Claude reads this file and proposes a plan. Read it and correct it before saying OK.
2. Claude builds. Watch the diffs.
3. Run the phase's **Check** steps yourself, by hand.
4. `/review-phase`. This runs the checklist and the `code-reviewer` subagent.
5. If anything was wrong, `/log-mistake`, then edit the entry so it says what really happened.
6. Commit.

---

## Phase 0: project setup (30 min)

**Build**

- Check `node -v` is 22.12 or newer (`better-sqlite3` and `vitest` need it).
- `git init`, `npm init -y`, set `"type": "module"`.
- Install runtime deps: `@modelcontextprotocol/sdk`, `zod`, `better-sqlite3`, `dotenv`.
- Install dev deps: `typescript`, `tsx`, `vitest`, `@types/node`, `@types/better-sqlite3`, `eslint`, `typescript-eslint`, `prettier`.
- `tsconfig.json`: strict mode, `module` and `moduleResolution` set to `NodeNext`, `outDir: dist`.
- Scripts: `build`, `dev`, `start`, `test`, `typecheck`, `lint`, `seed`, `inspect` (`npx @modelcontextprotocol/inspector node dist/index.js`).
- ESLint rule `no-console` with `console.error` allowed, so stdout writes are caught automatically. Use the flat config file `eslint.config.js`.
- Add a `pretest` script that runs `npm run build`, because the integration test starts `dist/index.js`.
- Check that zod works with the SDK: run `npm ls zod` and read the SDK README for which zod major version it expects. A mismatch causes confusing type errors later.
- Optional: a GitHub Actions workflow that runs typecheck, lint and test on every push. A green badge looks good in the demo.

**Check**

- `git check-ignore .env` prints `.env`.
- `npm run typecheck` and `npm run lint` run without errors on an empty `src/index.ts`.
- Note the installed SDK version in `docs/DECISIONS.md`.

## Phase 1: config, errors, logger, store (1 hour)

**Build**

- `src/config.ts`: read and validate env with zod.
- `src/lib/logger.ts` (stderr only) and `src/lib/errors.ts`.
- `src/store/taskStore.ts` interface first. Show it to me before writing the implementation.
- `src/store/sqliteTaskStore.ts` and `src/store/schema.ts`. Keep the schema as a TypeScript string, not a `.sql` file, because `tsc` does not copy `.sql` files into `dist/`. Turn on foreign keys.
- Create the `data/` and `logs/` folders on startup if they don't exist, or SQLite and the audit log will fail on a fresh clone.
- `seed.ts` resets the database first and refuses to run unless the DB path is the demo one, so it can never wipe real data.
- `scripts/seed.ts`: about 10 tasks. Include some done today, two blocked with notes, one overdue, one high priority todo, one about invoices.
- Unit tests for the store.

**Check**

- Insert status `"finished"` directly and confirm SQLite rejects it.
- Delete a task with notes and confirm the notes are gone (cascade).
- Store the title `'); DROP TABLE tasks; --` and read it back unchanged.

## Phase 2: service layer (1 hour)

**Build**

- `src/services/taskService.ts` with all read and write methods.
- Write methods take `dryRun` and return either `{ kind: "preview", ... }` or `{ kind: "done", ... }`.
- `deleteTask` without `confirm` returns a preview with the note count.
- `src/lib/dates.ts`: validate `YYYY-MM-DD`, "today" in the configured timezone.
- Unit tests using an in-memory store. Use a spy to prove dry run never calls a write method.

**Check**

- Tests for dry run, confirm, not found and invalid date all pass.
- Ask Claude: "Which timezone decides 'today' and why?" Compare its answer with D5.

## Phase 3: minimal MCP server over stdio (1 hour)

**Build**

- `src/tools/types.ts` (`ToolDefinition`), `src/tools/index.ts` (registry).
- `listTasks.ts` and `getTask.ts` only.
- `src/server.ts` `createServer(deps)` loops over the registry.
- `src/index.ts` connects with the stdio transport.
- Expected errors (not found, bad input, confirm needed) are returned as a normal tool result with `isError: true` and a short message, so the agent can read them and recover. Only real bugs should throw.
- Clean shutdown: close the database when the process gets SIGINT or SIGTERM, or when stdin closes.

**Prompt addition:** "Before writing code, tell me the installed SDK version and the exact methods you will use to register tools, and show me where they are defined in `node_modules`."

**Check**

- `npm run build && npm run inspect`. Both tools show up with clear descriptions.
- `get_task` with id 9999 returns `Task 9999 not found`, not a crash.
- **Guardrail test:** ask Claude to add `console.log("started")` to `index.ts`. The guard hook should block it. Take a screenshot for the demo.
- **Deliberate bug:** now add that line yourself in your editor, rebuild, reconnect in Inspector and note what happens. Check that `npm run lint` flags it too. Remove it and write a BUILD_LOG entry.

## Phase 4: write tools (1.5 hours)

**Build**

- `searchTasks.ts`, `createTask.ts`, `updateTaskStatus.ts`, `addNote.ts`.
- Each write tool has `dry_run` with a description the agent understands.

**Check**

- Count rows, call `create_task` with `dry_run: true`, count again. Same number.
- `due_date: "tomorrow"` is rejected with a clear message.
- Field descriptions read well in Inspector. Would an agent know what to send?

## Phase 5: delete, annotations, audit log (1 hour)

**Build**

- `deleteTask.ts` with `confirm`.
- Annotations: read-only on read tools, destructive on delete.
- `src/lib/redact.ts` and `src/lib/audit.ts` (`withAudit` decorator), applied in `server.ts` to every tool.
- Unit tests for redaction, including nested objects.

**Check**

- `delete_task` without confirm leaves the task in place.
- `logs/audit.jsonl` has one line per call with duration and result kind.
- A fake field `api_key: "abc"` shows as `[REDACTED]` in the log.

## Phase 6: report, resource, prompt, Claude Code connection (1.5 hours)

**Build**

- `dailyReport.ts`: Done (updated today), In progress, Blocked (with latest note), Next (high priority todo).
- `src/resources/taskResource.ts` and `src/prompts/dailyStandup.ts`.
- Check `.mcp.json` works. Restart Claude Code and approve the server. If Claude Code can't find `dist/index.js`, change the path in `.mcp.json` to an absolute one, such as `D:/development/task_mcp/dist/index.js`, and note it in BUILD_LOG.

**Check**

- `/mcp` in Claude Code shows `taskdesk` connected with 8 tools.
- Run every case in `tests/agent-cases.md` and fill in the Result column. Look at the tool calls, not just the answer.

**Sunday stop line.** If you reach 11 PM, stop here even if not everything works.

## Phase 7: integration tests (1 hour, Monday)

**Build**

- `tests/integration/server.test.ts`: build first, spawn `node dist/index.js` with a temp DB, connect with the SDK client over stdio.
- Cover: tools list has 8 tools, dry run create writes nothing, delete without confirm keeps the task, unknown id gives a clean error.

**Check**

- `npm test` runs unit and integration tests and all pass.

## Phase 8: docs and GitHub (1 hour, Monday)

**Build**

- Finish `README.md` (every section filled, real commands).
- Read through `BUILD_LOG.md` and make sure every entry is true.
- Push to a public GitHub repo. Check that no `.env`, `data/` or `logs/` got in.

**Check**

- Clone the repo into a new folder and follow only the README. It must work.

## Phase 9: stretch (only if time is left)

Pick one at most:

- **Streamable HTTP** behind `TASKDESK_TRANSPORT=http` with a bearer token from env. README must say a real deployment needs OAuth.
- **Notion store:** `NotionTaskStore` implementing `TaskStore`, using `NOTION_TOKEN`. Shows how the repository pattern pays off.

## Definition of done for the interview

- [ ] 8 tools, 1 resource, 1 prompt working in Claude Code
- [ ] Dry run and confirm proven by tests
- [ ] Audit log with redaction
- [ ] Hooks and subagents used during the build
- [ ] At least 3 true BUILD_LOG entries
- [ ] README works from a clean clone
- [ ] Demo in `docs/DEMO_SCRIPT.md` rehearsed twice
