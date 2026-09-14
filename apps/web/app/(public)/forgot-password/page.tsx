'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không đúng định dạng.'),
});

type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordSchemaType>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordSchemaType) => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await apiRequest<void>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: data.email }),
      });
      setSubmitted(true);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, 'Không thể gửi yêu cầu đặt lại mật khẩu.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-card p-8 border border-border shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow shadow-primary/20">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Quên mật khẩu
          </h2>
          <p className="mt-2 text-sm text-muted">
            Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 border border-red-500/20 text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {submitted ? (
          <div className="space-y-5 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-semibold">Yêu cầu đặt lại mật khẩu đã được gửi.</p>
            </div>
            <p>
              Liên kết đặt lại mật khẩu đã được gửi thành công. Vui lòng kiểm tra hộp thư đến (và thư mục Spam) của bạn.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-hover"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Email
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-muted/70" />
                </div>
                <input
                  type="email"
                  {...register('email')}
                  className="block w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-foreground placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-primary font-medium">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition-all duration-200 shadow-sm"
            >
              {isLoading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
            </button>

            <div className="text-center text-sm text-muted">
              <Link href="/login" className="font-bold text-primary hover:text-primary-hover transition-colors">
                Về trang đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
