'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  ShieldAlert, 
  Store,
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import Header from '../../../components/Header';
import toast from 'react-hot-toast';

interface Partner {
  companyName: string;
}

interface VoucherCampaign {
  campaignId: string;
  title: string;
  category: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  soldQuantity: number;
  partner: Partner;
}

interface CartItem {
  cartItemId: string;
  customerId: string;
  campaignId: string;
  quantity: number;
  campaign: VoucherCampaign;
}

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleItemSelection = (cartItemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(cartItemId)
        ? prev.filter(id => id !== cartItemId)
        : [...prev, cartItemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === cartItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(cartItems.map(item => item.cartItemId));
    }
  };

  // Gọi API lấy giỏ hàng
  const fetchCart = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest<CartItem[]>('/cart');
      setCartItems(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải giỏ hàng.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Chuyển hướng về đăng nhập nếu chưa đăng nhập
        router.push('/login?redirect=/cart');
      } else {
        queueMicrotask(() => {
          void fetchCart();
        });
      }
    }
  }, [user, authLoading, router]);

  // Cập nhật số lượng vật phẩm trong giỏ
  const handleUpdateQty = async (cartItemId: string, newQty: number, maxQty: number) => {
    if (newQty < 1 || newQty > maxQty) return;
    setErrorMsg(null);
    try {
      await apiRequest<void>(`/cart/items/${cartItemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: newQty }),
      });
      // Cập nhật state cục bộ để giao diện phản hồi nhanh
      setCartItems(prev =>
        prev.map(item =>
          item.cartItemId === cartItemId ? { ...item, quantity: newQty } : item
        )
      );
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể cập nhật số lượng.'));
    }
  };

  // Xóa vật phẩm khỏi giỏ
  const handleDeleteItem = async (cartItemId: string) => {
    setErrorMsg(null);
    try {
      await apiRequest<void>(`/cart/items/${cartItemId}`, {
        method: 'DELETE',
      });
      setCartItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
      setSelectedItemIds(prev => prev.filter(id => id !== cartItemId));
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể xóa sản phẩm khỏi giỏ hàng.'));
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      </>
    );
  }

  // Tính tổng tiền giỏ hàng (chỉ tính những sản phẩm được chọn)
  const selectedCartItems = cartItems.filter(item => selectedItemIds.includes(item.cartItemId));
  const totalAmount = selectedCartItems.reduce(
    (sum, item) => sum + Number(item.campaign.salePrice) * item.quantity,
    0
  );
  const totalSelectedQuantity = selectedCartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">
      <Header />
      <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          


          <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <ShoppingCart className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">Giỏ hàng của bạn</h1>
              <p className="text-sm text-slate-500 mt-1">Quản lý và thanh toán các voucher bạn đã chọn</p>
            </div>
          </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-sm p-4 rounded-xl flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {cartItems.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border shadow-sm">
            <ShoppingCart className="h-12 w-12 text-muted/40 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-foreground">Giỏ hàng trống</h3>
            <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">
              Bạn chưa thêm bất kỳ voucher khuyến mãi nào vào giỏ hàng. Hãy khám phá và mua sắm ngay!
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* DANH SÁCH SẢN PHẨM (2 CỘT) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-sm mb-4">
                <input
                  type="checkbox"
                  checked={cartItems.length > 0 && selectedItemIds.length === cartItems.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm font-bold text-foreground cursor-pointer select-none" onClick={toggleSelectAll}>
                  Chọn tất cả ({cartItems.length})
                </span>
              </div>

              {cartItems.map((item) => {
                const campaign = item.campaign;
                const remaining = campaign.capacity - campaign.soldQuantity;
                const maxBuyable = Math.min(remaining, 10);

                return (
                  <div
                    key={item.cartItemId}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.cartItemId)}
                      onChange={() => toggleItemSelection(item.cartItemId)}
                      className="w-5 h-5 mt-1 sm:mt-0 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="inline-block text-[9px] font-bold text-primary bg-primary/5 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        {campaign.category || 'Ẩm thực'}
                      </span>
                      <h3 className="text-sm font-bold text-foreground mt-1 line-clamp-1">
                        {campaign.title}
                      </h3>
                      <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                        <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{campaign.partner.companyName}</span>
                      </div>
                      <div className="mt-2 text-xs font-extrabold text-primary">
                        {Number(campaign.salePrice).toLocaleString('vi-VN')} đ
                        <span className="text-[10px] text-muted line-through font-medium ml-1.5">
                          {Number(campaign.originalPrice).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>

                    {/* Bộ tăng giảm số lượng & Nút Xóa */}
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={item.quantity <= 1}
                          onClick={() => handleUpdateQty(item.cartItemId, item.quantity - 1, maxBuyable)}
                          className="h-7 w-7 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-slate-50 disabled:opacity-50 text-xs"
                        >
                          -
                        </button>
                        <span className="h-7 w-9 border border-border rounded-lg flex items-center justify-center text-xs font-bold text-foreground bg-slate-50/50">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= maxBuyable}
                          onClick={() => handleUpdateQty(item.cartItemId, item.quantity + 1, maxBuyable)}
                          className="h-7 w-7 rounded-lg border border-border flex items-center justify-center font-bold text-foreground hover:bg-slate-50 disabled:opacity-50 text-xs"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(item.cartItemId)}
                        className="p-2 rounded-lg text-muted hover:text-primary hover:bg-red-500/10 transition-colors"
                        title="Xóa vật phẩm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Tiếp tục mua thêm voucher khác
              </Link>
            </div>

            {/* HÓA ĐƠN TẠM TÍNH (1 CỘT) */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Thông tin đơn hàng</h3>
                
                <div className="space-y-3 text-xs text-muted border-t border-border/60 pt-4">
                  <div className="flex items-center justify-between">
                    <span>Sản phẩm đã chọn:</span>
                    <span className="font-bold text-foreground">
                      {totalSelectedQuantity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed border-border/40 pt-3">
                    <span className="text-sm font-bold text-foreground">Tổng tiền thanh toán:</span>
                    <span className="text-base font-extrabold text-primary">
                      {totalAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 flex gap-2 text-[10px] text-muted">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Giá bán trên đã bao gồm VAT. Voucher không thể quy đổi thành tiền mặt sau khi mua.</span>
                </div>

                <button
                  onClick={() => {
                    if (selectedItemIds.length > 0) {
                      router.push(`/checkout?items=${selectedItemIds.join(',')}`);
                    }
                  }}
                  disabled={selectedItemIds.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white py-3 text-sm font-bold transition-colors shadow shadow-primary/10 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  Đặt mua hàng {selectedItemIds.length > 0 ? `(${selectedItemIds.length})` : ''}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>
        )}

        </div>
      </div>
    </div>
  );
}
