import { setDoc, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { LiveUserActivityLog, OnlineUserPresence, User } from '../types';
import { sendAdminNotification } from './adminNotificationService';

/**
 * Update real-time online presence in Firestore
 */
export async function trackUserPresence(
  user: User,
  currentGame: string = 'Lobby',
  status: 'online' | 'betting' | 'idle' = 'online'
) {
  if (!user || !user.id) return;
  try {
    const presenceRef = doc(db, 'user_presence', user.id);
    const presenceData: OnlineUserPresence = {
      userId: user.id,
      userName: user.name || 'Player',
      userEmail: user.email || '',
      userPhone: user.phone || '',
      balance: user.balance || 0,
      lastSeen: Date.now(),
      status: status,
      currentGame: currentGame,
      device: window.innerWidth < 768 ? 'Mobile App / PWA' : 'Desktop Browser'
    };
    await setDoc(presenceRef, presenceData, { merge: true });
  } catch (err) {
    console.warn('Silent presence tracking note:', err);
  }
}

/**
 * Log live activity (Login, Betting, Win, Deposit, Withdraw) for Admin Sound & Radar Alerts
 */
export async function logLiveActivity(activity: {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  type: 'login' | 'bet' | 'win' | 'deposit' | 'withdraw';
  gameName?: string;
  betAmount?: number;
  winAmount?: number;
  details: string;
  metadata?: Record<string, any>;
}) {
  try {
    const actId = `ACT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const actDoc: LiveUserActivityLog = {
      id: actId,
      userId: activity.userId || 'anonymous',
      userName: activity.userName || 'Player',
      userEmail: activity.userEmail || '',
      userPhone: activity.userPhone || '',
      type: activity.type,
      gameName: activity.gameName || '',
      betAmount: activity.betAmount,
      winAmount: activity.winAmount,
      details: activity.details,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      metadata: activity.metadata || {}
    };

    const docRef = doc(collection(db, 'live_activities'), actId);
    await setDoc(docRef, actDoc);

    // Also dispatch persistent admin notification for real-time bell icon
    if (activity.type === 'bet') {
      sendAdminNotification({
        type: 'bet',
        title: `🎲 Live Bet: ${activity.gameName || 'Casino Game'}`,
        description: `${activity.userName || 'Player'} placed ₹${(activity.betAmount || 0).toLocaleString('en-IN')} bet on ${activity.gameName || 'Casino'}`,
        amount: activity.betAmount,
        userName: activity.userName,
        userId: activity.userId,
        status: 'completed',
        metadata: activity.metadata,
        customId: `notif_${actId}`
      }).catch(() => {});
    } else if (activity.type === 'win') {
      sendAdminNotification({
        type: 'bet',
        title: `🏆 Big Win: ${activity.gameName || 'Casino Game'}`,
        description: `${activity.userName || 'Player'} won ₹${(activity.winAmount || 0).toLocaleString('en-IN')} on ${activity.gameName || 'Casino'}!`,
        amount: activity.winAmount,
        userName: activity.userName,
        userId: activity.userId,
        status: 'completed',
        metadata: activity.metadata,
        customId: `notif_${actId}`
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Silent live activity logging note:', err);
  }
}

