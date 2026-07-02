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

/** Word-wrap a single line to a max character width. */
export function wrapLineToWidth(line: string, maxCharsPerLine: number): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [''];
  if (trimmed.length <= maxCharsPerLine) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxCharsPerLine) {
      let start = 0;
      while (start < word.length) {
        lines.push(word.slice(start, start + maxCharsPerLine));
        start += maxCharsPerLine;
      }
      current = '';
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapTextToWidth(text: string, maxCharsPerLine: number): string {
  if (!text.trim()) return '';
  return text
    .split('\n')
    .flatMap((line) => wrapLineToWidth(line, maxCharsPerLine))
    .join('\n');
}

/** TNO-style `> ` bullets with automatic wrapping for export dossier. */
export function prepareDossierEventLog(raw: string, maxCharsPerLine: number): string {
  const stripped = formatEventLogForExport(raw);
  if (!stripped) return '';

  const prefixed = stripped
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('>') ? line : `> ${line}`));

  return wrapTextToWidth(prefixed.join('\n'), maxCharsPerLine);
}

/** Rough line count for wrapped export text. */
export function estimateEventLogLines(text: string, charsPerLine = 28): number {
  if (!text.trim()) return 0;
  return wrapTextToWidth(text, charsPerLine).split('\n').length;
}
