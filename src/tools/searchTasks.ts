import { z } from "zod";
import { defineTool, READ_ONLY, respond } from "./types.js";

export const searchTasks = defineTool({
  name: "search_tasks",
  title: "Search tasks",
  description: "Search task titles, descriptions and notes for some text. Use a short keyword, for example 'invoice' or 'login'.",
  inputSchema: {
    query: z.string().min(2).max(100).describe("Text to look for, 2 to 100 characters. Not case-sensitive."),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum results, 1 to 100. Default 20."),
  },
  annotations: READ_ONLY,
  handler: async ({ query, limit }, { service }) => {
    const tasks = service.searchTasks(query, limit);
    return respond(tasks.length ? `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"} matching "${query}".` : `No tasks match "${query}".`, tasks);
  },
});
