import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/auth'
import { IS_DEV } from '@/shared/config'
import type { Role } from '@/shared/types'

interface Props {
  role: Role | Role[]
  children: React.ReactNode
}

export function RoleGuard({ role, children }: Props) {
  const user = useAuthStore((s) => s.user)

  // Login bo'lmagan — dev'da /dev panelga, aks holda /welcome
  if (!user) return <Navigate to={IS_DEV ? '/dev' : '/welcome'} replace />

  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(user.role)) return <Navigate to="/unauthorized" replace />

  return <>{children}</>
}
