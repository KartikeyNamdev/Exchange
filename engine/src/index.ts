import { createClient } from "redis";
import { Engine } from "./engine.js";

async function main() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const RedisClient = createClient({ url: redisUrl });
  const engine = new Engine();
  await RedisClient.connect();
  console.log(`Engine connected to Redis at ${redisUrl}`);

  while (true) {
    const message = await RedisClient.rPop("message");
    if (message) {
      const msg = JSON.parse(message);
      engine.process(msg);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}
main();
