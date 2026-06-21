import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';
import { installCrashLogger, logBootDiagnostics, earlyError, earlyLog } from './utils/early-log';

installCrashLogger();
logBootDiagnostics();

try {
  createRoot(document.getElementById('root')!).render(<App />);
  earlyLog('boot.react.mounted');
  setTimeout(() => {
    const main = document.querySelector('[data-app-content]') as HTMLElement | null;
    const ms = main ? getComputedStyle(main) : null;
    earlyLog('boot.spacing', {
      htmlFontSize: getComputedStyle(document.documentElement).fontSize,
      bodyFontSize: getComputedStyle(document.body).fontSize,
      mainPad: ms ? `${ms.paddingTop} ${ms.paddingRight} ${ms.paddingBottom} ${ms.paddingLeft}` : null,
      mainW: main?.clientWidth,
      mainH: main?.clientHeight,
    });
  }, 800);
} catch (err) {
  earlyError('boot.react.mount-failed', err);
  throw err;
}
