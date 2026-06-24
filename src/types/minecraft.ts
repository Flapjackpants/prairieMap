import type { DivisionCropRect } from './project';

export type MinecraftApiTarget = 'localhost' | 'prairie';

export const DEFAULT_MINECRAFT_API_PORT = 8080;

export const MINECRAFT_API_TARGETS: Record<
  MinecraftApiTarget,
  { label: string; host: string; help: string; helpSteps: string[] }
> = {
  localhost: {
    label: 'Localhost',
    host: '127.0.0.1',
    help: 'Client mod must expose an HTTP API on this machine while you are in a world.',
    helpSteps: [
      'Join a world (not the title screen) with the mod loaded.',
      'Confirm the mod started its HTTP server (check mod logs or config for the port).',
      'In Terminal, run: curl http://127.0.0.1:PORT/api/health — expect {"status":"ok"}.',
      'PrairieMap connects via the Python backend on this same machine, not from the browser directly.',
    ],
  },
  prairie: {
    label: 'Prairie SMP',
    host: 'play.prairiesmp.com',
    help: 'Requires the server mod API on a reachable port (8080 is not public today unless admin opens it).',
    helpSteps: [
      'Ask server admin to expose TCP 8080 on PebbleHost, or use an SSH tunnel and pick Localhost instead.',
      'Verify: curl http://play.prairiesmp.com:8080/api/health',
    ],
  },
};

export function resolveMinecraftBaseUrl(target: MinecraftApiTarget, port = DEFAULT_MINECRAFT_API_PORT): string {
  const host = MINECRAFT_API_TARGETS[target].host;
  return `http://${host}:${port}`;
}

export interface ArmorSlots {
  head: string | null;
  chest: string | null;
  legs: string | null;
  feet: string | null;
}

export interface PlayerSnapshot {
  uuid: string;
  name: string;
  world: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  facing: string;
  armor: ArmorSlots;
  timestamp: number;
}

export interface ServerSnapshot {
  timestamp: number;
  players: Record<string, PlayerSnapshot>;
}

export interface DivisionTemplate {
  sourceFilename: string;
  crop: DivisionCropRect;
  size: number;
}

export type MinecraftRecordingPhase =
  | 'idle'
  | 'connect'
  | 'anchor'
  | 'calibrateA'
  | 'calibrateB'
  | 'settings'
  | 'record'
  | 'recording'
  | 'error';

export interface CalibrationPair {
  gameX: number;
  gameZ: number;
  mapX: number;
  mapY: number;
}
