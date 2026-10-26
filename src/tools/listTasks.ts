import { z } from "zod";
import { defineTool, fields, READ_ONLY, respond } from "./types.js";

export const listTasks = defineTool({
  name: "list_tasks",
  title: "List tasks",
  description:
    "List tasks from the team task list, optionally filtered by status or assignee. " +
    "Results are sorted blocked, in progress, todo, then done, and by priority. Returns at most `limit` tasks plus the total count.",
  inputSchema: {
    status: fields.status.optional(),
    assignee: z.string().min(1).max(100).optional().describe("Only tasks assigned to this person (case-insensitive), for example 'Saud'."),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum tasks to return, 1 to 100. Default 20."),
    offset: z.number().int().min(0).default(0).describe("Skip this many tasks, for paging. Default 0."),
  },
  annotations: READ_ONLY,
  handler: async (args, { service }) => {
    const r = service.listTasks(args);
    const summary =
      r.total === 0
        ? "No tasks match."
        : `Showing ${r.returned} of ${r.total} task${r.total === 1 ? "" : "s"}${r.total > r.offset + r.returned ? ` (use offset ${r.offset + r.returned} for more)` : ""}.`;
    return respond(summary, r.tasks);
  },
});
