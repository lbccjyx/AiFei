import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Montserrat (700/900): bundled locally so text renders in the
// real font immediately instead of flashing a fallback (FOUT) while the
// old Google Fonts request was in flight.
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/900.css';
import './index.css';
import './styles/page.css';
import './lib/pointer';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
