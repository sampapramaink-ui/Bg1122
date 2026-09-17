import { DragonTigerSide, DragonTigerConfig, PlayingCard, CardRank } from '../types';
import { createDeck, shuffleDeck } from './andarBahar';
import { getRankNumericValue, determineDragonTigerWinner } from './dragonTiger';

export interface DragonTigerLiveBetItem {
  id: string;
  roundId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  side: DragonTigerSide;
  amount: number;
  potentialWin: number;
  multiplier: number;
  timestamp: number;
  date: string;
}

export interface DragonTigerOutcomeAnalysis {
  side: DragonTigerSide;
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

export interface DragonTigerRiskAnalysis {
  totalPot: number;
  totalBetsCount: number;
  uniqueUsersCount: number;
  outcomes: Record<DragonTigerSide, DragonTigerOutcomeAnalysis>;
  lowestRiskSide: DragonTigerSide | 'random';
  lowestRiskProfit: number;
  highestRiskSide: DragonTigerSide;
  highestPayoutLiability: number;
  zeroBetSides: DragonTigerSide[];
  hasAbnormalConcentration: boolean;
  concentrationAlertMessage?: string;
}

/**
 * Calculates complete real-time risk, liability, and house profit for all 4 Dragon Tiger outcomes
 */
export function analyzeDragonTigerLiveBets(
  liveBets: DragonTigerLiveBetItem[],
  config: Partial<DragonTigerConfig> = {}
): DragonTigerRiskAnalysis {
  const dragonMult = config.dragonMultiplier || 2.0;
  const tigerMult = config.tigerMultiplier || 2.0;
  const tieMult = config.tieMultiplier || 12.0;
  const suitedTieMult = config.suitedTieMultiplier || 51.0;

  let totalPot = 0;
  const uniqueUsers = new Set<string>();

  // Aggregate bets by side
  const sideBets: Record<DragonTigerSide, { totalAmount: number; users: Set<string> }> = {
    dragon: { totalAmount: 0, users: new Set() },
    tiger: { totalAmount: 0, users: new Set() },
    tie: { totalAmount: 0, users: new Set() },
    suited_tie: { totalAmount: 0, users: new Set() },
  };

  liveBets.forEach((bet) => {
    const amt = Number(bet.amount) || 0;
    if (amt <= 0) return;
    totalPot += amt;
    if (bet.userId) uniqueUsers.add(bet.userId);

    const side = bet.side as DragonTigerSide;
    if (sideBets[side]) {
      sideBets[side].totalAmount += amt;
      if (bet.userId) sideBets[side].users.add(bet.userId);
    }
  });

  const SIDES: { side: DragonTigerSide; title: string; symbol: string; mult: number }[] = [
    { side: 'dragon', title: 'Dragon (ড্রাগন)', symbol: '🐉', mult: dragonMult },
    { side: 'tiger', title: 'Tiger (টাইগার)', symbol: '🐯', mult: tigerMult },
    { side: 'tie', title: 'Tie (টাই)', symbol: '🤝', mult: tieMult },
    { side: 'suited_tie', title: 'Suited Tie (স্যুটেড টাই)', symbol: '👑', mult: suitedTieMult },
  ];

  const outcomes = {} as Record<DragonTigerSide, DragonTigerOutcomeAnalysis>;
  const zeroBetSides: DragonTigerSide[] = [];

  SIDES.forEach(({ side, title, symbol, mult }) => {
    const betAmt = sideBets[side].totalAmount;
    const userCount = sideBets[side].users.size;

    if (betAmt === 0) {
      zeroBetSides.push(side);
    }

    // Payout if this outcome lands:
    // Dragon lands -> pays dragon bets * mult.
    // Tiger lands -> pays tiger bets * mult.
    // Regular tie lands -> pays tie bets * mult.
    // Suited tie lands -> pays suited tie * mult AND tie bets * mult (since suited tie is also a tie).
    let totalPayoutLiability = betAmt * mult;
    if (side === 'suited_tie') {
      totalPayoutLiability += (sideBets.tie.totalAmount * tieMult);
    }

    const netHouseProfit = totalPot - totalPayoutLiability;
    const profitMarginPercentage = totalPot > 0 ? (netHouseProfit / totalPot) * 100 : 100;

    let riskRating: 'safe' | 'medium' | 'high' = 'safe';
    if (netHouseProfit < 0) {
      riskRating = 'high';
    } else if (profitMarginPercentage < 15) {
      riskRating = 'medium';
    }

    outcomes[side] = {
      side,
      title,
      symbol,
      multiplier: mult,
      straightBetAmount: betAmt,
      userCount,
      totalPayoutLiability: Math.round(totalPayoutLiability),
      netHouseProfit: Math.round(netHouseProfit),
      profitMarginPercentage: Math.round(profitMarginPercentage * 10) / 10,
      riskRating,
    };
  });

  // Determine lowest risk main side (Strict Opposing Side Defense: Dragon vs Tiger)
  // Tie is a high-odds proposition bet (11:1) and must NEVER be chosen as an auto-defense outcome.
  let lowestRiskSide: DragonTigerSide | 'random' = 'random';
  const dragonBet = sideBets.dragon.totalAmount;
  const tigerBet = sideBets.tiger.totalAmount;
  const dragonProfit = outcomes.dragon?.netHouseProfit ?? 0;
  const tigerProfit = outcomes.tiger?.netHouseProfit ?? 0;

  if (totalPot === 0 || (dragonBet === 0 && tigerBet === 0)) {
    if (sideBets.tie.totalAmount > 0 || sideBets.suited_tie.totalAmount > 0) {
      // Player only bet on Tie/Suited Tie -> House defends with Dragon or Tiger (NEVER Tie!)
      lowestRiskSide = dragonProfit >= tigerProfit ? 'dragon' : 'tiger';
    } else {
      lowestRiskSide = 'random';
    }
  } else if (dragonBet > tigerBet) {
    // Player has bet on Dragon -> Tiger is the lowest risk winning side!
    lowestRiskSide = 'tiger';
  } else if (tigerBet > dragonBet) {
    // Player has bet on Tiger -> Dragon is the lowest risk winning side!
    lowestRiskSide = 'dragon';
  } else if (tigerProfit > dragonProfit) {
    lowestRiskSide = 'tiger';
  } else if (dragonProfit > tigerProfit) {
    lowestRiskSide = 'dragon';
  } else {
    lowestRiskSide = 'random';
  }
  const lowestRiskProfit = lowestRiskSide !== 'random' ? (outcomes[lowestRiskSide]?.netHouseProfit || 0) : 0;

  // Determine highest risk side (highest payout liability)
  const sortedByLiability = [...SIDES].sort(
    (a, b) => outcomes[b.side].totalPayoutLiability - outcomes[a.side].totalPayoutLiability
  );
  const highestRiskSide = sortedByLiability[0]?.side || 'dragon';
  const highestPayoutLiability = outcomes[highestRiskSide]?.totalPayoutLiability || 0;

  // Check for abnormal concentration (e.g., >70% of money on one side with high liability)
  let hasAbnormalConcentration = false;
  let concentrationAlertMessage: string | undefined;

  if (totalPot > 500) {
    const dominant = SIDES.find((s) => sideBets[s.side].totalAmount / totalPot > 0.65);
    if (dominant && outcomes[dominant.side].totalPayoutLiability > totalPot) {
      hasAbnormalConcentration = true;
      concentrationAlertMessage = `⚠️ ABNORMAL HEAVY BETTING DETECTED: ₹${sideBets[dominant.side].totalAmount.toLocaleString('en-IN')} concentrated on ${dominant.title.toUpperCase()} (Potential House Loss: -₹${Math.abs(outcomes[dominant.side].netHouseProfit).toLocaleString('en-IN')}). Auto House Edge or Manual Override is strongly recommended!`;
    }
  }

  return {
    totalPot,
    totalBetsCount: liveBets.length,
    uniqueUsersCount: uniqueUsers.size,
    outcomes,
    lowestRiskSide,
    lowestRiskProfit,
    highestRiskSide,
    highestPayoutLiability,
    zeroBetSides,
    hasAbnormalConcentration,
    concentrationAlertMessage,
  };
}

/**
 * Generate card pair that matches a forced or recommended Dragon Tiger outcome
 */
export function generateCardsForOutcome(
  targetSide: DragonTigerSide,
  manualDragonRank?: CardRank | null,
  manualTigerRank?: CardRank | null
): { dragonCard: PlayingCard; tigerCard: PlayingCard; winningSide: DragonTigerSide; isSuitedTie: boolean } {
  const deck = shuffleDeck(createDeck());

  if (manualDragonRank && manualTigerRank) {
    const dCard = deck.find((c) => c.rank === manualDragonRank) || deck[0];
    const availableForTiger = deck.filter((c) => c.id !== dCard.id);
    const tCard = availableForTiger.find((c) => c.rank === manualTigerRank) || availableForTiger[0];
    const res = determineDragonTigerWinner(dCard, tCard);
    return { dragonCard: dCard, tigerCard: tCard, winningSide: res.winner, isSuitedTie: res.isSuitedTie };
  }

  const sortedDesc = [...deck].sort((a, b) => getRankNumericValue(b.rank) - getRankNumericValue(a.rank));

  if (targetSide === 'dragon') {
    const dCard = sortedDesc[0]; // High card (e.g. K, Q, J)
    const lowerCandidates = sortedDesc.filter((c) => getRankNumericValue(c.rank) < getRankNumericValue(dCard.rank));
    const tCard = lowerCandidates[Math.floor(Math.random() * lowerCandidates.length)] || sortedDesc[sortedDesc.length - 1];
    return { dragonCard: dCard, tigerCard: tCard, winningSide: 'dragon', isSuitedTie: false };
  }

  if (targetSide === 'tiger') {
    const tCard = sortedDesc[0]; // High card for Tiger
    const lowerCandidates = sortedDesc.filter((c) => getRankNumericValue(c.rank) < getRankNumericValue(tCard.rank));
    const dCard = lowerCandidates[Math.floor(Math.random() * lowerCandidates.length)] || sortedDesc[sortedDesc.length - 1];
    return { dragonCard: dCard, tigerCard: tCard, winningSide: 'tiger', isSuitedTie: false };
  }

  if (targetSide === 'tie') {
    const dCard = deck[0];
    const tCard = deck.find((c) => c.id !== dCard.id && c.rank === dCard.rank && c.suit !== dCard.suit) || {
      ...dCard,
      id: `tie_clone_${Date.now()}`,
      suit: dCard.suit === 'hearts' ? 'spades' : 'hearts',
    };
    return { dragonCard: dCard, tigerCard: tCard, winningSide: 'tie', isSuitedTie: false };
  }

  if (targetSide === 'suited_tie') {
    const dCard = deck[0];
    const tCard = { ...dCard, id: `suited_clone_${Date.now()}` };
    return { dragonCard: dCard, tigerCard: tCard, winningSide: 'suited_tie', isSuitedTie: true };
  }

  // Random fallback
  const dCard = deck[0];
  const tCard = deck[1];
  const res = determineDragonTigerWinner(dCard, tCard);
  return { dragonCard: dCard, tigerCard: tCard, winningSide: res.winner, isSuitedTie: res.isSuitedTie };
}
