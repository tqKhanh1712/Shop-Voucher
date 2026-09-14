import { PrismaService } from '../src/prisma/prisma.service';

const KEYWORD_MAP = [
  { name: 'Cà phê - Trà', keywords: ['trà', 'cà phê', 'cafe', 'coffee', 'phúc long', 'highland', 'highlands', 'trà sữa', 'thức uống', 'nước ép', 'macchiato'] },
  { name: 'Bánh ngọt', keywords: ['bánh', 'cake', 'bakery', 'tourles', 'tous les', 'ngọt', 'pastry', 'cheesecake', 'mousse'] },
  { name: 'Gà rán & Thức ăn nhanh', keywords: ['gà rán', 'kfc', 'lotteria', 'burger', 'mcdonald', 'fast food', 'gà', 'texas', 'jollibee', 'popeyes'] },
  { name: 'Pizza', keywords: ['pizza', 'hut', 'domino'] },
  { name: 'Tiệc buffet', keywords: ['buffet', 'kichi', 'manwah', 'dookki', 'meat plus', 'king bbq buffet'] },
  { name: 'Nhà hàng', keywords: ['nhà hàng', 'lẩu', 'nướng', 'hotpot', 'bbq', 'thái', 'gogi', 'korean', 'food', 'hải sản', 'dimsum', 'baozi', 'sushi', 'meat'] },
  { name: 'Thời trang', keywords: ['thời trang', 'áo', 'váy', 'quần', 'giày', 'juno', 'vascara', 'canifa', 'yody', 'túi xách', 'balo', 'balo', 'fashion'] },
  { name: 'Siêu thị & Cửa hàng tiện lợi', keywords: ['siêu thị', 'mart', 'coop', 'vinmart', 'bách hóa', 'circle k', 'family mart', 'ministop', 'winmart', 'lotte mart', 'aeon'] },
  { name: 'Tiệm làm tóc & Spa', keywords: ['spa', 'hair', 'tóc', 'massage', 'gội đầu', 'skincare', 'làm đẹp', 'thẩm mỹ', 'salon', 'nail'] },
  { name: 'Sức khỏe & Nha khoa', keywords: ['nha khoa', 'răng', 'khám', 'sức khỏe', 'phòng khám', 'nha', 'clinic', 'y tế'] },
  { name: 'Rạp chiếu phim', keywords: ['cgv', 'lotte cinema', 'bhd', 'phim', 'vé xem phim', 'galaxy', 'cinestar'] },
  { name: 'Vui chơi & Giải trí', keywords: ['công viên', 'khu vui chơi', 'tiniworld', 'sun world', 'vé vui chơi', 'vé vào cổng', 'vinwonders'] },
  { name: 'Voucher Book', keywords: ['voucher book', 'sách', 'tiki'] },
  { name: 'Phong cách sống', keywords: ['phong cách sống', 'trang sức', 'đồng hồ', 'pnj', 'doji', 'nội thất'] },
  { name: 'Di chuyển', keywords: ['xe', 'di chuyển', 'taxi', 'grab', 'be', 'gojek', 'xanh sm', 'hàng không', 'vé máy bay'] },
];

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const categories = await prisma.voucherCategory.findMany();
    const campaigns = await prisma.voucherCampaign.findMany({
      select: {
        campaignId: true,
        title: true,
        description: true,
        campaignCategories: true
      }
    });

    let updatedCount = 0;

    for (const campaign of campaigns) {
      const text = `${campaign.title} ${campaign.description}`.toLowerCase();
      let matchedCategoryName = null;
      let maxMatches = 0;

      for (const rule of KEYWORD_MAP) {
        let matches = 0;
        for (const kw of rule.keywords) {
          if (text.includes(kw)) {
            matches++;
          }
        }
        // Trọng số ưu tiên (nếu cùng match thì lấy cái nhiều match nhất)
        if (matches > maxMatches) {
          maxMatches = matches;
          matchedCategoryName = rule.name;
        }
      }

      // Default nếu không match gì: Để nguyên hoặc nhét vào Nhà hàng nếu là đồ ăn, Khác nếu không biết
      if (!matchedCategoryName) {
        if (text.includes('ăn') || text.includes('uống') || text.includes('nước')) {
          matchedCategoryName = 'Nhà hàng'; // Tạm gán
        } else {
          matchedCategoryName = 'Khác';
        }
      }

      const targetCategory = categories.find(c => c.nameVi === matchedCategoryName);
      if (targetCategory) {
        // Xoá quan hệ cũ
        await prisma.campaignCategory.deleteMany({
          where: { campaignId: campaign.campaignId }
        });

        // Tạo quan hệ mới
        await prisma.campaignCategory.create({
          data: {
            campaignId: campaign.campaignId,
            categoryId: targetCategory.categoryId,
            isPrimary: true
          }
        });
        
        console.log(`[Re-categorized] ${campaign.title.substring(0, 30)}... => ${matchedCategoryName}`);
        updatedCount++;
      }
    }

    console.log(`Hoàn tất! Đã phân bổ lại ${updatedCount} voucher campaigns.`);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
