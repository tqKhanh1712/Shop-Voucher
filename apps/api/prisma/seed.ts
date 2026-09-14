import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Sử dụng một bcrypt hash cố định đại diện cho mật khẩu "Password123"
// Điều này giúp tránh phải import thư viện bcrypt trong script seed
const DEFAULT_PASSWORD_HASH = "$2b$10$FQgA0cVsWGkuhZAX8nfBte.tjl.wXzY8aO3eO.siP1gybqxO/dfoy";

async function main() {
  console.log("Bắt đầu dọn dẹp cơ sở dữ liệu...");
  // Sử dụng TRUNCATE TABLE CASCADE để xóa sạch dữ liệu trong các bảng có khóa ngoại chéo
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "Complaints",
      "Content_Entries",
      "Activity_Logs",
      "Audit_Logs",
      "Voucher_Usage_Log",
      "Voucher_Codes",
      "Payment_Refunds",
      "Payment_Webhook_Events",
      "Payment_Transactions",
      "Inventory_Reservations",
      "Order_Items",
      "Orders",
      "Campaign_Branches",
      "Voucher_Campaigns",
      "Branches",
      "Partners",
      "Users"
    CASCADE;
  `);
  console.log("Đã dọn dẹp xong cơ sở dữ liệu.");

  console.log("Bắt đầu tạo dữ liệu mẫu...");

  // 1. Tạo các tài khoản Users gốc (chưa gán partner_id/branch_id)
  // Tài khoản Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@vouchersystem.com",
      phone: "0900000000",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Hệ thống Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // Tài khoản Customers
  const customer1 = await prisma.user.create({
    data: {
      email: "customer1@gmail.com",
      phone: "0901234567",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Nguyễn Văn Khách Hàng 1",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: "customer2@gmail.com",
      phone: "0901234568",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Lê Thị Khách Hàng 2",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  });

  // Tài khoản Partner Owners (Tạo user trước, sau đó tạo Partner profile liên kết 1:1)
  const partnerUser1 = await prisma.user.create({
    data: {
      email: "partner1@vouchersystem.com",
      phone: "0911234567",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Đại diện Đối tác ABC",
      role: "PARTNER",
      status: "ACTIVE",
    },
  });

  const partnerUser2 = await prisma.user.create({
    data: {
      email: "partner2@vouchersystem.com",
      phone: "0911234568",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Đại diện Đối tác XYZ",
      role: "PARTNER",
      status: "ACTIVE",
    },
  });

  // 2. Tạo Partners Profile liên kết 1:1 với User tương ứng
  const partner1 = await prisma.partner.create({
    data: {
      partnerId: partnerUser1.userId,
      companyName: "Công ty TNHH Ăn uống ABC",
      taxCode: "0101234567",
      representative: "Nguyễn Văn A",
      approvalStatus: "APPROVED",
      accountStatus: "ACTIVE",
    },
  });

  const partner2 = await prisma.partner.create({
    data: {
      partnerId: partnerUser2.userId,
      companyName: "Hệ thống Thời trang XYZ",
      taxCode: "0101234568",
      representative: "Trần Thị B",
      approvalStatus: "APPROVED",
      accountStatus: "ACTIVE",
    },
  });

  // 3. Tạo các chi nhánh (Branches) cho đối tác
  // Chi nhánh của Partner 1 (ABC)
  const branch1_abc = await prisma.branch.create({
    data: {
      partnerId: partner1.partnerId,
      name: "Chi nhánh ABC Quận 1",
      address: "123 Lê Lợi, Quận 1, Tp. HCM",
      provinceCode: "79",
      // latitude: 10.776,
      // longitude: 106.701,
    },
  });

  const branch2_abc = await prisma.branch.create({
    data: {
      partnerId: partner1.partnerId,
      name: "Chi nhánh ABC Quận 3",
      address: "456 Nguyễn Đình Chiểu, Quận 3, Tp. HCM",
      provinceCode: "79",
      // latitude: 10.772,
      // longitude: 106.685,
    },
  });

  // Chi nhánh của Partner 2 (XYZ)
  const branch1_xyz = await prisma.branch.create({
    data: {
      partnerId: partner2.partnerId,
      name: "Cửa hàng XYZ Quận 1",
      address: "789 Nguyễn Trãi, Quận 1, Tp. HCM",
      provinceCode: "79",
      // latitude: 10.758,
      // longitude: 106.689,
    },
  });

  const branch2_xyz = await prisma.branch.create({
    data: {
      partnerId: partner2.partnerId,
      name: "Cửa hàng XYZ Bình Thạnh",
      address: "101 Điện Biên Phủ, Bình Thạnh, Tp. HCM",
      provinceCode: "79",
      // latitude: 10.798,
      // longitude: 106.711,
    },
  });

  // 4. Tạo nhân viên đối tác (PARTNER_STAFF) gán partner_id và branch_id cụ thể
  const staff1_abc = await prisma.user.create({
    data: {
      email: "staff1_abc@vouchersystem.com",
      phone: "0921234567",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Nhân viên ABC Lê Lợi",
      role: "PARTNER_STAFF",
      partnerId: partner1.partnerId,
      branchId: branch1_abc.branchId,
      status: "ACTIVE",
    },
  });

  const staff2_abc = await prisma.user.create({
    data: {
      email: "staff2_abc@vouchersystem.com",
      phone: "0921234568",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Nhân viên ABC Nguyễn Đình Chiểu",
      role: "PARTNER_STAFF",
      partnerId: partner1.partnerId,
      branchId: branch2_abc.branchId,
      status: "ACTIVE",
    },
  });

  const staff1_xyz = await prisma.user.create({
    data: {
      email: "staff1_xyz@vouchersystem.com",
      phone: "0921234569",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Nhân viên XYZ Nguyễn Trãi",
      role: "PARTNER_STAFF",
      partnerId: partner2.partnerId,
      branchId: branch1_xyz.branchId,
      status: "ACTIVE",
    },
  });

  const staff2_xyz = await prisma.user.create({
    data: {
      email: "staff2_xyz@vouchersystem.com",
      phone: "0921234570",
      passwordHash: DEFAULT_PASSWORD_HASH,
      fullName: "Nhân viên XYZ Điện Biên Phủ",
      role: "PARTNER_STAFF",
      partnerId: partner2.partnerId,
      branchId: branch2_xyz.branchId,
      status: "ACTIVE",
    },
  });

  // 5. Tạo các chiến dịch Voucher (VoucherCampaign) và liên kết Chi nhánh áp dụng
  // Các mốc thời gian mẫu
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const oneMonthHence = new Date();
  oneMonthHence.setMonth(oneMonthHence.getMonth() + 1);

  const twoMonthsHence = new Date();
  twoMonthsHence.setMonth(twoMonthsHence.getMonth() + 2);

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Chiến dịch 1 (ABC): Buffet Lẩu 199k - APPROVED (Active)
  const campaign1 = await prisma.voucherCampaign.create({
    data: {
      partnerId: partner1.partnerId,
      title: "Voucher Buffet Lẩu 199k tại ABC",
      description: "Áp dụng cho toàn bộ thực đơn lẩu buffet tối từ Thứ 2 đến Thứ 6.",
      category: "Food & Beverage",
      originalPrice: 299000,
      salePrice: 199000,
      saleStartTime: oneMonthAgo,
      saleEndTime: oneMonthHence,
      usageStartTime: oneMonthAgo,
      usageEndTime: twoMonthsHence,
      capacity: 100,
      soldQuantity: 5,
      reservedStock: 0,
      status: "APPROVED",
      isMultiUse: false,
      refundAllowed: true,
      refundWindowHours: 48,
      refundPolicy: "Hoàn tiền toàn bộ trong vòng 48 giờ từ khi thanh toán nếu voucher chưa được sử dụng.",
      cancellationPolicy: "Voucher đã sử dụng hoặc quá thời hạn hoàn tiền không thể hủy.",
      policyVersion: 1,
    },
  });

  await prisma.campaignBranch.createMany({
    data: [
      { partnerId: partner1.partnerId, campaignId: campaign1.campaignId, branchId: branch1_abc.branchId },
      { partnerId: partner1.partnerId, campaignId: campaign1.campaignId, branchId: branch2_abc.branchId },
    ],
  });

  // Chiến dịch 2 (ABC): Giảm giá nước uống 50% - APPROVED (Active)
  const campaign2 = await prisma.voucherCampaign.create({
    data: {
      partnerId: partner1.partnerId,
      title: "Voucher Nước uống giảm giá 50%",
      description: "Giảm trực tiếp 50% cho tất cả thức uống trà sữa và cà phê.",
      category: "Food & Beverage",
      originalPrice: 50000,
      salePrice: 25000,
      saleStartTime: oneMonthAgo,
      saleEndTime: oneMonthHence,
      usageStartTime: oneMonthAgo,
      usageEndTime: twoMonthsHence,
      capacity: 200,
      soldQuantity: 10,
      reservedStock: 2,
      status: "APPROVED",
      isMultiUse: false,
      refundAllowed: false,
      refundPolicy: "Voucher không áp dụng hoàn tiền sau khi thanh toán.",
      cancellationPolicy: "Đơn chỉ có thể hủy trước khi thanh toán hoàn tất.",
      policyVersion: 1,
    },
  });

  await prisma.campaignBranch.create({
    data: { partnerId: partner1.partnerId, campaignId: campaign2.campaignId, branchId: branch1_abc.branchId },
  });

  // Chiến dịch 3 (ABC): DRAFT
  const campaign3 = await prisma.voucherCampaign.create({
    data: {
      partnerId: partner1.partnerId,
      title: "Voucher Trà sữa ABC mới (DRAFT)",
      description: "Chiến dịch nháp chưa công bố.",
      category: "Food & Beverage",
      originalPrice: 40000,
      salePrice: 20000,
      saleStartTime: oneMonthHence,
      saleEndTime: twoMonthsHence,
      usageStartTime: oneMonthHence,
      usageEndTime: twoMonthsHence,
      capacity: 50,
      soldQuantity: 0,
      reservedStock: 0,
      status: "DRAFT",
      isMultiUse: false,
    },
  });

  await prisma.campaignBranch.create({
    data: { partnerId: partner1.partnerId, campaignId: campaign3.campaignId, branchId: branch1_abc.branchId },
  });

  // Chiến dịch 4 (XYZ): Mua sắm Thời trang XYZ 100k - APPROVED (Active)
  const campaign4 = await prisma.voucherCampaign.create({
    data: {
      partnerId: partner2.partnerId,
      title: "Voucher Mua sắm Thời trang XYZ 100k",
      description: "Áp dụng cho hóa đơn mua sắm quần áo thời trang bất kỳ từ 300k.",
      category: "Shopping",
      originalPrice: 150000,
      salePrice: 100000,
      saleStartTime: oneMonthAgo,
      saleEndTime: oneMonthHence,
      usageStartTime: oneMonthAgo,
      usageEndTime: twoMonthsHence,
      capacity: 150,
      soldQuantity: 20,
      reservedStock: 0,
      status: "APPROVED",
      isMultiUse: false,
    },
  });

  await prisma.campaignBranch.createMany({
    data: [
      { partnerId: partner2.partnerId, campaignId: campaign4.campaignId, branchId: branch1_xyz.branchId },
      { partnerId: partner2.partnerId, campaignId: campaign4.campaignId, branchId: branch2_xyz.branchId },
    ],
  });

  // Chiến dịch 5 (XYZ): Mua sắm SOLD OUT
  const campaign5 = await prisma.voucherCampaign.create({
    data: {
      partnerId: partner2.partnerId,
      title: "Voucher Mua sắm SOLD OUT",
      description: "Chiến dịch giới hạn đặc biệt đã bán hết.",
      category: "Shopping",
      originalPrice: 200000,
      salePrice: 100000,
      saleStartTime: oneMonthAgo,
      saleEndTime: oneMonthHence,
      usageStartTime: oneMonthAgo,
      usageEndTime: twoMonthsHence,
      capacity: 10,
      soldQuantity: 10,
      reservedStock: 0,
      status: "SOLD_OUT",
      isMultiUse: false,
    },
  });

  await prisma.campaignBranch.create({
    data: { partnerId: partner2.partnerId, campaignId: campaign5.campaignId, branchId: branch1_xyz.branchId },
  });

  // Chiến dịch 6 (XYZ): EXPIRED (Đã hết hạn bán và sử dụng)
  const campaign6 = await prisma.voucherCampaign.create({
    data: {
      partnerId: partner2.partnerId,
      title: "Voucher Mua sắm EXPIRED",
      description: "Chiến dịch đã kết thúc bán tuần trước.",
      category: "Shopping",
      originalPrice: 200000,
      salePrice: 100000,
      saleStartTime: twoMonthsAgo,
      saleEndTime: oneWeekAgo,
      usageStartTime: twoMonthsAgo,
      usageEndTime: oneWeekAgo,
      capacity: 50,
      soldQuantity: 5,
      reservedStock: 0,
      status: "EXPIRED",
      isMultiUse: false,
    },
  });

  await prisma.campaignBranch.create({
    data: { partnerId: partner2.partnerId, campaignId: campaign6.campaignId, branchId: branch2_xyz.branchId },
  });

  // 6. Tạo đơn hàng (Orders) và Voucher Codes đã phát hành
  // Đơn hàng 1: Customer 1 mua 1 Voucher Buffet Lẩu (Campaign 1) thanh toán qua Stripe thành công
  const order1 = await prisma.order.create({
    data: {
      orderCode: "ORD-STRIPE-001",
      customerId: customer1.userId,
      recipientNote: "Quà sinh nhật cho bạn",
      totalAmount: 199000,
      baseCurrency: "VND",
      selectedPaymentProvider: "STRIPE",
      orderStatus: "CONFIRMED",
      paymentStatus: "PAID",
      reservationExpiresAt: oneMonthAgo,
      createdAt: oneMonthAgo,
    },
  });

  const orderItem1 = await prisma.orderItem.create({
    data: {
      orderId: order1.orderId,
      campaignId: campaign1.campaignId,
      quantity: 1,
      unitPrice: 199000,
      refundAllowedSnapshot: true,
      refundWindowHoursSnapshot: 48,
      refundPolicySnapshot: "Hoàn tiền toàn bộ trong vòng 48 giờ từ khi thanh toán nếu voucher chưa được sử dụng.",
      cancellationPolicySnapshot: "Voucher đã sử dụng hoặc quá thời hạn hoàn tiền không thể hủy.",
      policyVersionSnapshot: 1,
      refundDeadlineAt: new Date(oneMonthAgo.getTime() + 48 * 60 * 60 * 1000),
    },
  });

  // Tạo giao dịch thanh toán Stripe thành công
  await prisma.paymentTransaction.create({
    data: {
      orderId: order1.orderId,
      provider: "STRIPE",
      attemptNo: 1,
      status: "SUCCEEDED",
      idempotencyKey: "idem-stripe-001",
      providerOrderId: "ch_stripe_123456",
      providerTransactionId: "txn_stripe_123456",
      baseAmount: 199000,
      requestAmountMinor: BigInt(199000),
      requestCurrency: "VND",
      paidAt: oneMonthAgo,
      createdAt: oneMonthAgo,
    },
  });

  // Phát hành 1 voucher code khả dụng cho Customer 1
  const voucherCode1 = await prisma.voucherCode.create({
    data: {
      itemId: orderItem1.itemId,
      uniqueCode: "ABC199000001",
      customerId: customer1.userId,
      status: "AVAILABLE",
      issuedAt: oneMonthAgo,
      expiresAt: twoMonthsHence,
    },
  });

  // Đơn hàng 2: Customer 2 mua 2 Voucher Mua sắm 100k (Campaign 4) thanh toán qua PayPal thành công
  const order2 = await prisma.order.create({
    data: {
      orderCode: "ORD-PAYPAL-002",
      customerId: customer2.userId,
      totalAmount: 200000,
      baseCurrency: "VND",
      selectedPaymentProvider: "PAYPAL",
      orderStatus: "CONFIRMED",
      paymentStatus: "PAID",
      reservationExpiresAt: oneMonthAgo,
      createdAt: oneMonthAgo,
    },
  });

  const orderItem2 = await prisma.orderItem.create({
    data: {
      orderId: order2.orderId,
      campaignId: campaign4.campaignId,
      quantity: 2,
      unitPrice: 100000,
      refundAllowedSnapshot: false,
      refundPolicySnapshot: "Voucher không áp dụng hoàn tiền sau khi thanh toán.",
      cancellationPolicySnapshot: "Đơn chỉ có thể hủy trước khi thanh toán hoàn tất.",
      policyVersionSnapshot: 1,
    },
  });

  // Tạo giao dịch thanh toán PayPal thành công (Có quy đổi ngoại tệ)
  await prisma.paymentTransaction.create({
    data: {
      orderId: order2.orderId,
      provider: "PAYPAL",
      attemptNo: 1,
      status: "SUCCEEDED",
      idempotencyKey: "idem-paypal-002",
      providerOrderId: "pay_paypal_987654",
      providerTransactionId: "txn_paypal_987654",
      baseAmount: 200000,
      requestAmountMinor: BigInt(800), // 8.00 USD
      requestCurrency: "USD",
      exchangeRate: 25000, // 1 USD = 25,000 VND
      paidAt: oneMonthAgo,
      createdAt: oneMonthAgo,
    },
  });

  // Phát hành 2 voucher codes cho Customer 2
  // Code 1: Đã được sử dụng (Redeemed) tại Cửa hàng XYZ Quận 1
  const voucherCode2 = await prisma.voucherCode.create({
    data: {
      itemId: orderItem2.itemId,
      uniqueCode: "XYZ100000001",
      customerId: customer2.userId,
      status: "USED",
      issuedAt: oneMonthAgo,
      expiresAt: twoMonthsHence,
    },
  });

  // Ghi nhận lịch sử sử dụng voucher code 1
  await prisma.voucherUsageLog.create({
    data: {
      codeId: voucherCode2.codeId,
      branchId: branch1_xyz.branchId,
      usedAt: oneMonthAgo,
    },
  });

  // Code 2: Vẫn còn khả dụng
  await prisma.voucherCode.create({
    data: {
      itemId: orderItem2.itemId,
      uniqueCode: "XYZ100000002",
      customerId: customer2.userId,
      status: "AVAILABLE",
      issuedAt: oneMonthAgo,
      expiresAt: twoMonthsHence,
    },
  });

  // 7. Tạo một số dòng nhật ký hệ thống (Audit Logs) làm mẫu
  await prisma.auditLog.create({
    data: {
      adminId: admin.userId,
      adminNameSnapshot: admin.fullName || "Admin",
      adminEmailSnapshot: admin.email,
      actionType: "APPROVE_PARTNER",
      targetEntity: "Partners",
      targetId: partner1.partnerId,
      timestamp: oneMonthAgo,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.userId,
      adminNameSnapshot: admin.fullName || "Admin",
      adminEmailSnapshot: admin.email,
      actionType: "APPROVE_CAMPAIGN",
      targetEntity: "Voucher_Campaigns",
      targetId: campaign1.campaignId,
      timestamp: oneMonthAgo,
    },
  });

  // 8. Dữ liệu nền cho lịch sử hoạt động, nội dung và khiếu nại.
  await prisma.activityLog.createMany({
    data: [
      {
        actorUserId: admin.userId,
        actorRoleSnapshot: "ADMIN",
        category: "ADMIN",
        actionType: "APPROVE_PARTNER",
        targetEntity: "Partners",
        targetId: partner1.partnerId,
        metadata: { source: "seed" },
        occurredAt: oneMonthAgo,
      },
      {
        actorUserId: customer1.userId,
        actorRoleSnapshot: "CUSTOMER",
        category: "TRANSACTION",
        actionType: "PAYMENT_SUCCEEDED",
        targetEntity: "Orders",
        targetId: order1.orderId,
        metadata: { paymentProvider: "STRIPE" },
        occurredAt: oneMonthAgo,
      },
    ],
  });

  await prisma.contentEntry.createMany({
    data: [
      {
        type: "BANNER",
        slug: "home-summer-vouchers",
        title: "Ưu đãi voucher nổi bật",
        summary: "Khám phá các voucher đang mở bán trên hệ thống.",
        linkUrl: "/",
        status: "PUBLISHED",
        displayOrder: 1,
        publishedAt: oneMonthAgo,
        createdById: admin.userId,
        updatedById: admin.userId,
      },
      {
        type: "POLICY",
        slug: "refund-policy",
        title: "Chính sách hủy và hoàn tiền",
        body: "Điều kiện hoàn tiền cụ thể được hiển thị và lưu tại thời điểm đặt mua voucher.",
        status: "PUBLISHED",
        displayOrder: 1,
        publishedAt: oneMonthAgo,
        createdById: admin.userId,
        updatedById: admin.userId,
      },
    ],
  });

  await prisma.complaint.create({
    data: {
      customerId: customer1.userId,
      orderId: order1.orderId,
      campaignId: campaign1.campaignId,
      type: "ORDER",
      subject: "Cần hỗ trợ về điều kiện sử dụng",
      description: "Khách hàng cần xác nhận lại chi nhánh áp dụng của voucher.",
      status: "RESOLVED",
      resolutionResponse: "Đã xác nhận voucher áp dụng tại hai chi nhánh ABC trong danh sách.",
      resolvedById: admin.userId,
      resolvedAt: oneWeekAgo,
      createdAt: oneMonthAgo,
    },
  });

  console.log("Đã tạo dữ liệu mẫu thành công!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    pool.end();
  })
  .catch(async (e) => {
    console.error("Lỗi khi seed dữ liệu:", e);
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
