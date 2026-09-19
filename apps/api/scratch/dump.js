require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/.env' });
require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/apps/api/.env' });

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DIRECT_URL; // use direct for scripts
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const allCampaigns = await prisma.voucherCampaign.findMany({
    select: {
      campaignId: true,
      title: true,
      description: true,
      category: true
    }
  });

  const output = allCampaigns.map(c => ({
    id: c.campaignId,
    title: c.title,
    category: c.category,
    desc: c.description ? c.description.substring(0, 150).replace(/\n/g, ' ') + '...' : ''
  }));

  require('fs').writeFileSync('d:/PJ_Workshop/Shop-Voucher/apps/api/scratch/db_dump.json', JSON.stringify(output, null, 2));
  console.log('Dumped to scratch/db_dump.json');
}

main().catch(console.error).finally(() => prisma.$disconnect());
