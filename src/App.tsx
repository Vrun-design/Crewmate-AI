import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { RouteLoader } from './components/shared/RouteLoader';

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
const activityLogRoute = createLazyRoute(() => import('./pages/ActivityLog'), 'ActivityLog');
const integrationsRoute = createLazyRoute(() => import('./pages/Integrations'), 'Integrations');
const accountRoute = createLazyRoute(() => import('./pages/Account'), 'Account');
const notificationsRoute = createLazyRoute(() => import('./pages/Notifications'), 'Notifications');
const skillsRoute = createLazyRoute(() => import('./pages/Skills'), 'Skills');
const delegationsRoute = createLazyRoute(() => import('./pages/Delegations'), 'Delegations');
const creativeStudioRoute = createLazyRoute(() => import('./pages/CreativeStudio'), 'CreativeStudio');
const loginRoute = createLazyRoute(() => import('./pages/auth/Login'), 'Login');
const verifyRoute = createLazyRoute(() => import('./pages/auth/Verify'), 'Verify');
const onboardingRoute = createLazyRoute(() => import('./pages/auth/Onboarding'), 'Onboarding');
const personasRoute = createLazyRoute(() => import('./pages/Personas'), 'Personas');
const agentsRoute = createLazyRoute(() => import('./pages/Agents'), 'Agents');
const skillBuilderRoute = createLazyRoute(() => import('./pages/SkillBuilder'), 'SkillBuilder');

const preloadRoutes = [
  dashboardRoute,
  memoryBaseRoute,
  sessionsRoute,
  tasksRoute,
  activityLogRoute,
  integrationsRoute,
  accountRoute,
  notificationsRoute,
  skillsRoute,
  delegationsRoute,
  creativeStudioRoute,
  loginRoute,
  verifyRoute,
  onboardingRoute,
  personasRoute,
  agentsRoute,
  skillBuilderRoute,
];

export default function App() {
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
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<loginRoute.Component />} />
          <Route path="/verify" element={<verifyRoute.Component />} />
          <Route path="/onboarding" element={<onboardingRoute.Component />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<dashboardRoute.Component />} />
            <Route path="/memory" element={<memoryBaseRoute.Component />} />
            <Route path="/sessions" element={<sessionsRoute.Component />} />
            <Route path="/tasks" element={<tasksRoute.Component />} />
            <Route path="/activity" element={<activityLogRoute.Component />} />
            <Route path="/delegations" element={<delegationsRoute.Component />} />
            <Route path="/studio" element={<creativeStudioRoute.Component />} />
            <Route path="/integrations" element={<integrationsRoute.Component />} />
            <Route path="/account" element={<accountRoute.Component />} />
            <Route path="/notifications" element={<notificationsRoute.Component />} />
            <Route path="/skills" element={<skillsRoute.Component />} />
            <Route path="/personas" element={<personasRoute.Component />} />
            <Route path="/agents" element={<agentsRoute.Component />} />
            <Route path="/skills/build" element={<skillBuilderRoute.Component />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
