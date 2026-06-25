import { Check, Circle, Crosshair, Download, Radio, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMinecraftRecording } from '../../context/MinecraftRecordingContext';
import type { CalibrationPhase, RecordingImportMode } from '../../context/MinecraftRecordingContext';
import { MINECRAFT_API_TARGETS, type MinecraftApiTarget } from '../../types/minecraft';
import { isBlankAssetKey } from '../../types/project';
import { displayFilename } from '../../utils/projectHelpers';
import { useProject } from '../../context/ProjectContext';

function formatCoord(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

function phaseLabel(phase: CalibrationPhase): string {
  switch (phase) {
    case 'needGameA':
      return 'Capture in-game position A';
    case 'needMapA':
      return 'Click point A on the map';
    case 'needGameB':
      return 'Capture in-game position B';
    case 'needMapB':
      return 'Click point B on the map';
    case 'ready':
      return 'Calibration complete — start recording';
  }
}

function phaseButtonLabel(phase: CalibrationPhase): string {
  switch (phase) {
    case 'needGameA':
      return 'Capture position A';
    case 'needMapA':
      return 'Click map for A';
    case 'needGameB':
      return 'Capture position B';
    case 'needMapB':
      return 'Click map for B';
    case 'ready':
      return 'Continue to recording';
  }
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 font-mono text-[9px]">
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
          done ? 'border-accent-emerald bg-accent-emerald/20 text-accent-emerald' : 'border-metal-shadow text-text-muted'
        }`}
        aria-hidden
      >
        {done && <Check className="h-2.5 w-2.5" />}
      </span>
      <span className={done ? 'text-accent-emerald' : 'text-text-muted'}>{label}</span>
    </li>
  );
}

export function MinecraftRecordModal() {
  const { state } = useProject();
  const rec = useMinecraftRecording();
  const filenames = Object.keys(state.assets).filter((f) => !isBlankAssetKey(f));
  const pickingMap = rec.awaitingMapClick !== null;
  const docked = rec.step === 'calibrate' || rec.step === 'record';
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<RecordingImportMode>('timeline');

  useEffect(() => {
    if (!rec.modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !rec.isRecording && !pickingMap) rec.closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rec.modalOpen, rec.isRecording, pickingMap, rec.closeModal]);

  if (!rec.modalOpen) return null;

  const hasGameA = rec.calibrationA.gameX !== undefined && rec.calibrationA.gameZ !== undefined;
  const hasMapA = rec.calibrationA.mapX !== undefined && rec.calibrationA.mapY !== undefined;
  const hasGameB = rec.calibrationB.gameX !== undefined && rec.calibrationB.gameZ !== undefined;
  const hasMapB = rec.calibrationB.mapX !== undefined && rec.calibrationB.mapY !== undefined;

  const pickGameX =
    rec.awaitingMapClick === 'A' ? rec.calibrationA.gameX : rec.calibrationB.gameX;
  const pickGameZ =
    rec.awaitingMapClick === 'A' ? rec.calibrationA.gameZ : rec.calibrationB.gameZ;

  const panel = (
    <div
      className={`panel flex max-h-[90vh] flex-col shadow-2xl ${
        docked ? 'w-[min(100%,22rem)]' : 'w-full max-w-lg'
      } ${pickingMap ? 'pointer-events-none opacity-40' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="minecraft-record-title"
    >
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
            onClick={rec.closeModal}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {rec.step === 'connect' && (
          <div className="space-y-3">
            <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
              API target
              <select
                className="input-field mt-1 w-full font-mono text-xs"
                value={rec.apiTarget}
                onChange={(e) => rec.setApiTarget(e.target.value as MinecraftApiTarget)}
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
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={rec.isTestingConnection}
              onClick={() => void rec.testConnection()}
            >
              {rec.isTestingConnection ? 'Testing…' : 'Test connection'}
            </button>
            {rec.connectionOk && (
              <p className="font-mono text-[9px] text-accent-emerald">
                Connected · {rec.players.length} players online
              </p>
            )}
            {rec.connectionError && (
              <p className="border border-accent-crimson/40 bg-accent-crimson/10 px-2 py-1.5 font-mono text-[9px] text-accent-crimson">
                {rec.connectionError}
              </p>
            )}
          </div>
        )}

        {rec.step === 'calibrate' && (
          <div className="space-y-3">
            <p className="font-mono text-[9px] leading-relaxed text-text-muted">
              Stand at a known spot in-game, capture your position, then click that same spot on the map. Repeat
              for a second point at least 1 block away.
            </p>

            <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Your player
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

            <ul className="space-y-1.5 rounded border border-metal-shadow bg-metal-deep/40 px-3 py-2">
              <CheckItem done={hasGameA} label={`A — in-game (${formatCoord(rec.calibrationA.gameX)}, ${formatCoord(rec.calibrationA.gameZ)})`} />
              <CheckItem done={hasMapA} label={`A — map (${formatCoord(rec.calibrationA.mapX)}, ${formatCoord(rec.calibrationA.mapY)})`} />
              <CheckItem done={hasGameB} label={`B — in-game (${formatCoord(rec.calibrationB.gameX)}, ${formatCoord(rec.calibrationB.gameZ)})`} />
              <CheckItem done={hasMapB} label={`B — map (${formatCoord(rec.calibrationB.mapX)}, ${formatCoord(rec.calibrationB.mapY)})`} />
            </ul>

            <p className="font-mono text-[9px] text-accent-orange">{phaseLabel(rec.calibrationPhase)}</p>

            <button
              type="button"
              className="btn-primary w-full"
              disabled={!rec.anchorUuid && rec.calibrationPhase !== 'ready'}
              onClick={() => rec.runCalibrationAction()}
            >
              {phaseButtonLabel(rec.calibrationPhase)}
            </button>

            {(hasGameA || hasGameB) && (
              <button type="button" className="btn-ghost w-full text-[9px]" onClick={rec.resetCalibration}>
                Reset calibration
              </button>
            )}

            {rec.calibrationPhase === 'ready' && (
              <div className="border border-accent-cyan/30 bg-accent-cyan/5 px-2 py-2 font-mono text-[8px] text-text-muted">
                <p className="text-accent-cyan">Optional: division marker appearance</p>
                <label className="mt-2 block tracking-widest uppercase">
                  Source image
                  <select
                    className="input-field mt-0.5 w-full font-mono text-xs normal-case"
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
              </div>
            )}
          </div>
        )}

        {rec.step === 'record' && (
          <div className="space-y-3">
            <p className="font-mono text-[9px] leading-relaxed text-text-muted">
              Capture player positions from the Minecraft API into a JSON file. Import that file later to
              place divisions on the map — no timeline changes happen during recording.
            </p>
            {rec.calibrationComplete && (
              <div className="border border-accent-cyan/30 bg-accent-cyan/5 px-2 py-2 font-mono text-[8px] text-text-muted">
                <p className="text-accent-cyan">Calibration</p>
                <p>
                  A: ({formatCoord(rec.calibrationA.gameX)}, {formatCoord(rec.calibrationA.gameZ)}) → (
                  {formatCoord(rec.calibrationA.mapX)}, {formatCoord(rec.calibrationA.mapY)})
                </p>
                <p>
                  B: ({formatCoord(rec.calibrationB.gameX)}, {formatCoord(rec.calibrationB.gameZ)}) → (
                  {formatCoord(rec.calibrationB.mapX)}, {formatCoord(rec.calibrationB.mapY)})
                </p>
              </div>
            )}
            <p className="font-mono text-[9px] text-text-muted">
              Target: {MINECRAFT_API_TARGETS[rec.apiTarget].label} · World: {rec.anchorWorld || '—'}
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[10px] tabular-nums">
              <span className="text-text-muted">Snapshots</span>
              <span className="text-accent-cyan">{rec.framesRecorded}</span>
              <span className="text-text-muted">Players tracked</span>
              <span className="text-accent-cyan">{rec.lastPlayerCount}</span>
              <span className="text-text-muted">Transport</span>
              <span className="text-accent-cyan uppercase">{rec.recordingTransport}</span>
            </div>
            {rec.isRecording && (
              <p className="flex items-center gap-2 font-mono text-[9px] text-accent-crimson">
                <span className="led led-on" aria-hidden />
                Capturing via {rec.recordingTransport === 'poll' ? 'polling' : 'SSE'} — click Stop when done.
              </p>
            )}
            {rec.streamEnded && !rec.isRecording && (
              <p className="font-mono text-[9px] text-accent-orange">Capture ended.</p>
            )}
            {rec.capturedSession && !rec.isRecording && (
              <p className="font-mono text-[9px] text-accent-emerald">
                JSON saved ({rec.capturedSession.snapshots.length} snapshots).
              </p>
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
                    disabled={!rec.apiReady || !rec.calibrationComplete}
                    onClick={() => rec.startRecording()}
                  >
                    <Circle className="h-3.5 w-3.5 fill-current" />
                    {rec.streamEnded ? 'Capture again' : 'Start capture'}
                  </button>
                  {rec.capturedSession && (
                    <button
                      type="button"
                      className="btn-secondary flex items-center gap-1"
                      onClick={rec.downloadCapturedSession}
                    >
                      <Download className="h-3.5 w-3.5" />
                      JSON
                    </button>
                  )}
                  {rec.streamEnded && (
                    <button type="button" className="btn-secondary" onClick={rec.resetRecordingStats}>
                      Reset
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className="btn-secondary w-full" onClick={() => rec.stopRecording()}>
                  Stop capture
                </button>
              )}
            </div>

            <div className="border-t border-metal-shadow pt-3">
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
                Import recording JSON
              </p>
              <label className="mt-2 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                Apply as
                <select
                  className="input-field mt-1 w-full font-mono text-xs normal-case"
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as RecordingImportMode)}
                  disabled={rec.isImporting}
                >
                  <option value="timeline">Timeline frames (one per snapshot)</option>
                  <option value="current-frame">Current frame only (last snapshot)</option>
                </select>
              </label>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void rec.importRecordingFile(file, importMode);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="btn-secondary mt-2 flex w-full items-center justify-center gap-1.5"
                disabled={!rec.apiReady || !rec.hasCurrentFrame || rec.isImporting}
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {rec.isImporting ? 'Importing…' : 'Load JSON file'}
              </button>
              {rec.importError && (
                <p className="mt-2 border border-accent-crimson/40 bg-accent-crimson/10 px-2 py-1.5 font-mono text-[9px] text-accent-crimson">
                  {rec.importError}
                </p>
              )}
            </div>
          </div>
        )}

        {rec.recordingError && rec.step === 'calibrate' && (
          <p className="mt-3 border border-accent-crimson/40 bg-accent-crimson/10 px-2 py-1.5 font-mono text-[9px] text-accent-crimson">
            {rec.recordingError}
          </p>
        )}
      </div>

      <div className="flex shrink-0 justify-between gap-2 border-t border-metal-shadow px-4 py-3">
        {rec.step === 'connect' ? (
          <button type="button" className="btn-ghost" disabled={rec.isRecording} onClick={rec.closeModal}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            disabled={rec.isRecording}
            onClick={() => rec.setStep(rec.step === 'record' ? 'calibrate' : 'connect')}
          >
            Back
          </button>
        )}
        {rec.step === 'connect' && rec.connectionOk ? (
          <button type="button" className="btn-primary" onClick={() => rec.setStep('calibrate')}>
            Calibrate
          </button>
        ) : rec.step === 'calibrate' && rec.calibrationPhase === 'ready' ? (
          <button type="button" className="btn-primary" onClick={() => rec.setStep('record')}>
            Record
          </button>
        ) : rec.step === 'record' ? (
          <button type="button" className="btn-ghost" disabled={rec.isRecording} onClick={rec.closeModal}>
            Close
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );

  const pickBanner = pickingMap ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4">
      <div className="pointer-events-auto panel max-w-lg border border-accent-orange/50 neon-glow-orange shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <Crosshair className="h-4 w-4 shrink-0 text-accent-orange" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold tracking-wider text-accent-orange uppercase">
              Click map point {rec.awaitingMapClick}
            </p>
            <p className="font-mono text-[9px] text-text-muted">
              In-game ({formatCoord(pickGameX)}, {formatCoord(pickGameZ)}) — click the matching spot on the
              map.
            </p>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const content = docked ? (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex items-start p-4 pt-16">
      <div className="pointer-events-auto">{panel}</div>
      {pickBanner}
    </div>
  ) : (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (!rec.isRecording && e.target === e.currentTarget) rec.closeModal();
      }}
    >
      {panel}
      {pickBanner}
    </div>
  );

  return createPortal(content, document.body);
}
