import { CrashGameConfig } from '../types';

export interface CrashLiveBetItem {
  id: string;
  roundId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  panel: 1 | 2;
  betAmount?: number;
  amount?: number;
  autoCashOutAt?: number;
  autoCashOutTarget?: number | null;
  status: 'placed' | 'won' | 'lost' | 'crashed' | 'cancelled' | 'active' | 'cashed_out';
  cashOutMultiplier?: number;
  wonAmount?: number;
  date?: string;
  timestamp?: number;
}

export interface CrashThresholdLiability {
  multiplier: number;
  label: string;
  activeWagersExposed: number;
  totalPayoutLiability: number;
  netHouseProfit: number;
  profitMarginPercentage: number;
  riskRating: 'safe' | 'medium' | 'high';
}

export interface CrashRiskAnalysis {
  totalPot: number;
  totalActiveWagers: number;
  totalCashedOutPayouts: number;
  totalBetsCount: number;
  uniqueUsersCount: number;
  thresholds: CrashThresholdLiability[];
  autoRecommendedCrashMultiplier: number;
  autoProjectedHouseProfit: number;
  hasAbnormalConcentration: boolean;
  concentrationAlertMessage?: string;
}

/**
 * Calculates complete real-time flight risk curve & liability for Aviator / Crash Game
 */
export function analyzeCrashLiveBets(
  liveBets: CrashLiveBetItem[],
  config: Partial<CrashGameConfig> = {}
): CrashRiskAnalysis {
  let totalPot = 0;
  let totalActiveWagers = 0;
  let totalCashedOutPayouts = 0;
  const uniqueUsers = new Set<string>();

  const activeBets = liveBets.filter((b) => b.status === 'placed' || b.status === 'active');

  liveBets.forEach((bet) => {
    const amt = Number(bet.amount ?? bet.betAmount) || 0;
    if (amt <= 0) return;
    totalPot += amt;
    if (bet.userId) uniqueUsers.add(bet.userId);

    if (bet.status === 'won' || bet.status === 'cashed_out') {
      totalCashedOutPayouts += (Number(bet.wonAmount) || (amt * (Number(bet.cashOutMultiplier) || 1.0)));
    } else if (bet.status === 'placed' || bet.status === 'active') {
      totalActiveWagers += amt;
    }
  });

  const EVAL_MULTIPLIERS = [1.00, 1.10, 1.20, 1.35, 1.50, 1.75, 2.00, 3.00, 5.00, 10.00, 25.00];

  const thresholds: CrashThresholdLiability[] = EVAL_MULTIPLIERS.map((mult) => {
    // If round crashes at `mult`:
    // All bets with autoCashOutAt <= mult will win (unless already cashed out)
    // All manual active bets if not cashed out before `mult`
    let payoutAtMult = totalCashedOutPayouts;
    let wagersExposed = 0;

    activeBets.forEach((b) => {
      const amt = Number(b.amount ?? b.betAmount) || 0;
      const target = (b.autoCashOutTarget ?? b.autoCashOutAt) ? Number(b.autoCashOutTarget ?? b.autoCashOutAt) : null;
      if (target && target <= mult) {
        // Auto cashout triggered
        payoutAtMult += Math.round(amt * target);
        wagersExposed += amt;
      } else if (mult > 1.00) {
        // Manual player exposed to potentially cash out before mult
        payoutAtMult += Math.round(amt * mult);
        wagersExposed += amt;
      }
    });

    const netHouseProfit = totalPot - payoutAtMult;
    const margin = totalPot > 0 ? (netHouseProfit / totalPot) * 100 : 100;

    let riskRating: 'safe' | 'medium' | 'high' = 'safe';
    if (netHouseProfit < 0) {
      riskRating = 'high';
    } else if (margin < 15) {
      riskRating = 'medium';
    }

    return {
      multiplier: mult,
      label: `${mult.toFixed(2)}x`,
      activeWagersExposed: wagersExposed,
      totalPayoutLiability: payoutAtMult,
      netHouseProfit: Math.round(netHouseProfit),
      profitMarginPercentage: Math.round(margin * 10) / 10,
      riskRating,
    };
  });

  // Calculate Auto Recommended Crash Point based on House Edge (0% to 99.9%)
  const rtp = typeof config.rtpPercentage === 'number' ? config.rtpPercentage : 97.0;
  const houseEdge = typeof config.houseEdgePercentage === 'number' ? config.houseEdgePercentage : (100 - rtp);

  let autoRecommendedCrashMultiplier = 1.00;
  let autoProjectedHouseProfit = totalPot;

  if (totalActiveWagers === 0) {
    // Standard natural curve if no active wagers
    autoRecommendedCrashMultiplier = 2.45;
    autoProjectedHouseProfit = 0;
  } else if (houseEdge >= 90 || rtp <= 10) {
    // Extreme house protection -> Instant crash at 1.00x or 1.02x
    autoRecommendedCrashMultiplier = 1.00;
    autoProjectedHouseProfit = totalPot;
  } else {
    // Find safe threshold that preserves at least target house edge
    const targetMinProfit = totalPot * (houseEdge / 100);
    const safeThreshold = [...thresholds]
      .filter((t) => t.netHouseProfit >= targetMinProfit)
      .sort((a, b) => b.multiplier - a.multiplier)[0];

    if (safeThreshold) {
      autoRecommendedCrashMultiplier = safeThreshold.multiplier;
      autoProjectedHouseProfit = safeThreshold.netHouseProfit;
    } else {
      autoRecommendedCrashMultiplier = 1.05;
      autoProjectedHouseProfit = totalPot;
    }
  }

  let hasAbnormalConcentration = false;
  let concentrationAlertMessage: string | undefined;

  const heavyBet = activeBets.find((b) => b.betAmount >= 5000 || (totalPot > 0 && b.betAmount / totalPot > 0.5));
  if (heavyBet && totalActiveWagers > 1000) {
    hasAbnormalConcentration = true;
    concentrationAlertMessage = `⚠️ HEAVY AVIATOR BET DETECTED: ₹${heavyBet.betAmount.toLocaleString('en-IN')} by ${heavyBet.userName || 'Player'} on Panel ${heavyBet.panel}. Instant Crash or Safe Sub-1.20x Crash recommended to preserve house margin!`;
  }

  return {
    totalPot,
    totalActiveWagers,
    totalCashedOutPayouts,
    totalBetsCount: liveBets.length,
    uniqueUsersCount: uniqueUsers.size,
    thresholds,
    autoRecommendedCrashMultiplier,
    autoProjectedHouseProfit,
    hasAbnormalConcentration,
    concentrationAlertMessage,
  };
}
