import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required.");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const staffEmail = 'demo.staff.active@vouchernow.demo';
  
  // 1. Tìm staff user
  const staff = await prisma.user.findUnique({
    where: { email: staffEmail },
    include: {
      partnerStaffOf: true,
      branch: true
    }
  });

  if (!staff) {
    console.log(`Không tìm thấy user với email ${staffEmail}`);
    return;
  }

  if (!staff.partnerId) {
    console.log(`User ${staffEmail} không thuộc đối tác nào.`);
    return;
  }

  console.log(`\nNhân viên: ${staff.fullName} - Chi nhánh: ${staff.branch?.name}`);
  console.log(`Thuộc đối tác: ${staff.partnerStaffOf?.companyName}`);

  // 2. Tìm tất cả các chiến dịch voucher (VoucherCampaign) của đối tác này
  const campaigns = await prisma.voucherCampaign.findMany({
    where: { partnerId: staff.partnerId },
    select: {
      campaignId: true,
      title: true,
      status: true,
      capacity: true,
      soldQuantity: true,
      saleStartTime: true,
      saleEndTime: true,
      usageStartTime: true,
      usageEndTime: true
    }
  });

  console.log(`\n--- TỔNG QUAN CHIẾN DỊCH VOUCHER CỦA ĐỐI TÁC (${campaigns.length} chiến dịch) ---`);
  campaigns.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.status}] ${c.title}`);
    console.log(`   Sức chứa: ${c.capacity} | Đã bán: ${c.soldQuantity}`);
    console.log(`   Thời gian sử dụng: ${c.usageStartTime.toLocaleDateString('vi-VN')} đến ${c.usageEndTime.toLocaleDateString('vi-VN')}`);
  });

  // 3. Tìm các mã voucher (VoucherCode) đã phát hành thuộc các chiến dịch của đối tác này
  const issuedVouchers = await prisma.voucherCode.findMany({
    where: {
      orderItem: {
        campaign: {
          partnerId: staff.partnerId
        }
      }
    },
    include: {
      orderItem: {
        include: {
          campaign: { select: { title: true } }
        }
      }
    }
  });

  console.log(`\n--- DANH SÁCH MÃ VOUCHER ĐÃ PHÁT HÀNH (Tổng: ${issuedVouchers.length} mã) ---`);
  
  // Phân nhóm theo trạng thái
  const groupedVouchers = issuedVouchers.reduce((acc, v) => {
    if (!acc[v.status]) acc[v.status] = [];
    acc[v.status].push(v);
    return acc;
  }, {} as Record<string, typeof issuedVouchers>);

  for (const [status, vouchers] of Object.entries(groupedVouchers)) {
    console.log(`\nTrạng thái: ${status} (${vouchers.length} mã):`);
    vouchers.slice(0, 5).forEach((v, idx) => {
      console.log(`   ${idx + 1}. Mã: ${v.uniqueCode} | Chiến dịch: ${v.orderItem.campaign.title} | Ngày phát hành: ${v.issuedAt.toLocaleDateString('vi-VN')}`);
    });
    if (vouchers.length > 5) {
      console.log(`   ... và ${vouchers.length - 5} mã khác.`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
