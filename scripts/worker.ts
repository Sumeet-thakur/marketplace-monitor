import "dotenv/config";
import { startScheduler } from "../lib/sync/scheduler";

// The Next.js app already boots the scheduler in-process via
// instrumentation.ts, so you do NOT need to run this for the demo to work.
// This entrypoint exists for a production topology where the background
// poller runs as its own process/container, separate from the web server.
// Run with: npm run worker

console.log("Starting marketplace-monitor background worker (standalone mode)...");
startScheduler();

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
