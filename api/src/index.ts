import express from "express";
import cors from "cors";
import orderRouter from "./routes/order.js";
import depthRouter from "./routes/depth.js";
import tradesRouter from "./routes/trades.js";
import klinesRouter from "./routes/klines.js";
import tickerRouter from "./routes/ticker.js";
import { RedisManager } from "./RedisManager.js";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Welcome to the API Server for EXCHANGE !");
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

app.get("/metrics", async (req, res) => {
  const redisManager = RedisManager.getInstance();
  const stats = redisManager.stats;
  
  let depth = { bids: [], asks: [] };
  try {
    depth = await redisManager.sendAndAwait({
      type: "GET_DEPTH",
      data: {
        market: "SOL_USDC",
        kind: "buy",
        type: "Limit",
        price: 0,
        quantity: 0
      }
    });
  } catch (err) {
    console.error("Failed to fetch depth for metrics:", err);
  }

  const avgLatency = stats.totalRequests > 0 ? (stats.totalLatencyMs / stats.totalRequests) : 0;

  res.json({
    orderBookDepth: {
      bids: depth.bids?.length || 0,
      asks: depth.asks?.length || 0,
    },
    totalRequests: stats.totalRequests,
    lastLatencyMs: stats.lastLatencyMs,
    averageLatencyMs: Number(avgLatency.toFixed(2)),
    tradesMatched: stats.tradesMatched,
    timestamp: new Date()
  });
});

// Routes
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/depth", depthRouter);
app.use("/api/v1/trades", tradesRouter);
app.use("/api/v1/klines", klinesRouter);
app.use("/api/v1/tickers", tickerRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Api Server is running on port ${PORT}`);
});
