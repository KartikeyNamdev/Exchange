import type { orderBooks, order } from "./orderBooks.js";
import { RedisManager } from "./RedisManager.js";
import type { Fill, messageFromApiServer, UserBalance } from "./types.js";

export class Engine {
  // SOL_USDC
  public orderBooks: orderBooks[] = [];
  private balances: Map<string, UserBalance> = new Map();
  /*
  "userId": {
    "BTC" : {
      balance: {
        available: 0.0001,
        locked: 0
      },
      "USDT" : {
        balance: {
          available: 100,
          locked: 0
        }
      }
  }
  */
  constructor() {}

  process({ clientId, message }: messageFromApiServer) {
    const type = message.type;
    switch (type) {
      case "CREATE_ORDER":
        // Create an order
        const msg = this.createOrder({
          userId: clientId,
          kind: message.data.kind,
          type: message.data.type,
          price: message.data.price,
          quantity: message.data.quantity,
          market: message.data.market,
        });

        break;
      case "DELETE_ORDER":
        // Delete an order
        break;
      case "GET_OPEN_ORDERS":
        // Get open orders
        break;
      case "ON_RAMP":
        // Handle on-ramp
        break;
      case "GET_DEPTH":
        // Get market depth
        break;
    }
  }
  createOrder({
    kind,
    type,
    price,
    quantity,
    market,
    userId,
  }: {
    kind: "buy" | "sell";
    type: string;
    price: number;
    quantity: number;
    market: string;
    userId: string;
  }) {
    const baseAsset = market?.split("_")[0];
    const quoteAsset = market?.split("_")[1];
    if (!baseAsset || !quoteAsset) return "Invalid market";
    const orderBook = this.orderBooks.find((book) => book.ticker() === market);
    if (!orderBook) {
      return "Order book not found";
    }
    this.checkAndLockUserBalance({
      side: kind || "",
      userId: userId,
      baseAsset: baseAsset || "",
      quoteAsset: quoteAsset || "",
      quantity: quantity,
      price: price,
    });
    console.log("Locked Users's funds");

    const order: order = {
      price: Number(price),
      quantity: Number(quantity),
      orderId:
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
      filled: 0,
      side: kind,
      userId,
    };
    //add this order to the order book
    const { executedQty, fills } = orderBook.addOrder(order);
    // update both users balance
    this.updateUserBalances({
      userId,
      side: kind,
      baseAsset,
      quoteAsset,
      executedQty,
      fills,
    });
  }
  checkAndLockUserBalance({
    userId,
    side,
    baseAsset,
    quoteAsset,
    quantity,
    price,
  }: {
    userId: string;
    side: string;
    baseAsset: string | undefined; // SOL
    quoteAsset: string | undefined; // USDC
    quantity: number;
    price: number;
  }) {
    // Check whether user has sufficient balance
    const userBalance = this.balances.get(userId);
    const requiredBalance = Number(quantity) * Number(price);
    // ensure the user exist
    if (!userBalance) return "User doesn't exist";

    if (side === "buy") {
      // ensure the user has that asset that he wants to sell
      if (!userBalance[quoteAsset]?.balance)
        return `User doesn't have any ${quoteAsset}`;
      // User has that asset that he wants to buy
      userBalance[quoteAsset].balance.available =
        userBalance[quoteAsset].balance.available - requiredBalance;

      userBalance[quoteAsset].balance.locked =
        userBalance[quoteAsset].balance.locked + requiredBalance;
    } else {
      // Sell side: ensure user has enough base asset to sell
      //@ts-ignore
      if (!userBalance[baseAsset]?.balance)
        return `User doesn't have any ${baseAsset}`;
      //@ts-ignore
      userBalance[baseAsset].balance.available =
        userBalance[baseAsset].balance.available + requiredBalance;

      userBalance[baseAsset].balance.locked =
        userBalance[baseAsset].balance.locked - requiredBalance;
    }
  }
  updateUserBalances({
    userId,
    side,
    baseAsset,
    quoteAsset,
    executedQty,
    fills,
  }: {
    userId: string;
    side: "buy" | "sell";
    baseAsset: string;
    quoteAsset: string;
    executedQty: number;
    //Who they traded with, how much and what price
    fills: Fill[];
  }) {
    if (side === "buy") {
      fills.forEach((fill) => {
        // userId : Buyer: Me
        //   quoteAsset: locked  ───▶ decreases by fill.price * fill.qty
        this.balances.get(userId)[quoteAsset]?.balance.locked -=
          fill.price * fill.qty;
        //   baseAsset: available ─▶ increases by fill.qty
        this.balances.get(userId)[baseAsset]?.balance.available += fill.qty;
        // otherUserId : Seller: Aditya
        //   baseAsset: locked ───▶ decreases by fill.qty
        this.balances.get(fill.otherUserId)[baseAsset]?.balance.locked -=
          fill.qty;
        //   quoteAsset: available ─▶ increases by fill.price * fill.qty
        this.balances.get(fill.otherUserId)[quoteAsset]?.balance.available +=
          fill.price * fill.qty;
      });
    } else {
      fills.forEach((fill) => {
        // Seller:
        // baseAsset: locked ───▶ decreases
        this.balances.get(userId)[baseAsset]?.balance.locked -= fill.qty;
        // quoteAsset: available ─▶ increases
        this.balances.get(userId)[quoteAsset]?.balance.available +=
          fill.price * fill.qty;
        // Buyer:
        // quoteAsset: locked ───▶ decreases
        this.balances.get(fill.otherUserId)[quoteAsset]?.balance.locked -=
          fill.price * fill.qty;
        // baseAsset: available ─▶ increases
        this.balances.get(fill.otherUserId)[baseAsset]?.balance.available +=
          fill.qty;
      });
    }
  }
}
