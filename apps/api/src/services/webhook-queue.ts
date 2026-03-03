import { Queue, Worker, type Job } from "bullmq";
import { redisConnectionOpts } from "../lib/redis";
import { executeWebhookDelivery } from "./webhook";

const QUEUE_NAME = "webhooks";

/**
 * BullMQ queue for reliable webhook delivery.
 * Jobs are persisted in Redis and retried on failure.
 */
export const webhookQueue = new Queue(QUEUE_NAME, {
  connection: redisConnectionOpts,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

let worker: Worker | null = null;

/**
 * Enqueue a webhook event for delivery.
 * Finds matching subscriptions and creates one job per subscription.
 */
export async function enqueueWebhook(
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  await webhookQueue.add("deliver", { type, data }, {
    jobId: `${type}-${crypto.randomUUID()}`,
  });
}

/**
 * Start the webhook worker. Processes jobs from the queue.
 */
export function startWebhookWorker(): void {
  if (worker) return;

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { type, data } = job.data as {
        type: string;
        data: Record<string, unknown>;
      };
      await executeWebhookDelivery(type, data);
    },
    {
      connection: redisConnectionOpts,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[webhook-queue] job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[webhook-queue] job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message
    );
  });

  console.log("[webhook-queue] worker started");
}

/**
 * Gracefully stop the webhook worker.
 */
export async function stopWebhookWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log("[webhook-queue] worker stopped");
  }
  await webhookQueue.close();
}
