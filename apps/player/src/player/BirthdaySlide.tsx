import { useMemo } from 'react';

/**
 * Permanent, code-defined birthday design rendered entirely in the player (no
 * uploaded image). The student's name / date / batch are filled in and animated:
 * glowing title, cursive "Birthday", falling confetti and spotlights. Works offline.
 */
export function BirthdaySlide({
  name,
  dateText,
  batch,
}: {
  name: string;
  dateText?: string;
  batch?: string;
}) {
  const confetti = useMemo(() => {
    const colors = ['#f472b6', '#c084fc', '#60a5fa', '#22d3ee', '#fde047', '#f87171', '#ffffff'];
    return Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: -Math.random() * 9,
      dur: 5 + Math.random() * 6,
      size: 5 + Math.random() * 8,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
    }));
  }, []);

  return (
    <div style={STAGE}>
      <style>{CSS}</style>

      {/* spotlight beams */}
      <div style={{ ...BEAM, left: '18%', background: 'linear-gradient(180deg,rgba(168,85,247,.55),transparent)' }} />
      <div style={{ ...BEAM, left: '40%', background: 'linear-gradient(180deg,rgba(59,130,246,.5),transparent)' }} />
      <div style={{ ...BEAM, left: '60%', background: 'linear-gradient(180deg,rgba(236,72,153,.5),transparent)' }} />
      <div style={{ ...BEAM, left: '82%', background: 'linear-gradient(180deg,rgba(245,158,11,.45),transparent)' }} />

      {/* neon swoosh behind the title */}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={SWOOSH_SVG} aria-hidden>
        <defs>
          <filter id="bd-neon" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M 80 560 C 540 740 800 700 960 620 C 1120 700 1380 740 1840 560"
          fill="none"
          stroke="#d946ef"
          strokeWidth="7"
          strokeLinecap="round"
          filter="url(#bd-neon)"
          opacity="0.95"
        />
      </svg>

      {/* confetti */}
      <div style={LAYER} aria-hidden>
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-12vh',
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.6,
              background: c.color,
              borderRadius: 2,
              transform: `rotate(${c.rot}deg)`,
              animation: `bd-fall ${c.dur}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* content */}
      {dateText && <div style={DATE}>{dateText}</div>}
      <div style={HAPPY}>HAPPY</div>
      <div style={SCRIPT}>Birthday</div>
      <div style={NAME_WRAP}>
        <div style={NAME}>{name}</div>
        {batch && <div style={BATCH}>({batch})</div>}
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Pacifico&display=swap');
@keyframes bd-fall { 0%{transform:translateY(-12vh) rotate(0);} 100%{transform:translateY(120vh) rotate(720deg);} }
@keyframes bd-glow { 0%,100%{text-shadow:0 0 18px rgba(217,70,239,.6),0 0 40px rgba(217,70,239,.35);} 50%{text-shadow:0 0 30px rgba(217,70,239,.95),0 0 70px rgba(217,70,239,.6);} }
@keyframes bd-white { 0%,100%{text-shadow:0 0 16px rgba(255,255,255,.5),0 4px 10px rgba(0,0,0,.6);} 50%{text-shadow:0 0 34px rgba(255,255,255,.95),0 4px 10px rgba(0,0,0,.6);} }
@keyframes bd-in { 0%{opacity:0;transform:translateY(28px) scale(.9);} 100%{opacity:1;transform:none;} }
@keyframes bd-down { 0%{opacity:0;transform:translateY(-22px);} 100%{opacity:1;transform:none;} }
`;

const STAGE: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  position: 'relative',
  background: 'radial-gradient(75% 75% at 50% 42%, #2a0f4a 0%, #140a26 55%, #050109 100%)',
  fontFamily: 'Arial, Helvetica, sans-serif',
};
const LAYER: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' };
const BEAM: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  width: '14vw',
  height: '92vh',
  transform: 'translateX(-50%) perspective(300px) rotateX(2deg)',
  clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
  filter: 'blur(6px)',
  opacity: 0.5,
};
const SWOOSH_SVG: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
const DATE: React.CSSProperties = {
  position: 'absolute', top: '7%', left: 0, right: 0, textAlign: 'center',
  color: '#fde68a', fontWeight: 700, letterSpacing: '0.45em', fontSize: '3.2vh',
  textShadow: '0 2px 10px rgba(0,0,0,.6)', animation: 'bd-down 1s ease-out both',
};
const HAPPY: React.CSSProperties = {
  position: 'absolute', top: '20%', left: 0, right: 0, textAlign: 'center',
  color: '#fff', fontWeight: 800, letterSpacing: '0.06em', fontSize: '20vh', lineHeight: 1,
  animation: 'bd-in .9s cubic-bezier(.2,.8,.2,1) both, bd-white 3s ease-in-out 1s infinite',
};
const SCRIPT: React.CSSProperties = {
  position: 'absolute', top: '44%', left: 0, right: 0, textAlign: 'center',
  color: '#f0abfc', fontFamily: "'Pacifico','Segoe Script','Brush Script MT',cursive",
  fontSize: '18vh', lineHeight: 1,
  animation: 'bd-in 1.1s cubic-bezier(.2,.8,.2,1) .15s both, bd-glow 2.6s ease-in-out 1s infinite',
};
const NAME_WRAP: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, top: '77%', textAlign: 'center',
  animation: 'bd-in 1.1s cubic-bezier(.2,.8,.2,1) .3s both',
};
const NAME: React.CSSProperties = {
  color: '#fff', fontWeight: 800, letterSpacing: '0.06em', fontSize: '6.6vh', lineHeight: 1.05,
  animation: 'bd-white 2.6s ease-in-out infinite',
};
const BATCH: React.CSSProperties = {
  color: '#e9d5ff', fontWeight: 700, letterSpacing: '0.08em', fontSize: '3.8vh', marginTop: '1vh',
  textShadow: '0 2px 8px rgba(0,0,0,.6)',
};
