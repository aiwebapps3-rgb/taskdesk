# 5-minute demo script

Before sharing your screen: close `.env`, any terminal whose history shows keys, and any client files. Run `npm run seed` so the data looks fresh.

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | README on GitHub | "Your team works from written task lists with a daily check-in, so I built an MCP server for exactly that. TypeScript, official SDK, SQLite, built with Claude Code in two days." |
| 0:30 | Claude Code: `/mcp` | "Here it is connected: eight tools, a resource and a prompt." |
| 0:45 | Ask: "What is blocked right now and why?" | Point at the tool calls: `list_tasks` with status blocked, then `get_task`. "I always check which tools it called, not just the answer." |
| 1:45 | Ask: "Delete the old onboarding task." | Show the preview. "The confirm check is in the server code, so the agent can't skip it." Then confirm. |
| 2:30 | Ask: "Show me what you'd create for a webhook test, but don't save it." | Show `dry_run: true`. "Every write tool has this. A test proves nothing is written." |
| 3:00 | Run `/daily-standup` | "This is a Claude Code skill. It writes the daily update from the task list, under 150 words." |
| 3:30 | Open `BUILD_LOG.md` | Tell one real story: what Claude got wrong, how you caught it, what you changed. |
| 4:15 | `.claude/` folder, `logs/audit.jsonl` | "CLAUDE.md sets the rules, a hook blocks unsafe edits, a reviewer subagent checks each phase. Every tool call is logged with secrets redacted. For example, stdout is reserved for the protocol: a stray log line makes the client throw JSON parse errors, so a lint rule and the hook both block it." |
| 4:40 | `docs/ARCHITECTURE.md` diagram | "For your team I'd look for a maintained connector first for Notion, Missive and Google Workspace, and build custom only where tools or scopes are missing. Because of the repository layer, a Notion backend is one new class." |

If something breaks live, stay calm and debug out loud. Showing how you find a problem is part of what they're hiring for.
