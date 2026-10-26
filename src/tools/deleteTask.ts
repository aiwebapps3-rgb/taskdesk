import { z } from "zod";
import { DESTRUCTIVE, defineTool, fields, respond } from "./types.js";

export const deleteTask = defineTool({
  name: "delete_task",
  title: "Delete task",
  description:
    "Permanently delete one task and its notes. Call first WITHOUT confirm to get a preview, show it to the user, " +
    "and only call again with confirm: true after the user clearly agrees. Deletes one task per call; there is no bulk delete.",
  inputSchema: {
    id: fields.taskId,
    confirm: z
      .boolean()
      .default(false)
      .describe("Must be true to actually delete. Only set it after the user has seen the preview and agreed."),
  },
  annotations: DESTRUCTIVE,
  handler: async (args, { service }) => {
    const r = service.deleteTask({ id: args.id, confirm: args.confirm });
    return r.kind === "preview" ? respond(r.message, r.planned, "preview") : respond(r.message, r.value);
  },
});
