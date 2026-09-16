import { useMemo } from 'react';

/**
 * Permanent, code-defined birthday design rendered entirely in the player (no
 * uploaded image). The student's name / date / batch are filled in and animated:
 * layered spotlights, bokeh, twinkling sparkles, falling confetti, a neon ribbon,
 * a glowing "HAPPY" and cursive "Birthday". Fully original artwork. Works offline.
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
    const colors = ['#f472b6', '#c084fc', '#60a5fa', '#22d3ee', '#fde047', '#f87171', '#ffffff', '#a855f7'];
    return Array.from({ length: 80 }, (_, i) => ({
      left: Math.random() * 100,
      delay: -Math.random() * 10,
      dur: 5 + Math.random() * 7,
      w: 5 + Math.random() * 7,
      h: 9 + Math.random() * 14,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
      streamer: Math.random() < 0.18,
    }));
  }, []);

  const orbs = useMemo(() => {
    const colors = ['#a855f7', '#ec4899', '#3b82f6', '#22d3ee', '#f5d0fe'];
    return Array.from({ length: 22 }, (_, i) => ({
      left: Math.random() * 100,
      top: 40 + Math.random() * 58,
      size: 3 + Math.random() * 10,
      color: colors[i % colors.length],
      op: 0.12 + Math.random() * 0.3,
      delay: -Math.random() * 6,
    }));
  }, []);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 62,
        size: 10 + Math.random() * 22,
        delay: -Math.random() * 4,
        dur: 2.4 + Math.random() * 2.6,
      })),
    [],
  );

  return (
    <div style={STAGE}>
      <style>{CSS}</style>

      {/* spotlight beams (screen-blended light) */}
      <div style={BEAMS} aria-hidden>
        <div style={{ ...BEAM, left: '16%', background: 'linear-gradient(180deg,rgba(168,85,247,.6),transparent 72%)' }} />
        <div style={{ ...BEAM, left: '38%', background: 'linear-gradient(180deg,rgba(59,130,246,.5),transparent 72%)' }} />
        <div style={{ ...BEAM, left: '62%', background: 'linear-gradient(180deg,rgba(236,72,153,.55),transparent 72%)' }} />
        <div style={{ ...BEAM, left: '84%', background: 'linear-gradient(180deg,rgba(245,200,80,.45),transparent 72%)' }} />
      </div>

      {/* bokeh orbs */}
      <div style={LAYER} aria-hidden>
        {orbs.map((o, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${o.left}%`,
              top: `${o.top}%`,
              width: `${o.size}vh`,
              height: `${o.size}vh`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
              opacity: o.op,
              filter: 'blur(2px)',
              animation: `bd-pulse ${4 + (i % 4)}s ease-in-out ${o.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* twinkling sparkles */}
      <div style={LAYER} aria-hidden>
        {sparkles.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animation: `bd-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          >
            <div style={SPARKLE_A} />
            <div style={SPARKLE_B} />
          </div>
        ))}
      </div>

      {/* neon ribbon behind the title */}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={LAYER} aria-hidden>
        <defs>
          <filter id="bd-neon" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M 70 585 C 540 775 800 735 960 645 C 1120 735 1380 775 1850 585" fill="none"
          stroke="#d946ef" strokeWidth="10" strokeLinecap="round" filter="url(#bd-neon)" opacity="0.9" />
        <path d="M 70 585 C 540 775 800 735 960 645 C 1120 735 1380 775 1850 585" fill="none"
          stroke="#fce7ff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      </svg>

      {/* confetti */}
      <div style={LAYER} aria-hidden>
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-14vh',
              left: `${c.left}%`,
              width: c.streamer ? 3 : c.w,
              height: c.streamer ? c.h * 2.4 : c.h,
              background: c.color,
              borderRadius: c.streamer ? 3 : 2,
              transform: `rotate(${c.rot}deg)`,
              animation: `bd-fall ${c.dur}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* vignette */}
      <div style={VIGNETTE} aria-hidden />

      {/* content */}
      <div style={CONTENT}>
        {dateText && <div style={DATE}>{dateText}</div>}
        <div style={TITLE_GROUP}>
          <div style={HAPPY}>HAPPY</div>
          <div style={SCRIPT}>Birthday</div>
        </div>
        <div style={NAME_WRAP}>
          <div style={NAME}>{name}</div>
          {batch && <div style={BATCH}>{batch}</div>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Pacifico&family=Poppins:wght@700;800;900&display=swap');
@keyframes bd-fall { 0%{transform:translateY(-14vh) rotate(0);} 100%{transform:translateY(122vh) rotate(760deg);} }
@keyframes bd-glow { 0%,100%{text-shadow:0 0 20px rgba(217,70,239,.6),0 0 46px rgba(217,70,239,.35);} 50%{text-shadow:0 0 34px rgba(217,70,239,.95),0 0 80px rgba(217,70,239,.6);} }
@keyframes bd-white { 0%,100%{text-shadow:0 0 16px rgba(255,255,255,.45),0 6px 14px rgba(0,0,0,.55);} 50%{text-shadow:0 0 40px rgba(255,255,255,.95),0 6px 14px rgba(0,0,0,.55);} }
@keyframes bd-in { 0%{opacity:0;transform:translateY(30px) scale(.9);} 100%{opacity:1;transform:none;} }
@keyframes bd-down { 0%{opacity:0;transform:translateY(-24px);} 100%{opacity:1;transform:none;} }
@keyframes bd-float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-1.4vh);} }
@keyframes bd-pulse { 0%,100%{transform:scale(1);opacity:.55;} 50%{transform:scale(1.25);opacity:1;} }
@keyframes bd-twinkle { 0%,100%{opacity:0;transform:scale(.5) rotate(0deg);} 50%{opacity:1;transform:scale(1) rotate(90deg);} }
`;

const FONT = "'Poppins','Segoe UI',Arial,Helvetica,sans-serif";

const STAGE: React.CSSProperties = {
  width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative',
  background: 'radial-gradient(80% 80% at 50% 40%, #35134f 0%, #1a0b30 52%, #070210 100%)',
  fontFamily: FONT,
};
const LAYER: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' };
const BEAMS: React.CSSProperties = { ...LAYER, mixBlendMode: 'screen' };
const BEAM: React.CSSProperties = {
  position: 'absolute', top: 0, width: '15vw', height: '95vh',
  transform: 'translateX(-50%)', clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)',
  filter: 'blur(10px)',
};
const VIGNETTE: React.CSSProperties = { ...LAYER, background: 'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,.55) 100%)' };
const SPARKLE_A: React.CSSProperties = { position: 'absolute', left: '48%', top: 0, width: '4%', height: '100%', background: '#fff', boxShadow: '0 0 8px #fff', borderRadius: 2 };
const SPARKLE_B: React.CSSProperties = { position: 'absolute', top: '48%', left: 0, width: '100%', height: '4%', background: '#fff', boxShadow: '0 0 8px #fff', borderRadius: 2 };

const CONTENT: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const DATE: React.CSSProperties = {
  position: 'absolute', top: '7%', color: '#ffe6a3', fontWeight: 700, letterSpacing: '0.5em',
  fontSize: 'min(3.2vh, 3vw)', textShadow: '0 2px 10px rgba(0,0,0,.6)', animation: 'bd-down 1s ease-out both',
  paddingLeft: '0.5em',
};
const TITLE_GROUP: React.CSSProperties = { animation: 'bd-float 6s ease-in-out infinite', marginTop: '-4vh' };
const HAPPY: React.CSSProperties = {
  color: '#fff', fontWeight: 900, letterSpacing: '0.05em', fontSize: 'min(21vh, 22vw)', lineHeight: 0.95,
  animation: 'bd-in .9s cubic-bezier(.2,.8,.2,1) both, bd-white 3.2s ease-in-out 1s infinite',
};
const SCRIPT: React.CSSProperties = {
  color: '#f5b8ff', fontFamily: "'Pacifico','Segoe Script','Brush Script MT',cursive",
  fontSize: 'min(18vh, 34vw)', lineHeight: 0.9, marginTop: '-2vh',
  animation: 'bd-in 1.1s cubic-bezier(.2,.8,.2,1) .15s both, bd-glow 2.8s ease-in-out 1s infinite',
};
const NAME_WRAP: React.CSSProperties = { position: 'absolute', top: '76%', left: 0, right: 0, animation: 'bd-in 1.1s cubic-bezier(.2,.8,.2,1) .3s both' };
const NAME: React.CSSProperties = {
  color: '#fff', fontWeight: 800, letterSpacing: '0.06em', fontSize: 'min(6.6vh, 8vw)', lineHeight: 1.05,
  padding: '0 6vw', animation: 'bd-white 2.8s ease-in-out infinite',
};
const BATCH: React.CSSProperties = { color: '#e9d5ff', fontWeight: 700, letterSpacing: '0.14em', fontSize: 'min(3.4vh, 4vw)', marginTop: '1.4vh', textTransform: 'uppercase', textShadow: '0 2px 8px rgba(0,0,0,.6)' };
