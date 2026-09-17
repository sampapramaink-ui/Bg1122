import { AndarBaharSide, AndarBaharConfig, PlayingCard, CardRank } from '../types';
import { createDeck, shuffleDeck, SUPER_ANDAR_BAHAR_RANGES } from './andarBahar';

export interface AndarBaharLiveBetItem {
  id: string;
  roundId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  spot: string; // 'andar' | 'bahar' | 'range_1_5' etc.
  side: AndarBaharSide | string;
  amount: number;
  potentialWin: number;
  multiplier: number;
  timestamp: number;
  date: string;
}

export interface AndarBaharOutcomeAnalysis {
  side: AndarBaharSide;
  title: string;
  symbol: string;
  multiplier: number;
  straightBetAmount: number;
  userCount: number;
  totalPayoutLiability: number;
  netHouseProfit: number;
  profitMarginPercentage: number;
  riskRating: 'safe' | 'medium' | 'high';
}

export interface AndarBaharRiskAnalysis {
  totalPot: number;
  totalBetsCount: number;
  uniqueUsersCount: number;
  outcomes: Record<'andar' | 'bahar', AndarBaharOutcomeAnalysis>;
  sideBetsTotal: number;
  lowestRiskSide: AndarBaharSide | 'random';
  lowestRiskProfit: number;
  highestRiskSide: AndarBaharSide;
  highestPayoutLiability: number;
  hasAbnormalConcentration: boolean;
  concentrationAlertMessage?: string;
}

/**
 * Calculates complete real-time risk, liability, and house profit for Andar Bahar
 */
export function analyzeAndarBaharLiveBets(
  liveBets: AndarBaharLiveBetItem[],
  config: Partial<AndarBaharConfig> = {}
): AndarBaharRiskAnalysis {
  const andarMult = config.andarMultiplier || 1.95;
  const baharMult = config.baharMultiplier || 1.95;

  let totalPot = 0;
  let sideBetsTotal = 0;
  const uniqueUsers = new Set<string>();

  const andarUsers = new Set<string>();
  const baharUsers = new Set<string>();

  let andarStakes = 0;
  let baharStakes = 0;

  liveBets.forEach((bet) => {
    const amt = Number(bet.amount) || 0;
    if (amt <= 0) return;
    totalPot += amt;
    if (bet.userId) uniqueUsers.add(bet.userId);

    const spot = bet.spot || bet.side;
    if (spot === 'andar') {
      andarStakes += amt;
      if (bet.userId) andarUsers.add(bet.userId);
    } else if (spot === 'bahar') {
      baharStakes += amt;
      if (bet.userId) baharUsers.add(bet.userId);
    } else {
      sideBetsTotal += amt;
    }
  });

  // Payout if Andar lands:
  const andarPayoutLiability = Math.round(andarStakes * andarMult);
  const andarNetHouseProfit = Math.round(totalPot - andarPayoutLiability);
  const andarMargin = totalPot > 0 ? (andarNetHouseProfit / totalPot) * 100 : 100;

  // Payout if Bahar lands:
  const baharPayoutLiability = Math.round(baharStakes * baharMult);
  const baharNetHouseProfit = Math.round(totalPot - baharPayoutLiability);
  const baharMargin = totalPot > 0 ? (baharNetHouseProfit / totalPot) * 100 : 100;

  const outcomes: Record<'andar' | 'bahar', AndarBaharOutcomeAnalysis> = {
    andar: {
      side: 'andar',
      title: 'Andar (আন্দার)',
      symbol: '🎴',
      multiplier: andarMult,
      straightBetAmount: andarStakes,
      userCount: andarUsers.size,
      totalPayoutLiability: andarPayoutLiability,
      netHouseProfit: andarNetHouseProfit,
      profitMarginPercentage: Math.round(andarMargin * 10) / 10,
      riskRating: andarNetHouseProfit < 0 ? 'high' : andarMargin < 15 ? 'medium' : 'safe',
    },
    bahar: {
      side: 'bahar',
      title: 'Bahar (বাহার)',
      symbol: '🃏',
      multiplier: baharMult,
      straightBetAmount: baharStakes,
      userCount: baharUsers.size,
      totalPayoutLiability: baharPayoutLiability,
      netHouseProfit: baharNetHouseProfit,
      profitMarginPercentage: Math.round(baharMargin * 10) / 10,
      riskRating: baharNetHouseProfit < 0 ? 'high' : baharMargin < 15 ? 'medium' : 'safe',
    },
  };

  let lowestRiskSide: AndarBaharSide | 'random' = 'random';
  if (totalPot > 0 && (andarStakes > 0 || baharStakes > 0)) {
    if (andarPayoutLiability > baharPayoutLiability || (andarStakes > 0 && baharStakes === 0)) {
      lowestRiskSide = 'bahar'; // House defends against heavy Andar bet by making Bahar win
    } else if (baharPayoutLiability > andarPayoutLiability || (baharStakes > 0 && andarStakes === 0)) {
      lowestRiskSide = 'andar'; // House defends against heavy Bahar bet by making Andar win
    } else {
      lowestRiskSide = 'random';
    }
  } else {
    lowestRiskSide = 'random';
  }

  const lowestRiskProfit = lowestRiskSide !== 'random' ? outcomes[lowestRiskSide].netHouseProfit : 0;

  const highestRiskSide: AndarBaharSide = andarPayoutLiability >= baharPayoutLiability ? 'andar' : 'bahar';
  const highestPayoutLiability = outcomes[highestRiskSide].totalPayoutLiability;

  let hasAbnormalConcentration = false;
  let concentrationAlertMessage: string | undefined;

  if (totalPot > 500) {
    if (andarStakes / totalPot > 0.65 && andarPayoutLiability > totalPot) {
      hasAbnormalConcentration = true;
      concentrationAlertMessage = `⚠️ HEAVY ANDAR CONCENTRATION DETECTED: ₹${andarStakes.toLocaleString('en-IN')} on Andar (Potential House Loss: -₹${Math.abs(andarNetHouseProfit).toLocaleString('en-IN')}). Auto House Edge or Forcing Bahar is recommended!`;
    } else if (baharStakes / totalPot > 0.65 && baharPayoutLiability > totalPot) {
      hasAbnormalConcentration = true;
      concentrationAlertMessage = `⚠️ HEAVY BAHAR CONCENTRATION DETECTED: ₹${baharStakes.toLocaleString('en-IN')} on Bahar (Potential House Loss: -₹${Math.abs(baharNetHouseProfit).toLocaleString('en-IN')}). Auto House Edge or Forcing Andar is recommended!`;
    }
  }

  return {
    totalPot,
    totalBetsCount: liveBets.length,
    uniqueUsersCount: uniqueUsers.size,
    outcomes,
    sideBetsTotal,
    lowestRiskSide,
    lowestRiskProfit,
    highestRiskSide,
    highestPayoutLiability,
    hasAbnormalConcentration,
    concentrationAlertMessage,
  };
}

/**
 * Generates card dealing sequence for target Andar Bahar outcome
 */
export function generateDealingForOutcome(
  targetSide: AndarBaharSide,
  jokerCard: PlayingCard,
  remainingDeck: PlayingCard[]
): {
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide: AndarBaharSide;
  winningCard: PlayingCard;
  dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[];
} {
  const deck = shuffleDeck(remainingDeck);
  const matchingCards = deck.filter((c) => c.rank === jokerCard.rank);
  const nonMatchingCards = deck.filter((c) => c.rank !== jokerCard.rank);

  const matchCard = matchingCards[0] || {
    ...jokerCard,
    id: `joker_twin_${Date.now()}`,
    suit: jokerCard.suit === 'hearts' ? 'spades' : 'hearts',
  };

  // Odd step index = Andar (1, 3, 5, 7, 9)
  // Even step index = Bahar (2, 4, 6, 8, 10)
  const oddSteps = [1, 3, 5, 7, 9];
  const evenSteps = [2, 4, 6, 8, 10];
  const totalSteps = targetSide === 'andar'
    ? oddSteps[Math.floor(Math.random() * oddSteps.length)]
    : evenSteps[Math.floor(Math.random() * evenSteps.length)];

  const andarCards: PlayingCard[] = [];
  const baharCards: PlayingCard[] = [];
  const dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[] = [];

  for (let i = 1; i < totalSteps; i++) {
    const card = nonMatchingCards[i - 1] || deck[i];
    const side: AndarBaharSide = i % 2 !== 0 ? 'andar' : 'bahar';
    if (side === 'andar') andarCards.push(card);
    else baharCards.push(card);
    dealingSequence.push({ side, card, isMatch: false });
  }

  // Final winning step
  if (targetSide === 'andar') {
    andarCards.push(matchCard);
  } else {
    baharCards.push(matchCard);
  }
  dealingSequence.push({ side: targetSide, card: matchCard, isMatch: true });

  return {
    andarCards,
    baharCards,
    winningSide: targetSide,
    winningCard: matchCard,
    dealingSequence,
  };
}
