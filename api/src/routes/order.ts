import express, { type Request, type Response } from "express";
import { RedisManager } from "../RedisManager.js";
import { verifyOrder } from "../types.js";

const orderRouter = express.Router();

orderRouter.get("/open", async (req: Request, res: Response) => {
  // get order details from query parameters or body
  const market = (req.query.market || req.body.market) as string;
  const clientId = (req.query.clientId || req.body.clientId) as string;

  if (!market) {
    return res.status(400).send("Market is required");
  }

  const openOrders = await RedisManager.getInstance().sendAndAwait({
    type: "GET_OPEN_ORDERS",
    data: {
      market: market,
      kind: "buy", // dummy
      type: "Limit", // dummy
      price: 0,
      quantity: 0,
      clientId: clientId || "user1",
    },
  });
  res.json(openOrders);
});

/*
    kind : buy | sell,
    type : limit | market,
    price : 0,
    quantity : 1,
    market : SOL_USDC
*/
// Order Post route
orderRouter.post("/", async (req: Request, res: Response) => {
  const { kind, type, price, quantity, market, userId } = req.body;
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
      userId: userId || "user1",
    },
  });
  res.json(response);
});
export default orderRouter;
