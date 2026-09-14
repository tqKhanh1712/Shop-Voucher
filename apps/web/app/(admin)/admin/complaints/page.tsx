"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquareWarning,
  Save,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ComplaintThread from "../../../../components/complaints/ComplaintThread";
import { useAuth } from "../../../../context/AuthContext";
import { apiRequest } from "../../../../lib/api";
import { getErrorMessage } from "../../../../lib/errors";
import {
  Complaint,
  ComplaintPriority,
  ComplaintStatus,
  PagedComplaints,
  complaintPriority,
  complaintStatus,
  complaintTypes,
} from "../../../../lib/complaints";

const transitions: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["WAITING_PARTNER", "WAITING_CUSTOMER", "RESOLVED", "REJECTED"],
  WAITING_PARTNER: ["IN_REVIEW", "WAITING_CUSTOMER", "RESOLVED", "REJECTED"],
  WAITING_CUSTOMER: ["IN_REVIEW", "WAITING_PARTNER", "RESOLVED", "REJECTED"],
  RESOLVED: ["CLOSED", "IN_REVIEW"],
  REJECTED: ["CLOSED", "IN_REVIEW"],
  CLOSED: [],
};

export default function AdminComplaintsPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<PagedComplaints>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [keyword, setKeyword] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Complaint | null>(null);
  const [nextStatus, setNextStatus] = useState<ComplaintStatus>("IN_REVIEW");
  const [nextPriority, setNextPriority] = useState<ComplaintPriority>("NORMAL");
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (overdue) params.set("overdue", "true");
      setResult(
        await apiRequest<PagedComplaints>(`/complaints/admin/list?${params}`),
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể tải hàng đợi khiếu nại."));
    } finally {
      setLoading(false);
    }
  }, [keyword, overdue, page, priority, status]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);
  const openDetail = async (id: string) => {
    try {
      const item = await apiRequest<Complaint>(`/complaints/admin/${id}`);
      setDetail(item);
      setNextStatus(transitions[item.status][0] ?? item.status);
      setNextPriority(item.priority);
      setMessage("");
      setInternal(false);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Không thể tải chi tiết."));
    }
  };
  const reloadDetail = async () => {
    if (!detail) return;
    const item = await apiRequest<Complaint>(
      `/complaints/admin/${detail.complaintId}`,
    );
    setDetail(item);
    setNextStatus(transitions[item.status][0] ?? item.status);
    setNextPriority(item.priority);
    await load();
  };
  const manage = async (payload: Record<string, unknown>) => {
    if (!detail) return;
    setSaving(true);
    try {
      await apiRequest(`/complaints/admin/${detail.complaintId}/manage`, {
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: detail.version, ...payload }),
      });
      toast.success("Đã cập nhật khiếu nại.");
      setMessage("");
      await reloadDetail();
    } catch (e: unknown) {
      toast.error(
        getErrorMessage(e, "Không thể cập nhật; dữ liệu có thể vừa thay đổi."),
      );
      try {
        await reloadDetail();
      } catch {}
    } finally {
      setSaving(false);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void manage({
      status: nextStatus,
      priority: nextPriority,
      message: message || undefined,
      visibility: internal ? "ADMIN_ONLY" : "ALL_PARTIES",
    });
  };
  const overdueAt = (item: Complaint) =>
    item.status === "WAITING_PARTNER"
      ? item.partnerDueAt
      : item.status === "WAITING_CUSTOMER"
        ? item.customerDueAt
        : null;

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <MessageSquareWarning className="h-6 w-6 text-primary" /> Hàng đợi
          khiếu nại
        </h1>
        <p className="mt-1 text-xs text-muted">
          Điều phối hội thoại giữa khách hàng, đối tác và quản trị viên.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5"
      >
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Chủ đề, khách hàng, mã đơn..."
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(complaintStatus).map(([v, c]) => (
            <option key={v} value={v}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">Tất cả ưu tiên</option>
          {Object.entries(complaintPriority).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold">
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
      </form>
      {error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-xs">
            <thead className="border-b bg-secondary/40 uppercase">
              <tr>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Vấn đề</th>
                <th className="p-4">Đối tác</th>
                <th className="p-4">Ưu tiên</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Phụ trách/SLA</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted">
                    Đang tải...
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted">
                    Không có khiếu nại phù hợp.
                  </td>
                </tr>
              ) : (
                result.items.map((item) => {
                  const due = overdueAt(item);
                  const late = due && new Date(due) < new Date();
                  return (
                    <tr
                      key={item.complaintId}
                      className="hover:bg-secondary/20"
                    >
                      <td className="p-4">
                        <div className="font-bold">
                          {item.customer?.fullName || "Khách hàng"}
                        </div>
                        <div className="text-[10px] text-muted">
                          {item.customer?.email}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="max-w-[240px] truncate font-semibold">
                          {item.subject}
                        </div>
                        <div className="text-[10px] text-muted">
                          {complaintTypes[item.type]} ·{" "}
                          {item.order?.orderCode || "Không có đơn"}
                        </div>
                      </td>
                      <td className="p-4">
                        {item.partner?.companyName || "Hệ thống"}
                      </td>
                      <td className="p-4">
                        {complaintPriority[item.priority]}
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-2 py-1 font-bold ${complaintStatus[item.status].className}`}
                        >
                          {complaintStatus[item.status].label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>{item.assignedAdmin?.fullName || "Chưa nhận"}</div>
                        {due && (
                          <div
                            className={`mt-1 flex items-center gap-1 text-[10px] ${late ? "font-bold text-red-600" : "text-muted"}`}
                          >
                            <Clock className="h-3 w-3" />
                            {new Date(due).toLocaleString("vi-VN")}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => void openDetail(item.complaintId)}
                          className="rounded-lg border px-3 py-1.5 font-bold hover:bg-secondary"
                        >
                          Xử lý
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t p-3 text-xs text-muted">
          <span>{result.total} khiếu nại</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
              className="rounded border p-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Trang {result.page}/{Math.max(result.totalPages, 1)}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage((v) => v + 1)}
              className="rounded border p-1 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-background">
            <div className="flex justify-between border-b bg-card p-5">
              <div>
                <div className="flex gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${complaintStatus[detail.status].className}`}
                  >
                    {complaintStatus[detail.status].label}
                  </span>
                  <span className="rounded bg-secondary px-2 py-1 text-[10px] font-bold">
                    v{detail.version}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-extrabold">
                  {detail.subject}
                </h2>
                <p className="text-xs text-muted">
                  {detail.customer?.fullName} ·{" "}
                  {detail.partner?.companyName || "Hệ thống"} ·{" "}
                  {detail.order?.orderCode}
                </p>
              </div>
              <button onClick={() => setDetail(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_380px]">
              <div className="overflow-auto p-5">
                <div className="mb-5 rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">
                  {detail.description}
                </div>
                <ComplaintThread complaint={detail} showInternal />
                <div className="mt-6 border-t pt-4">
                  <h3 className="mb-3 text-xs font-bold uppercase text-muted">
                    Timeline trạng thái
                  </h3>
                  <div className="space-y-2">
                    {detail.events?.map((event) => (
                      <div
                        key={event.eventId}
                        className="flex justify-between rounded-lg bg-secondary/30 p-2 text-xs"
                      >
                        <span>
                          {event.eventType}: {event.fromStatus || "—"} →{" "}
                          {event.toStatus || "—"}
                        </span>
                        <span className="text-muted">
                          {new Date(event.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <form
                onSubmit={submit}
                className="overflow-auto border-l bg-card p-5"
              >
                <div className="mb-5 rounded-xl bg-secondary/30 p-3 text-xs">
                  <div>
                    <strong>Admin phụ trách:</strong>{" "}
                    {detail.assignedAdmin?.fullName || "Chưa có"}
                  </div>
                  <div className="mt-1">
                    <strong>Ưu tiên:</strong>{" "}
                    {complaintPriority[detail.priority]}
                  </div>
                </div>
                {!detail.assignedAdmin && user && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void manage({ assignedAdminId: user.userId })
                    }
                    className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-bold text-primary"
                  >
                    <UserCheck className="h-4 w-4" /> Nhận xử lý
                  </button>
                )}
                <label className="block text-xs font-bold">
                  Trạng thái
                  <select
                    value={nextStatus}
                    onChange={(e) =>
                      setNextStatus(e.target.value as ComplaintStatus)
                    }
                    disabled={detail.status === "CLOSED"}
                    className="mt-1 w-full rounded-lg border bg-background p-2.5 text-sm"
                  >
                    <option value={detail.status}>
                      Giữ nguyên — {complaintStatus[detail.status].label}
                    </option>
                    {transitions[detail.status].map((value) => (
                      <option key={value} value={value}>
                        {complaintStatus[value].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-xs font-bold">
                  Mức ưu tiên
                  <select
                    value={nextPriority}
                    onChange={(e) =>
                      setNextPriority(e.target.value as ComplaintPriority)
                    }
                    className="mt-1 w-full rounded-lg border bg-background p-2.5 text-sm"
                  >
                    {Object.entries(complaintPriority).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-xs font-bold">
                  Nội dung phản hồi / ghi chú
                  <textarea
                    rows={8}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background p-3 text-sm"
                    placeholder="Nhập nội dung gửi các bên hoặc ghi chú nội bộ..."
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />{" "}
                  Chỉ Admin được xem
                </label>
                <button
                  disabled={saving || detail.status === "CLOSED"}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />{" "}
                  {saving ? "Đang lưu..." : "Lưu cập nhật"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
