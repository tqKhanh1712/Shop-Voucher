import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  
  const campaigns = await prisma.voucherCampaign.findMany({ take: 5, select: { title: true, saleStartTime: true, saleEndTime: true } });
  console.log('Campaigns:', campaigns);
  
  await prisma.$disconnect();
}
main().catch(console.error);
