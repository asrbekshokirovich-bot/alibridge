import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth'
import type { Role } from '@/shared/types'

interface Props {
  role: Role | Role[]
  children: React.ReactNode
}

export function RoleGuard({ role, children }: Props) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  // Token yo'q (o'chirilgan/qaytib kelgan user) — stale user bilan kirsa API 401 beradi
  if (!token || !user) return <Navigate to="/welcome" replace />

  // Admin istalgan panelga kira oladi (rol sifatida ko'rish)
  if (user.role === 'admin') return <>{children}</>

  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(user.role)) return <Navigate to="/unauthorized" replace />

  return <>{children}</>
}
