export interface LightningMultiplier {
  number: number;
  multiplier: number;
}

export const LIGHTNING_MULTIPLIERS_LIST = [50, 100, 200, 300, 400, 500];

export const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

/**
 * Robust 32-bit MurmurHash3 finalizer for round seed hashing
 */
export const hashSeed = (seed: string | number): number => {
  let h = 0x811c9dc5;
  if (typeof seed === 'number') {
    h = Math.imul(seed ^ 0xdeadbeef, 0x5bd1e995);
    h = Math.imul(h ^ (h >>> 15), 0x5bd1e995);
    return (h ^ (h >>> 15)) >>> 0;
  }
  const str = String(seed || 'round_default');
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 15), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
};

/**
 * Fast, robust Mulberry32 PRNG generator seeded by round
 */
export const createRoundPRNG = (seed: string | number): (() => number) => {
  let s = hashSeed(seed);
  return function nextFloat(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministically calculates 2 to 5 synchronized, high-variation lightning numbers with 50x-500x multipliers.
 * Every unique round ID receives a fresh, dynamic, non-repeating set of lucky numbers.
 */
export const getSyncedLightningMultipliers = (roundSeedOrId: string | number, count?: number): LightningMultiplier[] => {
  const rng = createRoundPRNG(`${roundSeedOrId}_lightning_strike_v2`);
  
  // Real Lightning Roulette features 2 to 5 lucky numbers per round
  const targetCount = count ? Math.max(2, Math.min(5, count)) : (2 + Math.floor(rng() * 4));
  const results: LightningMultiplier[] = [];
  const chosen = new Set<number>();

  const weightedMultipliers = [50, 50, 100, 100, 200, 300, 400, 500];

  let safety = 0;
  while (chosen.size < targetCount && safety < 100) {
    safety++;
    const num = Math.floor(rng() * 37); // 0 to 36
    if (!chosen.has(num)) {
      chosen.add(num);
      const multIdx = Math.floor(rng() * weightedMultipliers.length);
      results.push({
        number: num,
        multiplier: weightedMultipliers[multIdx] || 50
      });
    }
  }

  // Fallback guarantee in the rarest case
  if (results.length < 2) {
    const baseSeed = hashSeed(roundSeedOrId);
    return [
      { number: (baseSeed % 37), multiplier: 100 },
      { number: ((baseSeed + 7) % 37), multiplier: 50 },
      { number: ((baseSeed + 19) % 37), multiplier: 200 }
    ];
  }

  return results;
};


export interface RouletteLiveBetItem {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userEmail: string;
  betType: {
    kind: 'number' | 'color' | 'parity' | 'range' | 'dozen' | 'column';
    value: any;
  };
  label: string;
  amount: number;
  potentialWin: number;
  timestamp: string;
}

export interface NumberLiabilitySummary {
  number: number;
  color: 'green' | 'red' | 'black';
  straightBetAmount: number;
  totalPayoutIfLands: number;
  netHouseProfit: number;
  profitMarginPercent: number;
  userCount: number;
  percentageOfPot: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

export const RED_NUMBERS_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const BLACK_NUMBERS_SET = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

export const getRouletteNumberColor = (num: number): 'green' | 'red' | 'black' => {
  if (num === 0) return 'green';
  return RED_NUMBERS_SET.has(num) ? 'red' : 'black';
};

/**
 * Calculates payout for a specific number outcome given a list of placed bets.
 */
export const calculateNumberPayout = (targetNumber: number, bets: RouletteLiveBetItem[]): number => {
  let totalPayout = 0;
  const color = getRouletteNumberColor(targetNumber);
  const isEven = targetNumber !== 0 && targetNumber % 2 === 0;
  const isOdd = targetNumber !== 0 && targetNumber % 2 !== 0;

  bets.forEach((bet) => {
    const kind = bet.betType?.kind;
    const val = bet.betType?.value;
    const amt = Number(bet.amount) || 0;

    if (kind === 'number' && Number(val) === targetNumber) {
      totalPayout += amt * 30; // 30x payout for straight-up numbers (29:1 + 1x stake)
    } else if (kind === 'color' && val === color) {
      totalPayout += amt * 2;
    } else if (kind === 'parity') {
      if ((val === 'even' && isEven) || (val === 'odd' && isOdd)) {
        totalPayout += amt * 2;
      }
    } else if (kind === 'range') {
      if (
        (val === '1-18' && targetNumber >= 1 && targetNumber <= 18) ||
        (val === '19-36' && targetNumber >= 19 && targetNumber <= 36)
      ) {
        totalPayout += amt * 2;
      }
    } else if (kind === 'dozen') {
      if (
        (val === '1st12' && targetNumber >= 1 && targetNumber <= 12) ||
        (val === '2nd12' && targetNumber >= 13 && targetNumber <= 24) ||
        (val === '3rd12' && targetNumber >= 25 && targetNumber <= 36)
      ) {
        totalPayout += amt * 3;
      }
    } else if (kind === 'column') {
      if (
        (val === 'col1' && targetNumber > 0 && targetNumber % 3 === 1) ||
        (val === 'col2' && targetNumber > 0 && targetNumber % 3 === 2) ||
        (val === 'col3' && targetNumber > 0 && targetNumber % 3 === 0)
      ) {
        totalPayout += amt * 3;
      }
    }
  });

  return totalPayout;
};

/**
 * Calculates complete risk & payout liability across all 37 roulette numbers (0 to 36)
 */
export const calculateAllNumbersLiability = (
  bets: RouletteLiveBetItem[], 
  roundSeed?: string | number,
  options?: {
    lightningNumbers?: number[];
    excludedNumbers?: number[];
  }
): {
  numberSummaries: NumberLiabilitySummary[];
  totalPot: number;
  totalBetsCount: number;
  uniqueUsersCount: number;
  lowestRiskNumber: number;
  lowestRiskProfit: number;
  highestRiskNumber: number;
  zeroBetNumbers: number[];
  categorySummaries: {
    red: { amount: number; users: number; exposure: number };
    black: { amount: number; users: number; exposure: number };
    even: { amount: number; users: number; exposure: number };
    odd: { amount: number; users: number; exposure: number };
    low: { amount: number; users: number; exposure: number };
    high: { amount: number; users: number; exposure: number };
    dozen1: { amount: number; users: number; exposure: number };
    dozen2: { amount: number; users: number; exposure: number };
    dozen3: { amount: number; users: number; exposure: number };
    col1: { amount: number; users: number; exposure: number };
    col2: { amount: number; users: number; exposure: number };
    col3: { amount: number; users: number; exposure: number };
  };
} => {
  const totalPot = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalBetsCount = bets.length;
  const userSet = new Set(bets.map(b => b.userId || b.userName));
  const uniqueUsersCount = userSet.size;

  // Derive stable integer seed
  let numSeed = 17;
  if (typeof roundSeed === 'number') {
    numSeed = Math.abs(roundSeed);
  } else if (typeof roundSeed === 'string' && roundSeed.length > 0) {
    numSeed = hashSeed(roundSeed);
  }

  const summaries: NumberLiabilitySummary[] = [];

  // Track Category Summaries
  const catSummary = {
    red: { amount: 0, users: new Set<string>(), exposure: 0 },
    black: { amount: 0, users: new Set<string>(), exposure: 0 },
    even: { amount: 0, users: new Set<string>(), exposure: 0 },
    odd: { amount: 0, users: new Set<string>(), exposure: 0 },
    low: { amount: 0, users: new Set<string>(), exposure: 0 },
    high: { amount: 0, users: new Set<string>(), exposure: 0 },
    dozen1: { amount: 0, users: new Set<string>(), exposure: 0 },
    dozen2: { amount: 0, users: new Set<string>(), exposure: 0 },
    dozen3: { amount: 0, users: new Set<string>(), exposure: 0 },
    col1: { amount: 0, users: new Set<string>(), exposure: 0 },
    col2: { amount: 0, users: new Set<string>(), exposure: 0 },
    col3: { amount: 0, users: new Set<string>(), exposure: 0 },
  };

  bets.forEach((bet) => {
    const kind = bet.betType?.kind;
    const val = bet.betType?.value;
    const amt = Number(bet.amount) || 0;
    const uId = bet.userId || bet.userName || 'anon';

    if (kind === 'color') {
      if (val === 'red') { catSummary.red.amount += amt; catSummary.red.users.add(uId); catSummary.red.exposure += amt * 2; }
      if (val === 'black') { catSummary.black.amount += amt; catSummary.black.users.add(uId); catSummary.black.exposure += amt * 2; }
    } else if (kind === 'parity') {
      if (val === 'even') { catSummary.even.amount += amt; catSummary.even.users.add(uId); catSummary.even.exposure += amt * 2; }
      if (val === 'odd') { catSummary.odd.amount += amt; catSummary.odd.users.add(uId); catSummary.odd.exposure += amt * 2; }
    } else if (kind === 'range') {
      if (val === '1-18') { catSummary.low.amount += amt; catSummary.low.users.add(uId); catSummary.low.exposure += amt * 2; }
      if (val === '19-36') { catSummary.high.amount += amt; catSummary.high.users.add(uId); catSummary.high.exposure += amt * 2; }
    } else if (kind === 'dozen') {
      if (val === '1st12') { catSummary.dozen1.amount += amt; catSummary.dozen1.users.add(uId); catSummary.dozen1.exposure += amt * 3; }
      if (val === '2nd12') { catSummary.dozen2.amount += amt; catSummary.dozen2.users.add(uId); catSummary.dozen2.exposure += amt * 3; }
      if (val === '3rd12') { catSummary.dozen3.amount += amt; catSummary.dozen3.users.add(uId); catSummary.dozen3.exposure += amt * 3; }
    } else if (kind === 'column') {
      if (val === 'col1') { catSummary.col1.amount += amt; catSummary.col1.users.add(uId); catSummary.col1.exposure += amt * 3; }
      if (val === 'col2') { catSummary.col2.amount += amt; catSummary.col2.users.add(uId); catSummary.col2.exposure += amt * 3; }
      if (val === 'col3') { catSummary.col3.amount += amt; catSummary.col3.users.add(uId); catSummary.col3.exposure += amt * 3; }
    }
  });

  for (let num = 0; num <= 36; num++) {
    const straightBets = bets.filter(b => b.betType?.kind === 'number' && Number(b.betType.value) === num);
    const straightBetAmount = straightBets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const straightUsers = new Set(straightBets.map(b => b.userId || b.userName)).size;

    const totalPayoutIfLands = calculateNumberPayout(num, bets);
    const netHouseProfit = totalPot - totalPayoutIfLands;
    const profitMarginPercent = totalPot > 0 ? (netHouseProfit / totalPot) * 100 : 100;
    const percentageOfPot = totalPot > 0 ? (straightBetAmount / totalPot) * 100 : 0;

    let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical' = 'safe';
    if (netHouseProfit < 0) {
      riskLevel = Math.abs(netHouseProfit) > totalPot * 2 ? 'critical' : 'high';
    } else if (netHouseProfit === totalPot) {
      riskLevel = 'safe';
    } else if (netHouseProfit >= totalPot * 0.5) {
      riskLevel = 'low';
    } else {
      riskLevel = 'medium';
    }

    summaries.push({
      number: num,
      color: getRouletteNumberColor(num),
      straightBetAmount,
      totalPayoutIfLands,
      netHouseProfit,
      profitMarginPercent,
      userCount: straightUsers,
      percentageOfPot,
      riskLevel
    });
  }

  // Extract lightning numbers to strictly protect against lightning strikes when users bet
  const lightningNums = options?.lightningNumbers ?? (roundSeed !== undefined ? getSyncedLightningMultipliers(roundSeed).map(l => l.number) : []);
  const extraExcluded = options?.excludedNumbers ?? [];
  const lightningSet = new Set<number>([...lightningNums, ...extraExcluded]);

  const isBettingActive = totalPot > 0 || bets.length > 0;

  // CRITICAL PROTECTION: While users are betting, the ball must NEVER land on a lightning number unless manually forced by admin.
  let eligibleCandidates = summaries;
  if (isBettingActive && lightningSet.size > 0) {
    const nonLightning = summaries.filter(s => !lightningSet.has(s.number));
    if (nonLightning.length > 0) {
      eligibleCandidates = nonLightning;
    }
  }

  // Find lowest risk number (highest net house profit) among eligible candidates
  const maxHouseProfit = Math.max(...eligibleCandidates.map(s => s.netHouseProfit));
  const minHouseProfit = Math.min(...eligibleCandidates.map(s => s.netHouseProfit));
  
  const highestProfitCandidates = eligibleCandidates.filter(s => s.netHouseProfit === maxHouseProfit);
  const lowestProfitCandidates = eligibleCandidates.filter(s => s.netHouseProfit === minHouseProfit);

  // If no bets exist (totalPot is 0 or all payouts 0), pick the natural deterministic round pocket
  let chosenLowestRiskNumber: number;
  const liabilityRng = createRoundPRNG(`${numSeed}_liability_selection`);
  if (!isBettingActive || totalPot === 0) {
    chosenLowestRiskNumber = getSyncedRoundDeterministicWinNumber(roundSeed ?? numSeed);
  } else {
    // Pick dynamically among the tied optimal max-profit / zero-liability pockets
    const dynamicOffset = Math.floor(liabilityRng() * highestProfitCandidates.length);
    chosenLowestRiskNumber = highestProfitCandidates[dynamicOffset]?.number ?? 0;

    // 100% Bulletproof Check: if chosen is in lightningSet, pick best safe non-lightning pocket
    if (isBettingActive && lightningSet.has(chosenLowestRiskNumber)) {
      const safeNonLightning = summaries
        .filter(s => !lightningSet.has(s.number))
        .sort((a, b) => b.netHouseProfit - a.netHouseProfit);
      chosenLowestRiskNumber = safeNonLightning[0]?.number ?? (chosenLowestRiskNumber === 0 ? 1 : 0);
    }
  }

  const highestRiskItem = lowestProfitCandidates[0] || { number: 17, netHouseProfit: 0 };
  const zeroBetNumbers = summaries.filter(s => s.totalPayoutIfLands === 0).map(s => s.number);

  return {
    numberSummaries: summaries,
    totalPot,
    totalBetsCount,
    uniqueUsersCount,
    lowestRiskNumber: chosenLowestRiskNumber,
    lowestRiskProfit: maxHouseProfit,
    highestRiskNumber: highestRiskItem.number,
    zeroBetNumbers,
    categorySummaries: {
      red: { amount: catSummary.red.amount, users: catSummary.red.users.size, exposure: catSummary.red.exposure },
      black: { amount: catSummary.black.amount, users: catSummary.black.users.size, exposure: catSummary.black.exposure },
      even: { amount: catSummary.even.amount, users: catSummary.even.users.size, exposure: catSummary.even.exposure },
      odd: { amount: catSummary.odd.amount, users: catSummary.odd.users.size, exposure: catSummary.odd.exposure },
      low: { amount: catSummary.low.amount, users: catSummary.low.users.size, exposure: catSummary.low.exposure },
      high: { amount: catSummary.high.amount, users: catSummary.high.users.size, exposure: catSummary.high.exposure },
      dozen1: { amount: catSummary.dozen1.amount, users: catSummary.dozen1.users.size, exposure: catSummary.dozen1.exposure },
      dozen2: { amount: catSummary.dozen2.amount, users: catSummary.dozen2.users.size, exposure: catSummary.dozen2.exposure },
      dozen3: { amount: catSummary.dozen3.amount, users: catSummary.dozen3.users.size, exposure: catSummary.dozen3.exposure },
      col1: { amount: catSummary.col1.amount, users: catSummary.col1.users.size, exposure: catSummary.col1.exposure },
      col2: { amount: catSummary.col2.amount, users: catSummary.col2.users.size, exposure: catSummary.col2.exposure },
      col3: { amount: catSummary.col3.amount, users: catSummary.col3.users.size, exposure: catSummary.col3.exposure },
    }
  };
};

export const UNIVERSAL_ROULETTE_CYCLE_MS = 38000;
export const UNIVERSAL_BETTING_DURATION_MS = 18000;
export const UNIVERSAL_LIGHTNING_DURATION_MS = 3000;
export const UNIVERSAL_SPINNING_DURATION_MS = 8000;
export const UNIVERSAL_SETTLED_DURATION_MS = 9000;

export interface UniversalRouletteTimeState {
  roundIndex: number;
  roundId: string;
  phase: 'betting' | 'lightning' | 'spinning' | 'settled';
  countdown: number;
  phaseElapsedMs: number;
  cycleElapsedMs: number;
  roundStartTimeMs: number;
  roundEndTimeMs: number;
  totalCycleDurationMs: number;
}

/**
 * 24x7 Global Continuous Clock for Live Roulette.
 * Synchronizes Round ID, Phase, and Countdown across ALL clients worldwide with 0 latency.
 */
export const getUniversalRouletteTimeState = (timestamp: number = Date.now()): UniversalRouletteTimeState => {
  const TOTAL_CYCLE = UNIVERSAL_ROULETTE_CYCLE_MS;
  const BETTING_DUR = UNIVERSAL_BETTING_DURATION_MS;
  const LIGHTNING_DUR = UNIVERSAL_LIGHTNING_DURATION_MS;
  const SPINNING_DUR = UNIVERSAL_SPINNING_DURATION_MS;

  const roundIndex = Math.floor(timestamp / TOTAL_CYCLE);
  const roundStartTimeMs = roundIndex * TOTAL_CYCLE;
  const roundEndTimeMs = roundStartTimeMs + TOTAL_CYCLE;
  const cycleElapsedMs = Math.max(0, timestamp - roundStartTimeMs);

  const roundId = `HLR-${(roundIndex % 1000000).toString().padStart(6, '0')}`;

  let phase: 'betting' | 'lightning' | 'spinning' | 'settled' = 'betting';
  let countdown = 0;
  let phaseElapsedMs = 0;

  if (cycleElapsedMs < BETTING_DUR) {
    phase = 'betting';
    countdown = Math.max(1, Math.ceil((BETTING_DUR - cycleElapsedMs) / 1000));
    phaseElapsedMs = cycleElapsedMs;
  } else if (cycleElapsedMs < BETTING_DUR + LIGHTNING_DUR) {
    phase = 'lightning';
    countdown = 0;
    phaseElapsedMs = cycleElapsedMs - BETTING_DUR;
  } else if (cycleElapsedMs < BETTING_DUR + LIGHTNING_DUR + SPINNING_DUR) {
    phase = 'spinning';
    countdown = 0;
    phaseElapsedMs = cycleElapsedMs - (BETTING_DUR + LIGHTNING_DUR);
  } else {
    phase = 'settled';
    countdown = 0;
    phaseElapsedMs = cycleElapsedMs - (BETTING_DUR + LIGHTNING_DUR + SPINNING_DUR);
  }

  return {
    roundIndex,
    roundId,
    phase,
    countdown,
    phaseElapsedMs,
    cycleElapsedMs,
    roundStartTimeMs,
    roundEndTimeMs,
    totalCycleDurationMs: TOTAL_CYCLE
  };
};

/**
 * Deterministically generates the same base winning number for a given round index across all devices.
 * Features high-entropy pseudo-random distribution across 0-36 without streaks or repetition.
 */
export const getSyncedRoundDeterministicWinNumber = (roundIndexOrId: number | string): number => {
  const rng = createRoundPRNG(`${roundIndexOrId}_deterministic_pocket_v2`);
  const pocketIdx = Math.floor(rng() * ROULETTE_WHEEL_ORDER.length);
  return ROULETTE_WHEEL_ORDER[pocketIdx] ?? 0;
};

export interface SyncedRoundResultItem {
  id: string;
  roundId: string;
  roundIndex: number;
  winningNumber: number;
  color: 'green' | 'red' | 'black';
  parity: 'zero' | 'even' | 'odd';
  range: 'zero' | '1-18' | '19-36';
  dozen: 'zero' | '1st 12' | '2nd 12' | '3rd 12';
  column: 'zero' | 'Col 1' | 'Col 2' | 'Col 3';
  multiplier?: number;
  lightningNumbers: LightningMultiplier[];
  settledAt: string;
  timestamp: string;
}

/**
 * Returns the exact outcome for any past or current round index.
 * If an override or saved document exists in Firestore, that outcome is preserved.
 * Otherwise, uses the universal 24/7 deterministic PRNG.
 */
export const getDeterministicRoundOutcome = (
  roundIndex: number,
  savedDoc?: any
): SyncedRoundResultItem => {
  const roundId = `HLR-${(roundIndex % 1000000).toString().padStart(6, '0')}`;
  
  if (savedDoc && typeof savedDoc.winningNumber === 'number') {
    const num = savedDoc.winningNumber;
    const col = savedDoc.color || getRouletteNumberColor(num);
    const mult = savedDoc.multiplier && savedDoc.multiplier > 30 ? savedDoc.multiplier : undefined;
    const lNums: LightningMultiplier[] = Array.isArray(savedDoc.lightningNumbers) && savedDoc.lightningNumbers.length > 0
      ? savedDoc.lightningNumbers
      : getSyncedLightningMultipliers(roundId);

    return {
      id: savedDoc.roundId || roundId,
      roundId: savedDoc.roundId || roundId,
      roundIndex,
      winningNumber: num,
      color: col,
      parity: num === 0 ? 'zero' : (num % 2 === 0 ? 'even' : 'odd'),
      range: num === 0 ? 'zero' : (num <= 18 ? '1-18' : '19-36'),
      dozen: num === 0 ? 'zero' : (num <= 12 ? '1st 12' : num <= 24 ? '2nd 12' : '3rd 12'),
      column: num === 0 ? 'zero' : (num % 3 === 1 ? 'Col 1' : num % 3 === 2 ? 'Col 2' : 'Col 3'),
      multiplier: mult,
      lightningNumbers: lNums,
      settledAt: savedDoc.settledAt || new Date(roundIndex * UNIVERSAL_ROULETTE_CYCLE_MS + 29000).toISOString(),
      timestamp: savedDoc.settledAt ? new Date(savedDoc.settledAt).toLocaleTimeString('en-IN') : new Date(roundIndex * UNIVERSAL_ROULETTE_CYCLE_MS).toLocaleTimeString('en-IN')
    };
  }

  const num = getSyncedRoundDeterministicWinNumber(roundId);
  const col = getRouletteNumberColor(num);
  const lightning = getSyncedLightningMultipliers(roundId);
  const lucky = lightning.find(l => l.number === num);
  const multiplier = lucky ? lucky.multiplier : undefined;

  const roundStartMs = roundIndex * UNIVERSAL_ROULETTE_CYCLE_MS;
  const roundSettledMs = roundStartMs + 29000;

  return {
    id: roundId,
    roundId,
    roundIndex,
    winningNumber: num,
    color: col,
    parity: num === 0 ? 'zero' : (num % 2 === 0 ? 'even' : 'odd'),
    range: num === 0 ? 'zero' : (num <= 18 ? '1-18' : '19-36'),
    dozen: num === 0 ? 'zero' : (num <= 12 ? '1st 12' : num <= 24 ? '2nd 12' : '3rd 12'),
    column: num === 0 ? 'zero' : (num % 3 === 1 ? 'Col 1' : num % 3 === 2 ? 'Col 2' : 'Col 3'),
    multiplier,
    lightningNumbers: lightning,
    settledAt: new Date(roundSettledMs).toISOString(),
    timestamp: new Date(roundSettledMs).toLocaleTimeString('en-IN')
  };
};

/**
 * Continuous 24/7 History of recent rounds immediately preceding the current live moment.
 * Merges with Firestore recorded documents so custom manual admin wins & live bets are respected.
 * Guarantees that opening roulette at any moment displays contiguous, real-time results with 0-sec delay.
 */
export const getContinuous24x7History = (
  count: number = 20,
  firestoreRoundsMap?: Map<string, any>,
  timestamp: number = Date.now()
): SyncedRoundResultItem[] => {
  const timeState = getUniversalRouletteTimeState(timestamp);
  const currentRoundIndex = timeState.roundIndex;
  const isCurrentlySettled = timeState.phase === 'settled';

  // If current round has reached settled phase (>= 29s), the current round is included as the latest result.
  // Otherwise, the latest settled round is currentRoundIndex - 1.
  const startIdx = isCurrentlySettled ? currentRoundIndex : currentRoundIndex - 1;

  const results: SyncedRoundResultItem[] = [];
  for (let i = 0; i < count; i++) {
    const rIdx = startIdx - i;
    if (rIdx < 0) break;
    const rId = `HLR-${(rIdx % 1000000).toString().padStart(6, '0')}`;
    const savedDoc = firestoreRoundsMap?.get(rId);
    results.push(getDeterministicRoundOutcome(rIdx, savedDoc));
  }
  return results;
};

