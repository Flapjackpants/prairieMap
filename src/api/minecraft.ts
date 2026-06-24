import { apiFetch } from './client';
import type { PlayerSnapshot, ServerSnapshot } from '../types/minecraft';

function encodeBaseUrl(baseUrl: string): string {
  return encodeURIComponent(baseUrl);
}

export async function checkHealth(baseUrl: string): Promise<{ status: string }> {
  return apiFetch(`/minecraft/health?base_url=${encodeBaseUrl(baseUrl)}`);
}

export async function fetchPlayers(baseUrl: string): Promise<ServerSnapshot> {
  return apiFetch(`/minecraft/players?base_url=${encodeBaseUrl(baseUrl)}`);
}

export async function fetchPlayer(
  baseUrl: string,
  uuid: string,
): Promise<PlayerSnapshot> {
  return apiFetch(`/minecraft/players/${uuid}?base_url=${encodeBaseUrl(baseUrl)}`);
}

export function buildRecordStreamUrl(baseUrl: string): string {
  return `/api/minecraft/players/record?base_url=${encodeBaseUrl(baseUrl)}`;
}

export function snapshotsToPlayerList(snapshot: ServerSnapshot): PlayerSnapshot[] {
  return Object.values(snapshot.players);
}
