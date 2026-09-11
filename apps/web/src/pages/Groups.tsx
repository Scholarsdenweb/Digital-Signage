import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Empty, Spinner } from '../components/ui.js';

interface Group {
  id: string;
  name: string;
  description: string | null;
  screenCount: number;
}

export function Groups() {
  const toast = useToast();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = () => api.get<Group[]>('/screen-groups').then(setGroups).catch(() => setGroups([]));
  useEffect(() => {
    load();
  }, []);

  async function create() {
    try {
      await api.post('/screen-groups', { name, description });
      setName('');
      setDescription('');
      toast.push('Group created', 'success');
      load();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>Screen Groups</h1>
      <div className="card">
        <div className="row">
          <input placeholder="Group name (e.g. Reception Screens)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="primary" disabled={!name} onClick={create}>Create</button>
        </div>
      </div>
      {!groups ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Empty text="No screen groups yet." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Screens</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.description ?? '—'}</td>
                  <td>{g.screenCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
