import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../store/toast.js';
import { Modal, Empty, Spinner } from '../components/ui.js';

interface Student {
  id: string;
  studentCode: string;
  name: string;
  dateOfBirth: string;
  batch: string | null;
  course: string | null;
}

export function Students() {
  const toast = useToast();
  const [items, setItems] = useState<Student[] | null>(null);
  const [show, setShow] = useState(false);

  const load = () => api.get<Student[]>('/students').then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Students</h1>
        <button className="primary" onClick={() => setShow(true)}>+ Add Student</button>
      </div>
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="No students. Add students so birthdays generate automatically." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>DOB</th>
                <th>Batch</th>
                <th>Course</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.studentCode}</td>
                  <td>{s.name}</td>
                  <td>{new Date(s.dateOfBirth).toLocaleDateString()}</td>
                  <td>{s.batch ?? '—'}</td>
                  <td>{s.course ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {show && (
        <AddStudent
          onClose={() => setShow(false)}
          onDone={() => {
            setShow(false);
            load();
            toast.push('Student added', 'success');
          }}
        />
      )}
    </div>
  );
}

function AddStudent({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ studentCode: '', name: '', dateOfBirth: '', batch: '', course: '' });
  async function submit() {
    try {
      await api.post('/students', f);
      onDone();
    } catch (e: any) {
      toast.push(e.message, 'error');
    }
  }
  return (
    <Modal title="Add student" onClose={onClose}>
      <div className="grid">
        <input placeholder="Student code" value={f.studentCode} onChange={(e) => setF({ ...f, studentCode: e.target.value })} />
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="muted" style={{ fontSize: 13 }}>Date of birth</label>
        <input type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} />
        <input placeholder="Batch" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} />
        <input placeholder="Course" value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={submit}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
