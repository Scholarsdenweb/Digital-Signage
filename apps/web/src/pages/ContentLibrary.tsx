import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Modal, Empty, Spinner, useConfirm } from '../components/ui.js';
import type { ContentDto } from '@dsm/shared';

export function ContentLibrary() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [items, setItems] = useState<ContentDto[] | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = () => api.get<ContentDto[]>('/content').then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  async function remove(c: ContentDto) {
    if (!(await confirm(`Delete "${c.title}"? This cannot be undone.`))) return;
    try {
      await api.del(`/content/${c.id}`);
      toast.push('Deleted', 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  async function setFit(c: ContentDto, fitMode: 'COVER' | 'CONTAIN') {
    try {
      await api.patch(`/content/${c.id}`, { fitMode });
      toast.push('Display fit updated — live screens will re-sync automatically', 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  return (
    <div className="grid">
      {node}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Content Library</h1>
        <button className="primary" onClick={() => setShowUpload(true)}>+ Upload</button>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>Every upload starts as a draft. Add it to a screen playlist and publish to go live.</p>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="No content yet. Upload a timetable, achievement or general image/video." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          {items.map((c) => (
            <div key={c.id} className="card" style={{ padding: 10 }}>
              {c.media.kind === 'VIDEO' ? (
                <video src={c.media.url} style={CARD_MEDIA} muted />
              ) : (
                <img src={c.media.url} style={CARD_MEDIA} alt="" />
              )}
              <div style={{ fontWeight: 600, marginTop: 8 }}>{c.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {c.type} · {c.status} · {c.defaultDurationSec}s
              </div>
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <select
                  value={c.fitMode}
                  title="How the media fills the screen"
                  onChange={(e) => setFit(c, e.target.value as 'COVER' | 'CONTAIN')}
                  style={{ flex: 1, fontSize: 12, padding: '5px 8px' }}
                >
                  <option value="COVER">Fill screen (crop)</option>
                  <option value="CONTAIN">Fit whole (no crop)</option>
                </select>
                <button className="danger" onClick={() => remove(c)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); }} />}
    </div>
  );
}

const CARD_MEDIA: React.CSSProperties = { width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, background: '#000' };

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('GENERAL');
  const [duration, setDuration] = useState(15);
  const [fit, setFit] = useState<'COVER' | 'CONTAIN'>('COVER');
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.push('Choose a file', 'error');
    const form = new FormData();
    form.append('file', file);
    form.append('title', title || file.name);
    form.append('type', type);
    form.append('fitMode', fit);
    form.append('defaultDurationSec', String(duration));

    // client-side validation: image dimensions for aspect-ratio warning
    setBusy(true);
    try {
      await api.upload('/content', form);
      toast.push('Uploaded as draft', 'success');
      onDone();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function onFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        const ar = img.width / img.height;
        setWarn(ar >= 1 ? 'Landscape image (best for 16:9 screens)' : 'Portrait image (best for 9:16 screens)');
      };
      img.src = URL.createObjectURL(file);
    } else {
      setWarn('Video will autoplay muted and loop within the playlist.');
    }
  }

  return (
    <Modal title="Upload content" onClose={onClose}>
      <div className="grid">
        <div>
          <label className="muted" style={{ fontSize: 13 }}>File (image or video)</label>
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" onChange={onFile} />
          {warn && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>ⓘ {warn}</div>}
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning Timetable" />
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
          <div style={{ width: 140 }}>
            <label className="muted" style={{ fontSize: 13 }}>Duration (s)</label>
            <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 13 }}>Display fit</label>
          <select value={fit} onChange={(e) => setFit(e.target.value as 'COVER' | 'CONTAIN')}>
            <option value="COVER">Fill screen — edge to edge, may crop (best for photos/backgrounds)</option>
            <option value="CONTAIN">Fit whole — show everything, no cropping (best for videos/posters/timetables)</option>
          </select>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy} onClick={submit}>{busy ? 'Uploading…' : 'Upload draft'}</button>
        </div>
      </div>
    </Modal>
  );
}
