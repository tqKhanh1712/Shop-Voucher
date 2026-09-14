import { Complaint } from "../../lib/complaints";

export default function ComplaintThread({
  complaint,
  showInternal = false,
}: {
  complaint: Complaint;
  showInternal?: boolean;
}) {
  const messages = complaint.messages ?? [];
  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const internal = message.visibility === "ADMIN_ONLY";
        if (internal && !showInternal) return null;
        const role = message.senderRoleSnapshot || "SYSTEM";
        return (
          <div
            key={message.messageId}
            className={`rounded-xl border p-3 ${internal ? "border-amber-300 bg-amber-50" : role === "ADMIN" ? "border-primary/20 bg-primary/5" : role === "PARTNER" ? "border-purple-200 bg-purple-50" : "border-slate-200 bg-white"}`}
          >
            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-muted">
              <span>
                {internal ? "Ghi chú nội bộ" : message.sender?.fullName || role}
              </span>
              <span>{new Date(message.createdAt).toLocaleString("vi-VN")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6">
              {message.body}
            </p>
          </div>
        );
      })}
      {messages.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Chưa có trao đổi.</p>
      )}
    </div>
  );
}
