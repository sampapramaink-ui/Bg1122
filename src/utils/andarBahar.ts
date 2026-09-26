import { CardRank, CardSuit, PlayingCard, AndarBaharSide, AndarBaharConfig, AndarBaharRound } from '../types';

export const SUITS: { suit: CardSuit; symbol: string; color: 'red' | 'black'; name: string }[] = [
  { suit: 'spades', symbol: '♠', color: 'black', name: 'Spade' },
  { suit: 'hearts', symbol: '♥', color: 'red', name: 'Heart' },
  { suit: 'clubs', symbol: '♣', color: 'black', name: 'Club' },
  { suit: 'diamonds', symbol: '♦', color: 'red', name: 'Diamond' },
];

export const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DEFAULT_ANDAR_BAHAR_CONFIG: AndarBaharConfig = {
  isEnabled: true,
  minBet: 10,
  maxBet: 50000,
  bettingDurationSeconds: 15,
  dealingSpeedMs: 650,
  andarMultiplier: 1.95,
  baharMultiplier: 1.95,
  rtpPercentage: 96.5,
  houseEdgePercentage: 3.5,
  rtpMode: 'fair_rng',
  manualForceWinner: 'random',
  manualJokerRank: 'random',
};

/**
 * Generate a complete 52-card standard deck
 */
export function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  SUITS.forEach((s) => {
    RANKS.forEach((rank, idx) => {
      deck.push({
        id: `${s.suit}_${rank}`,
        suit: s.suit,
        rank,
        value: idx + 1,
        color: s.color,
      });
    });
  });
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm (with optional deterministic PRNG)
 */
export function shuffleDeck(deck: PlayingCard[], rng?: () => number): PlayingCard[] {
  const rand = rng || Math.random;
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Pick a random card or use preset rank (with optional deterministic PRNG)
 */
export function pickJokerCard(
  deck: PlayingCard[], 
  presetRank?: CardRank | 'random',
  rng?: () => number
): { joker: PlayingCard; remainingDeck: PlayingCard[] } {
  let deckCopy = shuffleDeck(deck, rng);
  if (presetRank && presetRank !== 'random') {
    const idx = deckCopy.findIndex((c) => c.rank === presetRank);
    if (idx !== -1) {
      const [joker] = deckCopy.splice(idx, 1);
      return { joker, remainingDeck: deckCopy };
    }
  }
  const joker = deckCopy.shift()!;
  return { joker, remainingDeck: deckCopy };
}

export const BALANCED_ANDAR_BAHAR_PATTERN: AndarBaharSide[] = [
  'andar', 'bahar', 'andar', 'bahar', 'bahar', 'andar', 'bahar', 'andar',
  'andar', 'bahar', 'bahar', 'andar', 'andar', 'bahar', 'andar', 'bahar',
  'bahar', 'andar', 'bahar', 'bahar', 'andar', 'andar', 'bahar', 'andar',
  'bahar', 'andar', 'andar', 'bahar', 'andar', 'bahar', 'bahar', 'andar',
  'bahar', 'andar', 'bahar', 'andar', 'andar', 'bahar', 'bahar', 'andar',
  'andar', 'bahar', 'andar', 'bahar', 'andar', 'bahar', 'bahar', 'andar',
  'andar', 'bahar', 'andar', 'bahar', 'bahar', 'andar', 'andar', 'bahar',
  'bahar', 'andar', 'bahar', 'andar', 'andar', 'bahar', 'andar', 'bahar'
];

/**
 * Deterministically returns the normal fair winner with guaranteed anti-streak (max 2 in a row).
 * Ensures a perfectly balanced 50% Andar / 50% Bahar distribution without long streaks.
 */
export function getBalancedNormalAndarBaharWinner(roundIndex: number): AndarBaharSide {
  const cleanIdx = Math.abs(Math.floor(roundIndex));
  return BALANCED_ANDAR_BAHAR_PATTERN[cleanIdx % BALANCED_ANDAR_BAHAR_PATTERN.length];
}

/**
 * Crafts a card dealing sequence guaranteed to make the specified targetSide win.
 * For Andar: match card lands on an odd step (1st, 3rd, 5th, etc.)
 * For Bahar: match card lands on an even step (2nd, 4th, 6th, etc.)
 */
export function craftDealingSequenceForOutcome(
  targetSide: AndarBaharSide,
  jokerCard: PlayingCard,
  deck: PlayingCard[],
  rng: () => number = Math.random
): {
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide: AndarBaharSide;
  winningCard: PlayingCard;
  dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[];
} {
  const matchingCards = deck.filter((c) => c.rank === jokerCard.rank);
  const nonMatchingCards = deck.filter((c) => c.rank !== jokerCard.rank);

  const fallbackSuit: CardSuit = jokerCard.suit === 'hearts' ? 'spades' : 'hearts';
  const chosenMatchCard: PlayingCard = matchingCards.length > 0
    ? matchingCards[Math.floor(rng() * matchingCards.length)]
    : {
        id: `match_twin_${Date.now()}_${Math.floor(rng() * 1000)}`,
        rank: jokerCard.rank,
        suit: fallbackSuit,
        value: jokerCard.value,
        color: fallbackSuit === 'hearts' ? 'red' : 'black',
      };

  const oddNumbers = [1, 3, 5, 7, 9, 11];
  const evenNumbers = [2, 4, 6, 8, 10, 12];
  const chosenStep = targetSide === 'andar'
    ? oddNumbers[Math.floor(rng() * oddNumbers.length)]
    : evenNumbers[Math.floor(rng() * evenNumbers.length)];

  const nonMatchShuffled = shuffleDeck(nonMatchingCards, rng);
  const dealtCards: PlayingCard[] = [];
  for (let i = 0; i < chosenStep - 1; i++) {
    if (nonMatchShuffled.length > 0) {
      dealtCards.push(nonMatchShuffled.pop()!);
    }
  }
  dealtCards.push(chosenMatchCard);

  const andarCards: PlayingCard[] = [];
  const baharCards: PlayingCard[] = [];
  const dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[] = [];

  dealtCards.forEach((card, index) => {
    const side: AndarBaharSide = index % 2 === 0 ? 'andar' : 'bahar';
    const isMatch = card.rank === jokerCard.rank;
    if (side === 'andar') {
      andarCards.push(card);
    } else {
      baharCards.push(card);
    }
    dealingSequence.push({ side, card, isMatch });
  });

  return {
    andarCards,
    baharCards,
    winningSide: targetSide,
    winningCard: chosenMatchCard,
    dealingSequence,
  };
}

/**
 * Simulates dealing cards step-by-step for Andar Bahar
 * Enforces 100% house protection when bets are placed, and balanced anti-streak when no bets.
 */
export function simulateAndarBaharRound(
  jokerCard: PlayingCard,
  remainingDeck: PlayingCard[],
  config: AndarBaharConfig,
  totalBetsAndar: number = 0,
  totalBetsBahar: number = 0,
  rng?: () => number,
  roundIndex: number = 0
): {
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide: AndarBaharSide;
  winningCard: PlayingCard;
  dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[];
} {
  const rand = rng || Math.random;
  const isManualActive = Boolean((config as any)?.isManualOverride);
  const forcedTarget = (config?.manualForceWinner && config.manualForceWinner !== 'random')
    ? config.manualForceWinner
    : ((config as any)?.forcedWinner && (config as any).forcedWinner !== 'random')
    ? (config as any).forcedWinner
    : ((config as any)?.manualForceTarget && (config as any).manualForceTarget !== 'random')
    ? (config as any).manualForceTarget
    : null;

  let targetSide: AndarBaharSide;

  if (forcedTarget) {
    targetSide = forcedTarget as AndarBaharSide;
  } else if (totalBetsAndar > 0 || totalBetsBahar > 0) {
    // 🛡️ UNCONDITIONAL 100% HOUSE PROTECTION: House NEVER suffers net loss
    const andarPayout = totalBetsAndar * (config.andarMultiplier || 1.95);
    const baharPayout = totalBetsBahar * (config.baharMultiplier || 1.95);

    if (andarPayout > baharPayout || (totalBetsAndar > 0 && totalBetsBahar === 0)) {
      targetSide = 'bahar'; // Defend against Andar bet by landing Bahar
    } else if (baharPayout > andarPayout || (totalBetsBahar > 0 && totalBetsAndar === 0)) {
      targetSide = 'andar'; // Defend against Bahar bet by landing Andar
    } else {
      targetSide = getBalancedNormalAndarBaharWinner(roundIndex);
    }
  } else {
    // 🎲 Normal balanced play with anti-streak
    targetSide = getBalancedNormalAndarBaharWinner(roundIndex);
  }

  return craftDealingSequenceForOutcome(targetSide, jokerCard, remainingDeck, rand);
}

/**
 * Helper to get card visual symbol and color
 */
export function getSuitDetails(suit: CardSuit) {
  switch (suit) {
    case 'hearts':
      return { symbol: '♥', color: 'text-rose-500', bg: 'bg-rose-500/10' };
    case 'diamonds':
      return { symbol: '♦', color: 'text-rose-500', bg: 'bg-rose-500/10' };
    case 'clubs':
      return { symbol: '♣', color: 'text-slate-900', bg: 'bg-slate-900/10' };
    case 'spades':
      return { symbol: '♠', color: 'text-slate-900', bg: 'bg-slate-900/10' };
  }
}

export interface SuperAndarBaharRangeDef {
  key: string;
  minCards: number;
  maxCards: number;
  baseRatio: string;
  baseMultiplier: number;
  possibleSuperMultipliers: number[];
}

export const SUPER_ANDAR_BAHAR_RANGES: SuperAndarBaharRangeDef[] = [
  { key: '1-5', minCards: 1, maxCards: 5, baseRatio: '2:1', baseMultiplier: 3.0, possibleSuperMultipliers: [4, 6] },
  { key: '6-10', minCards: 6, maxCards: 10, baseRatio: '3:1', baseMultiplier: 4.0, possibleSuperMultipliers: [6, 8] },
  { key: '11-15', minCards: 11, maxCards: 15, baseRatio: '4:1', baseMultiplier: 5.0, possibleSuperMultipliers: [8, 10] },
  { key: '16-20', minCards: 16, maxCards: 20, baseRatio: '5:1', baseMultiplier: 6.0, possibleSuperMultipliers: [10, 12] },
  { key: '21-25', minCards: 21, maxCards: 25, baseRatio: '8:1', baseMultiplier: 9.0, possibleSuperMultipliers: [12, 15] },
  { key: '26-30', minCards: 26, maxCards: 30, baseRatio: '12:1', baseMultiplier: 13.0, possibleSuperMultipliers: [20, 25] },
  { key: '31-35', minCards: 31, maxCards: 35, baseRatio: '20:1', baseMultiplier: 21.0, possibleSuperMultipliers: [30, 40] },
  { key: '36-40', minCards: 36, maxCards: 40, baseRatio: '40:1', baseMultiplier: 41.0, possibleSuperMultipliers: [60, 80] },
  { key: '41-45', minCards: 41, maxCards: 45, baseRatio: '110:1', baseMultiplier: 111.0, possibleSuperMultipliers: [150, 200] },
  { key: '46-49', minCards: 46, maxCards: 49, baseRatio: '800:1', baseMultiplier: 801.0, possibleSuperMultipliers: [1200, 4000] },
];

/**
 * 32-bit MurmurHash3 string/number seed hasher
 */
export function hashSeedAB(seed: string | number): number {
  let h = 0x811c9dc5;
  const str = String(seed || 'ab_seed');
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 15), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Mulberry32 PRNG generator seeded deterministically
 */
export function createRoundPRNGAB(seed: string | number): () => number {
  let s = hashSeedAB(seed);
  return function nextFloat(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyncedAndarBaharRoundDetails {
  roundIndex: number;
  roundId: string;
  jokerCard: PlayingCard;
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide: AndarBaharSide;
  winningCard: PlayingCard;
  totalCardsCount: number;
  dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[];
  superMultipliers: Record<string, number>;
  tableBetsAndar: number;
  tableBetsBahar: number;
  tablePlayersAndar: number;
  tablePlayersBahar: number;
  dealingDurationMs: number;
  totalRoundDurationMs: number;
}

export const UNIVERSAL_AB_BETTING_MS = 15000;
export const UNIVERSAL_AB_DEALING_SPEED_MS = 650;
export const UNIVERSAL_AB_RESULT_MS = 4000;
export const UNIVERSAL_AB_TOTAL_CYCLE_MS = 30000;

/**
 * Deterministically generates the exact round outcome for a given round index across all devices.
 * Integrates 100% unconditional House Protection when bets are placed, and balanced anti-streak when no bets.
 */
export function getSyncedAndarBaharRoundDetails(roundIndex: number, config?: AndarBaharConfig): SyncedAndarBaharRoundDetails {
  const rng = createRoundPRNGAB(`ab_round_v5_${roundIndex}`);
  const d = new Date(roundIndex * 30000);
  const roundId = `AB-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(roundIndex % 100000).padStart(5, '0')}`;

  // Deterministically create and shuffle full standard 52-card deck
  const baseDeck = createDeck();
  const deck = [...baseDeck];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Pick Joker
  const jokerCard = deck.shift()!;

  // 1. Determine Winning Side with 100% Guaranteed House Protection & Anti-Streak
  const liveAndar = typeof config?.liveBetsAndar === 'number' ? config.liveBetsAndar : 0;
  const liveBahar = typeof config?.liveBetsBahar === 'number' ? config.liveBetsBahar : 0;
  const totalLiveBets = liveAndar + liveBahar;

  const isManualActive = Boolean((config as any)?.isManualOverride);
  const forcedTarget = (config?.manualForceWinner && config.manualForceWinner !== 'random')
    ? config.manualForceWinner
    : ((config as any)?.forcedWinner && (config as any).forcedWinner !== 'random')
    ? (config as any).forcedWinner
    : ((config as any)?.manualForceTarget && (config as any).manualForceTarget !== 'random')
    ? (config as any).manualForceTarget
    : null;

  let targetSide: AndarBaharSide;

  if (forcedTarget) {
    targetSide = forcedTarget as AndarBaharSide;
  } else if ((config as any)?.autoLowRiskWinner && (config as any).autoLowRiskWinner !== 'random') {
    targetSide = (config as any).autoLowRiskWinner as AndarBaharSide;
  } else if (totalLiveBets > 0) {
    // 🛡️ UNCONDITIONAL 100% HOUSE PROTECTION:
    // When real user bets, house calculates payout liability with 0-second latency.
    // The side with HIGHER liability LOSES! The side with LOWER liability WINS!
    const andarMultiplier = config?.andarMultiplier || 1.95;
    const baharMultiplier = config?.baharMultiplier || 1.95;
    const andarPayout = liveAndar * andarMultiplier;
    const baharPayout = liveBahar * baharMultiplier;

    if (andarPayout > baharPayout || (liveAndar > 0 && liveBahar === 0)) {
      targetSide = 'bahar'; // House defends against heavy Andar bet by landing Bahar
    } else if (baharPayout > andarPayout || (liveBahar > 0 && liveAndar === 0)) {
      targetSide = 'andar'; // House defends against heavy Bahar bet by landing Andar
    } else {
      // Equal bets: alternate dynamically using anti-streak
      targetSide = getBalancedNormalAndarBaharWinner(roundIndex);
    }
  } else {
    // 🎲 NO BETS PLACED: PURE BALANCED NORMAL ANTI-STREAK (MAX 2 CONSECUTIVE WINS)
    targetSide = getBalancedNormalAndarBaharWinner(roundIndex);
  }

  // 2. Craft dealing sequence matching targetSide
  const dealt = craftDealingSequenceForOutcome(targetSide, jokerCard, deck, rng);

  // Deterministic Super Multipliers
  const superMultipliers: Record<string, number> = {};
  SUPER_ANDAR_BAHAR_RANGES.forEach((range) => {
    if (rng() < 0.35) {
      const multIdx = Math.floor(rng() * range.possibleSuperMultipliers.length);
      superMultipliers[range.key] = range.possibleSuperMultipliers[multIdx];
    }
  });

  // Deterministic simulated live pools
  const tableBetsAndar = Math.floor(6500 + rng() * 12000);
  const tableBetsBahar = Math.floor(5800 + rng() * 11000);
  const tablePlayersAndar = Math.floor(12 + rng() * 16);
  const tablePlayersBahar = Math.floor(9 + rng() * 14);

  const dealingDurationMs = dealt.dealingSequence.length * UNIVERSAL_AB_DEALING_SPEED_MS;
  const totalRoundDurationMs = UNIVERSAL_AB_BETTING_MS + dealingDurationMs + UNIVERSAL_AB_RESULT_MS;

  return {
    roundIndex,
    roundId,
    jokerCard,
    andarCards: dealt.andarCards,
    baharCards: dealt.baharCards,
    winningSide: dealt.winningSide,
    winningCard: dealt.winningCard,
    totalCardsCount: dealt.dealingSequence.length,
    dealingSequence: dealt.dealingSequence,
    superMultipliers,
    tableBetsAndar,
    tableBetsBahar,
    tablePlayersAndar,
    tablePlayersBahar,
    dealingDurationMs,
    totalRoundDurationMs,
  };
}

export interface UniversalAndarBaharTimeState {
  roundIndex: number;
  roundDetails: SyncedAndarBaharRoundDetails;
  phase: 'betting' | 'dealing' | 'completed';
  countdown: number;
  elapsedInPhaseMs: number;
  elapsedInRoundMs: number;
  currentDealtCount: number;
  visibleAndarCards: PlayingCard[];
  visibleBaharCards: PlayingCard[];
  activeDealingSide: AndarBaharSide | null;
  roundStartTimeMs: number;
}

/**
 * 24x7 Global Continuous Clock for Andar Bahar.
 * Synchronizes Round ID, Phase, Countdown, and Cards Dealt across ALL clients worldwide with 0 latency.
 */
export function getUniversalAndarBaharTimeState(timestamp: number = Date.now(), config?: AndarBaharConfig): UniversalAndarBaharTimeState {
  const roundIndex = Math.floor(timestamp / UNIVERSAL_AB_TOTAL_CYCLE_MS);
  const roundStartTimeMs = roundIndex * UNIVERSAL_AB_TOTAL_CYCLE_MS;
  const elapsedInRoundMs = Math.max(0, timestamp - roundStartTimeMs);

  const roundDetails = getSyncedAndarBaharRoundDetails(roundIndex, config);

  let phase: 'betting' | 'dealing' | 'completed' = 'betting';
  let countdown = 0;
  let elapsedInPhaseMs = 0;
  let currentDealtCount = 0;
  const visibleAndarCards: PlayingCard[] = [];
  const visibleBaharCards: PlayingCard[] = [];
  let activeDealingSide: AndarBaharSide | null = null;

  const dealingWindowMs = UNIVERSAL_AB_TOTAL_CYCLE_MS - UNIVERSAL_AB_BETTING_MS - UNIVERSAL_AB_RESULT_MS; // 11,000ms

  if (elapsedInRoundMs < UNIVERSAL_AB_BETTING_MS) {
    phase = 'betting';
    countdown = Math.max(1, Math.ceil((UNIVERSAL_AB_BETTING_MS - elapsedInRoundMs) / 1000));
    elapsedInPhaseMs = elapsedInRoundMs;
  } else if (elapsedInRoundMs < UNIVERSAL_AB_BETTING_MS + dealingWindowMs) {
    phase = 'dealing';
    countdown = 0;
    elapsedInPhaseMs = elapsedInRoundMs - UNIVERSAL_AB_BETTING_MS;
    
    // Distribute card reveals smoothly across the dealing window
    const cardStepMs = Math.max(250, Math.min(UNIVERSAL_AB_DEALING_SPEED_MS, Math.floor(10000 / Math.max(1, roundDetails.totalCardsCount))));
    currentDealtCount = Math.min(
      roundDetails.totalCardsCount,
      Math.floor(elapsedInPhaseMs / cardStepMs) + 1
    );

    // Populate visible cards up to currentDealtCount
    for (let i = 0; i < currentDealtCount; i++) {
      const step = roundDetails.dealingSequence[i];
      if (step) {
        if (step.side === 'andar') visibleAndarCards.push(step.card);
        else visibleBaharCards.push(step.card);
        if (i === currentDealtCount - 1) {
          activeDealingSide = step.side;
        }
      }
    }
  } else {
    phase = 'completed';
    countdown = 0;
    elapsedInPhaseMs = elapsedInRoundMs - (UNIVERSAL_AB_BETTING_MS + dealingWindowMs);
    currentDealtCount = roundDetails.totalCardsCount;
    roundDetails.andarCards.forEach((c) => visibleAndarCards.push(c));
    roundDetails.baharCards.forEach((c) => visibleBaharCards.push(c));
    activeDealingSide = null;
  }

  return {
    roundIndex,
    roundDetails,
    phase,
    countdown,
    elapsedInPhaseMs,
    elapsedInRoundMs,
    currentDealtCount,
    visibleAndarCards,
    visibleBaharCards,
    activeDealingSide,
    roundStartTimeMs,
  };
}

/**
 * Returns deterministic bead road / previous round history for Andar Bahar
 */
export function getSyncedAndarBaharRoadHistory(currentRoundIndex: number, count: number = 30): {
  id: string;
  winner: AndarBaharSide;
  cardsCount: number;
  rank: string;
}[] {
  const history: { id: string; winner: AndarBaharSide; cardsCount: number; rank: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const pastIdx = currentRoundIndex - i;
    if (pastIdx < 0) break;
    const details = getSyncedAndarBaharRoundDetails(pastIdx);
    history.push({
      id: details.roundId,
      winner: details.winningSide,
      cardsCount: details.totalCardsCount,
      rank: details.jokerCard.rank,
    });
  }
  return history;
}


