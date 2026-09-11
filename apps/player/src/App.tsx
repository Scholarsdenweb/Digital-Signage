import { useEffect, useState } from 'react';
import { deviceStore } from './storage/deviceStore.js';
import { deviceApi } from './net/deviceApi.js';
import { Registration } from './player/Registration.js';
import { PlayerScreen } from './player/PlayerScreen.js';
import { Disabled } from './player/Disabled.js';

type Phase = 'boot' | 'register' | 'play' | 'disabled';

export function App() {
  const [phase, setPhase] = useState<Phase>('boot');

  useEffect(() => {
    const token = deviceStore.getToken();
    if (!token) {
      setPhase('register');
      return;
    }
    // Authenticate with stored credential; fall back to cache if offline.
    deviceApi
      .authenticate(token)
      .then((res) => {
        deviceStore.setConfig(res.config);
        setPhase('play');
      })
      .catch((err) => {
        if (err.code === 'DEVICE_DISABLED') {
          // Admin explicitly disabled this screen — show the disabled state.
          setPhase('disabled');
        } else if (err.code === 'DEVICE_REVOKED' || err.status === 401) {
          // Credential revoked or no longer recognised (e.g. re-provisioned backend)
          // → discard the stale token and return to pairing so it can re-register.
          deviceStore.clearToken();
          setPhase('register');
        } else {
          // Network error: boot from cache (offline-first, no re-auth needed).
          setPhase(deviceStore.getConfig() ? 'play' : 'register');
        }
      });
  }, []);

  if (phase === 'boot') return <Splash text="Starting…" />;
  if (phase === 'register') return <Registration onPaired={() => setPhase('play')} />;
  if (phase === 'disabled') return <Disabled />;
  return <PlayerScreen onDisabled={() => setPhase('disabled')} />;
}

function Splash({ text }: { text: string }) {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#94a3b8', fontFamily: 'sans-serif' }}>
      {text}
    </div>
  );
}
