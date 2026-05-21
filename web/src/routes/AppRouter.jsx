import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from '../public/HomePage'
import LoginPage from '../auth/LoginPage'
import RequireAuth from '../auth/RequireAuth'
import AdminPage from '../admin/AdminPage'
import AgentsPage from '../admin/AgentsPage'
import WorkspacePage from '../admin/WorkspacePage'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/agentes"
          element={
            <RequireAuth>
              <AgentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/workspace"
          element={
            <RequireAuth>
              <WorkspacePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
