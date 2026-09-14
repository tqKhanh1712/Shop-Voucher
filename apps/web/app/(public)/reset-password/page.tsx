'use client';

import React, { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu mới phải chứa ít nhất 8 ký tự.'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận lại mật khẩu.'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp.',
  path: ['confirmPassword'],
});

type ResetPasswordSchemaType = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const token = searchParams.get('token') ?? '';
  const displayedError = errorMsg || (!token ? 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' : null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordSchemaType>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordSchemaType) => {
    if (!token) {
      setErrorMsg('Token đặt lại mật khẩu không hợp lệ.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      await apiRequest<void>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword: data.newPassword,
        }),
      });
      setSuccess(true);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể cập nhật mật khẩu.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-card p-8 border border-border shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow shadow-primary/20">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Đặt lại mật khẩu
          </h2>
          <p className="mt-2 text-sm text-muted">
            Tạo mật khẩu mới cho tài khoản của bạn.
          </p>
        </div>

        {displayedError && (
          <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium">{displayedError}</p>
          </div>
        )}

        {success ? (
          <div className="space-y-5 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-semibold">Mật khẩu đã được cập nhật thành công.</p>
            </div>
            <p>Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</p>
            <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-hover">
              <ArrowLeft className="h-4 w-4" />
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Mật khẩu mới
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-muted/70" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('newPassword')}
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
                {errors.newPassword && (
                  <p className="mt-1.5 text-xs text-primary font-medium">{errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Xác nhận mật khẩu
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-muted/70" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword')}
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
                  <p className="mt-1.5 text-xs text-primary font-medium">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="group relative flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition-all duration-200 shadow-sm"
            >
              {isLoading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>

            <div className="text-center text-sm text-muted">
              <Link href="/login" className="font-bold text-primary hover:text-primary-hover transition-colors">
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
