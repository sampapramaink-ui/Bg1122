import { doc, setDoc, collection, getDocs, getDoc, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { LotteryScheduleSlot, PurchasedTicket, User } from '../types';

/**
 * Log administrative actions into Firestore audit logs with timestamps
 */
export async function logAdminAuditAction(
  action: string,
  details: string,
  adminUser?: { id?: string; name?: string; email?: string }
) {
  try {
    const logId = `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    await setDoc(doc(db, 'admin_audit_logs', logId), {
      id: logId,
      adminId: adminUser?.id || 'system-admin',
      adminName: adminUser?.name || adminUser?.email || 'System / Admin Scheduler',
      action,
      details,
      timestamp: now.toLocaleString('en-IN'),
      createdAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to log admin audit action:', err);
  }
}

/**
 * Helper to generate random winning digits/choices when non pre-selected
 */
function generateRandomWinningResult(category: string, gridsCount: number): (number | string)[] {
  const catLower = (category || '').toLowerCase();
  
  if (catLower.includes('car') || catLower.includes('super car')) {
    const colors: ('red' | 'black' | 'yellow')[] = ['red', 'black', 'yellow'];
    return [colors[Math.floor(Math.random() * colors.length)]];
  }

  if (catLower.includes('4d')) {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
  }

  if (catLower.includes('6d') || catLower.includes('bumper')) {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
  }

  if (catLower.includes('1m') || catLower.includes('speed')) {
    return Array.from({ length: 3 }, () => Math.floor(Math.random() * 10));
  }

  // Default: generate numbers according to resultGridsCount
  const count = Math.max(1, Math.min(10, gridsCount || 4));
  return Array.from({ length: count }, () => Math.floor(Math.random() * 10));
}

/**
 * Check if a ticket matches the winning result
 */
function isTicketWinner(
  ticket: PurchasedTicket,
  winningResult: (number | string)[],
  category: string
): boolean {
  const catLower = (category || ticket.category || ticket.drawTitle || '').toLowerCase();

  // Super Car comparison
  if (catLower.includes('car') || catLower.includes('super car')) {
    const playerChoice = (ticket.selectedCar || ticket.selectedNumbers?.[0] || '').toString().toLowerCase();
    const winningChoice = (winningResult[0] || '').toString().toLowerCase();
    return playerChoice === winningChoice;
  }

  // Digit/Number array comparison
  const playerNums = (ticket.selectedNumbers || []).map((n) => n.toString().trim());
  const winNums = winningResult.map((n) => n.toString().trim());

  if (playerNums.length === 0 || winNums.length === 0) return false;

  // Exact full match
  if (playerNums.join('') === winNums.join('')) {
    return true;
  }

  // Exact element-by-element match
  if (playerNums.length === winNums.length) {
    return playerNums.every((num, idx) => num === winNums[idx]);
  }

  // Substring match for single string representations
  return playerNums.join(',').includes(winNums.join(','));
}

/**
 * Auto-processes expired scheduled slots, publishes winning results, 
 * updates "Last Winning Result", and credits user wallets automatically.
 */
export async function processScheduledLotteryDraws(): Promise<{ processedCount: number }> {
  try {
    const nowMs = Date.now();
    const schedulesRef = collection(db, 'lottery_schedules');
    
    // Fetch upcoming/active slots that have expired
    const qSchedules = query(schedulesRef, where('status', 'in', ['scheduled', 'active']));
    const snap = await getDocs(qSchedules);

    if (snap.empty) return { processedCount: 0 };

    let processedCount = 0;

    for (const docSnap of snap.docs) {
      const slot = docSnap.data() as LotteryScheduleSlot;

      // Only process if timer reached zero
      if (!slot.scheduledTimestamp || slot.scheduledTimestamp > nowMs) {
        continue;
      }

      console.log(`[SchedulerEngine] Auto-publishing draw for slot ${slot.id} (${slot.lotteryTitle})`);

      // Determine winning result
      const finalWinningResult = (slot.winningResult && slot.winningResult.length > 0)
        ? slot.winningResult
        : generateRandomWinningResult(slot.category, slot.resultGridsCount || 4);

      // 1. Mark slot completed
      const publishedAtIso = new Date().toISOString();
      await setDoc(doc(db, 'lottery_schedules', slot.id), {
        status: 'completed',
        winningResult: finalWinningResult,
        publishedAt: publishedAtIso
      }, { merge: true });

      // Super Car is handled strictly by its dedicated 0-second Live Risk Engine.
      // Do not process Super Car here to avoid conflicting random draws or double settlement.
      const isSuperCar = (slot.category || '').toLowerCase().includes('car');
      if (isSuperCar) {
        continue;
      }

      // 3. Process all tickets for this draw
      const ticketsRef = collection(db, 'tickets');
      const qTickets = query(ticketsRef, where('status', '==', 'active'));
      const ticketsSnap = await getDocs(qTickets);

      if (!ticketsSnap.empty) {
        for (const tDoc of ticketsSnap.docs) {
          const ticket = tDoc.data() as PurchasedTicket;
          
          // Match ticket to slot/lottery
          const matchesDraw = 
            ticket.drawId === slot.lotteryId ||
            ticket.drawId === slot.id ||
            ticket.category === slot.category ||
            (ticket.drawTitle && ticket.drawTitle.includes(slot.lotteryTitle)) ||
            (ticket.drawTitle && ticket.drawTitle.includes(slot.slotName)) ||
            (ticket.drawTime && ticket.drawTime.toString().includes(slot.drawTimeLabel));

          if (!matchesDraw) continue;

          const winner = isTicketWinner(ticket, finalWinningResult, slot.category);
          
          let payout = 0;
          if (winner) {
            const price = ticket.price || slot.ticketPrice || 100;
            const multiplier = isSuperCar ? 2.8 : 10;
            payout = Math.round(price * multiplier);
          }

          // Mark ticket status
          await setDoc(doc(db, 'tickets', ticket.id), {
            status: winner ? 'win' : 'loss',
            wonAmount: payout,
            settledAt: publishedAtIso,
            winningResult: finalWinningResult
          }, { merge: true });

          // Credit wallet if winner
          if (winner && payout > 0) {
            const userRef = doc(db, 'users', ticket.userId);
            const uSnap = await getDoc(userRef);
            if (uSnap.exists()) {
              const uData = uSnap.data() as User;
              const isBonusTicket = ticket.walletType === 'bonus';
              const newBal = isBonusTicket ? (uData.balance || 0) : (uData.balance || 0) + payout;
              const newBonusBal = isBonusTicket ? (uData.bonusBalance || 0) + payout : (uData.bonusBalance || 0);
              const newWon = (uData.totalWon || 0) + payout;

              await setDoc(userRef, {
                balance: newBal,
                bonusBalance: newBonusBal,
                totalWon: newWon
              }, { merge: true });

              // Record transaction
              const txId = `TXN-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              await setDoc(doc(db, 'transactions', txId), {
                id: txId,
                userId: ticket.userId,
                type: isBonusTicket ? 'ticket_win' : 'win',
                walletType: isBonusTicket ? 'bonus' : 'main',
                amount: payout,
                description: `Auto Win Payout: ${slot.lotteryTitle} (${slot.slotName}) - Result: ${finalWinningResult.join(' ')} (Credited to ${isBonusTicket ? 'Bonus' : 'Main'} Wallet)`,
                status: 'completed',
                date: new Date().toLocaleString('en-IN')
              }, { merge: true });

              // Record notification
              const ntfId = `NTF-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              await setDoc(doc(db, 'notifications', ntfId), {
                id: ntfId,
                userId: ticket.userId,
                targetUserId: ticket.userId,
                title: '🏆 You Won a Lottery Draw!',
                message: `Congratulations! Your ticket #${ticket.ticketNumber || ticket.id} won ₹${payout.toLocaleString('en-IN')} in ${slot.lotteryTitle}.`,
                type: 'win',
                date: new Date().toLocaleString('en-IN'),
                read: false,
                isGlobal: false,
                createdAt: Date.now()
              }, { merge: true });
            }
          }
        }
      }

      // Log system audit
      await logAdminAuditAction(
        'Auto Scheduled Draw Published',
        `Slot ${slot.id} (${slot.lotteryTitle}) automatically published winning result: ${finalWinningResult.join(' ')}.`
      );

      processedCount++;
    }

    return { processedCount };
  } catch (err) {
    console.warn('Error processing scheduled draws:', err);
    return { processedCount: 0 };
  }
}
