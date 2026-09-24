import { CardRank, CardSuit, PlayingCard, DragonTigerSide, DragonTigerConfig, DragonTigerRound } from '../types';
import { SUITS, RANKS, createDeck, shuffleDeck } from './andarBahar';

export { SUITS, RANKS };

export const DEFAULT_DRAGON_TIGER_CONFIG: DragonTigerConfig = {
  isEnabled: true,
  minBet: 50,
  maxBet: 15000000,
  bettingDurationSeconds: 12,
  dragonMultiplier: 2.0, // 1:1
  tigerMultiplier: 2.0,  // 1:1
  tieMultiplier: 12.0,   // 11:1
  suitedTieMultiplier: 51.0, // 50:1
  rtpPercentage: 0,
  houseEdgePercentage: 100,
  rtpMode: 'house_protect',
  manualForceWinner: 'random',
  manualDragonRank: 'random',
  manualTigerRank: 'random',
  dealerVoiceEnabled: true,
  simulatedPoolScale: 1.0,
  preventBothDragonTigerBet: true, // Opposite betting restriction (Dragon vs Tiger) enabled by default
  chipValues: [10, 50, 100, 500, 1000, 5000, 25000],
};

/**
 * Returns numeric rank comparison value for Dragon Tiger:
 * Ace = 1 (Lowest)
 * 2 - 10 = 2 - 10
 * Jack = 11
 * Queen = 12
 * King = 13 (Highest)
 */
export function getRankNumericValue(rank: CardRank): number {
  switch (rank) {
    case 'A': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return 5;
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J': return 11;
    case 'Q': return 12;
    case 'K': return 13;
    default: return 1;
  }
}

export function getRankFullWord(rank: CardRank, lang: DragonTigerLang = 'en'): string {
  if (lang === 'bn') {
    switch (rank) {
      case 'A': return 'টেক্কা (Ace)';
      case '2': return 'দুই';
      case '3': return 'তিন';
      case '4': return 'চার';
      case '5': return 'পাঁচ';
      case '6': return 'ছয়';
      case '7': return 'সাত';
      case '8': return 'আট';
      case '9': return 'নয়';
      case '10': return 'দশ';
      case 'J': return 'গোলাম (Jack)';
      case 'Q': return 'বিবি (Queen)';
      case 'K': return 'সাহেব (King)';
      default: return rank;
    }
  }

  if (lang === 'hi') {
    switch (rank) {
      case 'A': return 'इक्का (Ace)';
      case '2': return 'दुग्गी';
      case '3': return 'तिग्गी';
      case '4': return 'चौका';
      case '5': return 'पंजा';
      case '6': return 'छक्का';
      case '7': return 'सत्ती';
      case '8': return 'अट्ठी';
      case '9': return 'नेहला';
      case '10': return 'दहला';
      case 'J': return 'गुलाम (Jack)';
      case 'Q': return 'बेगम (Queen)';
      case 'K': return 'बादशाह (King)';
      default: return rank;
    }
  }

  // English default
  switch (rank) {
    case 'A': return 'Ace';
    case '2': return 'Two';
    case '3': return 'Three';
    case '4': return 'Four';
    case '5': return 'Five';
    case '6': return 'Six';
    case '7': return 'Seven';
    case '8': return 'Eight';
    case '9': return 'Nine';
    case '10': return 'Ten';
    case 'J': return 'Jack';
    case 'Q': return 'Queen';
    case 'K': return 'King';
    default: return rank;
  }
}

export type DragonTigerLang = 'bn' | 'en' | 'hi';

/**
 * Localized phrases for Dragon Tiger Live Dealer
 */
export function getBetOpenPhrase(lang: DragonTigerLang, userName?: string): string {
  const cleanName = userName ? userName.split(' ')[0] : '';
  if (lang === 'bn') {
    return cleanName 
      ? `${cleanName}, বেটিং শুরু হয়েছে! অনুগ্রহ করে আপনার বেট ধরুন।`
      : 'বেটিং শুরু হয়েছে! অনুগ্রহ করে আপনার বেট ধরুন।';
  }
  if (lang === 'hi') {
    return cleanName
      ? `${cleanName}, बेटिंग शुरू हो चुकी है! कृपया अपनी बेट लगाएं।`
      : 'बेटिंग शुरू हो चुकी है! कृपया अपनी बेट लगाएं।';
  }
  return cleanName
    ? `${cleanName}, bets are open! Please place your bets.`
    : 'Bets are open! Please place your bets.';
}

export function getFinalSecondsPhrase(lang: DragonTigerLang): string {
  if (lang === 'bn') {
    return 'দেরি করবেন না, এখনই বেট করুন! শেষ কয়েক সেকেন্ড বাকি।';
  }
  if (lang === 'hi') {
    return 'देरी न करें, कृपया अभी बेट लगाएं! आखिरी कुछ सेकंड।';
  }
  return 'Do not wait, please place your bet now! Final seconds.';
}

export function getBetsClosedPhrase(lang: DragonTigerLang): string {
  if (lang === 'bn') {
    return 'আর কোনো বেট নেওয়া হবে না! কার্ড দেওয়া হচ্ছে।';
  }
  if (lang === 'hi') {
    return 'समय समाप्त, अब कोई बेट नहीं! पत्ते बांटे जा रहे हैं।';
  }
  return 'No more bets! Dealing cards now.';
}

export function getUserWinPhrase(lang: DragonTigerLang, userName: string, wonAmount: number): string {
  const cleanName = userName ? userName.split(' ')[0] : 'প্লেয়ার';
  const formattedAmt = wonAmount.toLocaleString('en-IN');
  if (lang === 'bn') {
    return `অভিনন্দন ${cleanName}! আপনি ড্রাগন টাইগারে ${formattedAmt} টাকা জিতেছেন!`;
  }
  if (lang === 'hi') {
    return `बधाई हो ${cleanName}! आपने ड्रैगन टाइगर में ₹${formattedAmt} जीते हैं!`;
  }
  return `Congratulations ${cleanName}! You won ₹${formattedAmt} on Dragon Tiger!`;
}

export function getNextRoundInvitePhrase(lang: DragonTigerLang, userName?: string): string {
  const cleanName = userName ? userName.split(' ')[0] : '';
  if (lang === 'bn') {
    return cleanName
      ? `${cleanName}, আপনি এখন নতুন রাউন্ডের জন্য বেট করতে পারেন।`
      : 'আপনি এখন নতুন রাউন্ডের জন্য বেট করতে পারেন।';
  }
  if (lang === 'hi') {
    return cleanName
      ? `${cleanName}, आप अब अपनी अगली बेट लगा सकते हैं।`
      : 'आप अब अपनी अगली बेट लगा सकते हैं।';
  }
  return cleanName
    ? `${cleanName}, you can place your bet now.`
    : 'You can place your bet now.';
}

export function getRoundOutcomePhrase(
  lang: DragonTigerLang,
  winner: DragonTigerSide,
  isSuitedTie: boolean,
  dCard: PlayingCard,
  tCard: PlayingCard
): string {
  const dWord = getRankFullWord(dCard.rank, lang);
  const tWord = getRankFullWord(tCard.rank, lang);

  if (lang === 'bn') {
    if (winner === 'dragon') {
      return `ড্রাগন বিজয়ী! ড্রাগন পেয়েছে ${dWord} এবং টাইগার পেয়েছে ${tWord}।`;
    }
    if (winner === 'tiger') {
      return `টাইগার বিজয়ী! টাইগার পেয়েছে ${tWord} এবং ড্রাগন পেয়েছে ${dWord}।`;
    }
    if (isSuitedTie || winner === 'suited_tie') {
      return `স্যুটেড টাই! ড্রাগন ও টাইগার উভয়েই ${dWord} পেয়েছে। পঞ্চাশ গুণ পে-আউট!`;
    }
    return `টাই হয়েছে! ড্রাগন ও টাইগার উভয়েই ${dWord} পেয়েছে। এগারো গুণ পে-আউট!`;
  }

  if (lang === 'hi') {
    if (winner === 'dragon') {
      return `ड्रैगन जीता! ড্রাগন পেয়েছে ${dWord} और टाइगर को मिला ${tWord}।`;
    }
    if (winner === 'tiger') {
      return `टाइगर जीता! टाइगर को मिला ${tWord} और ড্রাগন को मिला ${dWord}।`;
    }
    if (isSuitedTie || winner === 'suited_tie') {
      return `सूटेड टाई! दोनों को मिला ${dWord}। पचास गुना पे-आउट!`;
    }
    return `टाई हुआ है! दोनों को मिला ${dWord}। ग्यारह गुना पे-आउट!`;
  }

  // English
  if (winner === 'dragon') {
    return `Dragon win with ${dWord} over ${tWord}.`;
  }
  if (winner === 'tiger') {
    return `Tiger win with ${tWord} over ${dWord}.`;
  }
  if (isSuitedTie || winner === 'suited_tie') {
    return `Suited Tie! ${dWord} of ${dCard.suit} for both Dragon and Tiger! 50 to 1 Payout!`;
  }
  return `It is a Tie! Both ${dWord}. 11 to 1 Payout!`;
}

/**
 * Compares two cards to determine the winner (dragon, tiger, tie, suited_tie)
 */
export function determineDragonTigerWinner(dragonCard: PlayingCard, tigerCard: PlayingCard): {
  winner: DragonTigerSide;
  isSuitedTie: boolean;
} {
  const dragonVal = getRankNumericValue(dragonCard.rank);
  const tigerVal = getRankNumericValue(tigerCard.rank);

  if (dragonVal > tigerVal) {
    return { winner: 'dragon', isSuitedTie: false };
  } else if (tigerVal > dragonVal) {
    return { winner: 'tiger', isSuitedTie: false };
  } else {
    const isSuited = dragonCard.suit === tigerCard.suit;
    return { 
      winner: isSuited ? 'suited_tie' : 'tie',
      isSuitedTie: isSuited 
    };
  }
}

/**
 * Guaranteed 50/50 balanced anti-streak pattern for normal Dragon Tiger rounds.
 * Prevents streaks greater than 2 in a row of the same side when no bets are placed.
 */
export const BALANCED_DRAGON_TIGER_PATTERN: DragonTigerSide[] = [
  'dragon', 'tiger', 'dragon', 'tiger', 'tiger', 'dragon', 'tiger', 'dragon',
  'dragon', 'tiger', 'tiger', 'dragon', 'dragon', 'tiger', 'dragon', 'tiger',
  'tiger', 'dragon', 'tiger', 'tiger', 'dragon', 'dragon', 'tiger', 'dragon',
  'tiger', 'dragon', 'dragon', 'tiger', 'dragon', 'tiger', 'tiger', 'dragon',
  'tiger', 'dragon', 'tiger', 'dragon', 'dragon', 'tiger', 'tiger', 'dragon',
  'dragon', 'tiger', 'dragon', 'tiger', 'dragon', 'tiger', 'tiger', 'dragon',
  'dragon', 'tiger', 'dragon', 'tiger', 'tiger', 'dragon', 'dragon', 'tiger',
  'tiger', 'dragon', 'tiger', 'dragon', 'dragon', 'tiger', 'dragon', 'tiger'
];

export function getBalancedNormalDragonTigerWinner(roundIndex: number): DragonTigerSide {
  const cleanIdx = Math.abs(Math.floor(roundIndex));
  return BALANCED_DRAGON_TIGER_PATTERN[cleanIdx % BALANCED_DRAGON_TIGER_PATTERN.length];
}

/**
 * Deterministically crafts cards for a given target outcome with 100% mathematical certainty.
 */
export function craftDragonTigerCardsForOutcome(
  targetSide: DragonTigerSide,
  deck: PlayingCard[],
  rng: () => number = Math.random
): {
  dragonCard: PlayingCard;
  tigerCard: PlayingCard;
  winningSide: DragonTigerSide;
  isSuitedTie: boolean;
} {
  let finalDragonCard: PlayingCard;
  let finalTigerCard: PlayingCard;

  if (targetSide === 'dragon') {
    // Pick two cards from the shuffled deck where Dragon card rank > Tiger card rank
    let cardA = deck[0];
    let cardB = deck[1];
    let idx = 2;
    while (getRankNumericValue(cardA.rank) === getRankNumericValue(cardB.rank) && idx < deck.length) {
      cardB = deck[idx++];
    }
    const valA = getRankNumericValue(cardA.rank);
    const valB = getRankNumericValue(cardB.rank);
    if (valA > valB) {
      finalDragonCard = cardA;
      finalTigerCard = cardB;
    } else if (valB > valA) {
      finalDragonCard = cardB;
      finalTigerCard = cardA;
    } else {
      const sorted = [...deck].sort((a, b) => getRankNumericValue(b.rank) - getRankNumericValue(a.rank));
      finalDragonCard = sorted[0];
      finalTigerCard = sorted[sorted.length - 1];
    }
  } else if (targetSide === 'tiger') {
    // Pick two cards from the shuffled deck where Tiger card rank > Dragon card rank
    let cardA = deck[0];
    let cardB = deck[1];
    let idx = 2;
    while (getRankNumericValue(cardA.rank) === getRankNumericValue(cardB.rank) && idx < deck.length) {
      cardB = deck[idx++];
    }
    const valA = getRankNumericValue(cardA.rank);
    const valB = getRankNumericValue(cardB.rank);
    if (valB > valA) {
      finalTigerCard = cardB;
      finalDragonCard = cardA;
    } else if (valA > valB) {
      finalTigerCard = cardA;
      finalDragonCard = cardB;
    } else {
      const sorted = [...deck].sort((a, b) => getRankNumericValue(b.rank) - getRankNumericValue(a.rank));
      finalTigerCard = sorted[0];
      finalDragonCard = sorted[sorted.length - 1];
    }
  } else if (targetSide === 'tie') {
    // Natural tie: identical rank, different suit
    finalDragonCard = deck[0];
    const match = deck.find(c => c.id !== finalDragonCard.id && c.rank === finalDragonCard.rank && c.suit !== finalDragonCard.suit);
    if (match) {
      finalTigerCard = match;
    } else {
      const suits: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      const altSuit = suits.find(s => s !== finalDragonCard.suit) || 'spades';
      finalTigerCard = {
        id: `twin_card_${Math.floor(rng() * 1000000)}`,
        suit: altSuit,
        rank: finalDragonCard.rank,
        value: getRankNumericValue(finalDragonCard.rank),
        color: (altSuit === 'hearts' || altSuit === 'diamonds') ? 'red' : 'black',
      };
    }
  } else if (targetSide === 'suited_tie') {
    // Suited tie: identical rank and suit
    finalDragonCard = deck[0];
    finalTigerCard = { ...finalDragonCard, id: `suited_twin_${Math.floor(rng() * 1000000)}` };
  } else {
    finalDragonCard = deck[0];
    finalTigerCard = deck[1];
  }

  const outcome = determineDragonTigerWinner(finalDragonCard, finalTigerCard);
  return {
    dragonCard: finalDragonCard,
    tigerCard: finalTigerCard,
    winningSide: outcome.winner,
    isSuitedTie: outcome.isSuitedTie
  };
}

/**
 * Simulates drawing Dragon and Tiger cards based on config and house protection rules
 */
export function simulateDragonTigerRound(
  config: DragonTigerConfig,
  totalBetsDragon: number = 0,
  totalBetsTiger: number = 0,
  totalBetsTie: number = 0,
  totalBetsSuitedTie: number = 0,
  rng?: () => number,
  roundIndex: number = 0
): {
  dragonCard: PlayingCard;
  tigerCard: PlayingCard;
  winningSide: DragonTigerSide;
  isSuitedTie: boolean;
} {
  const rand = rng || Math.random;
  const deck = shuffleDeck(createDeck(), rand);

  // 1. Manual Specific Card Ranks if specified by admin
  const manualDragonRank = config.manualDragonRank && config.manualDragonRank !== 'random' ? config.manualDragonRank : null;
  const manualTigerRank = config.manualTigerRank && config.manualTigerRank !== 'random' ? config.manualTigerRank : null;

  if (manualDragonRank && manualTigerRank) {
    const dCard = deck.find((c) => c.rank === manualDragonRank) || deck[0];
    const availableForTiger = deck.filter((c) => c.id !== dCard.id);
    const tCard = availableForTiger.find((c) => c.rank === manualTigerRank) || availableForTiger[0];
    const res = determineDragonTigerWinner(dCard, tCard);
    return { dragonCard: dCard, tigerCard: tCard, winningSide: res.winner, isSuitedTie: res.isSuitedTie };
  }

  const forcedTarget = (config?.manualForceWinner && config.manualForceWinner !== 'random')
    ? config.manualForceWinner
    : ((config as any)?.forcedWinner && (config as any).forcedWinner !== 'random')
    ? (config as any).forcedWinner
    : ((config as any)?.manualForceTarget && (config as any).manualForceTarget !== 'random')
    ? (config as any).manualForceTarget
    : null;

  let targetSide: DragonTigerSide;
  const isManualForce = !!forcedTarget;

  if (isManualForce) {
    targetSide = forcedTarget as DragonTigerSide;
  } else {
    const totalPool = totalBetsDragon + totalBetsTiger + totalBetsTie + totalBetsSuitedTie;
    if (totalPool > 0) {
      // 🛡️ UNCONDITIONAL 100% HOUSE PROTECTION: House NEVER suffers net loss
      // Calculates payout liability with 0-second latency.
      // Side with HIGHER liability LOSES! Side with LOWER liability WINS!
      const dragonMult = config.dragonMultiplier || 2.0;
      const tigerMult = config.tigerMultiplier || 2.0;
      const dragonPayout = totalBetsDragon * dragonMult;
      const tigerPayout = totalBetsTiger * tigerMult;

      if (dragonPayout > tigerPayout || (totalBetsDragon > 0 && totalBetsTiger === 0)) {
        targetSide = 'tiger'; // House defends against Dragon bet by landing Tiger
      } else if (tigerPayout > dragonPayout || (totalBetsTiger > 0 && totalBetsDragon === 0)) {
        targetSide = 'dragon'; // House defends against Tiger bet by landing Dragon
      } else if (totalBetsTie > 0 || totalBetsSuitedTie > 0) {
        // User bet on Tie/Suited Tie -> House delivers Dragon or Tiger (NEVER Tie!)
        targetSide = getBalancedNormalDragonTigerWinner(roundIndex);
      } else {
        targetSide = getBalancedNormalDragonTigerWinner(roundIndex);
      }
    } else {
      // 🎲 Normal balanced play with anti-streak (never > 2 in a row of the same winner)
      targetSide = getBalancedNormalDragonTigerWinner(roundIndex);
    }
  }

  return craftDragonTigerCardsForOutcome(targetSide, deck, rand);
}

/**
 * Calculate user payout for a Dragon Tiger bet
 * Payout rules:
 * 1) DRAGON: If winningSide === 'dragon', payout = bet.amount * 2.0 (Strictly 2x return of bet, 0 on loss / no refund)
 * 2) TIGER: If winningSide === 'tiger', payout = bet.amount * 2.0 (Strictly 2x return of bet, 0 on loss / no refund)
 * 3) TIE: If winningSide is 'tie' or 'suited_tie', payout = bet.amount * tieMultiplier (0 on loss)
 * 4) SUITED TIE: If winningSide === 'suited_tie' or isSuitedTie is true, payout = bet.amount * suitedTieMultiplier (0 on loss)
 * 5) STRICT ZERO REFUND: Non-winning sides receive 0 payout. No refunds, no partial returns, no balance credits.
 */
export function calculateDragonTigerPayout(
  bet: { side: DragonTigerSide; amount: number },
  winningSide: DragonTigerSide,
  isSuitedTie: boolean,
  config: DragonTigerConfig
): { wonAmount: number; status: 'won' | 'lost'; netProfit: number } {
  // If no bet amount was placed, immediately return zero
  if (!bet || bet.amount <= 0) {
    return { wonAmount: 0, status: 'lost', netProfit: 0 };
  }

  const isTieOutcome = winningSide === 'tie' || winningSide === 'suited_tie';

  // 1. Dragon Bet Win -> Only when winningSide is strictly 'dragon'
  if (bet.side === 'dragon') {
    if (winningSide === 'dragon') {
      const mult = config?.dragonMultiplier || 2.0;
      const wonAmount = Math.round(bet.amount * mult);
      return { wonAmount, status: 'won', netProfit: wonAmount - bet.amount };
    }
    // Losing Dragon bet: strictly 0 payout, no refund
    return { wonAmount: 0, status: 'lost', netProfit: -bet.amount };
  }

  // 2. Tiger Bet Win -> Only when winningSide is strictly 'tiger'
  if (bet.side === 'tiger') {
    if (winningSide === 'tiger') {
      const mult = config?.tigerMultiplier || 2.0;
      const wonAmount = Math.round(bet.amount * mult);
      return { wonAmount, status: 'won', netProfit: wonAmount - bet.amount };
    }
    // Losing Tiger bet: strictly 0 payout, no refund
    return { wonAmount: 0, status: 'lost', netProfit: -bet.amount };
  }

  // 3. Regular Tie Bet Win -> When winningSide is 'tie' or 'suited_tie'
  if (bet.side === 'tie') {
    if (isTieOutcome) {
      const mult = config?.tieMultiplier || 12.0;
      const wonAmount = Math.round(bet.amount * mult);
      return { wonAmount, status: 'won', netProfit: wonAmount - bet.amount };
    }
    return { wonAmount: 0, status: 'lost', netProfit: -bet.amount };
  }

  // 4. Suited Tie Bet Win -> When isSuitedTie is true or winningSide is 'suited_tie'
  if (bet.side === 'suited_tie') {
    if (isSuitedTie || winningSide === 'suited_tie') {
      const mult = config?.suitedTieMultiplier || 51.0;
      const wonAmount = Math.round(bet.amount * mult);
      return { wonAmount, status: 'won', netProfit: wonAmount - bet.amount };
    }
    return { wonAmount: 0, status: 'lost', netProfit: -bet.amount };
  }

  // Default fallback: 0 payout on loss
  return {
    wonAmount: 0,
    status: 'lost',
    netProfit: -bet.amount,
  };
}

/**
 * State to prevent repeated/stuttered speech synthesis
 */
let lastSpokenText: string = '';
let lastSpokenTime: number = 0;

/**
 * Natural Live Dealer Speech Synthesis with Language Support & Anti-Stutter Protection
 */
export function playDealerSpeech(
  text: string, 
  isMuted: boolean = false, 
  lang: DragonTigerLang = 'en'
) {
  if (isMuted || !text || typeof window === 'undefined') return;

  const now = Date.now();
  const cleanKey = text.trim().toLowerCase();

  // Prevent duplicate trigger if same phrase called within 2.5 seconds
  if (cleanKey === lastSpokenText && now - lastSpokenTime < 2500) {
    return;
  }

  try {
    // Clean text for speech synthesis (strip markdown and emojis)
    const cleanSpeechText = text
      .replace(/[#*`_~]/g, '')
      .replace(/[🐉🐯⚡🎴✈️👑🤝✨🎲🏆❌⚠️]/g, '')
      .replace(/₹\s*([0-9,]+)/g, lang === 'bn' ? '$1 টাকা' : lang === 'hi' ? '$1 रुपये' : '$1 rupees')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpeechText) return;

    lastSpokenText = cleanKey;
    lastSpokenTime = now;

    // 1. Android Native Bridge Support if running inside native Android WebView
    const win = window as any;
    if (win.AndroidBridge && typeof win.AndroidBridge.speakText === 'function') {
      win.AndroidBridge.speakText(cleanSpeechText, lang === 'bn' ? 'bn' : lang === 'hi' ? 'hi' : 'en');
      return;
    }
    if (win.Android && typeof win.Android.speak === 'function') {
      win.Android.speak(cleanSpeechText);
      return;
    }

    if (!('speechSynthesis' in window)) return;

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);

    // Set utterance language code
    if (lang === 'bn') {
      utterance.lang = 'bn-IN';
      utterance.rate = 0.95; // Calm, clear natural pace
      utterance.pitch = 1.05;
    } else if (lang === 'hi') {
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
    } else {
      utterance.lang = 'en-US';
      utterance.rate = 0.98;
      utterance.pitch = 1.08;
    }
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      if (lang === 'bn') {
        const bnVoice = voices.find(v => v.lang.startsWith('bn') || v.lang.includes('BN'));
        if (bnVoice) utterance.voice = bnVoice;
      } else if (lang === 'hi') {
        const hiVoice = voices.find(v => v.lang.startsWith('hi') || v.lang.includes('HI') || v.name.includes('Hindi') || v.name.includes('Kalpana') || v.name.includes('Lekha'));
        if (hiVoice) utterance.voice = hiVoice;
      } else {
        // English voice preference
        const enFemaleVoice = voices.find(v => 
          (v.lang.startsWith('en') || v.lang.includes('EN')) && 
          (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Zira') || v.name.includes('Karen') || v.name.includes('Google UK English Female') || v.name.includes('Google US English') || v.name.includes('Natural'))
        );
        if (enFemaleVoice) {
          utterance.voice = enFemaleVoice;
        } else {
          const enVoice = voices.find(v => v.lang.startsWith('en'));
          if (enVoice) utterance.voice = enVoice;
        }
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (_) {}
}

/**
 * 32-bit MurmurHash3 string/number seed hasher for Dragon Tiger
 */
export function hashSeedDT(seed: string | number): number {
  let h = 0x811c9dc5;
  const str = String(seed || 'dt_seed');
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 15), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Mulberry32 PRNG generator seeded deterministically for Dragon Tiger
 */
export function createRoundPRNGDT(seed: string | number): () => number {
  let s = hashSeedDT(seed);
  return function nextFloat(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const UNIVERSAL_DT_CYCLE_MS = 20000;
export const UNIVERSAL_DT_BETTING_MS = 12000;
export const UNIVERSAL_DT_DEALING_MS = 4000;
export const UNIVERSAL_DT_RESULT_MS = 4000;

export interface SyncedDragonTigerRoundOutcome {
  roundIndex: number;
  roundId: string;
  dragonCard: PlayingCard;
  tigerCard: PlayingCard;
  winningSide: DragonTigerSide;
  isSuitedTie: boolean;
  tablePoolDragon: number;
  tablePoolTiger: number;
  tablePoolTie: number;
  tablePoolSuitedTie: number;
  dragonBettors: number;
  tigerBettors: number;
  tieBettors: number;
}

/**
 * Deterministically generates the exact round outcome for a given round index across all devices.
 * Implements 0-second latency unconditional house edge whenever real bets are placed,
 * and pure balanced 50/50 anti-streak dealing (maximum 2 in a row) when no bets are placed.
 */
export function getSyncedDragonTigerRoundOutcome(
  roundIndex: number,
  config?: DragonTigerConfig
): SyncedDragonTigerRoundOutcome {
  const rng = createRoundPRNGDT(`dt_round_v4_${roundIndex}`);
  const d = new Date(roundIndex * UNIVERSAL_DT_CYCLE_MS);
  const roundId = `DT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(roundIndex % 100000).padStart(5, '0')}`;

  // Deterministically create and shuffle full standard 52-card deck
  const baseDeck = createDeck();
  const deck = [...baseDeck];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Simulated live pool amounts based on round seed - Symmetric and naturally balanced
  const basePool = Math.floor(40000 + rng() * 60000);
  const poolDiff = Math.floor(rng() * 10000) - 5000;
  const tablePoolDragon = basePool + poolDiff + Math.floor(rng() * 100) / 100;
  const tablePoolTiger = basePool - poolDiff + Math.floor(rng() * 100) / 100;
  const tablePoolTie = Math.floor(8000 + rng() * 15000);
  const tablePoolSuitedTie = Math.floor(2000 + rng() * 6000);
  const dragonBettors = Math.floor(80 + rng() * 80);
  const tigerBettors = Math.floor(80 + rng() * 80);
  const tieBettors = Math.floor(15 + rng() * 20);

  // Real user stakes from live aggregation or realUserBets
  const realDragonBets = (config?.realUserBets?.dragon ?? config?.liveBetsDragon) || 0;
  const realTigerBets = (config?.realUserBets?.tiger ?? config?.liveBetsTiger) || 0;
  const realTieBets = (config?.realUserBets?.tie ?? config?.liveBetsTie) || 0;
  const realSuitedTieBets = (config?.realUserBets?.suitedTie ?? config?.liveBetsSuitedTie) || 0;
  const totalRealBets = realDragonBets + realTigerBets + realTieBets + realSuitedTieBets;

  const isManualActive = Boolean((config as any)?.isManualOverride);
  const forcedTarget = (config?.manualForceWinner && config.manualForceWinner !== 'random')
    ? config.manualForceWinner
    : ((config as any)?.forcedWinner && (config as any).forcedWinner !== 'random')
    ? (config as any).forcedWinner
    : ((config as any)?.manualForceTarget && (config as any).manualForceTarget !== 'random')
    ? (config as any).manualForceTarget
    : null;

  const isRoundMatched = !(config as any)?.targetRoundId || (config as any).targetRoundId === roundId;
  const isManualForce = isManualActive && !!forcedTarget && isRoundMatched;
  let targetSide: DragonTigerSide;

  if (isManualForce) {
    targetSide = forcedTarget as DragonTigerSide;
  } else if ((config as any)?.autoLowRiskWinner && (config as any).autoLowRiskWinner !== 'random' && isRoundMatched) {
    targetSide = (config as any).autoLowRiskWinner as DragonTigerSide;
  } else if ((config as any)?.manualForceWinner && (config as any).manualForceWinner !== 'random' && isRoundMatched) {
    targetSide = (config as any).manualForceWinner as DragonTigerSide;
  } else if (totalRealBets > 0) {
    // 🛡️ UNCONDITIONAL 100% HOUSE PROTECTION:
    // Calculates payout liability with 0-second latency across all players.
    // The side with HIGHER liability LOSES! The side with LOWER liability (or 0) WINS!
    const dragonMultiplier = config?.dragonMultiplier || 2.0;
    const tigerMultiplier = config?.tigerMultiplier || 2.0;
    const dragonPayout = realDragonBets * dragonMultiplier;
    const tigerPayout = realTigerBets * tigerMultiplier;

    if (dragonPayout > tigerPayout || (realDragonBets > 0 && realTigerBets === 0)) {
      targetSide = 'tiger'; // House defends against Dragon bet by delivering Tiger win
    } else if (tigerPayout > dragonPayout || (realTigerBets > 0 && realDragonBets === 0)) {
      targetSide = 'dragon'; // House defends against Tiger bet by delivering Dragon win
    } else if (realTieBets > 0 || realSuitedTieBets > 0) {
      // User bet on Tie/Suited Tie -> House delivers Dragon or Tiger (NEVER Tie!)
      targetSide = getBalancedNormalDragonTigerWinner(roundIndex);
    } else {
      // Equal bets on Dragon and Tiger -> alternate using balanced anti-streak
      targetSide = getBalancedNormalDragonTigerWinner(roundIndex);
    }
  } else {
    // 🎲 NO BETS PLACED: PURE BALANCED NORMAL ANTI-STREAK (MAX 2 CONSECUTIVE WINS)
    targetSide = getBalancedNormalDragonTigerWinner(roundIndex);
  }

  // Handle manual specific ranks if specified by admin
  const manualDragonRank = config?.manualDragonRank && config.manualDragonRank !== 'random' ? config.manualDragonRank : null;
  const manualTigerRank = config?.manualTigerRank && config.manualTigerRank !== 'random' ? config.manualTigerRank : null;
  let dealtCards: { dragonCard: PlayingCard; tigerCard: PlayingCard; winningSide: DragonTigerSide; isSuitedTie: boolean };

  if (manualDragonRank && manualTigerRank) {
    const dCard = deck.find((c) => c.rank === manualDragonRank) || deck[0];
    const availableForTiger = deck.filter((c) => c.id !== dCard.id);
    const tCard = availableForTiger.find((c) => c.rank === manualTigerRank) || availableForTiger[0];
    const res = determineDragonTigerWinner(dCard, tCard);
    dealtCards = { dragonCard: dCard, tigerCard: tCard, winningSide: res.winner, isSuitedTie: res.isSuitedTie };
  } else {
    dealtCards = craftDragonTigerCardsForOutcome(targetSide, deck, rng);
  }

  return {
    roundIndex,
    roundId,
    dragonCard: dealtCards.dragonCard,
    tigerCard: dealtCards.tigerCard,
    winningSide: dealtCards.winningSide,
    isSuitedTie: dealtCards.isSuitedTie,
    tablePoolDragon,
    tablePoolTiger,
    tablePoolTie,
    tablePoolSuitedTie,
    dragonBettors,
    tigerBettors,
    tieBettors,
  };
}

export interface UniversalDragonTigerTimeState {
  roundIndex: number;
  roundDetails: SyncedDragonTigerRoundOutcome;
  phase: 'betting' | 'dealing' | 'completed';
  countdown: number;
  elapsedInPhaseMs: number;
  cycleElapsedMs: number;
  isDragonRevealed: boolean;
  isTigerRevealed: boolean;
  roundStartTimeMs: number;
  roundEndTimeMs: number;
}

/**
 * 24x7 Global Continuous Clock for Dragon Tiger.
 * Synchronizes Round ID, Phase, Countdown, and Exact Cards across ALL clients worldwide with 0 latency.
 */
export function getUniversalDragonTigerTimeState(timestamp: number = Date.now(), config?: DragonTigerConfig): UniversalDragonTigerTimeState {
  const TOTAL_CYCLE = UNIVERSAL_DT_CYCLE_MS;
  const BETTING_DUR = UNIVERSAL_DT_BETTING_MS;
  const DEALING_DUR = UNIVERSAL_DT_DEALING_MS;

  const roundIndex = Math.floor(timestamp / TOTAL_CYCLE);
  const roundStartTimeMs = roundIndex * TOTAL_CYCLE;
  const roundEndTimeMs = roundStartTimeMs + TOTAL_CYCLE;
  const cycleElapsedMs = Math.max(0, timestamp - roundStartTimeMs);

  const roundDetails = getSyncedDragonTigerRoundOutcome(roundIndex, config);

  let phase: 'betting' | 'dealing' | 'completed' = 'betting';
  let countdown = 0;
  let elapsedInPhaseMs = 0;
  let isDragonRevealed = false;
  let isTigerRevealed = false;

  if (cycleElapsedMs < BETTING_DUR) {
    phase = 'betting';
    countdown = Math.max(1, Math.ceil((BETTING_DUR - cycleElapsedMs) / 1000));
    elapsedInPhaseMs = cycleElapsedMs;
    isDragonRevealed = false;
    isTigerRevealed = false;
  } else if (cycleElapsedMs < BETTING_DUR + DEALING_DUR) {
    phase = 'dealing';
    countdown = 0;
    elapsedInPhaseMs = cycleElapsedMs - BETTING_DUR;
    // Dragon card revealed at 0-2000ms; Tiger card revealed at 2000-4000ms
    isDragonRevealed = elapsedInPhaseMs >= 1500;
    isTigerRevealed = elapsedInPhaseMs >= 3200;
  } else {
    phase = 'completed';
    countdown = 0;
    elapsedInPhaseMs = cycleElapsedMs - (BETTING_DUR + DEALING_DUR);
    isDragonRevealed = true;
    isTigerRevealed = true;
  }

  return {
    roundIndex,
    roundDetails,
    phase,
    countdown,
    elapsedInPhaseMs,
    cycleElapsedMs,
    isDragonRevealed,
    isTigerRevealed,
    roundStartTimeMs,
    roundEndTimeMs,
  };
}

/**
 * Returns deterministic bead road / previous round history for Dragon Tiger
 */
export function getSyncedDragonTigerBeadRoad(currentRoundIndex: number, count: number = 40): {
  id: string;
  winner: DragonTigerSide;
  isSuitedTie?: boolean;
  dragonRank: CardRank;
  dragonSuit: string;
  tigerRank: CardRank;
  tigerSuit: string;
}[] {
  const history: {
    id: string;
    winner: DragonTigerSide;
    isSuitedTie?: boolean;
    dragonRank: CardRank;
    dragonSuit: string;
    tigerRank: CardRank;
    tigerSuit: string;
  }[] = [];

  for (let i = 1; i <= count; i++) {
    const pastIdx = currentRoundIndex - i;
    if (pastIdx < 0) break;
    const outcome = getSyncedDragonTigerRoundOutcome(pastIdx);
    history.push({
      id: outcome.roundId,
      winner: outcome.winningSide,
      isSuitedTie: outcome.isSuitedTie,
      dragonRank: outcome.dragonCard.rank,
      dragonSuit: outcome.dragonCard.suit,
      tigerRank: outcome.tigerCard.rank,
      tigerSuit: outcome.tigerCard.suit,
    });
  }

  return history;
}

