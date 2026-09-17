/**
 * BETGURU Real-Time System Error & Crash Diagnostics Engine
 * Captures all JavaScript runtime errors, Promise rejections, React crashes, and Firestore exceptions.
 * Automatically saves locally and syncs to Firestore `system_crash_logs` for live Admin notifications.
 */

import { SystemErrorLog } from '../types';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'betguru_system_error_logs';
const MAX_LOGS = 50;

type ErrorListener = (logs: SystemErrorLog[]) => void;
const listeners = new Set<ErrorListener>();

let currentUserContext: {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
} = {};

// Helper to check if an error is harmless infrastructure / browser noise
export function isIgnoredBenignError(message?: string, stack?: string): boolean {
  if (!message && !stack) return true;
  const msgLower = (message || '').toLowerCase().trim();
  const stackLower = (stack || '').toLowerCase().trim();
  const combined = (msgLower + ' ' + stackLower).trim();

  // 1. Opaque cross-origin browser script errors (e.g. from Google GSI or third-party iframe scripts)
  if (
    msgLower === 'script error.' ||
    msgLower === 'script error' ||
    msgLower.includes('script error at unknown:0') ||
    msgLower.includes('script error at :0')
  ) {
    // If there is no detailed stack trace or origin, it is an opaque cross-origin error
    if (!stack || stack.length < 10) return true;
  }
  
  // 2. Vite HMR Dev WebSocket errors (HMR is intentionally disabled in cloud sandboxes)
  if (
    combined.includes('websocket closed without opened') ||
    combined.includes('failed to connect to websocket') ||
    combined.includes('@vite/client') ||
    combined.includes('vite:ws') ||
    combined.includes('vite:hmr')
  ) {
    return true;
  }

  // 3. Firestore offline & connection latency notices
  if (
    combined.includes('could not reach cloud firestore backend') ||
    combined.includes("backend didn't respond within") ||
    combined.includes('the client will operate in offline mode') ||
    combined.includes('the client is offline') ||
    combined.includes('client is offline')
  ) {
    return true;
  }

  // 4. Harmless browser layout timing warnings
  if (
    combined.includes('resizeobserver loop') ||
    combined.includes('resizeobserver loop completed with undelivered notifications')
  ) {
    return true;
  }

  // 5. User aborted / cancelled network requests or media playback
  if (
    combined.includes('aborterror') ||
    combined.includes('the user aborted a request') ||
    combined.includes('the play() request was interrupted') ||
    combined.includes('user gesture is required')
  ) {
    return true;
  }

  // 6. Firebase Auth transient popup cancellations & SDK internal assertion anomalies (e.g. mobile popup dismissals or concurrent taps)
  if (
    combined.includes('pending promise was never set') ||
    combined.includes('internal assertion failed') ||
    combined.includes('auth/popup-closed-by-user') ||
    combined.includes('auth/cancelled-popup-request') ||
    combined.includes('auth/popup-blocked')
  ) {
    return true;
  }

  return false;
}

// Load local logs from cache
function loadLocalLogs(): SystemErrorLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed: SystemErrorLog[] = JSON.parse(raw);
      // Filter out any previously saved benign logs
      return parsed.filter(l => !isIgnoredBenignError(l.message, l.stack || ''));
    }
  } catch (e) {
    console.error('Failed to parse local error logs', e);
  }
  return [];
}

let inMemoryLogs: SystemErrorLog[] = loadLocalLogs();

function saveLocalLogs(logs: SystemErrorLog[]) {
  try {
    inMemoryLogs = logs.slice(0, MAX_LOGS);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inMemoryLogs));
    notifyListeners();
  } catch (e) {
    console.error('Failed to save local error logs', e);
  }
}

function notifyListeners() {
  const currentLogs = [...inMemoryLogs];
  listeners.forEach((listener) => {
    try {
      listener(currentLogs);
    } catch (e) {
      console.error('Error listener threw:', e);
    }
  });
}

/**
 * Update the user context so error reports attach who was logged in
 */
export function setErrorUserContext(user: { id?: string; name?: string; email?: string; phone?: string } | null) {
  if (user) {
    currentUserContext = {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
    };
  } else {
    currentUserContext = {};
  }
}

/**
 * Capture an error and broadcast it
 */
export function captureSystemError(
  err: unknown,
  source: SystemErrorLog['source'] = 'client_runtime',
  extraDetails?: {
    componentStack?: string;
    adminNotes?: string;
    customMessage?: string;
    severity?: SystemErrorLog['severity'];
  }
): SystemErrorLog {
  const now = new Date();
  const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let name = 'Error';
  let message = 'An unexpected runtime error occurred.';
  let stack = '';

  if (err instanceof Error) {
    name = err.name || 'Error';
    message = err.message || message;
    stack = err.stack || '';
  } else if (typeof err === 'string') {
    message = err;
    name = 'SystemNotification';
  } else if (err && typeof err === 'object') {
    try {
      message = JSON.stringify(err);
    } catch {
      message = String(err);
    }
  }

  if (extraDetails?.customMessage) {
    message = `${extraDetails.customMessage}: ${message}`;
  }

  // Filter out benign background HMR / dev server websocket disconnections and browser timing warnings
  if (isIgnoredBenignError(message, stack)) {
    return {
      id: '',
      name,
      message,
      stack,
      source,
      severity: 'info',
      userId: 'system',
      userName: 'System',
      url: '',
      userAgent: '',
      timestamp: now.toISOString(),
      createdAt: Date.now(),
      resolved: true,
    };
  }

  const log: SystemErrorLog = {
    id,
    name,
    message,
    stack,
    componentStack: extraDetails?.componentStack,
    source,
    severity: extraDetails?.severity || (source === 'react_boundary' ? 'critical' : 'error'),
    userId: currentUserContext.userId || 'anonymous',
    userName: currentUserContext.userName || 'Guest Player',
    userEmail: currentUserContext.userEmail || '',
    userPhone: currentUserContext.userPhone || '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: now.toISOString(),
    createdAt: Date.now(),
    resolved: false,
    adminNotes: extraDetails?.adminNotes || '',
  };

  // Prepend to local memory and storage
  const updatedLogs = [log, ...inMemoryLogs.filter((l) => l.id !== id)].slice(0, MAX_LOGS);
  saveLocalLogs(updatedLogs);

  // Sync immediately to Firestore for live admin alert
  try {
    const errorDocRef = doc(db, 'system_crash_logs', id);
    setDoc(errorDocRef, log).catch((fsErr) => {
      console.warn('Could not sync error to Firestore:', fsErr);
    });
  } catch (syncErr) {
    console.warn('Firestore error sync skipped:', syncErr);
  }

  return log;
}

/**
 * Subscribe to live local error log updates
 */
export function subscribeErrorLogs(listener: ErrorListener): () => void {
  listeners.add(listener);
  listener([...inMemoryLogs]);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get current snapshot of logs
 */
export function getSystemErrorLogs(): SystemErrorLog[] {
  return [...inMemoryLogs];
}

/**
 * Mark a single error as resolved
 */
export async function markErrorLogResolved(id: string, notes?: string): Promise<void> {
  const updated = inMemoryLogs.map((l) => {
    if (l.id === id) {
      return {
        ...l,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        adminNotes: notes || l.adminNotes || 'Marked resolved by Admin',
      };
    }
    return l;
  });
  saveLocalLogs(updated);

  try {
    const docRef = doc(db, 'system_crash_logs', id);
    await updateDoc(docRef, {
      resolved: true,
      resolvedAt: new Date().toISOString(),
      adminNotes: notes || 'Marked resolved by Admin',
    });
  } catch (e) {
    console.warn('Failed to update error doc in Firestore:', e);
  }
}

/**
 * Delete a specific error log
 */
export async function deleteErrorLog(id: string): Promise<void> {
  const updated = inMemoryLogs.filter((l) => l.id !== id);
  saveLocalLogs(updated);

  try {
    const docRef = doc(db, 'system_crash_logs', id);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Failed to delete error doc from Firestore:', e);
  }
}

/**
 * Clear all resolved or all error logs
 */
export async function clearAllErrorLogs(onlyResolved = false): Promise<void> {
  const remaining = onlyResolved ? inMemoryLogs.filter((l) => !l.resolved) : [];
  saveLocalLogs(remaining);

  if (!onlyResolved) {
    // Optionally delete from Firestore
    try {
      inMemoryLogs.forEach((l) => {
        deleteDoc(doc(db, 'system_crash_logs', l.id)).catch(() => {});
      });
    } catch (_) {}
  }
}

/**
 * Simulate a test error to verify real-time alerts
 */
export function simulateTestError(customTitle = 'Manual Diagnostic Simulation (টেস্টিং এরর)'): SystemErrorLog {
  const sampleErrors = [
    {
      name: 'DiagnosticTestVerification',
      msg: `${customTitle}: Simulated diagnostic telemetry check for system health inspector`,
      stack: `DiagnosticTestVerification: Verification pulse check\n    at SystemDiagnosticModal (src/components/SystemErrorDiagnosticModal.tsx:138:15)\n    at triggerDiagnostic (src/utils/errorDiagnostics.ts:295:10)`,
    },
    {
      name: 'NetworkTimeoutException',
      msg: `${customTitle}: Firestore Long-Polling gateway simulation ping`,
      stack: `NetworkTimeoutException: Gateway Timeout 504 (Simulated Test)\n    at commitBatch (src/firebase.ts:18:12)`,
    }
  ];

  const randomChoice = sampleErrors[Math.floor(Math.random() * sampleErrors.length)];
  const errorObj = new Error(randomChoice.msg);
  errorObj.name = randomChoice.name;
  errorObj.stack = randomChoice.stack;

  return captureSystemError(errorObj, 'client_runtime', {
    customMessage: '🧪 [TEST SIMULATION / নন-ক্র্যাশ টেস্ট]',
    severity: 'info',
  });
}

/**
 * Copy full formatted diagnostic report to clipboard
 */
export async function copyErrorReportToClipboard(log: SystemErrorLog): Promise<boolean> {
  const report = `=====================================================
BETGURU CRASH & RUNTIME ERROR DIAGNOSTIC REPORT
=====================================================
Error ID: ${log.id}
Timestamp: ${log.timestamp} (${new Date(log.createdAt).toLocaleString('en-IN')})
Error Name: ${log.name}
Severity: ${log.severity.toUpperCase()}
Source: ${log.source}
Status: ${log.resolved ? 'RESOLVED' : 'UNRESOLVED / ACTIVE'}

MESSAGE:
${log.message}

USER CONTEXT:
- User ID: ${log.userId || 'N/A'}
- Name: ${log.userName || 'N/A'}
- Email: ${log.userEmail || 'N/A'}
- Phone: ${log.userPhone || 'N/A'}

ENVIRONMENT:
- URL: ${log.url}
- User Agent: ${log.userAgent}

CALL STACK TRACE:
${log.stack || 'No JS stack trace recorded'}

REACT COMPONENT STACK:
${log.componentStack || 'No React component stack'}
=====================================================`;

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(report);
      return true;
    }
  } catch (e) {
    console.error('Clipboard copy failed', e);
  }
  return false;
}

// Global browser error listeners setup
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      // Prevent infinite loop if error is from diagnostic itself
      if (event.filename && event.filename.includes('errorDiagnostics')) return;

      const msg = event.message || event.error?.message || '';
      const stack = event.error?.stack || '';

      if (isIgnoredBenignError(msg, stack)) {
        event.preventDefault();
        return;
      }

      // Ignore opaque cross-origin script errors with zero stack/source details
      if (event.message === 'Script error.' && !event.error && (!event.filename || event.lineno === 0)) {
        event.preventDefault();
        return;
      }

      captureSystemError(event.error || event.message, 'client_runtime', {
        customMessage: `Script Error at ${event.filename || 'unknown'}:${event.lineno || 0}`,
      });
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event.reason;
      const reasonMsg = reason instanceof Error ? reason.message : String(reason || '');
      const reasonStack = reason instanceof Error ? reason.stack : '';

      if (isIgnoredBenignError(reasonMsg, reasonStack)) {
        event.preventDefault();
        return;
      }

      captureSystemError(event.reason, 'promise_rejection', {
        customMessage: 'Unhandled Promise Rejection',
      });
    },
    true
  );
}
