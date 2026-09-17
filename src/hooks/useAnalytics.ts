import { useCallback } from 'react';
import { logAnalyticsEvent } from '../utils/analytics';

export interface UseAnalyticsProps {
  userId?: string;
  userEmail?: string;
}

export const useAnalytics = (userId?: string, userEmail?: string) => {
  const trackEvent = useCallback(
    (event: string, details?: Record<string, any>) => {
      logAnalyticsEvent(event, details, userId, userEmail);
    },
    [userId, userEmail]
  );

  const trackGameStart = useCallback(
    (gameType: string, gameDetails?: Record<string, any>) => {
      trackEvent('game_start', {
        gameType,
        startTime: new Date().toISOString(),
        ...gameDetails
      });
    },
    [trackEvent]
  );

  const trackDepositAttempt = useCallback(
    (amount: number, method: string, utr?: string) => {
      trackEvent('deposit_attempt', {
        amount,
        method,
        utr: utr ? `${utr.slice(0, 4)}***` : undefined,
        attemptTime: new Date().toISOString()
      });
    },
    [trackEvent]
  );

  const trackWithdrawalSubmission = useCallback(
    (amount: number, details?: Record<string, any>) => {
      trackEvent('withdrawal_submission', {
        amount,
        ...details,
        submissionTime: new Date().toISOString()
      });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackGameStart,
    trackDepositAttempt,
    trackWithdrawalSubmission
  };
};
