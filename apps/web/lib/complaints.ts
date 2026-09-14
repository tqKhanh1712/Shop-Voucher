export type ComplaintStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "WAITING_PARTNER"
  | "WAITING_CUSTOMER"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED";
export type ComplaintPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ComplaintVisibility = "ALL_PARTIES" | "ADMIN_ONLY";

export interface ComplaintMessage {
  messageId: string;
  senderRoleSnapshot: string | null;
  visibility: ComplaintVisibility;
  body: string;
  createdAt: string;
  sender?: { fullName: string | null } | null;
}

export interface ComplaintEvent {
  eventId: string;
  eventType: string;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus | null;
  actorRoleSnapshot: string | null;
  createdAt: string;
}

export interface Complaint {
  complaintId: string;
  type: string;
  priority: ComplaintPriority;
  subject: string;
  description: string;
  status: ComplaintStatus;
  version: number;
  resolutionResponse: string | null;
  partnerDueAt: string | null;
  customerDueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    fullName: string | null;
    email?: string | null;
    phone?: string | null;
  };
  partner?: { companyName: string } | null;
  campaign?: { title: string } | null;
  order?: { orderCode: string; totalAmount?: number } | null;
  assignedAdmin?: { fullName: string | null; email?: string | null } | null;
  messages?: ComplaintMessage[];
  events?: ComplaintEvent[];
  _count?: { messages: number };
}

export interface PagedComplaints {
  items: Complaint[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const complaintStatus: Record<
  ComplaintStatus,
  { label: string; className: string }
> = {
  OPEN: { label: "Mới gửi", className: "bg-amber-100 text-amber-700" },
  IN_REVIEW: { label: "Đang xử lý", className: "bg-blue-100 text-blue-700" },
  WAITING_PARTNER: {
    label: "Chờ đối tác",
    className: "bg-purple-100 text-purple-700",
  },
  WAITING_CUSTOMER: {
    label: "Chờ khách hàng",
    className: "bg-cyan-100 text-cyan-700",
  },
  RESOLVED: {
    label: "Đã giải quyết",
    className: "bg-emerald-100 text-emerald-700",
  },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-700" },
  CLOSED: { label: "Đã đóng", className: "bg-slate-100 text-slate-600" },
};

export const complaintPriority: Record<ComplaintPriority, string> = {
  LOW: "Thấp",
  NORMAL: "Thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export const complaintTypes: Record<string, string> = {
  VOUCHER: "Voucher",
  ORDER: "Đơn hàng",
  PAYMENT: "Thanh toán",
  PARTNER: "Đối tác/Chi nhánh",
  OTHER: "Khác",
};
