import { ArrowRight, MapPin, QrCode, ShieldCheck, Sparkles, TicketCheck } from 'lucide-react';
import Link from 'next/link';

export default function HeroBanner() {
  return (
    <section className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="landing-hero-title">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(118deg,#7c2d12_0%,#c2410c_42%,#f43f5e_100%)] shadow-[0_28px_70px_-26px_rgba(124,45,18,0.55)]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden="true" />
        <div className="absolute -right-16 -top-20 h-80 w-80 rounded-full border border-white/20 bg-amber-200/20 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-[30%] h-64 w-64 rounded-full bg-rose-950/25 blur-3xl" aria-hidden="true" />
        <div className="absolute left-0 top-0 h-2 w-full bg-[linear-gradient(90deg,#fde68a_0%,#fff7ed_45%,#fda4af_100%)]" aria-hidden="true" />

        <div className="relative grid items-center gap-8 px-5 py-10 sm:gap-10 sm:px-10 sm:py-14 lg:grid-cols-[1.04fr_.96fr] lg:px-16 lg:py-16">
          <div className="max-w-2xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" />
              Marketplace voucher điện tử
            </div>

            <h1 id="landing-hero-title" className="max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.15] sm:leading-[1.05] tracking-[-0.045em] text-white">
              Săn ưu đãi có chọn lọc.
              <span className="block text-amber-200 mt-2 sm:mt-1">Tận hưởng đúng khoảnh khắc.</span>
            </h1>

            <p className="mt-5 sm:mt-6 max-w-xl text-sm sm:text-base leading-relaxed text-orange-50">
              Chạm vào những trải nghiệm đáng giá từ đối tác đã được kiểm duyệt. Mua nhanh, nhận QR riêng và dùng đúng tại chi nhánh.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="group w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-extrabold text-primary shadow-lg shadow-orange-950/20 transition duration-300 hover:-translate-y-1 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Bắt đầu săn ưu đãi
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm transition duration-300 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Xem cách hoạt động
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-orange-100">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-200" aria-hidden="true" />Đối tác đã kiểm duyệt</span>
              <span className="hidden h-4 w-px bg-white/25 sm:block" aria-hidden="true" />
              <span>Thanh toán mô phỏng cho đồ án</span>
            </div>
          </div>

          <div className="relative mx-auto hidden min-h-[23rem] w-full max-w-lg md:block" aria-hidden="true">
            <div className="absolute right-7 top-1 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />
            <div className="absolute right-0 top-5 h-[17.5rem] w-[78%] overflow-hidden rounded-[1.65rem] border border-white/45 bg-white p-5 text-slate-900 shadow-[0_25px_45px_-18px_rgba(69,10,10,.65)] hero-float">
              <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[2.5rem] bg-orange-100" />
              <div className="relative flex items-start justify-between gap-4">
                <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Ưu đãi nổi bật</p><p className="mt-1.5 text-xl font-black tracking-tight">Một ngày thật ngon</p></div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-primary"><TicketCheck className="h-6 w-6" /></span>
              </div>
              <div className="relative mt-6 rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-300">Giảm đến</p><p className="mt-1 text-4xl font-black tracking-[-0.06em]">38%</p></div><span className="mb-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-extrabold text-emerald-300">Còn hiệu lực</span></div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-300 to-orange-400" /></div>
              </div>
              <p className="relative mt-4 flex items-center gap-2 text-xs font-bold text-slate-500"><MapPin className="h-4 w-4 text-primary" />Chọn chi nhánh gần bạn</p>
            </div>

            <div className="absolute bottom-1 left-0 z-10 flex w-[55%] items-center gap-3 rounded-2xl border border-white/40 bg-slate-950/95 p-3.5 text-white shadow-2xl shadow-orange-950/35 backdrop-blur-md hero-float-delayed">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-slate-900"><QrCode className="relative z-10 h-7 w-7" /><span className="absolute left-0 top-0 h-1.5 w-full bg-primary/80 receipt-scan" /></span>
              <div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-orange-300">QR cá nhân</p><p className="mt-1 text-sm font-bold leading-tight">Lưu thẳng vào ví voucher</p></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
