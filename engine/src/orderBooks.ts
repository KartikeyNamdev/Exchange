import type { Fill, order } from "./types.js";

export class orderBooks {
  private bids: order[] = [];
  private asks: order[] = [];
  private baseAsset: string;
  private quoteAsset: string;
  private lastTradeId: number;
  private currentPrice: number;

  constructor(
    baseAsset: string,
    quoteAsset: string,
    bids: order[],
    asks: order[],
    lastTradeId: number,
    currentPrice: number
  ) {
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.bids = bids;
    this.asks = asks;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }

  ticker() {
    return `${this.baseAsset}_${this.quoteAsset}`;
  }

  getSnapshot() {
    return {
      baseAsset: this.baseAsset,
      quoteAsset: this.quoteAsset,
      bids: this.bids,
      asks: this.asks,
      lastTradeId: this.lastTradeId,
      currentPrice: this.currentPrice,
    };
  }

  addOrder(order: order) {
    if (order.side === "buy") {
      const { executedQty, fills } = this.matchBid(order);
      order.filled = executedQty;

      if (executedQty < order.quantity) {
        this.bids.push(order);
        // Sort bids in descending order (highest price first)
        this.bids.sort((a, b) => b.price - a.price);
      }

      console.log(
        `Bought: ${executedQty}, Remaining: ${
          order.quantity - executedQty
        } for user ${order.userId}`
      );
      return { executedQty, fills };
    } else {
      const { executedQty, fills } = this.matchAsk(order);
      order.filled = executedQty;

      if (executedQty < order.quantity) {
        this.asks.push(order);
        // Sort asks in ascending order (lowest price first)
        this.asks.sort((a, b) => a.price - b.price);
      }

      console.log(
        `Sold: ${executedQty}, Remaining: ${
          order.quantity - executedQty
        } for user ${order.userId}`
      );
      return { executedQty, fills };
    }
  }

  matchBid(order: order): { fills: Fill[]; executedQty: number } {
    const fills: Fill[] = [];
    let executedQty = 0;

    for (let i = 0; i < this.asks.length; i++) {
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

        this.currentPrice = ask.price;
      }
    }

    // Remove fully filled asks
    for (let i = 0; i < this.asks.length; i++) {
      const ask = this.asks[i];
      if (!ask) continue;

      if (ask.filled === ask.quantity) {
        this.asks.splice(i, 1);
        i--;
      }
    }

    return { fills, executedQty };
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

        this.currentPrice = bid.price;
      }
    }

    // Remove fully filled bids
    for (let i = 0; i < this.bids.length; i++) {
      const bid = this.bids[i];
      if (!bid) continue;

      if (bid.filled === bid.quantity) {
        this.bids.splice(i, 1);
        i--;
      }
    }

    return { fills, executedQty };
  }
}
