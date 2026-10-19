import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import './index.css';
import { PrefsProvider } from './lib/prefs';
import { SessionProvider } from './lib/session';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <PrefsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </PrefsProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
