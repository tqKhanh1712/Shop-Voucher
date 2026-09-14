import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/vouchers/search/embedding.service';
import { buildCatalogSearchQuery, CatalogSearchQueryRow } from '../src/vouchers/catalog-search';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const embeddingService = new EmbeddingService();
  await embeddingService.onModuleInit();

  for (const keyword of ['đồ ăn', 'nước uống', 'xem phim', 'làm đẹp']) {
    console.log(`\n=== DEBUG SEARCH: "${keyword}" ===`);
    let vector = null;
    const vectors = await embeddingService.generateEmbeddings([keyword], true);
    if (vectors && vectors[0]) {
      vector = vectors[0];
    }

    const query = buildCatalogSearchQuery({ keyword, page: 1, limit: 10 }, vector);
    
    try {
      const result = await prisma.$queryRaw<CatalogSearchQueryRow[]>(query);
      if (result && result.length > 0) {
        const data = result[0].data as any[];
        console.log(`Found ${data.length} results.`);
        data.slice(0, 10).forEach((d, i) => {
          console.log(`${i+1}. ${d.title} (Cat: ${d.primaryCategory?.nameVi})`);
        });
      } else {
        console.log('No results.');
      }
    } catch (e) {
      console.error('Error executing query:', e);
    }
  }
  
  await prisma.$disconnect();
}

main();
