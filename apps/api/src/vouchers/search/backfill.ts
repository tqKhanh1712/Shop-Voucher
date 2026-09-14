import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function backfillSearchVectors() {
  console.log('Starting search_vector backfill...');
  
  let processed = 0;
  const batchSize = 1000;
  let hasMore = true;
  let lastId: string | undefined = undefined;

  while (hasMore) {
    const campaigns = (await prisma.voucherCampaign.findMany({
      take: batchSize,
      ...(lastId && { skip: 1, cursor: { campaignId: lastId } }),
      orderBy: { campaignId: 'asc' },
      select: { campaignId: true, title: true, description: true }
    })) as any[];

    if (campaigns.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch via Raw SQL UPDATE to trigger the vector build logic
    for (const campaign of campaigns) {
      // In PostgreSQL, updating a row with the same values still fires the trigger
      // BUT we added a WHEN clause in our trigger:
      // WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description)
      // So to force the trigger to fire, we either need to bypass the WHEN clause or run a manual UPDATE that constructs the vector directly.
      // Since we want this script to work robustly without firing trigger unnecessarily, we manually build it:
      await prisma.$executeRaw`
        UPDATE "Voucher_Campaigns" 
        SET search_vector = 
          setweight(to_tsvector('simple', immutable_unaccent(coalesce(title, ''))), 'A') || 
          setweight(to_tsvector('simple', immutable_unaccent(coalesce(description, ''))), 'B')
        WHERE campaign_id = ${campaign.campaignId}::uuid
      `;
    }

    processed += campaigns.length;
    lastId = campaigns[campaigns.length - 1].campaignId;
    console.log(`Processed ${processed} campaigns...`);
  }

  console.log('Finished search_vector backfill.');
}

export async function seedSynonyms() {
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
    // Check if exists
    const exists = await prisma.searchSynonym.findFirst({
      where: { keyword: item.keyword, expandTo: item.expandTo }
    });
    if (!exists) {
      await prisma.searchSynonym.create({ data: item });
    }
  }
  console.log('Finished seeding synonyms.');
}

async function main() {
  await seedSynonyms();
  await backfillSearchVectors();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
