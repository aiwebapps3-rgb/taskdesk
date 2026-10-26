# Build log

Real problems found while building TaskDesk, how they were caught, and what changed so they don't happen again.

The first version was built in one Claude Code session on 2026-10-25, with the plan, rules and review steps set up first. Every entry below actually happened. Add new entries with `/log-mistake` and correct them by hand.

## 2026-10-25, planning: schema file would not reach the build

- **What the AI did:** The first plan put the database schema in `src/store/schema.sql`.
- **What went wrong:** `tsc` only compiles `.ts` files. It does not copy `.sql` files into `dist/`, so the built server would have crashed on startup looking for the schema.
- **How it was caught:** Reviewing the plan before any code was written.
- **Fix:** The schema is a TypeScript string in `src/store/schema.ts`.
- **Lesson:** Check what the build actually outputs, not just what the source looks like.

## 2026-10-25, store: SQL built with a template string

- **What the AI did:** Put a shared `ORDER BY` clause in a constant and inserted it into queries with `${ORDER_BY}`.
- **What went wrong:** The value was a constant, so it wasn't exploitable, but it broke the project's rule "no template literals in SQL", and the guard hook would have blocked the edit. It also makes reviewing harder, because a reviewer has to check every `${}` in SQL by hand.
- **How it was caught:** Self-review against the rules in `CLAUDE.md` before running anything.
- **Fix:** Wrote the `ORDER BY` out in each query. Only `?` and `@name` parameters are used in SQL.
- **Lesson:** Follow the rule literally, even when the exception looks safe. Rules that have exceptions stop being checkable.

## 2026-10-25, resource: original error dropped on re-throw

- **What the AI did:** In the task resource, caught an error and threw a new, shorter one for the client.
- **What went wrong:** The new error didn't keep the original as its `cause`, so the real reason would be lost when debugging.
- **How it was caught:** `npm run lint` (`preserve-caught-error` rule).
- **Fix:** `throw new Error(message, { cause: err })`. The client still only sees the short message.
- **Lesson:** Run lint as part of every review, not just tests. It caught something the tests didn't.

## 2026-10-25, testing: wrong conclusion from a broken experiment

- **What the AI did:** To show why stdout must stay clean, made a copy of the build with a `console.log` added and connected to it. The connection closed, and the first conclusion was "a stray console.log kills the connection".
- **What went wrong:** The copy was placed outside the project folder, so it crashed because it couldn't find `node_modules`. The `console.log` wasn't the cause.
- **How it was caught:** Questioned the result before writing it down, and re-ran the test inside the project.
- **Real result:** The client reports `"TaskDesk started" is not valid JSON` as a transport error. This SDK client then recovers and lists the tools. Other clients may behave differently. A log line printed in the middle of a response is more dangerous than one at startup.
- **Fix:** No code change needed, because the lint rule and guard hook already block stdout writes. The demo notes were corrected.
- **Lesson:** Make sure an experiment fails for the reason you think it does before you trust the result.

## 2026-10-25, setup: wrong minimum Node version

- **What the AI did:** Set `"engines": { "node": ">=20" }`, put Node 20 in the CI matrix, and the plan said "Node 20 or newer".
- **What went wrong:** The installed `better-sqlite3` needs Node 22 or newer and `vitest` needs 22.12 or newer. On Node 20, install or tests would fail on a fresh machine.
- **How it was caught:** Checked each dependency's `engines` field before writing the README.
- **Fix:** `engines` is now `>=22.12`, added `.nvmrc`, CI tests Node 22 and 24.
- **Lesson:** Check the version requirements of what was actually installed, not what you remember.
