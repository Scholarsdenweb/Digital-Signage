import { useEffect, useRef, useState } from 'react';
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

// Minimal CSV parser: handles quoted fields and commas inside quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((c) => c.trim() !== '')) rows.push(row); }
  return rows;
}

export function Students() {
  const toast = useToast();
  const [items, setItems] = useState<Student[] | null>(null);
  const [show, setShow] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.get<Student[]>('/students').then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  function downloadSample() {
    const csv =
      'studentCode,name,dateOfBirth,batch,course\n' +
      'STU-101,Rahul Sharma,2008-09-15,NEET 2026,Biology\n' +
      'STU-102,Aman Verma,2007-09-15,JEE 2026,Physics\n' +
      'STU-103,Priya Singh,2008-01-15,NEET 2026,Chemistry\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-sample.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('CSV has no data rows');
      // Map header columns (case/space-insensitive) to fields.
      const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
      const col = (names: string[]) => header.findIndex((h) => names.includes(h));
      const iCode = col(['studentcode', 'code', 'id', 'studentid']);
      const iName = col(['name', 'studentname']);
      const iDob = col(['dateofbirth', 'dob', 'birthdate', 'birthday']);
      const iBatch = col(['batch']);
      const iCourse = col(['course']);
      if (iCode < 0 || iName < 0 || iDob < 0)
        throw new Error('CSV needs columns: studentCode, name, dateOfBirth (YYYY-MM-DD)');

      const students = rows.slice(1).map((r, idx) => {
        const dobRaw = (r[iDob] ?? '').trim();
        // accept YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
        let dob = dobRaw;
        const m = dobRaw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (m) dob = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob))
          throw new Error(`Row ${idx + 2}: bad date "${dobRaw}" (use YYYY-MM-DD)`);
        return {
          studentCode: (r[iCode] ?? '').trim(),
          name: (r[iName] ?? '').trim(),
          dateOfBirth: dob,
          batch: iBatch >= 0 ? (r[iBatch] ?? '').trim() || undefined : undefined,
          course: iCourse >= 0 ? (r[iCourse] ?? '').trim() || undefined : undefined,
        };
      });

      const res = await api.post<{ created: number; updated: number; total: number }>('/students/bulk', { students });
      toast.push(`Imported ${res.total} students (${res.created} new, ${res.updated} updated)`, 'success');
      load();
    } catch (err: any) {
      toast.push(err.message ?? 'Import failed', 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Students</h1>
        <div className="row">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onCsv} style={{ display: 'none' }} />
          <button className="ghost" onClick={downloadSample}>⬇ Sample CSV</button>
          <button className="ghost" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? 'Importing…' : '⬆ Import CSV'}
          </button>
          <button className="primary" onClick={() => setShow(true)}>+ Add Student</button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        CSV columns: <b>studentCode, name, dateOfBirth</b> (YYYY-MM-DD), optional <b>batch, course</b>. Existing codes are
        updated. Download the <b>Sample CSV</b> to see the exact format.
      </p>
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
