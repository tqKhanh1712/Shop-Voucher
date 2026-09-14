import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchOptions, SearchResponse } from './search.types';
import { QueryPreprocessor } from './query-preprocessor';
import { SearchRepository } from './search.repository';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preprocessor: QueryPreprocessor,
    private readonly repository: SearchRepository
  ) {}

  async search(options: SearchOptions): Promise<SearchResponse> {
    const { query, limit = 20, offset = 0, sessionId } = options;

    // Lớp 1: Tiền xử lý query
    const processed = await this.preprocessor.process(query);

    // Lớp 2 + 3: Tìm kiếm với FTS & Fuzzy + Lọc category
    const { results, total } = await this.repository.findProducts(
      processed,
      limit,
      offset
    );

    // Ghi log bất đồng bộ
    this.logSearch(processed, results.length, sessionId).catch((err) => {
      this.logger.error('Failed to log search query', err);
    });

    return {
      results,
      total,
      query,
      expandedTerms: processed.expandedTerms,
      categoryIntent: processed.categoryIntent,
    };
  }

  private async logSearch(
    processed: Awaited<ReturnType<QueryPreprocessor['process']>>,
    resultCount: number,
    sessionId?: string
  ): Promise<void> {
    await this.prisma.searchLog.create({
      data: {
        queryRaw: processed.originalQuery,
        queryExpanded: processed.expandedTerms,
        categoryIntent: processed.categoryIntent,
        resultCount,
        sessionId: sessionId || null,
      },
    });
  }

  async trackClick(queryRaw: string, productId: string): Promise<void> {
    // Tìm log gần nhất của query này chưa có click (trong 5 phút qua)
    // Prisma không hỗ trợ update limit 1 trực tiếp an toàn, dùng raw query
    await this.prisma.$executeRaw`
      UPDATE search_logs 
      SET clicked_product_id = ${productId}::uuid
      WHERE id = (
        SELECT id FROM search_logs 
        WHERE query_raw = ${queryRaw} 
          AND clicked_product_id IS NULL 
          AND created_at > NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC 
        LIMIT 1
      )
    `;
  }
}
