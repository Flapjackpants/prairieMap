import { describe, expect, it } from 'vitest';
import {
  computeTimelineDateTitles,
  formatTimelineDateTitle,
  parseTimelineDateTitle,
} from './timelineDates';

describe('formatTimelineDateTitle', () => {
  it('formats like 6/24/25, 9:12pm', () => {
    const date = new Date(2025, 5, 24, 21, 12);
    expect(formatTimelineDateTitle(date)).toBe('6/24/25, 9:12pm');
  });

  it('formats midnight and noon', () => {
    expect(formatTimelineDateTitle(new Date(2025, 0, 1, 0, 0))).toBe('1/1/25, 12:00am');
    expect(formatTimelineDateTitle(new Date(2025, 0, 1, 12, 0))).toBe('1/1/25, 12:00pm');
  });
});

describe('parseTimelineDateTitle', () => {
  it('round-trips formatted titles', () => {
    const original = new Date(2025, 5, 24, 21, 12);
    const parsed = parseTimelineDateTitle(formatTimelineDateTitle(original));
    expect(parsed?.getTime()).toBe(original.getTime());
  });
});

describe('computeTimelineDateTitles', () => {
  it('increments every N frames', () => {
    const start = new Date(2025, 5, 24, 21, 12);
    const titles = computeTimelineDateTitles(13, {
      startAt: start,
      framesPerStep: 6,
      minutesPerStep: 1,
    });
    expect(titles[0]).toBe('6/24/25, 9:12pm');
    expect(titles[5]).toBe('6/24/25, 9:12pm');
    expect(titles[6]).toBe('6/24/25, 9:13pm');
    expect(titles[12]).toBe('6/24/25, 9:14pm');
  });
});
