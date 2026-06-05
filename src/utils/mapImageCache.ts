const MAX_CACHED = 8;

interface Entry {
  objectUrl: string;
  file: File;
}

const entries = new Map<string, Entry>();
const order: string[] = [];

function removeFromOrder(filename: string): void {
  const i = order.indexOf(filename);
  if (i >= 0) order.splice(i, 1);
}

function bump(filename: string): void {
  removeFromOrder(filename);
  order.push(filename);
}

function evictOldest(): void {
  while (order.length > MAX_CACHED) {
    const oldest = order.shift();
    if (!oldest) break;
    const entry = entries.get(oldest);
    if (entry) {
      URL.revokeObjectURL(entry.objectUrl);
      entries.delete(oldest);
    }
  }
}

/** Get or create a full-resolution object URL for a map file. */
export function acquire(filename: string, file: File): string {
  const existing = entries.get(filename);
  if (existing) {
    if (existing.file !== file) {
      URL.revokeObjectURL(existing.objectUrl);
      const objectUrl = URL.createObjectURL(file);
      entries.set(filename, { objectUrl, file });
      bump(filename);
      evictOldest();
      return objectUrl;
    }
    bump(filename);
    return existing.objectUrl;
  }
  const objectUrl = URL.createObjectURL(file);
  entries.set(filename, { objectUrl, file });
  bump(filename);
  evictOldest();
  return objectUrl;
}

/** Mark filename as recently used without creating a URL. */
export function touch(filename: string): void {
  if (entries.has(filename)) bump(filename);
}

export function getIfCached(filename: string): string | null {
  const entry = entries.get(filename);
  if (entry) {
    bump(filename);
    return entry.objectUrl;
  }
  return null;
}

export function releaseAll(): void {
  for (const entry of entries.values()) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  entries.clear();
  order.length = 0;
}

/** @internal Test helper */
export function cacheSize(): number {
  return entries.size;
}

/** @internal Test helper */
export function cacheOrder(): string[] {
  return [...order];
}
