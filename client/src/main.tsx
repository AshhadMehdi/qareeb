import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import { RealtimeProvider } from './lib/realtime';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Qareeb could not find its mount point');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RealtimeProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#fdfbf6',
                border: '1px solid #e7dabd',
                color: '#1d1c17',
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              },
            }}
          />
        </RealtimeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// Installable PWA. Registered in production builds only so the dev server keeps
// serving fresh modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
