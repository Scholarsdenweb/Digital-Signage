import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Modal, Empty, Spinner } from '../components/ui.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

export function Users() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [show, setShow] = useState(false);

  const load = () => api.get<UserRow[]>('/users').then(setUsers).catch(() => setUsers([]));
  useEffect(() => {
    load();
  }, []);

  async function toggle(u: UserRow) {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Users</h1>
        <button className="primary" onClick={() => setShow(true)}>+ Add User</button>
      </div>
      {!users ? (
        <Spinner />
      ) : users.length === 0 ? (
        <Empty text="No users." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.active ? 'Active' : 'Disabled'}</td>
                  <td>
                    <button className="ghost" onClick={() => toggle(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {show && (
        <AddUser
          onClose={() => setShow(false)}
          onDone={() => {
            setShow(false);
            load();
            toast.push('User created', 'success');
          }}
        />
      )}
    </div>
  );
}

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'HANDLER' });
  async function submit() {
    try {
      await api.post('/users', f);
      onDone();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }
  return (
    <Modal title="Add user" onClose={onClose}>
      <div className="grid">
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input placeholder="Password (min 8 chars)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="HANDLER">Handler</option>
          <option value="ADMIN">Admin</option>
        </select>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={submit}>Create</button>
        </div>
      </div>
    </Modal>
  );
}
