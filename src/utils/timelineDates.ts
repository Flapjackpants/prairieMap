/** Display format, e.g. `6/24/25, 9:12pm` */
export function formatTimelineDateTitle(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear() % 100;
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 || 12;
  const minuteStr = String(minutes).padStart(2, '0');
  return `${month}/${day}/${year}, ${hours12}:${minuteStr}${ampm}`;
}

/** Parse `6/24/25, 9:12pm` style titles; returns null when unrecognized. */
export function parseTimelineDateTitle(value: string): Date | null {
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  let hours = Number(match[4]);
  const minutes = Number(match[5]);
  const ampm = match[6].toLowerCase();

  if (year < 100) year += 2000;
  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Naive local datetime for the API (avoids UTC shift from `toISOString()`). */
export function toIsoLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function fromDatetimeLocalValue(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface AutoTimelineDateOptions {
  startAt: Date;
  framesPerStep: number;
  minutesPerStep: number;
}

export function computeTimelineDateTitles(
  frameCount: number,
  options: AutoTimelineDateOptions,
): string[] {
  const { startAt, framesPerStep, minutesPerStep } = options;
  const safeFrames = Math.max(1, Math.floor(framesPerStep));
  const safeMinutes = Math.max(0, minutesPerStep);

  return Array.from({ length: frameCount }, (_, index) => {
    const step = Math.floor(index / safeFrames);
    const date = new Date(startAt.getTime() + step * safeMinutes * 60_000);
    return formatTimelineDateTitle(date);
  });
}
