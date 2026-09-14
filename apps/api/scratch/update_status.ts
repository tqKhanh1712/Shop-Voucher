import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const res = await prisma.voucherCampaign.updateMany({
    data: { status: 'APPROVED' }
  });
  console.log(`Updated ${res.count} campaigns to APPROVED.`);
  await prisma.$disconnect();
}
main().catch(console.error);
