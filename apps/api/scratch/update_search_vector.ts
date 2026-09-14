import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  
  console.log('Seeding synonyms...');
  const data = [
    { keyword: 'nước uống', expandTo: 'coffee', categoryTag: 'beverage', weight: 3 },
    { keyword: 'nước uống', expandTo: 'trà', categoryTag: 'beverage', weight: 3 },
    { keyword: 'nước uống', expandTo: 'nước ép', categoryTag: 'beverage', weight: 3 },
    { keyword: 'nước uống', expandTo: 'sinh tố', categoryTag: 'beverage', weight: 3 },
    { keyword: 'nước uống', expandTo: 'trà sữa', categoryTag: 'beverage', weight: 3 },
    { keyword: 'đồ uống', expandTo: 'coffee', categoryTag: 'beverage', weight: 3 },
    { keyword: 'đồ uống', expandTo: 'trà', categoryTag: 'beverage', weight: 3 },
    { keyword: 'cà phê', expandTo: 'coffee', categoryTag: 'beverage', weight: 3 },
    { keyword: 'cà phê', expandTo: 'cafe', categoryTag: 'beverage', weight: 2 },
    { keyword: 'cafe', expandTo: 'coffee', categoryTag: 'beverage', weight: 3 },
    { keyword: 'cafe', expandTo: 'cà phê', categoryTag: 'beverage', weight: 3 },
    { keyword: 'trà sữa', expandTo: 'milk tea', categoryTag: 'beverage', weight: 3 },
    { keyword: 'trà sữa', expandTo: 'bubble tea', categoryTag: 'beverage', weight: 2 },
    { keyword: 'công viên nước', expandTo: 'water park', categoryTag: 'water_park', weight: 3 },
    { keyword: 'công viên nước', expandTo: 'hồ bơi', categoryTag: 'water_park', weight: 2 },
    { keyword: 'ăn uống', expandTo: 'nhà hàng', categoryTag: 'food', weight: 3 },
    { keyword: 'buffet', expandTo: 'tiệc buffet', categoryTag: 'food', weight: 3 },
    { keyword: 'làm đẹp', expandTo: 'spa', categoryTag: 'beauty', weight: 3 },
  ];

  for (const item of data) {
    const exists = await prisma.searchSynonym.findFirst({
      where: { keyword: item.keyword, expandTo: item.expandTo }
    });
    if (!exists) {
      await prisma.searchSynonym.create({ data: item });
    }
  }

  console.log('Updating search_vectors...');
  const res = await prisma.$executeRaw`
    UPDATE "Voucher_Campaigns" 
    SET search_vector = 
      setweight(to_tsvector('simple', immutable_unaccent(coalesce(title, ''))), 'A') || 
      setweight(to_tsvector('simple', immutable_unaccent(coalesce(description, ''))), 'B')
  `;
  console.log('Updated search vectors for:', res);

  await prisma.$disconnect();
}
main().catch(console.error);
