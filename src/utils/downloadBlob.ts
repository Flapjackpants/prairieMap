export function downloadBlob(blob: Blob, filename: string): void {
  if (blob.size === 0) {
    throw new Error('Download file is empty');
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
};

/** Save with native picker when available; otherwise trigger a download. */
export async function saveBlobToDisk(
  blob: Blob,
  filename: string,
): Promise<'saved' | 'downloaded' | 'cancelled'> {
  if (blob.size === 0) {
    throw new Error('File is empty');
  }

  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker.call(window, {
        suggestedName: filename,
        types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}
