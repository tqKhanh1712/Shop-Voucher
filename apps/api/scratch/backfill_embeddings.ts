import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/vouchers/search/embedding.service';

const prisma = new PrismaService();
const embeddingService = new EmbeddingService();

// Hàm delay để tránh rate limit
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  console.log('Bắt đầu quy trình Backfill Vector với Cohere API (1024 dims)...');
  await embeddingService.onModuleInit(); 

  const campaigns = await prisma.voucherCampaign.findMany({
    where: { status: 'APPROVED' },
    select: {
      campaignId: true,
      title: true,
      description: true,
      campaignCategories: {
        select: {
          category: {
            select: { nameVi: true }
          }
        }
      }
    },
  });

  console.log(`Tiến hành backfill ${campaigns.length} chiến dịch...`);

  // Chia mảng thành các chunks 96 phần tử (giới hạn của Cohere là 96/batch)
  const CHUNK_SIZE = 90;
  let doneCount = 0;
  
  for (let i = 0; i < campaigns.length; i += CHUNK_SIZE) {
    const chunk = campaigns.slice(i, i + CHUNK_SIZE);
    console.log(`Đang xử lý chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} items)...`);
    
    const texts = chunk.map(c => {
      const categoryNames = c.campaignCategories.map(cc => cc.category.nameVi).join(', ');
      // Lặp lại category 3 lần để AI "ghi nhớ" chủ đề rõ hơn.
      // Không dùng description (điều khoản dài) để tránh loãng vector.
      const categoryBoost = [categoryNames, categoryNames, categoryNames].join(' ');
      return [categoryBoost, c.title].filter(Boolean).join(' ');
    });
    
    // Gọi batch embed
    const vectors = await embeddingService.generateEmbeddings(texts, false);
    
    if (vectors && vectors.length === chunk.length) {
      for (let j = 0; j < chunk.length; j++) {
        const c = chunk[j];
        const vector = vectors[j];
        
        if (vector && vector.length === 1024) {
          const vectorLiteral = `[${vector.join(',')}]`;
          try {
            await prisma.$executeRaw`
              UPDATE "Voucher_Campaigns" 
              SET embedding = ${vectorLiteral}::vector 
              WHERE campaign_id = ${c.campaignId}::uuid
            `;
            doneCount++;
          } catch (err) {
            console.error(`Lỗi cập nhật DB cho chiến dịch ${c.campaignId}:`, err);
          }
        } else {
          console.error(`Vector không hợp lệ hoặc thiếu kích thước cho chiến dịch ${c.campaignId}`);
        }
      }
    } else {
      console.error(`Lỗi tạo vector cho chunk ${i / CHUNK_SIZE + 1}. Bỏ qua chunk này.`);
    }
    
    // Nghỉ 5s giữa các batch để tránh Free Tier Rate Limit (15 RPM)
    if (i + CHUNK_SIZE < campaigns.length) {
      console.log('Chờ 5 giây trước khi chạy chunk tiếp theo...');
      await delay(5000);
    }
  }

  console.log(`Backfill hoàn tất. Cập nhật thành công ${doneCount}/${campaigns.length} bản ghi.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
