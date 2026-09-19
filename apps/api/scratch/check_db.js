require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/.env' });
require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/apps/api/.env' });
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const categories = await prisma.voucherCategory.findMany({ select: { code: true, nameVi: true } });
  console.log("Categories found:", categories.length);
  const sampleCampaign = await prisma.voucherCampaign.findFirst({ 
    where: { title: { contains: 'Tặng Kèm Nước' } },
    select: { title: true, description: true } 
  });
  console.log("Sample Campaign:", sampleCampaign);
}
main().catch(console.error).finally(() => prisma.$disconnect());
