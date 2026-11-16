import { writeFile, mkdir } from "node:fs/promises";
import {
  claimJobs,
  processVerificationJob,
  requeueStuckJobs,
} from "../lib/verification/engine";
import { expireStaleInterests } from "../lib/interests";
import { runWeeklyDigests } from "../lib/digest";
import { db } from "../lib/db";

/**
 * Verification worker (§4, §9). Polls the Postgres-backed queue with SKIP LOCKED so
 * multiple workers are safe, retries with exponential backoff inside the engine, and
 * also owns the two scheduled jobs: interest expiry and weekly saved-search digests.
 * Writes a heartbeat file the compose healthcheck reads.
 */

const HEARTBEAT_FILE = "/tmp/worker-heartbeat";
const HEARTBEAT_EVERY_MS = 5_000;
const DIGEST_EVERY_MS = 10 * 60 * 1000;
const STUCK_SWEEP_EVERY_MS = 5 * 60 * 1000;

let running = true;
let lastHeartbeat = 0;
let lastDigest = 0;
let lastSweep = 0;

function log(message: string, extra: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({ at: new Date().toISOString(), service: "verifier", message, ...extra }),
  );
}

async function heartbeat(): Promise<void> {
  if (Date.now() - lastHeartbeat < HEARTBEAT_EVERY_MS) return;
  lastHeartbeat = Date.now();
  await mkdir("/tmp", { recursive: true });
  await writeFile(HEARTBEAT_FILE, String(Math.floor(Date.now() / 1000)));
}

async function cycle(): Promise<void> {
  await expireStaleInterests();

  if (Date.now() - lastSweep > STUCK_SWEEP_EVERY_MS) {
    lastSweep = Date.now();
    await requeueStuckJobs();
  }

  const jobIds = await claimJobs(3);
  for (const jobId of jobIds) {
    const started = Date.now();
    await processVerificationJob(jobId);
    log("job.attempt", { jobId, durationMs: Date.now() - started });
  }

  if (Date.now() - lastDigest > DIGEST_EVERY_MS) {
    lastDigest = Date.now();
    // A digest failure must not stop verification polling for the whole cycle.
    try {
      const { sent } = await runWeeklyDigests();
      if (sent > 0) log("digest.sent", { sent });
    } catch (error) {
      log("digest.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function main(): Promise<void> {
  log("worker.started");
  while (running) {
    try {
      await cycle();
      await heartbeat();
    } catch (error) {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          service: "verifier",
          message: "cycle.failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      await heartbeat();
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  await db.$disconnect();
  log("worker.stopped");
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    running = false;
  });
}

main().catch(async (error) => {
  console.error("worker.crashed", error);
  await db.$disconnect();
  process.exit(1);
});
