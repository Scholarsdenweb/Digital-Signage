import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLive } from '../api/liveSocket.js';
import { StatusBadge, Spinner } from '../components/ui.js';
import { WS } from '@dsm/shared';
import type { ScreenRow } from './Screens.js';

interface Stats {
  totalScreens: number;
  onlineScreens: number;
  offlineScreens: number;
  activeHandlers: number;
  publishedContent: number;
  contentInHistory: number;
  todaysBirthdays: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [screens, setScreens] = useState<ScreenRow[] | null>(null);

  const load = () => {
    api.get<Stats>('/dashboard/stats').then(setStats).catch(() => {});
    api.get<ScreenRow[]>('/dashboard/screens').then(setScreens).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  // Live: refresh stats + screen table when the backend reports activity.
  const debounce = useRef<number>();
  useLive((msg) => {
    if (
      msg.event === WS.HEARTBEAT_UPDATE ||
      msg.event === WS.SCREEN_STATUS_CHANGED ||
      msg.event === WS.PLAYLIST_UPDATED
    ) {
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(load, 500);
    }
  });

  const cards = stats
    ? [
        { label: 'Total Screens', value: stats.totalScreens },
        { label: 'Online', value: stats.onlineScreens, color: '#16a34a' },
        { label: 'Offline', value: stats.offlineScreens, color: '#64748b' },
        { label: 'Active Handlers', value: stats.activeHandlers },
        { label: 'Published Content', value: stats.publishedContent },
        { label: 'In History', value: stats.contentInHistory },
        { label: "Today's Birthdays", value: stats.todaysBirthdays, color: '#f59e0b' },
      ]
    : [];

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>Dashboard</h1>
      {!stats ? (
        <Spinner />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
          {cards.map((c) => (
            <div className="card" key={c.label}>
              <div className="muted" style={{ fontSize: 13 }}>{c.label}</div>
              <div className="stat" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Screens</h3>
        {!screens ? (
          <Spinner />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Screen</th>
                <th>Location</th>
                <th>Status</th>
                <th>Current Content</th>
                <th>Last Seen</th>
                <th>Handlers</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/screens/${s.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {s.screenKey}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>{s.name}</div>
                  </td>
                  <td>{s.location ?? '—'}</td>
                  <td>
                    <StatusBadge online={s.online} /> <StatusBadge status={s.status} />
                  </td>
                  <td>{s.currentContent ?? '—'}</td>
                  <td className="muted">{s.lastSeen ? new Date(s.lastSeen).toLocaleTimeString() : 'never'}</td>
                  <td>{s.handlers.map((h) => h.name).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
