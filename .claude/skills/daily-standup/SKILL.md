---
name: daily-standup
description: Write today's progress update for the Project Manager from the TaskDesk task list. Use when asked for a daily update, standup, check-in or progress report.
allowed-tools: mcp__taskdesk__daily_report mcp__taskdesk__get_task mcp__taskdesk__list_tasks
disallowed-tools: mcp__taskdesk__create_task mcp__taskdesk__update_task_status mcp__taskdesk__add_note mcp__taskdesk__delete_task
---

Write today's daily update using the TaskDesk MCP server.

1. Call the `taskdesk` `daily_report` tool. If the user named a date, pass it as `YYYY-MM-DD`.
2. If a blocked task has no note explaining why, call `get_task` for it to find the reason.
3. Write the update in this shape:

```
Daily update, <date>

Done
- ...

In progress
- ...

Blocked
- <task>: <reason>. Need: <what, from whom>

Next
- ...
```

Rules:

- Under 150 words. Plain English, no jargon.
- Only report what the tools returned. Don't invent progress.
- If a section is empty, write "Nothing today".
- Read only. Do not create, update or delete any tasks while writing the update.
