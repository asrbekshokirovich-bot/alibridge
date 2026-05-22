import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, Role } from '@shared/store/auth';
import { LoadingScreen } from '@shared/components/LoadingScreen';

interface RoleGuardProps {
  allowedRoles: Role[];
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { isAuthenticated, isLoading, hasAnyRole, login } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      login().catch(console.error);
    }
  }, [isAuthenticated, isLoading, login]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  if (!hasAnyRole(allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
