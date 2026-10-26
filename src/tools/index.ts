import { addNote } from "./addNote.js";
import { createTask } from "./createTask.js";
import { dailyReport } from "./dailyReport.js";
import { deleteTask } from "./deleteTask.js";
import { getTask } from "./getTask.js";
import { listTasks } from "./listTasks.js";
import { searchTasks } from "./searchTasks.js";
import type { ToolDefinition } from "./types.js";
import { updateTaskStatus } from "./updateTaskStatus.js";

/** Tool registry. To add a tool: create its file, then add it here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: ToolDefinition<any>[] = [
  listTasks,
  getTask,
  searchTasks,
  createTask,
  updateTaskStatus,
  addNote,
  deleteTask,
  dailyReport,
];
