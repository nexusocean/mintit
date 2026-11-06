import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/400-italic.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Providers from './providers';
import ChainGate from './components/ChainGate';
import { PageLoader } from './components/PageLoader';
import { RedirectIfAuthed, RequireAuth } from './components/AuthGuards';
import { WalletSyncGate } from './components/WalletSyncGate';

const Login = lazy(() => import('./pages/Login'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Overview = lazy(() => import('./pages/Overview'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceNew = lazy(() => import('./pages/InvoiceNew'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

createRoot(document.getElementById('root')!).render(
  <Providers>
    <ChainGate>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<RedirectIfAuthed />}>
              <Route element={<WalletSyncGate />}>
                <Route path="/login" element={<Login />} />
              </Route>
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<Overview />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="invoices/new" element={<InvoiceNew />} />
                <Route path="invoices/:publicId" element={<InvoiceDetail />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ChainGate>
  </Providers>,
);
