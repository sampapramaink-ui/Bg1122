import { getAdminFirestore } from './_firebaseAdminHelper.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { userId, userEmail, userCode } = req.body || {};
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    const rawUserId = (userId || '').trim();

    if (!rawUserId && !cleanEmail) {
      return res.status(400).json({ success: false, error: 'userId or userEmail is required' });
    }

    const db = getAdminFirestore();
    if (!db) {
      return res.status(200).json({
        success: false,
        error: 'Firestore Admin SDK not initialized',
      });
    }

    const candidateDocIds = new Set();
    if (rawUserId && rawUserId !== 'anonymous' && rawUserId !== 'admin') {
      candidateDocIds.add(rawUserId);
    }
    const fallbackAlias = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    if (fallbackAlias) {
      candidateDocIds.add(fallbackAlias);
    }

    // 1. Gather all existing user documents matching ID or email
    const docSnapshots = [];

    // Query by direct IDs
    for (const docId of Array.from(candidateDocIds)) {
      try {
        const snap = await db.collection('users').doc(docId).get();
        if (snap.exists && snap.data()) {
          docSnapshots.push({ id: snap.id, ref: snap.ref, data: snap.data() });
        }
      } catch (_) {}
    }

    // Query by email
    if (cleanEmail && cleanEmail.includes('@')) {
      try {
        const qEmailSnap = await db.collection('users').where('email', '==', cleanEmail).get();
        qEmailSnap.docs.forEach((d) => {
          candidateDocIds.add(d.id);
          if (!docSnapshots.some((s) => s.id === d.id)) {
            docSnapshots.push({ id: d.id, ref: d.ref, data: d.data() });
          }
        });
      } catch (_) {}
    }

    // Expand linkedDocIds
    for (const { data } of docSnapshots) {
      if (Array.isArray(data.linkedDocIds)) {
        data.linkedDocIds.forEach((lid) => lid && candidateDocIds.add(lid));
      }
    }

    // Pick canonical document
    const authenticAuthDoc = docSnapshots.find((s) => !s.id.startsWith('user_') && !s.id.startsWith('BG-'));
    const canonicalUid = (authenticAuthDoc ? authenticAuthDoc.id : undefined) ||
      (rawUserId && rawUserId !== 'anonymous' ? rawUserId : undefined) ||
      docSnapshots[0]?.id ||
      fallbackAlias;

    candidateDocIds.add(canonicalUid);

    // Read current balance across candidate documents
    let currentBalance = 0;
    let currentBonusBalance = 0;
    let currentSpinCredits = 0;
    let resolvedName = 'Player';
    let resolvedUserCode = userCode || '';
    const creditedDepositIds = new Set();
    const refundedWithdrawalIds = new Set();

    for (const { data } of docSnapshots) {
      if (!data) continue;
      if (typeof data.balance === 'number' && data.balance > currentBalance) {
        currentBalance = data.balance;
      }
      if (typeof data.bonusBalance === 'number' && data.bonusBalance > currentBonusBalance) {
        currentBonusBalance = data.bonusBalance;
      }
      if (typeof data.spinCredits === 'number' && data.spinCredits > currentSpinCredits) {
        currentSpinCredits = data.spinCredits;
      }
      if (Array.isArray(data.creditedDepositIds)) {
        data.creditedDepositIds.forEach((id) => id && creditedDepositIds.add(id));
      }
      if (Array.isArray(data.refundedWithdrawalIds)) {
        data.refundedWithdrawalIds.forEach((id) => id && refundedWithdrawalIds.add(id));
      }
      if (!resolvedName || resolvedName === 'Player') {
        if (data.name && data.name.length > 1) resolvedName = data.name;
      }
      if (!resolvedUserCode && data.userCode) {
        resolvedUserCode = data.userCode;
      }
    }

    // 2. Query all approved deposits for this user to detect any uncredited deposits
    let uncreditedApprovedDepositAmount = 0;
    let uncreditedBonusSpins = 0;
    let newlyCreditedCount = 0;
    const newlyCreditedDepositDetails = [];

    try {
      const depSnaps = await db.collection('deposits').where('status', '==', 'approved').get();
      depSnaps.docs.forEach((d) => {
        const dep = d.data();
        const depId = d.id;
        const depUserId = (dep.userId || dep.uid || '').trim();
        const depEmail = (dep.userEmail || dep.email || '').toLowerCase().trim();
        const depCode = (dep.userCode || '').trim();

        // Match deposit to user
        const isMatch = (
          (rawUserId && depUserId === rawUserId) ||
          (canonicalUid && depUserId === canonicalUid) ||
          (cleanEmail && depEmail === cleanEmail) ||
          (candidateDocIds.has(depUserId)) ||
          (resolvedUserCode && depCode === resolvedUserCode)
        );

        if (isMatch) {
          const amt = Number(dep.amount) || 0;
          if (!creditedDepositIds.has(depId)) {
            creditedDepositIds.add(depId);
            uncreditedApprovedDepositAmount += amt;
            if (amt >= 1000) {
              uncreditedBonusSpins += Math.floor(amt / 1000);
            }
            newlyCreditedCount++;
            newlyCreditedDepositDetails.push({ id: depId, amount: amt });
          }
        }
      });
    } catch (depErr) {
      console.warn('Silent notice querying deposits:', depErr.message);
    }

    // 3. Query all rejected withdrawals for this user to detect any unrefunded amounts
    let unrefundedRejectedWithdrawalAmount = 0;
    let newlyRefundedCount = 0;

    try {
      const wthSnaps = await db.collection('withdrawals').where('status', '==', 'rejected').get();
      wthSnaps.docs.forEach((d) => {
        const wth = d.data();
        const wthId = d.id;
        const wthUserId = (wth.userId || wth.uid || '').trim();
        const wthEmail = (wth.userEmail || wth.email || '').toLowerCase().trim();
        const wthCode = (wth.userCode || '').trim();

        const isMatch = (
          (rawUserId && wthUserId === rawUserId) ||
          (canonicalUid && wthUserId === canonicalUid) ||
          (cleanEmail && wthEmail === cleanEmail) ||
          (candidateDocIds.has(wthUserId)) ||
          (resolvedUserCode && wthCode === resolvedUserCode)
        );

        if (isMatch) {
          const amt = Number(wth.amount) || 0;
          if (!refundedWithdrawalIds.has(wthId)) {
            refundedWithdrawalIds.add(wthId);
            unrefundedRejectedWithdrawalAmount += amt;
            newlyRefundedCount++;
          }
        }
      });
    } catch (wthErr) {
      console.warn('Silent notice querying withdrawals:', wthErr.message);
    }

    // Compute final authoritative balance
    const finalBalance = Math.max(0, Math.round(currentBalance + uncreditedApprovedDepositAmount + unrefundedRejectedWithdrawalAmount));
    const finalSpinCredits = Math.max(0, Math.round(currentSpinCredits + uncreditedBonusSpins));

    const needsWrite = (
      newlyCreditedCount > 0 ||
      newlyRefundedCount > 0 ||
      docSnapshots.some((s) => s.data?.balance !== finalBalance)
    );

    if (needsWrite) {
      const updatePayload = {
        balance: finalBalance,
        bonusBalance: currentBonusBalance,
        spinCredits: finalSpinCredits,
        creditedDepositIds: Array.from(creditedDepositIds),
        refundedWithdrawalIds: Array.from(refundedWithdrawalIds),
        linkedDocIds: Array.from(candidateDocIds),
        canonicalUid: canonicalUid,
        lastWalletSync: new Date().toISOString(),
      };

      if (cleanEmail) updatePayload.email = cleanEmail;

      const batchPromises = Array.from(candidateDocIds).map((docId) =>
        db.collection('users').doc(docId).set(updatePayload, { merge: true }).catch((err) => {
          console.warn(`Could not sync doc ${docId}:`, err.message);
        })
      );
      await Promise.all(batchPromises);
    }

    return res.status(200).json({
      success: true,
      canonicalUid,
      balance: finalBalance,
      bonusBalance: currentBonusBalance,
      spinCredits: finalSpinCredits,
      creditedDepositIds: Array.from(creditedDepositIds),
      refundedWithdrawalIds: Array.from(refundedWithdrawalIds),
      newlyCreditedCount,
      newlyCreditedAmount: uncreditedApprovedDepositAmount,
      newlyRefundedCount,
      newlyRefundedAmount: unrefundedRejectedWithdrawalAmount,
      newlyCreditedDeposits: newlyCreditedDepositDetails,
      serverTimestamp: Date.now()
    });
  } catch (err) {
    console.error('⚠️ sync-user-wallet error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal error syncing wallet',
    });
  }
}
