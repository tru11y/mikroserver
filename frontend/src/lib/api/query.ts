type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

export function toQueryString(params: QueryParams): string {
  const query = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        continue;
      }
      query.set(key, trimmed);
      continue;
    }

    query.set(key, String(rawValue));
  }

  return query.toString();
}

export function withQuery(path: string, params: QueryParams): string {
  const query = toQueryString(params);
  return query ? `${path}?${query}` : path;
}
