import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SynonymRow } from './search.types';

export interface ProcessedQuery {
  originalQuery: string;
  normalizedQuery: string;
  expandedTerms: string[];
  categoryIntent: string[];
  tsQuery: string;
}

@Injectable()
export class QueryPreprocessor {
  private cache = new Map<string, { synonyms: SynonymRow[]; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_EXPANSIONS = 10;

  constructor(private readonly prisma: PrismaService) {}

  async process(rawQuery: string): Promise<ProcessedQuery> {
    const normalized = this.normalize(rawQuery);
    if (!normalized) {
       return {
         originalQuery: rawQuery,
         normalizedQuery: '',
         expandedTerms: [],
         categoryIntent: [],
         tsQuery: ''
       };
    }
    const synonyms = await this.fetchSynonyms(normalized);
    const expandedTerms = this.buildExpandedTerms(normalized, synonyms);
    const categoryIntent = this.extractCategories(synonyms);
    const tsQuery = this.buildTsQuery(expandedTerms);

    return {
      originalQuery: rawQuery,
      normalizedQuery: normalized,
      expandedTerms,
      categoryIntent,
      tsQuery,
    };
  }

  // Clear cache manually when admin adds/edits synonyms
  invalidateCache() {
    this.cache.clear();
  }

  private normalize(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async fetchSynonyms(keyword: string): Promise<SynonymRow[]> {
    const now = Date.now();
    const cached = this.cache.get(keyword);
    if (cached && cached.expiresAt > now) {
      return cached.synonyms;
    }

    const rows = await this.prisma.searchSynonym.findMany({
      where: { keyword },
      orderBy: { weight: 'desc' },
      take: this.MAX_EXPANSIONS,
    });

    const mapped: SynonymRow[] = rows.map(r => ({
      expandTo: r.expandTo,
      categoryTag: r.categoryTag,
      weight: r.weight,
    }));

    this.cache.set(keyword, {
      synonyms: mapped,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return mapped;
  }

  private buildExpandedTerms(normalized: string, synonyms: SynonymRow[]): string[] {
    const terms = new Set<string>([normalized]);
    let count = 1;
    for (const row of synonyms) {
      if (count >= this.MAX_EXPANSIONS) break;
      terms.add(row.expandTo);
      count++;
    }
    return Array.from(terms);
  }

  private extractCategories(synonyms: SynonymRow[]): string[] {
    const categories = new Set<string>();
    for (const row of synonyms) {
      if (row.categoryTag) {
        categories.add(row.categoryTag);
      }
    }
    return Array.from(categories);
  }

  private buildTsQuery(terms: string[]): string {
    if (terms.length === 0) return '';
    return terms
      .map(t => {
         const ands = t.split(' ').map(w => w.trim()).filter(w => w.length > 0).join(' & ');
         return `(${ands})`;
      })
      .filter(t => t !== '()')
      .join(' | ');
  }
}
