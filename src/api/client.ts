const API_BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Proxied API base (JSON routes). */
export function getApiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined;
  return (env ?? API_BASE).replace(/\/$/, '');
}

/**
 * Direct backend URL for large/long requests in dev — bypasses the Vite proxy,
 * which can drop big video uploads or time out during ffmpeg encode.
 */
export function getDirectApiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined;
  if (env) return env.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://127.0.0.1:8000/api';
  return getApiBase();
}

export function formatFetchFailure(error: unknown, context?: string): string {
  const prefix = context ? `${context}: ` : '';
  if (error instanceof NetworkError) return error.message;
  if (error instanceof TypeError) {
    return (
      `${prefix}Could not reach the API server. ` +
      'Run `npm run dev:all` in the project folder and keep both the web and API processes running.'
    );
  }
  if (error instanceof Error) return `${prefix}${error.message}`;
  return `${prefix}Request failed`;
}

async function fetchOrThrow(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new NetworkError(formatFetchFailure(error));
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetchOrThrow(`${getApiBase()}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiHealth(): Promise<{ status: string }> {
  return apiFetch('/health');
}
