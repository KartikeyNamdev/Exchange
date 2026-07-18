import { createClient, type RedisClientType } from "redis";
import type { recieveDataFromEngine, SendDataToEngine } from "./types.js";
export class RedisManager {
  private sender: RedisClientType;
  private receiver: RedisClientType;
  private static instance: RedisManager;
  public stats = {
    totalRequests: 0,
    totalLatencyMs: 0,
    lastLatencyMs: 0,
    tradesMatched: 0,
  };

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.sender = createClient({ url: redisUrl });
    this.sender.connect();
    this.receiver = createClient({ url: redisUrl });
    this.receiver.connect();
    console.log(`Redis Connected to ${redisUrl} for API SERVER`);
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public sendAndAwait(message: SendDataToEngine): Promise<any> {
    const startTime = Date.now();
    const id = this.getRandomClientId();
    // First push the message to the Redis queue so that the Engine can process it
    this.receiver.lPush("message", JSON.stringify({ clientId: id, message }));
    return new Promise((resolve) => {
      // Also subscribe the userId to the response channel to get updates from engine about my order
      this.sender.subscribe(id, (messageStr) => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        this.stats.totalRequests++;
        this.stats.totalLatencyMs += latency;
        this.stats.lastLatencyMs = latency;

        console.log("Subscribed to userID : ", id, "Latency:", latency, "ms");
        this.sender.unsubscribe(id);
        
        const parsed = JSON.parse(messageStr);
        if (parsed && parsed.type === "ORDER_UPDATE" && parsed.data && parsed.data.executedQty > 0) {
          this.stats.tradesMatched += parsed.data.executedQty;
        }
        resolve(parsed);
      });
    });
  }
  public getRandomClientId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
