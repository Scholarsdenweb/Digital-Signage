import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLive } from '../api/liveSocket.js';
import { useAuth } from '../store/auth.js';
import { useToast } from '../store/toast.js';
import { StatusBadge, Modal, Empty, Spinner, useConfirm } from '../components/ui.js';
import { PERMISSIONS, WS } from '@dsm/shared';

export interface ScreenRow {
  id: string;
  screenKey: string;
  name: string;
  location: string | null;
  orientation: string;
  width: number;
  height: number;
  status: string;
  screenGroup: { id: string; name: string } | null;
  handlers: { id: string; name: string; email: string }[];
  online: boolean;
  wsConnected: boolean;
  lastSeen: string | null;
  currentContent: string | null;
  playerVersion: string | null;
}

interface Handler {
  id: string;
  name: string;
  email: string;
}

export function Screens() {
  const { can } = useAuth();
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [screens, setScreens] = useState<ScreenRow[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => api.get<ScreenRow[]>('/screens').then(setScreens).catch(() => setScreens([]));
  useEffect(() => {
    load();
  }, []);

  // Live updates: refetch (debounced) when the backend reports screen activity.
  const debounce = useRef<number>();
  useLive((msg) => {
    if (
      msg.event === WS.HEARTBEAT_UPDATE ||
      msg.event === WS.SCREEN_STATUS_CHANGED ||
      msg.event === WS.PLAYLIST_UPDATED ||
      msg.event === WS.PAIRING_REQUEST_CREATED
    ) {
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(load, 400);
    }
  });

  async function command(id: string, path: string, body?: unknown, label = 'Command sent') {
    try {
      await api.post(`/screens/${id}/${path}`, body);
      toast.push(label, 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  async function deleteScreen(s: ScreenRow) {
    const ok = await confirm(
      `PERMANENTLY delete ${s.screenKey} (${s.name})? This removes the screen, its playlist and pairing. This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await api.del(`/screens/${s.id}`);
      toast.push(`${s.screenKey} deleted`, 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  return (
    <div className="grid">
      {node}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Screens</h1>
        {can(PERMISSIONS.MANAGE_SCREENS) && (
          <button className="primary" onClick={() => setShowAdd(true)}>
            + Add Screen
          </button>
        )}
      </div>

      {!screens ? (
        <Spinner />
      ) : screens.length === 0 ? (
        <Empty text="No screens yet. Pair an Android screen to get started." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Screen</th>
                <th>Location</th>
                <th>Status</th>
                <th>Current</th>
                <th>Last Seen</th>
                <th>Handlers</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/screens/${s.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {s.screenKey}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.name} · {s.width}×{s.height}
                    </div>
                  </td>
                  <td>{s.location ?? '—'}</td>
                  <td>
                    <StatusBadge online={s.online} /> <StatusBadge status={s.status} />
                  </td>
                  <td>{s.currentContent ?? '—'}</td>
                  <td className="muted">{s.lastSeen ? new Date(s.lastSeen).toLocaleString() : 'never'}</td>
                  <td>{s.handlers.map((h) => h.name).join(', ') || '—'}</td>
                  <td>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <Link to={`/screens/${s.id}`}>
                        <button className="ghost">View</button>
                      </Link>
                      {can(PERMISSIONS.MANAGE_MAINTENANCE) && (
                        <>
                          <button className="ghost" onClick={() => command(s.id, 'maintenance', { durationMinutes: 30 }, 'Maintenance (30m)')}>
                            Maintenance
                          </button>
                          <button className="ghost" onClick={() => command(s.id, 'resume', {}, 'Resumed')}>
                            Resume
                          </button>
                        </>
                      )}
                      {can(PERMISSIONS.SEND_DEVICE_COMMANDS) && (
                        <>
                          <button className="ghost" onClick={() => command(s.id, 'commands', { command: 'RELOAD_PLAYER' }, 'Reload sent')}>
                            Reload
                          </button>
                          <button className="ghost" onClick={() => command(s.id, 'commands', { command: 'SYNC_CONTENT' }, 'Sync sent')}>
                            Sync
                          </button>
                        </>
                      )}
                      {can(PERMISSIONS.MANAGE_SCREENS) &&
                        (s.status === 'DISABLED' ? (
                          <button className="ghost" onClick={() => command(s.id, 'enable', {}, 'Enabled')}>
                            Enable
                          </button>
                        ) : (
                          <button
                            className="danger"
                            onClick={async () => {
                              if (await confirm(`Disable ${s.screenKey}? The screen will stop normal playback.`))
                                command(s.id, 'disable', {}, 'Disabled');
                            }}
                          >
                            Disable
                          </button>
                        ))}
                      {can(PERMISSIONS.MANAGE_SCREENS) && (
                        <button className="danger" onClick={() => deleteScreen(s)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddScreen onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddScreen({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ pairingCode: '', name: '', location: '', orientation: 'LANDSCAPE', screenGroupId: '', handlerIds: [] as string[] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Handler[]>('/users/handlers').then(setHandlers).catch(() => {});
    api.get<{ id: string; name: string }[]>('/screen-groups').then(setGroups).catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    try {
      // Only send screenGroupId when one is chosen (it must be a valid uuid or absent).
      const { screenGroupId, ...rest } = form;
      const payload: Record<string, unknown> = { ...rest, pairingCode: form.pairingCode.toUpperCase() };
      if (screenGroupId) payload.screenGroupId = screenGroupId;
      await api.post('/screens/pair', payload);
      toast.push('Screen registered', 'success');
      onDone();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add Screen" onClose={onClose}>
      <div className="grid">
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Pairing Code (shown on the screen)</label>
          <input value={form.pairingCode} onChange={(e) => setForm({ ...form, pairingCode: e.target.value })} placeholder="ABC123" />
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reception 1" />
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Location</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Front desk" />
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Orientation</label>
          <select value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value })}>
            <option value="LANDSCAPE">Landscape</option>
            <option value="PORTRAIT">Portrait</option>
          </select>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Screen Group (optional)</label>
          <select value={form.screenGroupId} onChange={(e) => setForm({ ...form, screenGroupId: e.target.value })}>
            <option value="">— None —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Assign Handlers</label>
          <select
            multiple
            value={form.handlerIds}
            onChange={(e) => setForm({ ...form, handlerIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}
            style={{ height: 100 }}
          >
            {handlers.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.email})
              </option>
            ))}
          </select>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !form.pairingCode || !form.name} onClick={submit}>
            Register
          </button>
        </div>
      </div>
    </Modal>
  );
}
