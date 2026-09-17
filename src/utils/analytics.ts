import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type AnalyticsEventType =
  | 'deposit_attempt'
  | 'withdrawal_submission'
  | 'ticket_buy'
  | 'game_start'
  | string;

export interface AnalyticsEventPayload {
  event: AnalyticsEventType;
  userId?: string;
  userEmail?: string;
  details?: Record<string, any>;
  device?: string;
  timestamp?: number;
}

/**
 * Lightweight, non-blocking analytics utility function.
 * Hooks into key application events ('deposit_attempt', 'withdrawal_submission', 'ticket_buy', etc.)
 * and logs event data to the 'analytics' collection in Firestore with metadata (user ID, timestamp, device).
 * Runs completely asynchronously (fire-and-forget) to ensure zero impact on UI performance.
 */
export const logAnalyticsEvent = (
  event: AnalyticsEventType,
  details?: Record<string, any>,
  userId?: string,
  userEmail?: string
) => {
  try {
    const isMobile =
      typeof window !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768);

    const payload = {
      event,
      userId: userId || 'anonymous',
      userEmail: userEmail || 'N/A',
      details: details || {},
      device: isMobile ? 'mobile' : 'desktop',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      screenResolution:
        typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      timestamp: Date.now(),
      createdAt: serverTimestamp()
    };

    // Non-blocking fire-and-forget write to Firestore
    addDoc(collection(db, 'analytics'), payload).catch((err) => {
      console.warn('Analytics event log notice:', err?.message || err);
    });
  } catch (err) {
    console.warn('Analytics log dispatch error:', err);
  }
};

