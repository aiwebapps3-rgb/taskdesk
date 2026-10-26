import { z } from "zod";
import { defineTool, fields, respond, WRITE } from "./types.js";

export const addNote = defineTool({
  name: "add_note",
  title: "Add note",
  description: "Add a note to a task, for example a progress update or a reason it is blocked. Set dry_run to true to preview.",
  inputSchema: {
    task_id: fields.taskId,
    text: z.string().min(1).max(2000).describe("The note, up to 2000 characters, for example 'Client approved the design'."),
    dry_run: fields.dryRun,
  },
  annotations: WRITE,
  handler: async (args, { service }) => {
    const r = service.addNote({ taskId: args.task_id, text: args.text }, args.dry_run);
    return r.kind === "preview" ? respond(r.message, r.planned, "preview") : respond(r.message, r.value);
  },
});
