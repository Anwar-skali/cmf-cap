import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryCache, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { AuthProvider } from '@/stores/authStore';
import { ThemeProvider } from '@/stores/themeStore';
import { SidebarProvider } from '@/stores/sidebarStore';
import { getErrorMessage } from '@/hooks/useApiError';
import App from '@/App';
import '@/index.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 60_000,
      throwOnError: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <App />
              <Toaster
                richColors
                closeButton
                position="top-right"
                duration={4000}
              />
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
