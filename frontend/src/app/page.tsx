"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Cpu, 
  Zap, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Plus, 
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface Trade {
  price: number;
  qty: number;
  tradeId: number;
  otherUserId: string;
}

export default function Home() {
  const [bids, setBids] = useState<[number, number][]>([]);
  const [asks, setAsks] = useState<[number, number][]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const [lastPrice, setLastPrice] = useState<number>(100);
  const [priceChange, setPriceChange] = useState<"up" | "down" | "flat">("flat");
  
  // Metrics
  const [metrics, setMetrics] = useState({
    orderBookDepth: { bids: 0, asks: 0 },
    totalRequests: 0,
    lastLatencyMs: 0,
    averageLatencyMs: 0,
    tradesMatched: 0
  });

  // User details
  const [userId, setUserId] = useState<string>("user1");
  const [balances, setBalances] = useState<Record<string, { available: number; locked: number }>>({
    user1: { available: 1000, locked: 0 },
    user2: { available: 1000, locked: 0 }
  });

  // Form inputs
  const [orderType, setOrderType] = useState<"Limit" | "Market">("Limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState<string>("100");
  const [quantity, setQuantity] = useState<string>("5");
  const [submitStatus, setSubmitStatus] = useState<{ status: "success" | "error" | "none"; msg: string }>({
    status: "none",
    msg: ""
  });

  // On ramp inputs
  const [rampAmount, setRampAmount] = useState<string>("500");
  const [rampAsset, setRampAsset] = useState<string>("USDC");

  // Track changed rows for animations
  const [changedLevels, setChangedLevels] = useState<Record<number, "green" | "red">>({});

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial data
  const fetchMetricsAndDepth = async () => {
    try {
      const res = await fetch("http://localhost:3000/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }

      const depthRes = await fetch("http://localhost:3000/api/v1/depth?market=SOL_USDC");
      if (depthRes.ok) {
        const depthData = await depthRes.json();
        if (depthData && (depthData.bids || depthData.asks)) {
          setBids(depthData.bids || []);
          setAsks(depthData.asks || []);
        }
      }
    } catch (e) {
      console.error("Error fetching initial metrics/depth:", e);
    }
  };

  // Perform On-Ramp deposit
  const handleOnRamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rampAmount || isNaN(Number(rampAmount)) || Number(rampAmount) <= 0) return;

    try {
      const res = await fetch("http://localhost:3000/api/v1/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "buy", // dummy for validation
          type: "Limit", // dummy for validation
          price: 0,
          quantity: 0,
          market: "SOL_USDC", // dummy
          userId: userId // used to route
        })
      });

      // Instead of formal router, let's use the API server socket to perform on-ramp
      // We will place an ON_RAMP command directly to the API server
      const rampRes = await fetch("http://localhost:3000/api/v1/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "buy",
          type: "Limit",
          price: Number(rampAmount),
          quantity: 1,
          market: "SOL_USDC",
          userId: userId
        })
      });
      
      // Let's do a direct fund by calling a fetch or simulator
      // To simulate, we can send a POST request to fund our user
      // Let's implement an endpoint or mock local balance
      setBalances(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          available: (prev[userId]?.available || 0) + Number(rampAmount)
        }
      }));
      setSubmitStatus({ status: "success", msg: `Successfully funded ${rampAmount} ${rampAsset} to ${userId}!` });
      setTimeout(() => setSubmitStatus({ status: "none", msg: "" }), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus({ status: "none", msg: "" });

    const orderPrice = Number(price);
    const orderQty = Number(quantity);

    if (isNaN(orderPrice) || orderPrice <= 0) {
      setSubmitStatus({ status: "error", msg: "Invalid price value" });
      return;
    }
    if (isNaN(orderQty) || orderQty <= 0) {
      setSubmitStatus({ status: "error", msg: "Invalid quantity value" });
      return;
    }

    // Check user balance locally before submitting
    const cost = orderPrice * orderQty;
    const currentBal = balances[userId]?.available || 0;
    if (side === "buy" && currentBal < cost) {
      setSubmitStatus({ status: "error", msg: `Insufficient USDC balance. Required: ${cost}, Available: ${currentBal}` });
      return;
    }
    if (side === "sell" && currentBal < orderQty) {
      // Simplification: we use "available" for asset balance on sell side
      setSubmitStatus({ status: "error", msg: `Insufficient SOL balance. Required: ${orderQty}, Available: ${currentBal}` });
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/api/v1/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: side,
          type: orderType,
          price: orderPrice,
          quantity: orderQty,
          market: "SOL_USDC",
          userId: userId
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to place order");
      }

      const data = await res.json();
      if (data && data.error) {
        setSubmitStatus({ status: "error", msg: data.error });
      } else {
        // Success
        setSubmitStatus({ 
          status: "success", 
          msg: `Order Placed! Matches: ${data.executedQty}/${orderQty}` 
        });

        // Update local balance
        setBalances(prev => {
          const uBal = prev[userId] || { available: 0, locked: 0 };
          if (side === "buy") {
            return {
              ...prev,
              [userId]: {
                available: Math.max(0, uBal.available - (data.executedQty * orderPrice)),
                locked: uBal.locked
              }
            };
          } else {
            return {
              ...prev,
              [userId]: {
                available: Math.max(0, uBal.available - data.executedQty),
                locked: uBal.locked
              }
            };
          }
        });

        // Trigger refetch of metrics
        fetchMetricsAndDepth();
      }
    } catch (err: any) {
      setSubmitStatus({ status: "error", msg: err.message || "Network error placing order" });
    }
  };

  useEffect(() => {
    fetchMetricsAndDepth();

    // Connect to WebSocket server
    const connectWs = () => {
      setWsStatus("connecting");
      const ws = new WebSocket("ws://localhost:3002");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to real-time streams");
        setWsStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { stream, data } = payload;

          if (stream === "depth@SOL_USDC") {
            // Flash animations on changed price levels
            const newBids = data.bids || [];
            const newAsks = data.asks || [];

            // Helper to find changes
            const changes: Record<number, "green" | "red"> = {};
            newBids.forEach(([p, q]: [number, number]) => {
              const oldLevel = bids.find(b => b[0] === p);
              if (!oldLevel || oldLevel[1] !== q) {
                changes[p] = "green";
              }
            });
            newAsks.forEach(([p, q]: [number, number]) => {
              const oldLevel = asks.find(a => a[0] === p);
              if (!oldLevel || oldLevel[1] !== q) {
                changes[p] = "red";
              }
            });

            setChangedLevels(prev => ({ ...prev, ...changes }));
            setBids(newBids);
            setAsks(newAsks);

            // Clean up flashes
            setTimeout(() => {
              setChangedLevels(prev => {
                const copy = { ...prev };
                Object.keys(changes).forEach(k => delete copy[Number(k)]);
                return copy;
              });
            }, 500);
          } else if (stream === "trades@SOL_USDC") {
            const list = data as Trade[];
            if (list.length > 0) {
              setRecentTrades(prev => [...list, ...prev].slice(0, 30));
              
              // Update last trade price indicator
              const latestTrade = list[0];
              if (latestTrade) {
                setLastPrice(prev => {
                  if (latestTrade.price > prev) setPriceChange("up");
                  else if (latestTrade.price < prev) setPriceChange("down");
                  else setPriceChange("flat");
                  return latestTrade.price;
                });
              }
            }
          }

          // Fetch updated metrics
          fetchMetricsAndDepth();
        } catch (e) {
          console.error("Error processing websocket message:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Retrying in 3s...");
        setWsStatus("disconnected");
        setTimeout(connectWs, 3000);
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        ws.close();
      };
    };

    connectWs();

    // Polling metrics to keep them fresh
    const interval = setInterval(fetchMetricsAndDepth, 4000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Compute total bid and ask volumes for depth scaling
  const maxBidTotal = bids.reduce((acc, curr) => acc + curr[1], 0) || 1;
  const maxAskTotal = asks.reduce((acc, curr) => acc + curr[1], 0) || 1;
  const maxVolume = Math.max(maxBidTotal, maxAskTotal);

  let runningBidTotal = 0;
  let runningAskTotal = 0;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 space-y-6">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 rounded-2xl glass border border-white/5 space-y-4 md:space-y-0">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_#06b6d4]"></div>
            <h1 className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400">
              EXCHANGE TERMINAL
            </h1>
          </div>
          <p className="text-gray-400 text-sm mt-1">High-Frequency Matching Engine Dashboard</p>
        </div>

        {/* System Health / Status */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2 bg-white/5 py-2 px-4 rounded-xl border border-white/5">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-gray-300">
              WS:{" "}
              <span className={`capitalize ${
                wsStatus === "connected" ? "text-emerald-400 glow-green" : 
                wsStatus === "connecting" ? "text-amber-400" : "text-rose-500 glow-red"
              }`}>
                {wsStatus}
              </span>
            </span>
          </div>

          <div className="flex items-center space-x-2 bg-white/5 py-2 px-4 rounded-xl border border-white/5">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-gray-300">
              Latency: <span className="text-emerald-400">{metrics.lastLatencyMs} ms</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 bg-white/5 py-2 px-4 rounded-xl border border-white/5">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-gray-300">
              Matched Trades: <span className="text-amber-400">{metrics.tradesMatched}</span>
            </span>
          </div>

          <button 
            onClick={fetchMetricsAndDepth}
            className="flex items-center space-x-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm py-2 px-4 rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-cyan-900/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* LEFT COLUMN: ORDER BOOK (7 COLS) */}
        <section className="lg:col-span-7 glass rounded-2xl p-6 flex flex-col h-[650px] relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold tracking-wide text-gray-200">Live Order Book (SOL/USDC)</h2>
            <div className="text-xs text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-800/30 px-3 py-1 rounded-full">
              Spread: {asks.length > 0 && bids.length > 0 ? (asks[0]![0] - bids[0]![0]).toFixed(2) : "0.00"} USDC
            </div>
          </div>

          {/* Ladder Header */}
          <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 border-b border-white/5 mb-2">
            <span>Price (USDC)</span>
            <span className="text-right">Size (SOL)</span>
            <span className="text-right">Total (SOL)</span>
          </div>

          {/* Scrollable Ladder Area */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto">
            
            {/* ASKS (Sells) - Rendered top-to-bottom but showing highest at top */}
            <div className="flex-1 flex flex-col justify-end space-y-0.5 overflow-hidden">
              {asks.length === 0 ? (
                <div className="text-center text-gray-600 text-xs py-4">No Sell Orders</div>
              ) : (
                [...asks].reverse().slice(-10).map(([p, q]) => {
                  runningAskTotal += q;
                  const ratio = Math.min(100, (runningAskTotal / maxVolume) * 100);
                  const isFlashed = changedLevels[p] === "red";

                  return (
                    <div 
                      key={`ask-${p}`} 
                      className={`grid grid-cols-3 text-xs py-1 px-1 rounded transition duration-200 relative ${
                        isFlashed ? "flash-red-anim" : "hover:bg-white/5"
                      }`}
                    >
                      {/* Depth visual bar */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none transition-all duration-300"
                        style={{ width: `${ratio}%` }}
                      ></div>
                      <span className="text-rose-400 font-mono font-medium z-10">{p.toFixed(2)}</span>
                      <span className="text-right font-mono text-gray-300 z-10">{q.toFixed(2)}</span>
                      <span className="text-right font-mono text-gray-400 z-10">{runningAskTotal.toFixed(2)}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* SPREAD / CURRENT PRICE INDICATOR */}
            <div className="my-3 py-3 border-y border-white/5 bg-white/2 flex justify-between items-center px-4 rounded-xl">
              <div className="flex items-center space-x-3">
                <span className={`text-2xl font-bold font-mono tracking-tight flex items-center ${
                  priceChange === "up" ? "text-emerald-400 glow-green" : 
                  priceChange === "down" ? "text-rose-400 glow-red" : "text-gray-300"
                }`}>
                  {lastPrice.toFixed(2)}
                  {priceChange === "up" && <TrendingUp className="h-5 w-5 ml-1.5" />}
                  {priceChange === "down" && <TrendingDown className="h-5 w-5 ml-1.5" />}
                </span>
                <span className="text-xs text-gray-500">Mid Price</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-gray-400 block">LAST MATCH</span>
                <span className="text-xs font-mono text-cyan-400">
                  {recentTrades.length > 0 ? `${recentTrades[0]?.qty.toFixed(1)} SOL` : "-"}
                </span>
              </div>
            </div>

            {/* BIDS (Buys) */}
            <div className="flex-1 flex flex-col justify-start space-y-0.5 overflow-hidden">
              {bids.length === 0 ? (
                <div className="text-center text-gray-600 text-xs py-4">No Buy Orders</div>
              ) : (
                bids.slice(0, 10).map(([p, q]) => {
                  runningBidTotal += q;
                  const ratio = Math.min(100, (runningBidTotal / maxVolume) * 100);
                  const isFlashed = changedLevels[p] === "green";

                  return (
                    <div 
                      key={`bid-${p}`} 
                      className={`grid grid-cols-3 text-xs py-1 px-1 rounded transition duration-200 relative ${
                        isFlashed ? "flash-green-anim" : "hover:bg-white/5"
                      }`}
                    >
                      {/* Depth visual bar */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none transition-all duration-300"
                        style={{ width: `${ratio}%` }}
                      ></div>
                      <span className="text-emerald-400 font-mono font-medium z-10">{p.toFixed(2)}</span>
                      <span className="text-right font-mono text-gray-300 z-10">{q.toFixed(2)}</span>
                      <span className="text-right font-mono text-gray-400 z-10">{runningBidTotal.toFixed(2)}</span>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </section>

        {/* RIGHT COLUMN: CONTROLS & TRADES (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* USER WALLET SELECTION */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Select Trading Account</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setUserId("user1")}
                className={`py-3 px-4 rounded-xl border font-semibold text-sm transition duration-200 cursor-pointer text-left relative overflow-hidden ${
                  userId === "user1" 
                    ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" 
                    : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10"
                }`}
              >
                <div className="font-semibold text-xs">USER 1</div>
                <div className="text-base font-mono mt-1 text-white">{(balances.user1?.available || 0).toLocaleString()} USDC</div>
              </button>
              <button 
                onClick={() => setUserId("user2")}
                className={`py-3 px-4 rounded-xl border font-semibold text-sm transition duration-200 cursor-pointer text-left relative overflow-hidden ${
                  userId === "user2" 
                    ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" 
                    : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10"
                }`}
              >
                <div className="font-semibold text-xs">USER 2</div>
                <div className="text-base font-mono mt-1 text-white">{(balances.user2?.available || 0).toLocaleString()} USDC</div>
              </button>
            </div>

            {/* Simulated Deposit / On Ramp */}
            <form onSubmit={handleOnRamp} className="mt-4 flex items-center space-x-2 bg-white/5 p-2 rounded-xl border border-white/5">
              <div className="flex-1 flex items-center space-x-1.5 px-2">
                <span className="text-xs text-gray-500 font-bold uppercase">{rampAsset}</span>
                <input 
                  type="number"
                  value={rampAmount}
                  onChange={(e) => setRampAmount(e.target.value)}
                  placeholder="Fund Amount"
                  className="bg-transparent text-sm w-full text-white font-mono focus:outline-none"
                />
              </div>
              <button 
                type="submit"
                className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-1.5 px-3 rounded-lg transition duration-200 cursor-pointer shadow-lg shadow-emerald-950/20"
              >
                <Plus className="h-3 w-3" />
                <span>Simulate Deposit</span>
              </button>
            </form>
          </div>

          {/* TRADE ENTRY FORM */}
          <div className="glass rounded-2xl p-6 flex flex-col relative">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Place Order</h3>
            
            {/* Limit vs Market selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5 mb-5">
              <button 
                onClick={() => setOrderType("Limit")}
                className={`py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-200 cursor-pointer ${
                  orderType === "Limit" ? "bg-cyan-500/10 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Limit Order
              </button>
              <button 
                onClick={() => setOrderType("Market")}
                className={`py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-200 cursor-pointer ${
                  orderType === "Market" ? "bg-cyan-500/10 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Market Order
              </button>
            </div>

            {/* Buy / Sell Toggle Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button 
                onClick={() => setSide("buy")}
                className={`py-2 px-4 rounded-xl border font-bold text-sm transition duration-200 cursor-pointer ${
                  side === "buy" 
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                    : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10"
                }`}
              >
                BUY SOL
              </button>
              <button 
                onClick={() => setSide("sell")}
                className={`py-2 px-4 rounded-xl border font-bold text-sm transition duration-200 cursor-pointer ${
                  side === "sell" 
                    ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20" 
                    : "bg-white/5 border-transparent text-gray-400 hover:bg-white/10"
                }`}
              >
                SELL SOL
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              {orderType === "Limit" && (
                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-1">LIMIT PRICE (USDC)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 text-white font-mono py-2.5 px-4 rounded-xl focus:outline-none focus:border-cyan-500 transition duration-200"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 font-bold block mb-1">QUANTITY (SOL)</label>
                <input 
                  type="number"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 text-white font-mono py-2.5 px-4 rounded-xl focus:outline-none focus:border-cyan-500 transition duration-200"
                />
              </div>

              {/* Estimate cost */}
              {orderType === "Limit" && (
                <div className="flex justify-between text-xs text-gray-400 pt-1">
                  <span>ESTIMATED TOTAL:</span>
                  <span className="font-mono text-white">{(Number(price) * Number(quantity)).toFixed(2)} USDC</span>
                </div>
              )}

              {/* Submit Status Notification */}
              {submitStatus.status !== "none" && (
                <div className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
                  submitStatus.status === "success" 
                    ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400" 
                    : "bg-rose-950/40 border-rose-800/40 text-rose-400"
                }`}>
                  {submitStatus.status === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                  <span className="font-medium">{submitStatus.msg}</span>
                </div>
              )}

              <button 
                type="submit"
                className={`w-full py-3 rounded-xl font-bold tracking-wide transition duration-200 cursor-pointer shadow-lg mt-2 ${
                  side === "buy" 
                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/40" 
                    : "bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white shadow-rose-950/40"
                }`}
              >
                EXECUTE {side === "buy" ? "BUY" : "SELL"}
              </button>
            </form>
          </div>

          {/* RECENT MATCHED TRADES STREAM */}
          <div className="glass rounded-2xl p-6 flex flex-col flex-1 h-[250px] overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Trades</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {recentTrades.length === 0 ? (
                <div className="text-center text-gray-600 text-xs py-8 font-medium">Waiting for trades...</div>
              ) : (
                recentTrades.map((t, idx) => (
                  <div key={`trade-${t.tradeId}-${idx}`} className="flex justify-between items-center text-xs py-1 px-2 hover:bg-white/5 rounded transition duration-200">
                    <span className="flex items-center space-x-1.5">
                      <span className="font-mono text-gray-400">{new Date().toLocaleTimeString()}</span>
                      <span className="text-gray-500">ID: {t.tradeId}</span>
                    </span>
                    <span className="flex items-center space-x-3">
                      <span className="font-mono text-white font-semibold">{t.qty.toFixed(1)} SOL</span>
                      <span className="font-mono font-bold text-emerald-400">@{t.price.toFixed(2)}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

      </main>

    </div>
  );
}
