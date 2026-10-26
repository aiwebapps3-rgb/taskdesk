import { z } from "zod";
import { defineTool, fields, respond, WRITE } from "./types.js";

export const createTask = defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Create a new task with status todo. Set dry_run to true to preview without saving. " +
    "Dates must be YYYY-MM-DD; work out real dates from words like 'next Friday' before calling.",
  inputSchema: {
    title: z.string().min(1).max(200).describe("Short task title, up to 200 characters, for example 'Set up Notion connector'."),
    description: z.string().max(4000).optional().describe("Optional details, up to 4000 characters."),
    priority: fields.priority.default("medium"),
    assignee: z.string().min(1).max(100).optional().describe("Person responsible, for example 'Saud'."),
    due_date: fields.date.optional(),
    dry_run: fields.dryRun,
  },
  annotations: WRITE,
  handler: async (args, { service }) => {
    const r = service.createTask(
      { title: args.title, description: args.description, priority: args.priority, assignee: args.assignee, dueDate: args.due_date },
      args.dry_run,
    );
    return r.kind === "preview" ? respond(r.message, r.planned, "preview") : respond(r.message, r.value);
  },
});
