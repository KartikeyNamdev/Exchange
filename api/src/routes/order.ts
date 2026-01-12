import express, { type Request, type Response } from "express";
import { RedisManager } from "../RedisManager.js";
import { verifyOrder } from "../types.js";

const orderRouter = express.Router();

orderRouter.get("/open", async (req: Request, res: Response) => {
  // get order details
  const { market, clientId } = req.body;
  const openOrders = await RedisManager.getInstance().sendAndAwait({
    type: "GET_OPEN_ORDERS",
    data: {
      market: market,
      clientId: clientId,
    },
  });
  res.json(openOrders);
});

/*
    kind : buy | sell,
    type : limit | market,
    price : 0,
    quantity : 1,
    market : SOL-USDC
*/
// Order Post route
orderRouter.post("/", async (req: Request, res: Response) => {
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
