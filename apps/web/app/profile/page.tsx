"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

const profileSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Họ và tên phải dài ít nhất 2 ký tự.")
      .optional()
      .or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    currentPassword: z.string().optional().or(z.literal("")),
    newPassword: z.string().optional().or(z.literal("")),
    confirmNewPassword: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword === data.confirmNewPassword;
      }
      return true;
    },
    {
      message: "Mật khẩu xác nhận không khớp.",
      path: ["confirmNewPassword"],
    },
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword.length >= 8;
      }
      return true;
    },
    {
      message: "Mật khẩu mới phải chứa ít nhất 8 ký tự.",
      path: ["newPassword"],
    },
  );

type ProfileFormInput = z.infer<typeof profileSchema>;
type UserRole = "CUSTOMER" | "PARTNER" | "PARTNER_STAFF" | "ADMIN";

interface ProfileUpdateBody {
  fullName?: string;
  phone?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

interface UpdatedUserProfile {
  fullName: string | null;
  phone: string | null;
}

export default function UserProfilePage() {
  const { user, logout, loading: authLoading, setUser } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password visibility
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirmNew, setShowConfirmNew] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  // Populate data when user profile is loaded
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login?redirect=/profile");
      } else {
        setValue("fullName", user.fullName || "");
        setValue("phone", user.phone || "");
      }
    }
  }, [user, authLoading, router, setValue]);

  const onSubmit = async (data: ProfileFormInput) => {
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const body: ProfileUpdateBody = {};

      // Only customer can edit name
      if (user?.role === "CUSTOMER" && data.fullName) {
        body.fullName = data.fullName;
      }

      // All roles can edit phone
      body.phone = data.phone || null;

      // Password changes
      if (data.newPassword && data.newPassword.length > 0) {
        body.currentPassword = data.currentPassword;
        body.newPassword = data.newPassword;
      }

      const updatedUser = await apiRequest<UpdatedUserProfile>(
        "/users/profile",
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );

      if (data.newPassword) {
        alert("Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.");
        await logout();
        return;
      }

      if (user) {
        setUser({ ...user, ...updatedUser });
      }

      setSuccessMsg("Cập nhật thông tin tài khoản thành công!");
      // Reset password fields
      setValue("currentPassword", "");
      setValue("newPassword", "");
      setValue("confirmNewPassword", "");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirmNew(false);
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Cập nhật thông tin thất bại."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await apiRequest<void>("/users/profile", { method: "DELETE" });
      alert(
        "Tài khoản của bạn đã được xóa thành công. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!",
      );
      await logout();
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "Xóa tài khoản thất bại."));
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user) return null;

  // Role labels
  const roleLabels: Record<UserRole, string> = {
    CUSTOMER: "Khách hàng",
    PARTNER: "Đối tác doanh nghiệp",
    PARTNER_STAFF: "Nhân viên quét mã đối tác",
    ADMIN: "Quản trị viên hệ thống",
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <Header />
      <main className="flex-grow w-full max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
          {/* AVATAR & TIÊU ĐỀ */}
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl shadow-sm ring-4 ring-primary/5">
              {user.fullName?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground">
                {user.fullName || "Người dùng hệ thống"}
              </h1>
              <span className="inline-block text-[10px] font-extrabold uppercase bg-secondary text-primary px-2 py-0.5 rounded mt-1.5 ring-1 ring-primary/10">
                {roleLabels[user.role] || user.role}
              </span>
            </div>
          </div>

          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-800 text-xs p-4 rounded-xl flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-800 text-xs p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* THÔNG TIN CƠ BẢN */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5 border-b border-border/40 pb-1.5">
                <User className="h-4 w-4 text-primary" />
                Thông tin tài khoản
              </h3>

              {/* Email (Read-only) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  Email đăng nhập
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.email || ""}
                    disabled
                    className="block w-full rounded-lg border border-border bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-muted focus:outline-none cursor-not-allowed"
                  />
                  <Mail className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-[10px] text-muted">
                  Email đăng nhập làm mã định danh duy nhất và không thể thay
                  đổi.
                </p>
              </div>

              {/* Họ và tên (Customer có thể sửa, Partner/Staff/Admin read-only) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  Họ và tên
                </label>
                <div className="relative">
                  <input
                    type="text"
                    {...register("fullName")}
                    disabled={user.role !== "CUSTOMER"}
                    className={`block w-full rounded-lg border border-border py-2.5 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all ${user.role !== "CUSTOMER"
                      ? "bg-slate-50 text-muted cursor-not-allowed"
                      : "bg-card"
                      }`}
                  />
                  <User className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errors.fullName && (
                  <p className="text-[10px] text-primary">
                    {errors.fullName.message}
                  </p>
                )}
                {user.role !== "CUSTOMER" && (
                  <p className="text-[10px] text-muted">
                    Họ tên đối tác/nhân viên được quản lý trực tiếp theo hồ sơ
                    hệ thống.
                  </p>
                )}
              </div>

              {/* Số điện thoại (Tất cả sửa được) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  Số điện thoại liên hệ
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ví dụ: 0987654321"
                    {...register("phone")}
                    className="block w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                  <Phone className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {errors.phone && (
                  <p className="text-[10px] text-primary">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            {/* BẢO MẬT & ĐỔI MẬT KHẨU */}
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5 border-b border-border/40 pb-1.5">
                <Lock className="h-4 w-4 text-primary" />
                Đổi mật khẩu bảo mật
              </h3>

              {/* Mật khẩu hiện tại */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Nhập mật khẩu đang sử dụng"
                    {...register("currentPassword")}
                    className="block w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-10 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                  <Lock className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-foreground"
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="Tối thiểu 8 ký tự"
                    {...register("newPassword")}
                    className="block w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-10 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                  <Lock className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-foreground"
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-[10px] text-primary">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              {/* Nhập lại mật khẩu mới */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showConfirmNew ? "text" : "password"}
                    placeholder="Xác nhận trùng khớp mật khẩu mới"
                    {...register("confirmNewPassword")}
                    className="block w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-10 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                  <Lock className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNew(!showConfirmNew)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-foreground"
                  >
                    {showConfirmNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmNewPassword && (
                  <p className="text-[10px] text-primary">
                    {errors.confirmNewPassword.message}
                  </p>
                )}
              </div>
            </div>

            {/* BUTTON SUBMIT */}
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white px-6 py-3 text-xs font-bold transition-colors disabled:bg-slate-300 shadow shadow-primary/10"
              >
                {submitting ? "Đang cập nhật..." : "Cập nhật hồ sơ"}
              </button>
            </div>
          </form>

          {/* KHU VỰC NGUY HIỂM: XÓA TÀI KHOẢN (Chỉ dành cho CUSTOMER) */}
          {user.role === "CUSTOMER" && (
            <div className="pt-6 border-t border-dashed border-red-200 space-y-4">
              <div className="rounded-xl border border-red-100 bg-red-500/5 p-4 space-y-3">
                <h4 className="text-xs font-bold text-red-800 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Khu vực xóa tài khoản
                </h4>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  Nếu bạn quyết định không sử dụng dịch vụ của chúng tôi nữa,
                  bạn có thể tự xóa tài khoản của mình. Mọi thông tin cá nhân và
                  tài sản mua sắm của bạn sẽ được xóa vĩnh viễn khỏi cơ sở dữ
                  liệu.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
                      />
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Yêu cầu xóa tài khoản của tôi
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Xóa vĩnh viễn tài khoản?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Toàn bộ giỏ hàng, đơn hàng và ví voucher của bạn sẽ bị
                        xóa vĩnh viễn. Thao tác này không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={submitting}>
                        Giữ lại tài khoản
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={submitting}
                        onClick={() => void handleDeleteAccount()}
                      >
                        {submitting ? "Đang xóa..." : "Xóa tài khoản"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
