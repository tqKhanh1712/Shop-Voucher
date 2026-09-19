require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/.env' });
require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/apps/api/.env' });

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const connectionString = process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const csvText = fs.readFileSync('C:/Users/Acer/.gemini/antigravity-ide/brain/b2fe8af5-2a2a-4b22-8c7c-4c4754c3c1a2/scratch/vouchers.csv', 'utf8');
  const lines = csvText.trim().split('\n');
  const header = lines[0].split(',');
  const data = lines.slice(1).map(line => {
    // Basic CSV parse (assuming no commas inside fields)
    const values = line.split(',');
    let obj = {};
    header.forEach((h, i) => {
      obj[h.trim()] = values[i] ? values[i].trim() : null;
    });
    return obj;
  });

  console.log(`Parsed ${data.length} records from CSV.`);

  // 1. Create/upsert Categories
  const rootCategoriesMap = {}; // { 'do-an': id }
  const subCategoriesMap = {}; // { 'burger-fastfood': id }

  for (const row of data) {
    if (!row.category || !row.sub_category) continue;

    // Handle Root Category
    if (!rootCategoriesMap[row.category]) {
      let root = await prisma.voucherCategory.findUnique({ where: { code: row.category } });
      if (!root) {
        root = await prisma.voucherCategory.create({
          data: {
            code: row.category,
            nameVi: row.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          }
        });
      }
      rootCategoriesMap[row.category] = root.categoryId;
    }

    // Handle Sub Category
    if (!subCategoriesMap[row.sub_category]) {
      let sub = await prisma.voucherCategory.findUnique({ where: { code: row.sub_category } });
      if (!sub) {
        sub = await prisma.voucherCategory.create({
          data: {
            code: row.sub_category,
            nameVi: row.sub_category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            parentId: rootCategoriesMap[row.category]
          }
        });
      } else if (sub.parentId !== rootCategoriesMap[row.category]) {
        sub = await prisma.voucherCategory.update({
          where: { code: row.sub_category },
          data: { parentId: rootCategoriesMap[row.category] }
        });
      }
      subCategoriesMap[row.sub_category] = sub.categoryId;
    }
  }
  console.log('Categories synced.');

  // 2. Process Campaigns
  let updatedCount = 0;
  for (const row of data) {
    // Find campaign by original name (which includes "Bản sao X")
    const campaign = await prisma.voucherCampaign.findFirst({
      where: { title: row.name }
    });

    if (campaign) {
      // 2.1 Calculate new name if it contains "Bản sao"
      let newTitle = campaign.title;
      if (newTitle.includes('(Bản sao')) {
        let baseTitle = newTitle.replace(/\s*\(Bản sao \d+\)/, '');
        let suffix = '(Phiên bản Mới)';
        if (row.tags) {
          if (row.tags.includes('tang-kem-nuoc')) suffix = '(Tặng Kèm Nước)';
          else if (row.tags.includes('combo-cuoi-tuan') || row.tags.includes('combo')) suffix = '(Combo Đặc Biệt)';
          else if (row.tags.includes('danh-cho-2-nguoi')) suffix = '(Dành Cho 2 Người)';
          else if (row.tags.includes('goi-vip')) suffix = '(Gói VIP)';
          else if (row.tags.includes('tre-em')) suffix = '(Cho Trẻ Em)';
        }
        
        // Ensure no duplicate suffix if already in baseTitle
        if (!baseTitle.includes(suffix)) {
          newTitle = `${baseTitle} ${suffix}`;
        } else {
          newTitle = baseTitle;
        }
      }

      // 2.2 Update description with tags
      let newDesc = campaign.description || '';
      if (row.tags && row.tags.trim() !== '') {
        const hashtags = row.tags.split(';').map(t => `#${t.trim()}`).join(' ');
        // Avoid adding multiple times if script re-runs
        if (!newDesc.includes('Tags:')) {
          newDesc = `${newDesc}\n\n---\nTags: ${hashtags}`;
        }
      }

      // 2.3 Update Campaign
      await prisma.voucherCampaign.update({
        where: { campaignId: campaign.campaignId },
        data: {
          title: newTitle,
          description: newDesc,
          category: row.category,
          status: row.status || undefined // Update status if provided
        }
      });

      // 2.4 Update CampaignCategory mapping
      const subCatId = subCategoriesMap[row.sub_category];
      if (subCatId) {
        // Clear existing categories
        await prisma.campaignCategory.deleteMany({
          where: { campaignId: campaign.campaignId }
        });
        // Create new category link
        await prisma.campaignCategory.create({
          data: {
            campaignId: campaign.campaignId,
            categoryId: subCatId
          }
        });
      }

      updatedCount++;
    } else {
      console.log(`Campaign not found: ${row.name}`);
    }
  }

  console.log(`Successfully updated ${updatedCount} campaigns!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
