import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Center, Loader } from '@mantine/core';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'annotator' | 'viewer';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole) {
    const roleHierarchy = { admin: 3, annotator: 2, viewer: 1 };
    if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
      return <Navigate to="/tasks" replace />;
    }
  }

  return <>{children}</>;
}
