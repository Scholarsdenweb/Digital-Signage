import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Empty, Spinner } from '../components/ui.js';

interface HistoryItem {
  id: string;
  title: string;
  type: string;
  reason: string;
  archivedAt: string;
  expiresAt: string;
  restoredAt: string | null;
  canRestore: boolean;
  media: { kind: string; url: string };
}

export function History() {
  const toast = useToast();
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  const load = () => api.get<HistoryItem[]>('/history').then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  async function restore(h: HistoryItem) {
    try {
      await api.post(`/history/${h.id}/restore`);
      toast.push('Restored to Library (as draft)', 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  function daysLeft(expiresAt: string) {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>History</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Previously published content that was replaced or removed. Kept for 7 days. Restore returns it to your
        library as a draft — it never changes live playlists.
      </p>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="No history in the last 7 days." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          {items.map((h) => (
            <div key={h.id} className="card" style={{ padding: 10 }}>
              {h.media.kind === 'VIDEO' ? (
                <video src={h.media.url} style={M} muted />
              ) : (
                <img src={h.media.url} style={M} alt="" />
              )}
              <div style={{ fontWeight: 600, marginTop: 8 }}>{h.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {h.type} · {h.reason} · {daysLeft(h.expiresAt)}d left
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="primary" disabled={!h.canRestore || !!h.restoredAt} onClick={() => restore(h)}>
                  {h.restoredAt ? 'Restored' : 'Restore to Library'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const M: React.CSSProperties = { width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, background: '#000' };
