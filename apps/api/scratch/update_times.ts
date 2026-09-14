import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  
  console.log('Cập nhật thời gian mở bán của tất cả voucher thành ngày 01/09/2026...');
  
  const res = await prisma.$executeRaw`
    UPDATE "Voucher_Campaigns" 
    SET sale_start_time = '2026-09-01T00:00:00Z',
        sale_end_time = '2027-09-01T00:00:00Z'
  `;
  
  console.log(`Đã cập nhật thành công: ${res} voucher.`);
  
  await prisma.$disconnect();
}
main().catch(console.error);
