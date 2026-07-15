export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(query.limit ?? "12"), 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages
  };
}
