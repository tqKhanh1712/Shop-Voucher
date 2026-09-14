import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchResult } from './search.types';
import { ProcessedQuery } from './query-preprocessor';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProducts(
    processed: ProcessedQuery,
    limit: number,
    offset: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const { normalizedQuery, tsQuery, categoryIntent } = processed;
    
    // If empty query, we might want to return recent vouchers or something else,
    // but for search, we'll just return empty or perform a basic fetch.
    if (!normalizedQuery) {
      return { results: [], total: 0 };
    }

    const hasCategoryIntent = categoryIntent.length > 0;

    // We use Prisma.sql for safety against SQL injection
    // We normalize ts_rank using cd with flag 32 (length normalization)
    const sqlQuery = Prisma.sql`
      WITH ranked AS (
        SELECT 
          vc.campaign_id AS id,
          vc.title AS name,
          vc.description,
          (
            SELECT vc_cat.name_vi
            FROM "Voucher_Categories" vc_cat
            JOIN "Campaign_Categories" cc ON cc.category_id = vc_cat.category_id
            WHERE cc.campaign_id = vc.campaign_id AND cc.is_primary = true
            LIMIT 1
          ) AS category_name,
          COALESCE(ts_rank_cd(vc.search_vector, to_tsquery('simple', unaccent(${tsQuery})), 32), 0) AS fts_score,
          COALESCE(similarity(vc.title, ${normalizedQuery}), 0) AS fuzzy_score
        FROM "Voucher_Campaigns" vc
        WHERE vc.status = 'APPROVED'
          AND (
            vc.search_vector @@ to_tsquery('simple', unaccent(${tsQuery}))
            OR similarity(vc.title, ${normalizedQuery}) > 0.3
          )
          AND (
            ${hasCategoryIntent === false}
            OR EXISTS (
              SELECT 1 FROM "Campaign_Categories" cc
              JOIN "Voucher_Categories" vcat ON cc.category_id = vcat.category_id
              WHERE cc.campaign_id = vc.campaign_id
              AND vcat.code = ANY(ARRAY[${Prisma.join(categoryIntent)}]::text[])
            )
          )
      )
      SELECT 
        id, 
        name, 
        description, 
        category_name AS "categoryName",
        fts_score AS "ftsScore",
        fuzzy_score AS "fuzzyScore",
        (fts_score * 0.7 + fuzzy_score * 0.3) AS score,
        COUNT(*) OVER () AS total_count
      FROM ranked
      ORDER BY score DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await this.prisma.$queryRaw<any[]>(sqlQuery);
    
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    
    const results: SearchResult[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      categoryName: row.categoryName,
      score: Number(row.score),
      ftsScore: Number(row.ftsScore),
      fuzzyScore: Number(row.fuzzyScore),
    }));

    return { results, total };
  }
}
