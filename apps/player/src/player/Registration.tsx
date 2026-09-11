import { useEffect, useRef, useState } from 'react';
import { deviceApi } from '../net/deviceApi.js';
import { deviceStore } from '../storage/deviceStore.js';
import { detectDisplay } from '../kiosk/kiosk.js';

export function Registration({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const display = useRef(detectDisplay());
  const polling = useRef<number>();

  useEffect(() => {
    let cancelled = false;
    deviceApi
      .createPairRequest(display.current)
      .then((res) => {
        if (cancelled) return;
        setCode(res.pairingCode);
        polling.current = window.setInterval(async () => {
          try {
            const status = await deviceApi.pairStatus(res.pairingCode);
            if (status.status === 'paired' && status.deviceToken) {
              window.clearInterval(polling.current);
              deviceStore.setToken(status.deviceToken);
              const auth = await deviceApi.authenticate(status.deviceToken);
              deviceStore.setConfig(auth.config);
              onPaired();
            }
          } catch (e: any) {
            if (e.status === 410) {
              // code expired — request a new one
              window.clearInterval(polling.current);
              setCode(null);
              const fresh = await deviceApi.createPairRequest(display.current);
              setCode(fresh.pairingCode);
            }
          }
        }, 3000);
      })
      .catch(() => setError('Cannot reach server. Retrying…'));
    return () => {
      cancelled = true;
      window.clearInterval(polling.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = display.current;
  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.brand}>Digital Signage</div>
        <div style={S.h1}>Pair this screen</div>
        <div style={S.sub}>In the admin panel go to Screens → Add Screen and enter:</div>
        <div style={S.code}>{code ?? '……'}</div>
        {error && <div style={S.err}>{error}</div>}
        <div style={S.meta}>
          {d.width}×{d.height} · {d.orientation} · DPR {d.devicePixelRatio}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', background: '#0b1220', color: '#e2e8f0', fontFamily: 'sans-serif' },
  card: { textAlign: 'center', padding: 40 },
  brand: { color: '#f59e0b', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontSize: 14 },
  h1: { fontSize: 34, fontWeight: 800, marginTop: 8 },
  sub: { color: '#94a3b8', marginTop: 12 },
  code: { fontSize: 72, fontWeight: 900, letterSpacing: 12, marginTop: 24, fontFamily: 'monospace', color: '#fff' },
  meta: { marginTop: 24, color: '#64748b', fontSize: 13 },
  err: { color: '#f87171', marginTop: 12 },
};
