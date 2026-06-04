/** Plain text for Konva export (strip minimal markdown noise). */
export function formatEventLogForExport(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** Rough line count for wrapped export text. */
export function estimateEventLogLines(text: string, charsPerLine = 28): number {
  if (!text.trim()) return 0;
  return text.split('\n').reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
}
