export const QUEUE_NAMES = {
  VOUCHER_DELIVERY: "voucher-delivery",
  PAYMENT_WEBHOOK: "payment-webhook",
  REVENUE_SNAPSHOT: "revenue-snapshot",
  ROUTER_HEARTBEAT: "router-heartbeat",
  SPEED_BOOST: "speed-boost",
  /** Durable WireGuard provisioning — poll tunnel, rollback on failure */
  ROUTER_PROVISION: "router-provision",
} as const;

export const JOB_NAMES = {
  DELIVER_VOUCHER: "deliver-voucher",
  PROCESS_WEBHOOK: "process-webhook",
  GENERATE_SNAPSHOT: "generate-snapshot",
  CHECK_ROUTER: "check-router",
  REVERT_BOOST: "revert-boost",
  /** Enqueued by RoutersService.create() after WG peer is added on VPS */
  PROVISION_ROUTER: "provision-router",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
