"use client";

import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import RoleGuard from "../../../components/RoleGuard";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  MapPin,
  Ticket,
  CheckSquare,
  LogOut,
  Menu,
  LayoutDashboard,
  User,
  MessageSquareWarning,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../../components/ui/sheet";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Các chức năng hiển thị theo quyền của tài khoản đang đăng nhập.
  const allNavigation = [
    {
      name: "Dashboard",
      href: "/partner",
      icon: LayoutDashboard,
      roles: ["PARTNER"],
    },
    {
      name: "Hồ sơ đối tác",
      href: "/partner/profile",
      icon: Building2,
      roles: ["PARTNER"],
    },
    {
      name: "Chi nhánh cửa hàng",
      href: "/partner/branches",
      icon: MapPin,
      roles: ["PARTNER"],
    },
    {
      name: "Danh sách Voucher",
      href: "/partner/vouchers",
      icon: Ticket,
      roles: ["PARTNER"],
    },
    {
      name: "Khiếu nại khách hàng",
      href: "/partner/complaints",
      icon: MessageSquareWarning,
      roles: ["PARTNER"],
    },
    {
      name: "Quản lý Nhân viên",
      href: "/partner/staff",
      icon: User,
      roles: ["PARTNER"],
    },
    {
      name: "Quét/Xác thực mã",
      href: "/partner/redeem",
      icon: CheckSquare,
      roles: ["PARTNER", "PARTNER_STAFF"],
    },
  ];

  const navigation = allNavigation.filter((item) =>
    item.roles.includes(user?.role || ""),
  );

  return (
    <RoleGuard allowedRoles={["PARTNER", "PARTNER_STAFF"]}>
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        {/* Sidebar cho Desktop */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow shadow-primary/20">
                <Ticket className="h-5 w-5" />
              </div>
              <span className="ml-3 text-lg font-bold tracking-tight text-foreground">
                VoucherNow
              </span>
            </div>

            {/* Menu */}
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
                      isActive
                        ? "bg-secondary text-primary"
                        : "text-foreground/75 hover:bg-secondary/40 hover:text-primary"
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 shrink-0 ${
                        isActive
                          ? "text-primary"
                          : "text-muted group-hover:text-primary"
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Thông tin tài khoản phía dưới Sidebar */}
            <div className="flex-shrink-0 flex border-t border-border p-4 bg-background/50">
              <div className="flex items-center w-full">
                <Link
                  href="/profile"
                  className="flex items-center group overflow-hidden"
                  title="Xem hồ sơ cá nhân"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary/20 transition-colors">
                    {user?.fullName?.charAt(0).toUpperCase() || "P"}
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {user?.fullName}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      {user?.role === "PARTNER_STAFF" ? "Nhân viên" : "Đối tác"}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="ml-auto p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          {/* Mobile Header */}
          <header className="z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
            <div className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-ui-md bg-brand text-white">
                <Ticket className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="ml-2 text-md font-bold tracking-tight text-foreground">
                VoucherNow
              </span>
            </div>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Mở menu đối tác"
                  className="rounded-ui-sm p-2 text-foreground transition hover:bg-surface-subtle"
                />
              }
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </SheetTrigger>
          </header>

          {/* Mobile Menu Sidebar */}
          <SheetContent
            side="left"
            className="w-[min(18rem,86vw)] gap-0 p-0 md:hidden"
          >
            <SheetHeader className="border-b border-border p-5 pr-12">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-ui-md bg-brand text-white">
                  <Ticket className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <SheetTitle>VoucherNow</SheetTitle>
                  <SheetDescription>
                    {user?.role === "PARTNER_STAFF"
                      ? "Công cụ xác thực tại quầy"
                      : "Khu vực vận hành đối tác"}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <nav
              aria-label="Điều hướng đối tác"
              className="flex-1 space-y-1 overflow-y-auto p-4"
            >
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-11 items-center rounded-ui-md px-3 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-brand-subtle text-brand"
                        : "text-foreground/75 hover:bg-surface-subtle hover:text-foreground"
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 shrink-0 ${isActive ? "text-brand" : "text-muted-foreground"}`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <SheetFooter className="border-t border-border p-4">
              <div className="flex items-center">
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="group flex min-w-0 items-center"
                  title="Xem hồ sơ cá nhân"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle font-bold text-brand transition-colors group-hover:bg-orange-100">
                    {user?.fullName?.charAt(0).toUpperCase() || "P"}
                  </div>
                  <div className="ml-3 min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-brand">
                      {user?.fullName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {user?.role === "PARTNER_STAFF" ? "Nhân viên" : "Đối tác"}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  aria-label="Đăng xuất"
                  className="ml-auto rounded-ui-sm p-2 text-muted-foreground transition hover:bg-danger-subtle hover:text-danger"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Khung chứa Nội dung chính */}
        <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
          <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto flex-grow">
            {children}
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
