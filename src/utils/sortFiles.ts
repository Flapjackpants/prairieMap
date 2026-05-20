const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export function isImageFile(file: File): boolean {
  return IMAGE_EXTENSIONS.test(file.name) || file.type.startsWith('image/');
}

export function sortFilesAlphanumeric(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

export function filterAndSortImageFiles(files: FileList | File[]): File[] {
  const list = Array.from(files).filter(isImageFile);
  return sortFilesAlphanumeric(list);
}
