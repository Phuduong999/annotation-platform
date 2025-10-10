import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TaskList } from './pages/TaskList';
import { TaskDetail } from './pages/TaskDetail';
import { Import } from './pages/Import';
import { ApiDocs } from './pages/ApiDocs';
import { Analytics } from './pages/Analytics';
import { Export } from './pages/Export';
import { Reviews } from './pages/Reviews';
import { Feedback } from './pages/Feedback';
import { Alerts } from './pages/Alerts';
import { AppShell } from './components/AppShell';

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
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/tasks" replace />} />
                <Route path="/import" element={<Import />} />
                <Route path="/tasks" element={<TaskList />} />
                <Route path="/tasks/:id" element={<TaskDetail />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/export" element={<Export />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/api-docs" element={<ApiDocs />} />
              </Routes>
            </AppShell>
          </BrowserRouter>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;
