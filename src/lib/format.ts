export function safeFormatDate(value: unknown): string {
  if (value == null || value === '') return '—';
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function safeDateMs(value: unknown): number {
  if (value == null || value === '') return 0;
  const ms = new Date(value as string | number | Date).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function matchesSearch(value: unknown, query: string): boolean {
  return String(value ?? '').toLowerCase().includes(query.toLowerCase());
}
