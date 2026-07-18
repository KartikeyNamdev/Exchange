import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket Server is running on port ${PORT}`);

const redisSubscriber = createClient({ url: redisUrl });

async function start() {
  await redisSubscriber.connect();
  console.log(`WebSocket Server connected to Redis at ${redisUrl}`);

  // Subscribe to depth and trade updates
  await redisSubscriber.subscribe("depth@SOL_USDC", (message) => {
    broadcast({
      stream: "depth@SOL_USDC",
      data: JSON.parse(message)
    });
  });

  await redisSubscriber.subscribe("trades@SOL_USDC", (message) => {
    broadcast({
      stream: "trades@SOL_USDC",
      data: JSON.parse(message)
    });
  });
}

const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  console.log("Client connected");
  clients.add(ws);

  ws.on("close", () => {
    console.log("Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("Client socket error:", err);
  });
});

function broadcast(payload: any) {
  const messageStr = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

start().catch((err) => {
  console.error("Failed to start WebSocket server:", err);
});
