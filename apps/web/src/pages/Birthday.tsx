import { useEffect, useState } from 'react';
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
}

export function Birthday() {
  const toast = useToast();
  const [today, setToday] = useState<Instance[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = () => {
    api.get<Instance[]>('/birthday/today').then(setToday).catch(() => setToday([]));
    api.get<Template[]>('/birthday/templates').then(setTemplates).catch(() => {});
    api.get<ScreenRow[]>('/screens').then(setScreens).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  async function generate() {
    if (regenerating) return;
    setRegenerating(true);
    toast.push('Regenerating birthday posts…', 'info');
    try {
      const r = await api.post<{ count: number }>('/birthday/generate');
      toast.push(`Regenerated ${r.count} birthday post(s)`, 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setRegenerating(false);
    }
  }

  async function assign() {
    if (assigning) return;
    if (selected.length === 0) {
      toast.push('Select at least one screen first', 'error');
      return;
    }
    setAssigning(true);
    try {
      const r = await api.post<{ assigned: number; screens: number }>('/birthday/assign', {
        screenIds: selected,
        screenGroupIds: [],
      });
      toast.push(`Assigned to ${r.screens} screen(s) — pushed live`, 'success');
    } catch (e: any) {
      toast.push(e.message, 'error');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>Birthday</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Birthday posts are generated automatically each day from students' dates of birth, using a built-in animated
        design that fills in each student's name and date.
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Today's Birthdays</h3>
          <button className="primary" onClick={generate} disabled={regenerating}>
            {regenerating ? 'Regenerating…' : 'Regenerate now'}
          </button>
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
          <button className="primary" disabled={selected.length === 0 || assigning} onClick={assign}>
            {assigning ? 'Assigning…' : "Assign today's birthdays"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Templates</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          A permanent animated design is built in — each birthday post automatically shows the student's name, date and
          batch with glowing text and confetti. Nothing to upload.
        </p>
        {templates.length === 0 ? (
          <Empty text="No templates." />
        ) : (
          <ul>
            {templates.map((t) => (
              <li key={t.id}>
                {t.name} {t.isDefault && <span className="muted">(default)</span>} · {t.defaultDurationSec}s
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
