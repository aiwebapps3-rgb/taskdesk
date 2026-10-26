import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/** A reusable prompt clients can offer as a slash command: write the daily update. */
export function registerDailyStandupPrompt(server: McpServer): void {
  server.registerPrompt(
    "daily_standup",
    {
      title: "Daily standup",
      description: "Write today's progress update for the Project Manager from the task list.",
      argsSchema: {
        date: z.string().optional().describe("Report date in YYYY-MM-DD. Leave empty for today."),
      },
    },
    ({ date }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Call the daily_report tool${date ? ` with date ${date}` : ""}.`,
              "Then write a short update under 150 words with four sections: Done, In progress, Blocked, Next.",
              "For each blocked task give the reason and what is needed to unblock it.",
              "Mention overdue tasks under Blocked or Next.",
              "Only report what the tool returned. Do not change any tasks.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
