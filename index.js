import { installSafeConsole, safeError } from './src/observability/logger.js';
import { startCharon, stopCharon } from './src/app.js';

installSafeConsole();

process.on('unhandledRejection', (reason) => {
  safeError('[fatal] unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  safeError('[fatal] uncaughtException', error);
  stopCharon('uncaughtException').finally(() => process.exit(1));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopCharon(signal).finally(() => process.exit(0));
  });
}

startCharon().catch((error) => {
  safeError(error);
  process.exit(1);
});
