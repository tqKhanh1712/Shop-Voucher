'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';
import { Ticket, ArrowRight, AlertCircle, User, Briefcase, Mail, Phone, Lock, Building, FileText, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { getErrorMessage } from '../../../lib/errors';

const registerSchema = z.object({
  role: z.enum(['CUSTOMER', 'PARTNER']),
  email: z.string().email('Email không đúng định dạng.').or(z.literal('')),
  phone: z.string().min(10, 'Số điện thoại phải từ 10 ký tự trở lên.').or(z.literal('')),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 8 ký tự.'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận lại mật khẩu.'),
  fullName: z.string().min(1, 'Họ tên không được để trống.'),
  companyName: z.string().optional(),
  taxCode: z.string().optional(),
  representative: z.string().optional(),
}).refine((data) => {
  // Ràng buộc 1: Phải điền email hoặc số điện thoại (BR-CUS-01)
  return data.email !== '' || data.phone !== '';
}, {
  message: 'Bạn phải nhập ít nhất Email hoặc Số điện thoại để đăng ký.',
  path: ['email'],
}).refine((data) => {
  // Ràng buộc 2: Đối tác phải điền thông tin doanh nghiệp
  if (data.role === 'PARTNER') {
    return !!data.companyName && !!data.taxCode;
  }
  return true;
}, {
  message: 'Vui lòng cung cấp Tên công ty và Mã số thuế đối tác.',
  path: ['companyName'],
}).refine((data) => {
  // Ràng buộc 3: Mật khẩu xác nhận phải khớp
  return data.password === data.confirmPassword;
}, {
  message: 'Mật khẩu xác nhận không khớp.',
  path: ['confirmPassword'],
});

type RegisterSchemaType = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: authRegister, loading } = useAuth();
  const [role, setRole] = useState<'CUSTOMER' | 'PARTNER'>('CUSTOMER');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register: formRegister,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<RegisterSchemaType>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'CUSTOMER',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    },
  });

  const handleRoleChange = (selectedRole: 'CUSTOMER' | 'PARTNER') => {
    setRole(selectedRole);
    setValue('role', selectedRole);
    clearErrors();
  };

  const onSubmit = async (data: RegisterSchemaType) => {
    setErrorMsg(null);

    // Chuẩn bị payload gửi lên API
    const payload = {
      role: data.role,
      password: data.password,
      fullName: data.fullName,
      email: data.email || undefined,
      phone: data.phone || undefined,
      companyName: data.role === 'PARTNER' ? data.companyName : undefined,
      taxCode: data.role === 'PARTNER' ? data.taxCode : undefined,
      representative: data.role === 'PARTNER' ? (data.representative || data.fullName) : undefined,
    };

    try {
      await authRegister(payload);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-lg space-y-8 rounded-2xl bg-card p-8 border border-border shadow-xl">

        {/* LOGO & TIÊU ĐỀ */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow shadow-primary/20">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Đăng ký Tài khoản
          </h2>
          <p className="mt-2 text-sm text-muted">
            Trở thành Khách hàng hoặc Đối tác kinh doanh ngay hôm nay
          </p>
        </div>

        {/* BỘ LỰA CHỌN VAI TRÒ */}
        <div className="flex rounded-lg bg-slate-100 p-1 border border-border">
          <button
            type="button"
            onClick={() => handleRoleChange('CUSTOMER')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all duration-200 ${role === 'CUSTOMER'
                ? 'bg-primary text-white shadow'
                : 'text-muted hover:text-foreground'
              }`}
          >
            <User className="h-4 w-4" />
            Khách hàng
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('PARTNER')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all duration-200 ${role === 'PARTNER'
                ? 'bg-primary text-white shadow'
                : 'text-muted hover:text-foreground'
              }`}
          >
            <Briefcase className="h-4 w-4" />
            Đối tác doanh nghiệp
          </button>
        </div>

        {/* THÔNG BÁO LỖI NẾU CÓ */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* FORM ĐĂNG KÝ */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">

            {/* HỌ VÀ TÊN */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {role === 'CUSTOMER' ? 'Họ và tên' : 'Họ tên người đại diện'}
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type="text"
                  {...formRegister('fullName')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder={role === 'CUSTOMER' ? 'Nguyễn Văn A' : 'Trần Văn Đại Diện'}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1.5 text-xs text-primary font-medium">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type="email"
                  {...formRegister('email')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-primary font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* SỐ ĐIỆN THOẠI */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Số điện thoại
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type="text"
                  {...formRegister('phone')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="0901234567"
                />
              </div>
              {errors.phone && (
                <p className="mt-1.5 text-xs text-primary font-medium">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* MẬT KHẨU */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Mật khẩu
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...formRegister('password')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-10 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted/70 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-primary font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* XÁC NHẬN MẬT KHẨU */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Xác nhận Mật khẩu
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...formRegister('confirmPassword')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-10 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted/70 hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-primary font-medium">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* THÔNG TIN DOANH NGHIỆP DÀNH CHO ĐỐI TÁC */}
            {role === 'PARTNER' && (
              <div className="space-y-4 border-t border-border/80 pt-4 mt-2">
                <h3 className="text-sm font-semibold text-primary">Thông tin Doanh nghiệp</h3>

                {/* TÊN CÔNG TY */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Tên công ty / Cửa hàng
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Building className="h-5 w-5 text-muted/70" />
                    </div>
                    <input
                      type="text"
                      {...formRegister('companyName')}
                      className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                      placeholder="Công ty TNHH Dịch vụ ABC"
                    />
                  </div>
                  {errors.companyName && (
                    <p className="mt-1.5 text-xs text-primary font-medium">
                      {errors.companyName.message}
                    </p>
                  )}
                </div>

                {/* MÃ SỐ THUẾ */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Mã số thuế
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FileText className="h-5 w-5 text-muted/70" />
                    </div>
                    <input
                      type="text"
                      {...formRegister('taxCode')}
                      className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                      placeholder="0101234567"
                    />
                  </div>
                  {errors.taxCode && (
                    <p className="mt-1.5 text-xs text-primary font-medium">
                      {errors.taxCode.message}
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* NÚT SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition-all duration-200 shadow-sm"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            {!loading && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        {/* LINK QUAY LẠI TRANG ĐĂNG NHẬP VÀ TRANG CHỦ */}
        <div className="text-center text-sm text-muted pt-6 border-t border-border/60 flex flex-col items-center gap-4">
          <div>
            Đã có tài khoản?{' '}
            <Link
              href="/login"
              className="font-bold text-primary hover:text-primary-hover transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-primary font-medium transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trở về trang chủ
          </Link>
        </div>

      </div>
    </div>
  );
}
