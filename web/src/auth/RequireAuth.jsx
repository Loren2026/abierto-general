import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

export default function RequireAuth({ children }) {
  const { user } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children ?? null
}
