export function Disabled() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#111827',
        color: '#f87171',
        fontFamily: 'sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 700 }}>Device Disabled</div>
        <div style={{ marginTop: 12, color: '#9ca3af' }}>
          This screen has been disabled by an administrator.
        </div>
      </div>
    </div>
  );
}
