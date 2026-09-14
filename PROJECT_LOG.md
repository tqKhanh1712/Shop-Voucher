# NHẬT KÝ VÀ NGUYÊN TẮC PHÁT TRIỂN DỰ ÁN (DEVELOPMENT JOURNAL & GUIDELINES)

Tài liệu này đóng vai trò là "bộ não" lưu trữ các nguyên tắc cốt lõi, tư duy thiết kế, quy trình làm việc và lịch sử thay đổi của dự án **Hệ thống Voucher Điện tử (Online Discount Voucher System)**. 
Mục tiêu là đảm bảo dù dự án được phát triển ở bất kỳ đâu, bởi bất kỳ thành viên (hay AI Agent) nào, mọi thứ đều nhất quán, chuẩn xác và dễ bảo trì.

---

## 1. TÓM TẮT DỰ ÁN (PROJECT SUMMARY)
- **Tên dự án:** Hệ thống Voucher Điện tử (EC05-Voucher-System).
- **Mục tiêu:** Quản lý, phân phối, bán và redeem (sử dụng) các mã giảm giá/voucher từ nhiều thương hiệu khác nhau.
- **Tech Stack:** 
  - **Backend:** NestJS, Prisma ORM, PostgreSQL (Supabase).
  - **Frontend:** Next.js, React, TailwindCSS.

---

## 2. NGUYÊN TẮC LẬP TRÌNH CỐT LÕI (CODING PRINCIPLES)

1. **Simplicity First (Đơn giản hóa):**
   - Tránh over-engineering. Viết code tuần tự, tường minh.
   - Sử dụng `Guard Clauses` (return sớm) thay vì lồng cấu trúc `if/else` quá sâu.
   - Mỗi hàm/component chỉ thực hiện 1 nhiệm vụ duy nhất (Single Responsibility).

2. **Quy chuẩn Comment (Chú thích):**
   - Sử dụng **Tiếng Việt** rõ ràng.
   - Bắt buộc viết JSDoc cho các API, Service, và hàm tiện ích (`@param`, `@returns`, `@throws`).
   - Chỉ comment inline ở những đoạn logic đặc thù (transaction, khóa dòng, thuật toán ngẫu nhiên, cổng thanh toán).

3. **Nguyên tắc Backend (NestJS & Prisma):**
   - Luôn định nghĩa DTO và sử dụng `class-validator` cho dữ liệu đầu vào.
   - Quản lý lỗi tập trung bằng các Exception có sẵn của NestJS (`BadRequestException`, `NotFoundException`...).

4. **Nguyên tắc Frontend (Next.js):**
   - Ưu tiên Server Component (`page.tsx`) để fetch data. Chỉ dùng Client Component (`"use client"`) cho phần tương tác.
   - Quản lý state tối giản (hạn chế Redux nếu không cần thiết). Đồng bộ logic validation bằng `zod` và `react-hook-form`.

---

## 3. QUY TRÌNH THỰC HIỆN THAY ĐỔI VÀ TASK (WORKFLOW)

Mỗi khi nhận một task mới hoặc thực hiện thay đổi, hãy tuân thủ các bước sau:
- **Bước 1: Phân tích & Đánh giá rủi ro:** Đọc hiểu code cũ trước khi sửa. Xác định các module liên quan bị ảnh hưởng.
- **Bước 2: Viết code & Comment:** Tuân thủ chuẩn coding bên trên.
- **Bước 3: Validate & Test:** Đảm bảo code không phá vỡ logic cũ (đặc biệt là Database Migration).
- **Bước 4: Ghi log (BẮT BUỘC):** Ghi chú lại những gì vừa thực hiện vào phần **Nhật ký phát triển** bên dưới. Giải thích rõ *TẠI SAO* lại làm thế để các thành viên khác hiểu tư duy của bạn.

---

## 4. NHẬT KÝ PHÁT TRIỂN & CÁC TASK ĐÃ THỰC HIỆN (DEVELOPMENT LOG)

*Quy tắc ghi log: Bất cứ khi nào hoàn thành 1 task/fix bug, phải bổ sung vào đây theo định dạng: [Ngày] - [Người thực hiện/AI] - [Nội dung] - [Giải thích].*

### [2026-09-09] - AI Agent - Sửa lỗi Database Migrations (Duplicate Columns & Supabase RLS)
- **Nội dung:** 
  1. Fix lỗi migration `20260818212455` bằng cách bọc hàm `REVOKE rls_auto_enable` vào `DO $$ IF EXISTS`.
  2. Xóa lệnh tạo cột `processing_error` bị lặp lại trong file `20260826180000`.
  3. Tách Trigger FTS (`20260902231200`) ra thành 2 Trigger riêng cho INSERT và UPDATE để tránh lỗi dùng biến `OLD` không hợp lệ.
- **Giải thích:** Các file migration cũ bị xung đột logic khiến tiến trình Reset Database không thể hoàn tất. Đã dọn dẹp để đảm bảo DB trắng sạch.

### [2026-09-09] - AI Agent - Import Data Khởi tạo
- **Nội dung:** Thực thi lệnh `npm run catalog:import -- --input data/catalog/giftpop/catalog-35-2026-09 --apply` để đẩy 35 records đã được crawl và chuẩn hóa vào Supabase.
- **Giải thích:** Sau khi Database được reset thành công, đây là bước đưa dữ liệu thật vào hệ thống để bắt đầu phát triển các tính năng hiển thị sản phẩm trên web.

### [2026-09-09] - AI Agent - Cập nhật trạng thái Voucher để hiển thị trên Frontend
- **Nội dung:** Chạy script để cập nhật toàn bộ cột `status` của bảng `Voucher_Campaigns` (gồm 41 records: 35 crawl + 6 seed) từ `DRAFT` thành `APPROVED`.
- **Giải thích:** Các voucher mới import mặc định ở trạng thái DRAFT nên API không trả về cho Frontend. Việc đổi sang APPROVED giúp hiển thị đầy đủ danh sách 41 voucher trên giao diện người dùng.

### [2026-09-12] - AI Agent - Tích hợp Semantic Search (Vector Embeddings) với mô hình MiniLM
- **Nội dung:** 
  1. Thêm cột `embedding vector(384)` vào `Voucher_Campaigns` và tạo `HNSW Index`.
  2. Xây dựng `EmbeddingService` sử dụng mô hình local `@xenova/transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, quantized).
  3. Chạy script backfill tạo vector cho 136 chiến dịch Approved.
  4. Nâng cấp Hybrid Search kết hợp text score (LIKE) và semantic score (Cosine Distance).
- **Giải thích:** Giúp bộ máy tìm kiếm hiểu ngữ nghĩa thay vì chỉ match từ khoá thuần túy. Khắc phục được một số trường hợp viết sai chính tả, nhưng chất lượng tiếng Việt của mô hình dung lượng nhỏ chưa đạt kỳ vọng.
