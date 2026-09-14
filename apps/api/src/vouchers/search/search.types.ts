export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  sessionId?: string;
}

export interface SearchResult {
  id: string; // our schema uses UUID for campaignId
  name: string; // title
  description: string;
  categoryName: string;
  score: number;
  ftsScore: number;
  fuzzyScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  expandedTerms: string[];
  categoryIntent: string[];
}

export interface SynonymRow {
  expandTo: string;
  categoryTag: string | null;
  weight: number;
}
