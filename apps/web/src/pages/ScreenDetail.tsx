import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { useAuth } from '../store/auth.js';
import { Modal, StatusBadge, Empty, Spinner } from '../components/ui.js';
import { PERMISSIONS } from '@dsm/shared';
import type { PlaylistDto, PlaylistItemDto, ContentDto } from '@dsm/shared';
import type { ScreenRow } from './Screens.js';

interface HandlerOption {
  id: string;
  name: string;
  email: string;
}

export function ScreenDetail() {
  const { screenId } = useParams();
  const toast = useToast();
  const { can } = useAuth();
  const [screen, setScreen] = useState<ScreenRow | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [library, setLibrary] = useState<ContentDto[]>([]);
  const [picker, setPicker] = useState<{ mode: 'add' | 'replace'; itemId?: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [showHandlers, setShowHandlers] = useState(false);
  const [showPublishTo, setShowPublishTo] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [publishing, setPublishing] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadScreen = useCallback(
    () => api.get<ScreenRow>(`/screens/${screenId}`).then(setScreen),
    [screenId],
  );
  const loadPlaylist = useCallback(
    () => api.get<PlaylistDto>(`/screens/${screenId}/playlist`).then(setPlaylist),
    [screenId],
  );
  const reloadLibrary = useCallback(
    () => api.get<ContentDto[]>('/content').then(setLibrary),
    [],
  );

  // Upload a new file straight from the screen: it is added to the content library
  // (as a draft) AND returned so it can be placed into this screen's playlist.
  const uploadNewContent = useCallback(
    async (file: File, meta: { title: string; type: string; duration: number; fitMode: 'COVER' | 'CONTAIN' }): Promise<ContentDto> => {
      const form = new FormData();
      form.append('file', file);
      form.append('title', meta.title || file.name);
      form.append('type', meta.type);
      form.append('fitMode', meta.fitMode);
      form.append('defaultDurationSec', String(meta.duration));
      const created = await api.upload<ContentDto>('/content', form);
      reloadLibrary().catch(() => {});
      return created;
    },
    [reloadLibrary],
  );

  useEffect(() => {
    loadScreen().catch(() => {});
    loadPlaylist().catch(() => {});
    api.get<ContentDto[]>('/content').then(setLibrary).catch(() => {});
    api.get<{ id: string; name: string }[]>('/screen-groups').then(setGroups).catch(() => {});
  }, [screenId, loadPlaylist, loadScreen]);

  async function changeGroup(screenGroupId: string) {
    try {
      await api.patch(`/screens/${screenId}`, { screenGroupId: screenGroupId || null });
      toast.push('Screen group updated', 'success');
      loadScreen();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!playlist || !e.over || e.active.id === e.over.id) return;
    const oldIndex = playlist.items.findIndex((i) => i.id === e.active.id);
    const newIndex = playlist.items.findIndex((i) => i.id === e.over!.id);
    const reordered = arrayMove(playlist.items, oldIndex, newIndex);
    setPlaylist({ ...playlist, items: reordered, hasDraftChanges: true }); // optimistic
    try {
      const updated = await api.post<PlaylistDto>(`/screens/${screenId}/playlist/reorder`, {
        itemIds: reordered.map((i) => i.id),
      });
      setPlaylist(updated);
    } catch (err: any) {
      toast.push(err.message, 'error');
      loadPlaylist();
    }
  }

  async function removeItem(itemId: string) {
    try {
      setPlaylist(await api.del<PlaylistDto>(`/screens/${screenId}/playlist/items/${itemId}`));
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  async function changeDuration(itemId: string, durationSec: number) {
    try {
      setPlaylist(
        await api.put<PlaylistDto>(`/screens/${screenId}/playlist/items/${itemId}/duration`, { durationSec }),
      );
    } catch (e: any) {
      toast.push(e.message, 'error');
      loadPlaylist();
    }
  }

  async function pickContent(content: ContentDto) {
    try {
      if (picker?.mode === 'add') {
        setPlaylist(await api.post<PlaylistDto>(`/screens/${screenId}/playlist/items`, { contentId: content.id }));
        toast.push('Added to draft', 'success');
      } else if (picker?.mode === 'replace' && picker.itemId) {
        setPlaylist(
          await api.put<PlaylistDto>(`/screens/${screenId}/playlist/items/${picker.itemId}/replace`, {
            contentId: content.id,
          }),
        );
        toast.push('Replaced (position preserved)', 'success');
      }
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setPicker(null);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      await api.post(`/screens/${screenId}/playlist/publish`);
      toast.push('Published — screens updating live', 'success');
      loadPlaylist();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setPublishing(false);
    }
  }

  if (!playlist || !screen) return <Spinner />;

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <Link to="/screens" className="muted" style={{ fontSize: 13 }}>← Screens</Link>
          <h1 style={{ margin: '4px 0' }}>
            {screen.screenKey} <span className="muted" style={{ fontSize: 16 }}>{screen.name}</span>
          </h1>
          <div className="row">
            <StatusBadge online={screen.online} />
            <StatusBadge status={screen.status} />
            <span className="muted" style={{ fontSize: 13 }}>
              {screen.width}×{screen.height} · {screen.orientation}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Handlers: {screen.handlers.length ? screen.handlers.map((h) => h.name).join(', ') : 'none assigned'}
          </div>
          {can(PERMISSIONS.MANAGE_SCREENS) && (
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>Group:</span>
              <select
                value={screen.screenGroup?.id ?? ''}
                onChange={(e) => changeGroup(e.target.value)}
                style={{ width: 'auto', fontSize: 13, padding: '5px 8px' }}
              >
                <option value="">— None —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="row">
          {can(PERMISSIONS.MANAGE_SCREENS) && (
            <button className="ghost" onClick={() => setShowHandlers(true)}>Handlers</button>
          )}
          <button className="ghost" onClick={() => setPreview(true)}>Preview</button>
          <button className="ghost" onClick={() => setShowPublishTo(true)} disabled={playlist.items.length === 0}>
            Publish to…
          </button>
          <button className="primary" disabled={!playlist.hasDraftChanges || publishing} onClick={publish}>
            {publishing ? 'Publishing…' : playlist.hasDraftChanges ? 'Publish' : 'Published'}
          </button>
        </div>
      </div>

      {playlist.hasDraftChanges && (
        <div className="card" style={{ borderColor: 'var(--primary)', background: 'rgba(245,158,11,.08)' }}>
          You have unpublished draft changes. Click <b>Publish</b> to make them live.
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Playlist (loops continuously)</h3>
        <button className="primary" onClick={() => setPicker({ mode: 'add' })}>+ Add Content</button>
      </div>

      {playlist.items.length === 0 ? (
        <Empty text="Empty playlist. Add content, then publish." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={playlist.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="grid" style={{ gap: 8 }}>
              {playlist.items.map((item, idx) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  index={idx}
                  onReplace={() => setPicker({ mode: 'replace', itemId: item.id })}
                  onRemove={() => removeItem(item.id)}
                  onDurationChange={(sec) => changeDuration(item.id, sec)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {picker && (
        <ContentPicker
          title={picker.mode === 'add' ? 'Add content' : 'Replace with…'}
          library={library}
          onPick={pickContent}
          onUpload={uploadNewContent}
          onClose={() => setPicker(null)}
        />
      )}
      {preview && <PreviewModal screen={screen} items={playlist.items} onClose={() => setPreview(false)} />}
      {showHandlers && (
        <ManageHandlers
          screen={screen}
          onClose={() => setShowHandlers(false)}
          onSaved={() => {
            setShowHandlers(false);
            loadScreen();
            toast.push('Handlers updated', 'success');
          }}
        />
      )}
      {showPublishTo && (
        <PublishToModal
          source={screen}
          groups={groups}
          onClose={() => setShowPublishTo(false)}
          onDone={() => {
            setShowPublishTo(false);
            loadPlaylist();
          }}
        />
      )}
    </div>
  );
}

function PublishToModal({
  source,
  groups,
  onClose,
  onDone,
}: {
  source: ScreenRow;
  groups: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [includeSource, setIncludeSource] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only screens the current user can access are returned by the API.
    api.get<ScreenRow[]>('/screens').then((all) => setScreens(all.filter((s) => s.id !== source.id))).catch(() => {});
  }, [source.id]);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string, on: boolean) =>
    set(on ? [...arr, id] : arr.filter((x) => x !== id));

  const targetCount = (includeSource ? 1 : 0) + screenIds.length; // groups add more server-side

  async function submit() {
    setBusy(true);
    try {
      const res = await api.post<{ published: number; skipped: number }>(
        `/screens/${source.id}/playlist/publish-to`,
        { screenIds, screenGroupIds: groupIds, includeSource },
      );
      toast.push(
        `Published to ${res.published} screen(s)` + (res.skipped ? ` · ${res.skipped} skipped (no access)` : ''),
        'success',
      );
      onDone();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Publish playlist to…" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0 }}>
        Copies <b>{source.screenKey}</b>'s current playlist to the selected targets and publishes each live.
      </p>

      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={includeSource} onChange={(e) => setIncludeSource(e.target.checked)} />
        Include this screen ({source.screenKey})
      </label>

      {groups.length > 0 && (
        <>
          <h4 style={{ marginBottom: 6 }}>Screen groups</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 6 }}>
            {groups.map((g) => (
              <label key={g.id} className="row" style={{ gap: 8 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={groupIds.includes(g.id)} onChange={(e) => toggle(groupIds, setGroupIds, g.id, e.target.checked)} />
                {g.name}
              </label>
            ))}
          </div>
        </>
      )}

      <h4 style={{ marginBottom: 6, marginTop: 14 }}>Other screens</h4>
      {screens.length === 0 ? (
        <Empty text="No other screens available." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 6 }}>
          {screens.map((s) => (
            <label key={s.id} className="row" style={{ gap: 8 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={screenIds.includes(s.id)} onChange={(e) => toggle(screenIds, setScreenIds, s.id, e.target.checked)} />
              {s.screenKey} · <span className="muted">{s.name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy || (targetCount === 0 && groupIds.length === 0)} onClick={submit}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </Modal>
  );
}

function ManageHandlers({
  screen,
  onClose,
  onSaved,
}: {
  screen: ScreenRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [all, setAll] = useState<HandlerOption[]>([]);
  const [selected, setSelected] = useState<string[]>(screen.handlers.map((h) => h.id));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<HandlerOption[]>('/users/handlers').then(setAll).catch(() => {});
  }, []);

  function toggle(id: string, on: boolean) {
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  }

  async function save() {
    setBusy(true);
    try {
      // Backend replaces the full assignment set for this screen.
      await api.post(`/screens/${screen.id}/handlers`, { handlerIds: selected });
      onSaved();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Assign handlers · ${screen.screenKey}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Handlers can manage content and publish only on the screens assigned here.
      </p>
      {all.length === 0 ? (
        <Empty text="No handler users exist. Create one in Users first." />
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {all.map((h) => (
            <label key={h.id} className="row" style={{ gap: 10 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={selected.includes(h.id)}
                onChange={(e) => toggle(h.id, e.target.checked)}
              />
              <span>
                {h.name} <span className="muted" style={{ fontSize: 12 }}>{h.email}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save assignments'}
        </button>
      </div>
    </Modal>
  );
}

function SortableItem({
  item,
  index,
  onReplace,
  onRemove,
  onDurationChange,
}: {
  item: PlaylistItemDto;
  index: number;
  onReplace: () => void;
  onRemove: () => void;
  onDurationChange: (sec: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [dur, setDur] = useState(String(item.durationSec));
  useEffect(() => setDur(String(item.durationSec)), [item.durationSec]);

  function commit() {
    const n = Math.max(1, Math.min(3600, Math.round(Number(dur) || item.durationSec)));
    setDur(String(n));
    if (n !== item.durationSec) onDurationChange(n);
  }

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 12,
      }}
    >
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--muted)', fontSize: 18 }}>
        ⠿
      </span>
      <span className="muted" style={{ width: 24 }}>{index + 1}</span>
      <Thumb content={item.content} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{item.content.title}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {item.content.type} · {item.content.media.kind}
        </div>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <input
          type="number"
          min={1}
          max={3600}
          value={dur}
          onChange={(e) => setDur(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          title="Seconds this item is shown"
          style={{ width: 70, padding: '6px 8px', textAlign: 'right' }}
        />
        <span className="muted" style={{ fontSize: 12 }}>sec</span>
      </div>
      <button className="ghost" onClick={onReplace}>Replace</button>
      <button className="danger" onClick={onRemove}>Remove</button>
    </div>
  );
}

function Thumb({ content }: { content: ContentDto }) {
  return content.media.kind === 'VIDEO' ? (
    <video src={content.media.url} style={THUMB} muted />
  ) : (
    <img src={content.media.url} style={THUMB} alt="" />
  );
}
const THUMB: React.CSSProperties = { width: 64, height: 40, objectFit: 'cover', borderRadius: 6, background: '#000' };

function ContentPicker({
  title,
  library,
  onPick,
  onUpload,
  onClose,
}: {
  title: string;
  library: ContentDto[];
  onPick: (c: ContentDto) => void;
  onUpload: (file: File, meta: { title: string; type: string; duration: number; fitMode: 'COVER' | 'CONTAIN' }) => Promise<ContentDto>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const drafts = library.filter((c) => c.status !== 'ARCHIVED');

  const tabBtn = (id: 'library' | 'upload', label: string) => (
    <button className={tab === id ? 'primary' : 'ghost'} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="row" style={{ marginBottom: 14 }}>
        {tabBtn('library', 'From Library')}
        {tabBtn('upload', '⬆ Upload new')}
      </div>

      {tab === 'upload' ? (
        <InlineUpload
          onSubmit={async (file, meta) => {
            try {
              const created = await onUpload(file, meta);
              onPick(created); // add/replace it into the playlist immediately
            } catch (e: any) {
              toast.push(e.message, 'error');
            }
          }}
        />
      ) : drafts.length === 0 ? (
        <Empty text="No content in library yet. Use “Upload new” to add some." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {drafts.map((c) => (
            <div key={c.id} className="card" style={{ padding: 8, cursor: 'pointer' }} onClick={() => onPick(c)}>
              <Thumb content={c} />
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{c.title}</div>
              <div className="muted" style={{ fontSize: 11 }}>{c.type} · {c.status}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function InlineUpload({
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
  const [warn, setWarn] = useState<string | null>(null);

  function onFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () =>
        setWarn(img.width >= img.height ? 'Landscape image (best for 16:9 screens)' : 'Portrait image (best for 9:16 screens)');
      img.src = URL.createObjectURL(file);
    } else {
      setWarn('Video will autoplay muted and loop within the playlist.');
    }
  }

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.push('Choose a file', 'error');
    setBusy(true);
    try {
      await onSubmit(file, { title, type, duration, fitMode: fit });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ maxWidth: 460 }}>
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
          <option value="COVER">Fill screen — may crop</option>
          <option value="CONTAIN">Fit whole — no cropping (best for videos)</option>
        </select>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? 'Uploading…' : 'Upload & add to screen'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Uploaded content is saved to the Content Library as a draft and placed into this screen's playlist. Click{' '}
        <b>Publish</b> to go live.
      </div>
    </div>
  );
}

function PreviewModal({ screen, items, onClose }: { screen: ScreenRow; items: PlaylistItemDto[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const isPortrait = screen.height >= screen.width;
  const item = items[idx];

  useEffect(() => {
    if (!item) return;
    const dur = item.content.media.kind === 'IMAGE' ? item.durationSec * 1000 : 6000;
    const t = setTimeout(() => setIdx((i) => (i + 1) % items.length), dur);
    return () => clearTimeout(t);
  }, [idx, item, items.length]);

  // Preview box uses the target screen's aspect ratio.
  const boxW = isPortrait ? 260 : 520;
  const boxH = Math.round((boxW * screen.height) / screen.width);

  return (
    <Modal title={`Preview · ${screen.width}×${screen.height} (${isPortrait ? '9:16' : '16:9'})`} onClose={onClose}>
      {items.length === 0 ? (
        <Empty text="Nothing to preview." />
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
          <div style={{ width: boxW, height: boxH, background: '#000', overflow: 'hidden', borderRadius: 8 }}>
            {(() => {
              // Match the player exactly: honor the content's chosen fit mode.
              const fit = item.content.fitMode === 'CONTAIN' ? 'contain' : 'cover';
              const st: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit };
              return item.content.media.kind === 'VIDEO' ? (
                <video src={item.content.media.url} autoPlay muted style={st} />
              ) : (
                <img src={item.content.media.url} style={st} alt="" />
              );
            })()}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {idx + 1}/{items.length} · {item.content.title} · {item.durationSec}s
          </div>
        </div>
      )}
    </Modal>
  );
}
