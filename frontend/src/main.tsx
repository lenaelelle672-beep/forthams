/**
 * @file main.tsx
 * @description forthAMS 应用入口
 *
 * 提供全局 Provider 包装：
 * - QueryClientProvider (TanStack Query)
 * - AuthProvider (AuthContext)
 * - RouterProvider (React Router 7)
 * - TooltipProvider (Radix UI)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/app/context/AuthContext';
import router from '@/router/index';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
