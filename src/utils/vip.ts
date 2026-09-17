export type VipTierLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'VIP Platinum' | 'Diamond';

export interface VipTierInfo {
  level: VipTierLevel;
  minPoints: number;
  maxPoints: number;
  color: string;
  bgColor: string;
  badgeBg: string;
  borderColor: string;
  icon: string;
  dailyWithdrawalLimit: number;
  weeklyBonusAmount: number;
  perks: string[];
}

export const VIP_TIERS: Record<string, VipTierInfo> = {
  Bronze: {
    level: 'Bronze',
    minPoints: 0,
    maxPoints: 499,
    color: 'text-amber-600',
    bgColor: 'bg-amber-950/40',
    badgeBg: 'bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-amber-950/80 text-amber-500 border-amber-600/50 shadow-amber-900/30',
    borderColor: 'border-amber-600/40',
    icon: '🥉',
    dailyWithdrawalLimit: 10000,
    weeklyBonusAmount: 0,
    perks: ['Standard Withdrawal Limit (₹10,000/day)', '1x VIP Points Rate', 'Standard 24/7 Support']
  },
  Silver: {
    level: 'Silver',
    minPoints: 500,
    maxPoints: 1999,
    color: 'text-slate-200',
    bgColor: 'bg-slate-800/40',
    badgeBg: 'bg-gradient-to-r from-slate-800/90 via-slate-700/60 to-slate-800/90 text-slate-100 border-slate-300/60 shadow-slate-500/25',
    borderColor: 'border-slate-400/40',
    icon: '🥈',
    dailyWithdrawalLimit: 50000,
    weeklyBonusAmount: 250,
    perks: ['Enhanced Withdrawal Limit (₹50,000/day)', 'Weekly VIP Bonus ₹250', 'Silver VIP Metallic Badge', 'Priority Payouts Queue']
  },
  Gold: {
    level: 'Gold',
    minPoints: 2000,
    maxPoints: 9999,
    color: 'text-yellow-300',
    bgColor: 'bg-amber-500/10',
    badgeBg: 'bg-gradient-to-r from-amber-900/80 via-yellow-600/40 to-amber-900/80 text-yellow-300 border-yellow-400/70 shadow-yellow-500/30',
    borderColor: 'border-yellow-500/50',
    icon: '👑',
    dailyWithdrawalLimit: 200000,
    weeklyBonusAmount: 1000,
    perks: ['High Withdrawal Limit (₹2,00,000/day)', 'Weekly VIP Bonus ₹1,000', 'Gold VIP Crown Badge', 'Dedicated VIP Support Line']
  },
  Platinum: {
    level: 'Platinum',
    minPoints: 10000,
    maxPoints: 24999,
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-950/40',
    badgeBg: 'bg-gradient-to-r from-cyan-950/90 via-blue-900/50 to-cyan-950/90 text-cyan-300 border-cyan-400/70 shadow-cyan-500/35',
    borderColor: 'border-cyan-400/50',
    icon: '💠',
    dailyWithdrawalLimit: 500000,
    weeklyBonusAmount: 3000,
    perks: ['Platinum Payout Limit (₹5,00,000/day)', 'Weekly Mega Bonus ₹3,000', 'Platinum VIP Crest', 'Personal Account Manager']
  },
  'VIP Platinum': {
    level: 'Platinum',
    minPoints: 10000,
    maxPoints: 24999,
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-950/40',
    badgeBg: 'bg-gradient-to-r from-cyan-950/90 via-blue-900/50 to-cyan-950/90 text-cyan-300 border-cyan-400/70 shadow-cyan-500/35',
    borderColor: 'border-cyan-400/50',
    icon: '💠',
    dailyWithdrawalLimit: 500000,
    weeklyBonusAmount: 3000,
    perks: ['Platinum Payout Limit (₹5,00,000/day)', 'Weekly Mega Bonus ₹3,000', 'Platinum VIP Crest', 'Personal Account Manager']
  },
  Diamond: {
    level: 'Diamond',
    minPoints: 25000,
    maxPoints: Infinity,
    color: 'text-cyan-200',
    bgColor: 'bg-gradient-to-r from-cyan-950/60 via-purple-950/60 to-pink-950/60',
    badgeBg: 'bg-gradient-to-r from-cyan-900/90 via-indigo-900/70 to-fuchsia-900/90 text-cyan-200 border-cyan-300/80 shadow-cyan-400/40',
    borderColor: 'border-cyan-300/60',
    icon: '💎',
    dailyWithdrawalLimit: 2000000,
    weeklyBonusAmount: 10000,
    perks: ['Royal Limit (₹20,00,000/day)', 'Weekly Royal Diamond Bonus ₹10,000', 'Animated Rolling Diamond 💎 Prestige Badge', 'Elite VIP Concierge', 'Express Instant Payouts']
  }
};

export function calculateVipLevel(points?: number | null): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' {
  const safePoints = typeof points === 'number' && !isNaN(points) ? points : 0;
  if (safePoints >= 25000) return 'Diamond';
  if (safePoints >= 10000) return 'Platinum';
  if (safePoints >= 2000) return 'Gold';
  if (safePoints >= 500) return 'Silver';
  return 'Bronze';
}

export function calculateVipBonus(tierOrPoints?: string | number | null): number {
  if (typeof tierOrPoints === 'number') {
    const level = calculateVipLevel(tierOrPoints);
    return VIP_TIERS[level]?.weeklyBonusAmount ?? 0;
  }
  if (typeof tierOrPoints === 'string' && VIP_TIERS[tierOrPoints]) {
    return VIP_TIERS[tierOrPoints]?.weeklyBonusAmount ?? 0;
  }
  return 0;
}

export function getNextTierInfo(points?: number | null): { nextTier: VipTierInfo | null; pointsNeeded: number; progressPercent: number } {
  const safePoints = typeof points === 'number' && !isNaN(points) ? points : 0;
  const currentLevel = calculateVipLevel(safePoints);
  if (currentLevel === 'Diamond') {
    return { nextTier: null, pointsNeeded: 0, progressPercent: 100 };
  }

  const nextLevel: VipTierLevel =
    currentLevel === 'Bronze'
      ? 'Silver'
      : currentLevel === 'Silver'
      ? 'Gold'
      : currentLevel === 'Gold'
      ? 'Platinum'
      : 'Diamond';

  const nextTier = VIP_TIERS[nextLevel] || VIP_TIERS['Silver'];
  const currentTier = VIP_TIERS[currentLevel] || VIP_TIERS['Bronze'];

  const pointsNeeded = Math.max(0, (nextTier?.minPoints ?? 0) - safePoints);
  const totalRange = Math.max(1, (nextTier?.minPoints ?? 500) - (currentTier?.minPoints ?? 0));
  const earnedInRange = Math.max(0, safePoints - (currentTier?.minPoints ?? 0));
  const progressPercent = Math.min(Math.max((earnedInRange / totalRange) * 100, 0), 100);

  return { nextTier, pointsNeeded, progressPercent };
}

