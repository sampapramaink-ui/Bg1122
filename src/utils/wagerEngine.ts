import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase';
import { User, WithdrawalWagerSettings } from '../types';

export const DEFAULT_WAGER_SETTINGS: WithdrawalWagerSettings = {
  enabled: true,
  mainWagerMultiplier: 1.0, // 1x Main balance / deposit wager
  bonusWagerMultiplier: 5.0, // 5x Bonus balance wager
  minWagerBeforeWithdrawal: 0,
  allowPartialWithdrawalIfMainMet: false,
  lockWithdrawalOnPendingWager: true,
  noticeBangla: 'উইথড্রয়াল রিকোয়েস্ট জমা দেওয়ার পূর্বে আপনাকে মেইন ব্যালেন্স ও বোনাস ব্যালেন্সের প্রয়োজনীয় উয়েজার (টার্নওভার) সম্পন্ন করতে হবে।',
  updatedAt: new Date().toISOString()
};

let cachedWagerSettings: WithdrawalWagerSettings = { ...DEFAULT_WAGER_SETTINGS };

/**
 * Subscribe to real-time withdrawal wagering configuration from Firestore.
 */
export function subscribeWithdrawalWagerSettings(
  callback: (settings: WithdrawalWagerSettings) => void
): () => void {
  const docRef = doc(db, 'system_settings', 'withdrawal_wager');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        cachedWagerSettings = {
          ...DEFAULT_WAGER_SETTINGS,
          ...data,
          mainWagerMultiplier: typeof data.mainWagerMultiplier === 'number' ? data.mainWagerMultiplier : DEFAULT_WAGER_SETTINGS.mainWagerMultiplier,
          bonusWagerMultiplier: typeof data.bonusWagerMultiplier === 'number' ? data.bonusWagerMultiplier : DEFAULT_WAGER_SETTINGS.bonusWagerMultiplier,
          enabled: data.enabled !== undefined ? Boolean(data.enabled) : DEFAULT_WAGER_SETTINGS.enabled,
        };
      } else {
        // Initialize default in Firestore
        setDoc(docRef, cleanFirestoreData(DEFAULT_WAGER_SETTINGS), { merge: true }).catch(() => {});
      }
      callback(cachedWagerSettings);
    },
    (err) => {
      console.warn('Wager settings snapshot warning:', err);
      callback(cachedWagerSettings);
    }
  );
}

/**
 * Fetch current withdrawal wager settings once (or returns cached).
 */
export async function getWithdrawalWagerSettings(): Promise<WithdrawalWagerSettings> {
  try {
    const snap = await getDoc(doc(db, 'system_settings', 'withdrawal_wager'));
    if (snap.exists()) {
      cachedWagerSettings = {
        ...DEFAULT_WAGER_SETTINGS,
        ...snap.data()
      };
    }
  } catch (e) {
    console.warn('Failed to load wager settings:', e);
  }
  return cachedWagerSettings;
}

/**
 * Save updated withdrawal wager settings to Firestore.
 */
export async function saveWithdrawalWagerSettings(
  settings: Partial<WithdrawalWagerSettings>,
  adminEmail?: string
): Promise<boolean> {
  try {
    const updated: WithdrawalWagerSettings = {
      ...cachedWagerSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail || 'Admin'
    };
    cachedWagerSettings = updated;
    await setDoc(doc(db, 'system_settings', 'withdrawal_wager'), cleanFirestoreData(updated), { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save wager settings:', err);
    return false;
  }
}

export interface UserWagerStatus {
  enabled: boolean;
  isExempt: boolean;
  isCompleted: boolean;
  mainRequired: number;
  mainCompleted: number;
  mainRemaining: number;
  bonusRequired: number;
  bonusCompleted: number;
  bonusRemaining: number;
  totalRequired: number;
  totalCompleted: number;
  totalRemaining: number;
  progressPercentage: number;
  mainProgressPercentage: number;
  bonusProgressPercentage: number;
  warningMessageBangla: string;
  warningMessageEnglish: string;
  summaryText: string;
}

/**
 * Compute the comprehensive wagering requirement status for a given user.
 */
export function calculateUserWagerStatus(
  user: User | null | undefined,
  settings: WithdrawalWagerSettings = cachedWagerSettings
): UserWagerStatus {
  if (!user) {
    return {
      enabled: settings.enabled,
      isExempt: false,
      isCompleted: true,
      mainRequired: 0,
      mainCompleted: 0,
      mainRemaining: 0,
      bonusRequired: 0,
      bonusCompleted: 0,
      bonusRemaining: 0,
      totalRequired: 0,
      totalCompleted: 0,
      totalRemaining: 0,
      progressPercentage: 100,
      mainProgressPercentage: 100,
      bonusProgressPercentage: 100,
      warningMessageBangla: '',
      warningMessageEnglish: '',
      summaryText: 'উয়েজার প্রযোজ্য নয়'
    };
  }

  const isExempt = Boolean(user.wagerExempt);
  const isEnforced = Boolean(settings.enabled);

  // If user has specific wager set by Admin, prioritize that;
  // otherwise fallback to (balance * multiplier) or default baseline.
  const userBal = user.balance || 0;
  const userBonus = user.bonusBalance || 0;

  const mainRequired = typeof user.mainWagerRequired === 'number'
    ? Math.max(0, Math.round(user.mainWagerRequired))
    : Math.max(0, Math.round(userBal * (settings.mainWagerMultiplier || 1.0)));

  const mainCompleted = typeof user.mainWagerCompleted === 'number'
    ? Math.max(0, Math.round(user.mainWagerCompleted))
    : Math.max(0, Math.round(user.totalSpent || 0));

  const bonusRequired = typeof user.bonusWagerRequired === 'number'
    ? Math.max(0, Math.round(user.bonusWagerRequired))
    : Math.max(0, Math.round(userBonus * (settings.bonusWagerMultiplier || 5.0)));

  const bonusCompleted = typeof user.bonusWagerCompleted === 'number'
    ? Math.max(0, Math.round(user.bonusWagerCompleted))
    : 0;

  const mainRemaining = Math.max(0, mainRequired - mainCompleted);
  const bonusRemaining = Math.max(0, bonusRequired - bonusCompleted);

  const totalRequired = mainRequired + bonusRequired;
  const totalCompleted = mainCompleted + bonusCompleted;
  const totalRemaining = mainRemaining + (settings.allowPartialWithdrawalIfMainMet ? 0 : bonusRemaining);

  const progressPercentage = totalRequired > 0
    ? Math.min(100, Math.max(0, Math.round((totalCompleted / totalRequired) * 100)))
    : 100;

  const mainProgressPercentage = mainRequired > 0
    ? Math.min(100, Math.max(0, Math.round((mainCompleted / mainRequired) * 100)))
    : 100;

  const bonusProgressPercentage = bonusRequired > 0
    ? Math.min(100, Math.max(0, Math.round((bonusCompleted / bonusRequired) * 100)))
    : 100;

  const isCompleted = isExempt || !isEnforced || (
    mainRemaining <= 0 && (settings.allowPartialWithdrawalIfMainMet || bonusRemaining <= 0)
  );

  let warningMessageBangla = '';
  let warningMessageEnglish = '';

  if (!isCompleted) {
    if (mainRemaining > 0 && bonusRemaining > 0) {
      warningMessageBangla = `উইথড্রয়াল রিকোয়েস্ট করতে হলে উয়েজার সম্পন্ন করতে হবে! মেইন ব্যালেন্স উয়েজার বাকি ₹${mainRemaining.toLocaleString('en-IN')} এবং বোনাস ব্যালেন্স উয়েজার বাকি ₹${bonusRemaining.toLocaleString('en-IN')}। মোট ₹${(mainRemaining + bonusRemaining).toLocaleString('en-IN')} বাজি ধরা আবশ্যক।`;
      warningMessageEnglish = `Wagering requirement incomplete! Main balance wager remaining: ₹${mainRemaining.toLocaleString('en-IN')}, Bonus wager remaining: ₹${bonusRemaining.toLocaleString('en-IN')}.`;
    } else if (mainRemaining > 0) {
      warningMessageBangla = `উইথড্রয়াল রিকোয়েস্ট করতে হলে মেইন ব্যালেন্স উয়েজার সম্পন্ন করতে হবে! এখনও ₹${mainRemaining.toLocaleString('en-IN')} পরিমাণের বাজি ধরা বাকি রয়েছে।`;
      warningMessageEnglish = `Main balance wager incomplete! You must wager an additional ₹${mainRemaining.toLocaleString('en-IN')} before withdrawing.`;
    } else {
      warningMessageBangla = `উইথড্রয়াল রিকোয়েস্ট করতে হলে বোনাস ব্যালেন্স উয়েজার সম্পন্ন করতে হবে! এখনও ₹${bonusRemaining.toLocaleString('en-IN')} পরিমাণের বাজি ধরা বাকি রয়েছে।`;
      warningMessageEnglish = `Bonus balance wager incomplete! You must wager an additional ₹${bonusRemaining.toLocaleString('en-IN')} before withdrawing.`;
    }
  }

  const summaryText = isExempt
    ? 'ভিআইপি উয়েজার ছাড়প্রাপ্ত (Exempted)'
    : isCompleted
      ? 'উয়েজার ১০০% সম্পন্ন (Eligible to Withdraw)'
      : `উয়েজার বাকি: ₹${totalRemaining.toLocaleString('en-IN')}`;

  return {
    enabled: isEnforced,
    isExempt,
    isCompleted,
    mainRequired,
    mainCompleted,
    mainRemaining,
    bonusRequired,
    bonusCompleted,
    bonusRemaining,
    totalRequired,
    totalCompleted,
    totalRemaining,
    progressPercentage,
    mainProgressPercentage,
    bonusProgressPercentage,
    warningMessageBangla,
    warningMessageEnglish,
    summaryText
  };
}

/**
 * Record a bet turnover towards user's completed wagering requirement.
 * Atomically updates user document in Firestore and returns updated numbers.
 */
export async function recordUserWager(
  userId: string,
  betAmount: number,
  walletType: 'main' | 'bonus' = 'main'
): Promise<{ success: boolean; newMainCompleted: number; newBonusCompleted: number }> {
  if (!userId || userId === 'anonymous' || betAmount <= 0) {
    return { success: false, newMainCompleted: 0, newBonusCompleted: 0 };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return { success: false, newMainCompleted: 0, newBonusCompleted: 0 };
    }

    const userData = snap.data();
    const currentMainCompleted = typeof userData.mainWagerCompleted === 'number'
      ? userData.mainWagerCompleted
      : (userData.totalSpent || 0);
    const currentBonusCompleted = typeof userData.bonusWagerCompleted === 'number'
      ? userData.bonusWagerCompleted
      : 0;
    const currentTotalSpent = typeof userData.totalSpent === 'number'
      ? userData.totalSpent
      : 0;

    const newMainCompleted = walletType === 'main'
      ? currentMainCompleted + betAmount
      : currentMainCompleted;

    const newBonusCompleted = walletType === 'bonus'
      ? currentBonusCompleted + betAmount
      : currentBonusCompleted;

    const updatePayload: any = {
      totalSpent: currentTotalSpent + betAmount,
      updatedAt: new Date().toISOString()
    };

    if (walletType === 'main') {
      updatePayload.mainWagerCompleted = newMainCompleted;
    } else {
      updatePayload.bonusWagerCompleted = newBonusCompleted;
    }

    await setDoc(userRef, cleanFirestoreData(updatePayload), { merge: true });

    // Also update cached user in localStorage if matching
    try {
      const stored = localStorage.getItem('betguru_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id === userId) {
          if (walletType === 'main') parsed.mainWagerCompleted = newMainCompleted;
          else parsed.bonusWagerCompleted = newBonusCompleted;
          parsed.totalSpent = (parsed.totalSpent || 0) + betAmount;
          localStorage.setItem('betguru_user', JSON.stringify(parsed));
        }
      }
    } catch (_) {}

    return {
      success: true,
      newMainCompleted,
      newBonusCompleted
    };
  } catch (err) {
    console.warn('recordUserWager warning:', err);
    return { success: false, newMainCompleted: 0, newBonusCompleted: 0 };
  }
}

/**
 * Admin action to set or override wager for ANY specific user.
 */
export async function adminUpdateUserWager(
  userId: string,
  updates: {
    mainWagerRequired?: number;
    mainWagerCompleted?: number;
    bonusWagerRequired?: number;
    bonusWagerCompleted?: number;
    wagerExempt?: boolean;
  }
): Promise<boolean> {
  if (!userId) return false;
  try {
    const payload: any = {
      wagerUpdatedAt: new Date().toISOString()
    };

    if (updates.mainWagerRequired !== undefined) {
      payload.mainWagerRequired = Math.max(0, Math.round(updates.mainWagerRequired));
    }
    if (updates.mainWagerCompleted !== undefined) {
      payload.mainWagerCompleted = Math.max(0, Math.round(updates.mainWagerCompleted));
    }
    if (updates.bonusWagerRequired !== undefined) {
      payload.bonusWagerRequired = Math.max(0, Math.round(updates.bonusWagerRequired));
    }
    if (updates.bonusWagerCompleted !== undefined) {
      payload.bonusWagerCompleted = Math.max(0, Math.round(updates.bonusWagerCompleted));
    }
    if (updates.wagerExempt !== undefined) {
      payload.wagerExempt = Boolean(updates.wagerExempt);
    }

    await setDoc(doc(db, 'users', userId), cleanFirestoreData(payload), { merge: true });
    return true;
  } catch (err) {
    console.error('adminUpdateUserWager error:', err);
    return false;
  }
}
