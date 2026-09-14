import { BadgeCheck, MapPinned, QrCode, ShieldCheck } from 'lucide-react';

const trustItems = [
  {
    title: 'Chiến dịch đã duyệt',
    description: 'Chỉ mở bán voucher hợp lệ',
    icon: BadgeCheck,
  },
  {
    title: 'Mã QR riêng',
    description: 'Phát hành sau khi mua',
    icon: QrCode,
  },
  {
    title: 'Đúng chi nhánh',
    description: 'Kiểm tra nơi áp dụng',
    icon: MapPinned,
  },
  {
    title: 'Chống dùng lại',
    description: 'Xác thực trạng thái tức thời',
    icon: ShieldCheck,
  },
];

const responsiveBorders = [
  '',
  'border-t border-border sm:border-l sm:border-t-0',
  'border-t border-border lg:border-l lg:border-t-0',
  'border-t border-border sm:border-l lg:border-t-0',
];

export default function LandingTrustBar() {
  return (
    <section
      aria-label="Cam kết của VoucherNow"
      className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8"
    >
      <div className="grid grid-cols-1 overflow-hidden rounded-ui-lg border border-border bg-surface shadow-ui sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map(({ title, description, icon: Icon }, index) => (
          <div
            key={title}
            className={`flex items-center gap-3 px-5 py-4 ${responsiveBorders[index]}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-md bg-brand-subtle text-brand">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-extrabold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
