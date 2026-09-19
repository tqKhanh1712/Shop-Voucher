'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

/**
 * Trang thông báo lỗi khi truy cập tài nguyên bị từ chối do không đủ quyền hạn (RBAC).
 */
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center">
      <div className="max-w-md space-y-6 rounded-2xl bg-slate-900 p-8 border border-slate-800 shadow-xl">
        
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <ShieldAlert className="h-10 w-10" />
        </div>
        
        <h1 className="text-2xl font-bold text-white">Từ chối truy cập</h1>
        
        <p className="text-sm text-slate-400">
          Tài khoản của bạn không có quyền hạn để truy cập vào liên kết này. Vui lòng đăng nhập bằng tài khoản phù hợp hoặc quay về trang chủ.
        </p>
        
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/login"
            className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Đăng nhập lại
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:from-indigo-600 hover:to-violet-600 transition-all duration-200"
          >
            Quay lại trang chủ
          </Link>
        </div>

      </div>
    </div>
  );
}
