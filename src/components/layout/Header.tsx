import { Crosshair, Download, FolderOpen, Upload } from 'lucide-react';
import { useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import type { ProjectExport } from '../../types/project';

export function Header() {
  const { loadFolder, exportProject, importProject } = useProject();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const pendingImportRef = useRef<ProjectExport | null>(null);

  const handleLoadFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    if (pendingImportRef.current) {
      importProject(pendingImportRef.current, Array.from(files));
      pendingImportRef.current = null;
    } else {
      loadFolder(files);
    }
    e.target.value = '';
  };

  const handleExportJson = () => {
    const data = exportProject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prairiemap-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ProjectExport;
      pendingImportRef.current = data;
      alert('Project JSON loaded. Select the same image folder to restore.');
      folderInputRef.current?.click();
    } catch {
      alert('Invalid project JSON file.');
    }
    e.target.value = '';
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface-raised px-4">
      <div className="flex items-center gap-2.5">
        <Crosshair className="h-5 w-5 text-accent-cyan" strokeWidth={2} />
        <h1 className="text-lg font-bold tracking-widest text-text-primary uppercase">
          Prairie<span className="text-accent-cyan">Map</span>
        </h1>
        <span className="hidden text-xs text-text-muted sm:inline">War Visualization Command</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          directory=""
          multiple
          accept="image/*"
          onChange={handleLoadFolder}
        />
        <input
          ref={jsonInputRef}
          type="file"
          className="hidden"
          accept=".json,application/json"
          onChange={handleImportJson}
        />

        <button
          type="button"
          className="btn-primary flex items-center gap-1.5"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderOpen className="h-4 w-4" />
          Load Folder
        </button>
        <button type="button" className="btn-icon" title="Import JSON" onClick={() => jsonInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
        </button>
        <button type="button" className="btn-icon" title="Export JSON" onClick={handleExportJson}>
          <Download className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
