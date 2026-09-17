import { User, LotteryDraw, DepositRequest, WithdrawalRequest, PurchasedTicket, WalletTransaction, NotificationItem } from '../types';
import { INITIAL_DRAWS, INITIAL_DEPOSITS, INITIAL_WITHDRAWALS, INITIAL_TICKETS, INITIAL_TRANSACTIONS, INITIAL_NOTIFICATIONS } from '../data/mockData';

const KEYS = {
  USER: 'betguru_user',
  DRAWS: 'betguru_draws',
  DEPOSITS: 'betguru_deposits',
  WITHDRAWALS: 'betguru_withdrawals',
  TICKETS: 'betguru_tickets',
  TRANSACTIONS: 'betguru_transactions',
  NOTIFICATIONS: 'betguru_notifications'
};

export const loadState = () => {
  try {
    // User data is strictly loaded and synced via real-time Firestore onSnapshot listeners.
    // We never load user identity or balance from localStorage to prevent stale or conflicting state.
    const user = null;
    const draws = localStorage.getItem(KEYS.DRAWS) ? JSON.parse(localStorage.getItem(KEYS.DRAWS)!) : INITIAL_DRAWS;
    
    // User-specific financial and history data must always initialize as clean empty arrays.
    // Real-time Firestore onSnapshot listeners will safely hydrate the active user's specific records.
    let deposits: DepositRequest[] = [];
    let withdrawals: WithdrawalRequest[] = [];
    let tickets: PurchasedTicket[] = [];
    let transactions: WalletTransaction[] = [];
    let notifications: NotificationItem[] = [];

    return { user, draws, deposits, withdrawals, tickets, transactions, notifications };
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
    return {
      user: null,
      draws: INITIAL_DRAWS,
      deposits: [],
      withdrawals: [],
      tickets: [],
      transactions: [],
      notifications: []
    };
  }
};

export const saveState = (state: {
  user?: User;
  draws?: LotteryDraw[];
  deposits?: DepositRequest[];
  withdrawals?: WithdrawalRequest[];
  tickets?: PurchasedTicket[];
  transactions?: WalletTransaction[];
  notifications?: NotificationItem[];
}) => {
  try {
    // We do NOT store user identity or balance in localStorage (pure real-time Firestore architecture)
    if (state.draws) localStorage.setItem(KEYS.DRAWS, JSON.stringify(state.draws));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
};

