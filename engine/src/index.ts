import { createClient } from "redis";
import { Engine } from "./engine.js";

async function main() {
  const RedisClient = createClient();
  const engine = new Engine();
  RedisClient.connect();
  console.log("Engine connected");

  while (true) {
    const message = await RedisClient.rPop("message");
    if (message) {
      //   console.log("Received message:", message);
      const msg = JSON.parse(message);
      engine.process(msg);
      console.log(msg);
    }
  }
}
main();
