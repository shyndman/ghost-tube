import { AppHandler } from './app-handler';

// Global instance management
declare global {
  interface Window {
    appHandler: AppHandler | null;
  }
}

// Create single AppHandler instance
window.appHandler = new AppHandler();

// Cleanup function for app shutdown
function destroyAppHandler() {
  console.info('[HASS] Destroying global AppHandler...');
  if (window.appHandler) {
    try {
      window.appHandler.destroy();
    } catch (error) {
      console.error('[HASS] Error destroying AppHandler:', error);
    }
    window.appHandler = null;
  }
}

// Optional: Add cleanup on page unload
window.addEventListener('beforeunload', destroyAppHandler);
