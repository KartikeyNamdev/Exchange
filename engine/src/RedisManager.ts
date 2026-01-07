import { createClient, type RedisClientType } from "redis";
import type { recieveDataFromEngine, SendDataToEngine } from "./types.js";
export class RedisManager {
  private client: RedisClientType;
  private static instance: RedisManager;

  constructor() {
    this.client = createClient();
    this.client.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }
}
