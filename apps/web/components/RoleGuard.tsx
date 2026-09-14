'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('CUSTOMER' | 'PARTNER' | 'PARTNER_STAFF' | 'ADMIN')[];
}

/**
 * Component Guard bảo vệ các trang thuộc phân hệ phân quyền (RBAC) phía Client.
 * Kiểm tra trạng thái đăng nhập và kiểm tra vai trò người dùng trước khi render trang con.
 */
export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // 1. Nếu chưa đăng nhập, chuyển về trang Login
      if (!user) {
        router.push('/login');
      } 
      // 2. Nếu vai trò không nằm trong danh sách được cho phép, chuyển về trang báo lỗi quyền truy cập
      else if (!allowedRoles.includes(user.role)) {
        router.push('/unauthorized');
      }
    }
  }, [user, loading, router, allowedRoles]);

  // Hiển thị trạng thái loading trong khi đang kiểm tra token
  if (loading || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="text-sm text-slate-400">Đang xác thực quyền truy cập...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
