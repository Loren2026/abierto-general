import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from '../public/HomePage'
import LoginPage from '../auth/LoginPage'
import AdminPage from '../admin/AdminPage'

function AgentsPlaceholder() {
  return <Navigate to="/admin" replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/agentes" element={<AgentsPlaceholder />} />
      </Routes>
    </BrowserRouter>
  )
}
