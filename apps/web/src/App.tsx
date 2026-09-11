import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Screens } from './pages/Screens.js';
import { ScreenDetail } from './pages/ScreenDetail.js';
import { ContentLibrary } from './pages/ContentLibrary.js';
import { History } from './pages/History.js';
import { Students } from './pages/Students.js';
import { Birthday } from './pages/Birthday.js';
import { Groups } from './pages/Groups.js';
import { Users } from './pages/Users.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="screens" element={<Screens />} />
        <Route path="screens/:screenId" element={<ScreenDetail />} />
        <Route path="content" element={<ContentLibrary />} />
        <Route path="history" element={<History />} />
        <Route path="students" element={<Students />} />
        <Route path="birthday" element={<Birthday />} />
        <Route path="groups" element={<Groups />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  );
}
