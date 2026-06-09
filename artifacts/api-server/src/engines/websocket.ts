import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { logger } from "../lib/logger";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    logger.info({ clientCount: clients.size }, "WS client connected");

    ws.on("close", () => {
      clients.delete(ws);
      logger.info({ clientCount: clients.size }, "WS client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WS error");
      clients.delete(ws);
    });
  });

  logger.info("WebSocket server initialized at /api/ws");
}

export function broadcast(type: string, data: unknown) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  let removed = 0;
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      clients.delete(ws);
      removed++;
    }
  });
  if (removed > 0) {
    logger.info({ removed }, "Cleaned up stale WS clients");
  }
}
