import type { PlaylistDto, ScreenConfigDto } from '@dsm/shared';

/**
 * Persists device credential + cached playlist/config in localStorage.
 * (In a native WebView wrapper this is swapped for EncryptedSharedPreferences via
 * a JS bridge — see deviceStore.native placeholder in the APK strategy.)
 */
const KEYS = {
  token: 'dsm.deviceToken',
  config: 'dsm.screenConfig',
  playlist: 'dsm.playlist',
};

export const deviceStore = {
  getToken: () => localStorage.getItem(KEYS.token),
  setToken: (t: string) => localStorage.setItem(KEYS.token, t),
  clearToken: () => localStorage.removeItem(KEYS.token),

  getConfig(): ScreenConfigDto | null {
    const raw = localStorage.getItem(KEYS.config);
    return raw ? (JSON.parse(raw) as ScreenConfigDto) : null;
  },
  setConfig: (c: ScreenConfigDto) => localStorage.setItem(KEYS.config, JSON.stringify(c)),

  getPlaylist(): PlaylistDto | null {
    const raw = localStorage.getItem(KEYS.playlist);
    return raw ? (JSON.parse(raw) as PlaylistDto) : null;
  },
  setPlaylist: (p: PlaylistDto) => localStorage.setItem(KEYS.playlist, JSON.stringify(p)),
};
