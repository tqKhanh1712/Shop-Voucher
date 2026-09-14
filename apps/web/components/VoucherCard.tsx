import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Store,
  Flame,
  Plus,
  CheckCircle2,
  X,
  Clock,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { apiRequest } from "../lib/api";

export interface VoucherCampaignCard {
  campaignId: string;
  title: string;
  category: string | null;
  originalPrice: number;
  salePrice: number;
  capacity: number;
  soldQuantity: number;
  reservedStock: number;
  saleStartTime: string;
  saleEndTime: string;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  partner: { companyName: string };
  primaryBrand?: { displayName: string } | null;
  primaryCategory?: { nameVi: string } | null;
  campaignBranches: { branch: { name: string } }[];
}

export interface VoucherCardProps {
  campaign: VoucherCampaignCard;
  index?: number;
}

type CartToast =
  { kind: "success"; message: string } | { kind: "error"; message: string };

interface AddCartItemResponse {
  cartItemId: string;
}

const upcomingDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default function VoucherCard({
  campaign: c,
  index = 0,
}: VoucherCardProps) {
  const router = useRouter();
  const thumbnailUrl = c.thumbnailUrl ?? c.thumbnail_url;
  const brandName = c.primaryBrand?.displayName ?? c.partner.companyName;
  const categoryName = c.primaryCategory?.nameVi ?? c.category ?? "Khác";
  const discountPct = Math.round(
    ((Number(c.originalPrice) - Number(c.salePrice)) /
      Number(c.originalPrice)) *
      100,
  );
  const remaining = Math.max(c.capacity - c.soldQuantity - c.reservedStock, 0);
  const [renderedAt] = useState(() => Date.now());
  const saleStartTime = new Date(c.saleStartTime);
  const isUpcoming = saleStartTime.getTime() > renderedAt;
  const soldPercent = Math.min(
    Math.round((c.soldQuantity / c.capacity) * 100),
    100,
  );

  const gradients = [
    "from-orange-400 to-rose-400",
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-purple-400 to-indigo-500",
    "from-pink-400 to-rose-500",
  ];
  const bgGradient = gradients[index % gradients.length];
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [toast, setToast] = useState<CartToast | null>(null);
  const dismissToastTimer = useRef<number | null>(null);

  const showToast = (nextToast: CartToast, duration = 4500) => {
    if (dismissToastTimer.current) {
      window.clearTimeout(dismissToastTimer.current);
    }
    setToast(nextToast);
    dismissToastTimer.current = window.setTimeout(() => {
      setToast(null);
      dismissToastTimer.current = null;
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (dismissToastTimer.current) {
        window.clearTimeout(dismissToastTimer.current);
      }
    };
  }, []);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUpcoming || isAdding || isBuying) return;

    setIsAdding(true);
    try {
      await apiRequest<void>("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          campaignId: c.campaignId,
          quantity: 1,
        }),
      });
      window.dispatchEvent(new Event("cart-updated"));
      showToast({
        kind: "success",
        message: `Đã thêm “${c.title}” vào giỏ hàng.`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể thêm voucher.";
      const needsLogin = /unauthorized|đăng nhập/i.test(errorMessage);
      showToast(
        {
          kind: "error",
          message: needsLogin
            ? "Vui lòng đăng nhập để thêm voucher vào giỏ hàng."
            : errorMessage,
        },
        needsLogin ? 1200 : 4500,
      );
      if (needsLogin) {
        window.setTimeout(() => {
          const redirectPath = encodeURIComponent(
            `/?intent=add_to_cart&campaignId=${c.campaignId}`,
          );
          router.push(`/login?redirect=${redirectPath}`);
        }, 900);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUpcoming || isAdding || isBuying) return;

    setIsBuying(true);
    try {
      const data = await apiRequest<AddCartItemResponse>("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          campaignId: c.campaignId,
          quantity: 1,
        }),
      });
      window.dispatchEvent(new Event("cart-updated"));

      const cartItemId = data.cartItemId;
      router.push(`/checkout?items=${cartItemId}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể mua ngay.";
      const needsLogin = /unauthorized|đăng nhập/i.test(errorMessage);
      showToast(
        {
          kind: "error",
          message: needsLogin
            ? "Vui lòng đăng nhập để mua voucher."
            : errorMessage,
        },
        needsLogin ? 1200 : 4500,
      );
      if (needsLogin) {
        window.setTimeout(() => {
          const redirectPath = encodeURIComponent(
            `/?intent=buy_now&campaignId=${c.campaignId}`,
          );
          router.push(`/login?redirect=${redirectPath}`);
        }, 900);
      }
      setIsBuying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                role="status"
                className={`fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md sm:right-6 sm:top-6 ${
                  toast.kind === "success"
                    ? "border-emerald-200 bg-white/95 text-slate-800"
                    : "border-red-200 bg-white/95 text-slate-800"
                }`}
              >
                <CheckCircle2
                  className={`mt-0.5 h-6 w-6 shrink-0 ${
                    toast.kind === "success"
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">
                    {toast.kind === "success"
                      ? "Đã thêm vào giỏ hàng"
                      : "Chưa thể thêm voucher"}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {toast.message}
                  </p>
                  {toast.kind === "success" && (
                    <Link
                      href="/cart"
                      className="mt-3 inline-flex items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                    >
                      Xem giỏ hàng
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="-mr-1 -mt-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <Link
        href={`/voucher/${c.campaignId}`}
        className="flex flex-col h-full flex-grow cursor-pointer"
      >
        {/* Top Image / Gradient Area */}
        <div
          className={`relative h-40 w-full p-4 flex flex-col justify-between overflow-hidden ${!thumbnailUrl ? `bg-gradient-to-br ${bgGradient}` : "bg-slate-100"}`}
        >
          {thumbnailUrl ? (
            <>
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized
                className="object-cover blur-md opacity-40 scale-110"
              />
              <Image
                src={thumbnailUrl}
                alt={c.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized
                className="object-contain p-1 drop-shadow-md"
              />
            </>
          ) : (
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          )}

          <div className="relative flex justify-between items-start">
            <span className="inline-block text-[10px] font-black text-slate-800 bg-white/90 backdrop-blur-md rounded-full px-2.5 py-1 uppercase tracking-wider shadow-sm">
              {categoryName}
            </span>

            {discountPct > 0 && (
              <div className="bg-red-500 text-white font-black text-xs px-2 py-1 rounded-bl-xl rounded-tr-lg shadow-md absolute top-0 right-0">
                -{discountPct}%
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-3 sm:p-4 flex flex-col flex-grow">
          <h3
            className="text-sm font-bold text-slate-800 line-clamp-2 min-h-[40px] group-hover:text-primary transition-colors"
            title={c.title}
          >
            {c.title}
          </h3>

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Store className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span
              className="truncate max-w-[45%] font-semibold text-slate-600"
              title={brandName}
            >
              {brandName}
            </span>
            <span className="text-slate-300 mx-0.5">•</span>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span
              className="truncate"
              title={c.campaignBranches.map((cb) => cb.branch.name).join(", ")}
            >
              {c.campaignBranches.length > 0
                ? c.campaignBranches[0].branch.name
                : "Nhiều chi nhánh"}
              {c.campaignBranches.length > 1 &&
                ` +${c.campaignBranches.length - 1} nơi`}
            </span>
          </div>

          <div className="mt-3 sm:mt-4 flex items-end justify-between">
            <div>
              <div className="text-xs text-slate-400 line-through font-medium mb-0.5">
                {Number(c.originalPrice).toLocaleString("vi-VN")} đ
              </div>
              <div className="text-lg font-black text-primary leading-none">
                {Number(c.salePrice).toLocaleString("vi-VN")}
                <span className="text-sm font-bold align-top ml-0.5">đ</span>
              </div>
            </div>

            <div
              className="flex items-center gap-2 relative z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {isUpcoming ? (
                <div
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[11px] font-bold text-amber-800"
                  title={`Mở bán ngày ${upcomingDateFormatter.format(saleStartTime)}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Sắp mở bán
                </div>
              ) : (
                <>
                  <button
                    onClick={handleBuyNow}
                    disabled={isAdding || isBuying}
                    title="Mua ngay"
                    className="flex h-9 px-3 items-center justify-center rounded-lg bg-primary text-white text-[11px] font-bold shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
                  >
                    {isBuying ? (
                      <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1.5"></span>
                    ) : null}
                    Mua ngay
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={isAdding || isBuying}
                    title="Thêm vào giỏ hàng"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-wait disabled:opacity-70"
                  >
                    <Plus
                      className={`h-4 w-4 ${isAdding ? "animate-spin" : ""}`}
                    />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-400 to-primary h-full rounded-full"
                style={{ width: `${soldPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] font-medium">
              <span className="text-primary flex items-center gap-1">
                <Flame className="h-3 w-3" /> Đã bán {c.soldQuantity}
              </span>
              <span className="text-slate-500">Còn lại {remaining}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
