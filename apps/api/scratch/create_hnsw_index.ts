import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaService();

async function main() {
  console.log('Creating HNSW index for embedding column...');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS voucher_campaign_embedding_hnsw_idx
      ON "Voucher_Campaigns"
      USING hnsw (embedding vector_cosine_ops);
    `);
    console.log('HNSW index created successfully.');
  } catch (error) {
    console.error('Failed to create HNSW index:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
