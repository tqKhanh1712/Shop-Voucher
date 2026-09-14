import { PrismaService } from '../src/prisma/prisma.service';
import { buildCatalogSearchQuery } from '../src/vouchers/catalog-search';
import { EmbeddingService } from '../src/vouchers/search/embedding.service';

async function test() {
  const prisma = new PrismaService();
  const embedding = new EmbeddingService();
  await embedding.onModuleInit();
  
  const keyword = 'đồ uống';
  console.log(`Generating embedding for "${keyword}"...`);
  const vector = await embedding.generateEmbedding(keyword);
  console.log('Embedding generated.');
  
  const queryDto = { keyword };
  
  const sql = buildCatalogSearchQuery(queryDto, vector);
  
  try {
    console.log('Executing query...');
    const result = await prisma.$queryRaw(sql);
    console.log('Query successful! Rows:', result);
  } catch (err) {
    console.error('Query failed!');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test().catch(console.error);
