# Hướng dẫn kiểm thử tự động — Voucher System

## 1. Mục tiêu

Tài liệu này hướng dẫn nhóm tự động hóa các luồng quan trọng của hệ thống Voucher System để phát hiện lỗi sớm, đặc biệt ở phần tồn kho, thanh toán, phát hành mã voucher, đổi mã và phân quyền.

Không cần tự động hóa toàn bộ giao diện ngay từ đầu. Thứ tự ưu tiên là:

1. Unit test cho nghiệp vụ có nhiều điều kiện.
2. Integration/API test cho các luồng giữa controller, service và cơ sở dữ liệu.
3. End-to-end (E2E) test cho các hành trình người dùng quan trọng.

## 2. Hiện trạng kỹ thuật của dự án

| Khu vực | Công nghệ kiểm thử sẵn có | Lệnh chính |
| --- | --- | --- |
| API (`apps/api`) | Jest, `@nestjs/testing`, Supertest | `npm test`, `npm run test:e2e`, `npm run test:cov` |
| Web (`apps/web`) | Vitest | `npm test` |

Các unit test backend hiện đặt cạnh mã nguồn với đuôi `*.spec.ts`. Ví dụ: `apps/api/src/orders/orders.service.spec.ts`. E2E backend dùng thư mục `apps/api/test`.

## 3. Chuẩn bị môi trường test

### 3.1. Tài khoản và dữ liệu mẫu

Chuẩn bị các tài khoản riêng cho môi trường test:

| Ký hiệu | Vai trò | Dùng để kiểm tra |
| --- | --- | --- |
| `customerA` | CUSTOMER | Giỏ hàng, checkout, ví voucher, hoàn tiền, đánh giá |
| `partnerA` | PARTNER | Chiến dịch, chi nhánh, nhân viên |
| `staffA` | PARTNER_STAFF | Xác thực và đổi mã tại chi nhánh |
| `adminA` | ADMIN | Phê duyệt, khóa tài khoản, quản trị dữ liệu |

Mỗi lần chạy test cần có dữ liệu độc lập hoặc được dọn sạch sau khi chạy. Không chạy test ghi dữ liệu vào cơ sở dữ liệu production.

Chuẩn bị tối thiểu các voucher:

- Voucher còn hàng, đã duyệt, còn thời gian bán và sử dụng.
- Voucher hết hàng.
- Voucher hết hạn sử dụng.
- Voucher chỉ áp dụng tại một chi nhánh xác định.
- Voucher có cho phép và không cho phép hoàn tiền.

### 3.2. Nguyên tắc dữ liệu test

- Test không phụ thuộc vào thứ tự chạy của test khác.
- Mỗi test tự tạo dữ liệu cần thiết và tự xóa/dọn sau khi kết thúc.
- Dùng giá trị dễ truy vết, ví dụ email có tiền tố `autotest+` và mã voucher có tiền tố `AUTO-`.
- Với thời gian hết hạn, nên truyền thời gian cố định hoặc mô phỏng thời gian; tránh phụ thuộc đồng hồ thật khi có thể.

## 4. Chiến lược theo ba tầng

```text
E2E:       Ít test, kiểm tra hành trình người dùng hoàn chỉnh
API:       Nhiều test, kiểm tra endpoint + phân quyền + trạng thái HTTP
Unit:      Nhiều nhất, kiểm tra từng quy tắc nghiệp vụ và trường hợp biên
```

### 4.1. Unit test

Dùng unit test khi cần kiểm tra điều kiện nghiệp vụ mà không cần trình duyệt hay cổng thanh toán thật. Mock Prisma, email service và payment adapter.

Ưu tiên unit test các service sau:

| Khu vực | Tình huống cần tự động hóa |
| --- | --- |
| `orders` | Tạo đơn, giữ chỗ kho, hết hạn giữ chỗ, chống oversell |
| `payments` | Không finalization hai lần, đối soát tiền tệ/số tiền, webhook lặp lại |
| `vouchers` | Điều kiện phát hành mã, trạng thái mã, quy tắc redeem |
| `auth` | Đăng nhập, refresh/logout, reset mật khẩu, tài khoản khóa |
| `partners` | Quyền sở hữu chi nhánh/nhân viên, trạng thái phê duyệt |

Mỗi test nên theo cấu trúc Arrange – Act – Assert:

1. Arrange: chuẩn bị mock và dữ liệu đầu vào.
2. Act: gọi method đang kiểm tra.
3. Assert: kiểm tra giá trị trả về, exception và các thao tác ghi dữ liệu quan trọng.

### 4.2. API / Integration test

Dùng Supertest để gọi HTTP tới ứng dụng NestJS test. Nhóm test này cần xác minh đồng thời: status code, body trả về, guard phân quyền và thay đổi trạng thái dữ liệu.

Các ca ưu tiên:

| ID | API/luồng | Kết quả bắt buộc |
| --- | --- | --- |
| API-AUTH-01 | Đăng ký, đăng nhập, refresh, logout | Token/phiên hợp lệ; logout làm phiên cũ không dùng được |
| API-AUTH-02 | Login tài khoản bị khóa | Bị từ chối, không cấp token |
| API-CART-01 | Thêm/sửa/xóa giỏ hàng | Tổng tiền và số lượng đúng; chặn số lượng âm hoặc vượt tồn |
| API-ORDER-01 | Tạo đơn từ giỏ hợp lệ | Đơn `PENDING`, thanh toán `UNPAID`, tồn kho được giữ chỗ |
| API-PAY-01 | Gọi callback/mock-success hai lần | Chỉ có một lần thanh toán thành công và một bộ voucher code |
| API-PAY-02 | Callback sai chữ ký, sai số tiền hoặc sai tiền tệ | Bị từ chối; không xác nhận thanh toán |
| API-REDEEM-01 | Redeem mã hợp lệ tại chi nhánh áp dụng | Mã chuyển trạng thái đã dùng, lưu lịch sử redeem |
| API-REDEEM-02 | Redeem mã đã dùng/hết hạn/sai chi nhánh | Bị từ chối, trạng thái mã không bị đổi sai |
| API-ROLE-01 | CUSTOMER gọi endpoint admin/partner | `401` hoặc `403`; không trả dữ liệu nhạy cảm |
| API-ROLE-02 | PARTNER thao tác dữ liệu của partner khác | Bị từ chối |
| API-REFUND-01 | Yêu cầu hoàn trong/ngoài thời hạn | Chỉ yêu cầu hợp lệ đi tiếp theo chính sách snapshot của đơn |

### 4.3. E2E giao diện

Vitest đang phù hợp để test logic/component frontend. Để chạy E2E trình duyệt hoàn chỉnh, nhóm có thể bổ sung Playwright. Chỉ bổ sung khi thành viên phụ trách code đồng ý; không cần dùng nếu mục tiêu hiện tại là báo cáo môn học.

Năm hành trình E2E đáng tự động hóa đầu tiên:

1. Customer đăng ký/đăng nhập → tìm voucher → thêm giỏ → checkout → thanh toán mô phỏng → xem mã trong ví.
2. Partner đăng nhập → tạo chiến dịch → gửi duyệt.
3. Admin đăng nhập → duyệt partner hoặc chiến dịch → kiểm tra voucher xuất hiện công khai.
4. Staff đăng nhập → quét/nhập mã hợp lệ → redeem thành công → thử redeem lại bị chặn.
5. Customer bị khóa → không tiếp tục đăng nhập hoặc gọi được chức năng cần xác thực.

## 5. Ma trận kiểm thử tự động đề xuất

| Nhóm | Tên test gợi ý | Loại | Độ ưu tiên |
| --- | --- | --- | --- |
| Auth | đăng nhập hợp lệ | API | P0 |
| Auth | đăng nhập sai hoặc tài khoản khóa | Unit + API | P0 |
| Cart | chặn quantity bằng 0, âm, vượt tồn | Unit + API | P0 |
| Order | giữ chỗ đúng số lượng khi checkout | Unit + API | P0 |
| Order | hai khách mua phần tồn cuối cùng | Integration | P0 |
| Payment | cùng webhook/callback gửi hai lần | Unit + API | P0 |
| Payment | callback sai chữ ký/số tiền/tiền tệ | Unit + API | P0 |
| Voucher | phát hành đủ số mã sau thanh toán | Unit + API | P0 |
| Redeem | đổi mã một lần duy nhất | Unit + API | P0 |
| Redeem | không đổi ở chi nhánh không áp dụng | API | P0 |
| Permission | customer không truy cập admin | API | P0 |
| Permission | partner không sửa dữ liệu partner khác | API | P0 |
| Refund | kiểm tra chính sách hoàn tiền snapshot | Unit + API | P1 |
| Review | chỉ người mua mới được đánh giá | API | P1 |
| Catalog | tìm kiếm/lọc đúng danh mục, tỉnh | API + UI | P1 |
| UI | hiển thị lỗi mạng/loading và chống submit hai lần | Component/E2E | P2 |

P0 là lỗi có thể sai tiền, sai tồn kho, lộ quyền hoặc làm mất khả năng dùng voucher; phải chạy ở mọi lần release.

## 6. Quy trình chạy và ghi nhận kết quả

### 6.1. Chạy backend

Từ thư mục `apps/api`:

```powershell
npm test
npm run test:e2e
npm run test:cov
```

Khi chạy lần đầu, ghi lại commit hash, biến môi trường test, phiên bản Node.js và database test đang sử dụng. Nếu test thất bại, không chạy lại nhiều lần rồi chỉ lấy lần thành công; cần lưu kết quả lần thất bại đầu tiên để điều tra.

### 6.2. Chạy frontend

Từ thư mục `apps/web`:

```powershell
npm test
```

### 6.3. Tiêu chí Pass / Fail / Blocked

| Trạng thái | Khi nào dùng |
| --- | --- |
| PASS | Kết quả thực tế khớp hoàn toàn expected result |
| FAIL | Có khác biệt chức năng, dữ liệu, quyền hoặc UI quan trọng |
| BLOCKED | Không thể chạy do môi trường, dữ liệu hay dịch vụ phụ thuộc; phải mô tả nguyên nhân |
| NOT RUN | Chưa được chạy, không dùng thay cho BLOCKED |

## 7. Mẫu bug report

```markdown
### BUG-001 — Redeem cùng mã hai lần vẫn thành công

- Mức độ: Critical
- Môi trường: Test / Chrome 139 / API commit `abc123`
- Tài khoản: `staffA`
- Tiền điều kiện: Customer có voucher code `AUTO-XXXX` còn hiệu lực.
- Bước tái hiện:
  1. Nhân viên redeem mã `AUTO-XXXX`.
  2. Gửi lại cùng thao tác redeem ngay lập tức.
- Kết quả mong đợi: Lần đầu thành công, lần hai bị từ chối vì mã đã dùng.
- Kết quả thực tế: Cả hai lần đều thành công.
- Bằng chứng: Ảnh màn hình, response API, log test.
```

## 8. Cách đưa phần test vào báo cáo đồ án

Đặt phần kiểm thử thành một chương riêng, ví dụ **Chương 6 — Kiểm thử và đánh giá hệ thống**. Nội dung nên ngắn gọn, có số liệu và bằng chứng, không chỉ chụp màn hình giao diện.

### 8.1. Bố cục đề xuất

1. **Mục tiêu kiểm thử:** xác minh chức năng, dữ liệu, phân quyền và các giao dịch nhạy cảm.
2. **Môi trường kiểm thử:** OS, browser, Node.js, database test, công cụ Jest/Vitest/Supertest.
3. **Phạm vi:** các module Auth, Voucher, Cart, Order, Payment, Redeem, Partner và Admin.
4. **Phương pháp:** unit test, API/integration test, manual test/E2E.
5. **Bảng test case và kết quả:** ưu tiên P0/P1.
6. **Lỗi tìm được và cách xử lý:** nêu lỗi đại diện, trạng thái sửa lỗi hoặc giới hạn còn lại.
7. **Đánh giá:** tỷ lệ pass, coverage (nếu có) và các rủi ro chưa test.

### 8.2. Mẫu bảng kết quả để dán vào báo cáo

| Nhóm chức năng | Số test | Pass | Fail | Blocked | Kết luận |
| --- | ---: | ---: | ---: | ---: | --- |
| Xác thực và phân quyền | … | … | … | … | … |
| Danh mục và giỏ hàng | … | … | … | … | … |
| Đơn hàng và thanh toán | … | … | … | … | … |
| Ví voucher và redeem | … | … | … | … | … |
| Đối tác và quản trị | … | … | … | … | … |
| **Tổng** | **…** | **…** | **…** | **…** | **…** |

### 8.3. Đoạn văn mẫu cho báo cáo

> Nhóm thực hiện kiểm thử ở ba mức gồm unit test, kiểm thử API tích hợp và kiểm thử hành trình người dùng. Các luồng ưu tiên cao được tập trung gồm giữ chỗ tồn kho, thanh toán không xử lý lặp, phát hành mã voucher và đổi mã tại chi nhánh. Kết quả kiểm thử được ghi nhận theo tiêu chí Pass, Fail và Blocked; các lỗi ảnh hưởng đến dữ liệu giao dịch hoặc phân quyền được phân loại ưu tiên P0 để xử lý trước khi nghiệm thu.

Thay các dấu `…` bằng số liệu thực tế từ lần chạy test cuối cùng. Chỉ khẳng định tỷ lệ pass, coverage hoặc "đã kiểm thử tự động" khi có log/kết quả chạy tương ứng.

## 9. Gợi ý thực tế cho vai trò Tester

- Làm trước 10 test P0 trong ma trận; đây là phần tạo giá trị nhất cho đồ án.
- Với mỗi lỗi, kiểm tra thêm sau khi sửa để có trạng thái "retest PASS".
- Khi demo, chuẩn bị ít nhất một ví dụ thành công và một ví dụ hệ thống chặn đúng (ví dụ redeem mã đã dùng hoặc customer truy cập admin).
- Đừng dùng tài khoản/thẻ thanh toán thật. Với payment, sử dụng sandbox hoặc endpoint mô phỏng đã cấu hình cho môi trường test.

