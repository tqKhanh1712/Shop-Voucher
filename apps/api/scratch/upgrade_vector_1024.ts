import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

async function upgrade() {
  const prisma = new PrismaService();
  await prisma.$connect();
  
  try {
    console.log('Bắt đầu nâng cấp cấu trúc Database sang vector(1024) cho Cohere...');
    
    // 1. Xoá index HNSW cũ nếu có
    console.log('1. Xóa HNSW Index cũ...');
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS voucher_campaign_embedding_hnsw_idx;`);
    
    // 2. Chuyển đổi cột sang 1024
    console.log('2. Đổi kiểu cột embedding sang vector(1024)...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Voucher_Campaigns" ALTER COLUMN embedding TYPE vector(1024) USING NULL;`);
    
    // 3. Tạo lại HNSW Index
    // Dùng cosine distance (vector_cosine_ops)
    console.log('3. Tạo lại HNSW Index cho vector(1024)...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS voucher_campaign_embedding_hnsw_idx 
      ON "Voucher_Campaigns" 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    
    console.log('Hoàn tất nâng cấp cấu trúc Database!');
  } catch (error) {
    console.error('Lỗi khi nâng cấp DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

upgrade().catch(console.error);
