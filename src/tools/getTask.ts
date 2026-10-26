import { defineTool, fields, READ_ONLY, respond } from "./types.js";

export const getTask = defineTool({
  name: "get_task",
  title: "Get task",
  description: "Get one task by id, including all of its notes. Use this to find out why a task is blocked.",
  inputSchema: { id: fields.taskId },
  annotations: READ_ONLY,
  handler: async ({ id }, { service }) => {
    const task = service.getTask(id);
    return respond(`Task ${task.id}: ${task.title} (${task.status}, ${task.notes.length} notes).`, task);
  },
});
