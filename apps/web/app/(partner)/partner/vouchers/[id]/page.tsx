'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  Building2,
  CheckCircle,
  Clock3,
  Edit3,
  Lock,
  MapPin,
  Package,
  Search,
  Ticket,
  Unlock,
  UserRound,
} from 'lucide-react';
import { apiRequest } from '../../../../../lib/api';
import { getErrorMessage } from '../../../../../lib/errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../components/ui/alert-dialog';

type CampaignStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAUSED'
  | 'EXPIRED'
  | 'SOLD_OUT';
type CodeStatus = 'AVAILABLE' | 'LOCKED' | 'USED' | 'EXPIRED' | 'CANCELLED';

interface CampaignDetail {
  campaignId: string;
  title: string;
  description: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  soldQuantity: number;
  reservedStock: number;
  status: CampaignStatus;
  saleStartTime: string;
  saleEndTime: string;
  usageStartTime: string;
  usageEndTime: string;
  isMultiUse: boolean;
  maxUsesPerCode: number | null;
  issuedCodeCount: number;
  codeStats: Record<CodeStatus, number>;
  campaignBranches: Array<{
    branch: { branchId: string; name: string; address: string | null };
  }>;
  categories: Array<{ categoryId: string; nameVi: string }>;
}

interface VoucherCodeItem {
  codeId: string;
  uniqueCode: string;
  status: CodeStatus;
  issuedAt: string;
  expiresAt: string | null;
  customer: { fullName: string | null };
  orderItem: { order: { orderCode: string } };
  usageCount: number;
  lastUsage: {
    usageId: string;
    usedAt: string;
    branch: { branchId: string; name: string };
  } | null;
}

interface CodeListResponse {
  items: VoucherCodeItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-700' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Hoạt động', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-red-100 text-red-700' },
  PAUSED: { label: 'Tạm dừng', className: 'bg-orange-100 text-orange-700' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-slate-100 text-slate-500' },
  SOLD_OUT: { label: 'Hết hàng', className: 'bg-purple-100 text-purple-700' },
};

const CODE_STATUS: Record<CodeStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Khả dụng', className: 'bg-green-100 text-green-700' },
  LOCKED: { label: 'Đã khóa', className: 'bg-orange-100 text-orange-700' },
  USED: { label: 'Đã dùng', className: 'bg-blue-100 text-blue-700' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-red-100 text-red-700' },
};

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
    : '—';

export default function PartnerVoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [codes, setCodes] = useState<VoucherCodeItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [codeAction, setCodeAction] = useState<{ code: VoucherCodeItem; action: 'lock' | 'unlock' } | null>(null);
  const [processingCode, setProcessingCode] = useState(false);

  // Nạp thông tin, chi nhánh áp dụng và thống kê mã của một chiến dịch thuộc đối tác.
  const loadCampaign = useCallback(async () => {
    try {
      const data = await apiRequest<CampaignDetail>(`/vouchers/partner/${id}`);
      setCampaign(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải chi tiết chiến dịch.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Danh sách mã phục vụ quản trị (tìm/lọc/khóa), không phải quy trình quét tại quầy.
  const loadCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) query.set('status', status);
      if (keyword) query.set('keyword', keyword);
      const data = await apiRequest<CodeListResponse>(
        `/vouchers/partner/${id}/codes?${query.toString()}`,
      );
      setCodes(data.items);
      setPagination(data.pagination);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách mã voucher.'));
    } finally {
      setLoadingCodes(false);
    }
  }, [id, keyword, page, status]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCampaign();
    });
  }, [loadCampaign]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCodes();
    });
  }, [loadCodes]);

  // Khóa/mở khóa mã là thao tác quản trị để kiểm soát khả năng sử dụng mã.
  const handleCodeAction = async () => {
    if (!codeAction) return;
    setProcessingCode(true);
    setErrorMsg(null);
    try {
      await apiRequest<void>(`/vouchers/codes/${codeAction.code.codeId}/${codeAction.action}`, {
        method: 'PATCH',
      });
      setCodeAction(null);
      await Promise.all([loadCampaign(), loadCodes()]);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể cập nhật trạng thái mã voucher.'));
    } finally {
      setProcessingCode(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" /></div>;
  }

  if (!campaign) {
    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p>{errorMsg ?? 'Không tìm thấy chiến dịch voucher.'}</p>
        <Link href="/partner/vouchers" className="font-bold underline">Quay lại danh sách</Link>
      </div>
    );
  }

  const campaignStatus = CAMPAIGN_STATUS[campaign.status];
  const canEdit = campaign.status === 'DRAFT' || campaign.status === 'REJECTED';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/partner/vouchers" className="rounded-lg border border-border bg-card p-2 text-muted transition hover:text-foreground" aria-label="Quay lại">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">{campaign.title}</h1>
              <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${campaignStatus.className}`}>{campaignStatus.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Chi tiết chiến dịch và các mã voucher đã phát hành</p>
          </div>
        </div>
        {canEdit && (
          <Link href={`/partner/vouchers/${campaign.campaignId}/edit`} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">
            <Edit3 className="h-4 w-4" /> Chỉnh sửa
          </Link>
        )}
      </div>

      {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">{errorMsg}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {([
          ['Đã phát hành', campaign.issuedCodeCount, Ticket],
          ['Khả dụng', campaign.codeStats.AVAILABLE, CheckCircle],
          ['Đã khóa', campaign.codeStats.LOCKED, Lock],
          ['Đã sử dụng', campaign.codeStats.USED, Clock3],
          ['Hết hạn/Hủy', campaign.codeStats.EXPIRED + campaign.codeStats.CANCELLED, Ban],
        ] as const).map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted"><span>{label}</span><Icon className="h-4 w-4 text-primary" /></div>
            <p className="mt-3 text-2xl font-bold text-foreground">{value.toLocaleString('vi-VN')}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Package className="h-4 w-4 text-primary" />Thông tin phát hành</h2>
          <div className="grid gap-4 text-xs sm:grid-cols-2">
            <div><span className="text-muted">Giá bán</span><p className="mt-1 font-bold">{Number(campaign.salePrice).toLocaleString('vi-VN')} đ <span className="ml-1 font-normal text-muted line-through">{Number(campaign.originalPrice).toLocaleString('vi-VN')} đ</span></p></div>
            <div><span className="text-muted">Đang bán / Sức chứa</span><p className="mt-1 font-bold">{campaign.soldQuantity.toLocaleString('vi-VN')} / {campaign.capacity.toLocaleString('vi-VN')}</p></div>
            <div><span className="text-muted">Thời gian bán</span><p className="mt-1 font-medium">{formatDateTime(campaign.saleStartTime)} – {formatDateTime(campaign.saleEndTime)}</p></div>
            <div><span className="text-muted">Thời gian sử dụng</span><p className="mt-1 font-medium">{formatDateTime(campaign.usageStartTime)} – {formatDateTime(campaign.usageEndTime)}</p></div>
            <div><span className="text-muted">Chế độ sử dụng</span><p className="mt-1 font-medium">{campaign.isMultiUse ? `Nhiều lần, tối đa ${campaign.maxUsesPerCode ?? 1} lượt` : 'Một lần'}</p></div>
            <div><span className="text-muted">Danh mục</span><p className="mt-1 font-medium">{campaign.categories.map((item) => item.nameVi).join(', ') || '—'}</p></div>
          </div>
          {campaign.description && <div className="border-t border-border/60 pt-4 text-xs leading-6 text-foreground/80 whitespace-pre-wrap">{campaign.description}</div>}
        </section>
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" />Chi nhánh áp dụng</h2>
          <div className="mt-4 space-y-3">
            {campaign.campaignBranches.map(({ branch }) => (
              <div key={branch.branchId} className="rounded-lg bg-secondary/40 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-bold"><Building2 className="h-3.5 w-3.5" />{branch.name}</p>
                <p className="mt-1 text-[11px] text-muted">{branch.address ?? 'Chưa cập nhật địa chỉ'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-base font-extrabold">Từng voucher code đã phát hành</h2><p className="text-xs text-muted">Hiển thị tối thiểu thông tin khách hàng cần cho vận hành.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); setPage(1); setKeyword(keywordInput.trim()); }} className="flex gap-2">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" /><input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="Mã voucher hoặc mã đơn" className="w-56 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs" /></div>
            <button className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold" type="submit">Tìm</button>
          </form>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['', 'Tất cả'], ...Object.entries(CODE_STATUS).map(([value, config]) => [value, config.label])].map(([value, label]) => (
            <button key={value} type="button" onClick={() => { setPage(1); setStatus(value); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === value ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}>{label}</button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/40 uppercase tracking-wider"><tr><th className="p-4">Mã voucher</th><th className="p-4">Đơn hàng</th><th className="p-4">Khách hàng</th><th className="p-4">Phát hành / Hết hạn</th><th className="p-4">Sử dụng</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {loadingCodes ? (
                  <tr><td colSpan={7} className="p-10 text-center text-muted">Đang tải danh sách mã...</td></tr>
                ) : codes.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-muted">Không có voucher code phù hợp.</td></tr>
                ) : codes.map((code) => {
                  const codeStatus = CODE_STATUS[code.status];
                  return (
                    <tr key={code.codeId} className="hover:bg-secondary/20">
                      <td className="p-4 font-mono font-bold text-foreground">{code.uniqueCode}</td>
                      <td className="p-4 font-semibold">{code.orderItem.order.orderCode}</td>
                      <td className="p-4"><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-muted" />{code.customer.fullName ?? 'Khách hàng'}</span></td>
                      <td className="p-4 text-[11px] text-muted"><p>{formatDateTime(code.issuedAt)}</p><p>Hạn: {formatDateTime(code.expiresAt)}</p></td>
                      <td className="p-4 text-[11px]"><p className="font-semibold">{code.usageCount} lượt</p><p className="text-muted">{code.lastUsage ? `${formatDateTime(code.lastUsage.usedAt)} · ${code.lastUsage.branch.name}` : 'Chưa sử dụng'}</p></td>
                      <td className="p-4"><span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${codeStatus.className}`}>{codeStatus.label}</span></td>
                      <td className="p-4 text-right">
                        {code.status === 'AVAILABLE' && <button type="button" onClick={() => setCodeAction({ code, action: 'lock' })} className="inline-flex items-center gap-1 rounded-md border border-orange-300 px-2.5 py-1.5 text-[11px] font-bold text-orange-700"><Lock className="h-3.5 w-3.5" />Khóa mã</button>}
                        {code.status === 'LOCKED' && <button type="button" onClick={() => setCodeAction({ code, action: 'unlock' })} className="inline-flex items-center gap-1 rounded-md border border-green-300 px-2.5 py-1.5 text-[11px] font-bold text-green-700"><Unlock className="h-3.5 w-3.5" />Mở khóa</button>}
                        {!['AVAILABLE', 'LOCKED'].includes(code.status) && <span className="text-[10px] italic text-muted">Chỉ xem</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border p-3 text-xs">
              <span className="text-muted">{pagination.total.toLocaleString('vi-VN')} mã · Trang {pagination.page}/{pagination.totalPages}</span>
              <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Sau</button></div>
            </div>
          )}
        </div>
      </section>

      <AlertDialog open={Boolean(codeAction)} onOpenChange={(open) => { if (!open && !processingCode) setCodeAction(null); }}>
        {codeAction && <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{codeAction.action === 'lock' ? 'Khóa' : 'Mở khóa'} mã {codeAction.code.uniqueCode}?</AlertDialogTitle><AlertDialogDescription>{codeAction.action === 'lock' ? 'Mã sẽ tạm thời không thể được quét sử dụng cho đến khi bạn mở khóa.' : 'Mã sẽ khả dụng trở lại nếu vẫn còn trong thời hạn sử dụng.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={processingCode}>Hủy</AlertDialogCancel><AlertDialogAction disabled={processingCode} onClick={(event) => { event.preventDefault(); void handleCodeAction(); }}>{processingCode ? 'Đang xử lý...' : 'Xác nhận'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
      </AlertDialog>
    </div>
  );
}
