import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  MapPinned,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Ticket,
} from 'lucide-react';
import HeroBanner from '../../../components/HeroBanner';
import LandingTrustBar from '../../../components/LandingTrustBar';

const journeySteps = [
  {
    number: '01',
    title: 'Chọn voucher phù hợp',
    description: 'Tìm ưu đãi theo nhu cầu, xem điều kiện sử dụng và chi nhánh áp dụng trước khi mua.',
    icon: Search,
  },
  {
    number: '02',
    title: 'Hoàn tất đơn hàng',
    description: 'Xác nhận thông tin và trải nghiệm quy trình thanh toán mô phỏng của đồ án.',
    icon: CreditCard,
  },
  {
    number: '03',
    title: 'Nhận và dùng mã QR',
    description: 'Voucher được lưu trong ví; đưa mã QR cho nhân viên tại đúng chi nhánh để xác thực.',
    icon: QrCode,
  },
];

const customerBenefits = [
  {
    title: 'Mọi voucher trong một ví',
    description: 'Theo dõi voucher còn hiệu lực, đã sử dụng hoặc hết hạn trong cùng một nơi.',
    icon: Smartphone,
  },
  {
    title: 'Biết rõ nơi áp dụng',
    description: 'Thông tin điều kiện và chi nhánh được hiển thị trước khi bạn quyết định mua.',
    icon: MapPinned,
  },
  {
    title: 'Xác thực minh bạch',
    description: 'Mỗi mã QR có trạng thái riêng để hỗ trợ kiểm tra và ngăn việc sử dụng lại.',
    icon: ShieldCheck,
  },
];

const faqs = [
  {
    question: 'Tôi nhận voucher ở đâu sau khi mua?',
    answer: 'Voucher đã mua sẽ xuất hiện trong ví voucher của tài khoản cùng mã QR và thông tin sử dụng.',
  },
  {
    question: 'Tôi có thể dùng voucher ở mọi chi nhánh không?',
    answer: 'Không phải lúc nào cũng vậy. Bạn cần kiểm tra danh sách chi nhánh áp dụng trên trang chi tiết voucher.',
  },
  {
    question: 'Thanh toán trên hệ thống có phải giao dịch thật không?',
    answer: 'Hiện tại thanh toán chỉ là quy trình mô phỏng phục vụ đồ án, không thực hiện giao dịch tiền thật.',
  },
];

export default function CustomerLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="VoucherNow - về trang chủ">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-orange-200">
              <Ticket className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black tracking-tight text-slate-900">VoucherNow</span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">Đã có tài khoản?</span>
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 font-bold text-slate-700 transition hover:border-orange-200 hover:text-primary"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      <main>
        <HeroBanner />
        <LandingTrustBar />

        <section id="how-it-works" className="scroll-mt-6 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="journey-title">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Chỉ với 3 bước</p>
              <h2 id="journey-title" className="mt-3 font-black tracking-tight text-slate-900">
                Từ ưu đãi đến trải nghiệm
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:text-base">
                Một hành trình liền mạch từ lúc tìm voucher đến khi xác thực tại cửa hàng.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {journeySteps.map(({ number, title, description, icon: Icon }) => (
                <article key={number} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="absolute right-5 top-3 text-5xl font-black text-slate-100" aria-hidden="true">
                    {number}
                  </span>
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-primary">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="relative mt-5 text-lg font-extrabold text-slate-900">{title}</h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-slate-500">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface-subtle px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20" aria-labelledby="benefits-title">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-ui-sm bg-brand-subtle px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-brand">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Rõ ràng trước khi mua
              </div>
              <h2 id="benefits-title" className="mt-5 font-black tracking-tight text-foreground">
                Voucher dễ quản lý, dễ kiểm tra, dễ sử dụng
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                VoucherNow tập trung những thông tin quan trọng để bạn biết mình đang mua gì và sẽ sử dụng ở đâu.
              </p>
            </div>

            <div className="divide-y divide-border border-y border-border bg-surface">
              {customerBenefits.map(({ title, description, icon: Icon }, index) => (
                <article key={title} className="grid grid-cols-[auto_1fr] gap-4 py-5 first:pt-5 last:pb-5 sm:gap-5 sm:py-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-brand-subtle text-brand">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand">0{index + 1}</p>
                    <h3 className="mt-1 font-extrabold text-foreground">{title}</h3>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="faq-title">
          <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Câu hỏi thường gặp</p>
              <h2 id="faq-title" className="mt-3 font-black tracking-tight text-slate-900">
                Trước khi bắt đầu
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Những điểm cần biết về việc mua và sử dụng voucher trên hệ thống.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <summary className="cursor-pointer list-none pr-6 font-extrabold text-slate-800 marker:content-none">
                    {question}
                  </summary>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-500">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8" aria-labelledby="customer-cta-title">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 to-rose-500 px-6 py-12 text-center text-white shadow-xl shadow-orange-950/10 sm:px-10">
            <QrCode className="h-10 w-10 text-amber-200" aria-hidden="true" />
            <h2 id="customer-cta-title" className="mt-5 max-w-2xl font-black tracking-tight text-white">
              Sẵn sàng khám phá voucher theo cách đơn giản hơn?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-orange-50 sm:text-base">
              Tạo tài khoản khách hàng để bắt đầu tìm ưu đãi và quản lý voucher của bạn.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-extrabold text-primary shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-50"
            >
              Đăng ký tài khoản
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 text-center lg:flex-row lg:text-left">
          <Link href="/" className="flex items-center gap-2 font-black text-slate-800">
            <Ticket className="h-5 w-5 text-primary" aria-hidden="true" />
            VoucherNow
          </Link>
          <nav aria-label="Điều hướng cuối trang" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
            <Link href="/" className="transition hover:text-primary">Kho voucher</Link>
            <Link href="/for-partners" className="transition hover:text-emerald-700">Dành cho đối tác</Link>
          </nav>
          <p className="text-xs text-slate-500">Trang giới thiệu dành cho khách hàng · Thanh toán mô phỏng phục vụ đồ án</p>
        </div>
      </footer>
    </div>
  );
}
