import { createClient, type RedisClientType } from "redis";
import type { recieveDataFromEngine, SendDataToEngine } from "./types.js";
export class RedisManager {
  private client: RedisClientType;
  private static instance: RedisManager;

  constructor() {
    this.client = createClient();
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
