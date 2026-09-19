import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "../../styles/tokens.css";
import "../globals.css";
import { AuthProvider } from "../../context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '../../i18n/routing';
import { notFound } from 'next/navigation';
import { ThemeProvider } from "../../components/ThemeProvider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Hệ thống Voucher Điện tử — Tiết kiệm và Mua sắm",
  description: "Trang thương mại điện tử mua sắm và đổi voucher quà tặng, buffet ẩm thực, làm đẹp và vui chơi hàng đầu.",
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${manrope.variable} h-full font-sans antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider delay={350}>
              <AuthProvider>
                {children}
                <Toaster position="bottom-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', background: '#333', color: '#fff' } }} />
              </AuthProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
