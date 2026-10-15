export const RECENT_SEARCH_LIMIT = 8

export function parseRecentSearches(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  } catch {
    return []
  }
}

export function addRecentSearch(
  current: string[],
  query: string,
  limit = RECENT_SEARCH_LIMIT,
) {
  const cleanQuery = query.trim()
  if (!cleanQuery) return current

  return [
    cleanQuery,
    ...current.filter((item) => item.toLocaleLowerCase() !== cleanQuery.toLocaleLowerCase()),
  ].slice(0, limit)
}
