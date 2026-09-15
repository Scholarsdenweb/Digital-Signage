import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Empty, Spinner, Modal, useConfirm } from '../components/ui.js';
import type { ContentDto } from '@dsm/shared';

interface Group {
  id: string;
  name: string;
  description: string | null;
  screenCount: number;
}

export function Groups() {
  const toast = useToast();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [publishGroup, setPublishGroup] = useState<Group | null>(null);

  const load = () => api.get<Group[]>('/screen-groups').then(setGroups).catch(() => setGroups([]));
  useEffect(() => {
    load();
  }, []);

  async function create() {
    try {
      await api.post('/screen-groups', { name, description });
      setName('');
      setDescription('');
      toast.push('Group created', 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>Screen Groups</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Publishing content to a group <b>replaces</b> what every screen in that group is showing with the same playlist.
      </p>
      <div className="card">
        <div className="row">
          <input placeholder="Group name (e.g. Reception Screens)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="primary" disabled={!name} onClick={create}>Create</button>
        </div>
      </div>
      {!groups ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Empty text="No screen groups yet." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Screens</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.description ?? '—'}</td>
                  <td>{g.screenCount}</td>
                  <td>
                    <button className="primary" disabled={g.screenCount === 0} onClick={() => setPublishGroup(g)}>
                      Publish content
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {publishGroup && (
        <GroupPublish group={publishGroup} onClose={() => setPublishGroup(null)} onDone={() => setPublishGroup(null)} />
      )}
    </div>
  );
}

function GroupPublish({ group, onClose, onDone }: { group: Group; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [library, setLibrary] = useState<ContentDto[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // ordered content ids
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<ContentDto[]>('/content').then((all) => setLibrary(all.filter((c) => c.status !== 'ARCHIVED'))).catch(() => {});
  }, []);

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function publish() {
    if (picked.length === 0) return;
    const ok = await confirm(
      `Publish ${picked.length} item(s) to all ${group.screenCount} screen(s) in "${group.name}"? This REPLACES what they are currently showing.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.post<{ screens: number }>(`/screen-groups/${group.id}/publish`, {
        items: picked.map((contentId) => ({ contentId })),
      });
      toast.push(`Published to ${res.screens} screen(s) in ${group.name}`, 'success');
      onDone();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Publish content to “${group.name}”`} onClose={onClose} wide>
      {node}
      <p className="muted" style={{ marginTop: 0 }}>
        Select content (tap to add, in order). Publishing replaces the live playlist on every screen in this group.
      </p>
      {library.length === 0 ? (
        <Empty text="No content in library. Upload some in Content Library first." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {library.map((c) => {
            const order = picked.indexOf(c.id);
            return (
              <div
                key={c.id}
                className="card"
                style={{ padding: 8, cursor: 'pointer', outline: order >= 0 ? '2px solid var(--primary)' : 'none' }}
                onClick={() => toggle(c.id)}
              >
                {c.media.kind === 'VIDEO' ? (
                  <video src={c.media.url} style={THUMB} muted />
                ) : (
                  <img src={c.media.url} style={THUMB} alt="" />
                )}
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>
                  {order >= 0 && <span style={{ color: 'var(--primary)' }}>#{order + 1} </span>}
                  {c.title}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{c.type} · {c.defaultDurationSec}s</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <span className="muted" style={{ fontSize: 13 }}>{picked.length} selected</span>
        <div className="row">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || picked.length === 0} onClick={publish}>
            {busy ? 'Publishing…' : `Publish to group`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const THUMB: React.CSSProperties = { width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, background: '#000' };
