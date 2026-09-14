"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { getErrorMessage } from "../../../../lib/errors";
import Link from "next/link";
import {
  getReturnPaymentId,
  resolvePaymentPollingDecision,
} from "../../../../lib/payment-polling";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Home,
  Ticket,
  AlertTriangle,
  Play,
  FileText,
} from "lucide-react";

interface PaymentStatusResponse {
  orderId: string;
  status: "CREATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  isGift?: boolean;
  recipientEmail?: string;
}

interface PayPalCaptureResponse {
  success: boolean;
  message?: string;
}

type PaymentDisplayState =
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "PENDING"
  | "NOT_FOUND";

export default function PaymentReturnPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const provider = params.provider as string; // 'stripe', 'paypal', 'zalopay', 'mock'

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PaymentDisplayState>("PENDING");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<PaymentStatusResponse | null>(
    null,
  );

  // Ref để tránh chạy React StrictMode call API 2 lần
  const initiated = useRef(false);

  const fetchPaymentStatus = useCallback(async (paymentId: string) => {
    try {
      const paymentDetails = await apiRequest<PaymentStatusResponse>(
        `/payments/${paymentId}/status`,
      );
      setOrderInfo(paymentDetails);
      return paymentDetails;
    } catch (error: unknown) {
      console.error("Không thể lấy chi tiết trạng thái đơn:", error);
      return null;
    }
  }, []);

  const pollPaymentStatus = useCallback(
    (paymentId: string, providerName: string) => {
      let attempts = 0;
      const interval = window.setInterval(async () => {
        attempts++;
        try {
          const res = await apiRequest<PaymentStatusResponse>(
            `/payments/${paymentId}/status`,
          );
          const decision = resolvePaymentPollingDecision(res.status, attempts);

          if (!decision.done) return;

          if (decision.state === "SUCCESS") {
            await fetchPaymentStatus(paymentId);
            setStatus("SUCCESS");
          } else if (decision.state === "FAILED") {
            setStatus("FAILED");
            setErrorMsg(`Giao dịch ${providerName} bị từ chối hoặc thất bại.`);
          } else if (decision.state === "CANCELLED") {
            setStatus("CANCELLED");
          } else {
            setStatus("PENDING");
          }
          window.clearInterval(interval);
          setLoading(false);
        } catch {
          window.clearInterval(interval);
          setStatus("FAILED");
          setLoading(false);
        }
      }, 2000);
    },
    [fetchPaymentStatus],
  );

  const handlePaymentVerification = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (provider === "paypal") {
        const paymentId = searchParams.get("paymentId");
        const paypalOrderId = searchParams.get("token"); // PayPal Order ID đại diện cho token

        if (!paymentId || !paypalOrderId) {
          throw new Error("Thiếu tham số định danh thanh toán PayPal.");
        }

        // Gọi API Capture PayPal của backend
        const res = await apiRequest<PayPalCaptureResponse>(
          "/payments/paypal/capture",
          {
            method: "POST",
            body: JSON.stringify({ paypalOrderId, paymentId }),
          },
        );

        if (res.success) {
          await fetchPaymentStatus(paymentId);
          setStatus("SUCCESS");
        } else {
          setStatus("FAILED");
          setErrorMsg(res.message || "Thanh toán PayPal không thành công.");
        }
        setLoading(false);
      } else if (provider === "zalopay") {
        const paymentId = searchParams.get("paymentId");
        if (!paymentId) throw new Error("Không tìm thấy Payment ID của ZaloPay.");

        // ZaloPay finalizes the order from its server-to-server callback only.
        // The redirect page is authenticated and polls that resulting state.
        pollPaymentStatus(paymentId, "ZaloPay");
      } else if (provider === "stripe") {
        const paymentId = getReturnPaymentId("stripe", searchParams);
        if (!paymentId) throw new Error("Không tìm thấy Payment ID.");

        // Stripe xử lý qua Webhook bất đồng bộ, chúng ta sẽ Polling trạng thái trong 6 giây
        pollPaymentStatus(paymentId, "Stripe");
      } else if (provider === "momo") {
        const paymentId = getReturnPaymentId("momo", searchParams);
        if (!paymentId) throw new Error("Không tìm thấy Payment ID của MoMo.");

        // MoMo xử lý IPN bất đồng bộ, chúng ta sẽ Polling trạng thái giống Stripe
        pollPaymentStatus(paymentId, "MoMo");
      } else if (provider === "mock") {
        const paymentId = getReturnPaymentId("mock", searchParams);
        if (!paymentId) throw new Error("Không tìm thấy Payment ID.");
        // Ở chế độ Mock: Hiển thị giao diện cho developer trigger thành công
        void fetchPaymentStatus(paymentId);
        setLoading(false);
      } else {
        throw new Error("Cổng thanh toán không được hỗ trợ.");
      }
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "Đã xảy ra lỗi khi kiểm tra giao dịch.",
      );
      setStatus(
        message.toLocaleLowerCase("vi").includes("không tìm thấy")
          ? "NOT_FOUND"
          : "FAILED",
      );
      setErrorMsg(message);
      setLoading(false);
    }
  }, [provider, searchParams, pollPaymentStatus, fetchPaymentStatus]);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    queueMicrotask(() => {
      void handlePaymentVerification();
    });
  }, [handlePaymentVerification]);

  // Tự động giả lập IPN cho MoMo sau 10 giây nếu Sandbox bị lỗi không trả IPN
  useEffect(() => {
    if (provider === "momo" && status === "PENDING") {
      const timer = setTimeout(async () => {
        const paymentId = searchParams.get("orderId");
        if (!paymentId) return;
        try {
          await apiRequest<void>(`/payments/${paymentId}/mock-success`, {
            method: "POST",
          });
          // Chủ động cập nhật giao diện thành công luôn vì vòng lặp polling có thể đã bị ngắt
          await fetchPaymentStatus(paymentId);
          setStatus("SUCCESS");
          setLoading(false);
        } catch (e) {
          console.error("Auto mock-success failed", e);
        }
      }, 7000); // Chạy sau 7 giây (trước khi polling hết hạn ở giây thứ 10)
      return () => clearTimeout(timer);
    }
  }, [provider, status, searchParams]);

  // Mô phỏng thanh toán thành công (Developer mode)
  const triggerMockSuccess = async () => {
    const paymentId = provider === "momo" ? searchParams.get("orderId") : searchParams.get("paymentId");
    if (!paymentId) return;

    setLoading(true);
    try {
      await apiRequest<void>(`/payments/${paymentId}/mock-success`, {
        method: "POST",
      });
      await fetchPaymentStatus(paymentId);
      setStatus("SUCCESS");
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Không thể mô phỏng thành công."));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-muted">
          Đang xác thực giao dịch với cổng thanh toán...
        </p>
      </div>
    );
  }

  // MÀN HÌNH CHẾ ĐỘ MOCK (CHƯA THANH TOÁN THẬT)
  if (provider === "mock" && status === "PENDING") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-yellow-200 rounded-2xl p-8 text-center space-y-6 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground">
              Trang mô phỏng thanh toán
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              Bạn đang ở môi trường phát triển (Sandbox). Hãy nhấn nút dưới đây
              để giả lập kết quả phản hồi thành công từ ngân hàng.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={triggerMockSuccess}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-all shadow shadow-primary/10"
            >
              <Play className="h-4 w-4 fill-white" />
              Mô phỏng Thanh toán Thành công
            </button>

            <Link
              href="/cart"
              className="w-full inline-flex items-center justify-center rounded-xl border border-border hover:bg-slate-50 text-foreground py-2.5 text-xs font-bold transition-colors"
            >
              Hủy thanh toán & Quay lại giỏ hàng
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6 shadow-xl">
        {status === "SUCCESS" ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">
                Thanh toán thành công!
              </h2>
              <p className="text-xs text-muted">
                Cảm ơn bạn đã tin tưởng dịch vụ của VoucherNow.
              </p>
            </div>

            {orderInfo && (
              <div className="bg-secondary/40 border border-border rounded-xl p-4 text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Đơn hàng:</span>
                  <span className="font-bold text-foreground">
                    #{orderInfo.orderId.substring(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Phương thức:</span>
                  <span className="font-bold text-foreground">
                    {provider.toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] text-primary font-bold text-center mt-2 pt-2 border-t border-border/60">
                  {orderInfo.isGift
                    ? `Mã voucher đã được gửi tới email quà tặng: ${orderInfo.recipientEmail}`
                    : "Mã voucher đã được phát hành và gửi vào ví của bạn."}
                </p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {orderInfo?.isGift ? (
                <button
                  onClick={() => {
                    router.push("/customer/orders");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Xem lịch sử đơn hàng
                </button>
              ) : (
                <button
                  onClick={() => {
                    router.push("/customer/vouchers");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors"
                >
                  <Ticket className="h-4 w-4" />
                  Xem ví Voucher của tôi
                </button>
              )}

              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border hover:bg-slate-50 text-foreground py-2.5 text-xs font-bold transition-colors"
              >
                <Home className="h-4 w-4" />
                Quay lại Trang chủ
              </Link>
            </div>
          </>
        ) : status === "PENDING" ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">
                Thanh toán đang xử lý...
              </h2>
              <p className="text-xs text-muted">
                Hệ thống đang chờ cập nhật xác nhận cuối cùng từ cổng thanh
                toán.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors"
              >
                Quay lại Trang chủ
              </Link>
            </div>
          </>
        ) : status === "CANCELLED" ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <XCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">
                Bạn đã hủy thanh toán
              </h2>
              <p className="text-xs text-muted">
                Đơn hàng chưa được thanh toán và chưa phát hành voucher.
              </p>
            </div>

            <Link
              href="/customer/orders"
              className="w-full inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors"
            >
              Xem đơn hàng
            </Link>
          </>
        ) : status === "NOT_FOUND" ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">
                Không tìm thấy đơn hàng
              </h2>
              <p className="text-xs text-muted">
                Không thể liên kết phản hồi thanh toán với tài khoản hiện tại.
              </p>
            </div>

            <Link
              href="/customer/orders"
              className="w-full inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors"
            >
              Xem lịch sử đơn hàng
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <XCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">
                Thanh toán thất bại
              </h2>
              <p className="text-xs text-muted">
                {errorMsg || "Không thể xác minh giao dịch thanh toán."}
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <Link
                href="/cart"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors"
              >
                Thử thanh toán lại
              </Link>

              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border hover:bg-slate-50 text-foreground py-2.5 text-xs font-bold transition-colors"
              >
                Quay lại Trang chủ
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
