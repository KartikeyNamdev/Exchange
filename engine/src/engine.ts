import { orderBooks } from "./orderBooks.js";
import { RedisManager } from "./RedisManager.js";
import type {
  Fill,
  messageFromApiServer,
  order,
  UserBalance,
} from "./types.js";

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
  constructor() {
    // Initialize SOL_USDC market
    this.initializeMarket("SOL", "USDC");
  }

  initializeMarket(baseAsset: string, quoteAsset: string = "USDC") {
    const existingMarket = this.orderBooks.find(
      (book) => book.ticker() === `${baseAsset}_${quoteAsset}`
    );
    if (existingMarket) {
      console.log(`Market ${baseAsset}_${quoteAsset} already exists`);
      return existingMarket;
    }
    const newOrderBook = new orderBooks(
      baseAsset,
      quoteAsset,
      [], // empty bids
      [], // empty asks
      0, // lastTradeId
      100 // currentPrice
    );
    this.orderBooks.push(newOrderBook);
    console.log(`Initialized market: ${baseAsset}_${quoteAsset}`);
    return newOrderBook;
  }
  getMarkets(): string[] {
    return this.orderBooks.map((book) => book.ticker());
  }
  process({ clientId, message }: messageFromApiServer) {
    const RedisClient = new RedisManager();
    const type = message.type;
    switch (type) {
      case "GET_OPEN_ORDERS":
        const openedOrderBook = this.orderBooks.find(
          (o) => o.ticker() === message.data.market
        );
        if (!openedOrderBook) {
          return {};
        }
        const openOrders = openedOrderBook.openOrder(clientId);
        return openOrders;
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

        console.log("Engine made an order :", msg);
        // send any user interested in this userId an update that
        // how much of his order was filled using PubSub redis
        RedisClient.publish(
          clientId,
          JSON.stringify({ type: "ORDER_UPDATE", data: msg })
        );
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
      case "CREATE_MARKET":
      // Create a new market
      // const { baseAsset, quoteAsset } = message.data;
      // this.initializeMarket(baseAsset, quoteAsset);
      // break;
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
      side: kind,
      userId: userId,
      baseAsset: baseAsset,
      quoteAsset: quoteAsset,
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
    // executedQty is how many of my qty were filled
    // fills is an array that holds how many of my qty were filled at what price
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
    return { executedQty, fills };
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
    baseAsset: string;
    quoteAsset: string;
    quantity: number;
    price: number;
  }) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) return "User doesn't exist";

    if (side === "buy") {
      // Check if user has the quote asset (e.g., USDC to buy SOL)
      const quoteBalance = userBalance[quoteAsset as keyof UserBalance];
      if (!quoteBalance?.balance) {
        return `User doesn't have any ${quoteAsset}`;
      }

      const requiredBalance = quantity * price;
      if (quoteBalance.balance.available < requiredBalance) {
        return `Insufficient ${quoteAsset} balance`;
      }

      quoteBalance.balance.available -= requiredBalance;
      quoteBalance.balance.locked += requiredBalance;
    } else {
      // Sell side: user needs base asset (e.g., SOL to sell)
      const baseBalance = userBalance[baseAsset as keyof UserBalance];
      if (!baseBalance?.balance) {
        return `User doesn't have any ${baseAsset}`;
      }

      if (baseBalance.balance.available < quantity) {
        return `Insufficient ${baseAsset} balance`;
      }

      baseBalance.balance.available -= quantity; // FIX: subtract, not add
      baseBalance.balance.locked += quantity; // FIX: add, not subtract
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
    fills: Fill[];
  }) {
    if (side === "buy") {
      fills.forEach((fill) => {
        const userBalance = this.balances.get(userId);
        const otherUserBalance = this.balances.get(fill.otherUserId);

        if (!userBalance || !otherUserBalance) return;

        // Buyer (userId):
        // quoteAsset locked decreases, baseAsset available increases
        const userBase = (userBalance as any)[baseAsset];
        const userQuote = (userBalance as any)[quoteAsset];

        if (userBase?.balance) {
          userBase.balance.available += fill.qty;
        }
        if (userQuote?.balance) {
          userQuote.balance.locked -= fill.price * fill.qty;
        }

        // Seller (otherUserId):
        // baseAsset locked decreases, quoteAsset available increases
        const otherBase = (otherUserBalance as any)[baseAsset];
        const otherQuote = (otherUserBalance as any)[quoteAsset];

        if (otherBase?.balance) {
          otherBase.balance.locked -= fill.qty;
        }
        if (otherQuote?.balance) {
          otherQuote.balance.available += fill.price * fill.qty;
        }
      });
    } else {
      fills.forEach((fill) => {
        const userBalance = this.balances.get(userId);
        const otherUserBalance = this.balances.get(fill.otherUserId);

        if (!userBalance || !otherUserBalance) return;

        // Seller (userId):
        // baseAsset locked decreases, quoteAsset available increases
        const userBase = (userBalance as any)[baseAsset];
        const userQuote = (userBalance as any)[quoteAsset];

        if (userBase?.balance) {
          userBase.balance.locked -= fill.qty;
        }
        if (userQuote?.balance) {
          userQuote.balance.available += fill.price * fill.qty;
        }

        // Buyer (otherUserId):
        // quoteAsset locked decreases, baseAsset available increases
        const otherQuote = (otherUserBalance as any)[quoteAsset];
        const otherBase = (otherUserBalance as any)[baseAsset];

        if (otherQuote?.balance) {
          otherQuote.balance.locked -= fill.price * fill.qty;
        }
        if (otherBase?.balance) {
          otherBase.balance.available += fill.qty;
        }
      });
    }
  }
}
