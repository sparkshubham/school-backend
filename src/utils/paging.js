export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function parsePaging(req, defaultLimit = PAGE_SIZE) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult(items, total, page, limit) {
  const count = Number(total) || 0;
  return {
    items,
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / limit) || 1),
    limit,
  };
}

export function pageFromRows(items, page, limit, skip) {
  const hasMore = items.length === limit;
  return {
    items,
    page,
    limit,
    hasMore,
    total: skip + items.length + (hasMore ? 1 : 0),
    pages: hasMore ? page + 1 : Math.max(1, page),
  };
}
