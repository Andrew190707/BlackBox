import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initWebSocket } from "./engines/websocket";
import { startFlightRecorder } from "./engines/flightRecorder";
import { seedData } from "./seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

initWebSocket(server);

server.listen(port, async () => {
  logger.info({ port }, "BlackBox server listening");
  try {
    await seedData();
  } catch (err) {
    logger.error({ err }, "Seed error (non-fatal)");
  }
  startFlightRecorder();
});
