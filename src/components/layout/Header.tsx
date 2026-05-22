import { Download, FolderOpen, Globe2, Upload } from 'lucide-react';
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
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-metal-shadow bg-surface-overlay px-3 panel-header">
      <div className="flex items-center gap-3">
        <span className="led led-cyan" aria-hidden />
        <Globe2 className="h-4 w-4 text-accent-cyan" strokeWidth={2} />
        <div className="flex flex-col gap-0">
          <h1 className="font-mono text-sm font-bold tracking-[0.2em] text-text-primary uppercase">
            Prairie<span className="text-accent-cyan">Map</span>
          </h1>
          <span className="hidden font-mono text-[9px] tracking-widest text-text-muted uppercase sm:inline">
            :: v. SQUINGDONNIAH 1.0 ::
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="mr-2 hidden font-mono text-[9px] tracking-widest text-accent-cyan/70 uppercase md:inline">
          SYS_READY
        </span>
        <span className="led led-ok mr-1 hidden md:inline" title="System ready" aria-hidden />

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
          <FolderOpen className="h-3.5 w-3.5" />
          Load
        </button>
        <button type="button" className="btn-icon" title="Import JSON" onClick={() => jsonInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="btn-icon" title="Export JSON" onClick={handleExportJson}>
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
