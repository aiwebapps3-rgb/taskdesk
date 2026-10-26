# Decisions

Short records of choices already made. If one needs to change, add a new entry instead of editing the old one.

## D1. TypeScript and the official MCP SDK

- **Decision:** TypeScript on Node 20+, using `@modelcontextprotocol/sdk`.
- **Why:** The job post lists TypeScript/Node. The official SDK tracks the spec, so less custom protocol code.
- **Trade-off:** SDK method names change between versions. We check the installed version before each phase.

## D2. SQLite behind a repository interface

- **Decision:** SQLite via `better-sqlite3`, accessed only through `TaskStore`.
- **Why:** Runs locally with no accounts, real SQL for the full-stack part, and the interface lets us add Notion or a CRM later.
- **Fallback:** If `better-sqlite3` fails to build on Windows, use Node's built-in `node:sqlite` if available in the installed Node version, or a JSON file store, behind the same interface. Record which one in BUILD_LOG.

## D3. stdio first, HTTP later

- **Decision:** Ship stdio in the main build. Streamable HTTP is a stretch goal.
- **Why:** stdio is the simplest way to run a personal server in Claude Code, and keys stay on the user's machine.
- **When to change:** For a shared team server, host over Streamable HTTP with OAuth per user, as the MCP authorization spec describes. A shared bearer token is only acceptable for a demo.

## D4. Safety enforced in code, not in prompts

- **Decision:** Dry run and delete confirmation live in the service layer. Tool annotations are added as hints only.
- **Why:** An agent can ignore a description or an annotation. It cannot skip a check in the server.

## D5. Report timezone

- **Decision:** `daily_report` uses `TASKDESK_TIMEZONE` (default `Asia/Karachi`) to decide what "today" means. Timestamps are stored in UTC ISO format.
- **Why:** The team works across Pakistan, the Middle East and US Eastern hours. Storing UTC and converting at report time avoids tasks landing on the wrong day.
- **Open question:** Confirm with the PM which timezone the daily report should follow.

## D6. Errors

- **Decision:** Tools return short, plain messages for expected errors (`Task 42 not found`) and a generic message for unexpected ones. Full details go to stderr and the audit log.
- **Why:** Agents act better on clear messages, and stack traces can leak paths or data.

## D7. Audit log as JSON Lines

- **Decision:** One JSON object per tool call in `logs/audit.jsonl`, with keys whose names contain `token`, `key`, `secret`, `password` or `authorization` replaced by `[REDACTED]`.
- **Why:** Easy to grep, easy to load into a dashboard, and it answers "what did the agent actually do?"

## D8. Versions in use

- **Decision:** `@modelcontextprotocol/sdk` 1.32.2, zod 4, `better-sqlite3` 13, Node 22.12 or newer.
- **Why:** These were current when the project was built. The SDK accepts zod 3.25+ or 4. `better-sqlite3` 13 and `vitest` 5 need Node 22 or newer.
- **Note:** The SDK registration API used is `registerTool`, `registerResource` (with `ResourceTemplate`) and `registerPrompt`. The older `tool()` and `prompt()` methods are deprecated in this version.

## D9. HTTP mode is stateless

- **Decision:** In HTTP mode, each POST to `/mcp` gets a fresh server and transport (no session ids). It listens on 127.0.0.1 only and checks a bearer token with a constant-time compare.
- **Why:** It's the simplest correct setup for a demo, with nothing to clean up between requests.
- **Trade-off:** No server-sent notifications or sessions. Real hosting needs OAuth, TLS and probably sessions.
