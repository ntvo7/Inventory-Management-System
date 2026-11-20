import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';
import OperationPage from './pages/OperationPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

// Pages behind the login: sidebar on the left, the current page on the right
function ProtectedLayout() {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <p className="status-msg">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <Outlet />
        <footer className="app-foot">© Starburn Technology · Stop Mini Mart</footer>
      </main>
    </div>
  );
}

function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/operation" element={<OperationPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<AdminOnly><UsersPage /></AdminOnly>} />
        {/* old addresses */}
        <Route path="/dashboard" element={<Navigate to="/operation" replace />} />
        <Route path="/history" element={<Navigate to="/reports?tab=movements" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
