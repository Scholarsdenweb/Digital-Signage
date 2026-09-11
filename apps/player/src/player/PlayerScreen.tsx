import { useCallback, useEffect, useRef, useState } from 'react';
import { WS, type PlaylistDto, type WsMessage, type PlaylistItemDto } from '@dsm/shared';
import { deviceStore } from '../storage/deviceStore.js';
import { deviceApi } from '../net/deviceApi.js';
import { DeviceSocket } from '../net/socket.js';
import { precacheMedia, cacheStats } from '../storage/mediaCache.js';
import { config } from '../config.js';
import { startFreezeWatchdog } from '../kiosk/kiosk.js';

export function PlayerScreen({ onDisabled }: { onDisabled: () => void }) {
  const token = deviceStore.getToken()!;
  const [playlist, setPlaylist] = useState<PlaylistDto | null>(deviceStore.getPlaylist());
  const [index, setIndex] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [maintenanceUntil, setMaintenanceUntil] = useState<number | null>(null);

  const socketRef = useRef<DeviceSocket | null>(null);
  const advanceTimer = useRef<number>();
  // Latest applied playlist version + a live ref to the playlist (avoids stale closures).
  const versionRef = useRef<number>(deviceStore.getPlaylist()?.version ?? -1);
  const playlistRef = useRef<PlaylistDto | null>(playlist);
  playlistRef.current = playlist;

  const items = playlist?.items ?? [];
  const current: PlaylistItemDto | undefined = items[index];

  // ── Fetch live playlist and apply it IMMEDIATELY when it changed ──
  // (restarts from the first item; unchanged versions are ignored so playback
  // isn't interrupted for nothing). Falls back to cached content when offline.
  const syncPlaylist = useCallback(async () => {
    try {
      const live = await deviceApi.getPlaylist(token);
      deviceStore.setPlaylist(live);
      if (live.version !== versionRef.current) {
        versionRef.current = live.version;
        setPlaylist(live);
        setIndex(0); // apply now, don't wait for the current item to finish
      }
      precacheMedia(live.items.map((i) => i.content.media.url));
    } catch {
      // offline: keep cached playlist
    }
  }, [token]);

  // Stable ref so timers/socket handlers created once at boot call the latest sync.
  const syncRef = useRef(syncPlaylist);
  syncRef.current = syncPlaylist;

  // ── Boot: sync + connect socket + heartbeat + poll + watchdog ──
  useEffect(() => {
    void syncRef.current();

    const socket = new DeviceSocket(token, handleWsMessage, setOnline);
    socket.connect();
    socketRef.current = socket;

    const hb = window.setInterval(sendHeartbeat, 30000);
    void sendHeartbeat();

    // Safety net: re-sync the playlist every 60s so a publish always reaches the
    // screen automatically even if the WebSocket is briefly disconnected.
    const poll = window.setInterval(() => void syncRef.current(), 60000);

    const onlineHandler = () => {
      setOnline(true);
      void syncRef.current(); // resync changed media on reconnect
    };
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    startFreezeWatchdog(() => location.reload());

    return () => {
      socket.close();
      window.clearInterval(hb);
      window.clearInterval(poll);
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Advance timer for images (videos advance on ended) ──
  useEffect(() => {
    window.clearTimeout(advanceTimer.current);
    if (!current || maintenanceUntil) return;
    if (current.content.media.kind === 'IMAGE') {
      advanceTimer.current = window.setTimeout(advance, current.durationSec * 1000);
    }
    return () => window.clearTimeout(advanceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id, maintenanceUntil]);

  // ── Auto-resume from timed maintenance ──
  useEffect(() => {
    if (!maintenanceUntil) return;
    const t = window.setInterval(() => {
      if (Date.now() >= maintenanceUntil) setMaintenanceUntil(null);
    }, 1000);
    return () => window.clearInterval(t);
  }, [maintenanceUntil]);

  function advance() {
    setIndex((i) => {
      const list = playlistRef.current?.items ?? [];
      return list.length ? (i + 1) % list.length : 0;
    });
  }

  function handleWsMessage(msg: WsMessage) {
    switch (msg.event) {
      case WS.PLAYLIST_UPDATED:
      case WS.CONTENT_ADDED:
      case WS.CONTENT_REPLACED:
      case WS.CONTENT_REMOVED:
      case WS.QUEUE_REORDERED:
      case WS.SYNC_CONTENT:
        void syncRef.current(); // apply the published change immediately
        break;
      case WS.ENTER_MAINTENANCE: {
        const until = (msg.data as any)?.until;
        setMaintenanceUntil(until ? new Date(until).getTime() : Number.MAX_SAFE_INTEGER);
        ackCommand(msg);
        break;
      }
      case WS.RESUME_DISPLAY:
        setMaintenanceUntil(null);
        ackCommand(msg);
        break;
      case WS.RELOAD_PLAYER:
      case WS.RESTART_PLAYER:
        ackCommand(msg);
        location.reload();
        break;
      case WS.DEVICE_DISABLED:
      case WS.DEVICE_REVOKED:
        onDisabled();
        break;
    }
  }

  function ackCommand(msg: WsMessage) {
    const commandId = (msg.data as any)?.commandId;
    if (commandId) socketRef.current?.send({ event: WS.COMMAND_ACK, data: { commandId } });
  }

  async function sendHeartbeat() {
    const stats = await cacheStats();
    const cfg = deviceStore.getConfig();
    const payload = {
      status: maintenanceUntil ? 'maintenance' : 'online',
      currentContent: current?.content.title ?? null,
      playerVersion: config.playerVersion,
      resolution: cfg ? `${cfg.width}x${cfg.height}` : undefined,
      orientation: cfg?.orientation,
      online: navigator.onLine,
      ...stats,
    };
    // Prefer socket; fall back to REST if socket down.
    if (socketRef.current?.isConnected()) {
      socketRef.current.send({ event: WS.HEARTBEAT, data: payload });
    } else {
      deviceApi.heartbeat(token, payload).catch(() => {});
    }
  }

  // ── Render ──
  if (maintenanceUntil) return <Maintenance />;
  if (!current) return <Idle online={online} />;

  const media = current.content.media;
  // Per-content fit: CONTAIN shows the whole media (no cropping), COVER fills the
  // screen edge-to-edge (may crop). Chosen by the uploader.
  const fit: React.CSSProperties['objectFit'] = current.content.fitMode === 'CONTAIN' ? 'contain' : 'cover';
  const mediaStyle: React.CSSProperties = { ...MEDIA, objectFit: fit };
  // When the backend is on a different origin (e.g. player on Netlify, API on a VPS),
  // request media with CORS so the service worker can cache it for offline playback.
  // (A no-cors cross-origin response is "opaque" and cannot be stored in the cache.)
  const crossOrigin = isCrossOrigin(media.url) ? 'anonymous' : undefined;
  return (
    <div style={STAGE}>
      {media.kind === 'VIDEO' ? (
        <video
          key={current.id}
          src={media.url}
          crossOrigin={crossOrigin}
          autoPlay
          muted
          playsInline
          onEnded={advance}
          onError={advance}
          style={mediaStyle}
        />
      ) : (
        <img key={current.id} src={media.url} crossOrigin={crossOrigin} onError={advance} style={mediaStyle} alt="" />
      )}
      {!online && <div style={OFFLINE_DOT} title="Offline — playing from cache" />}
    </div>
  );
}

function Maintenance() {
  return (
    <div style={{ ...STAGE, display: 'grid', placeItems: 'center', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Under Maintenance</div>
        <div style={{ color: '#94a3b8', marginTop: 8 }}>Normal display will resume shortly.</div>
      </div>
    </div>
  );
}

function Idle({ online }: { online: boolean }) {
  return (
    <div style={{ ...STAGE, display: 'grid', placeItems: 'center', color: '#475569', fontFamily: 'sans-serif' }}>
      No content scheduled {online ? '' : '(offline)'}
    </div>
  );
}

function isCrossOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

const STAGE: React.CSSProperties = { width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', position: 'relative' };
const MEDIA: React.CSSProperties = { width: '100vw', height: '100vh', objectFit: 'cover', display: 'block' };
const OFFLINE_DOT: React.CSSProperties = { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', opacity: 0.6 };
