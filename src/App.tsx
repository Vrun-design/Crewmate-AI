import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AppErrorBoundary } from './components/shared/AppErrorBoundary';
import { RouteLoader } from './components/shared/RouteLoader';
import { TaskToastListener } from './components/tasks/TaskToastListener';
import { LiveSessionProvider } from './contexts/LiveSessionContext';
import { ToastProvider } from './contexts/ToastContext';

function AuthenticatedShell() {
  return (
    <LiveSessionProvider>
      <TaskToastListener />
      <MainLayout />
    </LiveSessionProvider>
  );
}

function createLazyRoute<TModule extends Record<string, unknown>, TKey extends keyof TModule & string>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  const Component = lazy(() => loader().then((module) => ({ default: module[exportName] as React.ComponentType })));
  return {
    Component,
    preload: loader,
  };
}

const dashboardRoute = createLazyRoute(() => import('./pages/Dashboard'), 'Dashboard');
const memoryBaseRoute = createLazyRoute(() => import('./pages/MemoryBase'), 'MemoryBase');
const sessionsRoute = createLazyRoute(() => import('./pages/Sessions'), 'Sessions');
const tasksRoute = createLazyRoute(() => import('./pages/Tasks'), 'Tasks');
const integrationsRoute = createLazyRoute(() => import('./pages/Integrations'), 'Integrations');
const accountRoute = createLazyRoute(() => import('./pages/Account'), 'Account');
const notificationsRoute = createLazyRoute(() => import('./pages/Notifications'), 'Notifications');
const skillsRoute = createLazyRoute(() => import('./pages/Skills'), 'Skills');
const loginRoute = createLazyRoute(() => import('./pages/auth/Login'), 'Login');
const verifyRoute = createLazyRoute(() => import('./pages/auth/Verify'), 'Verify');
const agentsRoute = createLazyRoute(() => import('./pages/Agents'), 'Agents');
const onboardingRoute = createLazyRoute(() => import('./pages/Onboarding'), 'Onboarding');

const preloadRoutes = [
  dashboardRoute,
  memoryBaseRoute,
  sessionsRoute,
  tasksRoute,
  integrationsRoute,
  accountRoute,
  notificationsRoute,
  skillsRoute,
  loginRoute,
  verifyRoute,
  agentsRoute,
  onboardingRoute,
];

export default function App() {
  useEffect(() => {
    // Redirect to login whenever an API call receives a 401 and the
    // api.ts layer fires this event after clearing the local session.
    function handleAuthExpired() {
      window.location.href = '/login';
    }

    window.addEventListener('crewmate:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('crewmate:auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const preloadAll = () => {
      preloadRoutes.forEach((route) => {
        void route.preload();
      });
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadAll);
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(preloadAll, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <AppErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/login" element={<loginRoute.Component />} />
              <Route path="/verify" element={<verifyRoute.Component />} />
              <Route element={<AuthenticatedShell />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<dashboardRoute.Component />} />
                <Route path="/memory" element={<memoryBaseRoute.Component />} />
                <Route path="/sessions" element={<sessionsRoute.Component />} />
                <Route path="/tasks" element={<tasksRoute.Component />} />
                <Route path="/integrations" element={<integrationsRoute.Component />} />
                <Route path="/account" element={<accountRoute.Component />} />
                <Route path="/notifications" element={<notificationsRoute.Component />} />
                <Route path="/skills" element={<skillsRoute.Component />} />
                <Route path="/agents" element={<agentsRoute.Component />} />
                <Route path="/onboarding" element={<onboardingRoute.Component />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AppErrorBoundary>
  );
}
