export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function emptyPagination<T>(limit = 20): PaginatedResponse<T> {
  return { items: [], total: 0, page: 1, limit, totalPages: 0 };
}
