import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TaskList } from './pages/TaskList';
import { TaskDetail } from './pages/TaskDetail';
import { AnnotatorView } from './pages/AnnotatorView';
import { Import } from './pages/Import';
import { ApiDocs } from './pages/ApiDocs';
import { Analytics } from './pages/Analytics';
import { Export } from './pages/Export';
import { Reviews } from './pages/Reviews';
import { Feedback } from './pages/Feedback';
import { Alerts } from './pages/Alerts';
import { Login } from './pages/Login';
import { AppShell } from './components/AppShell';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AnnotatorRoute } from './components/AnnotatorRoute';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ModalsProvider>
          <Notifications position="top-right" />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Navigate to="/tasks" replace />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/import"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Import />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <TaskList />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks/:id"
                  element={
                    <ProtectedRoute>
                      <AnnotatorRoute taskId="" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Analytics />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/export"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Export />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reviews"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Reviews />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/feedback"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <Feedback />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AppShell>
                        <Alerts />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/api-docs"
                  element={
                    <ProtectedRoute>
                      <AppShell>
                        <ApiDocs />
                      </AppShell>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;
