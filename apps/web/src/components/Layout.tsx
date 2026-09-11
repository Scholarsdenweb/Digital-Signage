import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { PERMISSIONS } from '@dsm/shared';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/screens', label: 'Screens' },
  { to: '/content', label: 'Content Library' },
  { to: '/history', label: 'History' },
  { to: '/students', label: 'Students', perm: PERMISSIONS.MANAGE_STUDENTS },
  { to: '/birthday', label: 'Birthday', perm: PERMISSIONS.MANAGE_BIRTHDAY_TEMPLATES },
  { to: '/groups', label: 'Screen Groups', perm: PERMISSIONS.MANAGE_SCREENS },
  { to: '/users', label: 'Users', perm: PERMISSIONS.MANAGE_USERS },
] as const;

export function Layout() {
  const { user, logout, can, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
      <aside style={{ background: '#0b1220', borderRight: '1px solid var(--border)', padding: 18 }}>
        <div style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: 1, marginBottom: 24 }}>
          ◧ SIGNAGE
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.filter((n) => !('perm' in n) || !n.perm || can(n.perm)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={'end' in n ? n.end : false}
              style={({ isActive }) => ({
                padding: '10px 12px',
                borderRadius: 8,
                background: isActive ? 'var(--panel-2)' : 'transparent',
                color: isActive ? '#fff' : 'var(--muted)',
                fontWeight: isActive ? 700 : 500,
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: 13 }}>{user.role}</div>
          <div className="row">
            <span style={{ fontSize: 14 }}>{user.name}</span>
            <button className="ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
