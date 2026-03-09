import React, {Suspense, lazy} from 'react';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {MainLayout} from './components/layout/MainLayout';
import {RouteLoader} from './components/shared/RouteLoader';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({default: module.Dashboard})));
const MemoryBase = lazy(() => import('./pages/MemoryBase').then((module) => ({default: module.MemoryBase})));
const Sessions = lazy(() => import('./pages/Sessions').then((module) => ({default: module.Sessions})));
const Tasks = lazy(() => import('./pages/Tasks').then((module) => ({default: module.Tasks})));
const ActivityLog = lazy(() => import('./pages/ActivityLog').then((module) => ({default: module.ActivityLog})));
const Integrations = lazy(() => import('./pages/Integrations').then((module) => ({default: module.Integrations})));
const Account = lazy(() => import('./pages/Account').then((module) => ({default: module.Account})));
const Notifications = lazy(() => import('./pages/Notifications').then((module) => ({default: module.Notifications})));
const Skills = lazy(() => import('./pages/Skills').then((module) => ({default: module.Skills})));
const Delegations = lazy(() => import('./pages/Delegations').then((module) => ({default: module.Delegations})));
const CreativeStudio = lazy(() => import('./pages/CreativeStudio').then((module) => ({default: module.CreativeStudio})));
const Login = lazy(() => import('./pages/auth/Login').then((module) => ({default: module.Login})));
const Verify = lazy(() => import('./pages/auth/Verify').then((module) => ({default: module.Verify})));
const Onboarding = lazy(() => import('./pages/auth/Onboarding').then((module) => ({default: module.Onboarding})));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/memory" element={<MemoryBase />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="/delegations" element={<Delegations />} />
            <Route path="/studio" element={<CreativeStudio />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/account" element={<Account />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/skills" element={<Skills />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
