/**
 * Loads demo data. Wipes the database first, so it only runs against a database
 * inside this project's data/ folder unless --force is given.
 *
 *   npm run seed
 */
import path from "node:path";
import { loadConfig, PROJECT_ROOT } from "../src/config.js";
import { dateInZone } from "../src/lib/dates.js";
import { SqliteTaskStore } from "../src/store/sqliteTaskStore.js";
import type { NewTask } from "../src/store/taskStore.js";

const config = loadConfig();
const demoDir = path.join(PROJECT_ROOT, "data") + path.sep;
if (!config.dbPath.startsWith(demoDir) && !process.argv.includes("--force")) {
  console.error(`Refusing to wipe ${config.dbPath}. It is outside ${demoDir}. Use --force if you are sure.`);
  process.exit(1);
}

const store = new SqliteTaskStore(config.dbPath);
store.reset();

const now = new Date();
const today = dateInZone(now, config.timezone);
const addDays = (n: number) => {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
// "Earlier" activity is placed 3 days back so it never counts as done today in any time zone.
const earlier = hoursAgo(72);

type Seed = NewTask & { notes?: string[]; at?: string };

const tasks: Seed[] = [
  { title: "Fix login bug on the client portal", status: "in_progress", priority: "high", assignee: "Saud", dueDate: addDays(1), description: "Users on Safari get logged out after 5 minutes.", notes: ["Reproduced on Safari 18. Looks like the session cookie SameSite setting."] },
  { title: "Set up Google Workspace MCP connector", status: "blocked", priority: "high", assignee: "Saud", dueDate: addDays(2), notes: ["Waiting for admin to approve the OAuth app in Google Workspace."] },
  { title: "Connect Missive to the AI assistant", status: "blocked", priority: "medium", assignee: "Saud", dueDate: addDays(4), notes: ["Missive MCP access must be turned on by an organisation admin."] },
  { title: "Write onboarding notes for the n8n workflows", status: "todo", priority: "medium", assignee: "Saud", dueDate: addDays(-3), description: "Short guide so the team can restart a failed workflow." },
  { title: "Old onboarding checklist (replaced)", status: "todo", priority: "low", description: "Superseded by the new onboarding notes.", notes: ["Kept for reference until the new notes are done."] },
  { title: "Reconcile March invoices with the CRM", status: "todo", priority: "high", assignee: "Sara", dueDate: addDays(3), description: "Invoice totals in the CRM don't match the accounting export." },
  { title: "Add webhook signature check to the payments endpoint", status: "todo", priority: "high", assignee: "Saud", dueDate: addDays(5) },
  { title: "Deploy daily report automation", status: "done", priority: "medium", assignee: "Saud", at: hoursAgo(1), notes: ["Runs every weekday at 6 PM PKT."] },
  { title: "Rotate the leaked test API key", status: "done", priority: "high", assignee: "Saud", at: hoursAgo(2), notes: ["Old key revoked, new key stored in the secrets manager."] },
  { title: "Draft Notion database structure for tasks", status: "done", priority: "low", assignee: "Sara", at: earlier },
  { title: "Research CRM API rate limits", status: "in_progress", priority: "medium", assignee: "Sara", dueDate: addDays(7) },
  { title: "Clean up unused Zapier zaps", status: "todo", priority: "low", dueDate: addDays(10) },
];

for (const t of tasks) {
  const { notes, at, ...fields } = t;
  // Open tasks were created a few days ago; done tasks were last touched at `at`.
  const stamp = at ?? earlier;
  const created = store.createTask(fields, stamp);
  for (const n of notes ?? []) store.addNote(created.id, n, stamp);
}

store.close();
console.error(`Seeded ${tasks.length} tasks into ${config.dbPath} (today is ${today} in ${config.timezone}).`);
