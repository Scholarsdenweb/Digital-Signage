import { config } from '../config.js';
import type { PairRequestInput, PlaylistDto, ScreenConfigDto } from '@dsm/shared';

async function req<T>(path: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as object) };
  if (token) headers.Authorization = `Device ${token}`;
  const res = await fetch(`${config.apiUrl}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body?.error?.message ?? res.statusText), {
      status: res.status,
      code: body?.error?.code,
    });
  }
  return res.json() as Promise<T>;
}

export const deviceApi = {
  createPairRequest: (input: PairRequestInput) =>
    req<{ pairingCode: string; expiresAt: string }>('/devices/pair-request', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  pairStatus: (code: string) =>
    req<{ status: 'pending' | 'paired'; deviceToken?: string; screenId?: string }>(
      `/devices/pair-status/${code}`,
    ),

  authenticate: (deviceToken: string) =>
    req<{ ok: boolean; config: ScreenConfigDto }>('/devices/authenticate', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    }),

  getConfig: (token: string) => req<ScreenConfigDto>('/devices/me/config', {}, token),
  getPlaylist: (token: string) => req<PlaylistDto>('/devices/me/playlist', {}, token),
  heartbeat: (token: string, body: object) =>
    req<{ ok: boolean }>('/devices/me/heartbeat', { method: 'POST', body: JSON.stringify(body) }, token),
  getCommands: (token: string) => req<any[]>('/devices/me/commands', {}, token),
  ackCommand: (token: string, id: string) =>
    req<{ ok: boolean }>(`/devices/me/commands/${id}/ack`, { method: 'POST' }, token),
};
