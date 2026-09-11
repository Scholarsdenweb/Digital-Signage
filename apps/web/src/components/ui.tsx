import { useState, type ReactNode } from 'react';

export function StatusBadge({ status, online }: { status?: string; online?: boolean }) {
  const map: Record<string, string> = {
    ACTIVE: '#16a34a',
    MAINTENANCE: '#f59e0b',
    DISABLED: '#dc2626',
    online: '#16a34a',
    offline: '#64748b',
  };
  const key = online === undefined ? status ?? '' : online ? 'online' : 'offline';
  const label = online === undefined ? status : online ? 'Online' : 'Offline';
  const color = map[key] ?? '#64748b';
  return (
    <span className="badge" style={{ background: 'rgba(255,255,255,.06)' }}>
      <span className="dot" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { width: 'min(1000px, 95vw)' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ message, onConfirm, onCancel, danger }: { message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <Modal title="Please confirm" onClose={onCancel}>
      <p>{message}</p>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </Modal>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (message: string) => new Promise<boolean>((resolve) => setState({ message, resolve }));
  const node = state ? (
    <Confirm
      danger
      message={state.message}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;
  return { confirm, node };
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function Spinner() {
  return <div className="muted" style={{ padding: 24 }}>Loading…</div>;
}
