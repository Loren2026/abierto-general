import { useNavigate } from 'react-router-dom'
import Header from './Header'

export default function AdminLayout({ children, title = 'Panel Loren', onLogout }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout()
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-layout">
      <Header privateArea title={title} onLogout={handleLogout} />
      {children}
    </div>
  )
}
