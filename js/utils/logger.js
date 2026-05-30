/**
 * Centralized logger that controls console logs in production.
 * debug and log methods are silenced in production, while info, warn, and error remain active.
 */
const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.__ENV__?.MODE === 'development' || 
     window.location.port === '8080');

export const logger = {
    debug(...args) {
        if (isDev) {
            console.debug('[DEBUG]', ...args);
        }
    },
    log(...args) {
        if (isDev) {
            console.log('[LOG]', ...args);
        }
    },
    info(...args) {
        console.info('[INFO]', ...args);
    },
    warn(...args) {
        console.warn('[WARN]', ...args);
    },
    error(...args) {
        console.error('[ERROR]', ...args);
    }
};
