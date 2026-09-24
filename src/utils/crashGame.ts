import { CrashGameConfig, CrashCommunityBet, CrashRound } from '../types';

export const DEFAULT_CRASH_CONFIG: CrashGameConfig = {
  isEnabled: true,
  minBet: 10,
  maxBet: 50000,
  rtpPercentage: 97.0, // 0% to 99% Admin Adjustable RTP
  houseEdgePercentage: 3.0,
  maxMultiplierCap: 1000,
  minCrashMultiplier: 1.00,
  roundCooldownSeconds: 5,
  manualForceNextMultiplier: null,
  simulatedBotsEnabled: true,
  speedMultiplier: 1.0,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System'
};

/**
 * Generates mathematically fair or RTP-adjusted crash multiplier
 * @param config Current CrashGameConfig from Firestore / Admin
 */
export function generateCrashMultiplier(config: CrashGameConfig): number {
  // 1. Check if Admin manually forced an exact next multiplier
  const forcedMult = (config?.manualForceNextMultiplier !== undefined && config?.manualForceNextMultiplier !== null && !isNaN(Number(config.manualForceNextMultiplier)))
    ? Number(config.manualForceNextMultiplier)
    : ((config as any)?.forcedCrashMultiplier !== undefined && (config as any)?.forcedCrashMultiplier !== null && !isNaN(Number((config as any).forcedCrashMultiplier)))
    ? Number((config as any).forcedCrashMultiplier)
    : null;

  if (forcedMult !== null && forcedMult >= 1.0) {
    return Math.max(1.0, Math.min(config.maxMultiplierCap || 5000, forcedMult));
  }

  // 2. If RTP is set to 0% by Admin or House Edge 100% -> 100% Instant Crash at 1.00x
  const rtp = Math.max(0, Math.min(99.9, typeof config.rtpPercentage === 'number' ? config.rtpPercentage : (100 - (config.houseEdgePercentage ?? 3))));
  const houseEdge = typeof config.houseEdgePercentage === 'number' ? config.houseEdgePercentage : (100 - rtp);
  if (rtp <= 0 || houseEdge >= 100) {
    return 1.00;
  }

  // 3. Early crash probability directly driven by House Edge %
  const houseEdgeFraction = Math.max(0, Math.min(1, houseEdge / 100));
  const rand = Math.random();

  // Instant / Early crash under house edge control
  if (rand < houseEdgeFraction) {
    const earlyCrash = 1.00 + (Math.random() * 0.20);
    return Number(earlyCrash.toFixed(2));
  }

  // 4. Standard Spribe / Crash curve distribution scaled by RTP
  const rtpFactor = Math.max(0.1, rtp / 100);
  const uniform = Math.random();
  // Safe denominator preventing division by 0
  const denom = Math.max(0.0001, 1 - uniform * rtpFactor * 0.96);
  let multiplier = 1.05 / denom;

  // Natural rare mega multiplier probability only when RTP is high (>80%)
  if (rtp > 80 && Math.random() < 0.05) {
    multiplier = multiplier * (1.5 + Math.random() * 3);
  }

  // Cap at minimum and maximum
  const minM = Math.max(1.00, config.minCrashMultiplier || 1.00);
  const maxM = config.maxMultiplierCap || 1000;
  multiplier = Math.max(minM, Math.min(maxM, multiplier));

  return Number(multiplier.toFixed(2));
}

/**
 * Calculates current live multiplier at elapsed time `t` (seconds)
 */
export function calculateLiveMultiplier(elapsedSeconds: number, speedMultiplier: number = 1.0): number {
  if (elapsedSeconds <= 0) return 1.00;
  const effectiveTime = elapsedSeconds * (speedMultiplier || 1.0);
  
  // Smooth progressive acceleration:
  // Starts steady, gently curves up exponentially
  const baseGrowth = 0.065;
  const exponentialGrowth = Math.pow(Math.E, baseGrowth * effectiveTime) - 1;
  const linearBoost = effectiveTime * 0.04;
  
  const mult = 1.00 + exponentialGrowth + linearBoost;
  return Number(mult.toFixed(2));
}

export const AVIATOR_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&auto=format&fit=crop&q=80'
];

export const MOCK_BOT_NAMES = [
  '3***2', '8***5', '1***9', '7***4', '2***1', '5***7', '9***0', '4***3', 
  '6***8', '2***7', '8***1', '3***9', '5***5', '1***2', '7***7', '9***8'
];

/**
 * Generates realistic community bets for the live player feed
 */
export function generateCommunityBets(count: number = 25): CrashCommunityBet[] {
  const bets: CrashCommunityBet[] = [];
  const betAmounts = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 15000];

  for (let i = 0; i < count; i++) {
    const name = MOCK_BOT_NAMES[Math.floor(Math.random() * MOCK_BOT_NAMES.length)];
    const avatar = AVIATOR_AVATARS[Math.floor(Math.random() * AVIATOR_AVATARS.length)];
    const betAmount = betAmounts[Math.floor(Math.random() * betAmounts.length)];
    
    // Auto cashout target between 1.10x and 12.00x
    const autoCash = Number((1.10 + Math.random() * 8.5).toFixed(2));

    bets.push({
      id: `bot-bet-${Date.now()}-${i}`,
      userName: `${name.charAt(0)}***${Math.floor(Math.random() * 9)}`,
      avatarUrl: avatar,
      betAmount,
      autoCashOutAt: autoCash,
      status: 'betting'
    });
  }

  // Sort highest bet first
  return bets.sort((a, b) => b.betAmount - a.betAmount);
}

export const INITIAL_CRASH_ROUNDS_HISTORY: number[] = [
  1.87, 10.92, 2.06, 1.00, 1.33, 4.11, 579.68, 1.66, 2.44, 1.41, 1.25, 3.82, 1.15, 8.42, 1.03, 19.50, 2.18
];

/**
 * 32-bit MurmurHash3 string/number seed hasher for Crash Game
 */
export function hashSeedCrash(seed: string | number): number {
  let h = 0x811c9dc5;
  const str = String(seed || 'crash_seed');
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 15), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Mulberry32 PRNG generator seeded deterministically for Crash Game
 */
export function createRoundPRNGCrash(seed: string | number): () => number {
  let s = hashSeedCrash(seed);
  return function nextFloat(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Inverts calculateLiveMultiplier: returns exact seconds needed to reach targetMultiplier
 */
export function getSyncedFlightDurationSeconds(targetMultiplier: number, speedMultiplier: number = 1.0): number {
  if (targetMultiplier <= 1.00) return 0;
  const speed = speedMultiplier || 1.0;

  // Binary search inversion over [0, 120] seconds
  let low = 0;
  let high = 120;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const multAtMid = calculateLiveMultiplier(mid, speed);
    if (multAtMid < targetMultiplier) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Number(((low + high) / 2).toFixed(3));
}

export const UNIVERSAL_CRASH_WAITING_MS = 5000;
export const UNIVERSAL_CRASH_CRASHED_MS = 2600;

export interface SyncedCrashRoundDetails {
  roundIndex: number;
  roundId: string;
  roundNumber: number;
  crashMultiplier: number;
  flightDurationSeconds: number;
  flightDurationMs: number;
  totalRoundDurationMs: number;
  communityBots: CrashCommunityBet[];
}

/**
 * Generates deterministic crash multiplier and round details for a round index
 */
export function getSyncedCrashRoundDetails(
  roundIndex: number,
  config?: CrashGameConfig
): SyncedCrashRoundDetails {
  const rng = createRoundPRNGCrash(`crash_round_v3_${roundIndex}`);
  const d = new Date(roundIndex * 20000);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const roundNumber = 1000 + (roundIndex % 90000);
  const roundId = `CRASH-${dateStr}-${roundNumber}`;

  // Deterministic Crash Multiplier Generation with Spribe/Aviator distribution
  const isManualActive = Boolean((config as any)?.isManualOverride);
  const isRoundMatched = !(config as any)?.targetRoundId || (config as any).targetRoundId === roundId;
  const rawForced = (config?.manualForceNextMultiplier !== undefined && config?.manualForceNextMultiplier !== null && !isNaN(Number(config.manualForceNextMultiplier)))
    ? Number(config.manualForceNextMultiplier)
    : ((config as any)?.forcedCrashMultiplier !== undefined && (config as any)?.forcedCrashMultiplier !== null && !isNaN(Number((config as any).forcedCrashMultiplier)))
    ? Number((config as any).forcedCrashMultiplier)
    : null;

  const forcedMult = (isManualActive && isRoundMatched && rawForced !== null) ? rawForced : null;

  let crashMultiplier = 1.00;
  if (forcedMult !== null && forcedMult >= 1.0) {
    const maxM = config?.maxMultiplierCap || 5000;
    crashMultiplier = Math.max(1.00, Math.min(maxM, forcedMult));
  } else if ((config as any)?.autoCrashMultiplier && typeof (config as any).autoCrashMultiplier === 'number' && Number((config as any).autoCrashMultiplier) >= 1.0) {
    crashMultiplier = Math.max(1.00, Number((config as any).autoCrashMultiplier));
  } else if ((config as any)?.liveBetsAmount > 0 || (config as any)?.hasLiveUserBets) {
    // 🛡️ UNCONDITIONAL 100% HOUSE PROTECTION:
    // When real users place bets, house guarantees profit with 0-second latency
    // Flight crashes early between 1.05x and 1.25x so user bets lose and house profits
    crashMultiplier = 1.05 + Math.floor(rng() * 20) / 100;
  } else {
    const rtp = config ? (typeof config.rtpPercentage === 'number' ? config.rtpPercentage : 97.0) : 97.0;
    const houseEdge = 100 - rtp;
    const rand = rng();

    if (rand < houseEdge / 100) {
      crashMultiplier = 1.00 + rng() * 0.20;
    } else {
      const rtpFactor = Math.max(0.1, rtp / 100);
      const uniform = rng();
      const denom = Math.max(0.0001, 1 - uniform * rtpFactor * 0.96);
      let mult = 1.05 / denom;
      if (rtp > 80 && rng() < 0.05) {
        mult = mult * (1.5 + rng() * 3);
      }
      const maxM = config?.maxMultiplierCap || 1000;
      crashMultiplier = Math.max(1.00, Math.min(maxM, mult));
    }
  }
  crashMultiplier = Number(crashMultiplier.toFixed(2));

  const speedMult = config?.speedMultiplier || 1.0;
  const flightDurationSeconds = getSyncedFlightDurationSeconds(crashMultiplier, speedMult);
  const flightDurationMs = Math.round(flightDurationSeconds * 1000);
  const totalRoundDurationMs = UNIVERSAL_CRASH_WAITING_MS + flightDurationMs + UNIVERSAL_CRASH_CRASHED_MS;

  // Deterministic community bots for this round
  const botRng = createRoundPRNGCrash(`crash_bots_${roundIndex}`);
  const betAmounts = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 15000];
  const communityBots: CrashCommunityBet[] = [];
  for (let i = 0; i < 28; i++) {
    const name = MOCK_BOT_NAMES[Math.floor(botRng() * MOCK_BOT_NAMES.length)];
    const avatar = AVIATOR_AVATARS[Math.floor(botRng() * AVIATOR_AVATARS.length)];
    const betAmount = betAmounts[Math.floor(botRng() * betAmounts.length)];
    const autoCash = Number((1.10 + botRng() * 8.5).toFixed(2));
    communityBots.push({
      id: `bot-${roundIndex}-${i}`,
      userName: `${name.charAt(0)}***${Math.floor(botRng() * 9)}`,
      avatarUrl: avatar,
      betAmount,
      autoCashOutAt: autoCash,
      status: 'betting'
    });
  }
  communityBots.sort((a, b) => b.betAmount - a.betAmount);

  return {
    roundIndex,
    roundId,
    roundNumber,
    crashMultiplier,
    flightDurationSeconds,
    flightDurationMs,
    totalRoundDurationMs,
    communityBots
  };
}

export interface UniversalCrashTimeState {
  roundIndex: number;
  roundDetails: SyncedCrashRoundDetails;
  phase: 'waiting' | 'flying' | 'crashed';
  waitingCountdown: number;
  currentMultiplier: number;
  elapsedInPhaseMs: number;
  flightElapsedSeconds: number;
  roundStartTimeMs: number;
  flightStartTimeMs: number;
  crashedStartTimeMs: number;
}

/**
 * 24x7 Global Continuous Clock for Aviator Crash Game.
 * Synchronizes Round ID, Phase, Live Multiplier, and Crash Point across ALL clients worldwide with 0 latency.
 */
export function getUniversalCrashTimeState(timestamp: number = Date.now(), config?: CrashGameConfig): UniversalCrashTimeState {
  // We compute timeline anchored by 2-hour blocks
  const BLOCK_MS = 2 * 3600 * 1000;
  const blockIndex = Math.floor(timestamp / BLOCK_MS);
  let curTime = blockIndex * BLOCK_MS;
  let rIdx = blockIndex * 480; // Estimated baseline

  let roundDetails = getSyncedCrashRoundDetails(rIdx);
  let roundStart = curTime;
  let roundEnd = roundStart + roundDetails.totalRoundDurationMs;

  while (roundEnd <= timestamp) {
    rIdx++;
    curTime = roundEnd;
    roundDetails = getSyncedCrashRoundDetails(rIdx);
    roundStart = curTime;
    roundEnd = roundStart + roundDetails.totalRoundDurationMs;
  }

  // Once active round is identified, apply active round config (e.g. forced multiplier or house edge)
  if (config) {
    roundDetails = getSyncedCrashRoundDetails(rIdx, config);
  }

  const elapsedInRoundMs = Math.max(0, timestamp - roundStart);
  const flightStart = roundStart + UNIVERSAL_CRASH_WAITING_MS;
  const crashedStart = flightStart + roundDetails.flightDurationMs;

  let phase: 'waiting' | 'flying' | 'crashed' = 'waiting';
  let waitingCountdown = 0;
  let currentMultiplier = 1.00;
  let elapsedInPhaseMs = 0;
  let flightElapsedSeconds = 0;

  if (elapsedInRoundMs < UNIVERSAL_CRASH_WAITING_MS) {
    phase = 'waiting';
    waitingCountdown = Number(Math.max(0, (UNIVERSAL_CRASH_WAITING_MS - elapsedInRoundMs) / 1000).toFixed(1));
    currentMultiplier = 1.00;
    elapsedInPhaseMs = elapsedInRoundMs;
  } else if (elapsedInRoundMs < UNIVERSAL_CRASH_WAITING_MS + roundDetails.flightDurationMs && !(config as any)?.forceInstantCrash) {
    phase = 'flying';
    waitingCountdown = 0;
    elapsedInPhaseMs = elapsedInRoundMs - UNIVERSAL_CRASH_WAITING_MS;
    flightElapsedSeconds = elapsedInPhaseMs / 1000;
    const speedMult = config?.speedMultiplier || 1.0;
    const calculatedMult = calculateLiveMultiplier(flightElapsedSeconds, speedMult);
    currentMultiplier = Math.min(roundDetails.crashMultiplier, calculatedMult);
    if (currentMultiplier >= roundDetails.crashMultiplier) {
      phase = 'crashed';
      currentMultiplier = roundDetails.crashMultiplier;
    }
  } else {
    phase = 'crashed';
    waitingCountdown = 0;
    currentMultiplier = roundDetails.crashMultiplier;
    elapsedInPhaseMs = elapsedInRoundMs - (UNIVERSAL_CRASH_WAITING_MS + roundDetails.flightDurationMs);
    flightElapsedSeconds = roundDetails.flightDurationSeconds;
  }

  return {
    roundIndex: rIdx,
    roundDetails,
    phase,
    waitingCountdown,
    currentMultiplier,
    elapsedInPhaseMs,
    flightElapsedSeconds,
    roundStartTimeMs: roundStart,
    flightStartTimeMs: flightStart,
    crashedStartTimeMs: crashedStart
  };
}

/**
 * Returns deterministic history of past crash multipliers
 */
export function getSyncedCrashHistory(currentRoundIndex: number, count: number = 35, config?: CrashGameConfig): number[] {
  const history: number[] = [];
  for (let i = 1; i <= count; i++) {
    const pastIdx = currentRoundIndex - i;
    if (pastIdx < 0) break;
    const details = getSyncedCrashRoundDetails(pastIdx, config);
    history.push(details.crashMultiplier);
  }
  return history;
}

