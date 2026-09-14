"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquareWarning,
  Send,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ComplaintThread from "../../../../components/complaints/ComplaintThread";
import { apiRequest } from "../../../../lib/api";
import { getErrorMessage } from "../../../../lib/errors";
import {
  Complaint,
  ComplaintStatus,
  PagedComplaints,
  complaintPriority,
  complaintStatus,
  complaintTypes,
} from "../../../../lib/complaints";

export default function PartnerComplaintsPage() {
  const [result, setResult] = useState<PagedComplaints>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("WAITING_PARTNER");
  const [overdue, setOverdue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Complaint | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  // Lọc danh sách vụ việc theo trạng thái, hạn phản hồi và trang hiện tại.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      if (overdue) params.set("overdue", "true");
      setResult(
        await apiRequest<PagedComplaints>(`/complaints/partner/list?${params}`),
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể tải khiếu nại khách hàng."));
    } finally {
      setLoading(false);
    }
  }, [overdue, page, status]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);
  // Chi tiết bao gồm hội thoại và lịch sử trạng thái của đúng vụ việc thuộc đối tác.
  const openDetail = async (id: string) => {
    try {
      setDetail(await apiRequest<Complaint>(`/complaints/partner/${id}`));
      setReply("");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể tải chi tiết."));
    }
  };
  // expectedVersion ngăn phản hồi trên dữ liệu đã bị người khác cập nhật.
  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setSending(true);
    try {
      await apiRequest(`/complaints/partner/${detail.complaintId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply, expectedVersion: detail.version }),
      });
      toast.success("Đã gửi phản hồi cho Admin và khách hàng.");
      setDetail(
        await apiRequest<Complaint>(
          `/complaints/partner/${detail.complaintId}`,
        ),
      );
      setReply("");
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể gửi phản hồi."));
    } finally {
      setSending(false);
    }
  };
  const due = (item: Complaint) =>
    item.partnerDueAt && new Date(item.partnerDueAt) < new Date();

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <MessageSquareWarning className="h-6 w-6 text-primary" /> Khiếu nại
          khách hàng
        </h1>
        <p className="mt-1 text-xs text-muted">
          Phản hồi các vụ việc liên quan đến voucher và dịch vụ của đối tác.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            "",
            "WAITING_PARTNER",
            "IN_REVIEW",
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
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === value ? "bg-foreground text-background" : "border bg-card"}`}
          >
            {value ? complaintStatus[value as ComplaintStatus].label : "Tất cả"}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Chỉ quá hạn
        </label>
      </div>
      {error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b bg-secondary/40 uppercase">
              <tr>
                <th className="p-4">Khách hàng/Vấn đề</th>
                <th className="p-4">Liên quan</th>
                <th className="p-4">Ưu tiên</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Hạn phản hồi</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted">
                    Đang tải...
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted">
                    Không có khiếu nại phù hợp.
                  </td>
                </tr>
              ) : (
                result.items.map((item) => (
                  <tr key={item.complaintId} className="hover:bg-secondary/20">
                    <td className="p-4">
                      <div className="font-bold">{item.subject}</div>
                      <div className="text-[10px] text-muted">
                        {item.customer?.fullName || "Khách hàng"} ·{" "}
                        {complaintTypes[item.type]}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>{item.campaign?.title || "—"}</div>
                      <div className="font-mono text-[10px] text-muted">
                        {item.order?.orderCode}
                      </div>
                    </td>
                    <td className="p-4">{complaintPriority[item.priority]}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2 py-1 font-bold ${complaintStatus[item.status].className}`}
                      >
                        {complaintStatus[item.status].label}
                      </span>
                    </td>
                    <td
                      className={`p-4 ${due(item) ? "font-bold text-red-600" : "text-muted"}`}
                    >
                      {item.partnerDueAt ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(item.partnerDueAt).toLocaleString("vi-VN")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => void openDetail(item.complaintId)}
                        className="rounded-lg border px-3 py-1.5 font-bold hover:bg-secondary"
                      >
                        Xem và phản hồi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t p-3 text-xs">
          <button
            disabled={page <= 1}
            onClick={() => setPage((v) => v - 1)}
            className="rounded border p-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="py-1">
            Trang {result.page}/{Math.max(result.totalPages, 1)}
          </span>
          <button
            disabled={page >= result.totalPages}
            onClick={() => setPage((v) => v + 1)}
            className="rounded border p-1.5 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-background">
            <div className="flex justify-between border-b bg-card p-5">
              <div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${complaintStatus[detail.status].className}`}
                >
                  {complaintStatus[detail.status].label}
                </span>
                <h2 className="mt-2 text-lg font-extrabold">
                  {detail.subject}
                </h2>
                <p className="text-xs text-muted">
                  {detail.customer?.fullName} · {detail.order?.orderCode}
                </p>
              </div>
              <button onClick={() => setDetail(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <ComplaintThread complaint={detail} />
            </div>
            <div className="border-t bg-card p-4">
              {detail.status === "WAITING_PARTNER" ? (
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Nhập kết quả xác minh hoặc phương án hỗ trợ..."
                    className="min-h-24 flex-1 rounded-lg border bg-background p-3 text-sm"
                  />
                  <button
                    disabled={sending || !reply.trim()}
                    onClick={() => void sendReply()}
                    className="self-end rounded-lg bg-primary p-3 text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Partner chỉ có thể phản hồi khi trạng thái là “Chờ đối tác”.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
