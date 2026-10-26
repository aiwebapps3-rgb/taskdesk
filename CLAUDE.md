# TaskDesk MCP

An MCP server that lets an AI agent read and manage a team task list. TypeScript, official MCP SDK, SQLite, stdio transport first.

Read these before doing any work:

- `docs/PLAN.md` for the phases and what "done" means for each one
- `docs/ARCHITECTURE.md` for layers, patterns and folder layout
- `docs/DECISIONS.md` for decisions already made (don't reopen them without asking)

## How we work

- Work one phase at a time from `docs/PLAN.md`. Never start the next phase on your own.
- Start every phase by proposing a short plan: files you will create or change, and how you will test them. Wait for my OK.
- After each phase, stop and give me: changed files, how to test them, and anything you were unsure about.
- If something is unclear, ask. Don't guess on data model, security or anything that deletes data.
- Keep changes small. One phase is one commit, unless I say otherwise.
- When you are unsure an SDK method or option exists, say so and check `node_modules` types or the official docs. Never invent an API.

## Hard rules (never break these)

1. **stdout belongs to the MCP protocol.** In stdio mode, never use `console.log`, `process.stdout.write` or any library that prints to stdout. Logs go to stderr (`console.error`) or to `logs/`.
2. **Validate every tool input with zod.** Every schema field has a `.describe()` written for the agent, with an example where useful.
3. **Parameterised SQL only.** No string building or template literals in SQL.
4. **Dry run is enforced in the service layer.** Every write tool accepts `dry_run`. In dry run the service returns a preview and never calls a store write method.
5. **Deletes need `confirm: true`.** Without it, `delete_task` returns a preview of what would be deleted and changes nothing. This is enforced in code, not only in the tool description.
6. **No secrets in code, tests, logs, docs or commits.** Read them from environment variables. Never print them. `.env` stays out of Git.
7. **Errors to the agent are short and useful.** For example `Task 42 not found`. No stack traces, no SQL text, no file paths. Full details go to stderr.
8. **Every tool call is audited** through the `withAudit` wrapper, with secrets redacted.
9. **Dates are `YYYY-MM-DD`.** Convert natural dates ("next Friday") before calling a tool. The server rejects anything else.
10. **Don't edit tests to make them pass.** If a test fails, fix the code or tell me why the test is wrong.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Build | `npm run build` |
| Dev (watch) | `npm run dev` |
| Unit and integration tests | `npm test` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Seed demo data | `npm run seed` |
| MCP Inspector | `npm run inspect` |

These scripts are created in Phase 0. If a script is missing, say so rather than inventing a different command.

## Where things go

- New tool: `src/tools/<toolName>.ts`, exported as a `ToolDefinition`, added to `src/tools/index.ts`. Business logic goes in `src/services/taskService.ts`, not in the tool file.
- New storage backend: implement `TaskStore` in `src/store/`. Nothing outside `src/store/` may import a database driver.
- Shared helpers: `src/lib/`.
- Tests: `tests/unit/` for services and store, `tests/integration/` for the real server over stdio.

## Review checklist (run before saying a phase is done)

- [ ] I re-read every changed line
- [ ] Every SDK and library call exists in the installed version
- [ ] No stdout writes in server code
- [ ] All SQL is parameterised
- [ ] Bad input returns a clear error, not a crash
- [ ] Dry run and confirm paths have tests
- [ ] No secrets anywhere in the diff
- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass

## Build log

When something you wrote turns out wrong (a made-up API, a bug, a missed edge case), tell me plainly so I can record it in `BUILD_LOG.md`. Don't hide or quietly fix mistakes. I write the log entries myself.
