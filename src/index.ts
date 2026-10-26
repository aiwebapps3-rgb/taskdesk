#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig, type Config } from "./config.js";
import { JsonlAuditSink } from "./lib/audit.js";
import { logger, setLogLevel } from "./lib/logger.js";
import { createServer, SERVER_VERSION } from "./server.js";
import { TaskService } from "./services/taskService.js";
import { SqliteTaskStore } from "./store/sqliteTaskStore.js";

async function main(): Promise<void> {
  let config: Config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
  setLogLevel(config.logLevel);

  const store = new SqliteTaskStore(config.dbPath);
  const service = new TaskService(store, { timezone: config.timezone });
  const audit = new JsonlAuditSink(config.auditPath);

  let shuttingDown = false;
  const shutdown = (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Shutting down (${reason})`);
    store.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (config.transport === "http") {
    await startHttp(config, () => createServer({ service, audit }));
  } else {
    const server = createServer({ service, audit });
    // When the client closes our stdin, it is done with us.
    process.stdin.on("close", () => shutdown("stdin closed"));
    await server.connect(new StdioServerTransport());
    logger.info(`TaskDesk ${SERVER_VERSION} ready on stdio (db ${config.dbPath}, tz ${config.timezone})`);
  }
}

/**
 * Streamable HTTP in stateless mode: a fresh server and transport per request.
 * Protected by a bearer token for the demo. A real shared deployment should use
 * OAuth per user as described in the MCP authorization spec.
 */
async function startHttp(config: Config, makeServer: () => ReturnType<typeof createServer>): Promise<void> {
  const expected = Buffer.from(`Bearer ${config.httpToken ?? ""}`);
  const authorized = (req: IncomingMessage) => {
    const got = Buffer.from(req.headers.authorization ?? "");
    return got.length === expected.length && timingSafeEqual(got, expected);
  };

  const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  };

  const http = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/health") return sendJson(res, 200, { ok: true });
    if (url.pathname !== "/mcp") return sendJson(res, 404, { error: "Not found" });
    if (!authorized(req)) {
      res.setHeader("www-authenticate", "Bearer");
      return sendJson(res, 401, { error: "Missing or invalid bearer token" });
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "Use POST (stateless mode)" });

    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      logger.error("HTTP request failed", err);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
    }
  });

  // Listen on localhost only. Put a proper reverse proxy with TLS in front for real hosting.
  http.listen(config.httpPort, "127.0.0.1", () => {
    logger.info(`TaskDesk ${SERVER_VERSION} listening on http://127.0.0.1:${config.httpPort}/mcp`);
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});
