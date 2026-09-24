import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, X, Volume2, VolumeX, Sparkles, RefreshCw, Trophy, 
  RotateCcw, Zap, DollarSign, ChevronRight, ShieldCheck, Play, HelpCircle,
  History, BarChart2, CheckCircle2, Eye, LayoutGrid, Radio, Bookmark,
  Globe, Video, Tv, AlertTriangle, Lock
} from 'lucide-react';
import { User, WalletTransaction, RouletteConfig } from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { sortChronologicalNewestFirst } from '../utils/supercar';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, query, collection, limit, deleteDoc, getDocs } from 'firebase/firestore';
import { triggerConfetti } from '../utils/confetti';
import { DealerVideoStage } from './DealerVideoStage';
import { CinematicRoulettePopup } from './CinematicRoulettePopup';
import { LightningStrikeStorm } from './LightningStrikeStorm';
import { 
  calculateAllNumbersLiability, 
  RouletteLiveBetItem, 
  getSyncedLightningMultipliers, 
  LightningMultiplier, 
  getUniversalRouletteTimeState, 
  getSyncedRoundDeterministicWinNumber, 
  createRoundPRNG, 
  UNIVERSAL_SPINNING_DURATION_MS, 
  UNIVERSAL_ROULETTE_CYCLE_MS,
  getContinuous24x7History,
  getDeterministicRoundOutcome,
  SyncedRoundResultItem
} from '../utils/rouletteRiskEngine';
import { trackUserPresence, logLiveActivity } from '../utils/activityTracker';

import dealerSpinImg from '../assets/images/roulette_dealer_spin_1787484865156.jpg';
import dealerWelcomeImg from '../assets/images/roulette_dealer_welcome_1787484882512.jpg';
import dealerResultImg from '../assets/images/roulette_dealer_result_1787484902160.jpg';

interface LiveRouletteProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
  onBigWin?: (data: any) => void;
}

export interface RoundHistoryItem {
  id: string;
  roundId: string;
  number: number;
  color: 'green' | 'red' | 'black';
  parity: 'even' | 'odd' | 'zero';
  range: '1-18' | '19-36' | 'zero';
  dozen: '1st 12' | '2nd 12' | '3rd 12' | 'zero';
  column: 'Col 1' | 'Col 2' | 'Col 3' | 'zero';
  multiplier?: number;
  timestamp: string;
}

export interface UserBetHistoryItem {
  id: string;
  timestamp: string;
  dateKey: string;
  gameName: string;
  betAmount: number;
  resultAmount: number;
  roundId: string;
  winningNumber?: number;
  multiplier?: number;
}

// European Roulette Numbers in Wheel Order
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

const CHIP_VALUES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000];

const getChipGradient = (val: number) => {
  if (val <= 20) return 'from-teal-600 via-emerald-600 to-teal-700 border-teal-300 text-white';
  if (val <= 50) return 'from-sky-600 via-blue-600 to-indigo-700 border-sky-300 text-white';
  if (val <= 100) return 'from-amber-400 via-yellow-400 to-amber-500 border-yellow-100 text-slate-950 font-black';
  if (val <= 200) return 'from-fuchsia-600 via-pink-600 to-purple-700 border-pink-300 text-white';
  if (val <= 500) return 'from-purple-600 via-indigo-600 to-violet-800 border-purple-300 text-white';
  if (val <= 1000) return 'from-rose-600 via-red-600 to-rose-700 border-rose-300 text-white';
  if (val <= 2000) return 'from-cyan-600 via-teal-600 to-blue-700 border-cyan-300 text-white';
  if (val <= 5000) return 'from-emerald-500 via-green-600 to-teal-700 border-emerald-300 text-white';
  if (val <= 10000) return 'from-amber-500 via-orange-600 to-red-700 border-amber-300 text-white';
  if (val <= 50000) return 'from-violet-700 via-purple-800 to-slate-900 border-purple-300 text-yellow-300';
  return 'from-yellow-400 via-amber-300 to-yellow-600 border-white text-slate-950 font-black';
};

const formatChipNumber = (val: number) => {
  if (val >= 100000) return `₹${val / 100000}L`;
  if (val >= 1000) return `₹${val / 1000}k`;
  return `₹${val}`;
};

type BetType = 
  | { kind: 'number'; value: number }
  | { kind: 'color'; value: 'red' | 'black' }
  | { kind: 'parity'; value: 'even' | 'odd' }
  | { kind: 'range'; value: '1-18' | '19-36' }
  | { kind: 'dozen'; value: '1st12' | '2nd12' | '3rd12' }
  | { kind: 'column'; value: 'col1' | 'col2' | 'col3' };

interface PlacedBet {
  id: string;
  type: BetType;
  label: string;
  amount: number;
}

export const LiveRoulette: React.FC<LiveRouletteProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit,
  onBigWin
}) => {
  const initialTime = getUniversalRouletteTimeState(Date.now());
  const [selectedChip, setSelectedChip] = useState<number>(20);
  const [showChipPicker, setShowChipPicker] = useState<boolean>(false);
  const [customChipAmount, setCustomChipAmount] = useState<string>('');
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedBet[]>([]);
  const [gamePhase, setGamePhase] = useState<'betting' | 'lightning' | 'spinning' | 'settled'>(initialTime.phase);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [isResultRevealed, setIsResultRevealed] = useState<boolean>(initialTime.phase === 'settled');
  const [userWonAmount, setUserWonAmount] = useState<number>(0);
  const [isLightningStormActive, setIsLightningStormActive] = useState<boolean>(initialTime.phase === 'lightning');
  const [restrictionToast, setRestrictionToast] = useState<string | null>(null);

  // Auto-dismiss restriction toast
  useEffect(() => {
    if (restrictionToast) {
      const timer = setTimeout(() => {
        setRestrictionToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [restrictionToast]);
  
  // Continuous 24/7 Results Tape at top (Zero old/stale results on mount)
  const [recentHistory, setRecentHistory] = useState<{ number: number; multiplier?: number; roundId?: string }[]>(() => {
    const list = getContinuous24x7History(20, undefined, Date.now());
    return list.map(item => ({
      number: item.winningNumber,
      multiplier: item.multiplier && item.multiplier > 30 ? item.multiplier : undefined,
      roundId: item.roundId
    }));
  });

  const [fullHistory, setFullHistory] = useState<RoundHistoryItem[]>(() => {
    const list = getContinuous24x7History(30, undefined, Date.now());
    return list.map(item => {
      const num = item.winningNumber;
      return {
        id: item.roundId,
        roundId: item.roundId,
        number: num,
        color: item.color,
        parity: num === 0 ? 'zero' : num % 2 === 0 ? 'even' : 'odd',
        range: num === 0 ? 'zero' : num <= 18 ? '1-18' : '19-36',
        dozen: num === 0 ? 'zero' : num <= 12 ? '1st 12' : num <= 24 ? '2nd 12' : '3rd 12',
        column: num === 0 ? 'zero' : num % 3 === 1 ? 'Col 1' : num % 3 === 2 ? 'Col 2' : 'Col 3',
        multiplier: item.multiplier && item.multiplier > 36 ? item.multiplier : undefined,
        timestamp: new Date(item.settledAt).toLocaleTimeString('en-GB')
      };
    });
  });

  // User Bet History Drawer
  const [showGameHistory, setShowGameHistory] = useState<boolean>(false);
  const [userBetHistory, setUserBetHistory] = useState<UserBetHistoryItem[]>(() => {
    try {
      const cached = localStorage.getItem(`bg_roulette_history_${user.id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return [];
  });

  const [showHistoryOverlay, setShowHistoryOverlay] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [roundId, setRoundId] = useState<string>(initialTime.roundId);
  const [countdown, setCountdown] = useState<number>(initialTime.countdown);
  const [betsLocked, setBetsLocked] = useState<boolean>(initialTime.phase !== 'betting');
  const [dealerMessage, setDealerMessage] = useState<string>('Saanvi: Namaste! Welcome to Hindi Lightning Roulette!');

  // Multilingual Voice & Studio Video View States
  const [voiceLanguage, setVoiceLanguage] = useState<'bn' | 'hi' | 'en'>(() => {
    return (localStorage.getItem('bg_roulette_voice_lang') as 'bn' | 'hi' | 'en') || 'bn';
  });
  const [showLangPicker, setShowLangPicker] = useState<boolean>(false);
  const [useLiveVideoView, setUseLiveVideoView] = useState<boolean>(() => {
    return localStorage.getItem('bg_roulette_video_mode') !== 'false';
  });

  // Wheel Animation States
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [ballAngle, setBallAngle] = useState<number>(0);
  const [ballRadius, setBallRadius] = useState<number>(100);
  const [lightningNumbers, setLightningNumbers] = useState<LightningMultiplier[]>(() => {
    return getSyncedLightningMultipliers(initialTime.roundId);
  });

  // Real-time Roulette Configuration from Admin
  const [rouletteConfig, setRouletteConfig] = useState<RouletteConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_roulette_config');
      if (cached) {
        return {
          rtpPercentage: 97.3,
          houseEdgePercentage: 2.7,
          rtpMode: 'european_standard',
          manualNextNumber: 16,
          manualNextNumberActive: false,
          minBet: 20,
          maxBet: 10000000,
          isRouletteEnabled: true,
          preventOppositeBets: true,
          ...JSON.parse(cached)
        };
      }
    } catch (e) {}
    return {
      rtpPercentage: 97.3,
      houseEdgePercentage: 2.7,
      rtpMode: 'european_standard',
      manualNextNumber: 16,
      manualNextNumberActive: false,
      minBet: 20,
      maxBet: 10000000,
      isRouletteEnabled: true,
      preventOppositeBets: true
    };
  });
  const rouletteConfigRef = useRef<RouletteConfig>(rouletteConfig);
  rouletteConfigRef.current = rouletteConfig;

  // Real-time live round state synced with Admin Dashboard
  const liveRoundStateRef = useRef<{
    roundId?: string;
    targetRoundId?: string;
    isManualOverride?: boolean;
    manualWinningNumber?: number | null;
    predeterminedWinningNumber?: number | null;
    recommendedLowRiskNumber?: number | null;
    isAutoLowRiskEnabled?: boolean;
    lightningNumbers?: LightningMultiplier[];
    manualLightningNumbers?: LightningMultiplier[] | null;
    isManualLightningOverride?: boolean;
  }>({});

  useEffect(() => {
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'roulette'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setRouletteConfig((prev) => {
          const next: RouletteConfig = {
            ...prev,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpMode: data.rtpMode === 'fair_rng' ? 'european_standard' : data.rtpMode === 'house_protect' ? 'house_protection' : (data.rtpMode || prev.rtpMode),
            isRouletteEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isRouletteEnabled,
            preventOppositeBets: data.preventOppositeBets !== undefined ? data.preventOppositeBets : (prev.preventOppositeBets !== undefined ? prev.preventOppositeBets : true),
            minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
          };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }, (err) => console.warn('LiveRoulette game_settings sync error:', err.message));

    const unsub = onSnapshot(doc(db, 'roulette_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RouletteConfig>;
        setRouletteConfig((prev) => {
          const next = { ...prev, ...data };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }, (err) => console.warn('LiveRoulette config sync error:', err.message));

    // Listen to real-time live round state for manual admin overrides
    const unsubLiveRound = onSnapshot(doc(db, 'roulette_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        liveRoundStateRef.current = data;
      }
    }, (err) => console.warn('LiveRoulette live round listener error:', err.message));

    // Real-time synced roulette rounds stream from Firestore (0 sec latency sync with Admin Panel)
    const qRounds = query(collection(db, 'roulette_rounds'), limit(30));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const firestoreMap = new Map<string, any>();
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.roundId) {
            firestoreMap.set(data.roundId, data);
          }
        });
      }
      const combined = getContinuous24x7History(20, firestoreMap, Date.now());
      setRecentHistory(combined.map(item => ({
        number: item.winningNumber,
        multiplier: item.multiplier && item.multiplier > 36 ? item.multiplier : undefined,
        roundId: item.roundId
      })));
      setFullHistory(combined.map(item => {
        const num = item.winningNumber;
        return {
          id: item.roundId,
          roundId: item.roundId,
          number: num,
          color: item.color,
          parity: num === 0 ? 'zero' : num % 2 === 0 ? 'even' : 'odd',
          range: num === 0 ? 'zero' : num <= 18 ? '1-18' : '19-36',
          dozen: num === 0 ? 'zero' : num <= 12 ? '1st 12' : num <= 24 ? '2nd 12' : '3rd 12',
          column: num === 0 ? 'zero' : num % 3 === 1 ? 'Col 1' : num % 3 === 2 ? 'Col 2' : 'Col 3',
          multiplier: item.multiplier && item.multiplier > 36 ? item.multiplier : undefined,
          timestamp: new Date(item.settledAt).toLocaleTimeString('en-GB')
        };
      }));
    }, (err) => console.warn('LiveRoulette rounds sync error:', err.message));

    // Real-time user history listener
    let unsubHistory: (() => void) | undefined;
    if (user?.id) {
      const qHist = query(collection(db, 'users', user.id, 'roulette_history'), limit(50));
      unsubHistory = onSnapshot(qHist, (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserBetHistoryItem));
          list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
          setUserBetHistory(list);
        }
      }, () => {});
    }

    return () => {
      unsubGameSettings();
      unsub();
      unsubLiveRound();
      unsubRounds();
      if (unsubHistory) unsubHistory();
    };
  }, [user?.id]);

  const totalBetAmount = bets.reduce((sum, b) => sum + b.amount, 0);

  const betsRef = useRef<PlacedBet[]>([]);
  betsRef.current = bets;

  const userBalanceRef = useRef<number>(user.balance);
  userBalanceRef.current = user.balance;

  const activeSpeechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Multilingual Voice Announcement (Bengali, Hindi, English) with resilient fallback for Web and Android
  const announceVoice = (
    texts: { bn: string; hi: string; en: string },
    onFinish?: () => void
  ) => {
    if (isMuted) {
      if (onFinish) onFinish();
      return;
    }
    try {
      soundFx.unlockAudio();

      const lang = voiceLanguage;
      const textToSpeak = texts[lang] || texts.bn || texts.hi;

      // 1. Android Native Bridge Support if running inside native Android wrapper
      const win = window as any;
      if (win.AndroidBridge && typeof win.AndroidBridge.speakText === 'function') {
        win.AndroidBridge.speakText(textToSpeak, lang === 'bn' ? 'bn' : lang === 'hi' ? 'hi' : 'en');
        if (onFinish) onFinish();
        return;
      }
      if (win.Android && typeof win.Android.speak === 'function') {
        win.Android.speak(textToSpeak);
        if (onFinish) onFinish();
        return;
      }

      // 2. Web Speech Synthesis with resume() for Android Chrome/WebView
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 0.94;
        utterance.pitch = 1.05;
        
        const voices = window.speechSynthesis.getVoices();
        if (lang === 'bn') {
          utterance.lang = 'bn-IN';
          const bnVoice = voices.find(v => v.lang.includes('bn') || v.name.includes('Bangla') || v.name.includes('Bengali'));
          if (bnVoice) utterance.voice = bnVoice;
        } else if (lang === 'hi') {
          utterance.lang = 'hi-IN';
          const hiVoice = voices.find(v => v.lang.includes('hi') || v.name.includes('Hindi') || v.lang.includes('en-IN'));
          if (hiVoice) utterance.voice = hiVoice;
        } else {
          utterance.lang = 'en-US';
          const enVoice = voices.find(v => v.lang.includes('en') || v.name.includes('Female'));
          if (enVoice) utterance.voice = enVoice;
        }

        utterance.onend = () => {
          activeSpeechUtteranceRef.current = null;
          if (onFinish) onFinish();
        };
        utterance.onerror = () => {
          activeSpeechUtteranceRef.current = null;
          if (onFinish) onFinish();
        };

        activeSpeechUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        if (onFinish) onFinish();
      }
    } catch (e) {
      console.warn('Speech synthesis error', e);
      if (onFinish) onFinish();
    }
  };

  // Backward-compatible alias for existing calls
  const announceHindiVoice = (text: string, onFinish?: () => void) => {
    announceVoice({ bn: text, hi: text, en: text }, onFinish);
  };

  const roundIdRef = useRef<string>(initialTime.roundId);
  roundIdRef.current = roundId;

  const gamePhaseRef = useRef<'betting' | 'lightning' | 'spinning' | 'settled'>(gamePhase);
  gamePhaseRef.current = gamePhase;

  const deductedBetsRoundsRef = useRef<Set<string>>(new Set());
  const settledRoundsRef = useRef<Set<string>>(new Set());
  const resolvedWinNumbersRef = useRef<Map<string, number>>(new Map());
  const spinAnimationFrameRef = useRef<number | null>(null);

  // Synchronized Win Number Resolver (Deterministic 24x7 + Admin Overrides + Auto Low-Risk RTP Protection)
  const getResolvedWinNumber = (roundIndex: number, targetRoundId: string): number => {
    const liveRound = liveRoundStateRef.current;
    const currentCfg = rouletteConfigRef.current;

    // 1. High Priority: Admin Explicit Manual Override for this Round
    const isManualActive = Boolean(
      (liveRound?.isManualOverride && typeof liveRound?.manualWinningNumber === 'number' && liveRound.manualWinningNumber >= 0 && liveRound.manualWinningNumber <= 36 && (!liveRound?.targetRoundId || liveRound.targetRoundId === targetRoundId)) ||
      (currentCfg?.manualNextNumberActive && typeof currentCfg?.manualNextNumber === 'number' && currentCfg.manualNextNumber >= 0 && currentCfg.manualNextNumber <= 36 && (!(currentCfg as any)?.manualTargetRoundId || (currentCfg as any).manualTargetRoundId === targetRoundId))
    );

    if (isManualActive) {
      if (liveRound?.isManualOverride && typeof liveRound?.manualWinningNumber === 'number' && liveRound.manualWinningNumber >= 0 && liveRound.manualWinningNumber <= 36 && (!liveRound?.targetRoundId || liveRound.targetRoundId === targetRoundId)) {
        return liveRound.manualWinningNumber;
      }
      if (currentCfg?.manualNextNumberActive && typeof currentCfg?.manualNextNumber === 'number' && currentCfg.manualNextNumber >= 0 && currentCfg.manualNextNumber <= 36 && (!(currentCfg as any)?.manualTargetRoundId || (currentCfg as any).manualTargetRoundId === targetRoundId)) {
        return currentCfg.manualNextNumber;
      }
    }

    // Determine current lightning numbers for this round
    const currentLightningList: LightningMultiplier[] = (
      liveRound?.manualLightningNumbers && liveRound.manualLightningNumbers.length > 0
        ? liveRound.manualLightningNumbers
        : (lightningNumbers && lightningNumbers.length > 0
            ? lightningNumbers
            : getSyncedLightningMultipliers(targetRoundId || roundIndex))
    );
    const lightningNumSet = new Set<number>(currentLightningList.map(l => l.number));

    const placedBets = betsRef.current || [];
    const isUserBetting = placedBets.length > 0;

    // 2. Server Synced Predetermined or Recommended Low-Risk Pocket for this round
    // CRITICAL: When user is betting, never pick a lightning number!
    if (
      !isUserBetting &&
      liveRound && 
      liveRound.roundId === targetRoundId &&
      typeof liveRound.predeterminedWinningNumber === 'number' &&
      liveRound.predeterminedWinningNumber >= 0 &&
      liveRound.predeterminedWinningNumber <= 36
    ) {
      return liveRound.predeterminedWinningNumber;
    }

    if (
      !isUserBetting &&
      liveRound &&
      liveRound.roundId === targetRoundId &&
      typeof liveRound.recommendedLowRiskNumber === 'number' &&
      liveRound.recommendedLowRiskNumber >= 0 &&
      liveRound.recommendedLowRiskNumber <= 36 &&
      liveRound.isAutoLowRiskEnabled !== false
    ) {
      return liveRound.recommendedLowRiskNumber;
    }

    // 3. Autonomous 24x7 Auto Low-Risk & RTP House Edge Protection Engine
    const liveBetItems: RouletteLiveBetItem[] = placedBets.map(b => {
      const mult = b.type.kind === 'number' ? 30 : b.type.kind === 'dozen' || b.type.kind === 'column' ? 3 : 2;
      return {
        id: b.id,
        roundId: targetRoundId || 'HLR-LIVE',
        userId: user.id || 'player',
        userName: user.name || 'Player',
        userEmail: user.email || '',
        betType: b.type,
        label: b.label,
        amount: b.amount,
        potentialWin: b.amount * mult,
        timestamp: new Date().toISOString()
      };
    });

    const liability = calculateAllNumbersLiability(
      liveBetItems, 
      targetRoundId || roundIndex,
      { lightningNumbers: Array.from(lightningNumSet) }
    );

    // 0-second latency House Edge Protection:
    // When real bets are active, house picks lowest liability pocket guaranteeing house profit AND strictly excluding lightning numbers
    if (isUserBetting || liability.totalPot > 0) {
      let chosenNum = liability.lowestRiskNumber;
      if (lightningNumSet.has(chosenNum)) {
        const safeNonLightning = liability.numberSummaries
          .filter(s => !lightningNumSet.has(s.number))
          .sort((a, b) => b.netHouseProfit - a.netHouseProfit);
        chosenNum = safeNonLightning[0]?.number ?? (chosenNum === 0 ? 1 : 0);
      }
      return chosenNum;
    }

    // When no bets are placed, natural deterministic round outcome
    return getSyncedRoundDeterministicWinNumber(targetRoundId || roundIndex);
  };

  // Phase Controller: Lightning Phase Start
  const handleLightningPhaseStart = (targetRoundId: string, roundIndex: number) => {
    const lockMsg = voiceLanguage === 'bn'
      ? 'সানভী: বাজি নেওয়া বন্ধ! লাকি লাইটনিং নম্বর আসছে!'
      : voiceLanguage === 'hi'
      ? 'সান्वी: बेट्स बंद हो चुके हैं! बिजली गिरने वाली है!'
      : 'Saanvi: Bets are now closed! Lucky lightning numbers are striking!';
    setDealerMessage(lockMsg);

    announceVoice({
      bn: 'বাজি বন্ধ হয়েছে! লাইটনিং নম্বর স্ট্রাইক করছে!',
      hi: 'बेट्स बंद हो चुके हैं! बिजली गिरने वाली है!',
      en: 'Bets are closed! Lightning numbers striking now!'
    });

    soundFx.playSpinWhoosh();
    soundFx.playClick();

    // Deduct user bets from balance once per round
    if (!deductedBetsRoundsRef.current.has(targetRoundId)) {
      deductedBetsRoundsRef.current.add(targetRoundId);
      const currentPlacedBets = [...betsRef.current];
      const betTotal = currentPlacedBets.reduce((s, b) => s + b.amount, 0);

      if (betTotal > 0) {
        logAnalyticsEvent('game_start', { gameType: 'roulette', roundId: targetRoundId, betTotal, betCount: currentPlacedBets.length }, user.id, user.email);
        const newBal = Math.max(0, userBalanceRef.current - betTotal);
        userBalanceRef.current = newBal;
        onUpdateBalance(newBal);

        const spotsList = currentPlacedBets.map(b => `${b.label}: ₹${b.amount}`);
        const formattedDesc = `Placed ₹${betTotal.toLocaleString('en-IN')} on Hindi Lightning Roulette #${targetRoundId} [${spotsList.join(', ')}]`;

        const betsBreakdown = currentPlacedBets.map(b => {
          let spotName = b.label;
          if (b.type.kind === 'number') spotName = `⚡ Number ${b.type.value}`;
          else if (b.type.kind === 'color') spotName = b.type.value === 'red' ? '🔴 Red (লাল)' : '⚫ Black (কালো)';
          else if (b.type.kind === 'parity') spotName = b.type.value === 'even' ? '⚖️ Even (জোড়)' : '🎲 Odd (বিজোড়)';
          else if (b.type.kind === 'range') spotName = b.type.value === '1-18' ? '📉 Low 1-18' : '📈 High 19-36';
          else if (b.type.kind === 'dozen') spotName = b.type.value === '1st12' ? '1️⃣ 1st Dozen (1-12)' : b.type.value === '2nd12' ? '2️⃣ 2nd Dozen (13-24)' : '3️⃣ 3rd Dozen (25-36)';
          else if (b.type.kind === 'column') spotName = b.type.value === 'col1' ? '📊 1st Column' : b.type.value === 'col2' ? '📊 2nd Column' : '📊 3rd Column';

          return {
            spot: spotName,
            type: b.type.kind,
            detail: String(b.type.value),
            amount: b.amount,
            isWin: false,
            multiplier: b.type.kind === 'number' ? '30x - 500x' : b.type.kind === 'dozen' || b.type.kind === 'column' ? '3x' : '2x',
            payout: 0,
            outcomeProof: 'Round in progress'
          };
        });

        onAddTransaction({
          id: `TX-BET-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: user.id,
          userEmail: (user.email || '').toLowerCase().trim(),
          type: 'roulette_bet',
          amount: -betTotal,
          description: formattedDesc,
          roundId: targetRoundId,
          gameType: 'roulette',
          betsBreakdown,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        });
        setLastBets(currentPlacedBets);
      }
    }

    // Check if admin has explicitly configured manual lightning multipliers
    const currentLive = liveRoundStateRef.current;
    const currentCfg = rouletteConfigRef.current;
    const isManualLucky = Boolean(
      (currentLive?.isManualLightningOverride || currentCfg?.isManualLightningOverride) &&
      ((currentLive?.manualLightningNumbers && currentLive.manualLightningNumbers.length > 0) ||
       (currentCfg?.manualLightningNumbers && currentCfg.manualLightningNumbers.length > 0))
    );
    const manualLucky = currentLive?.manualLightningNumbers || currentCfg?.manualLightningNumbers;
    
    // In normal mode: ALWAYS generate fresh, non-repeating synced lucky numbers for this exact targetRoundId
    const lucky: LightningMultiplier[] = (isManualLucky && manualLucky && manualLucky.length > 0)
      ? manualLucky
      : getSyncedLightningMultipliers(targetRoundId);

    setLightningNumbers(lucky);
    setIsLightningStormActive(true);
  };

  // Phase Controller: Spinning Phase Start
  const handleSpinningPhaseStart = (targetRoundId: string, roundIndex: number, phaseElapsedMs: number) => {
    const spinMsg = voiceLanguage === 'bn'
      ? 'সানভী: বল ঘুরছে হুইলে, দেখা যাক কোন নম্বর জয়ী হয়...'
      : voiceLanguage === 'hi'
      ? 'सान्वी: गेंद घूम रही है, देखते हैं कौन सा नंबर आता है...'
      : 'Saanvi: Ball is spinning on the wheel, let us see the winning number...';
    setDealerMessage(spinMsg);

    // 1. Resolve Target Winning Number
    let targetWinNum: number;
    if (resolvedWinNumbersRef.current.has(targetRoundId)) {
      targetWinNum = resolvedWinNumbersRef.current.get(targetRoundId)!;
    } else {
      targetWinNum = getResolvedWinNumber(roundIndex, targetRoundId);
      resolvedWinNumbersRef.current.set(targetRoundId, targetWinNum);
    }

    // 2. Animate Wheel and Ball towards target pocket
    const targetPocketIndex = WHEEL_NUMBERS.indexOf(targetWinNum);
    const pocketDeg = 360 / 37;
    const targetPocketAngleOnWheel = targetPocketIndex * pocketDeg + (pocketDeg / 2);

    const extraRotations = 5;
    const targetWheelRotation = wheelRotation + (360 * extraRotations) + (360 - (targetPocketAngleOnWheel % 360));

    const totalSpinDuration = UNIVERSAL_SPINNING_DURATION_MS;
    const initialElapsed = Math.min(phaseElapsedMs, totalSpinDuration - 100);
    const startTime = performance.now() - initialElapsed;
    const startWheelRot = wheelRotation;
    let bounceCount = 0;

    if (spinAnimationFrameRef.current) {
      cancelAnimationFrame(spinAnimationFrameRef.current);
    }

    const animateFrame = (now: number) => {
      if (gamePhaseRef.current !== 'spinning' && gamePhaseRef.current !== 'settled') return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalSpinDuration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentWheelRot = startWheelRot + (targetWheelRotation - startWheelRot) * easeOut;
      setWheelRotation(currentWheelRot);

      const ballSpins = 7 * (1 - easeOut);
      const currentBallAngle = (currentWheelRot + targetPocketAngleOnWheel + (ballSpins * 360)) % 360;
      setBallAngle(currentBallAngle);

      if (progress > 0.65) {
        const dropP = (progress - 0.65) / 0.35;
        const smoothDrop = Math.pow(dropP, 2);
        const bounce = Math.abs(Math.sin(dropP * Math.PI * 3.5)) * (1 - dropP) * 12;
        setBallRadius(115 - (25 * smoothDrop) + bounce);

        const currentBounce = Math.floor(dropP * 3.5);
        if (currentBounce > bounceCount) {
          bounceCount = currentBounce;
          soundFx.playBallClick();
        }
      } else {
        setBallRadius(115);
      }

      if (progress < 1) {
        spinAnimationFrameRef.current = requestAnimationFrame(animateFrame);
      } else {
        setBallRadius(90);
        setWinningNumber(targetWinNum);
        soundFx.playCoin();
      }
    };

    spinAnimationFrameRef.current = requestAnimationFrame(animateFrame);
  };

  // Phase Controller: Settled Phase Start
  const handleSettledPhaseStart = (targetRoundId: string, roundIndex: number) => {
    let targetWinNum = resolvedWinNumbersRef.current.get(targetRoundId);
    if (typeof targetWinNum !== 'number') {
      targetWinNum = getResolvedWinNumber(roundIndex, targetRoundId);
      resolvedWinNumbersRef.current.set(targetRoundId, targetWinNum);
    }

    setWinningNumber(targetWinNum);
    setIsResultRevealed(true);

    if (!settledRoundsRef.current.has(targetRoundId)) {
      settledRoundsRef.current.add(targetRoundId);
      const currentPlacedBets = [...betsRef.current];
      const betTotal = currentPlacedBets.reduce((s, b) => s + b.amount, 0);
      handleRoundSettlement(targetWinNum, currentPlacedBets, userBalanceRef.current, betTotal, targetRoundId);
    }
  };

  // Universal 24x7 Synchronized Game Clock Loop (All users worldwide run synchronously)
  useEffect(() => {
    let isMounted = true;
    let animFrameId: number | null = null;
    let lastTickMs = 0;

    const tick = () => {
      if (!isMounted) return;
      const now = Date.now();

      if (now - lastTickMs >= 100) {
        lastTickMs = now;
        const timeState = getUniversalRouletteTimeState(now);

        // 1. Round Change Detection
        if (timeState.roundId !== roundIdRef.current) {
          roundIdRef.current = timeState.roundId;
          setRoundId(timeState.roundId);
          setBets([]);
          setUserWonAmount(0);
          setWinningNumber(null);
          setIsResultRevealed(false);
          setBetsLocked(timeState.phase !== 'betting');
          setLightningNumbers([]);

          // Announce welcome for new round if in betting phase
          if (timeState.phase === 'betting') {
            const userName = user.name || 'Player';
            const msg = voiceLanguage === 'bn' 
              ? `সানভী: নমস্কার ${userName}! আপনার বাজি ধরুন, কাউন্টডাউন শুরু হয়ে গেছে!`
              : voiceLanguage === 'hi'
              ? `सान्वी: नमस्ते ${userName}! अपने बेट्स लगाएं, समय शुरू हो चुका है!`
              : `Saanvi: Welcome ${userName}! Place your bets, countdown has started!`;
            
            setDealerMessage(msg);
            announceVoice({
              bn: `নমস্কার ${userName}! আপনার বাজি ধরুন, সময় শুরু হয়েছে!`,
              hi: `नमस्ते ${userName}! अपने बेट्स लगाएं, समय शुरू हो चुका है!`,
              en: `Welcome ${userName}! Please place your bets now!`
            });
          }

          // Clean up past round live bets from Firestore so collection remains lightweight
          try {
            getDocs(collection(db, 'roulette_live_bets')).then((snap) => {
              snap.forEach((d) => {
                const item = d.data();
                if (item.roundId && item.roundId !== timeState.roundId) {
                  deleteDoc(doc(db, 'roulette_live_bets', d.id)).catch(() => {});
                }
              });
            }).catch(() => {});
          } catch (_) {}
        }

        // 2. Countdown sync
        setCountdown(timeState.countdown);
        if (timeState.phase === 'betting' && timeState.countdown <= 5 && timeState.countdown > 0) {
          // Play tick on boundary
          if (now % 1000 < 120) {
            soundFx.playCountdownTick();
          }
        }

        // 3. Phase Transition Detection
        if (timeState.phase !== gamePhaseRef.current) {
          gamePhaseRef.current = timeState.phase;
          setGamePhase(timeState.phase);

          if (timeState.phase === 'lightning') {
            setBetsLocked(true);
            handleLightningPhaseStart(timeState.roundId, timeState.roundIndex);
          } else if (timeState.phase === 'spinning') {
            setBetsLocked(true);
            handleSpinningPhaseStart(timeState.roundId, timeState.roundIndex, timeState.phaseElapsedMs);
          } else if (timeState.phase === 'settled') {
            setBetsLocked(true);
            handleSettledPhaseStart(timeState.roundId, timeState.roundIndex);
          } else if (timeState.phase === 'betting') {
            setBetsLocked(false);
          }
        }
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (spinAnimationFrameRef.current) cancelAnimationFrame(spinAnimationFrameRef.current);
    };
  }, [voiceLanguage, user.name]);

  const handleRoundSettlement = (
    targetWinNum: number, 
    currentPlacedBets: PlacedBet[], 
    currentBal: number, 
    betTotal: number,
    targetRoundId: string
  ) => {
    setIsResultRevealed(true);
    setGamePhase('settled');

    const color = getNumberColor(targetWinNum);
    const parity = targetWinNum === 0 ? 'zero' : (targetWinNum % 2 === 0 ? 'even' : 'odd');
    const range = targetWinNum === 0 ? 'zero' : (targetWinNum <= 18 ? '1-18' : '19-36');
    const dozen = targetWinNum === 0 ? 'zero' : (targetWinNum <= 12 ? '1st 12' : targetWinNum <= 24 ? '2nd 12' : '3rd 12');
    const column = targetWinNum === 0 ? 'zero' : (targetWinNum % 3 === 1 ? 'Col 1' : targetWinNum % 3 === 2 ? 'Col 2' : 'Col 3');

    const luckyHit = lightningNumbers.find(l => l.number === targetWinNum);
    const multiplier = luckyHit ? luckyHit.multiplier : undefined;

    // Update recent history
    setRecentHistory(prev => [{ number: targetWinNum, multiplier }, ...prev].slice(0, 14));
    const newHistItem: RoundHistoryItem = {
      id: `rh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roundId: targetRoundId,
      number: targetWinNum,
      color,
      parity,
      range,
      dozen,
      column,
      multiplier,
      timestamp: new Date().toLocaleTimeString('en-IN')
    };
    setFullHistory(prev => [newHistItem, ...prev.slice(0, 19)]);

    // Evaluate user winnings
    let totalWin = 0;
    const isEven = targetWinNum !== 0 && targetWinNum % 2 === 0;
    const isOdd = targetWinNum !== 0 && targetWinNum % 2 !== 0;
    const straightMultiplier = luckyHit ? luckyHit.multiplier : 30;

    const resolvedBetsBreakdown = currentPlacedBets.map((bet) => {
      let spotName = bet.label;
      if (bet.type.kind === 'number') spotName = `⚡ Number ${bet.type.value}`;
      else if (bet.type.kind === 'color') spotName = bet.type.value === 'red' ? '🔴 Red (লাল)' : '⚫ Black (কালো)';
      else if (bet.type.kind === 'parity') spotName = bet.type.value === 'even' ? '⚖️ Even (জোড়)' : '🎲 Odd (বিজোড়)';
      else if (bet.type.kind === 'range') spotName = bet.type.value === '1-18' ? '📉 Low 1-18' : '📈 High 19-36';
      else if (bet.type.kind === 'dozen') spotName = bet.type.value === '1st12' ? '1️⃣ 1st Dozen (1-12)' : bet.type.value === '2nd12' ? '2️⃣ 2nd Dozen (13-24)' : '3️⃣ 3rd Dozen (25-36)';
      else if (bet.type.kind === 'column') spotName = bet.type.value === 'col1' ? '📊 1st Column' : bet.type.value === 'col2' ? '📊 2nd Column' : '📊 3rd Column';

      let isWin = false;
      let spotMultiplier = '0x';
      let spotPayout = 0;

      if (bet.type.kind === 'number' && bet.type.value === targetWinNum) {
        isWin = true;
        spotMultiplier = luckyHit ? `⚡ ${luckyHit.multiplier}x (Lightning)` : '30x';
        spotPayout = bet.amount * straightMultiplier;
      } else if (bet.type.kind === 'color' && bet.type.value === color) {
        isWin = true;
        spotMultiplier = '2x (1:1)';
        spotPayout = bet.amount * 2;
      } else if (bet.type.kind === 'parity') {
        if ((bet.type.value === 'even' && isEven) || (bet.type.value === 'odd' && isOdd)) {
          isWin = true;
          spotMultiplier = '2x (1:1)';
          spotPayout = bet.amount * 2;
        }
      } else if (bet.type.kind === 'range') {
        if (
          (bet.type.value === '1-18' && targetWinNum >= 1 && targetWinNum <= 18) ||
          (bet.type.value === '19-36' && targetWinNum >= 19 && targetWinNum <= 36)
        ) {
          isWin = true;
          spotMultiplier = '2x (1:1)';
          spotPayout = bet.amount * 2;
        }
      } else if (bet.type.kind === 'dozen') {
        if (
          (bet.type.value === '1st12' && targetWinNum >= 1 && targetWinNum <= 12) ||
          (bet.type.value === '2nd12' && targetWinNum >= 13 && targetWinNum <= 24) ||
          (bet.type.value === '3rd12' && targetWinNum >= 25 && targetWinNum <= 36)
        ) {
          isWin = true;
          spotMultiplier = '3x (2:1)';
          spotPayout = bet.amount * 3;
        }
      } else if (bet.type.kind === 'column') {
        if (
          (bet.type.value === 'col1' && targetWinNum > 0 && targetWinNum % 3 === 1) ||
          (bet.type.value === 'col2' && targetWinNum > 0 && targetWinNum % 3 === 2) ||
          (bet.type.value === 'col3' && targetWinNum > 0 && targetWinNum % 3 === 0)
        ) {
          isWin = true;
          spotMultiplier = '3x (2:1)';
          spotPayout = bet.amount * 3;
        }
      }

      if (isWin) {
        totalWin += spotPayout;
      }

      return {
        spot: spotName,
        type: bet.type.kind,
        detail: String(bet.type.value),
        amount: bet.amount,
        isWin,
        multiplier: spotMultiplier,
        payout: spotPayout,
        outcomeProof: isWin ? `Won ₹${spotPayout.toLocaleString('en-IN')}` : `Lost (Pocket ${targetWinNum} ${color.toUpperCase()})`
      };
    });

    setUserWonAmount(totalWin);

    // Save to Firestore with full financial metrics for admin history & charts
    try {
      setDoc(doc(db, 'roulette_rounds', targetRoundId), {
        roundId: targetRoundId,
        winningNumber: targetWinNum,
        color,
        parity,
        range,
        dozen,
        column,
        lightningNumbers,
        multiplier: multiplier || 36,
        totalWagered: betTotal,
        totalPayout: totalWin,
        houseProfit: betTotal - totalWin,
        totalBets: currentPlacedBets.length,
        activeUsers: betTotal > 0 ? 1 : 0,
        settledAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // Mark live round state as settled and broadcast last result
      setDoc(doc(db, 'roulette_live_state', 'current_round'), {
        phase: 'settled',
        winningNumber: targetWinNum,
        roundId: targetRoundId,
        color,
        multiplier: multiplier || 36,
        lightningNumbers,
        lastSettledResult: {
          roundId: targetRoundId,
          winningNumber: targetWinNum,
          color,
          multiplier: multiplier || null,
          settledAt: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString('en-IN')
        },
        // Reset single-round manual override so subsequent rounds calculate dynamically
        isManualOverride: false,
        manualWinningNumber: null,
        manualNextNumber: null,
        manualNextNumberActive: false,
        predeterminedWinningNumber: null,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // Clear in config as well
      setDoc(doc(db, 'roulette_config', 'main'), {
        manualNextNumberActive: false,
        isManualOverride: false,
        manualWinningNumber: null,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // Guarantee game_settings reverts to Auto Low-Risk even if Admin is offline
      setDoc(doc(db, 'game_settings', 'roulette'), {
        manualNextNumberActive: false,
        manualForceWinner: null,
        manualWinningNumber: null,
        rtpMode: 'house_protect',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // Update status of live bets in liveBets collection
      currentPlacedBets.forEach(bet => {
        const betSpotKey = `RB_${targetRoundId}_${user.id}_${bet.type.kind}_${bet.type.value}`;
        const isWin = (bet.type.kind === 'number' && bet.type.value === targetWinNum) ||
                      (bet.type.kind === 'color' && bet.type.value === color) ||
                      (bet.type.kind === 'parity' && ((bet.type.value === 'even' && isEven) || (bet.type.value === 'odd' && isOdd))) ||
                      (bet.type.kind === 'range' && ((bet.type.value === '1-18' && targetWinNum >= 1 && targetWinNum <= 18) || (bet.type.value === '19-36' && targetWinNum >= 19 && targetWinNum <= 36))) ||
                      (bet.type.kind === 'dozen' && ((bet.type.value === '1st12' && targetWinNum >= 1 && targetWinNum <= 12) || (bet.type.value === '2nd12' && targetWinNum >= 13 && targetWinNum <= 24) || (bet.type.value === '3rd12' && targetWinNum >= 25 && targetWinNum <= 36))) ||
                      (bet.type.kind === 'column' && ((bet.type.value === 'col1' && targetWinNum > 0 && targetWinNum % 3 === 1) || (bet.type.value === 'col2' && targetWinNum > 0 && targetWinNum % 3 === 2) || (bet.type.value === 'col3' && targetWinNum > 0 && targetWinNum % 3 === 0)));

        setDoc(doc(db, 'liveBets', betSpotKey), {
          status: isWin ? 'win' : 'loss'
        }, { merge: true }).catch(() => {});
      });
    } catch (_) {}

    // Record User Bet History Entry
    if (betTotal > 0) {
      const today = new Date();
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const dateStr = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`;
      const timeStr = today.toTimeString().split(' ')[0];

      const resultAmt = totalWin > 0 ? totalWin : -betTotal;
      const newHistoryEntry: UserBetHistoryItem = {
        id: `BH-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        timestamp: timeStr,
        dateKey: dateStr,
        gameName: 'Hindi Lightning Roulette',
        betAmount: betTotal,
        resultAmount: resultAmt,
        roundId: targetRoundId,
        winningNumber: targetWinNum,
        multiplier
      };

      setUserBetHistory((prev) => {
        const updated = [newHistoryEntry, ...prev];
        try {
          localStorage.setItem(`bg_roulette_history_${user.id}`, JSON.stringify(updated.slice(0, 50)));
        } catch (_) {}
        return updated;
      });

      try {
        setDoc(doc(db, 'users', user.id, 'roulette_history', newHistoryEntry.id), newHistoryEntry, { merge: true }).catch(() => {});
      } catch (_) {}
    }

    // Complete Uninterrupted Spoken Announcement with User Name & Win Amount in Bengali / Hindi / English
    const colorBn = color === 'green' ? 'জিরো সবুজ' : color === 'red' ? 'লাল Red' : 'কালো Black';
    const parityBn = targetWinNum === 0 ? '' : (targetWinNum % 2 === 0 ? 'ইভেন জোড়' : 'অড বিজোড়');
    const rangeBn = targetWinNum === 0 ? '' : (targetWinNum <= 18 ? '১ থেকে ১৮ লো' : '১৯ থেকে ৩৬ হাই');
    const dozenBn = dozen === '1st 12' ? 'ফার্স্ট ডজন' : dozen === '2nd 12' ? 'সেকেন্ড ডজন' : dozen === '3rd 12' ? 'থার্ড ডজন' : '';
    const colBn = column === 'Col 1' ? 'ফার্স্ট কলাম' : column === 'Col 2' ? 'সেকেন্ড কলাম' : column === 'Col 3' ? 'থার্ড কলাম' : '';
    const multBn = luckyHit ? `, এবং লাইটনিং মাল্টিপ্লায়ার ${luckyHit.multiplier}x!` : '!';

    const colorHindi = color === 'green' ? 'Zero Hara' : color === 'red' ? 'Laal Red' : 'Kaala Black';
    const parityHindi = targetWinNum === 0 ? '' : (targetWinNum % 2 === 0 ? 'Even' : 'Odd');
    const rangeHindi = targetWinNum === 0 ? '' : (targetWinNum <= 18 ? 'Low 1 se 18' : 'High 19 se 36');
    const dozenHindi = dozen === '1st 12' ? 'First Dozen' : dozen === '2nd 12' ? 'Second Dozen' : dozen === '3rd 12' ? 'Third Dozen' : '';
    const colHindi = column === 'Col 1' ? 'First Column' : column === 'Col 2' ? 'Second Column' : column === 'Col 3' ? 'Third Column' : '';
    const multHindi = luckyHit ? `, aur lightning multiplier ${luckyHit.multiplier}x!` : '!';

    const userName = user.name || 'Player';
    let speechBn = '';
    let speechHi = '';
    let speechEn = '';

    if (totalWin > 0) {
      soundFx.playCheer();
      soundFx.playWinFanfare();
      triggerConfetti({ particleCount: 120, spread: 100, origin: { y: 0.5 } });

      onBigWin?.({
        id: `roulette-win-${Date.now()}`,
        category: 'roulette',
        title: `হিন্দি লাইটনিং রুলেট জয়ী!`,
        subtitle: `LIGHTNING ROULETTE (${targetWinNum} ${color.toUpperCase()})`,
        amount: totalWin,
        multiplier: luckyHit ? `${luckyHit.multiplier}x` : '30x',
        rouletteNumber: targetWinNum,
        rouletteColor: color as 'red' | 'black' | 'green',
        drawOrRoundId: targetRoundId
      });

      onUpdateBalance(currentBal + totalWin);
      const spotsWonList = resolvedBetsBreakdown.filter(b => b.isWin).map(b => `${b.spot}: ₹${b.amount} (Payout: ₹${b.payout})`);
      const spotsLostList = resolvedBetsBreakdown.filter(b => !b.isWin).map(b => `${b.spot}: ₹${b.amount}`);
      const spotsWonDesc = spotsWonList.length > 0 ? ` [Won on: ${spotsWonList.join(', ')}]` : '';
      const spotsLostDesc = spotsLostList.length > 0 ? ` [Lost on: ${spotsLostList.join(', ')}]` : '';

      onAddTransaction({
        id: `TX-WIN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: user.id,
        userEmail: (user.email || '').toLowerCase().trim(),
        type: 'roulette_win',
        amount: totalWin,
        description: `Won ₹${totalWin.toLocaleString('en-IN')} on Hindi Lightning Roulette #${targetRoundId} (Number ${targetWinNum} ${color.toUpperCase()})${spotsWonDesc}${spotsLostDesc}`,
        roundId: targetRoundId,
        gameType: 'roulette',
        winningOutcome: `Number ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}, ${range}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}`,
        betsBreakdown: resolvedBetsBreakdown,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString()
      });

      const displayMsg = voiceLanguage === 'bn'
        ? `সানভী: জয়ী নম্বর ${targetWinNum} (${colorBn}, ${parityBn}, ${rangeBn}, ${dozenBn}, ${colBn}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}! অভিনন্দন ${userName}, আপনি ₹${totalWin.toLocaleString('en-IN')} জিতেছেন!`
        : voiceLanguage === 'hi'
        ? `सान्वी: Winning number ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}, ${range}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}! Badhai ho ${userName}, aapne ₹${totalWin.toLocaleString('en-IN')} jeete hain!`
        : `Saanvi: Winning number is ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}, ${range}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}! Congratulations ${userName}, you won ₹${totalWin.toLocaleString('en-IN')}!`;
      
      setDealerMessage(displayMsg);

      speechBn = `জয়ী নম্বর হচ্ছে ${targetWinNum}, ${colorBn}, ${parityBn}, ${rangeBn}, ${dozenBn}, ${colBn}${multBn} অভিনন্দন ${userName}! আপনি ${totalWin} টাকা জিতেছেন!`;
      speechHi = `Winning number hai ${targetWinNum}, ${colorHindi}, ${parityHindi}, ${rangeHindi}, ${dozenHindi}, ${colHindi}${multHindi} Badhai ho ${userName}! Aapne ${totalWin} rupaye jeete hain!`;
      speechEn = `Winning number is ${targetWinNum}, ${color}, ${parity}, ${range}, ${dozen}, ${column}${luckyHit ? `, with ${luckyHit.multiplier}x multiplier` : ''}! Congratulations ${userName}! You have won ${totalWin} rupees!`;
    } else {
      const displayMsg = voiceLanguage === 'bn'
        ? `সানভী: জয়ী নম্বর ${targetWinNum} (${colorBn}, ${parityBn}, ${rangeBn}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}। পরবর্তী রাউন্ডের জন্য প্রস্তুত হন!`
        : voiceLanguage === 'hi'
        ? `सान्वी: Winning number ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}, ${range}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}. Agle round ke liye tayyar ho jayein!`
        : `Saanvi: Winning number is ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}). Get ready for the next round!`;
      
      setDealerMessage(displayMsg);

      speechBn = `জয়ী নম্বর হচ্ছে ${targetWinNum}, ${colorBn}, ${parityBn}, ${rangeBn}, ${dozenBn}, ${colBn}${multBn} পরবর্তী রাউন্ডের জন্য প্রস্তুত হন!`;
      speechHi = `Winning number hai ${targetWinNum}, ${colorHindi}, ${parityHindi}, ${rangeHindi}, ${dozenHindi}, ${colHindi}${multHindi} Agle round ke liye tayyar ho jayein!`;
      speechEn = `Winning number is ${targetWinNum}, ${color}, ${parity}, ${range}, ${dozen}, ${column}! Get ready for the next round!`;
    }

    announceVoice({
      bn: speechBn,
      hi: speechHi,
      en: speechEn
    });
  };

  const getNumberColor = (num: number): 'green' | 'red' | 'black' => {
    if (num === 0) return 'green';
    return RED_NUMBERS.has(num) ? 'red' : 'black';
  };

  const handlePlaceBet = (type: BetType, label: string) => {
    if (gamePhase !== 'betting' || betsLocked) {
      soundFx.playClick();
      return;
    }

    // Strict Opposite Bet Restrictions (Red vs Black, Even vs Odd, 1-18 vs 19-36)
    if (rouletteConfig.preventOppositeBets !== false) {
      if (type.kind === 'color') {
        const oppositeColor = type.value === 'red' ? 'black' : 'red';
        const hasOpposite = bets.some(b => b.type.kind === 'color' && b.type.value === oppositeColor && b.amount > 0);
        if (hasOpposite) {
          soundFx.playError();
          setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: লাল (Red) এবং কালো (Black) একসাথে বাজি ধরা যাবে না!');
          return;
        }
      } else if (type.kind === 'parity') {
        const oppositeParity = type.value === 'even' ? 'odd' : 'even';
        const hasOpposite = bets.some(b => b.type.kind === 'parity' && b.type.value === oppositeParity && b.amount > 0);
        if (hasOpposite) {
          soundFx.playError();
          setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: জোড় (Even) এবং বিজোড় (Odd) একসাথে বাজি ধরা যাবে না!');
          return;
        }
      } else if (type.kind === 'range') {
        const oppositeRange = type.value === '1-18' ? '19-36' : '1-18';
        const hasOpposite = bets.some(b => b.type.kind === 'range' && b.type.value === oppositeRange && b.amount > 0);
        if (hasOpposite) {
          soundFx.playError();
          setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: ১-১৮ (Low) এবং ১৯-৩৬ (High) একসাথে বাজি ধরা যাবে না!');
          return;
        }
      } else if (type.kind === 'column') {
        const otherColsWithBets = bets.filter(b => b.type.kind === 'column' && b.type.value !== type.value && b.amount > 0);
        const alreadyHasThisCol = bets.some(b => b.type.kind === 'column' && b.type.value === type.value && b.amount > 0);
        if (!alreadyHasThisCol && otherColsWithBets.length >= 2) {
          soundFx.playError();
          setRestrictionToast('⚠️ কলাম বাজি নিষিদ্ধ: ১ম, ২য় ও ৩য় কলাম তিনটি একসাথে বাজি ধরা যাবে না! সর্বোচ্চ যেকোনো ২টি কলামে বাজি ধরতে পারবেন।');
          return;
        }
      } else if (type.kind === 'dozen') {
        const otherDozensWithBets = bets.filter(b => b.type.kind === 'dozen' && b.type.value !== type.value && b.amount > 0);
        const alreadyHasThisDozen = bets.some(b => b.type.kind === 'dozen' && b.type.value === type.value && b.amount > 0);
        if (!alreadyHasThisDozen && otherDozensWithBets.length >= 2) {
          soundFx.playError();
          setRestrictionToast('⚠️ ডজন বাজি নিষিদ্ধ: ১ম, ২য় ও ৩য় ডজন (Tier) তিনটি একসাথে বাজি ধরা যাবে না! সর্বোচ্চ যেকোনো ২টি ডজনে বাজি ধরতে পারবেন।');
          return;
        }
      }
    }

    if (rouletteConfig.isRouletteEnabled === false) {
      alert('The Live Roulette table is currently undergoing scheduled maintenance. Please try again shortly.');
      return;
    }

    const effectiveMinBet = Math.max(20, rouletteConfig.minBet || 20);
    if (selectedChip < effectiveMinBet) {
      soundFx.playError();
      alert(`Minimum bet per spot is ₹${effectiveMinBet}.`);
      return;
    }

    if (totalBetAmount + selectedChip > (rouletteConfig.maxBet || 10000000)) {
      alert(`Maximum bet limit per round is ₹${(rouletteConfig.maxBet || 10000000).toLocaleString('en-IN')}.`);
      return;
    }

    if (user.balance < totalBetAmount + selectedChip) {
      soundFx.playClick();
      alert('Insufficient wallet balance! Please deposit funds to place this bet.');
      return;
    }

    soundFx.playCoin();

    const existingIndex = bets.findIndex(b => JSON.stringify(b.type) === JSON.stringify(type));
    let finalAmount = selectedChip;
    if (existingIndex >= 0) {
      const updated = [...bets];
      updated[existingIndex].amount += selectedChip;
      finalAmount = updated[existingIndex].amount;
      setBets(updated);
    } else {
      const newBet: PlacedBet = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        label,
        amount: selectedChip
      };
      setBets([...bets, newBet]);
    }

    // Immediately write to Firestore roulette_live_bets for real-time admin monitoring
    try {
      const betSpotKey = `RB_${roundId}_${user.id}_${type.kind}_${type.value}`;
      const potentialMult = type.kind === 'number' ? 30 : type.kind === 'dozen' || type.kind === 'column' ? 3 : 2;
      
      setDoc(doc(db, 'roulette_live_bets', betSpotKey), {
        id: betSpotKey,
        roundId,
        userId: user.id,
        userName: user.name || 'Player',
        userEmail: (user.email || '').toLowerCase().trim(),
        betType: type,
        label,
        amount: finalAmount,
        potentialWin: finalAmount * potentialMult,
        placedAt: Date.now(),
        timestamp: new Date().toLocaleTimeString('en-IN')
      }, { merge: true }).catch(() => {});

      // Also record to system-wide liveBets stream collection
      setDoc(doc(db, 'liveBets', betSpotKey), {
        id: betSpotKey,
        userId: user.id,
        userName: user.name || 'Player',
        userEmail: (user.email || '').toLowerCase().trim(),
        game: 'roulette',
        gameName: 'Hindi Lightning Roulette',
        gameIcon: '⚡',
        betDetails: `${label} (₹${finalAmount})`,
        amount: finalAmount,
        potentialWin: finalAmount * potentialMult,
        status: 'placed',
        time: new Date().toLocaleTimeString('en-IN'),
        createdAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // Fire real-time activity log for Admin Live Radar sound alert siren
      trackUserPresence(user, 'Hindi Lightning Roulette', 'betting').catch(() => {});
      logLiveActivity({
        userId: user.id,
        userName: user.name || 'Player',
        userEmail: user.email,
        userPhone: user.phone,
        type: 'bet',
        gameName: 'Hindi Lightning Roulette',
        betAmount: selectedChip,
        details: `Placed ₹${selectedChip} on ${label} (Round #${roundId})`
      }).catch(() => {});
    } catch (_) {}
  };

  const handleClearBets = () => {
    if (gamePhase !== 'betting' || betsLocked) return;
    soundFx.playClick();
    const currentBetsToRemove = [...bets];
    setBets([]);

    try {
      currentBetsToRemove.forEach((b) => {
        const betSpotKey = `RB_${roundId}_${user.id}_${b.type.kind}_${b.type.value}`;
        deleteDoc(doc(db, 'roulette_live_bets', betSpotKey)).catch(() => {});
        deleteDoc(doc(db, 'liveBets', betSpotKey)).catch(() => {});
      });
    } catch (_) {}
  };

  const handleDoubleBets = () => {
    if (gamePhase !== 'betting' || betsLocked || bets.length === 0) return;
    const currentTotal = totalBetAmount;
    if (user.balance < currentTotal * 2) {
      alert('Insufficient balance to double current bets!');
      return;
    }
    soundFx.playCoin();
    const doubled = bets.map(b => ({ ...b, amount: b.amount * 2 }));
    setBets(doubled);

    try {
      doubled.forEach((b) => {
        const betSpotKey = `RB_${roundId}_${user.id}_${b.type.kind}_${b.type.value}`;
        const potentialMult = b.type.kind === 'number' ? 30 : b.type.kind === 'dozen' || b.type.kind === 'column' ? 3 : 2;
        setDoc(doc(db, 'roulette_live_bets', betSpotKey), {
          amount: b.amount,
          potentialWin: b.amount * potentialMult,
          placedAt: Date.now(),
          timestamp: new Date().toLocaleTimeString('en-IN')
        }, { merge: true }).catch(() => {});
      });
    } catch (_) {}
  };

  const handleRepeatBets = () => {
    if (gamePhase !== 'betting' || betsLocked || lastBets.length === 0) return;
    const lastTotal = lastBets.reduce((sum, b) => sum + b.amount, 0);
    if (user.balance < lastTotal) {
      alert('Insufficient balance to repeat last bets!');
      return;
    }
    soundFx.playCoin();
    const repeated = [...lastBets];
    setBets(repeated);

    try {
      repeated.forEach((b) => {
        const betSpotKey = `RB_${roundId}_${user.id}_${b.type.kind}_${b.type.value}`;
        const potentialMult = b.type.kind === 'number' ? 30 : b.type.kind === 'dozen' || b.type.kind === 'column' ? 3 : 2;
        setDoc(doc(db, 'roulette_live_bets', betSpotKey), {
          id: betSpotKey,
          roundId,
          userId: user.id,
          userName: user.name || 'Player',
          userEmail: (user.email || '').toLowerCase().trim(),
          betType: b.type,
          label: b.label,
          amount: b.amount,
          potentialWin: b.amount * potentialMult,
          placedAt: Date.now(),
          timestamp: new Date().toLocaleTimeString('en-IN')
        }, { merge: true }).catch(() => {});
      });
    } catch (_) {}
  };

  const getBetAmountForSpot = (type: BetType) => {
    const bet = bets.find(b => JSON.stringify(b.type) === JSON.stringify(type));
    return bet ? bet.amount : 0;
  };

  const getSurroundingWheelNumbers = (target: number) => {
    const idx = WHEEL_NUMBERS.indexOf(target);
    if (idx === -1) return { prev: 24, current: 16, next: 33 };
    const prevIdx = (idx - 1 + WHEEL_NUMBERS.length) % WHEEL_NUMBERS.length;
    const nextIdx = (idx + 1) % WHEEL_NUMBERS.length;
    return {
      prev: WHEEL_NUMBERS[prevIdx],
      current: target,
      next: WHEEL_NUMBERS[nextIdx]
    };
  };

  const activeSurrounding = winningNumber !== null 
    ? getSurroundingWheelNumbers(winningNumber)
    : getSurroundingWheelNumbers(16);

  // Group User Bet History by Date (sorted newest dates first)
  const sortedUserBetHistory = sortChronologicalNewestFirst(userBetHistory);
  const groupedBetHistory = sortedUserBetHistory.reduce((acc, item) => {
    const group = acc.find(g => g.dateKey === item.dateKey);
    if (group) {
      group.items.push(item);
      group.totalBet += item.betAmount;
      group.totalResult += item.resultAmount;
    } else {
      acc.push({
        dateKey: item.dateKey,
        totalBet: item.betAmount,
        totalResult: item.resultAmount,
        items: [item]
      });
    }
    return acc;
  }, [] as { dateKey: string; totalBet: number; totalResult: number; items: UserBetHistoryItem[] }[]);

  return (
    <div className="fixed inset-0 z-50 bg-[#090b10] text-slate-100 flex flex-col h-[100dvh] max-h-screen overflow-hidden font-sans select-none">
      
      {/* RESTRICTION TOAST NOTIFICATION */}
      {restrictionToast && (
        <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-[1000] px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-rose-500/70 text-white text-xs font-mono font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-top-3 duration-200 max-w-sm text-center">
          <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <span className="flex-1 text-left text-[11px] leading-tight text-rose-200">
            {restrictionToast}
          </span>
          <button onClick={() => setRestrictionToast(null)} className="text-white/40 hover:text-white ml-1 p-0.5 rounded cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. TOP COMPACT HEADER (High-Visibility Balance & Clean Navigation) */}
      <div className="h-10 sm:h-11 bg-slate-950/95 border-b border-amber-500/30 px-2 sm:px-3 flex items-center justify-between shrink-0 z-30 font-mono">
        
        {/* Left: Back Button */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { soundFx.playClick(); onClose(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">Back</span>
          </button>
        </div>

        {/* Center: Prominent Gold User Balance Display & Direct Deposit */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-400/70 shadow-md">
            <span className="text-[9px] text-amber-400/90 font-bold uppercase tracking-wider">Balance:</span>
            <span className="text-xs sm:text-sm font-black text-amber-300 tracking-tight">
              ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-emerald-950 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5"
          >
            <span className="text-sm leading-none font-black">+</span>
            <span>Deposit</span>
          </button>
        </div>

        {/* Right: Language Selector, Game History Bookmark, Audio Mute, Stats */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Language Selector Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(prev => !prev)}
              className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/70 text-amber-300 hover:bg-amber-500/30 flex items-center gap-1 text-[10px] sm:text-xs font-bold cursor-pointer active:scale-95 shadow"
              title="Voice & Language"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>{voiceLanguage === 'bn' ? 'বাংলা' : voiceLanguage === 'hi' ? 'हिंदी' : 'ENG'}</span>
            </button>

            {showLangPicker && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-black/95 border border-amber-500/50 rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-1 backdrop-blur-md animate-in fade-in zoom-in-95">
                <span className="text-[8px] text-slate-400 uppercase tracking-wider px-1 font-bold">Voice Language</span>
                <button
                  onClick={() => {
                    setVoiceLanguage('bn');
                    localStorage.setItem('bg_roulette_voice_lang', 'bn');
                    setShowLangPicker(false);
                    soundFx.playClick();
                  }}
                  className={`px-2 py-1 rounded-lg text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                    voiceLanguage === 'bn' ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span>🇧🇩 বাংলা (BN)</span>
                  {voiceLanguage === 'bn' && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => {
                    setVoiceLanguage('hi');
                    localStorage.setItem('bg_roulette_voice_lang', 'hi');
                    setShowLangPicker(false);
                    soundFx.playClick();
                  }}
                  className={`px-2 py-1 rounded-lg text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                    voiceLanguage === 'hi' ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span>🇮🇳 हिंदी (HI)</span>
                  {voiceLanguage === 'hi' && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => {
                    setVoiceLanguage('en');
                    localStorage.setItem('bg_roulette_voice_lang', 'en');
                    setShowLangPicker(false);
                    soundFx.playClick();
                  }}
                  className={`px-2 py-1 rounded-lg text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                    voiceLanguage === 'en' ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span>🇬🇧 English (EN)</span>
                  {voiceLanguage === 'en' && <CheckCircle2 className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => { soundFx.playClick(); setShowGameHistory(true); }}
            className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-400 hover:bg-amber-500/40 flex items-center justify-center cursor-pointer shadow active:scale-95"
            title="My Bet History"
          >
            <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
          </button>

          <button
            onClick={() => setIsMuted(soundFx.toggleMute())}
            className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
            title="Mute / Unmute"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <button
            onClick={() => { soundFx.playClick(); setShowHistoryOverlay(true); }}
            className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 hover:text-amber-300 flex items-center justify-center cursor-pointer active:scale-95"
            title="Game Statistics"
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* 2. USER BET HISTORY STREAM STRIP */}
      <div className="h-6.5 bg-[#0b0e15] border-b border-amber-500/20 px-2 py-0.5 flex items-center justify-between gap-1 shrink-0 font-mono text-[9px]">
        <div className="flex items-center gap-1 shrink-0 pr-1.5 border-r border-slate-800">
          <History className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-[8px] font-bold text-amber-300 uppercase tracking-tight">My Bets</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 py-0.2">
          {userBetHistory.length === 0 ? (
            <span className="text-[8px] text-slate-400 italic">No bets placed yet</span>
          ) : (
            userBetHistory.slice(0, 10).map((b) => {
              const isWin = b.resultAmount > 0;
              return (
                <button
                  key={b.id}
                  onClick={() => { soundFx.playClick(); setShowGameHistory(true); }}
                  className={`shrink-0 px-1.5 py-0.2 rounded border text-[8px] flex items-center gap-1 cursor-pointer transition-all hover:scale-105 ${
                    isWin
                      ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                      : 'bg-slate-900/90 border-slate-700 text-slate-300'
                  }`}
                  title={`Round ${b.roundId} • Bet: ₹${b.betAmount} • Result: ${isWin ? `+₹${b.resultAmount}` : `-₹${Math.abs(b.resultAmount)}`}`}
                >
                  <span className="text-slate-400 text-[7px]">{b.timestamp.slice(0, 5)}</span>
                  <span>₹{b.betAmount}</span>
                  <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isWin ? `+₹${b.resultAmount}` : `-₹${Math.abs(b.resultAmount)}`}
                  </span>
                  {b.winningNumber !== undefined && (
                    <span className={`text-[7px] px-0.5 rounded font-black ${
                      getNumberColor(b.winningNumber) === 'red' ? 'bg-rose-900 text-rose-200' :
                      b.winningNumber === 0 ? 'bg-emerald-900 text-emerald-200' :
                      'bg-slate-800 text-slate-200'
                    }`}>
                      #{b.winningNumber}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={() => { soundFx.playClick(); setShowGameHistory(true); }}
          className="text-[8px] font-bold text-amber-400 hover:text-amber-300 shrink-0 pl-1 border-l border-slate-800 flex items-center gap-0.5 cursor-pointer"
        >
          <span>History</span>
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* 3. RECENT RESULTS STREAM TAPE */}
      <div className="h-6 bg-[#080a0f] border-b border-amber-500/20 px-2 py-0.5 flex items-center justify-between gap-1 overflow-x-auto shrink-0 font-mono select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          {recentHistory.map((item, idx) => {
            const col = getNumberColor(item.number);
            const isNewest = idx === 0;
            const hasMult = Boolean(item.multiplier && item.multiplier > 30);
            return (
              <div
                key={`${item.number}_${idx}`}
                className={`relative shrink-0 flex items-center justify-center font-bold text-[9px] sm:text-[10px] transition-all ${
                  hasMult
                    ? 'px-1.5 py-0.5 rounded bg-gradient-to-b from-amber-500 to-amber-700 border-2 border-amber-300 text-slate-950 font-black shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-lightning-blink'
                    : isNewest
                    ? 'w-4.5 h-4.5 rounded font-black ring-1 ring-amber-400 shadow-md'
                    : 'w-4.5 h-4.5 rounded opacity-90'
                } ${
                  hasMult ? '' :
                  col === 'green' ? 'bg-emerald-700 text-white' :
                  col === 'red' ? 'bg-rose-700 text-white' :
                  'bg-slate-950 border border-slate-800 text-white'
                }`}
              >
                <span>{item.number}</span>
                {hasMult && (
                  <span className="text-[7px] ml-1 font-black leading-none text-slate-950 bg-amber-300 px-1 py-0.2 rounded border border-white animate-multiplier-blink">
                    ⚡{item.multiplier}X
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { soundFx.playClick(); setShowHistoryOverlay(true); }}
          className="w-4.5 h-4.5 rounded bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center shrink-0"
        >
          <BarChart2 className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* 4. MAIN LIVE STAGE AREA (FITS SCREEN WITHOUT SCROLLING) */}
      <div className="relative flex-1 min-h-0 bg-gradient-to-b from-[#05070c] via-[#090b12] to-[#040508] overflow-hidden flex flex-col justify-between p-1">
        
        {/* ⚡ CINEMATIC ELECTRIC LIGHTNING STRIKE FROM HEADER DOWN TO ROUND NUMBERS */}
        <LightningStrikeStorm
          isActive={isLightningStormActive}
          roundId={roundId}
          lightningNumbers={
            lightningNumbers.length > 0
              ? lightningNumbers
              : getSyncedLightningMultipliers(roundId)
          }
          onComplete={() => setIsLightningStormActive(false)}
          onDismiss={() => setIsLightningStormActive(false)}
        />

        {/* COMPACT LIVE GAME & LIGHTNING STATUS BAR (Replaces video box, gives maximum space to betting table) */}
        <div className="w-full max-w-lg mx-auto bg-gradient-to-r from-black/90 via-slate-950/95 to-black/90 border border-amber-500/30 rounded-xl px-2 py-1 shadow-md shrink-0 flex items-center justify-between gap-1.5 font-mono">
          
          {/* Left: Host Name & Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <div className="leading-none">
              <span className="text-[8px] text-slate-400 block">HOST</span>
              <span className="text-[10px] font-bold text-amber-300">Saanvi</span>
            </div>
            
            {/* Quick Lightning Strike Preview / Trigger button */}
            <button
              onClick={() => {
                soundFx.playClick();
                setIsLightningStormActive(true);
              }}
              className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 hover:text-white text-[8px] font-bold flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
              title="⚡ লাইটনিং স্ট্রাইক অ্যানিমেশন দেখুন"
            >
              <Zap className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
              <span>⚡ Strike</span>
            </button>
          </div>

          {/* Center: Countdown Timer or Spinning Status */}
          <div className="flex-1 flex items-center justify-center gap-1.5">
            {gamePhase === 'betting' && (
              <div className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border border-amber-400/70 text-amber-300 font-black text-xs flex items-center gap-1 shadow-sm">
                <span>⏱ PLACE BETS:</span>
                <span className="text-rose-400 font-mono text-sm">{countdown}s</span>
              </div>
            )}

            {gamePhase === 'lightning' && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setIsLightningStormActive(true);
                }}
                className="px-2 py-0.5 rounded-lg bg-amber-950 border border-amber-300 text-yellow-300 font-black text-[11px] flex items-center gap-1 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)] cursor-pointer active:scale-95 transition-transform"
                title="⚡ লাইটনিং স্ট্রাইক দেখুন"
              >
                <Zap className="w-3.5 h-3.5 fill-yellow-300 animate-bounce" />
                <span>LIGHTNING STRIKE!</span>
              </button>
            )}

            {(gamePhase === 'spinning' || gamePhase === 'settled') && (
              <div className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-spin" />
                <span>WHEEL IN MOTION</span>
              </div>
            )}
          </div>

          {/* Right: Lightning Lucky Multipliers or Round ID */}
          <div className="flex items-center gap-1 shrink-0">
            {lightningNumbers.length > 0 && gamePhase !== 'betting' ? (
              lightningNumbers.map((l) => (
                <div
                  key={l.number}
                  className="px-1.5 py-0.5 rounded-lg border-2 border-amber-300 bg-amber-950 text-[10px] font-black font-mono text-yellow-300 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-lightning-blink"
                >
                  <span className={getNumberColor(l.number) === 'red' ? 'text-rose-400' : l.number === 0 ? 'text-emerald-400' : 'text-white'}>
                    #{l.number}
                  </span>
                  <span className="bg-amber-400 text-slate-950 px-1 py-0.2 rounded text-[8px] font-black border border-white animate-multiplier-blink">
                    ⚡{l.multiplier}X
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[8px] font-bold text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                #{roundId.slice(-6)}
              </span>
            )}
          </div>
        </div>

        {/* 5. INTERACTIVE CHIP SELECTOR TAP BAR */}
        <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-1.5 px-2 py-1 bg-gradient-to-r from-black/95 via-slate-900/90 to-black/95 border border-amber-500/40 rounded-xl shadow-lg shrink-0 font-mono">
          {/* Main Tap Button to Open Complete Chip Picker */}
          <button
            onClick={() => { soundFx.playClick(); setShowChipPicker(true); }}
            className="flex-1 flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-400/60 hover:border-amber-400 shadow-md active:scale-95 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-mono font-black text-[9px] sm:text-[10px] flex items-center justify-center border-2 shadow-md bg-gradient-to-tr ${getChipGradient(selectedChip)} ring-1 ring-amber-300`}>
                {formatChipNumber(selectedChip)}
              </div>
              <div className="text-left">
                <div className="text-[7px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>🪙 Chip Amount</span>
                  <span className="text-emerald-400 font-normal">(ট্যাপ করে পাল্টান)</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-white font-mono flex items-center gap-1">
                  <span>₹{selectedChip.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-amber-300 group-hover:translate-x-0.5 transition-transform">▼ Select</span>
                </div>
              </div>
            </div>

            <div className="text-[8px] font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 rounded-full shadow">
              Change Chip
            </div>
          </button>

          {/* Quick-Switch Chips */}
          <div className="flex items-center gap-1">
            {[20, 50, 100, 500, 1000].map(val => (
              <button
                key={val}
                onClick={() => { soundFx.playCoin(); setSelectedChip(val); }}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full font-mono font-black text-[7px] sm:text-[8px] flex items-center justify-center border transition-all active:scale-90 cursor-pointer bg-gradient-to-tr ${getChipGradient(val)} ${selectedChip === val ? 'ring-2 ring-amber-300 scale-110 shadow-[0_0_8px_#f59e0b]' : 'opacity-70 hover:opacity-100'}`}
                title={`₹${val}`}
              >
                {formatChipNumber(val)}
              </button>
            ))}
          </div>
        </div>

        {/* 6. EXPANDED 100% STRAIGHT FULL-SCREEN BETTING TABLE */}
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-1 max-w-lg mx-auto w-full">
          
          <div className="relative flex-1 min-h-0 bg-[#0a0d14]/95 border border-amber-500/40 rounded-xl p-1 shadow-2xl overflow-hidden flex flex-col">
            
            {/* UNIFIED 100% STRAIGHT CSS GRID */}
            <div 
              className="w-full flex-1 min-h-0 grid gap-0.5 font-mono select-none"
              style={{
                gridTemplateColumns: 'minmax(38px, 48px) minmax(32px, 40px) 1fr 1fr 1fr minmax(36px, 44px)',
                gridTemplateRows: 'minmax(24px, 28px) repeat(12, minmax(0, 1fr)) minmax(24px, 28px)'
              }}
            >
              {/* ------------------------------------------------------------- */}
              {/* ROW 1 (TOP): Zero (0) spanning cols 3 to 5 + top accents     */}
              {/* ------------------------------------------------------------- */}
              <div className="col-start-1 col-span-2 row-start-1 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-center text-[7px] text-amber-400 font-bold tracking-tight">
                <span>TABLE</span>
              </div>

              {(() => {
                const isLightningActive = gamePhase !== 'betting' && lightningNumbers.length > 0;
                const zeroLucky = isLightningActive ? lightningNumbers.find(l => l.number === 0) : undefined;
                const betAmt = getBetAmountForSpot({ kind: 'number', value: 0 });
                return (
                  <button
                    onClick={() => handlePlaceBet({ kind: 'number', value: 0 }, '0')}
                    className={`col-start-3 col-span-3 row-start-1 rounded-lg border font-mono font-black text-xs sm:text-sm flex items-center justify-center relative cursor-pointer active:scale-95 transition-all shadow-sm ${
                      zeroLucky
                        ? 'animate-lightning-blink bg-gradient-to-r from-amber-950 via-emerald-800 to-amber-950 border-2 border-amber-300 text-yellow-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                        : 'bg-emerald-800 hover:bg-emerald-700 border-emerald-500 text-white'
                    } ${betAmt > 0 ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <span className="tracking-wider">0</span>
                    {zeroLucky && (
                      <span className="absolute -top-1 right-2 bg-amber-400 text-slate-950 font-black text-[7px] sm:text-[8px] px-1.5 rounded-full shadow-md border border-white animate-multiplier-blink">
                        ⚡{zeroLucky.multiplier}X
                      </span>
                    )}
                    {betAmt > 0 && (
                      <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[7px] sm:text-[8px] font-black px-1 rounded-full shadow-md z-20">
                        ₹{betAmt >= 1000 ? `${betAmt / 1000}k` : betAmt}
                      </span>
                    )}
                  </button>
                );
              })()}

              <div className="col-start-6 row-start-1 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-center text-[7px] text-slate-400 font-bold">
                <span>CTRL</span>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* COLUMN 1: OUTSIDE BETS (Each spanning exactly 2 rows)         */}
              {/* ------------------------------------------------------------- */}
              {[
                { type: { kind: 'range', value: '1-18' }, label: '1-18', rowStart: 2 },
                { type: { kind: 'parity', value: 'even' }, label: 'EVEN', rowStart: 4 },
                { type: { kind: 'color', value: 'red' }, label: '♦ RED', isRed: true, rowStart: 6 },
                { type: { kind: 'color', value: 'black' }, label: '♦ BLK', isBlack: true, rowStart: 8 },
                { type: { kind: 'parity', value: 'odd' }, label: 'ODD', rowStart: 10 },
                { type: { kind: 'range', value: '19-36' }, label: '19-36', rowStart: 12 }
              ].map((b) => {
                const betAmt = getBetAmountForSpot(b.type as BetType);
                const isRestricted = (() => {
                  if (rouletteConfig.preventOppositeBets === false) return false;
                  if (b.type.kind === 'color') {
                    const opp = b.type.value === 'red' ? 'black' : 'red';
                    return bets.some(x => x.type.kind === 'color' && x.type.value === opp && x.amount > 0);
                  }
                  if (b.type.kind === 'parity') {
                    const opp = b.type.value === 'even' ? 'odd' : 'even';
                    return bets.some(x => x.type.kind === 'parity' && x.type.value === opp && x.amount > 0);
                  }
                  if (b.type.kind === 'range') {
                    const opp = b.type.value === '1-18' ? '19-36' : '1-18';
                    return bets.some(x => x.type.kind === 'range' && x.type.value === opp && x.amount > 0);
                  }
                  return false;
                })();

                return (
                  <button
                    key={b.label}
                    onClick={() => handlePlaceBet(b.type as BetType, b.label)}
                    style={{
                      gridColumn: '1',
                      gridRow: `${b.rowStart} / span 2`
                    }}
                    className={`rounded-lg border flex items-center justify-center relative cursor-pointer active:scale-95 transition-all shadow-sm font-bold text-[8px] sm:text-[9px] ${
                      isRestricted ? 'opacity-60 grayscale-[30%]' : ''
                    } ${
                      b.isRed ? 'bg-rose-900/80 border-rose-600/90 text-rose-200 hover:bg-rose-800' :
                      b.isBlack ? 'bg-slate-950 border-slate-700 text-white hover:bg-slate-900' :
                      'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:bg-slate-800'
                    } ${betAmt > 0 ? 'ring-2 ring-amber-400 bg-amber-950/40' : ''}`}
                  >
                    {isRestricted && (
                      <span className="absolute top-0.5 right-0.5 bg-slate-950/90 text-rose-400 p-0.5 rounded-full z-20 pointer-events-none">
                        <Lock className="w-2 h-2" />
                      </span>
                    )}
                    <span className="leading-tight font-black tracking-tight">{b.label}</span>
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[7px] sm:text-[8px] font-black px-1 rounded-full shadow-md z-20">
                        ₹{betAmt >= 1000 ? `${betAmt / 1000}k` : betAmt}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* COLUMN 2: DOZEN BETS (Each spanning exactly 4 rows)           */}
              {/* ------------------------------------------------------------- */}
              {[
                { key: '1st12', label: '1st 12', rowStart: 2 },
                { key: '2nd12', label: '2nd 12', rowStart: 6 },
                { key: '3rd12', label: '3rd 12', rowStart: 10 }
              ].map((d) => {
                const betAmt = getBetAmountForSpot({ kind: 'dozen', value: d.key as any });
                const otherDozensWithBets = bets.filter(b => b.type.kind === 'dozen' && b.type.value !== d.key && b.amount > 0);
                const isDozenRestricted = rouletteConfig.preventOppositeBets !== false && betAmt === 0 && otherDozensWithBets.length >= 2;
                return (
                  <button
                    key={d.key}
                    onClick={() => handlePlaceBet({ kind: 'dozen', value: d.key as any }, d.label)}
                    style={{
                      gridColumn: '2',
                      gridRow: `${d.rowStart} / span 4`
                    }}
                    className={`bg-slate-900/95 border border-amber-500/40 text-amber-300 hover:bg-slate-850 rounded-lg flex items-center justify-center relative cursor-pointer active:scale-95 transition-all shadow-sm font-bold ${
                      isDozenRestricted ? 'opacity-60 grayscale-[30%]' : ''
                    } ${
                      betAmt > 0 ? 'ring-2 ring-amber-400 bg-amber-950/40' : ''
                    }`}
                  >
                    {isDozenRestricted && (
                      <span className="absolute top-1 right-1 bg-slate-950/90 text-rose-400 p-0.5 rounded-full z-20 pointer-events-none shadow">
                        <Lock className="w-2 h-2" />
                      </span>
                    )}
                    <span className="rotate-[-90deg] whitespace-nowrap text-[8px] sm:text-[9px] font-black tracking-wide">{d.label}</span>
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[7px] sm:text-[8px] font-black px-1 rounded-full shadow-md z-20">
                        ₹{betAmt >= 1000 ? `${betAmt / 1000}k` : betAmt}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* COLUMNS 3, 4, 5: 12 ROWS OF 3 NUMBERS                         */}
              {/* ------------------------------------------------------------- */}
              {[
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
                [10, 11, 12],
                [13, 14, 15],
                [16, 17, 18],
                [19, 20, 21],
                [22, 23, 24],
                [25, 26, 27],
                [28, 29, 30],
                [31, 32, 33],
                [34, 35, 36]
              ].map((row, rIdx) => {
                const gridRowIndex = rIdx + 2; // Row 2 to 13
                return (
                  <React.Fragment key={rIdx}>
                    {row.map((num, colIdx) => {
                      const gridColIndex = colIdx + 3; // Col 3, 4, 5
                      const isLightningActive = gamePhase !== 'betting' && lightningNumbers.length > 0;
                      const col = getNumberColor(num);
                      const betAmt = getBetAmountForSpot({ kind: 'number', value: num });
                      const luckyHit = isLightningActive ? lightningNumbers.find(l => l.number === num) : undefined;
                      return (
                        <button
                          key={num}
                          onClick={() => handlePlaceBet({ kind: 'number', value: num }, `${num}`)}
                          style={{
                            gridColumn: `${gridColIndex}`,
                            gridRow: `${gridRowIndex}`
                          }}
                          className={`w-full h-full rounded-lg border font-mono font-black text-xs xs:text-sm sm:text-base flex items-center justify-center relative cursor-pointer active:scale-95 transition-all shadow-sm ${
                            luckyHit
                              ? 'animate-lightning-blink bg-gradient-to-b from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-300 text-yellow-200 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                              : col === 'red'
                              ? 'bg-rose-700 hover:bg-rose-600 border-rose-500/70 text-white'
                              : 'bg-slate-950 hover:bg-slate-900 border-slate-700/80 text-white'
                          } ${betAmt > 0 ? 'ring-2 ring-amber-400 bg-amber-950/50' : ''}`}
                        >
                          <span>{num}</span>
                          {luckyHit && (
                            <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[6px] xs:text-[7px] sm:text-[8px] px-1 rounded-full whitespace-nowrap z-40 shadow border border-white animate-multiplier-blink">
                              ⚡{luckyHit.multiplier}X
                            </span>
                          )}
                          {betAmt > 0 && (
                            <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[7px] sm:text-[8px] font-black px-1 rounded-full shadow-md z-20">
                              ₹{betAmt >= 1000 ? `${betAmt / 1000}k` : betAmt}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* COLUMN 6: RIGHT SIDE CONTROLS (Undo, Double, Repeat)          */}
              {/* ------------------------------------------------------------- */}
              <button
                onClick={handleClearBets}
                disabled={gamePhase !== 'betting' || betsLocked || bets.length === 0}
                style={{
                  gridColumn: '6',
                  gridRow: '2 / span 4'
                }}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex flex-col items-center justify-center p-0.5 active:scale-90 disabled:opacity-30 cursor-pointer shadow-sm"
                title="Undo / Clear"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[7px] font-black mt-0.5">UNDO</span>
              </button>

              <button
                onClick={handleDoubleBets}
                disabled={gamePhase !== 'betting' || betsLocked || bets.length === 0}
                style={{
                  gridColumn: '6',
                  gridRow: '6 / span 4'
                }}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-400 flex flex-col items-center justify-center p-0.5 active:scale-90 disabled:opacity-30 cursor-pointer shadow-sm"
                title="2X Double Bets"
              >
                <span className="font-black text-xs leading-none">x2</span>
                <span className="text-[7px] font-black mt-0.5">DOUBLE</span>
              </button>

              <button
                onClick={handleRepeatBets}
                disabled={gamePhase !== 'betting' || betsLocked || lastBets.length === 0}
                style={{
                  gridColumn: '6',
                  gridRow: '10 / span 4'
                }}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-400 flex flex-col items-center justify-center p-0.5 active:scale-90 disabled:opacity-30 cursor-pointer shadow-sm"
                title="Repeat Last Bet"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[7px] font-black mt-0.5">REPEAT</span>
              </button>

              {/* ------------------------------------------------------------- */}
              {/* ROW 14 (BOTTOM): COLUMN BETS (2:1 Col 1, 2:1 Col 2, 2:1 Col 3) */}
              {/* ------------------------------------------------------------- */}
              <div className="col-start-1 col-span-2 row-start-14 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-center text-[7px] text-slate-400 font-bold">
                <span>2:1 COL</span>
              </div>

              {['col1', 'col2', 'col3'].map((cKey, idx) => {
                const betAmt = getBetAmountForSpot({ kind: 'column', value: cKey as any });
                const otherColsWithBets = bets.filter(b => b.type.kind === 'column' && b.type.value !== cKey && b.amount > 0);
                const isColRestricted = rouletteConfig.preventOppositeBets !== false && betAmt === 0 && otherColsWithBets.length >= 2;
                return (
                  <button
                    key={cKey}
                    onClick={() => handlePlaceBet({ kind: 'column', value: cKey as any }, '2:1 Col')}
                    style={{
                      gridColumn: `${idx + 3}`,
                      gridRow: '14'
                    }}
                    className={`bg-slate-900/95 border border-amber-500/40 text-amber-300 font-mono font-black text-[9px] sm:text-[10px] rounded-lg flex items-center justify-center relative cursor-pointer active:scale-95 hover:bg-slate-850 shadow-sm ${
                      isColRestricted ? 'opacity-60 grayscale-[30%]' : ''
                    } ${
                      betAmt > 0 ? 'ring-2 ring-amber-400 bg-amber-950/40' : ''
                    }`}
                  >
                    {isColRestricted && (
                      <span className="absolute top-0.5 right-0.5 bg-slate-950/90 text-rose-400 p-0.5 rounded-full z-20 pointer-events-none shadow">
                        <Lock className="w-2 h-2" />
                      </span>
                    )}
                    <span>2:1</span>
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[7px] sm:text-[8px] font-black px-1 rounded-full shadow-md z-20">
                        ₹{betAmt >= 1000 ? `${betAmt / 1000}k` : betAmt}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="col-start-6 row-start-14 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-center text-[7px] text-slate-400 font-bold">
                <span>2:1</span>
              </div>

            </div>

          </div>

          {/* 7. DEALER TICKER + TOTAL BET & GAME LIMITS BAR */}
          <div className="flex flex-col gap-0.5 font-mono text-[9px] shrink-0 pb-1">
            <div className="px-2.5 py-1 bg-black/90 border border-amber-500/30 rounded-lg text-amber-300 text-[10px] truncate flex items-center justify-between shadow">
              <span className="truncate">{dealerMessage}</span>
              <span className="text-emerald-400 text-[8px] font-bold shrink-0 ml-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            </div>

            <div className="flex items-center justify-between px-1.5 text-[9px] text-slate-300">
              <div>
                <span>Total Bet: </span>
                <strong className="text-amber-400 font-mono text-[11px]">₹{totalBetAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div className="text-slate-400 text-[8px]">
                Limit: ₹{rouletteConfig.minBet || 20} - ₹{(rouletteConfig.maxBet || 10000000).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* CHIP SELECTION MODAL / BOTTOM SHEET (AUTOCLOSES ON SELECTION AS REQUESTED) */}
      {/* ========================================================================= */}
      {showChipPicker && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowChipPicker(false)}
        >
          <div 
            className="w-full max-w-lg bg-[#0d111c] border-t sm:border border-amber-500/40 rounded-t-3xl sm:rounded-3xl p-4 shadow-2xl flex flex-col gap-3.5 font-mono animate-in slide-in-from-bottom-5 duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-300">Select Bet Chip (চিপ নির্বাচন করুন)</h3>
                  <p className="text-[10px] text-slate-400">ট্যাপ করলেই চিপ সিলেক্ট হয়ে প্যানেল বন্ধ হয়ে যাবে</p>
                </div>
              </div>
              <button
                onClick={() => setShowChipPicker(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of Chips */}
            <div>
              <div className="text-[10px] font-bold text-slate-300 mb-2 flex items-center justify-between">
                <span>CHIP DENOMINATIONS:</span>
                <span className="text-amber-400">Current: ₹{selectedChip.toLocaleString('en-IN')}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {CHIP_VALUES.map((val) => {
                  const isSelected = selectedChip === val;
                  return (
                    <button
                      key={val}
                      onClick={() => {
                        soundFx.playCoin();
                        setSelectedChip(val);
                        setShowChipPicker(false); // AUTO-CLOSE INSTANTLY
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]' 
                          : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-850'
                      }`}
                    >
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full font-mono font-black text-[10px] sm:text-xs flex items-center justify-center border-2 shadow-lg bg-gradient-to-tr ${getChipGradient(val)} ${isSelected ? 'scale-105 ring-2 ring-white' : ''}`}>
                        {formatChipNumber(val)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-200 mt-1">₹{val >= 1000 ? `${(val / 1000).toLocaleString('en-IN')}k` : val}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount Input Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between">
                <span>Custom Chip Amount (নিজের পছন্দমতো অ্যামাউন্ট লিখুন):</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">₹</span>
                  <input
                    type="number"
                    min={rouletteConfig.minBet || 20}
                    max={rouletteConfig.maxBet || 10000000}
                    value={customChipAmount}
                    onChange={(e) => setCustomChipAmount(e.target.value)}
                    placeholder="e.g. 75, 250, 15000"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg pl-7 pr-3 py-2 text-sm font-black text-white outline-none font-mono"
                  />
                </div>
                <button
                  onClick={() => {
                    const parsed = parseInt(customChipAmount, 10);
                    if (!isNaN(parsed) && parsed >= (rouletteConfig.minBet || 20)) {
                      if (parsed > (rouletteConfig.maxBet || 10000000)) {
                        alert(`Maximum bet limit is ₹${(rouletteConfig.maxBet || 10000000).toLocaleString('en-IN')}`);
                        return;
                      }
                      soundFx.playCoin();
                      setSelectedChip(parsed);
                      setShowChipPicker(false); // AUTO-CLOSE INSTANTLY
                    } else {
                      alert(`Please enter a valid amount (Minimum ₹${rouletteConfig.minBet || 20})`);
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-lg shadow-md active:scale-95 cursor-pointer shrink-0 transition-all"
                >
                  Apply & Bet
                </button>
              </div>

              {/* Quick Increment Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[9px] text-slate-400 font-bold mr-1">Quick Add:</span>
                {[
                  { label: '+50', val: 50 },
                  { label: '+100', val: 100 },
                  { label: '+500', val: 500 },
                  { label: '+1k', val: 1000 },
                  { label: '+5k', val: 5000 },
                  { label: '+10k', val: 10000 },
                  { label: 'Max', val: user.balance }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const current = parseInt(customChipAmount, 10) || selectedChip || 0;
                      const nextVal = item.label === 'Max' ? Math.floor(user.balance) : current + item.val;
                      setCustomChipAmount(String(nextVal));
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-amber-300 active:scale-95 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={() => setCustomChipAmount('')}
                  className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-[10px] font-bold text-rose-300 active:scale-95 cursor-pointer ml-auto"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CINEMATIC FULL-SCREEN POP-UP ROULETTE WHEEL ON COUNTDOWN END */}
      {/* ========================================================================= */}
      {(gamePhase === 'spinning' || gamePhase === 'settled') && (
        <CinematicRoulettePopup
          roundId={roundId}
          gamePhase={gamePhase}
          wheelRotation={wheelRotation}
          ballAngle={ballAngle}
          ballRadius={ballRadius}
          winningNumber={winningNumber}
          isResultRevealed={isResultRevealed}
          activeSurrounding={activeSurrounding}
          userWonAmount={userWonAmount}
          userName={user.name || 'Player'}
          dealerMessage={dealerMessage}
          isMuted={isMuted}
          selectedLanguage={voiceLanguage}
          lightningNumbers={lightningNumbers}
          WHEEL_NUMBERS={WHEEL_NUMBERS}
          getNumberColor={getNumberColor}
          onToggleSound={() => setIsMuted(prev => !prev)}
        />
      )}

      {/* 8. USER GAME HISTORY BOTTOM DRAWER / MODAL */}
      {showGameHistory && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#121620] border-t border-amber-500/40 rounded-t-3xl w-full max-w-xl mx-auto h-[80vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-2 mb-1 shrink-0" />

            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-black/40">
              <button
                onClick={() => setShowGameHistory(false)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <h3 className="font-black text-white text-base">Game History</h3>
              </div>

              <button
                onClick={() => setShowGameHistory(false)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-slate-800/80 bg-black/20 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="w-1/2"></div>
              <div className="w-1/4 text-right">BET</div>
              <div className="w-1/4 text-right">RESULT</div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-4">
              {groupedBetHistory.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1 pt-1">
                  
                  <div className="px-3 py-1.5 bg-slate-900/60 rounded-lg flex items-center justify-between text-xs font-black text-slate-300">
                    <span className="text-[11px] text-slate-400">{group.dateKey}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-white">₹{group.totalBet}</span>
                      <span className={group.totalResult >= 0 ? 'text-emerald-400' : 'text-slate-300'}>
                        {group.totalResult >= 0 ? `₹${group.totalResult}` : `-₹${Math.abs(group.totalResult)}`}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/30">
                    {group.items.map((item) => {
                      const isWin = item.resultAmount > 0;
                      return (
                        <div key={item.id} className="px-3 py-2 flex items-center justify-between hover:bg-slate-800/20 text-xs">
                          <div className="flex items-center gap-3 w-1/2 truncate">
                            <span className="text-slate-400 text-[11px]">{item.timestamp}</span>
                            <span className="text-white font-medium truncate text-[11px] sm:text-xs">{item.gameName}</span>
                          </div>

                          <div className="w-1/4 text-right font-bold text-slate-300 text-xs">
                            ₹{item.betAmount}
                          </div>

                          <div className={`w-1/4 text-right font-black text-xs ${
                            isWin ? 'text-emerald-400' : 'text-slate-300'
                          }`}>
                            {isWin ? `₹${item.resultAmount}` : `-₹${Math.abs(item.resultAmount)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* 9. ROUND STATS MODAL */}
      {showHistoryOverlay && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">HINDI LIGHTNING ROULETTE STATS</h3>
              </div>
              <button
                onClick={() => setShowHistoryOverlay(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950/40 border-b border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-rose-950/40 border border-rose-500/30 p-2 rounded-xl">
                <span className="text-rose-400 font-bold block text-[10px]">RED</span>
                <span className="text-lg font-black text-white">48%</span>
              </div>
              <div className="bg-slate-950 border border-slate-700 p-2 rounded-xl">
                <span className="text-slate-400 font-bold block text-[10px]">BLACK</span>
                <span className="text-lg font-black text-white">49%</span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xl">
                <span className="text-emerald-400 font-bold block text-[10px]">ZERO</span>
                <span className="text-lg font-black text-white">3%</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                    <th className="pb-2">ROUND</th>
                    <th className="pb-2">NUMBER</th>
                    <th className="pb-2">COLOR</th>
                    <th className="pb-2">MULTIPLIER</th>
                    <th className="pb-2 text-right">TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-slate-800/60 text-slate-200">
                  {fullHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 text-slate-400">{h.roundId}</td>
                      <td className="py-2 font-bold">{h.number}</td>
                      <td className="py-2 uppercase text-[10px]">{h.color}</td>
                      <td className="py-2 text-amber-400 font-bold">{h.multiplier ? `${h.multiplier}x ⚡` : '30x'}</td>
                      <td className="py-2 text-right text-slate-400 text-[10px]">{h.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
