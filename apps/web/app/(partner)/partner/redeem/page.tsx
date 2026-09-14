'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  QrCode, 
  Store, 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  ShieldCheck,
  Camera,
  Keyboard,
  AlertTriangle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';

interface Branch {
  branchId: string;
  name: string;
}

interface VerifiedVoucher {
  codeId: string;
  uniqueCode: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'CANCELLED' | 'LOCKED';
  issuedAt: string;
  redemptionEligibility: {
    redeemable: boolean;
    reason:
      | 'ELIGIBLE'
      | 'NOT_STARTED'
      | 'INDIVIDUAL_EXPIRED'
      | 'CAMPAIGN_EXPIRED'
      | 'USED'
      | 'EXPIRED'
      | 'CANCELLED'
      | 'LOCKED'
      | 'UNAVAILABLE';
    message: string | null;
  };
  customer: {
    fullName: string | null;
    email: string | null;
  };
  campaign: {
    title: string;
    description: string | null;
    usageStartTime: string;
    usageEndTime: string;
    isMultiUse: boolean;
    maxUsesPerCode: number | null;
    branches: string[];
  };
}

interface RedeemResult {
  usageId: string;
  usedAt: string;
  branch: {
    name: string;
  };
}

interface ScannerInstance {
  clear: () => Promise<void>;
}

const formatVietnamDateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });

// Mã mới luôn có 12 ký tự; giới hạn rộng hơn giữ khả năng đổi mã legacy.
const LEGACY_VOUCHER_CODE_MAX_LENGTH = 64;

export default function PartnerRedeemPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Scanned / Manual Input states
  const [uniqueCode, setUniqueCode] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  
  // Redeem result alerts
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);

  // Scan Mode: 'manual' | 'camera'
  const [scanMode, setScanMode] = useState<'manual' | 'camera'>('manual');
  
  // Preview verified voucher before actually redeeming
  const [verifiedVoucher, setVerifiedVoucher] = useState<VerifiedVoucher | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Lấy danh sách chi nhánh
  const loadBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const data = await apiRequest<Branch[]>('/partners/branches');
      setBranches(data);
      if (data.length > 0) {
        const staffBranchId = user?.branchId;
        if (staffBranchId) {
          setSelectedBranchId(staffBranchId);
        } else {
          setSelectedBranchId(data[0].branchId);
        }
      }
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải danh sách chi nhánh.'));
    } finally {
      setLoadingBranches(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (user.role !== 'PARTNER' && user.role !== 'PARTNER_STAFF' && user.role !== 'ADMIN')) {
        router.push('/login?redirect=/partner/redeem');
      } else {
        queueMicrotask(() => {
          void loadBranches();
        });
      }
    }
  }, [user, authLoading, router, loadBranches]);

  const handleCodeLookup = useCallback(async (code: string) => {
    if (!code.trim()) {
      setErrorMsg('Vui lòng cung cấp mã voucher.');
      return;
    }

    setVerifying(true);
    setErrorMsg(null);
    setRedeemResult(null);

    try {
      const data = await apiRequest<VerifiedVoucher>(`/vouchers/redeem/verify/${code.trim().toUpperCase()}`);
      setVerifiedVoucher(data);
      setUniqueCode(code.trim().toUpperCase());
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Mã voucher không hợp lệ hoặc thuộc đối tác khác.'));
      setScanMode('manual');
    } finally {
      setVerifying(false);
    }
  }, []);

  // Khởi động/Tắt camera scanner của html5-qrcode
  useEffect(() => {
    let activeScanner: ScannerInstance | null = null;
    let disposed = false;

    if (scanMode === 'camera' && !verifiedVoucher) {
      // Load dynamically to avoid SSR document/window undefined issues
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            // Quét thành công
            if (decodedText) {
              scanner.clear().catch((e) => console.error(e));
              handleCodeLookup(decodedText);
            }
          },
          () => {
            // Bỏ qua lỗi quét liên tục khi camera đang bắt nét
          }
        );

        if (disposed) {
          void scanner.clear();
          return;
        }
        activeScanner = scanner;
      }).catch((error: unknown) => {
        console.error('Failed to load html5-qrcode scanner', error);
      });
    }

    return () => {
      disposed = true;
      if (activeScanner) {
        activeScanner.clear().catch((error: unknown) => console.error('Clear scanner error', error));
      }
    };
  }, [scanMode, verifiedVoucher, handleCodeLookup]);

  // Xác nhận Đổi Voucher (Redeem)
  const handleConfirmRedeem = async () => {
    if (!verifiedVoucher) return;
    if (!selectedBranchId) {
      setErrorMsg('Vui lòng chọn chi nhánh thực hiện đổi mã.');
      return;
    }

    setRedeeming(true);
    setErrorMsg(null);

    try {
      const result = await apiRequest<RedeemResult>('/vouchers/redeem', {
        method: 'POST',
        body: JSON.stringify({
          uniqueCode: verifiedVoucher.uniqueCode,
          branchId: selectedBranchId,
        }),
      });
      setRedeemResult(result);
      setVerifiedVoucher(null); // Clear preview card
      setUniqueCode('');
      setScanMode('manual'); // Trả về nhập tay
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Xác thực đổi mã voucher thất bại.'));
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading || loadingBranches) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const isBranchSelectDisabled = user?.role === 'PARTNER_STAFF' && !!user?.branchId;

  return (
    <div className="space-y-6">
      
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Đối tác/Nhân viên</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Xác thực quét mã</span>
      </div>

      <div className="pb-4 border-b border-border/60">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
          <QrCode className="h-6 w-6 text-primary" />
          Quét & Đổi mã Voucher
        </h1>
        <p className="text-xs text-muted mt-1">Hỗ trợ quét QR bằng camera hoặc nhập tay để tra cứu thông tin trước khi xác nhận đổi mã.</p>
      </div>

      {/* CHI NHÁNH ĐỨNG QUẦY (Đặt ngoài để cố định địa điểm trước khi quét) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <Store className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Chọn địa điểm quầy quét</h3>
        </div>
        <div className="max-w-md">
          <Select
            items={branches.map((branch) => ({ label: branch.name, value: branch.branchId }))}
            value={selectedBranchId || null}
            onValueChange={(value) => setSelectedBranchId(value ?? '')}
            disabled={isBranchSelectDisabled}
          >
            <SelectTrigger aria-label="Chi nhánh thực hiện đổi mã" className="w-full text-xs">
              <SelectValue placeholder="Chọn chi nhánh thực hiện đổi mã" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {branches.map((branch) => (
                <SelectItem key={branch.branchId} value={branch.branchId}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isBranchSelectDisabled && (
          <p className="text-[10px] text-muted">Vị trí được gán cố định theo chi nhánh trực thuộc của nhân viên.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CỘT TRÁI: KHU VỰC QUÉT / NHẬP MÃ & XÁC NHẬN (2 CỘT) */}
        <div className="lg:col-span-2 space-y-6">
          
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* KẾT QUẢ ĐỔI MÃ THÀNH CÔNG */}
          {redeemResult && (
            <div className="rounded-2xl border border-green-200 bg-green-500/5 p-5 space-y-3 animate-scale-up">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="h-5.5 w-5.5 text-green-600 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-green-800 uppercase tracking-wide">Đổi voucher thành công!</h3>
                  <p className="text-[10px] text-green-600">Đã ghi nhận sử dụng trên hệ thống vào lúc {new Date(redeemResult.usedAt).toLocaleTimeString('vi-VN')}.</p>
                </div>
              </div>
              <div className="border-t border-green-200/60 pt-3 grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <span className="text-muted">Mã quét:</span>
                  <span className="font-bold text-foreground block">#{redeemResult.usageId.substring(0, 8).toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-muted">Chi nhánh ghi nhận:</span>
                  <span className="font-bold text-foreground block">{redeemResult.branch.name}</span>
                </div>
              </div>
            </div>
          )}

          {/* TRƯỜNG HỢP 1: CÓ THÔNG TIN VOUCHER TRÌNH CHI TIẾT ĐỂ XÁC NHẬN */}
          {verifiedVoucher ? (
            <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm space-y-6 animate-scale-up">
              <div className="border-b border-border pb-3">
                <span className="inline-block text-[10px] font-bold text-primary bg-primary/5 rounded px-2.5 py-0.5 uppercase tracking-wide">
                  Chi tiết voucher tra cứu
                </span>
                <h3 className="font-extrabold text-foreground text-sm sm:text-base mt-1.5 leading-snug">
                  {verifiedVoucher.campaign.title}
                </h3>
              </div>

              {/* Chi tiết khách hàng & trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <span className="text-muted block">Khách hàng sở hữu:</span>
                  <span className="font-bold text-foreground block">{verifiedVoucher.customer.fullName || 'Ẩn danh'}</span>
                  <span className="text-[10px] text-muted block">{verifiedVoucher.customer.email}</span>
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-muted block">Trạng thái mã hiện tại:</span>
                  <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    verifiedVoucher.redemptionEligibility.redeemable
                      ? 'bg-green-100 text-green-700'
                      : verifiedVoucher.redemptionEligibility.reason === 'NOT_STARTED'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {verifiedVoucher.redemptionEligibility.redeemable
                      ? 'Có thể sử dụng'
                      : verifiedVoucher.redemptionEligibility.reason === 'NOT_STARTED'
                        ? 'Chưa đến thời gian'
                        : verifiedVoucher.status === 'USED'
                          ? 'Đã dùng'
                          : verifiedVoucher.status === 'EXPIRED'
                            ? 'Hết hạn'
                            : verifiedVoucher.status === 'LOCKED'
                              ? 'Đang khóa'
                              : 'Không khả dụng'}
                  </span>
                </div>
              </div>

              {/* Ràng buộc Chi nhánh & Thời gian sử dụng */}
              <div className="bg-secondary/40 border border-border rounded-xl p-4 text-xs space-y-2 text-muted">
                <div className="flex justify-between gap-4">
                  <span>Bắt đầu sử dụng:</span>
                  <span className="text-right font-bold text-foreground">{formatVietnamDateTime(verifiedVoucher.campaign.usageStartTime)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Kết thúc sử dụng:</span>
                  <span className="text-right font-bold text-foreground">{formatVietnamDateTime(verifiedVoucher.campaign.usageEndTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hình thức:</span>
                  <span className="font-bold text-foreground">
                    {verifiedVoucher.campaign.isMultiUse 
                      ? `Sử dụng nhiều lần (Tối đa ${verifiedVoucher.campaign.maxUsesPerCode || 1} lần)` 
                      : 'Sử dụng 1 lần duy nhất'}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-border/60">
                  <span className="font-bold text-foreground block mb-1">Chi nhánh hợp lệ:</span>
                  <span className="block text-[11px] leading-relaxed">{verifiedVoucher.campaign.branches.join(', ')}</span>
                </div>
              </div>

              {/* Cảnh báo nếu mã không khả dụng */}
              {!verifiedVoucher.redemptionEligibility.redeemable && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs p-4 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Chưa thể đổi voucher</span>
                    <p className="text-[10px] mt-0.5">{verifiedVoucher.redemptionEligibility.message || 'Voucher hiện chưa đủ điều kiện sử dụng.'}</p>
                  </div>
                </div>
              )}

              {/* Hành động Xác nhận / Hủy */}
              <div className="flex gap-3 justify-end border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setVerifiedVoucher(null);
                    setUniqueCode('');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-slate-50 text-foreground text-xs font-bold transition-colors"
                >
                  Quay lại quét
                </button>
                
                {verifiedVoucher.redemptionEligibility.redeemable && (
                  <button
                    type="button"
                    onClick={handleConfirmRedeem}
                    disabled={redeeming}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {redeeming ? 'Đang ghi nhận...' : 'Xác nhận Đổi Voucher'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: FORM NHẬP / QUÉT MÃ */
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
              
              {/* TABS SWITCH MODE */}
              <div className="flex border-b border-border">
                <button
                  type="button"
                  onClick={() => setScanMode('manual')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-all ${
                    scanMode === 'manual'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  <Keyboard className="h-4 w-4" />
                  Nhập mã thủ công
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('camera');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-all ${
                    scanMode === 'camera'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  Quét bằng Camera (Webcam)
                </button>
              </div>

              {scanMode === 'manual' ? (
                /* CHẾ ĐỘ NHẬP MÃ THỦ CÔNG */
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCodeLookup(uniqueCode);
                  }} 
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      Nhập mã Voucher (mã mới gồm 12 ký tự)
                    </label>
                    <input
                      type="text"
                      value={uniqueCode}
                      onChange={(e) => setUniqueCode(e.target.value)}
                      placeholder="Ví dụ: A1B2C3D4E5F6"
                      maxLength={LEGACY_VOUCHER_CODE_MAX_LENGTH}
                      className="block w-full rounded-lg border border-border bg-card py-2.5 px-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono tracking-widest uppercase transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold disabled:bg-slate-300 transition-all shadow shadow-primary/10"
                  >
                    {verifying ? 'Đang kiểm tra...' : 'Tìm kiếm & Xác thực'}
                  </button>
                </form>
              ) : (
                /* CHẾ ĐỘ QUÉT CAMERA */
                <div className="space-y-4">
                  <div className="relative rounded-2xl border-2 border-dashed border-border p-4 bg-slate-900/5 flex flex-col items-center justify-center space-y-4">
                    <div id="qr-reader" className="w-full max-w-sm overflow-hidden rounded-xl bg-card border border-border shadow-inner text-foreground" />
                    <p className="text-[10px] text-muted text-center">Căn chỉnh mã QR của khách hàng nằm chính giữa khung hình camera.</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setScanMode('manual')}
                    className="w-full text-center text-xs text-primary hover:underline font-bold"
                  >
                    Dùng nhập tay nếu camera không hoạt động
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

        {/* CỘT PHẢI: QUY CHUẨN XÁC THỰC (1 CỘT) */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Quy chuẩn quét mã
            </h3>
            
            <div className="space-y-3 text-xs text-muted leading-relaxed">
              <div className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>Yêu cầu khách hàng trình mã QR trên điện thoại hoặc phiếu mã. Quét hoặc nhập mã để tra cứu.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Kiểm tra kỹ thông tin sản phẩm và khách hàng khớp với thông tin hiển thị trước khi đổi.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>Nhấn nút &quot;Xác nhận đổi&quot; để lưu trữ kết quả sử dụng của voucher. Thao tác này không thể hoàn tác.</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
