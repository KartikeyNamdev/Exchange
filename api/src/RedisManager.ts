import { createClient, type RedisClientType } from "redis";
import type { recieveDataFromEngine, SendDataToEngine } from "./types.js";
export class RedisManager {
  private sender: RedisClientType;
  private receiver: RedisClientType;
  private static instance: RedisManager;

  constructor() {
    this.sender = createClient();
    this.sender.connect();
    this.receiver = createClient();
    this.receiver.connect();
    console.log("Redis Connected for API SERVER");

    // this.instance = this;
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public sendAndAwait(message: SendDataToEngine) {
    const id = this.getRandomClientId();
    // First push the message to the Redis queue so that the Engine can process it
    this.receiver.lPush("message", JSON.stringify({ clientId: id, message }));
    return new Promise((resolve) => {
      // Also subscribe the userId to the response channel to get updates from engine about my order
      this.sender.subscribe(id, (message) => {
        console.log("Subscribed to userID : ", id);
        this.sender.unsubscribe(id);
        resolve(JSON.parse(message));
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
