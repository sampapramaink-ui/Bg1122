import { User, LotteryDraw, LotteryDrawResult, DepositRequest, WithdrawalRequest, PurchasedTicket, WalletTransaction, NotificationItem } from '../types';

export const INITIAL_USER: User = {
  id: 'BG-789012',
  name: 'Subhasish Pramanik',
  email: 'subhasishpramanik835@gmail.com',
  phone: '+91 98765 43210',
  balance: 6435.00,
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  regDate: '2025-11-15',
  vipLevel: 'Gold',
  referralCode: 'GURU999',
  totalWon: 18500,
  totalSpent: 8200,
  status: 'active'
};

const now = Date.now();

export const INITIAL_DRAWS: LotteryDraw[] = [
  {
    id: 'draw-bumper-101',
    title: 'BETGURU BUMPER LAKHPATI',
    subtitle: '1st Prize Guaranteed ₹1,00,000 Cash',
    category: 'Bumper',
    ticketPrice: 100,
    prizePool: 500000,
    firstPrize: 100000,
    secondPrize: 25000,
    thirdPrize: 5000,
    endTime: now + 8 * 60 * 1000 + 45 * 1000, // ~8 mins from now
    drawDurationMs: 15 * 60 * 1000, // 15 mins repeat
    status: 'live',
    totalTicketsSold: 428,
    bannerGradient: 'from-amber-600 via-yellow-500 to-amber-700',
    badgeText: '🔥 HOT BUMPER'
  },
  {
    id: 'draw-speed-777',
    title: 'GOLDEN 777 SPEED EXPRESS',
    subtitle: 'Lightning Draw - Winner Every 3 Minutes!',
    category: 'Speed 1m',
    ticketPrice: 20,
    prizePool: 25000,
    firstPrize: 10000,
    secondPrize: 2500,
    thirdPrize: 500,
    endTime: now + 2 * 60 * 1000 + 15 * 1000, // ~2 mins from now
    drawDurationMs: 3 * 60 * 1000, // 3 mins repeat
    status: 'live',
    totalTicketsSold: 1142,
    bannerGradient: 'from-emerald-600 via-teal-500 to-emerald-800',
    badgeText: '⚡ SPEED DRAW'
  },
  {
    id: 'draw-mega-crore',
    title: 'MEGA CROREPATI DRAWS',
    subtitle: 'Grand Weekly Jackpot ₹10,00,000',
    category: 'Daily Mega',
    ticketPrice: 500,
    prizePool: 2500000,
    firstPrize: 1000000,
    secondPrize: 200000,
    thirdPrize: 50000,
    endTime: now + 4 * 3600 * 1000, // ~4 hours from now
    drawDurationMs: 24 * 3600 * 1000,
    status: 'live',
    totalTicketsSold: 890,
    bannerGradient: 'from-purple-800 via-yellow-600 to-amber-900',
    badgeText: '👑 GRAND JACKPOT'
  },
  {
    id: 'draw-4d-pick',
    title: '3D/4D LUCKY DIGIT PICK',
    subtitle: 'Pick 4 Lucky Numbers & Win 500X Multiplier',
    category: '4D Express',
    ticketPrice: 50,
    prizePool: 100000,
    firstPrize: 50000,
    secondPrize: 10000,
    thirdPrize: 2000,
    endTime: now + 12 * 60 * 1000,
    drawDurationMs: 20 * 60 * 1000,
    status: 'live',
    totalTicketsSold: 312,
    bannerGradient: 'from-cyan-700 via-blue-600 to-indigo-900',
    badgeText: '🎯 500X WIN'
  }
];

export const INITIAL_DEPOSITS: DepositRequest[] = [];

export const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [];

export const INITIAL_TICKETS: PurchasedTicket[] = [];

export const INITIAL_TRANSACTIONS: WalletTransaction[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const INITIAL_DRAW_RESULTS: LotteryDrawResult[] = [
  {
    id: 'res-bumper-100',
    drawId: 'draw-bumper-101',
    title: 'BETGURU BUMPER LAKHPATI #100',
    category: 'Bumper',
    winningNumbers: [4, 8, 2, 9, 1, 0],
    firstPrize: 100000,
    secondPrize: 25000,
    thirdPrize: 5000,
    date: new Date(Date.now() - 15 * 60 * 1000).toLocaleString('en-IN'),
    createdAt: Date.now() - 15 * 60 * 1000,
    totalWinners: 36,
    totalPayout: 130000,
    declaredBy: 'System Auto Draw'
  },
  {
    id: 'res-speed-776',
    drawId: 'draw-speed-777',
    title: 'GOLDEN 777 SPEED EXPRESS #776',
    category: 'Speed 1m',
    winningNumbers: [7, 7, 2, 9],
    firstPrize: 10000,
    secondPrize: 2500,
    thirdPrize: 500,
    date: new Date(Date.now() - 3 * 60 * 1000).toLocaleString('en-IN'),
    createdAt: Date.now() - 3 * 60 * 1000,
    totalWinners: 14,
    totalPayout: 13000,
    declaredBy: 'System Auto Draw'
  },
  {
    id: 'res-mega-044',
    drawId: 'draw-mega-crore',
    title: 'MEGA CROREPATI DRAWS #044',
    category: 'Daily Mega',
    winningNumbers: [9, 1, 5, 2, 8, 3],
    firstPrize: 1000000,
    secondPrize: 200000,
    thirdPrize: 50000,
    date: new Date(Date.now() - 24 * 3600 * 1000).toLocaleString('en-IN'),
    createdAt: Date.now() - 24 * 3600 * 1000,
    totalWinners: 88,
    totalPayout: 1250000,
    declaredBy: 'Admin Authority'
  },
  {
    id: 'res-4d-088',
    drawId: 'draw-4d-pick',
    title: '3D/4D LUCKY DIGIT PICK #088',
    category: '4D Express',
    winningNumbers: [3, 9, 0, 5],
    firstPrize: 50000,
    secondPrize: 10000,
    thirdPrize: 2000,
    date: new Date(Date.now() - 20 * 60 * 1000).toLocaleString('en-IN'),
    createdAt: Date.now() - 20 * 60 * 1000,
    totalWinners: 22,
    totalPayout: 62000,
    declaredBy: 'System Auto Draw'
  }
];

export const LIVE_WINNERS_FEED = [
  { name: 'Amit K.', amount: 25000, drawName: 'BUMPER LAKHPATI', time: '1 min ago' },
  { name: 'Sandeep V.', amount: 5000, drawName: 'GOLDEN 777 EXPRESS', time: '3 mins ago' },
  { name: 'Priya M.', amount: 100000, drawName: 'MEGA CROREPATI', time: '6 mins ago' },
  { name: 'Karan R.', amount: 2000, drawName: '3D LUCKY PICK', time: '8 mins ago' },
  { name: 'Vijay S.', amount: 10000, drawName: 'GOLDEN 777 EXPRESS', time: '12 mins ago' }
];
