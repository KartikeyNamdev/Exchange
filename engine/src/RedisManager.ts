import { createClient, type RedisClientType } from "redis";
import type { recieveDataFromEngine, SendDataToEngine } from "./types.js";
export class RedisManager {
  private client: RedisClientType;
  private static instance: RedisManager;

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.client = createClient({ url: redisUrl });
    this.client.connect();
  }
  publish(channel: string, message: any) {
    this.client.publish(channel, JSON.stringify(message));
  }
  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }
}
