import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const categories = await prisma.voucherCategory.findMany();
  console.log(categories);
  await prisma.$disconnect();
}
main().catch(console.error);
