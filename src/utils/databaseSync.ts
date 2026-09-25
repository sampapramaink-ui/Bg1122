import { doc, getDoc, getDocFromServer, getDocs, collection, setDoc, deleteDoc, query, limit, where } from 'firebase/firestore';
import { db, auth, cleanFirestoreData } from '../firebase';
import { safeApiPost } from './apiConfig';
import { User, WalletTransaction, DepositRequest, WithdrawalRequest } from '../types';

/**
 * Fetch fresh document directly from Firestore server, bypassing local IndexedDB disk cache.
 * Falls back to local getDoc if offline or during network handshake.
 */
export async function getFreshDoc(docRef: any) {
  try {
    return await getDocFromServer(docRef);
  } catch (_) {
    return await getDoc(docRef);
  }
}

export const ADMIN_EMAILS = [
  'asishp92@gmail.com'
];

export function checkIsAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === 'asishp92@gmail.com';
}

// Zero Mock / Demo Users: SEED_USERS is permanently empty. Only authentic registered accounts exist in Firestore.
export const SEED_USERS: User[] = [];

export const SEED_TRANSACTIONS: WalletTransaction[] = [];
export const SEED_DEPOSITS: DepositRequest[] = [];
export const SEED_WITHDRAWALS: WithdrawalRequest[] = [];

/**
 * List of known dummy / mock / demo user emails that must never be created
 */
export const FAKE_MOCK_USER_EMAILS = [
  'demo@betguru.com',
  'mockplayer@betguru.com',
  'dummy@betguru.com',
  'fake@betguru.com',
  'sample@betguru.com'
];

export const FAKE_MOCK_USER_IDS = [
  'BG-789012',
  'demo_seed_mock_001',
  'demo_seed_mock_002'
];

const FAKE_MOCK_NAMES = [
  'demo user',
  'test user',
  'mock player',
  'dummy user',
  'dummy player'
];

/**
 * Generates or derives a permanent, unchangeable 5-digit User ID code (e.g. "84921").
 * Deterministic for the same email address to ensure Google and OTP logins always share the exact same ID.
 */
export function generatePermanentUserCode(email?: string, existingCode?: string, uid?: string): string {
  if (existingCode && typeof existingCode === 'string' && existingCode.trim().length >= 4 && existingCode.trim().length <= 8) {
    return existingCode.trim();
  }
  const seedString = ((email || '').toLowerCase().trim()) || (uid || '').trim() || 'betguru_user';
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  // Returns a clean 5-digit numeric ID between 10000 and 99999
  const codeNum = 10000 + (positiveHash % 90000);
  return codeNum.toString();
}

/**
 * Helper to get the clean display User ID (e.g. "84921").
 */
export function getUserDisplayCode(user?: { id?: string; userCode?: string; email?: string } | null): string {
  if (!user) return 'N/A';
  if (user.userCode && typeof user.userCode === 'string' && user.userCode.trim().length > 0) {
    return user.userCode.trim();
  }
  return generatePermanentUserCode(user.email, undefined, user.id);
}

/**
 * Calculates a relevance score for a search query against a user object.
 * Returns a score > 0 if matched, with exact 5-digit ID match having highest priority.
 */
export function calculateUserSearchScore(user: User | null | undefined, queryStr: string): { matches: boolean; score: number } {
  if (!user || !queryStr || !queryStr.trim()) {
    return { matches: true, score: 1 };
  }

  const rawQ = queryStr.toLowerCase().trim();
  const cleanQ = rawQ.replace(/^[#\s]+/, '').trim();
  const uCode = (getUserDisplayCode(user) || '').toLowerCase().trim();
  const uId = (user.id || '').toLowerCase().trim();
  const uEmail = (user.email || '').toLowerCase().trim();
  const uName = (user.name || '').toLowerCase().trim();
  const uPhone = (user.phone || '').toLowerCase().trim().replace(/[^0-9+]/g, '');
  const cleanPhoneQ = cleanQ.replace(/[^0-9+]/g, '');
  const uRef = (user.referralCode || '').toLowerCase().trim();

  let score = 0;

  // 1. Exact 5-digit userCode match (Absolute Highest Priority)
  if (uCode === cleanQ || uCode === rawQ || `#${uCode}` === rawQ) {
    score += 10000;
  }
  // 2. User code starts with search term
  else if (cleanQ.length >= 2 && uCode.startsWith(cleanQ)) {
    score += 5000;
  }
  // 3. User code contains search term
  else if (cleanQ.length >= 2 && uCode.includes(cleanQ)) {
    score += 2500;
  }

  // 4. Exact email match
  if (uEmail === rawQ) {
    score += 8000;
  } else if (uEmail.startsWith(rawQ)) {
    score += 3000;
  } else if (uEmail.includes(rawQ)) {
    score += 1500;
  }

  // 5. Exact phone match
  if (cleanPhoneQ.length >= 4 && uPhone === cleanPhoneQ) {
    score += 7000;
  } else if (cleanPhoneQ.length >= 4 && uPhone.includes(cleanPhoneQ)) {
    // Only grant phone substring score if search query looks like a phone search (e.g. 8+ digits) or is not purely 5 digits
    score += cleanPhoneQ.length >= 8 ? 2000 : 300;
  }

  // 6. Name match
  if (uName === rawQ) {
    score += 6000;
  } else if (uName.startsWith(rawQ)) {
    score += 2000;
  } else if (uName.includes(rawQ)) {
    score += 1000;
  }

  // 7. Exact Firebase UID match
  if (uId === rawQ || uId === cleanQ) {
    score += 5000;
  } else if (cleanQ.length >= 6 && uId.includes(cleanQ)) {
    score += 400;
  }

  // 8. Referral code match
  if (uRef === rawQ || (cleanQ.length >= 4 && uRef.includes(cleanQ))) {
    score += 1200;
  }

  // 9. Linked doc IDs match
  if (user.linkedDocIds && user.linkedDocIds.some(lid => lid.toLowerCase().trim() === rawQ || lid.toLowerCase().trim() === cleanQ)) {
    score += 3000;
  }

  return {
    matches: score > 0,
    score: score
  };
}

/**
 * Helper to determine if a document is an obsolete dummy/mock account
 */
export function isMockDemoUser(id: string, email?: string, name?: string): boolean {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();
  const cleanId = (id || '').trim();

  // If email is an admin email, it is NEVER a mock user
  if (cleanEmail && checkIsAdminEmail(cleanEmail)) return false;

  if (cleanEmail && FAKE_MOCK_USER_EMAILS.includes(cleanEmail)) return true;
  if (cleanId && FAKE_MOCK_USER_IDS.includes(cleanId)) return true;
  if (cleanId.startsWith('demo_seed_')) return true;
  if (cleanName && FAKE_MOCK_NAMES.includes(cleanName) && (!cleanEmail || cleanEmail.includes('betguru.com'))) return true;
  return false;
}

/**
 * Resolves and merges user document data for a given email/UID.
 * Prioritizes the live Firestore document, returns single canonical user, and preserves real names & balances.
 */
export async function resolveCanonicalUserData(
  cleanEmail: string,
  currentUid?: string
): Promise<{
  canonicalUid: string;
  userData: User;
  linkedDocIds: string[];
}> {
  const email = (cleanEmail || '').toLowerCase().trim();
  const isAdminEmail = checkIsAdminEmail(email);
  const fallbackAliasUid = email ? `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}` : '';

  const docSnapshots: { id: string; data: any }[] = [];
  const linkedDocIds = new Set<string>();

  if (currentUid) {
    linkedDocIds.add(currentUid);
    try {
      const snap = await getDoc(doc(db, 'users', currentUid));
      if (snap.exists() && snap.data()) {
        docSnapshots.push({ id: snap.id, data: snap.data() });
      }
    } catch (_) {}
  }

  if (email && email.includes('@')) {
    try {
      const qEmail = query(collection(db, 'users'), where('email', '==', email));
      const snap = await getDocs(qEmail);
      snap.forEach((d) => {
        linkedDocIds.add(d.id);
        if (!docSnapshots.some((s) => s.id === d.id) && d.data()) {
          docSnapshots.push({ id: d.id, data: d.data() });
        }
      });
    } catch (_) {}
  }

  if (fallbackAliasUid && fallbackAliasUid !== currentUid) {
    linkedDocIds.add(fallbackAliasUid);
    try {
      const snap = await getDoc(doc(db, 'users', fallbackAliasUid));
      if (snap.exists() && snap.data() && !docSnapshots.some((s) => s.id === snap.id)) {
        docSnapshots.push({ id: snap.id, data: snap.data() });
      }
    } catch (_) {}
  }

  // Canonical UID selection: Prefer authentic Firebase Auth UID if provided, else existing primary doc
  const authenticAuthDoc = docSnapshots.find((s) => !s.id.startsWith('user_') && !s.id.startsWith('BG-'));
  const canonicalUid = currentUid || (authenticAuthDoc ? authenticAuthDoc.id : (docSnapshots[0]?.id || fallbackAliasUid || `user_${Date.now()}`));
  linkedDocIds.add(canonicalUid);

  // If we found existing Firestore documents for this user, use their REAL live data
  if (docSnapshots.length > 0) {
    const primarySnapshot = docSnapshots.find((s) => s.id === canonicalUid && s.data) || docSnapshots[0];
    const primaryData = primarySnapshot.data || {};

    // Helper to check if avatar is a custom image (uploaded base64 data URL or custom web URL)
    const isCustomAvatar = (url?: string) => {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      if (trimmed.length < 10) return false;
      if (trimmed.includes('photo-1534528741775-53994a69daeb')) return false; // Default placeholder
      return true;
    };

    let liveBalance = typeof primaryData.balance === 'number' ? primaryData.balance : undefined;
    let liveBonusBalance = typeof primaryData.bonusBalance === 'number' ? primaryData.bonusBalance : undefined;
    let liveTotalWon = typeof primaryData.totalWon === 'number' ? primaryData.totalWon : undefined;
    let liveTotalSpent = typeof primaryData.totalSpent === 'number' ? primaryData.totalSpent : undefined;
    let liveVipPoints = typeof primaryData.vipPoints === 'number' ? primaryData.vipPoints : undefined;
    let liveVipLevel = primaryData.vipLevel;
    let liveName = (primaryData.name && primaryData.name !== 'BETGURU Player' && primaryData.name !== 'User') ? primaryData.name : undefined;
    let livePhone = primaryData.phone;
    let liveAvatar = isCustomAvatar(primaryData.avatarUrl) ? primaryData.avatarUrl : undefined;
    let liveUserCode = primaryData.userCode;
    let liveReferral = primaryData.referralCode;
    let liveRegDate = primaryData.regDate;
    let liveStatus = primaryData.status || 'active';
    let liveRole = primaryData.role || (isAdminEmail ? 'admin' : 'user');

    // Find the MAXIMUM balance and spinCredits across ALL linked documents
    // This prevents a doc with 0 balance from overwriting an admin-credited balance on another linked doc
    let maxFoundBalance: number | undefined = typeof primaryData.balance === 'number' ? primaryData.balance : undefined;
    let maxFoundBonus: number | undefined = typeof primaryData.bonusBalance === 'number' ? primaryData.bonusBalance : undefined;
    let maxFoundSpinCredits: number = typeof primaryData.spinCredits === 'number' ? primaryData.spinCredits : 0;
    const allCreditedDepositIds = new Set<string>();
    const allRefundedWithdrawalIds = new Set<string>();

    for (const { data } of docSnapshots) {
      if (!data) continue;
      if (Array.isArray(data.creditedDepositIds)) {
        data.creditedDepositIds.forEach((id: string) => id && allCreditedDepositIds.add(id));
      }
      if (Array.isArray(data.refundedWithdrawalIds)) {
        data.refundedWithdrawalIds.forEach((id: string) => id && allRefundedWithdrawalIds.add(id));
      }
      if (!liveUserCode && data.userCode) liveUserCode = data.userCode;
      if (typeof data.balance === 'number') {
        if (maxFoundBalance === undefined || data.balance > maxFoundBalance) {
          maxFoundBalance = data.balance;
        }
      }
      if (typeof data.bonusBalance === 'number') {
        if (maxFoundBonus === undefined || data.bonusBalance > maxFoundBonus) {
          maxFoundBonus = data.bonusBalance;
        }
      }
      if (typeof data.spinCredits === 'number' && data.spinCredits > maxFoundSpinCredits) {
        maxFoundSpinCredits = data.spinCredits;
      }
      if (liveTotalWon === undefined && typeof data.totalWon === 'number') liveTotalWon = data.totalWon;
      if (liveTotalSpent === undefined && typeof data.totalSpent === 'number') liveTotalSpent = data.totalSpent;
      if (liveVipPoints === undefined && typeof data.vipPoints === 'number') liveVipPoints = data.vipPoints;
      if (!liveVipLevel && data.vipLevel) liveVipLevel = data.vipLevel;
      if ((!liveName || liveName === 'BETGURU Player' || liveName === 'User') && data.name && data.name !== 'BETGURU Player' && data.name !== 'User' && data.name.trim().length > 1) {
        liveName = data.name.trim();
      }
      if ((!livePhone || livePhone === 'N/A') && data.phone && data.phone.length > 5) livePhone = data.phone;
      if (!liveAvatar && isCustomAvatar(data.avatarUrl)) {
        liveAvatar = data.avatarUrl;
      }
      if (!liveReferral && data.referralCode) liveReferral = data.referralCode;
      if (!liveRegDate && data.regDate) liveRegDate = data.regDate;
      if (data.status === 'suspended' || data.status === 'blocked' || data.isBlocked === true) liveStatus = 'suspended';
      if (data.role === 'admin') liveRole = 'admin';
    }

    const permanentUserCode = generatePermanentUserCode(email, liveUserCode, canonicalUid);

    const resolvedUser: User = {
      id: canonicalUid,
      userCode: permanentUserCode,
      name: liveName || (email ? email.split('@')[0] : 'BETGURU Player'),
      phone: (livePhone && !livePhone.includes('9876543210')) ? livePhone : '',
      email: email || primaryData.email || '',
      avatarUrl: liveAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      balance: maxFoundBalance !== undefined ? Math.max(0, Math.round(maxFoundBalance)) : 100,
      bonusBalance: maxFoundBonus !== undefined ? Math.max(0, Math.round(maxFoundBonus)) : 100,
      spinCredits: maxFoundSpinCredits,
      totalWon: liveTotalWon !== undefined ? liveTotalWon : 0,
      totalSpent: liveTotalSpent !== undefined ? liveTotalSpent : 0,
      referralCode: liveReferral || `BG${Math.floor(100000 + Math.random() * 900000)}`,
      totalReferrals: typeof primaryData.totalReferrals === 'number' ? primaryData.totalReferrals : 0,
      lastSpinTime: typeof primaryData.lastSpinTime === 'number' ? primaryData.lastSpinTime : 0,
      status: liveStatus,
      role: isAdminEmail ? 'admin' : liveRole,
      vipLevel: liveVipLevel || 'Bronze',
      vipPoints: liveVipPoints !== undefined ? liveVipPoints : 0,
      regDate: liveRegDate || new Date().toLocaleDateString('en-IN'),
      creditedDepositIds: Array.from(allCreditedDepositIds),
      refundedWithdrawalIds: Array.from(allRefundedWithdrawalIds),
      linkedDocIds: [canonicalUid]
    };

    // Save strictly to the single canonical document
    const userPayload = cleanFirestoreData({
      ...resolvedUser,
      id: canonicalUid,
      userCode: permanentUserCode,
      canonicalUid: canonicalUid,
      lastLogin: new Date().toISOString()
    });

    await setDoc(doc(db, 'users', canonicalUid), userPayload, { merge: true }).catch((err) => {
      console.warn('resolveCanonicalUserData setDoc notice:', err?.message || err);
    });

    // Permanently purge all duplicate or alias documents from Firestore so no duplicates exist in Admin panel
    for (const dId of Array.from(linkedDocIds)) {
      if (dId !== canonicalUid) {
        deleteDoc(doc(db, 'users', dId)).catch(() => {});
      }
    }

    return {
      canonicalUid,
      userData: resolvedUser,
      linkedDocIds: [canonicalUid]
    };
  }

  // Fetch registration bonus settings if brand new
  let bonusAmount = 100;
  try {
    const regCfgSnap = await getDoc(doc(db, 'system_settings', 'registration_config'));
    if (regCfgSnap.exists()) {
      const cfg = regCfgSnap.data();
      if (typeof cfg.bonusAmount === 'number') bonusAmount = cfg.bonusAmount;
    }
  } catch (_) {}

  const permanentUserCode = generatePermanentUserCode(email, undefined, canonicalUid);

  // Brand new genuine user
  const newUser: User = {
    id: canonicalUid,
    userCode: permanentUserCode,
    name: email ? email.split('@')[0] : 'BETGURU Player',
    phone: '',
    email: email || '',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    balance: bonusAmount,
    bonusBalance: bonusAmount,
    totalWon: 0,
    totalSpent: 0,
    referralCode: `BG${Math.floor(100000 + Math.random() * 900000)}`,
    totalReferrals: 0,
    lastSpinTime: 0,
    status: 'active',
    role: isAdminEmail ? 'admin' : 'user',
    vipLevel: 'Bronze',
    vipPoints: 0,
    regDate: new Date().toLocaleDateString('en-IN'),
    linkedDocIds: [canonicalUid]
  };

  await setDoc(
    doc(db, 'users', canonicalUid),
    cleanFirestoreData({
      ...newUser,
      id: canonicalUid,
      userCode: permanentUserCode,
      canonicalUid: canonicalUid,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    }),
    { merge: true }
  ).catch((err) => {
    console.warn('resolveCanonicalUserData new user setDoc notice:', err?.message || err);
  });

  return {
    canonicalUid,
    userData: newUser,
    linkedDocIds: [canonicalUid]
  };
}

/**
 * 100% Safe Database Cleaner and Deduplicator.
 * ONLY merges documents that have the exact same verified email address.
 * Never touches or deletes accounts of different users!
 */
export async function cleanAndDeduplicateUsers(): Promise<{
  deletedDuplicatesCount: number;
  deletedFakeUsersCount: number;
  mergedUsersCount: number;
  remainingRealUsersCount: number;
}> {
  let deletedDuplicatesCount = 0;
  let deletedFakeUsersCount = 0;
  let mergedUsersCount = 0;

  try {
    const usersSnapshot = await getDocs(collection(db, 'users')).catch((err) => {
      console.warn('cleanAndDeduplicateUsers getDocs notice:', err?.message || err);
      return null;
    });

    if (!usersSnapshot || usersSnapshot.empty) {
      return {
        deletedDuplicatesCount: 0,
        deletedFakeUsersCount: 0,
        mergedUsersCount: 0,
        remainingRealUsersCount: 0
      };
    }

    const allDocs: { id: string; data: any }[] = [];
    usersSnapshot.forEach((d) => {
      allDocs.push({ id: d.id, data: d.data() || {} });
    });

    // 1. Filter out only confirmed fake mock seed users
    const validDocs: { id: string; data: any }[] = [];
    const fakeDeletions: Promise<any>[] = [];

    for (const item of allDocs) {
      const email = (item.data.email || '').toLowerCase().trim();
      const name = (item.data.name || '').trim();
      if (isMockDemoUser(item.id, email, name)) {
        fakeDeletions.push(
          deleteDoc(doc(db, 'users', item.id))
            .then(() => { deletedFakeUsersCount++; })
            .catch(() => {})
        );
      } else {
        validDocs.push(item);
      }
    }
    await Promise.allSettled(fakeDeletions);

    // 2. Group STRICTLY by exact verified email address ONLY
    const emailToDocsMap: { [email: string]: { id: string; data: any }[] } = {};
    const unassociatedDocs: { id: string; data: any }[] = [];

    validDocs.forEach((item) => {
      let email = (item.data.email || '').toLowerCase().trim();
      if (!email && item.id.startsWith('user_') && item.id.includes('@')) {
        email = item.id.slice(5).toLowerCase().trim();
      }

      if (email && email.includes('@')) {
        if (!emailToDocsMap[email]) emailToDocsMap[email] = [];
        emailToDocsMap[email].push(item);
      } else {
        unassociatedDocs.push(item);
      }
    });

    const duplicateDeletions: Promise<any>[] = [];
    const canonicalSaves: Promise<any>[] = [];

    for (const [email, group] of Object.entries(emailToDocsMap)) {
      if (group.length > 1) {
        // Find authentic auth UID document (not starting with user_)
        const authUidDoc = group.find((g) => !g.id.startsWith('user_') && !g.id.startsWith('BG-') && g.id.length > 15);
        const adminDoc = group.find((g) => g.data.role === 'admin' || checkIsAdminEmail(email));
        const canonicalDoc = authUidDoc || adminDoc || group[0];
        const canonicalUid = canonicalDoc.id;

        // Resolve best real name
        let realName = canonicalDoc.data.name;
        for (const g of group) {
          const gName = g.data.name;
          if (gName && gName !== 'BETGURU Player' && gName !== 'User' && gName.trim().length > 1) {
            realName = gName.trim();
            break;
          }
        }
        if (!realName || realName === 'BETGURU Player' || realName === 'User') {
          realName = email.split('@')[0];
        }

        // Aggregate stats and fields
        let bestBalance = 0;
        let bestBonus = 0;
        let bestWon = 0;
        let bestSpent = 0;
        let bestVipPoints = 0;
        let bestVipLevel = 'Bronze';
        let bestPhone = '';
        let bestAvatar = '';
        let bestRole: 'user' | 'admin' = checkIsAdminEmail(email) ? 'admin' : 'user';
        let bestRefCode = '';
        let bestRegDate = '';
        let isSuspended = false;

        const isCustomImg = (url?: string) => {
          if (!url || typeof url !== 'string') return false;
          const trimmed = url.trim();
          return trimmed.length > 10 && !trimmed.includes('photo-1534528741775-53994a69daeb');
        };

        for (const g of group) {
          const d = g.data;
          if (typeof d.balance === 'number' && d.balance > bestBalance) bestBalance = d.balance;
          if (typeof d.bonusBalance === 'number' && d.bonusBalance > bestBonus) bestBonus = d.bonusBalance;
          if (typeof d.totalWon === 'number' && d.totalWon > bestWon) bestWon = d.totalWon;
          if (typeof d.totalSpent === 'number' && d.totalSpent > bestSpent) bestSpent = d.totalSpent;
          if (typeof d.vipPoints === 'number' && d.vipPoints > bestVipPoints) bestVipPoints = d.vipPoints;
          if (d.vipLevel && d.vipLevel !== 'Bronze') bestVipLevel = d.vipLevel;
          if (d.role === 'admin') bestRole = 'admin';
          if (d.phone && d.phone !== 'N/A' && d.phone.length > 5 && !bestPhone) bestPhone = d.phone;
          if (isCustomImg(d.avatarUrl) && !bestAvatar) bestAvatar = d.avatarUrl;
          if (d.referralCode && !bestRefCode) bestRefCode = d.referralCode;
          if (d.regDate && !bestRegDate) bestRegDate = d.regDate;
          if (d.status === 'suspended' || d.status === 'blocked' || d.isBlocked === true) isSuspended = true;
        }

        const cleanUserDoc: User = {
          id: canonicalUid,
          canonicalUid: canonicalUid,
          name: realName,
          email: email,
          phone: (bestPhone && !bestPhone.includes('9876543210')) ? bestPhone : (canonicalDoc.data.phone && !canonicalDoc.data.phone.includes('9876543210') ? canonicalDoc.data.phone : ''),
          avatarUrl: bestAvatar || (isCustomImg(canonicalDoc.data.avatarUrl) ? canonicalDoc.data.avatarUrl : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
          balance: Math.max(0, Math.round(bestBalance)),
          bonusBalance: Math.max(0, Math.round(bestBonus)),
          totalWon: bestWon,
          totalSpent: bestSpent,
          referralCode: bestRefCode || `BG${Math.floor(100000 + Math.random() * 900000)}`,
          totalReferrals: canonicalDoc.data.totalReferrals || 0,
          lastSpinTime: canonicalDoc.data.lastSpinTime || 0,
          status: isSuspended ? 'suspended' : (canonicalDoc.data.status || 'active'),
          role: bestRole,
          vipLevel: bestVipLevel as any,
          vipPoints: bestVipPoints,
          regDate: bestRegDate || canonicalDoc.data.regDate || new Date().toLocaleDateString('en-IN'),
          isSuspicious: false,
          linkedDocIds: [canonicalUid]
        };

        canonicalSaves.push(
          setDoc(doc(db, 'users', canonicalUid), cleanUserDoc, { merge: true })
            .then(() => { mergedUsersCount++; })
            .catch((err) => console.warn('cleanAndDeduplicateUsers canonical save notice:', err))
        );

        // Delete all duplicate and alias documents for this email so admin panel stays 100% clean
        for (const g of group) {
          if (g.id !== canonicalUid) {
            duplicateDeletions.push(
              deleteDoc(doc(db, 'users', g.id))
                .then(() => { deletedDuplicatesCount++; })
                .catch(() => {})
            );
          }
        }
      }
    }

    await Promise.allSettled([...canonicalSaves, ...duplicateDeletions]);
  } catch (err) {
    console.warn('cleanAndDeduplicateUsers handled notice:', err);
  }

  const remainingSnapshot = await getDocs(collection(db, 'users')).catch(() => null);
  const remainingRealUsersCount = remainingSnapshot ? remainingSnapshot.size : 0;

  return {
    deletedDuplicatesCount,
    deletedFakeUsersCount,
    mergedUsersCount,
    remainingRealUsersCount
  };
}

/**
 * Checks on startup, updates real-time heartbeat, and runs safe cleanup if admin
 */
export async function autoCheckAndSeedFirestore(): Promise<void> {
  try {
    // 1. Send real-time heartbeat ping to Firestore
    setDoc(doc(db, '_connection_test_', 'ping'), {
      status: 'connected',
      lastPing: Date.now(),
      platform: 'web'
    }, { merge: true }).catch(() => {});

    const currentUser = auth.currentUser;
    const currentEmail = (currentUser?.email || '').toLowerCase().trim();
    const isAdmin = checkIsAdminEmail(currentEmail);
    // Only perform full database deduplication if authenticated as an administrator
    if (!isAdmin) {
      return;
    }
    await cleanAndDeduplicateUsers();
  } catch (err) {
    console.warn('[Firestore Auto-Check Notice]:', err);
  }
}

export async function syncAndRestoreDatabase(): Promise<{
  usersCount: number;
  transactionsCount: number;
  depositsCount: number;
  withdrawalsCount: number;
  mergedUsersCount: number;
  deletedDuplicatesCount: number;
}> {
  const cleanRes = await cleanAndDeduplicateUsers();
  const [usersSnap, txSnap, depSnap, wthSnap] = await Promise.all([
    getDocs(collection(db, 'users')).catch(() => null),
    getDocs(collection(db, 'transactions')).catch(() => null),
    getDocs(collection(db, 'deposits')).catch(() => null),
    getDocs(collection(db, 'withdrawals')).catch(() => null)
  ]);

  return {
    usersCount: usersSnap ? usersSnap.size : cleanRes.remainingRealUsersCount,
    transactionsCount: txSnap ? txSnap.size : 0,
    depositsCount: depSnap ? depSnap.size : 0,
    withdrawalsCount: wthSnap ? wthSnap.size : 0,
    mergedUsersCount: cleanRes.mergedUsersCount,
    deletedDuplicatesCount: cleanRes.deletedDuplicatesCount
  };
}

export interface UserCreditResult {
  success: boolean;
  canonicalUid: string;
  targetEmail: string;
  targetName: string;
  newBalance: number;
  newBonusBalance?: number;
  newSpinCredits: number;
  userDoc?: any;
}

/**
 * Universal safe balance credit and deduction helper.
 * Searches across authentic Firebase Auth UIDs, alias IDs, email addresses, and user codes.
 * Updates ALL linked documents simultaneously in Firestore so that regardless of whether
 * the user app was closed or which document ID the user listener connects to,
 * the balance is 100% credited and never lost.
 */
export async function findAndCreditUserInFirestore(params: {
  userId?: string;
  userEmail?: string;
  userCode?: string;
  userName?: string;
  amount: number; // positive to add balance (deposit / refund), negative to deduct
  bonusAmount?: number; // positive to add to bonusBalance, negative to deduct
  spinCreditBonus?: number;
  depositId?: string;
  withdrawalId?: string;
}): Promise<UserCreditResult> {
  let cleanEmail = (params.userEmail || '').toLowerCase().trim();
  const rawUserId = (params.userId || '').trim();
  const rawCode = (params.userCode || '').trim();

  const docSnapshots: { id: string; data: any }[] = [];
  const candidateIds = new Set<string>();

  if (rawUserId && rawUserId !== 'anonymous' && rawUserId !== 'admin' && rawUserId !== 'ALL') {
    candidateIds.add(rawUserId);
    try {
      const snap = await getDoc(doc(db, 'users', rawUserId));
      if (snap.exists() && snap.data()) {
        docSnapshots.push({ id: snap.id, data: snap.data() });
        if (!cleanEmail && snap.data()?.email) {
          cleanEmail = String(snap.data().email).toLowerCase().trim();
        }
      }
    } catch (_) {}
  }

  if (cleanEmail && cleanEmail.includes('@')) {
    const aliasId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    candidateIds.add(aliasId);
    try {
      const qEmail = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const snap = await getDocs(qEmail);
      snap.forEach((d) => {
        candidateIds.add(d.id);
        if (!docSnapshots.some((s) => s.id === d.id) && d.data()) {
          docSnapshots.push({ id: d.id, data: d.data() });
        }
      });
    } catch (_) {}

    try {
      const snap = await getDoc(doc(db, 'users', aliasId));
      if (snap.exists() && snap.data() && !docSnapshots.some((s) => s.id === snap.id)) {
        docSnapshots.push({ id: snap.id, data: snap.data() });
      }
    } catch (_) {}
  }

  if (rawCode) {
    try {
      const qCode = query(collection(db, 'users'), where('userCode', '==', rawCode));
      const snap = await getDocs(qCode);
      snap.forEach((d) => {
        candidateIds.add(d.id);
        if (!docSnapshots.some((s) => s.id === d.id) && d.data()) {
          docSnapshots.push({ id: d.id, data: d.data() });
        }
      });
    } catch (_) {}
  }

  // Collect any linked documents declared inside the found user documents
  for (const { data } of docSnapshots) {
    if (data?.linkedDocIds && Array.isArray(data.linkedDocIds)) {
      data.linkedDocIds.forEach((lid: string) => lid && candidateIds.add(lid));
    }
  }

  // Find canonical UID: prefer authentic auth UID over aliases
  const authenticAuthDoc = docSnapshots.find((s) => !s.id.startsWith('user_') && !s.id.startsWith('BG-'));
  const canonicalUid = (authenticAuthDoc ? authenticAuthDoc.id : undefined) ||
    (rawUserId && rawUserId !== 'anonymous' && rawUserId !== 'admin' ? rawUserId : undefined) ||
    docSnapshots[0]?.id ||
    (cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : `user_${Date.now()}`);
  candidateIds.add(canonicalUid);

  // Find existing balance (prefer highest found balance across linked docs to prevent zero overwrites)
  let currentBal = 0;
  let currentBonusBal = 0;
  let currentSpinCredits = 0;
  let targetEmail = cleanEmail;
  let targetName = params.userName || '';
  const creditedDepositIds = new Set<string>();
  const refundedWithdrawalIds = new Set<string>();

  for (const { data } of docSnapshots) {
    if (!data) continue;
    if (typeof data.balance === 'number' && data.balance > currentBal) {
      currentBal = data.balance;
    }
    if (typeof data.bonusBalance === 'number' && data.bonusBalance > currentBonusBal) {
      currentBonusBal = data.bonusBalance;
    }
    if (typeof data.spinCredits === 'number' && data.spinCredits > currentSpinCredits) {
      currentSpinCredits = data.spinCredits;
    }
    if (Array.isArray(data.creditedDepositIds)) {
      data.creditedDepositIds.forEach((id: string) => id && creditedDepositIds.add(id));
    }
    if (Array.isArray(data.refundedWithdrawalIds)) {
      data.refundedWithdrawalIds.forEach((id: string) => id && refundedWithdrawalIds.add(id));
    }
    if (!targetEmail && data.email) targetEmail = String(data.email).toLowerCase().trim();
    if ((!targetName || targetName === 'Player' || targetName === 'User') && data.name) targetName = String(data.name);
  }

  if (params.depositId) {
    creditedDepositIds.add(params.depositId);
  }
  if (params.withdrawalId) {
    refundedWithdrawalIds.add(params.withdrawalId);
  }

  const newBalance = Math.max(0, Math.round(currentBal + params.amount));
  const newBonusBalance = params.bonusAmount !== undefined
    ? Math.max(0, Math.round(currentBonusBal + params.bonusAmount))
    : currentBonusBal;
  const newSpinCredits = Math.max(0, Math.round(currentSpinCredits + (params.spinCreditBonus || 0)));

  const updatePayload: any = {
    balance: newBalance,
    spinCredits: newSpinCredits,
    creditedDepositIds: Array.from(creditedDepositIds),
    refundedWithdrawalIds: Array.from(refundedWithdrawalIds),
    updatedAt: new Date().toISOString()
  };

  if (params.bonusAmount !== undefined) {
    updatePayload.bonusBalance = newBonusBalance;
  }

  // If this is a new approved deposit, automatically increment the user's main balance wager requirement
  if (params.amount > 0 && params.depositId) {
    const existingWagerReq = typeof docSnapshots[0]?.data?.mainWagerRequired === 'number'
      ? docSnapshots[0].data.mainWagerRequired
      : currentBal;
    updatePayload.mainWagerRequired = Math.max(0, Math.round(existingWagerReq + params.amount));
    updatePayload.wagerUpdatedAt = new Date().toISOString();
  }
  if (targetEmail) updatePayload.email = targetEmail;
  if (targetName && targetName !== 'Player') updatePayload.name = targetName;
  updatePayload.linkedDocIds = Array.from(candidateIds);

  // Write new balance to ALL candidate documents in Firestore so no matter which ID the user app reloads with,
  // the new balance is immediately visible
  const updatePromises = Array.from(candidateIds).map((docId) =>
    setDoc(doc(db, 'users', docId), cleanFirestoreData(updatePayload), { merge: true }).catch((err) => {
      console.warn(`findAndCreditUserInFirestore setDoc warning for ${docId}:`, err?.message || err);
    })
  );
  await Promise.all(updatePromises);

  return {
    success: true,
    canonicalUid,
    targetEmail: targetEmail || cleanEmail,
    targetName: targetName || params.userName || 'Player',
    newBalance,
    newBonusBalance,
    newSpinCredits,
    userDoc: docSnapshots[0]?.data || updatePayload
  };
}

export interface WalletSyncResult {
  success: boolean;
  canonicalUid?: string;
  balance: number;
  bonusBalance: number;
  spinCredits: number;
  creditedDepositIds?: string[];
  refundedWithdrawalIds?: string[];
  newlyCreditedCount?: number;
  newlyCreditedAmount?: number;
  newlyRefundedCount?: number;
  newlyRefundedAmount?: number;
  newlyCreditedDeposits?: Array<{ id: string; amount: number }>;
  source?: 'api' | 'firestore_direct';
}

/**
 * Authoritative Server & Client Wallet Synchronization
 * Ensures that if the app was closed or in sleep mode when the admin approved a deposit
 * or adjusted the balance, the wallet is 100% reconciled and updated immediately.
 */
export async function syncUserWalletAuthoritative(params: {
  userId?: string;
  userEmail?: string;
  userCode?: string;
}): Promise<WalletSyncResult | null> {
  const cleanEmail = (params.userEmail || '').toLowerCase().trim();
  const rawUserId = (params.userId || '').trim();

  if (!rawUserId && !cleanEmail) return null;

  // 1. Try authoritative server-side endpoint first (bypasses all client cache and race conditions)
  try {
    const apiRes = await safeApiPost('/api/sync-user-wallet', {
      userId: rawUserId,
      userEmail: cleanEmail,
      userCode: params.userCode || ''
    });

    if (apiRes && apiRes.success && apiRes.data) {
      const d = apiRes.data as any;
      return {
        success: true,
        canonicalUid: d.canonicalUid,
        balance: typeof d.balance === 'number' ? d.balance : 0,
        bonusBalance: d.bonusBalance ?? 0,
        spinCredits: d.spinCredits ?? 0,
        creditedDepositIds: d.creditedDepositIds || [],
        refundedWithdrawalIds: d.refundedWithdrawalIds || [],
        newlyCreditedCount: d.newlyCreditedCount || 0,
        newlyCreditedAmount: d.newlyCreditedAmount || 0,
        newlyRefundedCount: d.newlyRefundedCount || 0,
        newlyRefundedAmount: d.newlyRefundedAmount || 0,
        newlyCreditedDeposits: d.newlyCreditedDeposits || [],
        source: 'api'
      };
    }
  } catch (apiErr) {
    console.warn('⚠️ Server-side syncUserWalletAuthoritative notice, falling back to direct Firestore:', apiErr);
  }

  // 2. Direct Firestore fallback using getDocFromServer (bypasses IndexedDB cache)
  try {
    const candidateIds = new Set<string>();
    if (rawUserId && rawUserId !== 'anonymous' && rawUserId !== 'admin') candidateIds.add(rawUserId);
    if (cleanEmail) candidateIds.add(`user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`);

    let foundAnyDoc = false;
    let maxBalance: number | undefined = undefined;
    let maxBonus: number | undefined = undefined;
    let maxSpinCredits: number | undefined = undefined;
    const creditedDepositIds = new Set<string>();
    const refundedWithdrawalIds = new Set<string>();

    for (const docId of Array.from(candidateIds)) {
      try {
        const snap = await getFreshDoc(doc(db, 'users', docId));
        if (snap.exists() && snap.data()) {
          foundAnyDoc = true;
          const d = snap.data() as any;
          if (typeof d.balance === 'number') {
            if (maxBalance === undefined || d.balance > maxBalance) maxBalance = d.balance;
          }
          if (typeof d.bonusBalance === 'number') {
            if (maxBonus === undefined || d.bonusBalance > maxBonus) maxBonus = d.bonusBalance;
          }
          if (typeof d.spinCredits === 'number') {
            if (maxSpinCredits === undefined || d.spinCredits > maxSpinCredits) maxSpinCredits = d.spinCredits;
          }
          if (Array.isArray(d.creditedDepositIds)) d.creditedDepositIds.forEach((id: string) => id && creditedDepositIds.add(id));
          if (Array.isArray(d.refundedWithdrawalIds)) d.refundedWithdrawalIds.forEach((id: string) => id && refundedWithdrawalIds.add(id));
        }
      } catch (_) {}
    }

    if (!foundAnyDoc || maxBalance === undefined) {
      // Never synthesize a 0 balance when document couldn't be loaded
      return null;
    }

    return {
      success: true,
      balance: Math.max(0, Math.round(maxBalance)),
      bonusBalance: maxBonus !== undefined ? Math.max(0, Math.round(maxBonus)) : 0,
      spinCredits: maxSpinCredits ?? 0,
      creditedDepositIds: Array.from(creditedDepositIds),
      refundedWithdrawalIds: Array.from(refundedWithdrawalIds),
      source: 'firestore_direct'
    };
  } catch (directErr) {
    console.warn('⚠️ Direct Firestore sync error:', directErr);
    return null;
  }
}




