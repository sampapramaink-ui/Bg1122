import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  limit, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, ReferralRecord, ReferralSettings, DepositRequest, WalletTransaction, NotificationItem } from '../types';
import { findAndCreditUserInFirestore } from './databaseSync';

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: true,
  bonusAmount: 100, // ৳100 / ₹100 bonus for referrer
  minDepositAmount: 1000, // ৳1,000 / ₹1,000 minimum deposit required by friend to unlock bonus
  refereeWelcomeBonus: 0,
  updatedAt: new Date().toISOString()
};

/**
 * Dynamically builds referral URL based on the user's current deployment domain (Vercel, custom domain, or container origin)
 */
export const getDynamicReferralLink = (referralCode: string): string => {
  if (!referralCode) return '';
  let origin = '';
  if (typeof window !== 'undefined' && window.location) {
    origin = window.location.origin;
    if (!origin || origin === 'null') {
      const proto = window.location.protocol || 'https:';
      origin = `${proto}//${window.location.host || 'betguruprime.vercel.app'}`;
    }
  }
  if (!origin || origin === 'null') {
    origin = 'https://betguruprime.vercel.app';
  }
  // Trim trailing slashes
  origin = origin.replace(/\/+$/, '');
  return `${origin}?ref=${encodeURIComponent(referralCode.trim())}`;
};

/**
 * Extracts referral invite code from URL query parameters (?ref=... or ?invite=...) and caches in localStorage
 */
export const getReferralCodeFromUrl = (): string => {
  if (typeof window === 'undefined' || !window.location) return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('invite') || params.get('code') || '';
    if (ref && ref.trim()) {
      const cleanRef = ref.trim().toUpperCase();
      try {
        localStorage.setItem('bg_referral_invite_code', cleanRef);
      } catch (_) {}
      return cleanRef;
    }
    const cached = localStorage.getItem('bg_referral_invite_code');
    return cached ? cached.trim().toUpperCase() : '';
  } catch (e) {
    return '';
  }
};

/**
 * Fetch referral system settings from Firestore (with fallback)
 */
export const getReferralSettings = async (): Promise<ReferralSettings> => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'referral'));
    if (snap.exists() && snap.data()) {
      return {
        ...DEFAULT_REFERRAL_SETTINGS,
        ...snap.data()
      } as ReferralSettings;
    }
  } catch (err) {
    console.warn('Notice loading referral settings:', err);
  }
  return DEFAULT_REFERRAL_SETTINGS;
};

/**
 * Save / Update referral system settings in Firestore (for Admin panel control)
 */
export const saveReferralSettings = async (
  settings: Partial<ReferralSettings>, 
  adminEmail?: string
): Promise<ReferralSettings> => {
  const current = await getReferralSettings();
  const updated: ReferralSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail || 'admin'
  };

  try {
    await setDoc(doc(db, 'settings', 'referral'), updated, { merge: true });
  } catch (err) {
    console.error('Failed to save referral settings to Firestore:', err);
  }
  return updated;
};

/**
 * Lookup referrer user in Firestore by Referral Code (e.g. BG123456) or User Code
 */
export const findReferrerByCode = async (inviteCode: string): Promise<User | null> => {
  if (!inviteCode || !inviteCode.trim()) return null;
  const cleanCode = inviteCode.trim().toUpperCase();

  try {
    // 1. Search by exact referralCode
    const q1 = query(collection(db, 'users'), where('referralCode', '==', cleanCode), limit(1));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const d = snap1.docs[0];
      return { id: d.id, ...d.data() } as User;
    }

    // 2. Fallback search by userCode (in case user shared their userCode)
    const q2 = query(collection(db, 'users'), where('userCode', '==', cleanCode), limit(1));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const d = snap2.docs[0];
      return { id: d.id, ...d.data() } as User;
    }

    // 3. Fallback check lowercase / uppercase variants
    const snapAll = await getDocs(query(collection(db, 'users'), limit(300)));
    for (const d of snapAll.docs) {
      const u = d.data() as User;
      if (
        (u.referralCode && u.referralCode.toUpperCase() === cleanCode) ||
        (u.userCode && u.userCode.toUpperCase() === cleanCode)
      ) {
        return { id: d.id, ...u };
      }
    }
  } catch (err) {
    console.warn('Error finding referrer by code:', err);
  }

  return null;
};

/**
 * Registers a new referral relationship when a player signs up with an invite code.
 * Initializes status as 'pending_deposit' until the referred friend deposits minimum required amount.
 */
export const registerReferralOnSignup = async (params: {
  refereeId: string;
  refereeName: string;
  refereeEmail: string;
  refereePhone?: string;
  inviteCode?: string;
}): Promise<ReferralRecord | null> => {
  const { refereeId, refereeName, refereeEmail, refereePhone, inviteCode } = params;
  if (!inviteCode || !inviteCode.trim()) return null;

  try {
    const settings = await getReferralSettings();
    if (!settings.enabled) {
      console.log('Referral program is currently disabled by Admin.');
      return null;
    }

    const referrer = await findReferrerByCode(inviteCode);
    if (!referrer) {
      console.warn('Invalid referral code entered:', inviteCode);
      return null;
    }

    // Guard against self-referral
    if (
      referrer.id === refereeId || 
      (referrer.email && refereeEmail && referrer.email.toLowerCase().trim() === refereeEmail.toLowerCase().trim()) ||
      (referrer.referralCode && referrer.referralCode.toUpperCase() === inviteCode.trim().toUpperCase() && referrer.id === refereeId)
    ) {
      console.warn('Self-referral attempt blocked.');
      return null;
    }

    const recordId = `ref_${refereeId}`;
    const newRecord: ReferralRecord = {
      id: recordId,
      referrerId: referrer.id,
      referrerCode: referrer.referralCode || inviteCode.trim().toUpperCase(),
      referrerName: referrer.name || 'Friend',
      referrerEmail: referrer.email,
      refereeId,
      refereeName: refereeName || 'New Player',
      refereeEmail: refereeEmail || '',
      refereePhone: refereePhone || '',
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'pending_deposit',
      minDepositRequired: settings.minDepositAmount || 1000,
      bonusAmount: settings.bonusAmount || 100,
      totalDepositedByReferee: 0
    };

    // Save referral record in Firestore
    await setDoc(doc(db, 'referrals', recordId), newRecord, { merge: true });

    // Update referrer user document total referrals count
    try {
      await updateDoc(doc(db, 'users', referrer.id), {
        totalReferrals: increment(1)
      });
    } catch (_) {}

    // Update referee user document with referrer tracking info
    try {
      await updateDoc(doc(db, 'users', refereeId), {
        referredByCode: referrer.referralCode || inviteCode.trim().toUpperCase(),
        referredById: referrer.id
      });
    } catch (_) {}

    // Clean up cached referral code from localStorage
    try {
      localStorage.removeItem('bg_referral_invite_code');
    } catch (_) {}

    // Post to live activities stream
    setDoc(doc(db, 'live_activities', `act_${Date.now()}_ref`), {
      id: `act_${Date.now()}_ref`,
      userId: refereeId,
      userName: refereeName,
      userEmail: refereeEmail,
      type: 'referral_signup',
      details: `🎉 ${refereeName} joined via ${referrer.name}'s referral code (${referrer.referralCode}). Pending ₹${newRecord.minDepositRequired} deposit for ₹${newRecord.bonusAmount} bonus.`,
      timestamp: Date.now()
    }).catch(() => {});

    return newRecord;
  } catch (err) {
    console.error('Error in registerReferralOnSignup:', err);
    return null;
  }
};

/**
 * Checks and credits referral bonus when an Admin approves a deposit.
 * If the deposit meets or exceeds the required minimum deposit (e.g. ₹1,000),
 * the referrer receives their instant cash bonus (e.g. ₹100), and transaction history is recorded.
 */
export const processReferralOnDepositApproval = async (
  deposit: DepositRequest
): Promise<{
  credited: boolean;
  referrerName?: string;
  bonusAmount?: number;
  referralId?: string;
} | null> => {
  if (!deposit || deposit.status !== 'approved' || deposit.amount <= 0) {
    return null;
  }

  try {
    const candidateRefereeId = deposit.userId;
    const candidateEmail = (deposit as any).userEmail || '';

    // Look for existing referral record
    let refRecord: ReferralRecord | null = null;
    const refDocSnap = await getDoc(doc(db, 'referrals', `ref_${candidateRefereeId}`));
    if (refDocSnap.exists()) {
      refRecord = { id: refDocSnap.id, ...refDocSnap.data() } as ReferralRecord;
    } else if (candidateEmail) {
      // Lookup by email
      const q = query(collection(db, 'referrals'), where('refereeEmail', '==', candidateEmail.toLowerCase().trim()), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        refRecord = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as ReferralRecord;
      }
    }

    if (!refRecord) {
      return null;
    }

    // If already completed or cancelled, do nothing
    if (refRecord.status === 'completed') {
      return null;
    }

    const minRequired = refRecord.minDepositRequired || 1000;
    const bonusAmount = refRecord.bonusAmount || 100;

    // Check if this deposit qualifies
    if (deposit.amount >= minRequired) {
      // 1. Mark referral completed in Firestore
      const updatedRecord: Partial<ReferralRecord> = {
        status: 'completed',
        qualifiedDepositId: deposit.id,
        creditedAt: new Date().toISOString(),
        totalDepositedByReferee: (refRecord.totalDepositedByReferee || 0) + deposit.amount
      };

      await updateDoc(doc(db, 'referrals', refRecord.id), updatedRecord);

      // 2. Credit referrer wallet in Firestore
      const creditRes = await findAndCreditUserInFirestore({
        userId: refRecord.referrerId,
        userEmail: refRecord.referrerEmail,
        amount: bonusAmount
      });

      // Update referrer user document metrics
      try {
        await updateDoc(doc(db, 'users', refRecord.referrerId), {
          totalReferralBonusEarned: increment(bonusAmount),
          qualifiedReferralsCount: increment(1)
        });
      } catch (_) {}

      // 3. Create WalletTransaction for the referrer ledger
      const refTx: WalletTransaction = {
        id: `TXN-REF-${deposit.id}-${refRecord.id}`,
        userId: refRecord.referrerId,
        userEmail: refRecord.referrerEmail,
        userName: refRecord.referrerName,
        type: 'referral_bonus',
        amount: bonusAmount,
        description: `Referral Bonus (রেফারেল বোনাস): ${refRecord.refereeName || 'Friend'} deposited ₹${deposit.amount.toLocaleString('en-IN')}`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString(),
        extraDetails: {
          refereeId: refRecord.refereeId,
          refereeName: refRecord.refereeName,
          refereeDepositAmount: deposit.amount,
          depositId: deposit.id
        }
      };

      await setDoc(doc(db, 'transactions', refTx.id), refTx, { merge: true });

      // 4. Create Notification for the Referrer
      const refNotif: NotificationItem = {
        id: `NTF-REF-${Date.now()}`,
        userId: refRecord.referrerId,
        userEmail: refRecord.referrerEmail,
        title: `🎉 রেফারেল বোনাস ক্রেডিট হয়েছে! (+₹${bonusAmount})`,
        message: `আপনার আমন্ত্রিত বন্ধু (${refRecord.refereeName}) সফলভাবে ₹${deposit.amount.toLocaleString('en-IN')} ডিপোজিট করায় আপনার একাউন্টে ₹${bonusAmount} রেফারেল বোনাস যুক্ত হয়েছে!`,
        type: 'bonus',
        date: 'Just now',
        read: false
      };

      await setDoc(doc(db, 'notifications', refNotif.id), refNotif, { merge: true });

      // 5. Trigger live activity stream
      setDoc(doc(db, 'live_activities', `act_${Date.now()}_ref_bonus`), {
        id: `act_${Date.now()}_ref_bonus`,
        userId: refRecord.referrerId,
        userName: refRecord.referrerName,
        type: 'referral_bonus',
        details: `💰 ${refRecord.referrerName} received ₹${bonusAmount} referral cash bonus after ${refRecord.refereeName} deposited ₹${deposit.amount.toLocaleString('en-IN')}!`,
        timestamp: Date.now()
      }).catch(() => {});

      return {
        credited: true,
        referrerName: refRecord.referrerName,
        bonusAmount: bonusAmount,
        referralId: refRecord.id
      };
    } else {
      // Deposit didn't reach min required; accumulate referee deposit amount while keeping status 'pending_deposit'
      await updateDoc(doc(db, 'referrals', refRecord.id), {
        totalDepositedByReferee: (refRecord.totalDepositedByReferee || 0) + deposit.amount
      });
      return {
        credited: false,
        referrerName: refRecord.referrerName,
        bonusAmount: bonusAmount,
        referralId: refRecord.id
      };
    }
  } catch (err) {
    console.error('Error in processReferralOnDepositApproval:', err);
    return null;
  }
};
