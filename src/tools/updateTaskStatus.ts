import { z } from "zod";
import { defineTool, fields, respond, WRITE } from "./types.js";

export const updateTaskStatus = defineTool({
  name: "update_task_status",
  title: "Update task status",
  description:
    "Change one task's status, optionally adding a note. A note is required when setting status to blocked. " +
    "Changes one task per call; if the user asks to change many tasks, list them and confirm with the user first. " +
    "Set dry_run to true to preview.",
  inputSchema: {
    id: fields.taskId,
    status: fields.status,
    note: z.string().min(1).max(2000).optional().describe("Optional note, for example 'Fix is in PR 12'. Required when status is blocked."),
    dry_run: fields.dryRun,
  },
  annotations: WRITE,
  handler: async (args, { service }) => {
    const r = service.updateTaskStatus({ id: args.id, status: args.status, note: args.note }, args.dry_run);
    return r.kind === "preview" ? respond(r.message, r.planned, "preview") : respond(r.message, r.value);
  },
});
