import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('Extension vector is available/created.');
    const ext = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`;
    console.log('Vector Extension:', ext);
  } catch (e) {
    console.error('Error creating vector extension:', e);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
