'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, Filter, Search, Shield, X } from 'lucide-react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';

interface ActivityLog {
  activityId: string; actorUserId: string | null; actorRoleSnapshot: string | null;
  actorNameSnapshot: string | null; actorEmailSnapshot: string | null;
  category: string; actionType: string; targetEntity: string; targetId: string | null;
  occurredAt: string; metadata?: unknown; ipAddress?: string | null; userAgent?: string | null;
}
interface PagedLogs { items: ActivityLog[]; total: number; page: number; limit: number; totalPages: number; }
const categoryLabels: Record<string, string> = {
  AUTH: 'Xác thực', ACCOUNT: 'Tài khoản', ADMIN: 'Quản trị', TRANSACTION: 'Giao dịch',
  VOUCHER: 'Voucher', CONTENT: 'Nội dung', SUPPORT: 'Hỗ trợ', SYSTEM: 'Hệ thống',
};

export default function AdminAuditLogsPage() {
  const [data, setData] = useState<PagedLogs>({ items: [], total: 0, page: 1, limit: 25, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [targetEntity, setTargetEntity] = useState('');
  const [keyword, setKeyword] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActivityLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true); setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (category) params.set('category', category);
      if (actorRole) params.set('actorRole', actorRole);
      if (targetEntity.trim()) params.set('targetEntity', targetEntity.trim());
      if (keyword.trim()) params.set('actionType', keyword.trim());
      if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
      setData(await apiRequest<PagedLogs>(`/admin/audit-logs?${params.toString()}`));
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải nhật ký hệ thống.'));
    } finally { setLoading(false); }
  }, [actorRole, category, from, keyword, page, targetEntity, to]);
  useEffect(() => { queueMicrotask(() => { void loadLogs(); }); }, [loadLogs]);

  const openDetail = async (activityId: string) => {
    try { setDetail(await apiRequest<ActivityLog>(`/admin/audit-logs/${activityId}`)); }
    catch (error: unknown) { setErrorMsg(getErrorMessage(error, 'Không thể tải chi tiết nhật ký.')); }
  };

  return <div className="space-y-6">
    <div className="flex items-center gap-2 text-xs text-muted"><span>Admin Portal</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">Nhật ký hệ thống</span></div>
    <div className="border-b border-border/60 pb-4">
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-foreground sm:text-2xl"><Shield className="h-6 w-6 text-primary" /> Nhật ký hoạt động hệ thống</h1>
      <p className="mt-1 text-xs text-muted">Theo dõi thống nhất hoạt động quản trị, giao dịch, voucher, nội dung và hỗ trợ.</p>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); setPage(1); void loadLogs(); }} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-6">
      <label className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm loại hành động..." className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" /></label>
      <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">Tất cả nhóm</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={actorRole} onChange={(e) => { setActorRole(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">Tất cả vai trò</option>{['ADMIN', 'PARTNER', 'PARTNER_STAFF', 'CUSTOMER'].map((role) => <option key={role} value={role}>{role}</option>)}</select>
      <input value={targetEntity} onChange={(e) => setTargetEntity(e.target.value)} placeholder="Loại đối tượng..." className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <input type="date" aria-label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <div className="flex gap-2"><input type="date" aria-label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" /><button className="rounded-lg bg-primary px-3 text-primary-foreground" title="Áp dụng bộ lọc"><Filter className="h-4 w-4" /></button></div>
    </form>
    {errorMsg && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5" />{errorMsg}</div>}
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
        <thead className="border-b border-border bg-secondary/40 uppercase tracking-wide"><tr><th className="p-4">Thời gian</th><th className="p-4">Người thực hiện</th><th className="p-4">Nhóm</th><th className="p-4">Hành động</th><th className="p-4">Đối tượng</th><th className="p-4 text-right">Chi tiết</th></tr></thead>
        <tbody className="divide-y divide-border/60">{loading ? <tr><td colSpan={6} className="p-10 text-center text-muted">Đang tải nhật ký...</td></tr> : data.items.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-muted">Không có nhật ký phù hợp.</td></tr> : data.items.map((log) => <tr key={log.activityId} className="hover:bg-secondary/20">
          <td className="whitespace-nowrap p-4 text-muted">{new Date(log.occurredAt).toLocaleString('vi-VN')}</td>
          <td className="p-4"><div className="font-semibold">{log.actorNameSnapshot || 'Hệ thống'}</div><div className="text-[10px] text-muted">{log.actorEmailSnapshot || log.actorRoleSnapshot || 'SYSTEM'}</div></td>
          <td className="p-4"><span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">{categoryLabels[log.category] || log.category}</span></td>
          <td className="p-4 font-semibold">{log.actionType}</td><td className="p-4"><div>{log.targetEntity}</div><div className="max-w-[220px] truncate font-mono text-[10px] text-muted">{log.targetId || 'N/A'}</div></td>
          <td className="p-4 text-right"><button onClick={() => void openDetail(log.activityId)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> Xem</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted"><span>{data.total} nhật ký</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-border p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span>Trang {data.page}/{Math.max(data.totalPages, 1)}</span><button disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-border p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
    </div>
    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Chi tiết nhật ký</h2><button onClick={() => setDetail(null)}><X className="h-5 w-5" /></button></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted">Hành động</dt><dd className="font-semibold">{detail.actionType}</dd></div><div><dt className="text-xs text-muted">Nhóm</dt><dd>{categoryLabels[detail.category] || detail.category}</dd></div><div><dt className="text-xs text-muted">Người thực hiện</dt><dd>{detail.actorNameSnapshot || 'Hệ thống'}</dd></div><div><dt className="text-xs text-muted">IP</dt><dd>{detail.ipAddress || 'Không ghi nhận'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted">Đối tượng</dt><dd>{detail.targetEntity} · {detail.targetId || 'N/A'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted">Thiết bị</dt><dd className="break-all">{detail.userAgent || 'Không ghi nhận'}</dd></div></dl>
      <div className="mt-5"><p className="mb-2 text-xs font-semibold text-muted">Dữ liệu thay đổi</p><pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(detail.metadata ?? {}, null, 2)}</pre></div>
    </div></div>}
  </div>;
}
