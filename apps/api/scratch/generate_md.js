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
  const allCampaigns = await prisma.voucherCampaign.findMany({
    select: {
      title: true,
      category: true,
      status: true
    },
    orderBy: { category: 'asc' }
  });

  const grouped = {};
  allCampaigns.forEach(c => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });

  let md = '# Kế hoạch Phân loại Lại Dữ liệu Voucher (Taxonomy Review)\n\n';
  md += `Tổng cộng tìm thấy: **${allCampaigns.length} voucher** (bao gồm cả các voucher chưa mở bán, nháp, hoặc đã đóng).\n\n`;
  md += 'Dưới đây là danh sách TOÀN BỘ voucher được chia theo 4 danh mục gốc hiện tại trong hệ thống. Vui lòng xem qua và cho tôi biết bạn muốn điều chỉnh gì.\n\n---\n\n';

  const categoryNames = {
    FOOD_DRINK: 'Ẩm thực & Đồ uống (Food & Beverage)',
    BEAUTY_HEALTH: 'Sức khỏe & Làm đẹp (Health & Beauty)',
    SHOPPING_RETAIL: 'Mua sắm & Thời trang (Shopping & Retail)',
    LIFESTYLE_SERVICES: 'Dịch vụ Đời sống (Lifestyle & Services)'
  };

  for (const cat in grouped) {
    const name = categoryNames[cat] || cat;
    md += `## ${name} (${grouped[cat].length} vouchers)\n`;
    grouped[cat].forEach(c => {
      const statusTag = c.status !== 'ACTIVE' ? ` _[${c.status}]_` : '';
      md += `- ${c.title}${statusTag}\n`;
    });
    md += '\n---\n\n';
  }

  md += `## 💡 Câu hỏi cho bạn (Vui lòng phản hồi):\n1. Bạn có muốn giữ nguyên 4 danh mục lớn như trên không, hay muốn tạo thêm các danh mục phụ (Sub-categories)?\n2. Một số tên Voucher đang có chữ \`(Bản sao 1)\`. Bạn có muốn tôi dọn dẹp và xóa bớt các dữ liệu rác/bản sao này trong quá trình làm lại DB không?\n3. Bạn có muốn thêm các "Tags" (từ khóa) cho mỗi voucher để bộ máy tìm kiếm (Elastic/Postgres Full-Text) dễ dàng quét hơn không?`;

  fs.writeFileSync('d:/PJ_Workshop/Shop-Voucher/apps/api/scratch/voucher_taxonomy_full.md', md);
  console.log(`Generated markdown for ${allCampaigns.length} campaigns.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
