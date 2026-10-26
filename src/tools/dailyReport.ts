import { defineTool, fields, READ_ONLY, respond } from "./types.js";

export const dailyReport = defineTool({
  name: "daily_report",
  title: "Daily report",
  description:
    "Build the daily progress report: tasks done that day, in progress, blocked (with the latest note as the reason), " +
    "overdue, and the next todo tasks by priority. 'Today' uses the server's configured time zone.",
  inputSchema: {
    date: fields.date.optional().describe("Report date in YYYY-MM-DD. Leave out for today in the server's time zone."),
  },
  annotations: READ_ONLY,
  handler: async ({ date }, { service }) => {
    const r = service.dailyReport(date);
    const summary =
      `Daily report for ${r.date} (${r.timezone}): ${r.done.length} done, ${r.inProgress.length} in progress, ` +
      `${r.blocked.length} blocked, ${r.overdue.length} overdue.`;
    return respond(summary, r);
  },
});
