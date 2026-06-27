export function parseJsonField<T = unknown>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
