// load-test.js
// Run with: node load-test.js [durationSeconds] [concurrency]

const duration = parseInt(process.argv[2]) || 5; // seconds
const concurrency = parseInt(process.argv[3]) || 10; // concurrent workers
const url = "http://localhost:3000/api/v1/order";

console.log(`Starting load test against ${url}`);
console.log(`Duration: ${duration}s, Concurrency: ${concurrency} workers`);

let totalRequests = 0;
let successCount = 0;
let failCount = 0;
const latencies = [];
let keepRunning = true;

async function worker() {
  while (keepRunning) {
    const start = Date.now();
    try {
      const price = Math.floor(Math.random() * 20) + 90; // price between 90 and 110
      const qty = Math.floor(Math.random() * 5) + 1; // qty between 1 and 5
      const side = Math.random() > 0.5 ? "buy" : "sell";
      const user = Math.random() > 0.5 ? "user1" : "user2";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: side,
          type: "Limit",
          price: price,
          quantity: qty,
          market: "SOL_USDC",
          userId: user
        })
      });

      const end = Date.now();
      const latency = end - start;
      latencies.push(latency);
      totalRequests++;

      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      failCount++;
      totalRequests++;
      latencies.push(Date.now() - start);
    }
  }
}

async function run() {
  const startTest = Date.now();
  
  // Start workers
  const workers = Array.from({ length: concurrency }, worker);

  // Set timeout to stop
  await new Promise(resolve => setTimeout(resolve, duration * 1000));
  keepRunning = false;

  // Wait for all workers to finish current request
  await Promise.all(workers);

  const endTest = Date.now();
  const actualDuration = (endTest - startTest) / 1000;
  
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
  const p95Idx = Math.floor(latencies.length * 0.95);
  const p99Idx = Math.floor(latencies.length * 0.99);
  const p95 = latencies[p95Idx] || 0;
  const p99 = latencies[p99Idx] || 0;
  const ops = totalRequests / actualDuration;

  console.log("\nLoad Test Results:");
  console.log(`| Metric | Value |`);
  console.log(`| --- | --- |`);
  console.log(`| Total Requests | ${totalRequests} |`);
  console.log(`| Successful Requests | ${successCount} |`);
  console.log(`| Failed Requests | ${failCount} |`);
  console.log(`| Duration | ${actualDuration.toFixed(2)}s |`);
  console.log(`| Throughput (Req/sec) | ${ops.toFixed(2)} ops/sec |`);
  console.log(`| Average Latency | ${avgLatency.toFixed(2)}ms |`);
  console.log(`| P95 Latency | ${p95}ms |`);
  console.log(`| P99 Latency | ${p99}ms |`);
}

run().catch(console.error);
