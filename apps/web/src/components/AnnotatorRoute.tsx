import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TaskDetail } from '../pages/TaskDetail';
import { AnnotatorView } from '../pages/AnnotatorView';
import { AppShell } from './AppShell';

interface AnnotatorRouteProps {
  taskId: string;
}

/**
 * Smart route that shows optimized UI based on user role
 * - Annotators: Get focused AnnotatorView (fullscreen, no AppShell)
 * - Admins/Viewers: Get full TaskDetail view (with AppShell)
 */
export function AnnotatorRoute({ taskId }: AnnotatorRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Annotators get the specialized fullscreen UI (no AppShell)
  if (user.role === 'annotator') {
    return <AnnotatorView />;
  }

  // Admins and viewers get the full detail view with navigation
  return (
    <AppShell>
      <TaskDetail />
    </AppShell>
  );
}
