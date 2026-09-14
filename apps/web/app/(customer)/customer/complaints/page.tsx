"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquareWarning,
  Plus,
  Send,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import Header from "../../../../components/Header";
import ComplaintThread from "../../../../components/complaints/ComplaintThread";
import { apiRequest } from "../../../../lib/api";
import { getErrorMessage } from "../../../../lib/errors";
import {
  Complaint,
  ComplaintStatus,
  PagedComplaints,
  complaintStatus,
  complaintTypes,
} from "../../../../lib/complaints";

interface OrderItem {
  itemId: string;
  campaignId: string;
  campaign: { title: string };
}
interface CustomerOrder {
  orderId: string;
  orderCode: string;
  orderItems: OrderItem[];
}

export default function CustomerComplaintsPage() {
  const [result, setResult] = useState<PagedComplaints>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Complaint | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    type: "VOUCHER",
    subject: "",
    description: "",
    orderItemId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      setResult(await apiRequest<PagedComplaints>(`/complaints?${params}`));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể tải khiếu nại."));
    } finally {
      setLoading(false);
    }
  }, [page, status]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
      void apiRequest<CustomerOrder[]>("/orders")
        .then(setOrders)
        .catch(() => setOrders([]));
    });
  }, [load]);
  const openDetail = async (id: string) => {
    try {
      setDetail(await apiRequest<Complaint>(`/complaints/${id}`));
      setReply("");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể tải chi tiết."));
    }
  };
  const refreshDetail = async () => {
    if (detail)
      setDetail(
        await apiRequest<Complaint>(`/complaints/${detail.complaintId}`),
      );
    await load();
  };
  const createComplaint = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      await apiRequest("/complaints", {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          subject: form.subject,
          description: form.description,
          orderItemId: form.orderItemId || undefined,
        }),
      });
      setCreateOpen(false);
      setForm({
        type: "VOUCHER",
        subject: "",
        description: "",
        orderItemId: "",
      });
      toast.success("Đã gửi khiếu nại.");
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể gửi khiếu nại."));
    } finally {
      setSending(false);
    }
  };
  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setSending(true);
    try {
      await apiRequest(`/complaints/${detail.complaintId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply, expectedVersion: detail.version }),
      });
      setReply("");
      await refreshDetail();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể gửi phản hồi."));
    } finally {
      setSending(false);
    }
  };
  const transition = async (action: "close" | "reopen") => {
    if (!detail) return;
    try {
      await apiRequest(`/complaints/${detail.complaintId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: detail.version }),
      });
      await refreshDetail();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể cập nhật khiếu nại."));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold">
              <MessageSquareWarning className="h-6 w-6 text-primary" /> Hỗ trợ &
              Khiếu nại
            </h1>
            <p className="mt-1 text-sm text-muted">
              Theo dõi trao đổi giữa bạn, đối tác và quản trị viên.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Tạo khiếu nại
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "",
              "OPEN",
              "IN_REVIEW",
              "WAITING_PARTNER",
              "WAITING_CUSTOMER",
              "RESOLVED",
              "REJECTED",
              "CLOSED",
            ] as const
          ).map((value) => (
            <button
              key={value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === value ? "bg-slate-800 text-white" : "border bg-white"}`}
            >
              {value
                ? complaintStatus[value as ComplaintStatus].label
                : "Tất cả"}
            </button>
          ))}
        </div>
        {error && (
          <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-muted">Đang tải...</div>
          ) : result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-muted">
              Chưa có khiếu nại phù hợp.
            </div>
          ) : (
            result.items.map((item) => (
              <button
                key={item.complaintId}
                onClick={() => void openDetail(item.complaintId)}
                className="block w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${complaintStatus[item.status].className}`}
                  >
                    {complaintStatus[item.status].label}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold">
                    {complaintTypes[item.type]}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(item.updatedAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                <h2 className="mt-3 font-bold">{item.subject}</h2>
                <div className="mt-1 text-xs text-muted">
                  {item.order?.orderCode || "Không gắn đơn hàng"} ·{" "}
                  {item.partner?.companyName || "Bộ phận hỗ trợ hệ thống"} ·{" "}
                  {item._count?.messages ?? 0} tin nhắn
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            disabled={page <= 1}
            onClick={() => setPage((v) => v - 1)}
            className="rounded border bg-white p-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            Trang {result.page}/{Math.max(result.totalPages, 1)}
          </span>
          <button
            disabled={page >= result.totalPages}
            onClick={() => setPage((v) => v + 1)}
            className="rounded border bg-white p-2 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <form
            onSubmit={createComplaint}
            className="w-full max-w-xl rounded-2xl bg-white p-6"
          >
            <div className="flex justify-between">
              <h2 className="text-lg font-extrabold">Gửi khiếu nại mới</h2>
              <button type="button" onClick={() => setCreateOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold">
                Loại vấn đề
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                >
                  {Object.entries(complaintTypes).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold">
                Đơn hàng / voucher liên quan
                <select
                  value={form.orderItemId}
                  onChange={(e) =>
                    setForm({ ...form, orderItemId: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                >
                  <option value="">Không chọn</option>
                  {orders.flatMap((order) =>
                    order.orderItems.map((item) => (
                      <option key={item.itemId} value={item.itemId}>
                        {order.orderCode} — {item.campaign.title}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <label className="block text-xs font-bold">
                Tiêu đề
                <input
                  required
                  maxLength={255}
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold">
                Nội dung
                <textarea
                  required
                  rows={6}
                  maxLength={10000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                disabled={sending}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Gửi khiếu nại
              </button>
            </div>
          </form>
        </div>
      )}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-slate-50">
            <div className="flex items-start justify-between border-b bg-white p-5">
              <div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${complaintStatus[detail.status].className}`}
                >
                  {complaintStatus[detail.status].label}
                </span>
                <h2 className="mt-2 text-lg font-extrabold">
                  {detail.subject}
                </h2>
                <p className="text-xs text-muted">Phiên bản {detail.version}</p>
              </div>
              <button onClick={() => setDetail(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <ComplaintThread complaint={detail} />
            </div>
            <div className="border-t bg-white p-4">
              {detail.status === "WAITING_CUSTOMER" && (
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Nhập thông tin bổ sung..."
                    className="min-h-20 flex-1 rounded-lg border p-3 text-sm"
                  />
                  <button
                    disabled={sending || !reply.trim()}
                    onClick={() => void sendReply()}
                    className="self-end rounded-lg bg-primary p-3 text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
              {["RESOLVED", "REJECTED"].includes(detail.status) && (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => void transition("reopen")}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  >
                    Yêu cầu xử lý lại
                  </button>
                  <button
                    onClick={() => void transition("close")}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Đóng khiếu nại
                  </button>
                </div>
              )}
              {detail.status === "WAITING_PARTNER" && (
                <p className="text-sm text-purple-700">
                  Đang chờ đối tác phản hồi.
                </p>
              )}
              {detail.status === "IN_REVIEW" && (
                <p className="text-sm text-blue-700">
                  Admin đang xem xét thông tin.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
