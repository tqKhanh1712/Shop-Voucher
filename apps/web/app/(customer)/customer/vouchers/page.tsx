'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../../../../components/Header';
import { 
  Ticket, 
  Calendar, 
  MapPin, 
  QrCode, 
  AlertCircle,
  Copy,
  ChevronRight,
  Search
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';

interface Branch {
  name: string;
}

interface CampaignBranch {
  branch: Branch;
}

interface Partner {
  companyName: string;
}

interface VoucherCampaign {
  title: string;
  usageEndTime: string;
  partner: Partner;
  campaignBranches: CampaignBranch[];
}

interface OrderItem {
  campaign: VoucherCampaign;
}

interface VoucherCode {
  codeId: string;
  itemId: string;
  uniqueCode: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  issuedAt: string;
  orderItem: OrderItem;
}

interface GroupedVoucher {
  key: string;
  campaign: VoucherCampaign;
  items: VoucherCode[];
  representativeCode: string;
}

export default function CustomerVouchersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Navigation tab: 'AVAILABLE' | 'USED' | 'EXPIRED'
  const [activeTab, setActiveTab] = useState<'AVAILABLE' | 'USED' | 'EXPIRED'>('AVAILABLE');
  
  // Selected QR Code modal state
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherCode | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [filterText, setFilterText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const fetchWallet = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest<VoucherCode[]>('/vouchers/customer/wallet');
      setVouchers(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải ví voucher của bạn.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=/customer/vouchers');
      } else {
        queueMicrotask(() => {
          void fetchWallet();
        });
      }
    }
  }, [user, authLoading, router]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };


  const groupVouchers = (list: VoucherCode[]) => {
    const groupedMap = new Map<string, GroupedVoucher>();

    for (const voucher of list) {
      const campaign = voucher.orderItem.campaign;
      const key = `${campaign.partner.companyName}::${campaign.title}::${campaign.usageEndTime}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          key,
          campaign,
          items: [],
          representativeCode: voucher.uniqueCode,
        });
      }

      groupedMap.get(key)!.items.push(voucher);
    }

    return Array.from(groupedMap.values()).map((group) => ({
      ...group,
      representativeCode: group.items[0]?.uniqueCode || group.representativeCode,
    }));
  };

  // Filter vouchers based on current active tab and text/date filters
  const filteredVouchers = vouchers.filter((v) => {
    if (activeTab === 'AVAILABLE' && v.status !== 'AVAILABLE') return false;
    if (activeTab === 'USED' && v.status !== 'USED') return false;
    if (activeTab === 'EXPIRED' && v.status !== 'EXPIRED' && v.status !== 'CANCELLED') return false;

    const matchText = filterText === '' ||
      v.uniqueCode.toLowerCase().includes(filterText.toLowerCase()) ||
      v.orderItem.campaign.title.toLowerCase().includes(filterText.toLowerCase()) ||
      v.orderItem.campaign.partner.companyName.toLowerCase().includes(filterText.toLowerCase());

    let matchDate = true;
    if (filterDateFrom !== '' || filterDateTo !== '') {
      const d = new Date(v.issuedAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${yyyy}-${mm}-${dd}`;
      
      if (filterDateFrom !== '' && filterDateTo !== '') {
        matchDate = localDateStr >= filterDateFrom && localDateStr <= filterDateTo;
      } else if (filterDateFrom !== '') {
        matchDate = localDateStr >= filterDateFrom;
      } else if (filterDateTo !== '') {
        matchDate = localDateStr <= filterDateTo;
      }
    }

    return matchText && matchDate;
  });

  const groupedVouchers = groupVouchers(filteredVouchers);

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">
      <Header />
      {authLoading || loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <Ticket className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">Ví Voucher cá nhân</h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý và sử dụng các mã giảm giá bạn đã mua thành công.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TABS ĐIỀU HƯỚNG */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('AVAILABLE')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'AVAILABLE'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Chưa sử dụng ({groupVouchers(vouchers.filter((v) => v.status === 'AVAILABLE')).length})
          </button>
          <button
            onClick={() => setActiveTab('USED')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'USED'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Đã sử dụng ({groupVouchers(vouchers.filter((v) => v.status === 'USED')).length})
          </button>
          <button
            onClick={() => setActiveTab('EXPIRED')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'EXPIRED'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Lịch sử khác ({groupVouchers(vouchers.filter((v) => v.status === 'EXPIRED' || v.status === 'CANCELLED')).length})
          </button>
        </div>

        {/* THANH TÌM KIẾM VÀ LỌC */}
        {vouchers.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm theo mã code, tên voucher hoặc đối tác..." 
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-700"
              />
            </div>
            <div className="relative w-full sm:w-auto flex items-center gap-2">
              <input 
                type="date" 
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full sm:w-[160px] px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-700"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input 
                type="date" 
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full sm:w-[160px] px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-700"
              />
            </div>
          </div>
        )}

        {/* DANH SÁCH VOUCHER */}
        {vouchers.filter(v => {
          if (activeTab === 'AVAILABLE') return v.status === 'AVAILABLE';
          if (activeTab === 'USED') return v.status === 'USED';
          return v.status === 'EXPIRED' || v.status === 'CANCELLED';
        }).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Ticket className="h-10 w-10 text-muted mx-auto" />
            <h3 className="text-sm font-bold text-foreground">Không tìm thấy voucher nào</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {activeTab === 'AVAILABLE' 
                ? 'Bạn không có mã voucher nào chưa sử dụng. Hãy truy cập trang chủ để tìm kiếm khuyến mãi hấp dẫn!'
                : 'Lịch sử ví voucher của bạn hiện đang trống.'}
            </p>
            {activeTab === 'AVAILABLE' && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold transition-colors mt-2"
              >
                Mua sắm ngay
              </Link>
            )}
          </div>
        ) : groupedVouchers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <Search className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">Không tìm thấy kết quả phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Vui lòng thử lại với từ khóa hoặc ngày khác.
            </p>
            <button
              onClick={() => { setFilterText(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-bold transition-colors mt-2"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedVouchers.map((group) => {
              const voucher = group.items[0];
              const campaign = group.campaign;
              const formattedDate = new Date(campaign.usageEndTime).toLocaleDateString('vi-VN');
              const status = voucher.status;

              return (
                <div 
                  key={group.key}
                  className={`rounded-2xl border border-border bg-card p-5 flex flex-col justify-between gap-4 shadow-sm relative overflow-hidden transition-all ${
                    status === 'AVAILABLE' ? 'hover:shadow-md' : 'opacity-70'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header: Partner & Status */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {campaign.partner.companyName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          x{group.items.length}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          status === 'AVAILABLE'
                            ? 'bg-green-100 text-green-700'
                            : status === 'USED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {status === 'AVAILABLE' ? 'Chưa dùng' : status === 'USED' ? 'Đã dùng' : status === 'EXPIRED' ? 'Hết hạn' : 'Đã hủy'}
                        </span>
                      </div>
                    </div>

                    {/* Voucher Title */}
                    <h3 className="font-extrabold text-foreground text-sm sm:text-base line-clamp-2">
                      {campaign.title}
                    </h3>

                    {/* Applicable branches */}
                    <div className="flex items-start gap-1.5 text-xs text-muted pt-1">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="line-clamp-1">
                        Áp dụng tại: {campaign.campaignBranches.map(cb => cb.branch.name).join(', ')}
                      </span>
                    </div>

                    {/* Expiry Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Hạn sử dụng: <span className="font-bold text-foreground">{formattedDate}</span></span>
                    </div>
                  </div>

                  {/* Actions & Code String */}
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/40">
                    <div className="bg-secondary/60 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-foreground tracking-wider flex items-center gap-2">
                      <span>{group.representativeCode}</span>
                      <button 
                        onClick={() => handleCopyCode(group.representativeCode)}
                        className="text-muted hover:text-primary transition-colors"
                        title="Sao chép mã"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {status === 'AVAILABLE' && (
                      <button
                        onClick={() => setSelectedVoucher(group.items[0])}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-sm shadow-primary/10"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Quét mã QR
                      </button>
                    )}
                  </div>
                  
                  {copiedCode && (
                    <div className="absolute bottom-4 right-4 bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-md shadow-lg animate-fade-in-up">
                      Đã sao chép!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL HIỂN THỊ QR CODE ĐỂ QUÉT REDEEM */}
        <Dialog
          open={Boolean(selectedVoucher)}
          onOpenChange={(open) => {
            if (!open) setSelectedVoucher(null);
          }}
        >
          {selectedVoucher && (
            <DialogContent className="max-w-sm gap-6 p-6 text-center sm:max-w-sm">
              <DialogHeader className="space-y-1 pt-2 text-center sm:text-center">
                <span className="text-[10px] font-extrabold text-primary bg-primary/5 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {selectedVoucher.orderItem.campaign.partner.companyName}
                </span>
                <DialogTitle className="line-clamp-2 px-4 pt-1 text-sm leading-snug">
                  {selectedVoucher.orderItem.campaign.title}
                </DialogTitle>
              </DialogHeader>

              {/* QR Image Container */}
              <div className="bg-white border-2 border-border p-4 rounded-2xl inline-block mx-auto shadow-inner relative group">
                <QRCodeSVG
                  value={selectedVoucher.uniqueCode}
                  size={200}
                  level="M"
                  className="mx-auto"
                />
              </div>

              {/* Unique Code Display */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-secondary/80 rounded-xl px-4 py-2 font-mono text-sm font-black text-foreground tracking-widest shadow-sm">
                  <span>{selectedVoucher.uniqueCode}</span>
                  <button
                    onClick={() => handleCopyCode(selectedVoucher.uniqueCode)}
                    className="text-muted hover:text-primary transition-colors"
                    title="Sao chép mã"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                
                <DialogDescription className="mx-auto max-w-xs px-4 text-[10px] leading-relaxed">
                  Đưa mã QR này hoặc cung cấp chuỗi ký tự trên cho nhân viên chi nhánh áp dụng tại quầy thu ngân để tiến hành xác thực quét đổi voucher.
                </DialogDescription>
              </div>

            </DialogContent>
          )}
        </Dialog>

      </div>
        </div>
      )}
    </div>
  );
}
