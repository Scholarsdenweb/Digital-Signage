import { useEffect, useRef, useState } from 'react';
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
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [library, setLibrary] = useState<ContentDto[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // ordered content ids
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<ContentDto[]>('/content').then((all) => setLibrary(all.filter((c) => c.status !== 'ARCHIVED'))).catch(() => {});
  }, []);

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // Upload a new file → saved to library AND auto-selected for this group publish.
  async function uploadNew(file: File, meta: { title: string; type: string; duration: number; fitMode: 'COVER' | 'CONTAIN' }) {
    const form = new FormData();
    form.append('file', file);
    form.append('title', meta.title || file.name);
    form.append('type', meta.type);
    form.append('fitMode', meta.fitMode);
    form.append('defaultDurationSec', String(meta.duration));
    const created = await api.upload<ContentDto>('/content', form);
    setLibrary((cur) => [created, ...cur]);
    setPicked((cur) => [...cur, created.id]);
    toast.push('Uploaded & selected', 'success');
    setTab('library');
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
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={tab === 'library' ? 'primary' : 'ghost'} onClick={() => setTab('library')}>From Library</button>
        <button className={tab === 'upload' ? 'primary' : 'ghost'} onClick={() => setTab('upload')}>⬆ Upload new</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Select content (tap to add, in order). Publishing replaces the live playlist on every screen in this group.
      </p>
      {tab === 'upload' ? (
        <GroupUpload onSubmit={uploadNew} />
      ) : library.length === 0 ? (
        <Empty text="No content in library yet. Use “Upload new” to add some." />
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

function GroupUpload({
  onSubmit,
}: {
  onSubmit: (file: File, meta: { title: string; type: string; duration: number; fitMode: 'COVER' | 'CONTAIN' }) => Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('GENERAL');
  const [duration, setDuration] = useState(15);
  const [fit, setFit] = useState<'COVER' | 'CONTAIN'>('COVER');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.push('Choose a file', 'error');
    setBusy(true);
    try {
      await onSubmit(file, { title, type, duration, fitMode: fit });
      if (fileRef.current) fileRef.current.value = '';
      setTitle('');
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ maxWidth: 460 }}>
      <div>
        <label className="muted" style={{ fontSize: 13 }}>File (image or video)</label>
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" />
      </div>
      <div>
        <label className="muted" style={{ fontSize: 13 }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement" />
      </div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label className="muted" style={{ fontSize: 13 }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="TIMETABLE">Timetable</option>
            <option value="ACHIEVEMENT">Achievement</option>
            <option value="GENERAL">General</option>
          </select>
        </div>
        <div style={{ width: 130 }}>
          <label className="muted" style={{ fontSize: 13 }}>Duration (s)</label>
          <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="muted" style={{ fontSize: 13 }}>Display fit</label>
        <select value={fit} onChange={(e) => setFit(e.target.value as 'COVER' | 'CONTAIN')}>
          <option value="COVER">Fill screen — may crop</option>
          <option value="CONTAIN">Fit whole — no cropping (best for videos/timetables)</option>
        </select>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? 'Uploading…' : 'Upload & select'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Saved to the Content Library and added to this group's selection. Click <b>Publish to group</b> to push it to every screen.
      </div>
    </div>
  );
}

const THUMB: React.CSSProperties = { width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, background: '#000' };
