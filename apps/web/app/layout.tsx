import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Hệ thống Voucher Điện tử — Tiết kiệm và Mua sắm",
  description: "Trang thương mại điện tử mua sắm và đổi voucher quà tặng, buffet ẩm thực, làm đẹp và vui chơi hàng đầu.",
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${manrope.variable} h-full font-sans antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider delay={350}>
          <AuthProvider>
            {children}
            <Toaster position="bottom-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', background: '#333', color: '#fff' } }} />
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
