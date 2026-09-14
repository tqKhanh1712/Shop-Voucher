"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../../lib/api";
import { getErrorMessage } from "../../../../lib/errors";
import { useAuth } from "../../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { PaginatedResponse } from "../../../../lib/pagination";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { TablePagination } from "../../../../components/ui/table-pagination";
import {
  ShoppingBag,
  Calendar,
  User,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";

interface CustomerSnapshot {
  fullName: string | null;
  email: string | null;
}

interface CampaignSnapshot {
  title: string;
}

interface OrderItem {
  campaign: CampaignSnapshot;
  quantity: number;
  unitPrice: number;
}

interface Order {
  orderId: string;
  orderCode: string;
  totalAmount: number;
  orderStatus: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentStatus:
    "UNPAID" | "PROCESSING" | "PAID" | "FAILED" | "REFUND_PENDING" | "REFUNDED";
  createdAt: string;
  customer: CustomerSnapshot;
  orderItems: OrderItem[];
}

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [orderToRefund, setOrderToRefund] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [fetching, setFetching] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery);

  const fetchOrders = useCallback(
    async (signal?: AbortSignal) => {
      setFetching(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (debouncedSearch) params.set("keyword", debouncedSearch);
        const data = await apiRequest<PaginatedResponse<Order>>(
          `/orders/admin/list?${params.toString()}`,
          { signal },
        );
        setOrders(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setErrorMsg(
          getErrorMessage(error, "Không thể tải danh sách đơn hàng."),
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setFetching(false);
        }
      }
    },
    [page, debouncedSearch],
  );

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== "ADMIN") {
        router.push("/login?redirect=/admin/orders");
      } else {
        const controller = new AbortController();
        queueMicrotask(() => {
          if (!controller.signal.aborted) void fetchOrders(controller.signal);
        });
        return () => controller.abort();
      }
    }
  }, [user, authLoading, router, fetchOrders]);

  const handleRefundClick = async (orderId: string) => {
    setRefundingOrderId(orderId);
    setErrorMsg(null);

    try {
      await apiRequest<void>(`/orders/admin/${orderId}/refund`, {
        method: "POST",
      });
      alert("Đã hoàn tiền và hủy đơn hàng thành công!");
      fetchOrders();
    } catch (error: unknown) {
      setErrorMsg(
        getErrorMessage(
          error,
          "Thao tác hoàn tiền thất bại. Vui lòng kiểm tra lại.",
        ),
      );
    } finally {
      setRefundingOrderId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Admin Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý đơn hàng</span>
      </div>

      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Danh sách đơn đặt hàng
          </h1>
          <p className="text-xs text-muted mt-1">
            Theo dõi, kiểm tra tình trạng thanh toán và thực hiện hoàn tiền cho
            khách hàng toàn sàn.
          </p>
        </div>

        {/* Tìm kiếm */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, khách hàng..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <ShoppingBag className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">
            Không tìm thấy đơn hàng nào
          </h3>
          <p className="text-xs text-muted">
            Hệ thống chưa ghi nhận đơn hàng nào khớp với tìm kiếm.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Đơn hàng</th>
                  <th className="p-4">Khách hàng</th>
                  <th className="p-4">Sản phẩm mua</th>
                  <th className="p-4">Tổng tiền</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.map((order) => {
                  const formattedDate = new Date(
                    order.createdAt,
                  ).toLocaleDateString("vi-VN");
                  const formattedTime = new Date(
                    order.createdAt,
                  ).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={order.orderId}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-extrabold text-primary block uppercase">
                          #{order.orderCode}
                        </span>
                        <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {formattedDate} lúc {formattedTime}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {order.customer.fullName || "Ẩn danh"}
                        </div>
                        <span className="text-[10px] text-muted">
                          {order.customer.email}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="space-y-1">
                          {order.orderItems.map((item, idx) => (
                            <div key={idx} className="line-clamp-1">
                              <span className="font-medium text-foreground">
                                {item.campaign.title}
                              </span>
                              <span className="text-[10px] text-muted ml-1">
                                x{item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap font-bold text-foreground">
                        {Number(order.totalAmount).toLocaleString("vi-VN")} đ
                      </td>
                      <td className="p-4 whitespace-nowrap space-y-1">
                        {/* Trạng thái đơn */}
                        <span
                          className={`inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            order.orderStatus === "CONFIRMED"
                              ? "bg-green-100 text-green-700"
                              : order.orderStatus === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {order.orderStatus === "CONFIRMED"
                            ? "Thành công"
                            : order.orderStatus === "PENDING"
                              ? "Chờ duyệt"
                              : "Đã hủy"}
                        </span>

                        <div />

                        {/* Trạng thái thanh toán */}
                        <span
                          className={`inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            order.paymentStatus === "PAID"
                              ? "bg-green-100 text-green-700"
                              : order.paymentStatus === "REFUNDED"
                                ? "bg-slate-100 text-slate-700"
                                : order.paymentStatus === "UNPAID"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {order.paymentStatus === "PAID"
                            ? "Đã thanh toán"
                            : order.paymentStatus === "REFUNDED"
                              ? "Đã hoàn tiền"
                              : order.paymentStatus === "UNPAID"
                                ? "Chưa trả"
                                : "Đang xử lý"}
                        </span>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {order.orderStatus === "CONFIRMED" &&
                        order.paymentStatus === "PAID" ? (
                          <button
                            onClick={() => setOrderToRefund(order)}
                            disabled={refundingOrderId === order.orderId}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${refundingOrderId === order.orderId ? "animate-spin" : ""}`}
                            />
                            Hoàn tiền
                          </button>
                        ) : (
                          <span className="text-muted text-[10px] italic">
                            Không hỗ trợ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="đơn hàng"
            disabled={fetching}
            onPageChange={setPage}
          />
        </div>
      )}

      <AlertDialog
        open={Boolean(orderToRefund)}
        onOpenChange={(open) => {
          if (!open) setOrderToRefund(null);
        }}
      >
        {orderToRefund && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Hoàn tiền đơn #{orderToRefund.orderCode}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Toàn bộ giao dịch sẽ bị hủy và các mã voucher chưa sử dụng trong
                đơn hàng này sẽ bị vô hiệu hóa. Thao tác này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Giữ nguyên đơn hàng</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleRefundClick(orderToRefund.orderId)}
              >
                Hoàn tiền và hủy đơn
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
