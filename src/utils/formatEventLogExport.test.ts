import { describe, expect, it } from 'vitest';
import {
  prepareDossierEventLog,
  wrapLineToWidth,
  wrapTextToWidth,
} from './formatEventLogExport';

describe('wrapTextToWidth', () => {
  it('wraps long lines at word boundaries', () => {
    const wrapped = wrapTextToWidth('Second Northern Expedition Begins', 18);
    expect(wrapped).toBe('Second Northern\nExpedition Begins');
  });
});

describe('prepareDossierEventLog', () => {
  it('prefixes lines and wraps for narrow dossier', () => {
    const raw = 'Second Northern Expedition Begins\nNanjing Is Unprepared For War';
    const out = prepareDossierEventLog(raw, 22);
    expect(out.startsWith('> Second Northern')).toBe(true);
    expect(out).toContain('\n');
    expect(out).toContain('> Nanjing');
  });
});

describe('wrapLineToWidth', () => {
  it('splits very long tokens', () => {
    expect(wrapLineToWidth('abcdefghijklmnop', 6)).toEqual(['abcdef', 'ghijkl', 'mnop']);
  });
});
