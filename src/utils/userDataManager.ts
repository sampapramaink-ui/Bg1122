import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  setDoc, 
  query, 
  limit,
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, WalletTransaction, DepositRequest, WithdrawalRequest, PurchasedTicket, NotificationItem, BannedUserRecord } from '../types';

export interface UserDataSummary {
  depositsCount: number;
  depositsTotal: number;
  withdrawalsCount: number;
  withdrawalsTotal: number;
  gameBetsCount: number;
  gameBetsTotal: number;
  superCarBetsCount: number;
  superCarBetsTotal: number;
  lotteryTicketsCount: number;
  lotteryTicketsTotal: number;
  ledgerTxsCount: number;
  notificationsCount: number;
  totalRecords: number;
}

/**
 * Collect all possible identifiers associated with a user (UID, email, aliases, linked doc IDs)
 */
export function getUserMatchIdentifiers(user: User): { uids: Set<string>; email: string; phone?: string; name?: string } {
  const uids = new Set<string>();
  if (user.id) uids.add(user.id);
  if ((user as any).canonicalUid) uids.add((user as any).canonicalUid);
  if (user.linkedDocIds && Array.isArray(user.linkedDocIds)) {
    user.linkedDocIds.forEach((id) => uids.add(id));
  }
  const cleanEmail = (user.email || '').toLowerCase().trim();
  if (cleanEmail) {
    uids.add(`user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`);
    uids.add(cleanEmail);
  }
  const cleanPhone = (user.phone || (user as any).mobile || (user as any).phoneNumber || '').trim();
  const cleanName = (user.name || '').trim().toLowerCase();
  return { uids, email: cleanEmail, phone: cleanPhone, name: cleanName };
}

/**
 * Check if a Firestore record belongs to the target user
 */
export function isRecordMatchingUser(record: any, target: { uids: Set<string>; email: string; phone?: string; name?: string }): boolean {
  if (!record) return false;
  const recUid = record.userId || record.uid || record.user_id || record.userDocId;
  if (recUid && target.uids.has(recUid)) return true;
  if (record.id && target.uids.has(record.id)) return true;

  const recEmail = (record.userEmail || record.email || record.user_email || '').toLowerCase().trim();
  if (target.email && target.email.includes('@') && recEmail && recEmail === target.email) return true;

  // Only consider phone if it is a genuine, non-placeholder phone number
  const cleanTargetPhone = (target.phone || '').replace(/[^0-9]/g, '');
  const recPhone = (record.userPhone || record.phone || record.user_phone || record.mobile || record.phoneNumber || '').replace(/[^0-9]/g, '');
  const isDummyPhone = (p: string) => !p || p.length < 9 || p.includes('9876543210') || p.includes('1234567890') || p === '0000000000';

  if (!isDummyPhone(cleanTargetPhone) && !isDummyPhone(recPhone) && cleanTargetPhone === recPhone) {
    if (recEmail && target.email && recEmail !== target.email) return false;
    return true;
  }

  return false;
}

/**
 * Delete a single transaction or record by its document ID across Firestore collections
 */
export async function deleteSingleRecord(
  arg1: string,
  arg2?: string
): Promise<boolean> {
  const knownCollections = ['transactions', 'deposits', 'withdrawals', 'tickets', 'notifications', 'users', 'live_activities'];
  let collectionName = 'transactions';
  let docId = arg1;

  if (knownCollections.includes(arg1)) {
    collectionName = arg1;
    docId = arg2 || '';
  } else if (arg2 && knownCollections.includes(arg2)) {
    collectionName = arg2;
    docId = arg1;
  }

  if (!docId) return false;

  try {
    await deleteDoc(doc(db, collectionName, docId));
    return true;
  } catch (err) {
    console.warn(`Error deleting doc ${docId} from ${collectionName}:`, err);
    try {
      await deleteDoc(doc(db, 'transactions', docId));
      return true;
    } catch (_) {}
    return false;
  }
}

/**
 * Fetch a full statistical breakdown of a user's transactions, bets, deposits, withdrawals, tickets
 */
export async function getUserDataSummary(user: User): Promise<UserDataSummary> {
  const target = getUserMatchIdentifiers(user);
  
  const summary: UserDataSummary = {
    depositsCount: 0,
    depositsTotal: 0,
    withdrawalsCount: 0,
    withdrawalsTotal: 0,
    gameBetsCount: 0,
    gameBetsTotal: 0,
    superCarBetsCount: 0,
    superCarBetsTotal: 0,
    lotteryTicketsCount: 0,
    lotteryTicketsTotal: 0,
    ledgerTxsCount: 0,
    notificationsCount: 0,
    totalRecords: 0
  };

  try {
    const [txsSnap, depSnap, wthSnap, tixSnap, ntfSnap] = await Promise.all([
      getDocs(query(collection(db, 'transactions'), limit(1500))).catch(() => null),
      getDocs(query(collection(db, 'deposits'), limit(1500))).catch(() => null),
      getDocs(query(collection(db, 'withdrawals'), limit(1500))).catch(() => null),
      getDocs(query(collection(db, 'tickets'), limit(1500))).catch(() => null),
      getDocs(query(collection(db, 'notifications'), limit(1500))).catch(() => null)
    ]);

    // Deposits
    if (depSnap) {
      depSnap.docs.forEach((d) => {
        const data = d.data() as DepositRequest;
        if (isRecordMatchingUser(data, target)) {
          summary.depositsCount++;
          summary.depositsTotal += (data.amount || 0);
        }
      });
    }

    // Withdrawals
    if (wthSnap) {
      wthSnap.docs.forEach((d) => {
        const data = d.data() as WithdrawalRequest;
        if (isRecordMatchingUser(data, target)) {
          summary.withdrawalsCount++;
          summary.withdrawalsTotal += (data.amount || 0);
        }
      });
    }

    // Tickets (Super Car vs Lottery)
    if (tixSnap) {
      tixSnap.docs.forEach((d) => {
        const data = d.data() as PurchasedTicket;
        if (isRecordMatchingUser(data, target)) {
          const isSuperCar = data.category === 'Three Super Car Draw' || (data.drawTitle && data.drawTitle.toLowerCase().includes('super car'));
          if (isSuperCar) {
            summary.superCarBetsCount++;
            summary.superCarBetsTotal += (data.price || 0);
          } else {
            summary.lotteryTicketsCount++;
            summary.lotteryTicketsTotal += (data.price || 0);
          }
        }
      });
    }

    // Transactions (Game/Live Bets vs Ledger)
    if (txsSnap) {
      txsSnap.docs.forEach((d) => {
        const data = d.data() as WalletTransaction;
        if (isRecordMatchingUser(data, target)) {
          const tType = data.type || '';
          const isGameBet = tType.includes('bet') || 
                            tType.includes('win') || 
                            tType.includes('crash') || 
                            tType.includes('aviator') || 
                            tType.includes('roulette') || 
                            tType.includes('andar_bahar') || 
                            tType.includes('dragon_tiger') || 
                            tType.includes('wheel') || 
                            tType.includes('casino');
          if (isGameBet) {
            summary.gameBetsCount++;
            summary.gameBetsTotal += Math.abs(data.amount || 0);
          } else {
            summary.ledgerTxsCount++;
          }
        }
      });
    }

    // Notifications
    if (ntfSnap) {
      ntfSnap.docs.forEach((d) => {
        const data = d.data() as NotificationItem;
        if (isRecordMatchingUser(data, target)) {
          summary.notificationsCount++;
        }
      });
    }

    summary.totalRecords = summary.depositsCount + 
                           summary.withdrawalsCount + 
                           summary.gameBetsCount + 
                           summary.superCarBetsCount + 
                           summary.lotteryTicketsCount + 
                           summary.ledgerTxsCount + 
                           summary.notificationsCount;

  } catch (err) {
    console.warn('Error computing user data summary:', err);
  }

  return summary;
}

/**
 * Delete User Deposits only
 */
export async function clearUserDeposits(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'deposits'), limit(1500)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) {
        toDelete.push(d.id);
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'deposits', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user deposits:', e);
    throw e;
  }
  return count;
}

/**
 * Delete User Withdrawals only
 */
export async function clearUserWithdrawals(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'withdrawals'), limit(1500)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) {
        toDelete.push(d.id);
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'withdrawals', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user withdrawals:', e);
    throw e;
  }
  return count;
}

/**
 * Delete Game Bets & Live Bets (Aviator, Roulette, Andar Bahar, Dragon Tiger, Crash)
 */
export async function clearUserGameBets(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'transactions'), limit(2000)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as WalletTransaction;
      if (isRecordMatchingUser(data, target)) {
        const tType = data.type || '';
        const isGameBet = tType.includes('bet') || 
                          tType.includes('win') || 
                          tType.includes('crash') || 
                          tType.includes('aviator') || 
                          tType.includes('roulette') || 
                          tType.includes('andar_bahar') || 
                          tType.includes('dragon_tiger') || 
                          tType.includes('wheel') || 
                          tType.includes('casino');
        if (isGameBet) {
          toDelete.push(d.id);
        }
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'transactions', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user game bets:', e);
    throw e;
  }
  return count;
}

/**
 * Delete Three Super Car Bets only
 */
export async function clearUserThreeSuperCarBets(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'tickets'), limit(1500)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as PurchasedTicket;
      if (isRecordMatchingUser(data, target)) {
        const isSuperCar = data.category === 'Three Super Car Draw' || (data.drawTitle && data.drawTitle.toLowerCase().includes('super car'));
        if (isSuperCar) {
          toDelete.push(d.id);
        }
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'tickets', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user Three Super Car bets:', e);
    throw e;
  }
  return count;
}

/**
 * Delete Standard Lottery Tickets only
 */
export async function clearUserLotteryTickets(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'tickets'), limit(1500)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as PurchasedTicket;
      if (isRecordMatchingUser(data, target)) {
        const isSuperCar = data.category === 'Three Super Car Draw' || (data.drawTitle && data.drawTitle.toLowerCase().includes('super car'));
        if (!isSuperCar) {
          toDelete.push(d.id);
        }
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'tickets', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user lottery tickets:', e);
    throw e;
  }
  return count;
}

/**
 * Delete Wallet Ledger Transactions (Adjustments, Bonuses, Deductions, Transfers)
 */
export async function clearUserLedgerTransactions(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'transactions'), limit(2000)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as WalletTransaction;
      if (isRecordMatchingUser(data, target)) {
        const tType = data.type || '';
        const isGameBet = tType.includes('bet') || 
                          tType.includes('win') || 
                          tType.includes('crash') || 
                          tType.includes('aviator') || 
                          tType.includes('roulette') || 
                          tType.includes('andar_bahar') || 
                          tType.includes('dragon_tiger') || 
                          tType.includes('wheel') || 
                          tType.includes('casino');
        if (!isGameBet) {
          toDelete.push(d.id);
        }
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'transactions', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user ledger transactions:', e);
    throw e;
  }
  return count;
}

/**
 * Delete User Notifications
 */
export async function clearUserNotifications(user: User): Promise<number> {
  const target = getUserMatchIdentifiers(user);
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, 'notifications'), limit(1500)));
    const toDelete: string[] = [];
    snap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) {
        toDelete.push(d.id);
      }
    });
    await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'notifications', id)).catch(() => {})));
    count = toDelete.length;
  } catch (e) {
    console.error('Error clearing user notifications:', e);
    throw e;
  }
  return count;
}

/**
 * Wipe ALL User Records & Transaction History in one atomic sweep
 */
export async function wipeAllUserData(
  user: User, 
  options: { resetBalances?: boolean } = { resetBalances: true }
): Promise<{
  depositsDeleted: number;
  withdrawalsDeleted: number;
  transactionsDeleted: number;
  ticketsDeleted: number;
  notificationsDeleted: number;
  totalDeleted: number;
}> {
  const target = getUserMatchIdentifiers(user);

  const [txsSnap, depSnap, wthSnap, tixSnap, ntfSnap, actSnap] = await Promise.all([
    getDocs(query(collection(db, 'transactions'), limit(2000))).catch(() => null),
    getDocs(query(collection(db, 'deposits'), limit(1500))).catch(() => null),
    getDocs(query(collection(db, 'withdrawals'), limit(1500))).catch(() => null),
    getDocs(query(collection(db, 'tickets'), limit(1500))).catch(() => null),
    getDocs(query(collection(db, 'notifications'), limit(1500))).catch(() => null),
    getDocs(query(collection(db, 'live_activities'), limit(500))).catch(() => null)
  ]);

  const txsToDelete: string[] = [];
  const depsToDelete: string[] = [];
  const wthsToDelete: string[] = [];
  const tixToDelete: string[] = [];
  const ntfsToDelete: string[] = [];
  const actsToDelete: string[] = [];

  if (txsSnap) {
    txsSnap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) txsToDelete.push(d.id);
    });
  }
  if (depSnap) {
    depSnap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) depsToDelete.push(d.id);
    });
  }
  if (wthSnap) {
    wthSnap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) wthsToDelete.push(d.id);
    });
  }
  if (tixSnap) {
    tixSnap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) tixToDelete.push(d.id);
    });
  }
  if (ntfSnap) {
    ntfSnap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) ntfsToDelete.push(d.id);
    });
  }
  if (actSnap) {
    actSnap.docs.forEach((d) => {
      if (isRecordMatchingUser(d.data(), target)) actsToDelete.push(d.id);
    });
  }

  // Execute parallel deletions across all sub-collections
  await Promise.all([
    ...txsToDelete.map((id) => deleteDoc(doc(db, 'transactions', id)).catch(() => {})),
    ...depsToDelete.map((id) => deleteDoc(doc(db, 'deposits', id)).catch(() => {})),
    ...wthsToDelete.map((id) => deleteDoc(doc(db, 'withdrawals', id)).catch(() => {})),
    ...tixToDelete.map((id) => deleteDoc(doc(db, 'tickets', id)).catch(() => {})),
    ...ntfsToDelete.map((id) => deleteDoc(doc(db, 'notifications', id)).catch(() => {})),
    ...actsToDelete.map((id) => deleteDoc(doc(db, 'live_activities', id)).catch(() => {}))
  ]);

  // Optionally reset balances and statistics on user document
  if (options.resetBalances) {
    const docIds = Array.from(target.uids);
    await Promise.all(
      docIds.map((dId) =>
        setDoc(
          doc(db, 'users', dId),
          {
            balance: 0,
            bonusBalance: 0,
            totalWon: 0,
            totalSpent: 0,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        ).catch(() => {})
      )
    );
  }

  // Clear local storage cache
  try {
    target.uids.forEach((uid) => {
      localStorage.removeItem(`betguru_transactions_${uid}`);
      localStorage.removeItem(`betguru_deleted_ntfs_${uid}`);
    });
  } catch (_) {}

  const totalDeleted = txsToDelete.length + 
                       depsToDelete.length + 
                       wthsToDelete.length + 
                       tixToDelete.length + 
                       ntfsToDelete.length;

  return {
    depositsDeleted: depsToDelete.length,
    withdrawalsDeleted: wthsToDelete.length,
    transactionsDeleted: txsToDelete.length,
    ticketsDeleted: tixToDelete.length,
    notificationsDeleted: ntfsToDelete.length,
    totalDeleted
  };
}

/**
 * Generate a deterministic Ban Document ID based on email or phone or UID
 */
export function getBanDocId(email?: string, phone?: string, userId?: string): string {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (cleanEmail) {
    return `ban_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone) {
    return `ban_phone_${cleanPhone}`;
  }
  return `ban_uid_${userId || 'unknown'}`;
}

/**
 * Check if an email, phone number, or user ID is blacklisted/banned in Firestore
 */
export async function checkIsUserBanned(
  email?: string | null, 
  phone?: string | null, 
  userId?: string | null
): Promise<{ isBanned: boolean; record?: BannedUserRecord; reason?: string }> {
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    
    // 1. Direct check by deterministic doc ID
    if (cleanEmail) {
      const banDocRef = doc(db, 'banned_users', `ban_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`);
      const banSnap = await getDoc(banDocRef).catch(() => null);
      if (banSnap && banSnap.exists()) {
        const data = banSnap.data() as BannedUserRecord;
        if (data.active !== false) {
          return { isBanned: true, record: data, reason: data.reason || 'Account suspended by administrator' };
        }
      }
    }

    if (cleanPhone && cleanPhone.length >= 10) {
      const banPhoneDocRef = doc(db, 'banned_users', `ban_phone_${cleanPhone}`);
      const phoneSnap = await getDoc(banPhoneDocRef).catch(() => null);
      if (phoneSnap && phoneSnap.exists()) {
        const data = phoneSnap.data() as BannedUserRecord;
        if (data.active !== false) {
          return { isBanned: true, record: data, reason: data.reason || 'Account suspended by administrator' };
        }
      }
    }

    if (userId) {
      const banUidDocRef = doc(db, 'banned_users', `ban_uid_${userId}`);
      const uidSnap = await getDoc(banUidDocRef).catch(() => null);
      if (uidSnap && uidSnap.exists()) {
        const data = uidSnap.data() as BannedUserRecord;
        if (data.active !== false) {
          return { isBanned: true, record: data, reason: data.reason || 'Account suspended by administrator' };
        }
      }
    }

    // 2. Query collection for matching email or phone
    if (cleanEmail) {
      const qEmail = query(collection(db, 'banned_users'), where('email', '==', cleanEmail), limit(1));
      const snapEmail = await getDocs(qEmail).catch(() => null);
      if (snapEmail && !snapEmail.empty) {
        const data = snapEmail.docs[0].data() as BannedUserRecord;
        if (data.active !== false) {
          return { isBanned: true, record: data, reason: data.reason || 'Account suspended by administrator' };
        }
      }
    }

    if (cleanPhone && cleanPhone.length >= 10) {
      const qPhone = query(collection(db, 'banned_users'), where('phone', '==', cleanPhone), limit(1));
      const snapPhone = await getDocs(qPhone).catch(() => null);
      if (snapPhone && !snapPhone.empty) {
        const data = snapPhone.docs[0].data() as BannedUserRecord;
        if (data.active !== false) {
          return { isBanned: true, record: data, reason: data.reason || 'Account suspended by administrator' };
        }
      }
    }
  } catch (err) {
    console.warn('checkIsUserBanned error:', err);
  }

  return { isBanned: false };
}

/**
 * Fetch all banned users list for Admin Dashboard
 */
export async function fetchBannedUsersList(): Promise<BannedUserRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'banned_users'));
    const list: BannedUserRecord[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as BannedUserRecord;
      list.push({
        ...data,
        id: d.id
      });
    });
    return list.sort((a, b) => new Date(b.bannedAt || 0).getTime() - new Date(a.bannedAt || 0).getTime());
  } catch (e) {
    console.warn('fetchBannedUsersList error:', e);
    return [];
  }
}

/**
 * Ban or Block a user and record to banned_users collection
 */
export async function banUserAndRecord(
  user: User, 
  reason: string = 'Violation of platform fair-play terms & account security audit',
  type: 'block' | 'block_and_delete' = 'block',
  bannedBy: string = 'Admin'
): Promise<BannedUserRecord> {
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const cleanPhone = (user.phone || '').trim();
  const banDocId = getBanDocId(cleanEmail, cleanPhone, user.id);

  const banRecord: BannedUserRecord = {
    id: banDocId,
    email: cleanEmail,
    phone: cleanPhone,
    userId: user.id,
    name: user.name || (cleanEmail ? cleanEmail.split('@')[0] : 'Player'),
    reason: reason || 'Suspended by platform administrator',
    bannedAt: new Date().toISOString(),
    bannedBy: bannedBy,
    type: type,
    active: true,
    archivedData: {
      balance: user.balance,
      bonusBalance: user.bonusBalance,
      regDate: user.regDate,
      vipLevel: user.vipLevel
    }
  };

  // Write to banned_users collection
  await setDoc(doc(db, 'banned_users', banDocId), banRecord, { merge: true }).catch((err) => {
    console.warn('Error saving ban record:', err);
  });

  // If email exists, also ensure ban by email lookup
  if (cleanEmail) {
    const emailBanDocId = `ban_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (emailBanDocId !== banDocId) {
      await setDoc(doc(db, 'banned_users', emailBanDocId), banRecord, { merge: true }).catch(() => {});
    }
  }

  // Update user doc status in users collection if still retaining doc
  if (type === 'block') {
    const canonicalUid = user.id || (user as any).canonicalUid;
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const payload = {
      status: 'suspended',
      isBlocked: true,
      blockReason: reason,
      blockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', canonicalUid), payload, { merge: true }).catch(() => {});
    if (cleanEmail) {
      const aliasId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (aliasId !== canonicalUid) {
        deleteDoc(doc(db, 'users', aliasId)).catch(() => {});
      }
    }
  }

  return banRecord;
}

/**
 * Unban / Restore a banned user record from banned_users and reactivate user profile
 */
export async function unbanUserAndRestore(
  banRecordOrId: BannedUserRecord | string,
  userDocToReactivate?: User
): Promise<{ success: boolean; message: string }> {
  try {
    let banId = typeof banRecordOrId === 'string' ? banRecordOrId : banRecordOrId.id;
    let targetEmail = typeof banRecordOrId !== 'string' ? banRecordOrId.email : '';
    let targetPhone = typeof banRecordOrId !== 'string' ? banRecordOrId.phone : '';
    let targetUserId = typeof banRecordOrId !== 'string' ? banRecordOrId.userId : '';

    // If ID passed, fetch the doc to get email & phone
    if (!targetEmail) {
      const snap = await getDoc(doc(db, 'banned_users', banId)).catch(() => null);
      if (snap && snap.exists()) {
        const data = snap.data() as BannedUserRecord;
        targetEmail = data.email;
        targetPhone = data.phone || '';
        targetUserId = data.userId || '';
      }
    }

    // 1. Delete ban document(s) from Firestore
    await deleteDoc(doc(db, 'banned_users', banId)).catch(() => {});
    if (targetEmail) {
      const emailBanId = `ban_${targetEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
      await deleteDoc(doc(db, 'banned_users', emailBanId)).catch(() => {});
    }
    if (targetPhone) {
      const phoneBanId = `ban_phone_${targetPhone.replace(/[^0-9]/g, '')}`;
      await deleteDoc(doc(db, 'banned_users', phoneBanId)).catch(() => {});
    }
    if (targetUserId) {
      const uidBanId = `ban_uid_${targetUserId}`;
      await deleteDoc(doc(db, 'banned_users', uidBanId)).catch(() => {});
    }

    // 2. Reactivate status in users collection strictly on canonical document
    const canonicalUid = targetUserId || (userDocToReactivate ? userDocToReactivate.id : '');

    const unbanPayload = {
      status: 'active',
      isBlocked: false,
      blockReason: '',
      blockedAt: null,
      updatedAt: new Date().toISOString()
    };

    if (canonicalUid) {
      await setDoc(doc(db, 'users', canonicalUid), unbanPayload, { merge: true }).catch(() => {});
    } else if (targetEmail) {
      // Find existing doc by email
      try {
        const qByEmail = query(collection(db, 'users'), where('email', '==', targetEmail.toLowerCase().trim()));
        const snap = await getDocs(qByEmail);
        if (!snap.empty) {
          await setDoc(doc(db, 'users', snap.docs[0].id), unbanPayload, { merge: true });
        }
      } catch (_) {}
    }

    if (targetEmail) {
      const aliasId = `user_${targetEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (aliasId !== canonicalUid) {
        deleteDoc(doc(db, 'users', aliasId)).catch(() => {});
      }
    }

    return {
      success: true,
      message: `User ${targetEmail || targetUserId || 'Account'} has been successfully unbanned & restored!`
    };
  } catch (err: any) {
    console.error('unbanUserAndRestore error:', err);
    return { success: false, message: err?.message || 'Failed to unban user.' };
  }
}

/**
 * Block or Unblock a user in Firebase with optional reason
 */
export async function setUserBlockStatus(
  user: User, 
  isBlocked: boolean, 
  reason: string = 'Violation of platform fair-play terms & account security audit',
  bannedBy: string = 'Admin'
): Promise<void> {
  const canonicalUid = user.id || (user as any).canonicalUid;
  const cleanEmail = (user.email || '').toLowerCase().trim();

  const payload = {
    status: isBlocked ? 'suspended' : 'active',
    isBlocked: isBlocked,
    blockReason: isBlocked ? reason : '',
    blockedAt: isBlocked ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString()
  };

  // Update in users collection strictly on single canonical user doc
  await setDoc(doc(db, 'users', canonicalUid), payload, { merge: true }).catch((err) =>
    console.warn(`Error setting block status for doc ${canonicalUid}:`, err)
  );

  // Clean up legacy alias doc to avoid ghost duplicates
  if (cleanEmail) {
    const aliasId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (aliasId !== canonicalUid) {
      deleteDoc(doc(db, 'users', aliasId)).catch(() => {});
    }
  }

  // Sync to banned_users collection
  if (isBlocked) {
    await banUserAndRecord(user, reason, 'block', bannedBy);
  } else {
    const cleanPhone = (user.phone || '').trim();
    const banId = getBanDocId(cleanEmail, cleanPhone, user.id);
    await unbanUserAndRestore(banId, user);
  }
}

/**
 * Block and Delete User Permanently:
 * 1. Blacklists email/phone in banned_users collection so they can NEVER register/login again (unless Admin unblocks).
 * 2. Completely wipes all transactions, tickets, deposits, withdrawals, notifications, presence, and user doc.
 */
export async function blockAndDeleteUserPermanently(
  user: User,
  reason: string = 'Permanent block and complete data wipe by administrator',
  bannedBy: string = 'Admin'
): Promise<{ success: boolean; recordsWiped: number; banRecord: BannedUserRecord }> {
  // 1. Record in banned_users first to lock credentials
  const banRecord = await banUserAndRecord(user, reason, 'block_and_delete', bannedBy);

  // 2. Wipe all records and history across all collections
  const wipeResult = await wipeAllUserData(user, { resetBalances: false }).catch(() => ({ totalDeleted: 0 }));

  // 3. Permanently remove user documents from users collection
  const target = getUserMatchIdentifiers(user);
  const docIds = Array.from(target.uids);

  await Promise.all(
    docIds.map((dId) =>
      deleteDoc(doc(db, 'users', dId)).catch((err) =>
        console.warn(`Error deleting user doc ${dId}:`, err)
      )
    )
  );

  // Also clean up presence
  await Promise.all(
    docIds.map((dId) =>
      deleteDoc(doc(db, 'user_presence', dId)).catch(() => {})
    )
  );

  // Clear local storage cache
  try {
    target.uids.forEach((uid) => {
      localStorage.removeItem(`betguru_transactions_${uid}`);
      localStorage.removeItem(`betguru_deposits_${uid}`);
      localStorage.removeItem(`betguru_withdrawals_${uid}`);
      localStorage.removeItem(`betguru_tickets_${uid}`);
      localStorage.removeItem(`betguru_notifications_${uid}`);
      localStorage.removeItem(`betguru_deleted_ntfs_${uid}`);
    });
  } catch (_) {}

  return {
    success: true,
    recordsWiped: wipeResult.totalDeleted,
    banRecord
  };
}

/**
 * Permanently delete user document(s) from Firebase and wipe all associated history
 * (Clean removal without permanent email ban, or standard wipe)
 */
export async function permanentlyDeleteUserAndAllRecords(
  user: User, 
  wipeHistory: boolean = true
): Promise<{ success: boolean; recordsWiped: number }> {
  let recordsWiped = 0;
  
  if (wipeHistory) {
    const res = await wipeAllUserData(user, { resetBalances: false }).catch(() => null);
    if (res) recordsWiped = res.totalDeleted;
  }

  const target = getUserMatchIdentifiers(user);
  const docIds = Array.from(target.uids);

  // Delete all user docs
  await Promise.all(
    docIds.map((dId) =>
      deleteDoc(doc(db, 'users', dId)).catch((err) =>
        console.warn(`Error deleting user doc ${dId}:`, err)
      )
    )
  );

  // Also clean up presence
  await Promise.all(
    docIds.map((dId) =>
      deleteDoc(doc(db, 'user_presence', dId)).catch(() => {})
    )
  );

  // Clear local storage cache
  try {
    target.uids.forEach((uid) => {
      localStorage.removeItem(`betguru_transactions_${uid}`);
      localStorage.removeItem(`betguru_deposits_${uid}`);
      localStorage.removeItem(`betguru_withdrawals_${uid}`);
      localStorage.removeItem(`betguru_tickets_${uid}`);
      localStorage.removeItem(`betguru_notifications_${uid}`);
      localStorage.removeItem(`betguru_deleted_ntfs_${uid}`);
    });
  } catch (_) {}

  return { success: true, recordsWiped };
}

export interface UserProfileUpdatePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  age?: number | string;
  address?: string;
  documentId?: string;
  documentType?: string;
  gender?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/**
 * Compress an image file to a lightweight data URL for avatar storage
 */
export function readFileAsCompressedDataUrl(
  file: File, 
  maxWidth = 400, 
  maxHeight = 400, 
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(readerEvent.target?.result as string);
        }
      };
      img.onerror = () => resolve(readerEvent.target?.result as string);
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Update user profile details in Firestore strictly on the single canonical user document
 */
export async function updateUserProfileDetails(
  user: User,
  updates: UserProfileUpdatePayload
): Promise<{ success: boolean; updatedUser: User }> {
  const canonicalUid = user.id || (user as any).canonicalUid;
  const cleanEmail = (user.email || '').toLowerCase().trim();

  const cleanPayload: any = {};
  if (updates.name !== undefined) cleanPayload.name = updates.name.trim();
  if (updates.phone !== undefined) cleanPayload.phone = updates.phone.trim();
  if (updates.avatarUrl !== undefined) cleanPayload.avatarUrl = updates.avatarUrl;
  if (updates.age !== undefined) cleanPayload.age = updates.age;
  if (updates.address !== undefined) cleanPayload.address = updates.address.trim();
  if (updates.documentId !== undefined) cleanPayload.documentId = updates.documentId.trim();
  if (updates.documentType !== undefined) cleanPayload.documentType = updates.documentType.trim();
  if (updates.gender !== undefined) cleanPayload.gender = updates.gender;
  if (updates.city !== undefined) cleanPayload.city = updates.city?.trim();
  if (updates.state !== undefined) cleanPayload.state = updates.state?.trim();
  if (updates.pincode !== undefined) cleanPayload.pincode = updates.pincode?.trim();
  cleanPayload.updatedAt = new Date().toISOString();

  // Strictly update the single primary canonical user document
  await setDoc(doc(db, 'users', canonicalUid), cleanPayload, { merge: true }).catch((err) =>
    console.warn(`Error updating user doc ${canonicalUid}:`, err)
  );

  // Clean up legacy alias doc if different
  if (cleanEmail) {
    const aliasId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (aliasId !== canonicalUid) {
      deleteDoc(doc(db, 'users', aliasId)).catch(() => {});
    }
  }

  const updatedUser: User = {
    ...user,
    ...cleanPayload,
    id: canonicalUid,
    linkedDocIds: [canonicalUid]
  };

  return { success: true, updatedUser };
}

