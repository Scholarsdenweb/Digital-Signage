import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Empty, Spinner } from '../components/ui.js';
import type { ScreenRow } from './Screens.js';

interface Instance {
  id: string;
  student: { name: string };
  content: { id: string; title: string } | null;
}
interface Template {
  id: string;
  name: string;
  isDefault: boolean;
  defaultDurationSec: number;
  backgroundUrl?: string | null;
}

export function Birthday() {
  const toast = useToast();
  const [today, setToday] = useState<Instance[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const bgTargetRef = useRef<string | null>(null);

  function pickBackground(templateId: string) {
    bgTargetRef.current = templateId;
    bgFileRef.current?.click();
  }

  async function onBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = bgTargetRef.current;
    if (!file || !id) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await api.upload(`/birthday/templates/${id}/background`, form);
      toast.push('Background uploaded — click “Regenerate now” to apply', 'success');
      load();
    } catch (err: any) {
      toast.push(err.message, 'error');
    } finally {
      if (bgFileRef.current) bgFileRef.current.value = '';
    }
  }

  const load = () => {
    api.get<Instance[]>('/birthday/today').then(setToday).catch(() => setToday([]));
    api.get<Template[]>('/birthday/templates').then(setTemplates).catch(() => {});
    api.get<ScreenRow[]>('/screens').then(setScreens).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  async function generate() {
    try {
      const r = await api.post<{ count: number }>('/birthday/generate');
      toast.push(`Generated ${r.count} birthday item(s)`, 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  async function assign() {
    try {
      await api.post('/birthday/assign', { screenIds: selected, screenGroupIds: [] });
      toast.push('Birthday content assigned & pushed live', 'success');
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>Birthday</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Birthday posts are generated automatically each day from students' dates of birth. Optionally upload your own
        background design (below) and the player animates the student's name & date over it.
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Today's Birthdays</h3>
          <button className="ghost" onClick={generate}>Regenerate now</button>
        </div>
        {!today ? (
          <Spinner />
        ) : today.length === 0 ? (
          <Empty text="No birthdays today." />
        ) : (
          <ul>
            {today.map((i) => (
              <li key={i.id}>
                {i.student.name} {i.content ? '✓ generated' : '(pending)'}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Assign to Screens</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
          {screens.map((s) => (
            <label key={s.id} className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))
                }
              />
              {s.screenKey} · {s.name}
            </label>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="primary" disabled={selected.length === 0} onClick={assign}>
            Assign today's birthdays
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Templates</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Upload your exact birthday background (design without the name — the player overlays the student's name & date
          with animation on top). If no background is set, a generated neon poster is used instead.
        </p>
        <input ref={bgFileRef} type="file" accept="image/*" onChange={onBackground} style={{ display: 'none' }} />
        {templates.length === 0 ? (
          <Empty text="No templates." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {templates.map((t) => (
              <div key={t.id} className="card" style={{ padding: 10 }}>
                {t.backgroundUrl ? (
                  <img src={t.backgroundUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
                ) : (
                  <div style={{ height: 120, borderRadius: 8, background: '#0b1220', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    No background (generated poster)
                  </div>
                )}
                <div style={{ fontWeight: 600, marginTop: 8 }}>
                  {t.name} {t.isDefault && <span className="muted">(default)</span>}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{t.defaultDurationSec}s each</div>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="primary" onClick={() => pickBackground(t.id)}>
                    {t.backgroundUrl ? 'Change background' : 'Upload background'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
