import express from "express";
import { RedisManager } from "../RedisManager.js";

const depthRouter = express.Router();

depthRouter.get("/", async (req, res) => {
  const market = (req.query.market || req.body.market) as string;
  if (!market) {
    return res.status(400).send("Market is required");
  }

  const response = await RedisManager.getInstance().sendAndAwait({
    type: "GET_DEPTH",
    data: {
      market: market,
      kind: "buy",
      type: "Limit",
      price: 0,
      quantity: 0
    }
  });
  res.json(response);
});

export default depthRouter;
