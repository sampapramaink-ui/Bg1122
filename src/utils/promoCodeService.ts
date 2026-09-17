import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { PromoCode, PromoRedemption, User, WalletTransaction, PromoTargetWallet } from '../types';
import { findAndCreditUserInFirestore } from './databaseSync';

export interface PromoValidationResult {
  valid: boolean;
  error?: string;
  promo?: PromoCode;
  userUsageCount?: number;
}

export interface PromoRedeemResult {
  success: boolean;
  error?: string;
  amountCredited?: number;
  targetWallet?: PromoTargetWallet;
  newBalance?: number;
  newBonusBalance?: number;
  promo?: PromoCode;
  transaction?: WalletTransaction;
}

/**
 * Recursively strips undefined keys from any object/array to guarantee
 * Firestore setDoc/updateDoc never fails with "Unsupported field value: undefined".
 */
export function cleanFirestoreData<T extends Record<string, any>>(data: T): T {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item)) as unknown as T;
  }
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      cleaned[key] = cleanFirestoreData(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Validates a promo code against Firestore rules, expiration, global limit, and user usage limits.
 */
export async function validatePromoCode(
  rawCode: string, 
  user?: { id?: string; email?: string }
): Promise<PromoValidationResult> {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) {
    return { valid: false, error: 'অনুগ্রহ করে একটি প্রোমো কোড লিখুন (Please enter a promo code)' };
  }

  try {
    // 1. Find the promo code by document ID or code field
    let promoDocData: PromoCode | null = null;
    let promoDocId = code;

    const directSnap = await getDoc(doc(db, 'promo_codes', code));
    if (directSnap.exists()) {
      promoDocData = { id: directSnap.id, ...directSnap.data() } as PromoCode;
      promoDocId = directSnap.id;
    } else {
      // Query by code field
      const q = query(collection(db, 'promo_codes'), where('code', '==', code));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const d = qSnap.docs[0];
        promoDocData = { id: d.id, ...d.data() } as PromoCode;
        promoDocId = d.id;
      }
    }

    if (!promoDocData) {
      return { 
        valid: false, 
        error: `❌ '${code}' অবৈধ বা পাওয়া যায়নি! অনুগ্রহ করে সঠিক প্রোমো কোড দিন।` 
      };
    }

    // 2. Check active state
    if (promoDocData.isActive === false) {
      return { 
        valid: false, 
        error: `⚠️ '${promoDocData.code}' প্রোমো কোডটি বর্তমানে নিষ্ক্রিয় (Inactive) রয়েছে।` 
      };
    }

    // 3. Check expiration date
    if (promoDocData.expiresAt) {
      const expTime = new Date(promoDocData.expiresAt).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) {
        return { 
          valid: false, 
          error: `⏳ '${promoDocData.code}' প্রোমো কোডের মেয়াদ উত্তীর্ণ হয়ে গেছে (Expired)।` 
        };
      }
    }

    // 4. Check global usage limit
    if (typeof promoDocData.maxTotalUses === 'number' && promoDocData.maxTotalUses > 0) {
      if ((promoDocData.usedCount || 0) >= promoDocData.maxTotalUses) {
        return { 
          valid: false, 
          error: `🚫 এই প্রোমো কোডের সর্বোচ্চ মোট ব্যবহারের সীমা (${promoDocData.maxTotalUses} জন) শেষ হয়ে গেছে।` 
        };
      }
    }

    // 5. Check user-specific usage limit if user info is provided
    let userUsageCount = 0;
    if (user?.id || user?.email) {
      try {
        const redemptionsRef = collection(db, 'promo_redemptions');
        const foundRedemptions = new Set<string>();

        if (user.id) {
          const userQ1 = query(
            redemptionsRef, 
            where('codeId', '==', promoDocData.id), 
            where('userId', '==', user.id)
          );
          const snap1 = await getDocs(userQ1);
          snap1.forEach((d) => foundRedemptions.add(d.id));

          if (promoDocData.code && promoDocData.code !== promoDocData.id) {
            const userQ2 = query(
              redemptionsRef, 
              where('code', '==', promoDocData.code), 
              where('userId', '==', user.id)
            );
            const snap2 = await getDocs(userQ2);
            snap2.forEach((d) => foundRedemptions.add(d.id));
          }
        }

        if (user.email) {
          const cleanEmail = user.email.toLowerCase().trim();
          const emailQ1 = query(
            redemptionsRef,
            where('codeId', '==', promoDocData.id),
            where('userEmail', '==', cleanEmail)
          );
          const emailSnap1 = await getDocs(emailQ1);
          emailSnap1.forEach((d) => foundRedemptions.add(d.id));

          if (promoDocData.code && promoDocData.code !== promoDocData.id) {
            const emailQ2 = query(
              redemptionsRef,
              where('code', '==', promoDocData.code),
              where('userEmail', '==', cleanEmail)
            );
            const emailSnap2 = await getDocs(emailQ2);
            emailSnap2.forEach((d) => foundRedemptions.add(d.id));
          }
        }

        userUsageCount = foundRedemptions.size;
        const maxPerUser = promoDocData.maxUsesPerUser ?? 1;
        if (userUsageCount >= maxPerUser) {
          return {
            valid: false,
            error: `⚠️ আপনি ইতিমধ্যে এই প্রোমো কোডটি ${maxPerUser} বার ব্যবহার করেছেন! আর ব্যবহার করা যাবে না।`,
            promo: promoDocData,
            userUsageCount
          };
        }
      } catch (err) {
        console.warn('⚠️ Could not verify user redemption history, proceeding cautiously:', err);
      }
    }

    return {
      valid: true,
      promo: promoDocData,
      userUsageCount
    };
  } catch (err: any) {
    console.error('validatePromoCode error:', err);
    return {
      valid: false,
      error: err?.message || 'প্রোমো কোড যাচাই করতে সমস্যা হয়েছে।'
    };
  }
}

/**
 * Redeems an instant reward promo code directly into the user's Main or Bonus wallet.
 */
export async function redeemInstantPromoCode(
  rawCode: string,
  user: User
): Promise<PromoRedeemResult> {
  if (!user || !user.id) {
    return { success: false, error: 'অনুগ্রহ করে প্রথমে লগইন করুন।' };
  }

  const validation = await validatePromoCode(rawCode, { id: user.id, email: user.email });
  if (!validation.valid || !validation.promo) {
    return { success: false, error: validation.error || 'অবৈধ প্রোমো কোড।' };
  }

  const promo = validation.promo;

  if (promo.type === 'deposit_bonus') {
    return {
      success: false,
      error: `🎁 '${promo.code}' একটি ডিপোজিট প্রোমো কোড! এটি ডিপোজিট করার সময় অতিরিক্ত ${promo.bonusPercentage ? `${promo.bonusPercentage}%` : `₹${promo.flatBonusAmount}`} বোনাস পেতে ব্যবহার করুন।`,
      promo
    };
  }

  const rewardAmount = Math.max(0, Math.round(promo.rewardAmount || 0));
  if (rewardAmount <= 0) {
    return { success: false, error: 'এই প্রোমো কোডে কোনো রিওয়ার্ড অ্যামাউন্ট নির্ধারণ করা নেই।' };
  }

  const targetWallet: PromoTargetWallet = promo.targetWallet === 'main' ? 'main' : 'bonus';

  try {
    // 1. Credit the user's wallet in Firestore across all candidate documents
    const creditRes = await findAndCreditUserInFirestore({
      userId: user.id,
      userEmail: user.email,
      userCode: user.userCode,
      userName: user.name,
      amount: targetWallet === 'main' ? rewardAmount : 0,
      bonusAmount: targetWallet === 'bonus' ? rewardAmount : 0
    });

    // 2. Increment usedCount on the promo code document
    const newUsedCount = (promo.usedCount || 0) + 1;
    await updateDoc(doc(db, 'promo_codes', promo.id), {
      usedCount: newUsedCount,
      updatedAt: new Date().toISOString()
    }).catch(async () => {
      await setDoc(doc(db, 'promo_codes', promo.id), cleanFirestoreData({
        ...promo,
        usedCount: newUsedCount,
        updatedAt: new Date().toISOString()
      }), { merge: true });
    });

    // 3. Record redemption record in Firestore
    const redemptionId = `RED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const redemption: PromoRedemption = {
      id: redemptionId,
      codeId: promo.id,
      code: promo.code,
      userId: user.id,
      userEmail: user.email || '',
      userName: user.name || 'Player',
      userCode: user.userCode || '',
      type: 'instant_reward',
      amountCredited: rewardAmount,
      targetWallet,
      redeemedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'promo_redemptions', redemptionId), cleanFirestoreData(redemption));

    // 4. Record wallet transaction in Firestore with rich origin tracking
    const txnId = `TXN-PROMO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const walletTxn: WalletTransaction = {
      id: txnId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      type: 'promo_code_claim',
      amount: rewardAmount,
      promoCode: promo.code,
      promoCodeTitle: promo.title,
      promoRewardAmount: rewardAmount,
      promoOrigin: `Promo Code: ${promo.code} (${promo.title})`,
      sourceOrigin: `Promo Code: ${promo.code}`,
      description: `🎁 Promo Code [${promo.code}]: ₹${rewardAmount.toLocaleString('en-IN')} added to ${targetWallet === 'main' ? 'Main Balance' : 'Bonus Balance'} (${promo.title})`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString(),
      walletType: targetWallet
    };

    // Immediate local cache update for 0-second latency
    try {
      if (typeof window !== 'undefined' && user.id) {
        const userKey = `betguru_transactions_${user.id}`;
        const stored = localStorage.getItem(userKey);
        const list: WalletTransaction[] = stored ? JSON.parse(stored) : [];
        const deduped = [walletTxn, ...list.filter(t => t.id !== walletTxn.id)];
        localStorage.setItem(userKey, JSON.stringify(deduped.slice(0, 300)));
        window.dispatchEvent(new CustomEvent('betguru:new_transaction', { detail: walletTxn }));
      }
    } catch (_) {}

    await setDoc(doc(db, 'transactions', txnId), cleanFirestoreData(walletTxn)).catch((err) => {
      console.warn('Could not persist promo wallet transaction:', err);
    });

    return {
      success: true,
      amountCredited: rewardAmount,
      targetWallet,
      newBalance: creditRes.newBalance,
      newBonusBalance: creditRes.newBonusBalance,
      promo,
      transaction: walletTxn
    };
  } catch (err: any) {
    console.error('redeemInstantPromoCode error:', err);
    return {
      success: false,
      error: err?.message || 'প্রোমো কোড রিডিম করতে গিয়ে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
    };
  }
}

/**
 * Calculates deposit bonus based on promo code and deposit amount.
 */
export function calculateDepositPromoBonus(
  promo: PromoCode,
  depositAmount: number
): { eligible: boolean; bonusAmount: number; targetWallet: PromoTargetWallet; message?: string } {
  const targetWallet: PromoTargetWallet = promo.targetWallet === 'main' ? 'main' : 'bonus';
  const minDeposit = promo.minDepositAmount || 0;

  if (depositAmount < minDeposit) {
    return {
      eligible: false,
      bonusAmount: 0,
      targetWallet,
      message: `এই প্রোমো কোডটি সক্রিয় করতে সর্বনিম্ন ₹${minDeposit.toLocaleString('en-IN')} ডিপোজিট করতে হবে।`
    };
  }

  let calculatedBonus = 0;
  if (promo.bonusPercentage && promo.bonusPercentage > 0) {
    calculatedBonus = (depositAmount * promo.bonusPercentage) / 100;
    if (promo.maxBonusLimit && promo.maxBonusLimit > 0) {
      calculatedBonus = Math.min(calculatedBonus, promo.maxBonusLimit);
    }
  } else if (promo.flatBonusAmount && promo.flatBonusAmount > 0) {
    calculatedBonus = promo.flatBonusAmount;
  }

  calculatedBonus = Math.max(0, Math.round(calculatedBonus));

  return {
    eligible: calculatedBonus > 0,
    bonusAmount: calculatedBonus,
    targetWallet,
    message: calculatedBonus > 0 
      ? `🎉 প্রোমো কোড প্রয়োগ করা হয়েছে! +₹${calculatedBonus.toLocaleString('en-IN')} অতিরিক্ত বোনাস আপনার ${targetWallet === 'main' ? 'মেইন ওয়ালেটে' : 'বোনাস ওয়ালেটে'} যোগ হবে।`
      : undefined
  };
}

/**
 * Create or update a promo code in Firestore.
 */
export async function createOrUpdatePromoCode(
  data: Partial<PromoCode>
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const rawCode = (data.code || '').trim().toUpperCase();
    if (!rawCode) {
      throw new Error('প্রোমো কোডের নাম আবশ্যক (Code name is required)');
    }

    const id = data.id || rawCode;
    const now = new Date().toISOString();

    const promoPayload: Record<string, any> = {
      id,
      code: rawCode,
      title: data.title?.trim() || `Promo ${rawCode}`,
      description: data.description?.trim() || '',
      type: data.type || 'instant_reward',
      targetWallet: data.targetWallet || 'bonus',
      maxUsesPerUser: data.maxUsesPerUser !== undefined ? Number(data.maxUsesPerUser) : 1,
      maxTotalUses: data.maxTotalUses !== undefined ? Number(data.maxTotalUses) : 0,
      usedCount: data.usedCount !== undefined ? Number(data.usedCount) : 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      expiresAt: data.expiresAt || '',
      createdAt: data.createdAt || now,
      updatedAt: now,
      createdBy: data.createdBy || 'Admin'
    };

    // Safely assign numeric fields only if defined, not null, and valid numbers
    if (data.rewardAmount !== undefined && data.rewardAmount !== null && !isNaN(Number(data.rewardAmount))) {
      promoPayload.rewardAmount = Number(data.rewardAmount);
    }
    if (data.bonusPercentage !== undefined && data.bonusPercentage !== null && !isNaN(Number(data.bonusPercentage))) {
      promoPayload.bonusPercentage = Number(data.bonusPercentage);
    }
    if (data.flatBonusAmount !== undefined && data.flatBonusAmount !== null && !isNaN(Number(data.flatBonusAmount))) {
      promoPayload.flatBonusAmount = Number(data.flatBonusAmount);
    }
    if (data.minDepositAmount !== undefined && data.minDepositAmount !== null && !isNaN(Number(data.minDepositAmount))) {
      promoPayload.minDepositAmount = Number(data.minDepositAmount);
    }
    if (data.maxBonusLimit !== undefined && data.maxBonusLimit !== null && !isNaN(Number(data.maxBonusLimit))) {
      promoPayload.maxBonusLimit = Number(data.maxBonusLimit);
    }

    const sanitizedPayload = cleanFirestoreData(promoPayload);
    await setDoc(doc(db, 'promo_codes', id), sanitizedPayload, { merge: true });
    return { success: true, id };
  } catch (err: any) {
    console.error('createOrUpdatePromoCode error:', err);
    return { success: false, id: '', error: err?.message || 'Failed to save promo code' };
  }
}

/**
 * Deletes a promo code from Firestore.
 */
export async function deletePromoCode(codeId: string): Promise<boolean> {
  try {
    const rawUpper = (codeId || '').trim().toUpperCase();
    await deleteDoc(doc(db, 'promo_codes', codeId));
    if (rawUpper && rawUpper !== codeId) {
      await deleteDoc(doc(db, 'promo_codes', rawUpper)).catch(() => {});
    }
    // Also check if any promo_codes document has matching 'code' field
    if (rawUpper) {
      const q = query(collection(db, 'promo_codes'), where('code', '==', rawUpper));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    console.error('deletePromoCode error:', err);
    return false;
  }
}

/**
 * Toggles a promo code's active status.
 */
export async function togglePromoCodeStatus(codeId: string, isActive: boolean): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'promo_codes', codeId), {
      isActive,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('togglePromoCodeStatus error:', err);
    return false;
  }
}

/**
 * Real-time listener for all promo codes.
 */
export function subscribePromoCodes(callback: (codes: PromoCode[]) => void): () => void {
  const colRef = collection(db, 'promo_codes');
  const unsubscribe = onSnapshot(colRef, (snap) => {
    const list: PromoCode[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as PromoCode);
    });
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    callback(list);
  }, (err) => {
    console.warn('subscribePromoCodes listener error:', err);
  });
  return unsubscribe;
}

/**
 * Real-time listener for redemptions of a specific code or all codes.
 */
export function subscribePromoRedemptions(
  callback: (redemptions: PromoRedemption[]) => void,
  codeId?: string
): () => void {
  const colRef = collection(db, 'promo_redemptions');
  const q = codeId ? query(colRef, where('codeId', '==', codeId)) : colRef;
  const unsubscribe = onSnapshot(q, (snap) => {
    const list: PromoRedemption[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as PromoRedemption);
    });
    list.sort((a, b) => {
      const timeA = new Date(a.redeemedAt || 0).getTime();
      const timeB = new Date(b.redeemedAt || 0).getTime();
      return timeB - timeA;
    });
    callback(list);
  }, (err) => {
    console.warn('subscribePromoRedemptions error:', err);
  });
  return unsubscribe;
}

/**
 * Records a successful deposit promo code redemption upon admin deposit approval.
 */
export async function recordDepositPromoRedemption(params: {
  promoCode: string;
  depositId: string;
  depositAmount: number;
  bonusAmount: number;
  targetWallet: PromoTargetWallet;
  userId: string;
  userEmail?: string;
  userName?: string;
}): Promise<void> {
  try {
    const rawCode = params.promoCode.trim().toUpperCase();
    const redemptionId = `RED_DEP_${params.depositId}_${Date.now()}`;
    const now = new Date().toISOString();

    const redemptionDoc: PromoRedemption = {
      id: redemptionId,
      codeId: rawCode,
      code: rawCode,
      userId: params.userId,
      userEmail: (params.userEmail || '').toLowerCase().trim(),
      userName: params.userName || 'Player',
      amountCredited: params.bonusAmount,
      targetWallet: params.targetWallet,
      type: 'deposit_bonus',
      depositId: params.depositId,
      depositAmount: params.depositAmount,
      redeemedAt: now
    };

    await setDoc(doc(db, 'promo_redemptions', redemptionId), cleanFirestoreData(redemptionDoc));

    // Increment usedCount on promo_codes doc
    const promoRef = doc(db, 'promo_codes', rawCode);
    const promoSnap = await getDoc(promoRef);
    if (promoSnap.exists()) {
      const currentUsed = promoSnap.data()?.usedCount || 0;
      await updateDoc(promoRef, {
        usedCount: currentUsed + 1,
        updatedAt: now
      });
    } else {
      const q = query(collection(db, 'promo_codes'), where('code', '==', rawCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const currentUsed = d.data()?.usedCount || 0;
        await updateDoc(d.ref, {
          usedCount: currentUsed + 1,
          updatedAt: now
        });
      }
    }
  } catch (err) {
    console.warn('recordDepositPromoRedemption error:', err);
  }
}

/**
 * Seeds initial demo/starter promo codes if collection is empty.
 */
export async function seedDefaultPromoCodes(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'promo_codes'));
    if (!snap.empty) return; // already seeded

    const defaults: Partial<PromoCode>[] = [
      {
        code: 'WELCOME100',
        title: '🎉 Welcome Bonus (ওয়েলকাম ক্যাশ)',
        description: 'New player instant bonus credited directly to your Bonus Wallet!',
        type: 'instant_reward',
        rewardAmount: 100,
        targetWallet: 'bonus',
        maxUsesPerUser: 1,
        maxTotalUses: 1000,
        isActive: true
      },
      {
        code: 'EXTRA50',
        title: '🔥 50% Extra Deposit Boost (ডিপোজিট বোনাস)',
        description: 'Get 50% extra bonus up to ₹2,500 on deposits of ₹500 or more!',
        type: 'deposit_bonus',
        bonusPercentage: 50,
        minDepositAmount: 500,
        maxBonusLimit: 2500,
        targetWallet: 'bonus',
        maxUsesPerUser: 3,
        isActive: true
      },
      {
        code: 'MAIN50',
        title: '💎 Lucky Main Cash (মেইন ব্যালেন্স ক্যাশ)',
        description: 'Instant ₹50 cash credit directly to your withdrawable Main Balance!',
        type: 'instant_reward',
        rewardAmount: 50,
        targetWallet: 'main',
        maxUsesPerUser: 1,
        maxTotalUses: 500,
        isActive: true
      }
    ];

    for (const item of defaults) {
      await createOrUpdatePromoCode(item);
    }
  } catch (err) {
    console.warn('seedDefaultPromoCodes error:', err);
  }
}
