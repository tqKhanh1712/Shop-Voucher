"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../../lib/api";
import { getErrorMessage } from "../../../../lib/errors";
import { PaginatedResponse } from "../../../../lib/pagination";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { TablePagination } from "../../../../components/ui/table-pagination";
import Link from "next/link";
import {
  Ticket,
  Plus,
  Send,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronRight,
  Package,
  PlayCircle,
  Eye,
  Edit3,
  PauseCircle,
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

interface Branch {
  branchId: string;
  name: string;
}

interface CampaignBranch {
  branch: Branch;
}

interface CampaignCategory {
  isPrimary: boolean;
  category: {
    nameVi: string;
    code: string;
  };
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  category: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  soldQuantity: number;
  reservedStock: number;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "PAUSED"
    | "EXPIRED"
    | "SOLD_OUT";
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  campaignBranches: CampaignBranch[];
  campaignCategories: CampaignCategory[];
  issuedCodeCount: number;
  usedCount: number;
  revenue: number;
}

interface PartnerCampaignResponse extends PaginatedResponse<VoucherCampaign> {
  summary: {
    totalCampaigns: number;
    totalCapacity: number;
    soldQuantity: number;
    totalRevenue: number;
  };
}

const STATUS_CONFIG: Record<
  VoucherCampaign["status"],
  { label: string; badgeClass: string }
> = {
  DRAFT: { label: "Bản nháp", badgeClass: "bg-slate-100 text-slate-700" },
  PENDING_APPROVAL: {
    label: "Chờ duyệt",
    badgeClass: "bg-yellow-100 text-yellow-800",
  },
  APPROVED: { label: "Hoạt động", badgeClass: "bg-green-100 text-green-700" },
  REJECTED: { label: "Đã từ chối", badgeClass: "bg-red-100 text-red-700" },
  PAUSED: { label: "Tạm dừng", badgeClass: "bg-orange-100 text-orange-700" },
  EXPIRED: { label: "Hết hạn", badgeClass: "bg-slate-100 text-slate-500" },
  SOLD_OUT: { label: "Hết hàng", badgeClass: "bg-purple-100 text-purple-700" },
};

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "DRAFT", label: "Bản nháp" },
  { value: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Hoạt động" },
  { value: "PAUSED", label: "Tạm dừng" },
  { value: "REJECTED", label: "Đã từ chối" },
  { value: "EXPIRED", label: "Hết hạn" },
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function PartnerVouchersPage() {
  const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [campaignToSubmit, setCampaignToSubmit] =
    useState<VoucherCampaign | null>(null);
  const [statusAction, setStatusAction] = useState<{
    campaign: VoucherCampaign;
    targetStatus: "APPROVED" | "PAUSED";
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    totalCapacity: 0,
    totalSold: 0,
    totalRevenue: 0,
  });
  const debouncedSearch = useDebouncedValue(searchTerm);

  // Lấy chiến dịch của chính đối tác, kèm số liệu tổng hợp cho các thẻ KPI.
  const loadCampaigns = useCallback(
    async (signal?: AbortSignal) => {
      setFetching(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (debouncedSearch) params.set("keyword", debouncedSearch);
        if (statusFilter) params.set("status", statusFilter);
        const data = await apiRequest<PartnerCampaignResponse>(
          `/vouchers/partner/list?${params.toString()}`,
          { signal },
        );
        setCampaigns(data.items);
        setTotalPages(data.totalPages);
        setStats({
          total: data.summary.totalCampaigns,
          totalCapacity: data.summary.totalCapacity,
          totalSold: data.summary.soldQuantity,
          totalRevenue: data.summary.totalRevenue,
        });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setErrorMsg(
          getErrorMessage(error, "Không thể tải danh sách chiến dịch."),
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setFetching(false);
        }
      }
    },
    [page, debouncedSearch, statusFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadCampaigns(controller.signal);
    });
    return () => controller.abort();
  }, [loadCampaigns]);

  // Chuyển bản nháp/từ chối sang trạng thái chờ Admin phê duyệt.
  const handleSubmitForApproval = async (campaignId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(`/vouchers/${campaignId}/submit`, {
        method: "POST",
      });
      setSuccessMsg("Gửi yêu cầu phê duyệt voucher thành công!");
      loadCampaigns();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Gửi yêu cầu phê duyệt thất bại."));
    }
  };

  // Đối tác chỉ có thể ngừng bán hoặc mở bán lại chiến dịch của mình.
  const handleStatusAction = async () => {
    if (!statusAction) return;
    setUpdatingStatus(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest<void>(
        `/vouchers/partner/${statusAction.campaign.campaignId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: statusAction.targetStatus }),
        },
      );
      setSuccessMsg(
        statusAction.targetStatus === "PAUSED"
          ? `Đã ngừng bán "${statusAction.campaign.title}".`
          : `Đã mở bán lại "${statusAction.campaign.title}".`,
      );
      setStatusAction(null);
      await loadCampaigns();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: unknown) {
      setErrorMsg(
        getErrorMessage(error, "Không thể cập nhật trạng thái bán voucher."),
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Partner Portal</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Quản lý Voucher</span>
      </div>

      {/* TIÊU ĐỀ & TÌM KIẾM */}
      <div className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Danh sách Chiến dịch Voucher
          </h1>
          <p className="text-xs text-muted mt-1">
            Tạo mới, theo dõi phê duyệt, kiểm tra doanh thu bán ra và tỷ lệ quét
            sử dụng voucher (BR-PAR-07).
          </p>
        </div>

        <div className="flex items-center gap-2 max-w-md w-full sm:justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên voucher..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <Link
            href="/partner/vouchers/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-3 py-2 text-xs font-semibold text-primary-foreground transition shadow shadow-primary/10 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Tạo Voucher mới
          </Link>
        </div>
      </div>

      {/* THÔNG BÁO */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-800 text-sm">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB LỌC TRẠNG THÁI */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* THỐNG KÊ NHANH */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Chiến dịch",
            value: stats.total,
            icon: <Ticket className="h-4 w-4 text-primary" />,
          },
          {
            label: "Tổng sức chứa",
            value: stats.totalCapacity,
            icon: <Package className="h-4 w-4 text-primary" />,
          },
          {
            label: "Đang bán thực tế",
            value: stats.totalSold,
            icon: <CheckCircle className="h-4 w-4 text-primary" />,
          },
          {
            label: "Tổng doanh thu tạm tính",
            value: `${stats.totalRevenue.toLocaleString("vi-VN")} đ`,
            icon: <PlayCircle className="h-4 w-4 text-primary" />,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {stat.label}
              </span>
              {stat.icon}
            </div>
            <div className="mt-3 text-lg sm:text-xl font-bold text-foreground truncate">
              {stat.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* BẢNG DANH SÁCH CHIẾN DỊCH */}
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Ticket className="h-10 w-10 text-muted mx-auto" />
          <h3 className="text-sm font-bold text-foreground">
            Không tìm thấy chiến dịch nào
          </h3>
          <p className="text-xs text-muted">
            Bấm nút &quot;Tạo Voucher mới&quot; ở trên hoặc thay đổi bộ lọc tìm
            kiếm.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground/80 font-bold uppercase tracking-wider">
                  <th className="p-4">Chiến dịch</th>
                  <th className="p-4">Định giá</th>
                  <th className="p-4">Bán/Phát hành</th>
                  <th className="p-4">Đã sử dụng</th>
                  <th className="p-4">Doanh thu</th>
                  <th className="p-4">Thời gian</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {campaigns.map((campaign) => {
                  const cfg = STATUS_CONFIG[campaign.status];
                  const saleRate =
                    campaign.capacity > 0
                      ? Math.round(
                          (campaign.soldQuantity / campaign.capacity) * 100,
                        )
                      : 0;
                  const usageRate =
                    campaign.soldQuantity > 0
                      ? Math.round(
                          (campaign.usedCount / campaign.soldQuantity) * 100,
                        )
                      : 0;

                  return (
                    <tr
                      key={campaign.campaignId}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Tên & Thư mục */}
                      <td className="p-4 max-w-[200px]">
                        <p className="font-bold text-foreground line-clamp-2 leading-snug">
                          {campaign.title}
                        </p>
                        {campaign.campaignCategories &&
                        campaign.campaignCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {campaign.campaignCategories
                              .slice(0, 1)
                              .map((cc) => (
                                <span
                                  key={cc.category.code}
                                  className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/5 px-1.5 py-0.5 rounded"
                                >
                                  {cc.category.nameVi}
                                </span>
                              ))}
                          </div>
                        ) : campaign.category ? (
                          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted bg-secondary px-1.5 py-0.5 rounded">
                            {campaign.category}
                          </span>
                        ) : null}
                      </td>

                      {/* Giá */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-foreground">
                          {Number(campaign.salePrice).toLocaleString("vi-VN")} đ
                        </span>
                        <div className="text-[10px] text-muted line-through mt-0.5">
                          {Number(campaign.originalPrice).toLocaleString(
                            "vi-VN",
                          )}{" "}
                          đ
                        </div>
                      </td>

                      {/* Tiến độ bán */}
                      <td className="p-4">
                        <div className="text-muted mb-1">
                          <span className="font-semibold text-foreground">
                            {campaign.soldQuantity}
                          </span>
                          /{campaign.capacity} chiếc
                        </div>
                        <div className="h-1.5 w-20 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${saleRate}%` }}
                          />
                        </div>
                        {campaign.reservedStock > 0 && (
                          <div className="text-[10px] text-yellow-600 mt-0.5">
                            ({campaign.reservedStock} tạm giữ)
                          </div>
                        )}
                        <div className="mt-0.5 text-[10px] text-muted">
                          {campaign.issuedCodeCount} mã đã phát hành
                        </div>
                      </td>

                      {/* Quét/Sử dụng */}
                      <td className="p-4">
                        <div className="text-muted mb-1">
                          <span className="font-semibold text-foreground">
                            {campaign.usedCount}
                          </span>{" "}
                          lượt quét
                        </div>
                        <div className="h-1.5 w-20 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${usageRate}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          {usageRate}% sử dụng
                        </div>
                      </td>

                      {/* Doanh thu */}
                      <td className="p-4 whitespace-nowrap font-bold text-foreground">
                        {Number(campaign.revenue).toLocaleString("vi-VN")} đ
                      </td>

                      {/* Thời hạn */}
                      <td className="p-4 whitespace-nowrap text-[11px] text-muted space-y-0.5">
                        <div>
                          Mở bán:{" "}
                          <span className="text-foreground font-medium">
                            {formatDateTime(campaign.saleStartTime)}
                          </span>
                        </div>
                        <div>
                          Hết hạn:{" "}
                          <span className="text-foreground font-medium">
                            {formatDateTime(campaign.saleEndTime)}
                          </span>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/partner/vouchers/${campaign.campaignId}`}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground transition hover:bg-secondary"
                          >
                            <Eye className="h-3 w-3" /> Xem
                          </Link>
                          {(campaign.status === "DRAFT" ||
                            campaign.status === "REJECTED") && (
                            <>
                              <Link
                                href={`/partner/vouchers/${campaign.campaignId}/edit`}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50"
                              >
                                <Edit3 className="h-3 w-3" /> Sửa
                              </Link>
                              <button
                                onClick={() => setCampaignToSubmit(campaign)}
                                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-primary-hover"
                              >
                                <Send className="h-3 w-3" /> Gửi duyệt
                              </button>
                            </>
                          )}
                          {campaign.status === "APPROVED" && (
                            <button
                              onClick={() =>
                                setStatusAction({
                                  campaign,
                                  targetStatus: "PAUSED",
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-orange-300 px-2.5 py-1.5 text-[11px] font-bold text-orange-700 transition hover:bg-orange-50"
                            >
                              <PauseCircle className="h-3 w-3" /> Ngừng bán
                            </button>
                          )}
                          {campaign.status === "PAUSED" && (
                            <button
                              onClick={() =>
                                setStatusAction({
                                  campaign,
                                  targetStatus: "APPROVED",
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-green-300 px-2.5 py-1.5 text-[11px] font-bold text-green-700 transition hover:bg-green-50"
                            >
                              <PlayCircle className="h-3 w-3" /> Mở bán lại
                            </button>
                          )}
                        </div>
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
            total={stats.total}
            itemLabel="chiến dịch"
            disabled={fetching}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* CONFIRM MODAL */}
      <AlertDialog
        open={Boolean(campaignToSubmit)}
        onOpenChange={(open) => {
          if (!open) setCampaignToSubmit(null);
        }}
      >
        {campaignToSubmit && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Gửi duyệt chiến dịch &quot;{campaignToSubmit.title}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sau khi gửi, chiến dịch sẽ chuyển sang trạng thái chờ Admin phê
                duyệt và bạn không thể tự ý chỉnh sửa cho đến khi có kết quả.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Tiếp tục chỉnh sửa</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  void handleSubmitForApproval(campaignToSubmit.campaignId)
                }
              >
                Gửi yêu cầu phê duyệt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog
        open={Boolean(statusAction)}
        onOpenChange={(open) => {
          if (!open && !updatingStatus) setStatusAction(null);
        }}
      >
        {statusAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {statusAction.targetStatus === "PAUSED"
                  ? "Ngừng bán"
                  : "Mở bán lại"}{" "}
                &quot;{statusAction.campaign.title}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusAction.targetStatus === "PAUSED"
                  ? "Chiến dịch sẽ bị ẩn khỏi nơi mua voucher mới. Các mã đã bán vẫn có thể được sử dụng."
                  : "Chiến dịch sẽ hiển thị trở lại nếu còn thời gian bán và còn số lượng."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatingStatus}>
                Hủy bỏ
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={updatingStatus}
                onClick={(event) => {
                  event.preventDefault();
                  void handleStatusAction();
                }}
              >
                {updatingStatus ? "Đang xử lý..." : "Xác nhận"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
