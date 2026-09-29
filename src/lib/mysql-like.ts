export function escapeMySqlLike(value: string): string {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

export function toMySqlContainsPattern(value: string): string {
  return `%${escapeMySqlLike(value)}%`;
}

export function toMySqlStartsWithPattern(value: string): string {
  return `${escapeMySqlLike(value)}%`;
}
