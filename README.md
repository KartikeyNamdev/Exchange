# 🏦 Exchange – System Architecture (TypeScript → Web3)

This repository contains an open-source exchange system built in TypeScript, with the goal of first understanding core exchange mechanics and later rebuilding the same system in Rust/Solana during the Web3 cohort.

**The focus is system design, not just code:**
- Order books
- Matching engines
- Concurrency
- Event-driven architecture
- Real-time updates

---

## 🎯 Why This Project Exists

Before touching Web3 languages, it's important to understand how exchanges actually work internally.

This project is intentionally built in TypeScript first to:
- Separate system complexity from language complexity
- Reason about correctness, failures, and performance
- Make the later Rust/Solana rewrite intentional and meaningful

---

## 🧠 High-Level Architecture

At a high level, the system is split into five major parts:

1. **Frontend** (Browser / Website)
2. **API Server** (Entry point)
3. **Matching Engine**
4. **Event & Messaging Layer**
5. **Real-time WebSocket Server**

The system is **event-driven**, not request-heavy.

---

## 🔄 Request & Trade Flow (Step by Step)

### 1️⃣ Client → API Server
- User places an order from the browser (buy / sell)
- API server:
  - Authenticates user
  - Validates input
  - Generates an `orderId`
  - **Does not match orders itself**

### 2️⃣ API Server → Queue
- Valid orders are pushed into a queue
- This decouples:
  - User traffic
  - Matching logic
- Prevents race conditions and overload

### 3️⃣ Queue → Matching Engine
- Matching engine consumes orders sequentially
- Each market has its own order book:
  - `SOL/USDC`
  - `BTC/USD`
  - etc.
- Engine:
  - Matches orders
  - Updates book state
  - Produces events

### 4️⃣ Engine → Events
After processing, the engine emits events such as:
- `order_filled`
- `book_updated`
- `trade_executed`

These events are pushed to:
- Queues
- Pub/sub topics
- Downstream consumers

### 5️⃣ Events → WebSocket Server
- WebSocket server subscribes to trade/book events
- Broadcasts real-time updates:
  - `trade@SOL_USDC`
  - `ticker@SOL_USDC`
  - `depth@SOL_USDC`
- Clients receive live market data without polling

### 6️⃣ Persistence (DB)
- Finalized trades
- Order history
- Snapshots (future)
- **Used for durability, not matching**
- Matching remains in-memory for speed

---

## 🧩 Key Design Decisions

### Why Queues?
- Prevent concurrent state mutation
- Ensure deterministic order matching
- Scale API & engine independently

### Why Event-Driven?
- Loose coupling between services
- Easy to add new consumers (analytics, risk, monitoring)
- Matches how real exchanges work

### Why WebSockets?
- Market data is real-time by nature
- Polling does not scale
- WebSockets keep latency low

---

## 🗂️ Desired Folder Structure

```
exchange/
│
├── api/                    # Entry layer (HTTP)
│   ├── src/
│   │   ├── routes/          # Order / auth endpoints
│   │   ├── validators/      # Input validation
│   │   ├── auth/            # User authentication
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── engine/                  # Matching engine
│   ├── src/
│   │   ├── orderbook/       # Bid/Ask logic
│   │   ├── matcher/         # Matching algorithms
│   │   ├── markets/         # Per-market engines
│   │   └── index.ts
│
├── queue/                   # Messaging / queues
│   ├── src/
│   │   ├── producers/
│   │   ├── consumers/
│   │   └── topics.ts
│
├── websocket/               # Real-time updates
│   ├── src/
│   │   ├── subscriptions/   # trade@, depth@
│   │   └── index.ts
│
├── db/                      # Persistence layer
│   ├── schema/
│   └── client.ts
│
├── docs/                    # Architecture & design docs
│
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

This is intentionally modular so each component can later map cleanly to on-chain programs or off-chain services.

---

## 🧠 What This Teaches

By working on this system, contributors learn:
- How real exchanges avoid race conditions
- Why matching engines are stateful
- How market data pipelines work
- How infra decisions affect correctness
- How Web3 systems resemble traditional distributed systems

---

## 🚀 Future Roadmap

- [ ] Risk checks (balance, margin)
- [ ] Snapshotting order books
- [ ] Engine crash recovery
- [ ] Horizontal scaling strategy
- [ ] Rewrite core engine in Rust
- [ ] Map engine logic to Solana programs

---

## 🤝 Contributing

This project is open source and builder-driven.

- GitHub is the source of truth
- Issues describe work clearly
- Small, focused PRs are preferred
- Architecture discussions happen before major changes

If you're part of the Web3 cohort (or just curious), feel free to contribute.

---

## 🧠 Final Note

**This project is not about hype or speed.**  
It's about understanding systems deeply before shipping them on-chain.

If you learn something while reading or building this — the project is doing its job.

---

## 📬 Join the Community

Want to collaborate? Join our Discord:  
**[discord.gg/T6VTNE8G](https://discord.gg/T6VTNE8G)**

---

### What's Next?

If you want, I can:
- Simplify this README further
- Add architecture diagrams as ASCII / Mermaid
- Write `CONTRIBUTING.md`
- Design first 10 GitHub issues

Just say 👍
