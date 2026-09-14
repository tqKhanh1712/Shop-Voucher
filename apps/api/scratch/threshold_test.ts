import { EmbeddingService } from '../src/vouchers/search/embedding.service';

const embeddingService = new EmbeddingService();

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  await embeddingService.onModuleInit();

  const testCases = [
    {
      query: 'đồ ăn',
      vouchers: [
        // Liên quan - nên cao
        'Gà rán & Thức ăn nhanh',
        'KFC combo gà rán',
        'Pizza 4P\'s',
        'Tiệc buffet Dookki',
        'Bánh ngọt TOUS les JOURS',
        'Nhà hàng Mala Panda',
        // Không liên quan - nên thấp
        'Cà phê Cộng',
        'Trà sữa ABC',
        'Vé xem phim CGV',
        'Nha khoa Smile Beauty',
        'Spa trị liệu chân',
        'Thời trang Dottie 200k',
      ],
    },
    {
      query: 'nước uống',
      vouchers: [
        // Liên quan - nên cao
        'Cà phê - Trà',
        'Cộng Cà Phê 100k',
        'Trà sữa ABC',
        'Phúc Long',
        // Không liên quan - nên thấp
        'KFC combo gà rán',
        'Pizza 4P\'s',
        'Vé xem phim CGV',
        'Spa trị liệu chân',
        'Nha khoa Smile Beauty',
      ],
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n==== QUERY: "${testCase.query}" ====`);
    const queryVectors = await embeddingService.generateEmbeddings([testCase.query], true);
    if (!queryVectors || !queryVectors[0]) continue;
    const queryVec = queryVectors[0];

    const voucherVectors = await embeddingService.generateEmbeddings(testCase.vouchers, false);
    if (!voucherVectors) continue;

    const scored = testCase.vouchers.map((v, i) => ({
      voucher: v,
      sim: voucherVectors[i] ? cosineSimilarity(queryVec, voucherVectors[i]) : 0,
    })).sort((a, b) => b.sim - a.sim);

    scored.forEach(({ voucher, sim }) => {
      const flag = sim > 0.55 ? '✅ PASS' : sim > 0.45 ? '⚠️  BORDER' : '❌ LOW';
      console.log(`  ${flag}  ${sim.toFixed(4)}  ${voucher}`);
    });
  }

  await (embeddingService as any).client?.unembed?.();
}

main().catch(console.error);
