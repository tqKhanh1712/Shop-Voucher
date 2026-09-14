export type PollablePaymentStatus =
  "CREATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type PaymentPollingState =
  "SUCCESS" | "FAILED" | "CANCELLED" | "PENDING";

export interface PaymentPollingDecision {
  done: boolean;
  state?: PaymentPollingState;
}

export const MAX_PAYMENT_STATUS_POLL_ATTEMPTS = 5;

export function getReturnPaymentId(
  provider: "stripe" | "momo" | "zalopay" | "mock",
  searchParams: Pick<URLSearchParams, "get">,
): string | null {
  return searchParams.get(provider === "momo" ? "orderId" : "paymentId");
}

export function resolvePaymentPollingDecision(
  status: PollablePaymentStatus,
  attempt: number,
  maxAttempts = MAX_PAYMENT_STATUS_POLL_ATTEMPTS,
): PaymentPollingDecision {
  if (status === "SUCCEEDED") return { done: true, state: "SUCCESS" };
  if (status === "FAILED") return { done: true, state: "FAILED" };
  if (status === "CANCELLED") return { done: true, state: "CANCELLED" };
  if (attempt >= maxAttempts) return { done: true, state: "PENDING" };
  return { done: false };
}
