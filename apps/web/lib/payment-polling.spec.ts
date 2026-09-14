import { describe, expect, it } from "vitest";
import {
  getReturnPaymentId,
  resolvePaymentPollingDecision,
} from "./payment-polling";

describe("payment return polling", () => {
  it("maps the MoMo orderId back to the local payment id", () => {
    const params = new URLSearchParams(
      "orderId=11111111-1111-4111-8111-111111111111",
    );

    expect(getReturnPaymentId("momo", params)).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("uses paymentId for Stripe, ZaloPay, and mock returns", () => {
    const params = new URLSearchParams("paymentId=payment-1");

    expect(getReturnPaymentId("stripe", params)).toBe("payment-1");
    expect(getReturnPaymentId("zalopay", params)).toBe("payment-1");
    expect(getReturnPaymentId("mock", params)).toBe("payment-1");
  });

  it.each([
    ["SUCCEEDED", "SUCCESS"],
    ["FAILED", "FAILED"],
    ["CANCELLED", "CANCELLED"],
  ] as const)("stops on terminal status %s", (paymentStatus, state) => {
    expect(resolvePaymentPollingDecision(paymentStatus, 1)).toEqual({
      done: true,
      state,
    });
  });

  it("continues pending payments before the attempt limit", () => {
    expect(resolvePaymentPollingDecision("PENDING", 4)).toEqual({
      done: false,
    });
  });

  it("stops as pending when the attempt limit is reached", () => {
    expect(resolvePaymentPollingDecision("PENDING", 5)).toEqual({
      done: true,
      state: "PENDING",
    });
  });
});
