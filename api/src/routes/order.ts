import express from "express";
import { RedisManager } from "../RedisManager.js";
import { verifyOrder } from "../types.js";

const orderRouter = express.Router();

orderRouter.get("/", async (req, res) => {
  res.send("Order Get route");
});
/*
    kind : buy | sell,
    type : limit | market,
    price : 0,
    quantity : 1,
    market : SOL-USDC
*/
// Order Post route
orderRouter.post("/", async (req, res) => {
  const { kind, type, price, quantity, market } = req.body;
  const isValid = verifyOrder(req.body);
  if (!isValid) {
    return res.status(400).send("Invalid order data");
  }

  const response = await RedisManager.getInstance().sendAndAwait({
    type: "CREATE_ORDER",
    data: {
      kind,
      type,
      price,
      quantity,
      market,
    },
  });
  res.json(response);
});
export default orderRouter;
