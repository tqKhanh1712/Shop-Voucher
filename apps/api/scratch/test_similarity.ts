import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/vouchers/search/embedding.service';

const prisma = new PrismaService();
const embeddingService = new EmbeddingService();

async function main() {
  await embeddingService.onModuleInit();
  const keyword = 'nước uống';
  const keywordVectors = await embeddingService.generateEmbeddings([keyword], true);
  if (!keywordVectors || !keywordVectors[0]) return;
  const vector = keywordVectors[0];
  const vectorLiteral = `[${vector.join(',')}]`;

  const results = await prisma.$queryRaw`
    SELECT title, 1 - (embedding <=> ${vectorLiteral}::vector) as similarity
    FROM "Voucher_Campaigns"
    WHERE embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT 20;
  `;
  console.log(results);
}
main();
