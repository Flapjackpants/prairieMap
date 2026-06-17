import { useMapImageUrl } from '../../hooks/useMapImageUrl';
import { useProject } from '../../context/ProjectContext';
import { displayFilename } from '../../utils/projectHelpers';
import { isBlankAssetKey } from '../../types/project';

interface FactionFlagSelectProps {
  factionId: string;
  flagFilename: string | null;
}

function FlagThumbnail({ filename, file }: { filename: string; file: File | null }) {
  const url = useMapImageUrl(filename, file, Boolean(file));
  if (!url) {
    return <div className="h-8 w-11 shrink-0 border border-metal-shadow bg-surface-raised" />;
  }
  return (
    <img
      src={url}
      alt=""
      className="h-8 w-11 shrink-0 border border-metal-shadow object-contain bg-surface-raised"
    />
  );
}

export function FactionFlagSelect({ factionId, flagFilename }: FactionFlagSelectProps) {
  const { state, updateFactionMetadata } = useProject();
  const filenames = Object.keys(state.fileRegistry).filter((f) => !isBlankAssetKey(f));
  const selectedFile = flagFilename ? state.fileRegistry[flagFilename]?.file ?? null : null;

  return (
    <label className="block">
      <span className="mb-0.5 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
        Flag
      </span>
      <div className="flex gap-2">
        {flagFilename ? (
          <FlagThumbnail filename={flagFilename} file={selectedFile} />
        ) : (
          <div className="flex h-8 w-11 shrink-0 items-center justify-center border border-dashed border-metal-shadow bg-surface-raised font-mono text-[8px] text-text-muted">
            —
          </div>
        )}
        <select
          className="input-field min-w-0 flex-1 py-1 text-[10px] normal-case"
          value={flagFilename ?? ''}
          disabled={filenames.length === 0}
          onChange={(e) => {
            void updateFactionMetadata(factionId, {
              flagFilename: e.target.value || null,
            });
          }}
        >
          <option value="">None</option>
          {filenames.map((filename) => (
            <option key={filename} value={filename}>
              {displayFilename(filename)}
            </option>
          ))}
        </select>
      </div>
      {filenames.length === 0 && (
        <p className="mt-1 font-mono text-[8px] tracking-wide text-text-muted uppercase">
          Load map folder to assign flags.
        </p>
      )}
    </label>
  );
}
