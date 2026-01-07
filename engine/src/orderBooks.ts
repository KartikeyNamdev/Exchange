import type { Fill } from "./types.js";

export type order = {
  price: number;
  quantity: number;
  orderId: string;
  filled: number;
  side: "buy" | "sell";
  userId: string;
};
export class orderBooks {
  private bids: order[] = [];
  private asks: order[] = [];
  private baseAsset: string;
  private quoteAsset: string = "INR";
  private lastTradeId: number;
  private currentPrice: number;

  constructor(
    baseAsset: string,
    bids: order[],
    asks: order[],
    lastTradeId: number,
    currentPrice: number
  ) {
    this.bids = bids;
    this.asks = asks;
    this.baseAsset = baseAsset;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }

  ticker() {
    return `${this.baseAsset}_${this.quoteAsset}`;
  }
  addOrder(order: order) {
    if (order.side === "buy") {
      const { executedQty, fills } = this.matchBid(order);

      order.filled = executedQty;

      if (executedQty < order.quantity) {
        this.bids.push(order);
      }

      console.log(
        `Bought: ${executedQty}, Remaining: ${order.quantity - executedQty}`
      );
      return { executedQty, fills };
    } else {
      const { executedQty, fills } = this.matchAsk(order);

      order.filled = executedQty;
      if (executedQty < order.quantity) this.asks.push(order);

      console.log(
        `Sold: ${executedQty}, Remaining: ${order.quantity - executedQty}`
      );
      return { executedQty, fills };
    }
  }

  matchBid(order: order): { fills: Fill[]; executedQty: number } {
    // i want to buy the 5 Assets find how is the executedQty
    // if i get 2 i will have to move to next and fulfill my requirement of 3 left
    const fills: Fill[] = [
      {
        otherUserId: "Aditya",
        qty: 2,
        price: 110,
        tradeId: 123,
        markerOrderId: "abc123",
      },
      {
        otherUserId: "Aditya",
        qty: 3,
        price: 110.5,
        tradeId: 124,
        markerOrderId: "abc124",
      },
    ];
    let executedQty = 0;

    for (let i = 0; i < this.asks.length; i++) {
      // Seller is asking for $ in return of quantity he has
      const ask = this.asks[i];
      if (!ask) continue;
      if (ask.price <= order.price && executedQty < order.quantity) {
        const filledQty = Math.min(order.quantity - executedQty, ask.quantity);
        executedQty += filledQty;
        ask.filled += filledQty;
        fills.push({
          price: ask.price,
          qty: filledQty,
          tradeId: this.lastTradeId++,
          otherUserId: ask.userId,
          markerOrderId: ask.orderId,
        });
      }
    }
    for (let i = 0; i < this.asks.length; i++) {
      const ask = this.asks[i];
      if (!ask) continue;
      if (ask.filled === ask.quantity) {
        this.asks.splice(i, 1);
        i--;
      }
    }
    return {
      fills,
      executedQty,
    };
  }

  matchAsk(order: order): { fills: Fill[]; executedQty: number } {
    const fills: Fill[] = [];
    let executedQty = 0;

    for (let i = 0; i < this.bids.length; i++) {
      const bid = this.bids[i];
      if (!bid) continue;
      if (bid.price >= order.price && executedQty < order.quantity) {
        const amountRemaining = Math.min(
          order.quantity - executedQty,
          bid.quantity
        );
        executedQty += amountRemaining;
        bid.filled += amountRemaining;
        fills.push({
          price: bid.price,
          qty: amountRemaining,
          tradeId: this.lastTradeId++,
          otherUserId: bid.userId,
          markerOrderId: bid.orderId,
        });
      }
    }
    for (let i = 0; i < this.bids.length; i++) {
      const bid = this.bids[i];
      if (!bid) continue;
      if (bid.filled === bid.quantity) {
        this.bids.splice(i, 1);
        i--;
      }
    }
    return {
      fills,
      executedQty,
    };
  }
}
