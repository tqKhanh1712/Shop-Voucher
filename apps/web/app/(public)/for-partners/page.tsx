import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';

const partnerCapabilities = [
  {
    title: 'Quản lý chiến dịch',
    description: 'Tạo voucher, thiết lập thời gian bán, thời gian sử dụng và điều kiện áp dụng.',
    icon: Ticket,
  },
  {
    title: 'Vận hành nhiều chi nhánh',
    description: 'Khai báo địa điểm áp dụng và quản lý nhân viên theo từng chi nhánh.',
    icon: MapPinned,
  },
  {
    title: 'Xác thực mã tại quầy',
    description: 'Quét QR hoặc nhập mã để kiểm tra trạng thái trước khi xác nhận sử dụng.',
    icon: QrCode,
  },
  {
    title: 'Theo dõi hoạt động',
    description: 'Xem tổng quan chiến dịch, voucher đã bán và dữ liệu vận hành trên dashboard.',
    icon: BarChart3,
  },
];

const onboardingSteps = [
  {
    number: '01',
    title: 'Đăng ký doanh nghiệp',
    description: 'Cung cấp thông tin người đại diện, tên doanh nghiệp và mã số thuế.',
  },
  {
    number: '02',
    title: 'Chờ xác minh tài khoản',
    description: 'Admin kiểm tra hồ sơ trước khi cấp quyền sử dụng khu vực quản trị đối tác.',
  },
  {
    number: '03',
    title: 'Thiết lập chiến dịch',
    description: 'Tạo voucher, chọn chi nhánh áp dụng và gửi chiến dịch để Admin phê duyệt.',
  },
  {
    number: '04',
    title: 'Mở bán và xác thực',
    description: 'Theo dõi chiến dịch đã duyệt và xác nhận mã voucher khi khách sử dụng.',
  },
];

const faqs = [
  {
    question: 'Tài khoản đối tác có được sử dụng ngay sau khi đăng ký không?',
    answer: 'Tài khoản doanh nghiệp cần được Admin xem xét và phê duyệt trước khi truy cập đầy đủ khu vực quản trị đối tác.',
  },
  {
    question: 'Chiến dịch mới có tự động xuất hiện trên kho voucher không?',
    answer: 'Không. Mỗi chiến dịch cần được gửi duyệt và chỉ mở bán sau khi được Admin chấp thuận.',
  },
  {
    question: 'Nhân viên tại cửa hàng xác thực voucher bằng cách nào?',
    answer: 'Nhân viên có thể quét mã QR bằng camera hoặc nhập mã thủ công, kiểm tra thông tin rồi mới xác nhận sử dụng.',
  },
];

export default function PartnerLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="VoucherNow - về trang chủ">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-orange-200">
              <Ticket className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black tracking-tight text-slate-900">VoucherNow</span>
            <span className="hidden rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary sm:inline">
              Business
            </span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">Đã là đối tác?</span>
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 font-bold text-slate-700 transition hover:border-orange-200 hover:text-primary"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      <main className="overflow-hidden">
        <section className="relative px-4 pt-6 sm:px-6 lg:px-8" aria-labelledby="partner-hero-title">
          <div className="relative isolate mx-auto grid w-full max-w-7xl items-center gap-12 overflow-hidden rounded-[2rem] bg-[linear-gradient(122deg,#7c2d12_0%,#c2410c_45%,#f43f5e_100%)] px-6 py-14 text-white shadow-[0_28px_70px_-26px_rgba(124,45,18,.55)] sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-16 lg:py-16">
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden="true" />
            <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -right-16 top-0 h-64 w-64 rounded-full bg-rose-100/20 blur-3xl" aria-hidden="true" />
            <div className="absolute left-0 top-0 h-2 w-full bg-[linear-gradient(90deg,#fde68a_0%,#fff7ed_45%,#fda4af_100%)]" aria-hidden="true" />

            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" />
                Nền tảng dành cho đối tác
              </div>
              <h1 id="partner-hero-title" className="mt-6 max-w-2xl font-black leading-[1.03] tracking-[-0.045em] text-white">
                Biến ưu đãi thành
                <span className="block text-amber-200">một hệ vận hành sắc nét.</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-orange-50 sm:text-base">
                Tạo chiến dịch, kiểm soát điểm bán và xác thực mã QR tại quầy — mọi điểm chạm của doanh nghiệp trong một luồng rõ ràng.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/register" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-extrabold text-primary shadow-lg shadow-orange-950/20 transition duration-300 hover:-translate-y-1 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Đăng ký làm đối tác
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <a
                  href="#partner-flow"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Xem quy trình tham gia
                </a>
              </div>

              <p className="mt-5 flex items-center gap-2 text-xs text-orange-100/90">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                Tài khoản và chiến dịch cần được Admin phê duyệt trước khi vận hành.
              </p>

              <div className="mt-7 grid max-w-xl grid-cols-1 divide-y divide-white/20 rounded-2xl border border-white/15 bg-slate-950/15 px-2 py-2 backdrop-blur-sm min-[420px]:grid-cols-3 min-[420px]:divide-x min-[420px]:divide-y-0 min-[420px]:py-3">
                {[
                  ['01', 'một dashboard'],
                  ['QR', 'xác thực tại quầy'],
                  ['24/7', 'nắm trạng thái'],
                ].map(([value, label]) => (
                  <div key={value} className="flex items-center justify-between gap-4 px-3 py-2 first:pl-2 min-[420px]:block min-[420px]:py-0"><p className="font-black text-amber-200">{value}</p><p className="text-xs font-semibold leading-tight text-orange-100 min-[420px]:mt-0.5">{label}</p></div>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[22rem] lg:block" aria-hidden="true">
              <div className="absolute inset-0 rounded-full bg-amber-200/20 blur-3xl" />
              <div className="absolute inset-x-0 top-0 overflow-hidden rounded-[1.65rem] border border-white/70 bg-white/95 p-5 text-slate-900 shadow-2xl shadow-orange-950/20 hero-float">
                <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[2.5rem] bg-orange-100" />
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Quy trình hệ thống</p>
                    <p className="mt-1 font-black">Vòng đời một chiến dịch</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-primary">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    ['Tạo chiến dịch', 'Đối tác'],
                    ['Kiểm duyệt nội dung', 'Admin'],
                    ['Mở bán voucher', 'Hệ thống'],
                    ['Xác thực tại quầy', 'Nhân viên'],
                  ].map(([label, owner], index) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${index === 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm font-bold text-slate-700">{label}</span>
                      <span className="text-xs font-semibold text-slate-400">{owner}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-end gap-1.5 rounded-xl bg-slate-950 px-3 py-2.5">
                  {[35, 52, 39, 68, 57, 82, 71, 94].map((height, index) => <span key={index} className="w-full rounded-t bg-gradient-to-t from-orange-500 to-amber-300" style={{ height: `${height / 6}px` }} />)}
                </div>
              </div>

              <div className="absolute -bottom-1 -left-5 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-slate-900 shadow-xl hero-float-delayed">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary">Kiểm soát trạng thái</p>
                  <p className="text-sm font-bold">Từ bản nháp đến sử dụng</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pt-5 sm:px-6 lg:px-8" aria-label="Công cụ dành cho đối tác">
          <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {partnerCapabilities.map(({ title, description, icon: Icon }, index) => (
              <article
                key={title}
                className={`p-5 ${index > 0 ? 'border-t border-slate-100 sm:border-t-0 sm:border-l' : ''} ${index === 2 ? 'sm:border-l-0 sm:border-t lg:border-l lg:border-t-0' : ''}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-extrabold text-slate-800">{title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="partner-flow" className="scroll-mt-6 bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="partner-flow-title">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Quy trình có kiểm duyệt</p>
              <h2 id="partner-flow-title" className="mt-3 font-black tracking-tight text-slate-900">
                Từ đăng ký đến khi mở bán
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:text-base">
                Mỗi bước đều có trạng thái rõ ràng để đối tác biết hồ sơ và chiến dịch đang ở đâu trong quy trình.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {onboardingSteps.map(({ number, title, description }) => (
                <article key={number} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="absolute right-5 top-3 text-5xl font-black text-slate-100" aria-hidden="true">
                    {number}
                  </span>
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 font-black text-primary">
                    {number}
                  </span>
                  <h3 className="relative mt-5 text-lg font-extrabold text-slate-900">{title}</h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-slate-500">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface-subtle px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20" aria-labelledby="operations-title">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16">
            <div className="border border-border bg-surface p-5 shadow-ui sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand">Không gian vận hành</p>
                  <p className="mt-2 font-black text-foreground">Một nơi cho toàn bộ đội ngũ</p>
                </div>
                <Store className="h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
              </div>
              <div className="mt-5 grid gap-0 divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                {[
                  ['Chủ doanh nghiệp', 'Chiến dịch, chi nhánh, báo cáo', Building2],
                  ['Nhân viên cửa hàng', 'Quét và xác thực voucher', Users],
                ].map(([role, description, Icon], index) => {
                  const RoleIcon = Icon as typeof Building2;
                  return (
                    <article key={role as string} className="min-w-0 py-5 sm:px-5 sm:py-1 first:sm:pl-0 last:sm:pr-0">
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand">0{index + 1}</p>
                      <RoleIcon className="mt-3 h-6 w-6 text-brand" aria-hidden="true" />
                      <h3 className="mt-3 font-extrabold text-foreground">{role as string}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description as string}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="max-w-xl lg:pt-2">
              <div className="inline-flex items-center gap-2 rounded-ui-sm bg-brand-subtle px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-brand">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Phân quyền theo vai trò
              </div>
              <h2 id="operations-title" className="mt-5 font-black tracking-tight text-foreground">
                Chủ doanh nghiệp quản lý, nhân viên tập trung phục vụ tại quầy
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Quyền truy cập được tách theo vai trò để mỗi thành viên nhìn thấy đúng công việc cần thực hiện.
              </p>
              <ul className="mt-7 space-y-3 border-t border-border pt-5">
                {[
                  'Quản lý danh sách chi nhánh và tài khoản nhân viên.',
                  'Theo dõi chiến dịch theo trạng thái duyệt và mở bán.',
                  'Kiểm tra mã trước khi ghi nhận voucher đã sử dụng.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-semibold text-foreground">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="partner-faq-title">
          <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Câu hỏi thường gặp</p>
              <h2 id="partner-faq-title" className="mt-3 font-black tracking-tight text-slate-900">
                Trước khi trở thành đối tác
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Những điểm chính về xét duyệt tài khoản, chiến dịch và xác thực voucher.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <summary className="cursor-pointer list-none pr-6 font-extrabold text-slate-800 marker:content-none">
                    {question}
                  </summary>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-500">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="partner-cta-title">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 to-rose-500 px-6 py-12 text-center text-white shadow-xl shadow-orange-950/10 sm:px-10">
            <Building2 className="h-10 w-10 text-amber-200" aria-hidden="true" />
            <h2 id="partner-cta-title" className="mt-5 max-w-2xl font-black tracking-tight text-white">
              Sẵn sàng thiết lập kênh voucher cho doanh nghiệp?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-orange-50 sm:text-base">
              Tạo tài khoản và chọn vai trò “Đối tác doanh nghiệp” để gửi thông tin xét duyệt.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-extrabold text-primary shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-50"
            >
              Đăng ký tài khoản đối tác
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 text-center lg:flex-row lg:text-left">
          <Link href="/" className="flex items-center gap-2 font-black text-slate-800">
            <Ticket className="h-5 w-5 text-primary" aria-hidden="true" />
            VoucherNow Business
          </Link>
          <nav aria-label="Điều hướng cuối trang" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
            <Link href="/" className="transition hover:text-primary">Kho voucher</Link>
            <Link href="/for-customers" className="transition hover:text-primary">Dành cho khách hàng</Link>
          </nav>
          <p className="text-xs text-slate-500">Trang giới thiệu dành cho đối tác doanh nghiệp · Hệ thống phục vụ đồ án EC05</p>
        </div>
      </footer>
    </div>
  );
}
