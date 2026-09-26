import { nanoid } from 'nanoid';

/** 16-char url-safe id, used as the primary key everywhere. */
export function newId(size = 16): string {
  return nanoid(size);
}

/** Human-facing order number, e.g. QRB-7F3K2M. */
export function orderNumber(): string {
  return `QRB-${nanoid(6).toUpperCase().replace(/[-_]/g, 'X')}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  const slug = slugify(base) || 'shop';
  if (!taken.has(slug)) return slug;
  let index = 2;
  while (taken.has(`${slug}-${index}`)) index += 1;
  return `${slug}-${index}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
