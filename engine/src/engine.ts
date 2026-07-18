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
    // Add default user balances for testing
    this.balances.set("user1", {
      SOL: { balance: { available: 1000, locked: 0 } },
      USDC: { balance: { available: 100000, locked: 0 } }
    });
    this.balances.set("user2", {
      SOL: { balance: { available: 1000, locked: 0 } },
      USDC: { balance: { available: 100000, locked: 0 } }
    });
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
      case "GET_OPEN_ORDERS": {
        const openedOrderBook = this.orderBooks.find(
          (o) => o.ticker() === message.data.market
        );
        if (!openedOrderBook) {
          RedisClient.publish(clientId, []);
          break;
        }
        const openOrders = openedOrderBook.openOrder((message.data as any).clientId || "user1");
        RedisClient.publish(clientId, openOrders);
        break;
      }
      case "CREATE_ORDER": {
        // Create an order
        const msg = this.createOrder({
          userId: (message.data as any).userId || "user1",
          kind: message.data.kind,
          type: message.data.type,
          price: message.data.price,
          quantity: message.data.quantity,
          market: message.data.market,
        });

        console.log("Engine made an order :", msg);
        // send client response using PubSub redis
        RedisClient.publish(
          clientId,
          { type: "ORDER_UPDATE", data: msg }
        );
        break;
      }
      case "DELETE_ORDER":
        RedisClient.publish(clientId, { status: "success" });
        break;
      case "ON_RAMP": {
        const { userId: rampUser, amount: rampAmount, asset: rampAsset } = message.data as any;
        let uBalance = this.balances.get(rampUser);
        if (!uBalance) {
          uBalance = {
            [rampAsset]: { balance: { available: 0, locked: 0 } }
          };
          this.balances.set(rampUser, uBalance);
        }
        if (!uBalance[rampAsset]) {
          uBalance[rampAsset] = { balance: { available: 0, locked: 0 } };
        }
        uBalance[rampAsset].balance.available += Number(rampAmount);
        RedisClient.publish(clientId, { status: "success", balance: uBalance[rampAsset].balance });
        break;
      }
      case "GET_DEPTH": {
        const depthOrderBook = this.orderBooks.find(
          (o) => o.ticker() === message.data.market
        );
        if (!depthOrderBook) {
          RedisClient.publish(clientId, { bids: [], asks: [] });
          break;
        }
        const snapshot = depthOrderBook.getSnapshot();
        const bidsMap = new Map<number, number>();
        const asksMap = new Map<number, number>();
        snapshot.bids.forEach(o => {
          const remaining = o.quantity - o.filled;
          if (remaining > 0) {
            bidsMap.set(o.price, (bidsMap.get(o.price) || 0) + remaining);
          }
        });
        snapshot.asks.forEach(o => {
          const remaining = o.quantity - o.filled;
          if (remaining > 0) {
            asksMap.set(o.price, (asksMap.get(o.price) || 0) + remaining);
          }
        });
        const bids = Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]);
        const asks = Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]);
        RedisClient.publish(clientId, { bids, asks });
        break;
      }
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
    if (!baseAsset || !quoteAsset) return { error: "Invalid market" };
    const orderBook = this.orderBooks.find((book) => book.ticker() === market);
    if (!orderBook) {
      return { error: "Order book not found" };
    }
    const lockError = this.checkAndLockUserBalance({
      side: kind,
      userId: userId,
      baseAsset: baseAsset,
      quoteAsset: quoteAsset,
      quantity: quantity,
      price: price,
    });
    if (lockError) {
      console.log("Failed to lock user funds:", lockError);
      return { error: lockError };
    }
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

    // Publish global updates for WebSockets
    const snapshot = orderBook.getSnapshot();
    const bidsMap = new Map<number, number>();
    const asksMap = new Map<number, number>();
    snapshot.bids.forEach(o => {
      const remaining = o.quantity - o.filled;
      if (remaining > 0) {
        bidsMap.set(o.price, (bidsMap.get(o.price) || 0) + remaining);
      }
    });
    snapshot.asks.forEach(o => {
      const remaining = o.quantity - o.filled;
      if (remaining > 0) {
        asksMap.set(o.price, (asksMap.get(o.price) || 0) + remaining);
      }
    });
    const bids = Array.from(bidsMap.entries()).sort((a, b) => b[0] - a[0]);
    const asks = Array.from(asksMap.entries()).sort((a, b) => a[0] - b[0]);
    
    RedisManager.getInstance().publish(`depth@${market}`, { bids, asks });

    if (fills && fills.length > 0) {
      RedisManager.getInstance().publish(`trades@${market}`, fills);
    }

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

      baseBalance.balance.available -= quantity;
      baseBalance.balance.locked += quantity;
    }
    return null;
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
