import { useMemo } from 'react';

/**
 * Animated birthday slide: the admin-uploaded background image (exact design) with
 * the student's name + date overlaid, plus falling confetti and glow — all CSS, so
 * it works offline once the background image is cached.
 */
export function BirthdaySlide({
  bg,
  name,
  dateText,
  batch,
  fit,
}: {
  bg: string;
  name: string;
  dateText?: string;
  batch?: string;
  fit: 'cover' | 'contain';
}) {
  const confetti = useMemo(() => {
    const colors = ['#f472b6', '#c084fc', '#60a5fa', '#22d3ee', '#fde047', '#f87171', '#ffffff'];
    return Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      delay: -Math.random() * 8,
      dur: 5 + Math.random() * 6,
      size: 6 + Math.random() * 8,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
    }));
  }, []);

  const cross = bg && new URL(bg, location.href).origin !== location.origin ? 'anonymous' : undefined;

  return (
    <div style={STAGE}>
      <style>{KEYFRAMES}</style>
      <img src={bg} crossOrigin={cross} style={{ ...MEDIA, objectFit: fit }} alt="" />

      <div style={CONFETTI_LAYER} aria-hidden>
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10vh',
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.6,
              background: c.color,
              borderRadius: 2,
              opacity: 0.9,
              transform: `rotate(${c.rot}deg)`,
              animation: `dsm-fall ${c.dur}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {dateText && <div style={DATE}>{dateText}</div>}

      <div style={NAME_WRAP}>
        <div style={NAME}>{name}</div>
        {batch && <div style={BATCH}>({batch})</div>}
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes dsm-fall { 0%{transform:translateY(-10vh) rotate(0deg);} 100%{transform:translateY(120vh) rotate(720deg);} }
@keyframes dsm-glow { 0%,100%{text-shadow:0 0 14px rgba(255,255,255,.45), 0 2px 8px rgba(0,0,0,.6);} 50%{text-shadow:0 0 34px rgba(255,255,255,.95), 0 2px 8px rgba(0,0,0,.6);} }
@keyframes dsm-in { 0%{opacity:0;transform:translateY(24px) scale(.92);} 100%{opacity:1;transform:none;} }
@keyframes dsm-datein { 0%{opacity:0;transform:translateY(-18px);} 100%{opacity:1;transform:none;} }
`;

const STAGE: React.CSSProperties = { width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', position: 'relative' };
const MEDIA: React.CSSProperties = { position: 'absolute', inset: 0, width: '100vw', height: '100vh', display: 'block' };
const CONFETTI_LAYER: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' };
const DATE: React.CSSProperties = {
  position: 'absolute',
  top: '7%',
  left: 0,
  right: 0,
  textAlign: 'center',
  color: '#fde68a',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 700,
  letterSpacing: '0.4em',
  fontSize: '3.2vh',
  textShadow: '0 2px 10px rgba(0,0,0,.6)',
  animation: 'dsm-datein 1s ease-out both',
};
const NAME_WRAP: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '76%',
  textAlign: 'center',
  animation: 'dsm-in 1.1s cubic-bezier(.2,.8,.2,1) both',
};
const NAME: React.CSSProperties = {
  color: '#ffffff',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 800,
  letterSpacing: '0.06em',
  fontSize: '6.4vh',
  lineHeight: 1.05,
  animation: 'dsm-glow 2.4s ease-in-out infinite',
};
const BATCH: React.CSSProperties = {
  color: '#e9d5ff',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 700,
  letterSpacing: '0.08em',
  fontSize: '4vh',
  marginTop: '1vh',
  textShadow: '0 2px 8px rgba(0,0,0,.6)',
};
