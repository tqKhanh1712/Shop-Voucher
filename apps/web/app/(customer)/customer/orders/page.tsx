'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { getErrorMessage } from '../../../../lib/errors';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../../components/Header';
import { 
  FileText, 
  CreditCard, 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  AlertCircle,
  Ticket,
  Search
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';
import toast from 'react-hot-toast';

interface OrderCampaign {
  title: string;
}

interface OrderItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
  campaign: OrderCampaign;
}

interface Order {
  orderId: string;
  orderCode: string;
  totalAmount: number;
  orderStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
  createdAt: string;
  orderItems: OrderItem[];
  isGift: boolean;
  recipientEmail?: string | null;
}

export default function CustomerOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [orderToRefund, setOrderToRefund] = useState<Order | null>(null);

  const [filterText, setFilterText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest<Order[]>('/orders');
      setOrders(data);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể tải lịch sử đơn hàng.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=/customer/orders');
      } else {
        queueMicrotask(() => {
          void fetchOrders();
        });
      }
    }
  }, [user, authLoading, router]);

  const handleRefundClick = async (orderId: string) => {
    setRefundingOrderId(orderId);
    setErrorMsg(null);

    try {
      await apiRequest<void>(`/orders/${orderId}/refund`, {
        method: 'POST',
      });
      toast.success('Yêu cầu hoàn tiền đã được xử lý thành công! Số tiền đã được hoàn lại tài khoản.');
      fetchOrders(); // Refresh order history
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Yêu cầu hoàn tiền thất bại. Vui lòng kiểm tra lại.'));
    } finally {
      setRefundingOrderId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchText = filterText === '' || 
      order.orderCode.toLowerCase().includes(filterText.toLowerCase()) ||
      order.orderItems.some(item => item.campaign.title.toLowerCase().includes(filterText.toLowerCase()));
    
    let matchDate = true;
    if (filterDateFrom !== '' || filterDateTo !== '') {
      const d = new Date(order.createdAt);
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
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">Lịch sử đơn hàng của tôi</h1>
            <p className="text-sm text-slate-500 mt-1">Theo dõi trạng thái giao dịch, thanh toán và hoàn tiền các voucher đã đặt mua.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* THANH TÌM KIẾM VÀ LỌC */}
        {orders.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm theo mã đơn hoặc tên voucher..." 
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

        {/* DANH SÁCH ĐƠN HÀNG */}
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <FileText className="h-10 w-10 text-muted mx-auto" />
            <h3 className="text-sm font-bold text-foreground">Không tìm thấy đơn hàng nào</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Bạn chưa thực hiện bất kỳ giao dịch mua hàng nào trên VoucherNow.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold transition-colors mt-2"
            >
              Xem danh sách Voucher khuyến mãi
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Search className="h-10 w-10 text-muted mx-auto" />
            <h3 className="text-sm font-bold text-foreground">Không tìm thấy kết quả phù hợp</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
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
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const formattedDate = new Date(order.createdAt).toLocaleDateString('vi-VN');
              const formattedTime = new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={order.orderId} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                  
                  {/* Row 1: Code, Status & Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-foreground block">
                        Đơn hàng: <span className="font-extrabold text-primary uppercase">#{order.orderCode}</span>
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-muted">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>Đặt ngày: {formattedDate} lúc {formattedTime}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Trạng thái đơn */}
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        order.orderStatus === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : order.orderStatus === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {order.orderStatus === 'CONFIRMED' ? 'Thành công' : order.orderStatus === 'PENDING' ? 'Chờ thanh toán' : 'Đã hủy'}
                      </span>

                      {/* Trạng thái thanh toán */}
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-green-100 text-green-700'
                          : order.paymentStatus === 'REFUNDED'
                          ? 'bg-slate-100 text-slate-700'
                          : order.paymentStatus === 'UNPAID'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.paymentStatus === 'PAID' ? 'Đã trả tiền' : order.paymentStatus === 'REFUNDED' ? 'Đã hoàn tiền' : order.paymentStatus === 'UNPAID' ? 'Chưa trả tiền' : 'Đang xử lý'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Items list */}
                  <div className="space-y-2">
                    {order.orderItems.map((item) => (
                      <div key={item.itemId} className="flex justify-between gap-4 text-xs">
                        <div className="flex-1">
                          <span className="font-semibold text-foreground">{item.campaign.title}</span>
                          <span className="text-[10px] text-muted block mt-0.5">Số lượng: {item.quantity} x {Number(item.unitPrice).toLocaleString('vi-VN')} đ</span>
                        </div>
                        <span className="font-bold text-foreground shrink-0">
                          {(Number(item.unitPrice) * item.quantity).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Row 3: Totals & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border/40 pt-4">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted">Tổng cộng:</span>
                      <span className="text-sm font-extrabold text-primary">{Number(order.totalAmount).toLocaleString('vi-VN')} đ</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Nút thanh toán lại nếu chưa trả tiền */}
                      {order.orderStatus === 'PENDING' && order.paymentStatus === 'UNPAID' && (
                        <Link
                          href={`/checkout?orderId=${order.orderId}`}
                          className="inline-flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Thanh toán ngay
                        </Link>
                      )}

                      {/* Nút xem ví voucher nếu đã xác nhận thành công */}
                      {order.orderStatus === 'CONFIRMED' && order.paymentStatus === 'PAID' && (
                        <>
                          {!order.isGift ? (
                            <Link
                              href="/customer/vouchers"
                              className="inline-flex items-center gap-1 border border-border hover:bg-slate-50 text-foreground px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                            >
                              <Ticket className="h-3.5 w-3.5 text-primary" />
                              Xem Voucher
                            </Link>
                          ) : (
                            <span className="text-[10px] text-primary font-bold bg-primary/5 border border-primary/10 px-2.5 py-2 rounded-xl">
                              🎁 Đã gửi tặng: {order.recipientEmail}
                            </span>
                          )}

                          <button
                            onClick={() => setOrderToRefund(order)}
                            disabled={refundingOrderId === order.orderId}
                            className="inline-flex items-center gap-1 border border-red-200 hover:bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${refundingOrderId === order.orderId ? 'animate-spin' : ''}`} />
                            Hoàn tiền
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
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
                <AlertDialogTitle>Yêu cầu hoàn tiền đơn #{orderToRefund.orderCode}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Đơn hàng sẽ bị hủy và toàn bộ mã voucher chưa sử dụng của đơn này sẽ bị
                  vô hiệu hóa. Thao tác này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Giữ nguyên đơn hàng</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleRefundClick(orderToRefund.orderId)}>
                  Hủy đơn và hoàn tiền
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>

      </div>
        </div>
      )}
    </div>
  );
}
