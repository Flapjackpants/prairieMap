import { Circle, Radio, X } from 'lucide-react';
import { useEffect } from 'react';
import { useMinecraftRecording } from '../../hooks/useMinecraftRecording';
import { MINECRAFT_API_TARGETS, type MinecraftApiTarget } from '../../types/minecraft';
import { isBlankAssetKey } from '../../types/project';
import { displayFilename } from '../../utils/projectHelpers';
import { useProject } from '../../context/ProjectContext';

interface MinecraftRecordModalProps {
  onClose: () => void;
}

const STEPS = ['connect', 'anchor', 'calibrateA', 'calibrateB', 'settings', 'record'] as const;

function formatCoord(n: number | undefined): string {
  return n === undefined ? '—' : n.toFixed(1);
}

export function MinecraftRecordModal({ onClose }: MinecraftRecordModalProps) {
  const { state } = useProject();
  const rec = useMinecraftRecording();
  const filenames = Object.keys(state.assets).filter((f) => !isBlankAssetKey(f));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !rec.isRecording) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, rec.isRecording]);

  const stepIndex = STEPS.indexOf(rec.step);
  const canGoNext =
    (rec.step === 'connect' && rec.connectionOk) ||
    (rec.step === 'anchor' && rec.anchorUuid) ||
    (rec.step === 'calibrateA' &&
      rec.calibrationA.gameX !== undefined &&
      rec.calibrationA.mapX !== undefined) ||
    (rec.step === 'calibrateB' &&
      rec.calibrationB.gameX !== undefined &&
      rec.calibrationB.mapX !== undefined) ||
    (rec.step === 'settings' && rec.divisionTemplate.sourceFilename);

  const goNext = () => {
    const i = STEPS.indexOf(rec.step);
    if (i < STEPS.length - 1) rec.setStep(STEPS[i + 1]);
  };

  const goBack = () => {
    const i = STEPS.indexOf(rec.step);
    if (i > 0) rec.setStep(STEPS[i - 1]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="minecraft-record-title"
      onMouseDown={(e) => {
        if (!rec.isRecording && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel flex max-h-[90vh] w-full max-w-lg flex-col shadow-2xl">
        <div className="panel-header shrink-0">
          <span className={`led ${rec.isRecording ? 'led-on' : ''}`} aria-hidden />
          <Radio className="h-3.5 w-3.5 text-accent-crimson" />
          <h2 id="minecraft-record-title" className="panel-title">
            [[ Minecraft_Record ]]
          </h2>
          {!rec.isRecording && (
            <button
              type="button"
              className="btn-icon ml-auto h-7 w-7"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="shrink-0 border-b border-metal-shadow px-4 py-2 font-mono text-[9px] tracking-widest text-text-muted uppercase">
          Step {stepIndex + 1}/{STEPS.length}: {rec.step}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {rec.step === 'connect' && (
            <div className="space-y-3">
              <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                API target
                <select
                  className="input-field mt-1 w-full font-mono text-xs"
                  value={rec.apiTarget}
                  onChange={(e) => {
                    rec.setApiTarget(e.target.value as MinecraftApiTarget);
                    rec.setStep('connect');
                  }}
                >
                  {(Object.keys(MINECRAFT_API_TARGETS) as MinecraftApiTarget[]).map((key) => (
                    <option key={key} value={key}>
                      {MINECRAFT_API_TARGETS[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-mono text-[9px] leading-relaxed text-text-muted">
                {MINECRAFT_API_TARGETS[rec.apiTarget].help}
              </p>
              <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                API port
                <input
                  type="number"
                  min={1}
                  max={65535}
                  className="input-field mt-1 w-full font-mono text-xs"
                  value={rec.apiPort}
                  onChange={(e) => rec.setApiPort(Number(e.target.value))}
                />
              </label>
              <p className="font-mono text-[9px] text-accent-cyan">{rec.baseUrl}</p>
              <ul className="list-inside list-disc space-y-1 font-mono text-[8px] leading-relaxed text-text-muted">
                {MINECRAFT_API_TARGETS[rec.apiTarget].helpSteps.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={rec.isTestingConnection}
                onClick={() => void rec.testConnection()}
              >
                {rec.isTestingConnection ? 'Testing…' : 'Test connection'}
              </button>
              {rec.connectionOk && (
                <p className="font-mono text-[9px] text-accent-emerald">Connected · {rec.players.length} players online</p>
              )}
              {rec.connectionError && (
                <p className="border border-accent-crimson/40 bg-accent-crimson/10 px-2 py-1.5 font-mono text-[9px] text-accent-crimson">
                  {rec.connectionError}
                </p>
              )}
            </div>
          )}

          {rec.step === 'anchor' && (
            <div className="space-y-3">
              <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                Anchor player (calibration reference)
                <select
                  className="input-field mt-1 w-full font-mono text-xs"
                  value={rec.anchorUuid}
                  onChange={(e) => rec.onAnchorChange(e.target.value)}
                >
                  {rec.players.map((p) => (
                    <option key={p.uuid} value={p.uuid}>
                      {p.name} ({p.world})
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-mono text-[9px] text-text-muted">
                Walk to each calibration spot as this player, then capture in-game position.
              </p>
            </div>
          )}

          {rec.step === 'calibrateA' && (
            <div className="space-y-3">
              <p className="font-mono text-[9px] text-text-muted">
                Point A: stand at a known location in-game, capture position, then click the matching spot on the map.
              </p>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => void rec.captureGamePosition('A')}
              >
                Capture in-game position A
              </button>
              <p className="font-mono text-[9px] tabular-nums text-accent-cyan">
                Game: {formatCoord(rec.calibrationA.gameX)}, {formatCoord(rec.calibrationA.gameZ)}
              </p>
              {rec.calibrationA.gameX !== undefined && rec.calibrationA.mapX === undefined && (
                <p className="animate-pulse font-mono text-[9px] text-accent-orange">
                  Click map point A…
                </p>
              )}
              <p className="font-mono text-[9px] tabular-nums text-text-muted">
                Map: {formatCoord(rec.calibrationA.mapX)}, {formatCoord(rec.calibrationA.mapY)}
              </p>
            </div>
          )}

          {rec.step === 'calibrateB' && (
            <div className="space-y-3">
              <p className="font-mono text-[9px] text-text-muted">
                Point B: at least 1 block away from A in-game. Capture and click the second map point.
              </p>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => void rec.captureGamePosition('B')}
              >
                Capture in-game position B
              </button>
              <p className="font-mono text-[9px] tabular-nums text-accent-cyan">
                Game: {formatCoord(rec.calibrationB.gameX)}, {formatCoord(rec.calibrationB.gameZ)}
              </p>
              {rec.calibrationB.gameX !== undefined && rec.calibrationB.mapX === undefined && (
                <p className="animate-pulse font-mono text-[9px] text-accent-orange">
                  Click map point B…
                </p>
              )}
              <p className="font-mono text-[9px] tabular-nums text-text-muted">
                Map: {formatCoord(rec.calibrationB.mapX)}, {formatCoord(rec.calibrationB.mapY)}
              </p>
            </div>
          )}

          {rec.step === 'settings' && (
            <div className="space-y-3">
              <p className="font-mono text-[9px] text-text-muted">
                Recording samples at ~1 Hz for up to {rec.maxStreamFrames} seconds per session.
              </p>
              <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                Division source image
                <select
                  className="input-field mt-1 w-full font-mono text-xs"
                  value={rec.divisionTemplate.sourceFilename}
                  onChange={(e) =>
                    rec.setDivisionTemplate((t) => ({ ...t, sourceFilename: e.target.value }))
                  }
                >
                  {filenames.map((f) => (
                    <option key={f} value={f}>
                      {displayFilename(f)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label key={key} className="font-mono text-[8px] tracking-widest text-text-muted uppercase">
                    Crop {key}
                    <input
                      type="number"
                      min={0}
                      className="input-field mt-0.5 w-full font-mono text-xs"
                      value={rec.divisionTemplate.crop[key]}
                      onChange={(e) =>
                        rec.setDivisionTemplate((t) => ({
                          ...t,
                          crop: { ...t.crop, [key]: Number(e.target.value) || 0 },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                Marker size (px)
                <input
                  type="number"
                  min={16}
                  max={256}
                  className="input-field mt-1 w-full font-mono text-xs"
                  value={rec.divisionTemplate.size}
                  onChange={(e) =>
                    rec.setDivisionTemplate((t) => ({
                      ...t,
                      size: Number(e.target.value) || 28,
                    }))
                  }
                />
              </label>
            </div>
          )}

          {rec.step === 'record' && (
            <div className="space-y-3">
              {!rec.apiReady && (
                <p className="text-accent-crimson font-mono text-[9px]">
                  Start the API server: npm run dev:api
                </p>
              )}
              {!rec.hasCurrentFrame && (
                <p className="text-accent-crimson font-mono text-[9px]">Load a map frame first.</p>
              )}
              <p className="font-mono text-[9px] text-text-muted">
                Target: {MINECRAFT_API_TARGETS[rec.apiTarget].label} · World filter: {rec.anchorWorld || '—'}
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px] tabular-nums">
                <span className="text-text-muted">Frames</span>
                <span className="text-accent-cyan">
                  {rec.framesRecorded}/{rec.maxStreamFrames}
                </span>
                <span className="text-text-muted">Players tracked</span>
                <span className="text-accent-cyan">{rec.lastPlayerCount}</span>
                <span className="text-text-muted">Last snapshot</span>
                <span className="text-accent-cyan">
                  {rec.lastSnapshotTime ? new Date(rec.lastSnapshotTime).toLocaleTimeString() : '—'}
                </span>
              </div>
              {rec.isRecording && (
                <p className="flex items-center gap-2 font-mono text-[9px] text-accent-crimson">
                  <span className="led led-on" aria-hidden />
                  Recording…
                </p>
              )}
              {rec.streamEnded && !rec.isRecording && (
                <p className="font-mono text-[9px] text-accent-orange">Stream ended ({rec.maxStreamFrames}s max).</p>
              )}
              {rec.recordingError && (
                <p className="border border-accent-crimson/40 bg-accent-crimson/10 px-2 py-1.5 font-mono text-[9px] text-accent-crimson">
                  {rec.recordingError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {!rec.isRecording ? (
                  <>
                    <button
                      type="button"
                      className="btn-primary flex flex-1 items-center justify-center gap-1.5"
                      disabled={!rec.apiReady || !rec.hasCurrentFrame || !rec.calibrationComplete}
                      onClick={() => rec.startRecording()}
                    >
                      <Circle className="h-3.5 w-3.5 fill-current" />
                      {rec.streamEnded ? 'Record another 30s' : 'Start recording'}
                    </button>
                    {rec.streamEnded && (
                      <button type="button" className="btn-secondary" onClick={() => rec.resetRecordingState()}>
                        Reset stats
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" className="btn-secondary w-full" onClick={() => rec.stopRecording()}>
                    Stop recording
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-between gap-2 border-t border-metal-shadow px-4 py-3">
          <button
            type="button"
            className="btn-ghost"
            disabled={rec.isRecording || stepIndex === 0}
            onClick={goBack}
          >
            Back
          </button>
          {rec.step !== 'record' ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canGoNext || rec.isRecording}
              onClick={goNext}
            >
              Next
            </button>
          ) : (
            <button type="button" className="btn-ghost" disabled={rec.isRecording} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
