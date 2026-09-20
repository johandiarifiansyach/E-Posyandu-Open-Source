// SPDX-License-Identifier: GPL-3.0-or-later


import { createRoot } from 'react-dom/client';
import App from './App';
import { reportClientError } from './api/dashboardApi';
import { setupProblemReporter } from './ui/problemReporter';
import './compat/styles/index.css';
import ErrorBoundary from './app/ErrorBoundary';
import PerformanceProfiler from './app/PerformanceProfiler';

const root = document.getElementById('root');
if (!root) throw new Error('Root element tidak ditemukan.');

// The application intentionally has one light appearance. Clear any stale
// theme attribute left by older builds before React mounts.
document.documentElement.dataset.theme = 'light';
// Keep translucent glass surfaces in the same light material on browsers that
// otherwise apply automatic darkening when the device is in dark mode.
document.documentElement.style.colorScheme = 'only light';

const problemReporter = setupProblemReporter({
  report: (payload) => reportClientError(payload.error, `${payload.source}.manual`, { suppressErrors: false })
});

window.addEventListener('error', (event) => {
  if (event.filename) {
    try {
      if (new URL(event.filename, window.location.href).origin !== window.location.origin) return;
    } catch {
      return;
    }
  }
  const error = event.error || new Error(event.message || 'Unhandled window error');
  problemReporter.capture(error, 'window.error');
  void reportClientError(error, 'window.error');
});

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error('Unhandled promise rejection');
  problemReporter.capture(error, 'window.unhandledrejection');
  void reportClientError(error, 'window.unhandledrejection');
});

createRoot(root).render(
  <PerformanceProfiler id="E-Posyandu App">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </PerformanceProfiler>,
);
