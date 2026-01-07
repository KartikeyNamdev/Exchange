import { createClient, type RedisClientType } from "redis";
import type { recieveDataFromEngine, SendDataToEngine } from "./types.js";
export class RedisManager {
  private sender: RedisClientType;
  private receiver: RedisClientType;
  private static instance: RedisManager;

  constructor() {
    this.sender = createClient();
    this.sender.connect();
    console.log("Sender connected");
    this.receiver = createClient();
    this.receiver.connect();
    console.log("Receiver connected");
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
    // Implementation for sending a message and awaiting a response
    console.log(id);

    return new Promise((resolve) => {
      this.sender.subscribe(id, (message) => {
        console.log("Subscribed");
        this.sender.unsubscribe(id);
        resolve(JSON.parse(message));
      });
      this.receiver.lPush("message", JSON.stringify({ clientId: id, message }));
    });
  }
  public getRandomClientId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
