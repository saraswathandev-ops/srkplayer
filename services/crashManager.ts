import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { resetDatabase } from './database';
import { DEFAULT_PLAYER_SETTINGS, PLAYER_STORAGE_KEYS } from '@/types/player';

const CRASH_COUNT_KEY = '@app_crash_count';
export const CRASH_RECOVERY_LEVEL_KEY = '@app_crash_recovery_level';
const SUCCESSFUL_STARTUP_TIMEOUT = 10000; // 10 seconds
export const LOG_FILE_PATH = `${RNFS.DocumentDirectoryPath}/crash_logs.txt`;

function toError(input: unknown): Error {
  if (input instanceof Error) return input;
  return new Error(typeof input === 'string' ? input : JSON.stringify(input));
}

async function appendLog(entry: string): Promise<void> {
  await RNFS.appendFile(LOG_FILE_PATH, entry, 'utf8').catch(() => {});
}

export async function logMessage(type: string, message: string, context?: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `
--------------------------------------
TIMESTAMP: ${timestamp}
TYPE: ${type}
MESSAGE: ${message}
CONTEXT: ${context ?? '(none)'}
--------------------------------------
\n`;
  await appendLog(logEntry);
}

export async function recordFatalCrash(error: unknown, context?: string): Promise<void> {
  const safeError = toError(error);
  try {
    const countStr = await AsyncStorage.getItem(CRASH_COUNT_KEY);
    const count = countStr ? parseInt(countStr, 10) : 0;
    await AsyncStorage.setItem(CRASH_COUNT_KEY, (count + 1).toString());

    const timestamp = new Date().toISOString();
    const logEntry = `
--------------------------------------
TIMESTAMP: ${timestamp}
TYPE: FATAL EXCEPTION
MESSAGE: ${safeError.message}
CONTEXT: ${context ?? '(none)'}
STACK:
${safeError.stack ?? '(no stack)'}
--------------------------------------
\n`;
    
    // Explicitly print to terminal for dev debugging
    if (__DEV__) {
      console.error(`🚨 [FATAL CRASH] ${context ?? 'Unknown'}\n${safeError.message}\n${safeError.stack}`);
    }

    await appendLog(logEntry);
  } catch {
    // Prevent recursive crash handling failures.
  }
}

export async function forceResetApp() {
  await logMessage('USER ACTION', 'Manual force reset triggered.');
  await resetDatabase();
  await AsyncStorage.clear();
}

/**
 * Checks the crash loop counter on startup.
 * Recovery is deliberately conservative: do not wipe the user's media library
 * automatically for a likely UI/startup crash loop.
 */
export async function checkAndHandleCrashLoop() {
  try {
    const countStr = await AsyncStorage.getItem(CRASH_COUNT_KEY);
    const count = countStr ? parseInt(countStr, 10) : 0;
    
    if (count >= 5) {
      await AsyncStorage.setItem(CRASH_RECOVERY_LEVEL_KEY, 'manual-db-reset-recommended');
      await logMessage(
        'SYSTEM',
        'Crash loop reached 5 consecutive crashes. Database was preserved; manual reset is recommended if the app still fails.'
      );
      console.warn("App has crashed 5 times in a row. Preserving library; manual reset recommended.");
      return true;
    }

    if (count >= 4) {
      await AsyncStorage.setItem(CRASH_RECOVERY_LEVEL_KEY, 'heavy-startup-disabled');
      await logMessage(
        'SYSTEM',
        'Crash loop reached 4 consecutive crashes. Preserving database and disabling risky startup work for recovery.'
      );
      console.warn("App has crashed 4 times in a row. Preserving library and entering recovery mode.");
      return true;
    }

    if (count >= 3) {
      await AsyncStorage.setItem(CRASH_RECOVERY_LEVEL_KEY, 'settings-reset');
      await AsyncStorage.setItem(
        PLAYER_STORAGE_KEYS.settings,
        JSON.stringify(DEFAULT_PLAYER_SETTINGS)
      );
      await logMessage(
        'SYSTEM',
        'Crash loop reached 3 consecutive crashes. Reset settings only; database and media library were preserved.'
      );
      console.warn("App has crashed 3 times in a row. Reset settings only; preserving library.");
      return true;
    } else if (count > 0) {
      // If the app started successfully and didn't crash within the timeout,
      // we assume stability and reset the crash count back to 0.
      setTimeout(() => {
        AsyncStorage.multiRemove([CRASH_COUNT_KEY, CRASH_RECOVERY_LEVEL_KEY]).catch(() => {});
      }, SUCCESSFUL_STARTUP_TIMEOUT);
    }
    
    return false;
  } catch (error) {
    console.error("Failed to check crash loop:", error);
    return false;
  }
}

/**
 * Attaches a global error handler to track crashes in the JS thread and save them to a file.
 */
export function setupGlobalCrashHandler() {
  const errorUtils = (globalThis as { ErrorUtils?: {
    getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;
  if (!errorUtils || typeof errorUtils.getGlobalHandler !== 'function') {
    console.warn("Global crash handler could not be set up.");
    return;
  }

  const defaultErrorHandler = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler(async (error, isFatal) => {
    if (isFatal) {
      await recordFatalCrash(error, 'Global JS exception handler');
    }
    
    // Call the original React Native crash handler to display the redbox or crash natively
    if (typeof defaultErrorHandler === "function") {
      defaultErrorHandler(error, isFatal);
    }
  });

}

/**
 * Appends a non-fatal error entry to the persistent crash log file.
 * Safe to call from ErrorBoundary or any error handler.
 */
export async function logCrash(error: Error, context?: string): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `
--------------------------------------
TIMESTAMP: ${timestamp}
TYPE: NON-FATAL / RENDER ERROR
MESSAGE: ${error.message}
CONTEXT: ${context ?? '(none)'}
STACK:
${error.stack ?? '(no stack)'}
--------------------------------------
\n`;

    if (__DEV__) {
      console.error(`🚨 [RENDER CRASH / NON-FATAL] ${context ?? 'Unknown'}\n${error.message}\n${error.stack}`);
    }

    await appendLog(logEntry);
  } catch {
    // Prevent recursive crash in error handler
  }
}

/**
 * Reads the entire crash log file.
 */
export async function getCrashLogs(): Promise<string> {
  try {
    const exists = await RNFS.exists(LOG_FILE_PATH);
    if (!exists) return "No crash logs found.";
    return await RNFS.readFile(LOG_FILE_PATH, 'utf8');
  } catch (error) {
    return `Error reading logs: ${error}`;
  }
}

/**
 * Deletes the crash log file.
 */
export async function clearCrashLogs() {
  try {
    const exists = await RNFS.exists(LOG_FILE_PATH);
    if (exists) {
      await RNFS.unlink(LOG_FILE_PATH);
    }
  } catch (error) {
    console.error("Failed to clear crash logs:", error);
  }
}
