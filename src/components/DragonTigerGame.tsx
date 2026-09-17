import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Volume2, VolumeX, Sparkles, HelpCircle, History, 
  RotateCcw, Trash2, Zap, CheckCircle2, ChevronRight, Crown, 
  TrendingUp, ShieldCheck, Plus, AlertTriangle, Layers, Award,
  Flame, RefreshCw, Maximize2, Minimize2, Bookmark, Menu as MenuIcon,
  X, MessageSquare, Headphones, Settings, Sliders, ChevronLeft, Globe, Lock,
  Coins, Check
} from 'lucide-react';
import { User, WalletTransaction, DragonTigerConfig, DragonTigerRound, DragonTigerBet, PlayingCard, DragonTigerSide, CardRank } from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  DEFAULT_DRAGON_TIGER_CONFIG, 
  determineDragonTigerWinner, 
  simulateDragonTigerRound, 
  calculateDragonTigerPayout,
  getRankNumericValue,
  getRankFullWord,
  playDealerSpeech,
  DragonTigerLang,
  getBetOpenPhrase,
  getFinalSecondsPhrase,
  getBetsClosedPhrase,
  getUserWinPhrase,
  getNextRoundInvitePhrase,
  getRoundOutcomePhrase,
  getUniversalDragonTigerTimeState,
  getSyncedDragonTigerBeadRoad
} from '../utils/dragonTiger';
import { triggerConfetti } from '../utils/confetti';
import { Card8KSpotlightModal, Card8KSpotlightData } from './Card8KSpotlightModal';
import { logLiveActivity } from '../utils/activityTracker';

// Import Generated Cinematic HD Dealer Assets
import dtDealerWelcomeImg from '../assets/images/dt_dealer_welcome_1787503719213.jpg';
import dtDealerDealingImg from '../assets/images/dt_dealer_dealing_1787503741212.jpg';
import dtDealerTableImg from '../assets/images/dt_dealer_table_1787503758606.jpg';

interface DragonTigerGameProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
  onBigWin?: (data: any) => void;
}

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000, 25000];

export function getDynamicChipStyle(val: number): string {
  if (val < 25) {
    return 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 border-2 border-dashed border-white text-white';
  } else if (val < 100) {
    return 'bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-800 border-2 border-dashed border-cyan-200 text-white';
  } else if (val < 500) {
    return 'bg-gradient-to-br from-emerald-600 via-teal-500 to-emerald-800 border-2 border-dashed border-emerald-200 text-white';
  } else if (val < 1000) {
    return 'bg-gradient-to-br from-purple-600 via-pink-600 to-purple-800 border-2 border-dashed border-purple-200 text-white';
  } else if (val < 5000) {
    return 'bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-700 border-2 border-dashed border-amber-100 text-slate-950';
  } else if (val < 25000) {
    return 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-900 border-2 border-dashed border-rose-200 text-white';
  } else {
    return 'bg-gradient-to-br from-amber-400 via-amber-200 to-yellow-500 border-2 border-dashed border-black text-slate-950';
  }
}

export function formatChipDisplay(val: number): string {
  if (val >= 1000000) return `${val / 1000000}M`;
  if (val >= 1000) return `${val / 1000}k`;
  return String(val);
}

interface LiveWinnerItem {
  id: string;
  count?: number;
  name: string;
  amount: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isDealer?: boolean;
  isWin?: boolean;
}

interface BeadRecord {
  id: string;
  winner: DragonTigerSide;
  isSuitedTie?: boolean;
  dragonRank: CardRank;
  dragonSuit: string;
  tigerRank: CardRank;
  tigerSuit: string;
}

export const DragonTigerGame: React.FC<DragonTigerGameProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit,
  onBigWin
}) => {
  // 1. Config State (realtime from Firestore)
  const [config, setConfig] = useState<DragonTigerConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_dragon_tiger_config');
      return cached ? { ...DEFAULT_DRAGON_TIGER_CONFIG, ...JSON.parse(cached) } : DEFAULT_DRAGON_TIGER_CONFIG;
    } catch {
      return DEFAULT_DRAGON_TIGER_CONFIG;
    }
  });
  const configRef = useRef<DragonTigerConfig>(config);
  configRef.current = config;

  // 2. Lifecycle States
  const initialTimeState = useMemo(() => getUniversalDragonTigerTimeState(Date.now(), config), []);
  const [gamePhase, setGamePhase] = useState<'betting' | 'dealing' | 'completed'>(initialTimeState.phase);
  const [countdown, setCountdown] = useState<number>(initialTimeState.countdown);
  const [roundId, setRoundId] = useState<string>(initialTimeState.roundDetails.roundId);
  const [roundStartTime, setRoundStartTime] = useState<number>(initialTimeState.roundStartTimeMs);

  // 3. Card States
  const [dragonCard, setDragonCard] = useState<PlayingCard | null>(initialTimeState.roundDetails.dragonCard);
  const [tigerCard, setTigerCard] = useState<PlayingCard | null>(initialTimeState.roundDetails.tigerCard);
  const [isDragonCardRevealed, setIsDragonCardRevealed] = useState<boolean>(initialTimeState.isDragonRevealed);
  const [isTigerCardRevealed, setIsTigerCardRevealed] = useState<boolean>(initialTimeState.isTigerRevealed);
  const [winningSide, setWinningSide] = useState<DragonTigerSide | null>(null);
  const [isSuitedTieResult, setIsSuitedTieResult] = useState<boolean>(false);
  const [show8kRevealModal, setShow8kRevealModal] = useState<boolean>(false);
  const [reveal8kData, setReveal8kData] = useState<Card8KSpotlightData | null>(null);

  // Active Refs to prevent stale closures during global setInterval ticks
  const activeDragonCardRef = useRef<PlayingCard | null>(initialTimeState.roundDetails.dragonCard);
  const activeTigerCardRef = useRef<PlayingCard | null>(initialTimeState.roundDetails.tigerCard);
  const activeWinningSideRef = useRef<DragonTigerSide | null>(initialTimeState.roundDetails.winningSide);
  const activeIsSuitedTieRef = useRef<boolean>(initialTimeState.roundDetails.isSuitedTie);

  // 4. Betting States
  const [selectedChip, setSelectedChip] = useState<number>(50);
  const chips = useMemo(() => {
    return (Array.isArray(config.chipValues) && config.chipValues.length > 0)
      ? config.chipValues
      : CHIP_VALUES;
  }, [config.chipValues]);
  const [userBetDragon, setUserBetDragon] = useState<number>(0);
  const [userBetTiger, setUserBetTiger] = useState<number>(0);
  const [userBetTie, setUserBetTie] = useState<number>(0);
  const [userBetSuitedTie, setUserBetSuitedTie] = useState<number>(0);
  const [lastBets, setLastBets] = useState<{ dragon: number; tiger: number; tie: number; suitedTie: number } | null>(null);
  const [betHistoryStack, setBetHistoryStack] = useState<{ side: DragonTigerSide; amount: number }[]>([]);

  // Synchronous Refs to prevent stale closures
  const userBetDragonRef = useRef<number>(0);
  const userBetTigerRef = useRef<number>(0);
  const userBetTieRef = useRef<number>(0);
  const userBetSuitedTieRef = useRef<number>(0);
  const firestoreLiveBetsRef = useRef<{ dragon: number; tiger: number; tie: number; suitedTie: number }>({
    dragon: 0,
    tiger: 0,
    tie: 0,
    suitedTie: 0,
  });

  // 5. Simulated Live Table Pool & Bettor counts (Evolution replica)
  const [tablePoolDragon, setTablePoolDragon] = useState<number>(59161.63);
  const [tablePoolTiger, setTablePoolTiger] = useState<number>(134726.22);
  const [tablePoolTie, setTablePoolTie] = useState<number>(14250.00);
  const [tablePoolSuitedTie, setTablePoolSuitedTie] = useState<number>(4800.00);
  const [dragonBettors, setDragonBettors] = useState<number>(131);
  const [tigerBettors, setTigerBettors] = useState<number>(144);
  const [tieBettors, setTieBettors] = useState<number>(29);

  // 6. Audio, Language & Mute State
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasInteractedAudio, setHasInteractedAudio] = useState<boolean>(false);
  const [dealerLang, setDealerLang] = useState<DragonTigerLang>(() => {
    try {
      const saved = localStorage.getItem('dt_dealer_lang');
      if (saved === 'bn' || saved === 'hi' || saved === 'en') return saved;
    } catch (_) {}
    return 'bn'; // Default to Bengali
  });
  const dealerLangRef = useRef<DragonTigerLang>(dealerLang);

  const handleSetLanguage = (lang: DragonTigerLang) => {
    setDealerLang(lang);
    dealerLangRef.current = lang;
    try {
      localStorage.setItem('dt_dealer_lang', lang);
    } catch (_) {}
    soundFx.playClick();
  };

  useEffect(() => {
    dealerLangRef.current = dealerLang;
  }, [dealerLang]);

  // 7. Modals
  const [showLowBalanceModal, setShowLowBalanceModal] = useState<boolean>(false);
  const [showMenuModal, setShowMenuModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showChipModal, setShowChipModal] = useState<boolean>(false);
  const [customChipInput, setCustomChipInput] = useState<string>('');
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // 8. Live Winner Stream & Chat
  const [liveWinners, setLiveWinners] = useState<LiveWinnerItem[]>([
    { id: '1', count: 137, name: 'WON', amount: 248233 },
    { id: '2', name: 'aaa', amount: 23256 },
    { id: '3', name: 'Mango', amount: 20000 },
    { id: '4', name: 'ga', amount: 20000 },
    { id: '5', name: 'bingoplusse52sd108', amount: 19380 },
    { id: '6', name: 'eee001', amount: 17936 },
    { id: '7', name: 'aa', amount: 13750 },
    { id: '8', name: '230728', amount: 13568 },
    { id: '9', name: 'CROWNB8SG_c8dsnatu...', amount: 6784 },
    { id: '10', name: 'royalsgirl', amount: 6000 }
  ]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'c1', sender: 'Vicky', text: 'Hello, Gyhgg! Welcome to Dragon Tiger!', time: '16:07:32', isDealer: true },
    { id: 'c2', sender: 'Faltu bsdk manhoos', text: 'nice win', time: '16:07:44' },
    { id: 'c3', sender: 'Sachin', text: 'win', time: '16:07:54', isWin: true },
    { id: 'c4', sender: 'Dealer', text: 'Bets are open. Good luck!', time: '16:08:11', isDealer: true },
    { id: 'c5', sender: 'Ravi', text: 'Dragon continuous streak 🔥', time: '16:08:14' },
  ]);
  const [inputChatMessage, setInputChatMessage] = useState<string>('');

  // 9. Bead Road & Roadmap History
  const [roundIndex, setRoundIndex] = useState<number>(() => getUniversalDragonTigerTimeState().roundIndex);
  const [beadRoad, setBeadRoad] = useState<BeadRecord[]>(() => {
    const curIdx = getUniversalDragonTigerTimeState().roundIndex;
    const history = getSyncedDragonTigerBeadRoad(curIdx, 30);
    return history.map(h => ({
      id: h.id,
      winner: h.winner,
      isSuitedTie: h.isSuitedTie,
      dragonRank: h.dragonRank,
      dragonSuit: h.dragonSuit as any,
      tigerRank: h.tigerRank,
      tigerSuit: h.tigerSuit as any,
    })).reverse();
  });

  // 10. User Bet History
  const [myBetsHistory, setMyBetsHistory] = useState<DragonTigerBet[]>([]);

  // 11. Authoritative Wallet Balance Ref & State
  const [currentBalance, setCurrentBalance] = useState<number>(() => (typeof user.balance === 'number' ? user.balance : 0));
  const balanceRef = useRef<number>(typeof user.balance === 'number' ? user.balance : 0);
  const prevReportedBalRef = useRef<number>(typeof user.balance === 'number' ? user.balance : 0);

  // Win amount for celebration
  const [roundWinAmount, setRoundWinAmount] = useState<number | null>(null);
  const [dealerSubtitle, setDealerSubtitle] = useState<string>('Hello! Welcome to Dragon Tiger!');
  const [restrictionToast, setRestrictionToast] = useState<string | null>(null);
  const beadRoadScrollRef = useRef<HTMLDivElement>(null);
  const activeGlobalRoundRef = useRef<number>(-1);
  const settledRoundRef = useRef<number>(-1);
  const spokenTriggersForRoundRef = useRef<Set<string>>(new Set());
  const roundTimeoutsRef = useRef<any[]>([]);

  const addSafeTimeout = (callback: () => void, delay: number) => {
    const id = setTimeout(callback, delay);
    roundTimeoutsRef.current.push(id);
    return id;
  };

  const clearAllRoundTimeouts = () => {
    roundTimeoutsRef.current.forEach(clearTimeout);
    roundTimeoutsRef.current = [];
  };

  function generateRoundTimestampId(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  // Auto-dismiss restriction toast
  useEffect(() => {
    if (restrictionToast) {
      const timer = setTimeout(() => {
        setRestrictionToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [restrictionToast]);

  // Auto-adjust selected chip when admin changes minBet or maxBet in real-time
  useEffect(() => {
    const minB = config.minBet || 50;
    const maxB = config.maxBet || 15000000;
    const chips = (Array.isArray(config.chipValues) && config.chipValues.length > 0) ? config.chipValues : CHIP_VALUES;
    if (selectedChip < minB) {
      const nextValid = chips.find(c => c >= minB) || minB;
      setSelectedChip(nextValid);
    } else if (selectedChip > maxB) {
      setSelectedChip(maxB);
    }
  }, [config.minBet, config.maxBet, config.chipValues]);

  // Initial fetch of recent rounds from Firestore for real-time history
  useEffect(() => {
    const qRounds = query(collection(db, 'dragon_tiger_rounds'), orderBy('createdAt', 'desc'), limit(25));
    getDocs(qRounds).then((snap) => {
      if (!snap.empty) {
        const records: BeadRecord[] = snap.docs.map((d) => {
          const data = d.data() as DragonTigerRound;
          return {
            id: d.id,
            winner: data.winningSide || 'dragon',
            isSuitedTie: data.isSuitedTie || false,
            dragonRank: data.dragonCard?.rank || 'K',
            dragonSuit: data.dragonCard?.suit || 'hearts',
            tigerRank: data.tigerCard?.rank || '7',
            tigerSuit: data.tigerCard?.suit || 'spades',
          };
        });
        // Oldest on left, newest on right
        records.reverse();
        setBeadRoad(records);
      }
    }).catch(() => {});
  }, []);

  // Auto-scroll Bead Road to rightmost (newest) result
  useEffect(() => {
    if (beadRoadScrollRef.current) {
      beadRoadScrollRef.current.scrollTo({
        left: beadRoadScrollRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [beadRoad]);

  // Synchronize balance if updated externally (Deposit/Admin) and no bets active
  useEffect(() => {
    const externalBal = typeof user.balance === 'number' ? user.balance : 0;
    if (Math.abs(externalBal - prevReportedBalRef.current) > 0.001) {
      if (userBetDragonRef.current === 0 && userBetTigerRef.current === 0 && userBetTieRef.current === 0 && userBetSuitedTieRef.current === 0 && gamePhase === 'betting') {
        balanceRef.current = externalBal;
        prevReportedBalRef.current = externalBal;
        setCurrentBalance(externalBal);
      }
    }
  }, [user.balance, gamePhase]);

    // Listen to Firestore real-time config
  useEffect(() => {
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'dragon_tiger'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          const targetWinner = (data.manualForceTarget as DragonTigerSide) || (data.manualForceWinner as DragonTigerSide) || (data.forcedWinner as DragonTigerSide) || prev.manualForceWinner;
          const isManual = !!(data.isManualOverride || (targetWinner && targetWinner !== 'random'));
          const next: DragonTigerConfig = {
            ...prev,
            isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled,
            minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
            dragonMultiplier: data.multiplierPrimary !== undefined ? data.multiplierPrimary : (data.dragonMultiplier || prev.dragonMultiplier),
            tigerMultiplier: data.multiplierSecondary !== undefined ? data.multiplierSecondary : (data.tigerMultiplier || prev.tigerMultiplier),
            tieMultiplier: data.tieMultiplier !== undefined ? data.tieMultiplier : (data.tieMultiplier || prev.tieMultiplier),
            suitedTieMultiplier: data.suitedTieMultiplier !== undefined ? data.suitedTieMultiplier : (data.suitedTieMultiplier || prev.suitedTieMultiplier),
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpMode: isManual ? 'manual_force_winner' : (data.rtpMode === 'house_protect' ? 'house_protect' : (data.rtpMode || prev.rtpMode)),
            manualForceWinner: targetWinner,
            forcedWinner: targetWinner,
            isManualOverride: isManual,
            dealerVoiceEnabled: data.dealerVoiceEnabled !== undefined ? data.dealerVoiceEnabled : prev.dealerVoiceEnabled,
            preventBothDragonTigerBet: data.preventBothDragonTigerBet !== undefined ? data.preventBothDragonTigerBet : prev.preventBothDragonTigerBet,
            chipValues: Array.isArray(data.chipValues) && data.chipValues.length > 0 ? data.chipValues : prev.chipValues,
          } as any;
          configRef.current = next;
          return next;
        });
      }
    }, () => {});

    const unsubLegacy = onSnapshot(doc(db, 'dragon_tiger_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<DragonTigerConfig>;
        setConfig((prev) => {
          const next = { 
            ...prev, 
            ...data,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            chipValues: Array.isArray(data.chipValues) && data.chipValues.length > 0 ? data.chipValues : prev.chipValues,
          };
          configRef.current = next;
          return next;
        });
      }
    }, () => {});

    // Listen to user's real-time bets
    const qBets = query(collection(db, 'dragon_tiger_bets'), limit(50));
    const unsubBets = onSnapshot(qBets, (snap) => {
      if (!snap.empty && user?.id) {
        const activeUid = user.id;
        const allBets = snap.docs.map(d => ({ id: d.id, ...d.data() } as DragonTigerBet));
        const userBets = allBets.filter(b => b.userId === activeUid);
        userBets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setMyBetsHistory(userBets);
      }
    }, () => {});

    // Listen to real-time 0-second latency Admin Live State (Manual Force Winner / Auto Low-Risk Mode / Live House Edge / Chips)
    const unsubLiveState = onSnapshot(doc(db, 'dragon_tiger_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          let forcedWinner: DragonTigerSide | 'random' = 'random';
          let rtpMode = prev.rtpMode;

          const candidate = data.forcedWinner || data.manualForceWinner || data.manualForceTarget;
          if (data.isManualOverride && candidate && candidate !== 'random') {
            forcedWinner = candidate;
            rtpMode = 'manual_force_winner';
          } else if (candidate && candidate !== 'random') {
            forcedWinner = candidate;
            rtpMode = 'manual_force_winner';
          } else if (data.isAutoLowRiskActive && data.autoLowRiskWinner && data.autoLowRiskWinner !== 'random') {
            // Guard: auto low risk should NEVER be tie
            forcedWinner = (data.autoLowRiskWinner === 'tie' || data.autoLowRiskWinner === 'suited_tie') ? 'random' : data.autoLowRiskWinner;
            rtpMode = 'house_protect';
          } else {
            forcedWinner = 'random';
            rtpMode = data.isAutoLowRiskActive !== false ? 'house_protect' : 'fair_rng';
          }

          const next: DragonTigerConfig = {
            ...prev,
            manualForceWinner: forcedWinner,
            forcedWinner: forcedWinner,
            isManualOverride: forcedWinner !== 'random',
            rtpMode,
            minBet: data.minBet !== undefined ? Number(data.minBet) : prev.minBet,
            maxBet: data.maxBet !== undefined ? Number(data.maxBet) : prev.maxBet,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            chipValues: Array.isArray(data.chipValues) && data.chipValues.length > 0 ? data.chipValues : prev.chipValues,
          } as any;
          configRef.current = next;
          return next;
        });
      }
    }, () => {});

    // Listen to table live bets across all connected players with 0-second latency
    const unsubLiveBets = onSnapshot(collection(db, 'dragon_tiger_live_bets'), (snap) => {
      let dStakes = 0;
      let tStakes = 0;
      let tieStakes = 0;
      let stStakes = 0;
      snap.forEach((d) => {
        const item = d.data();
        const amt = Number(item.amount) || 0;
        if (item.side === 'dragon') dStakes += amt;
        else if (item.side === 'tiger') tStakes += amt;
        else if (item.side === 'tie') tieStakes += amt;
        else if (item.side === 'suited_tie') stStakes += amt;
      });
      firestoreLiveBetsRef.current = { dragon: dStakes, tiger: tStakes, tie: tieStakes, suitedTie: stStakes };
    }, () => {});

    return () => {
      unsubGameSettings();
      unsubLegacy();
      unsubBets();
      unsubLiveState();
      unsubLiveBets();
    };
  }, [user?.id]);

  // Synchronized 24/7 Global Game Loop (Synced across all players worldwide with 0 seconds latency)
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      const userDragon = userBetDragonRef.current;
      const userTiger = userBetTigerRef.current;
      const userTie = userBetTieRef.current;
      const userSuitedTie = userBetSuitedTieRef.current;

      const combinedDragon = Math.max(userDragon, firestoreLiveBetsRef.current.dragon);
      const combinedTiger = Math.max(userTiger, firestoreLiveBetsRef.current.tiger);
      const combinedTie = Math.max(userTie, firestoreLiveBetsRef.current.tie);
      const combinedSuitedTie = Math.max(userSuitedTie, firestoreLiveBetsRef.current.suitedTie);

      const activeBets = {
        dragon: combinedDragon,
        tiger: combinedTiger,
        tie: combinedTie,
        suitedTie: combinedSuitedTie,
      };
      const currentConfigWithBets: DragonTigerConfig = {
        ...configRef.current,
        realUserBets: activeBets,
        liveBetsDragon: combinedDragon,
        liveBetsTiger: combinedTiger,
        liveBetsTie: combinedTie,
        liveBetsSuitedTie: combinedSuitedTie,
      };
      const timeState = getUniversalDragonTigerTimeState(Date.now(), currentConfigWithBets);
      const { 
        roundIndex: currentGlobalRound, 
        roundDetails, 
        phase, 
        countdown: curCountdown, 
        isDragonRevealed, 
        isTigerRevealed, 
        roundStartTimeMs 
      } = timeState;

      // 1. New round transition
      if (activeGlobalRoundRef.current !== currentGlobalRound) {
        activeGlobalRoundRef.current = currentGlobalRound;
        setRoundId(roundDetails.roundId);
        setRoundStartTime(roundStartTimeMs);
        setRoundIndex(currentGlobalRound);

        activeDragonCardRef.current = roundDetails.dragonCard;
        activeTigerCardRef.current = roundDetails.tigerCard;
        activeWinningSideRef.current = roundDetails.winningSide;
        activeIsSuitedTieRef.current = roundDetails.isSuitedTie;

        setDragonCard(roundDetails.dragonCard);
        setTigerCard(roundDetails.tigerCard);
        setIsDragonCardRevealed(false);
        setIsTigerCardRevealed(false);
        setWinningSide(null);
        setIsSuitedTieResult(false);
        setRoundWinAmount(null);
        setShow8kRevealModal(false);
        setReveal8kData(null);

        // Snapshot previous bets for rebet
        const prevBets = {
          dragon: userBetDragonRef.current,
          tiger: userBetTigerRef.current,
          tie: userBetTieRef.current,
          suitedTie: userBetSuitedTieRef.current
        };
        if (prevBets.dragon > 0 || prevBets.tiger > 0 || prevBets.tie > 0 || prevBets.suitedTie > 0) {
          setLastBets(prevBets);
        }

        // Reset user active bets
        userBetDragonRef.current = 0;
        userBetTigerRef.current = 0;
        userBetTieRef.current = 0;
        userBetSuitedTieRef.current = 0;
        setUserBetDragon(0);
        setUserBetTiger(0);
        setUserBetTie(0);
        setUserBetSuitedTie(0);
        setBetHistoryStack([]);

        // Synchronized table pools
        setTablePoolDragon(roundDetails.tablePoolDragon);
        setTablePoolTiger(roundDetails.tablePoolTiger);
        setTablePoolTie(roundDetails.tablePoolTie);
        setTablePoolSuitedTie(roundDetails.tablePoolSuitedTie);
        setDragonBettors(roundDetails.dragonBettors);
        setTigerBettors(roundDetails.tigerBettors);
        setTieBettors(roundDetails.tieBettors);

        // Clear speech triggers for this fresh round
        spokenTriggersForRoundRef.current.clear();

        const openPhrase = getBetOpenPhrase(dealerLangRef.current, user.name);
        setDealerSubtitle(openPhrase);
        if (!isMuted && configRef.current.dealerVoiceEnabled) {
          playDealerSpeech(openPhrase, isMuted, dealerLangRef.current);
          spokenTriggersForRoundRef.current.add('round_start');
        }
      }

      // 2. Synchronized Phase Handling
      setGamePhase(phase);
      setCountdown(curCountdown);
      setIsDragonCardRevealed(isDragonRevealed);
      setIsTigerCardRevealed(isTigerRevealed);

      if (phase === 'betting') {
        if (curCountdown <= 4 && !spokenTriggersForRoundRef.current.has('final_seconds')) {
          spokenTriggersForRoundRef.current.add('final_seconds');
          const warnPhrase = getFinalSecondsPhrase(dealerLangRef.current);
          setDealerSubtitle(warnPhrase);
          if (!isMuted && configRef.current.dealerVoiceEnabled) {
            playDealerSpeech(warnPhrase, isMuted, dealerLangRef.current);
          }
        }
        if (curCountdown <= 3 && curCountdown > 0) {
          soundFx.playSpinTick();
        }
      } else if (phase === 'dealing') {
        if (!spokenTriggersForRoundRef.current.has('bets_closed')) {
          spokenTriggersForRoundRef.current.add('bets_closed');
          soundFx.playBetsClosed();
          const closePhrase = getBetsClosedPhrase(dealerLangRef.current);
          setDealerSubtitle(closePhrase);
          if (!isMuted && configRef.current.dealerVoiceEnabled) {
            playDealerSpeech(closePhrase, isMuted, dealerLangRef.current);
          }
        }

        // Continuous 0s synchronization: If admin forced winner or cards updated, apply immediately!
        if (activeWinningSideRef.current !== roundDetails.winningSide || !activeDragonCardRef.current || !activeTigerCardRef.current) {
          activeDragonCardRef.current = roundDetails.dragonCard;
          activeTigerCardRef.current = roundDetails.tigerCard;
          activeWinningSideRef.current = roundDetails.winningSide;
          activeIsSuitedTieRef.current = roundDetails.isSuitedTie;
          setDragonCard(roundDetails.dragonCard);
          setTigerCard(roundDetails.tigerCard);
        }
      } else if (phase === 'completed') {
        // Ensure winner state is always immediately set from deterministic round details
        setWinningSide(roundDetails.winningSide);
        setIsSuitedTieResult(roundDetails.isSuitedTie);
        if (activeWinningSideRef.current !== roundDetails.winningSide) {
          activeDragonCardRef.current = roundDetails.dragonCard;
          activeTigerCardRef.current = roundDetails.tigerCard;
          activeWinningSideRef.current = roundDetails.winningSide;
          activeIsSuitedTieRef.current = roundDetails.isSuitedTie;
          setDragonCard(roundDetails.dragonCard);
          setTigerCard(roundDetails.tigerCard);
        }

        if (settledRoundRef.current !== currentGlobalRound) {
          settledRoundRef.current = currentGlobalRound;
          executeRoundSettlement(
            currentGlobalRound, 
            roundDetails.roundId, 
            roundDetails.dragonCard, 
            roundDetails.tigerCard
          );
        }
      }
    }, 200);

    return () => clearInterval(cycleInterval);
  }, [isMuted]);

  // Execute round settlement
  const executeRoundSettlement = (
    roundNum: number, 
    currentRId: string, 
    dCardParam?: PlayingCard | null, 
    tCardParam?: PlayingCard | null
  ) => {
    const finalDCard = dCardParam || activeDragonCardRef.current || dragonCard;
    const finalTCard = tCardParam || activeTigerCardRef.current || tigerCard;
    if (!finalDCard || !finalTCard) return;

    const outcome = determineDragonTigerWinner(finalDCard, finalTCard);
    setWinningSide(outcome.winner);
    setIsSuitedTieResult(outcome.isSuitedTie);
    setIsDragonCardRevealed(true);
    setIsTigerCardRevealed(true);

    if (outcome.winner === 'dragon') {
      soundFx.playDragonRoar();
    } else if (outcome.winner === 'tiger') {
      soundFx.playTigerRoar();
    } else {
      soundFx.playTieGong();
    }

    // Active bets
    const activeBets = {
      dragon: userBetDragonRef.current,
      tiger: userBetTigerRef.current,
      tie: userBetTieRef.current,
      suitedTie: userBetSuitedTieRef.current
    };

    // Clean up live bets in Firestore after round settlement
    if (user?.id) {
      ['dragon', 'tiger', 'tie', 'suited_tie'].forEach((s) => {
        deleteDoc(doc(db, 'dragon_tiger_live_bets', `DTB_${currentRId}_${user.id}_${s}`)).catch(() => {});
      });
    }

    const betsToProcess: { side: DragonTigerSide; amount: number }[] = [
      { side: 'dragon' as const, amount: activeBets.dragon },
      { side: 'tiger' as const, amount: activeBets.tiger },
      { side: 'tie' as const, amount: activeBets.tie },
      { side: 'suited_tie' as const, amount: activeBets.suitedTie },
    ].filter((b) => b.amount > 0);

    let totalWin = 0;
    const betRecords: DragonTigerBet[] = [];

    betsToProcess.forEach((b) => {
      const payoutRes = calculateDragonTigerPayout(b, outcome.winner, outcome.isSuitedTie, configRef.current);
      totalWin += payoutRes.wonAmount;

      let mult = 2.0;
      if (b.side === 'tie') mult = configRef.current.tieMultiplier || 12.0;
      if (b.side === 'suited_tie') mult = configRef.current.suitedTieMultiplier || 51.0;

      const record: DragonTigerBet = {
        id: `dt_bet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        roundId: currentRId,
        userId: user.id,
        userName: user.name,
        userPhone: user.phone,
        side: b.side,
        amount: b.amount,
        payoutMultiplier: mult,
        wonAmount: payoutRes.wonAmount,
        status: payoutRes.status,
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
      };
      betRecords.push(record);
    });

    // Trigger 8K Ultra HD Winner Spotlight Reveal Modal (2-second showcase)
    setReveal8kData({
      gameType: 'dragon_tiger',
      winner: outcome.winner,
      isSuitedTie: outcome.isSuitedTie,
      winningCard: outcome.winner === 'dragon' ? finalDCard : outcome.winner === 'tiger' ? finalTCard : finalDCard,
      dragonCard: finalDCard,
      tigerCard: finalTCard,
      userWonAmount: totalWin
    });
    setShow8kRevealModal(true);

    // Dealer commentary & speech for round outcome
    if (totalWin > 0) {
      const winSpeech = getUserWinPhrase(dealerLangRef.current, user.name || 'Player', totalWin);
      setDealerSubtitle(winSpeech);
      if (!isMuted && configRef.current.dealerVoiceEnabled && !spokenTriggersForRoundRef.current.has('round_result')) {
        spokenTriggersForRoundRef.current.add('round_result');
        playDealerSpeech(winSpeech, isMuted, dealerLangRef.current);
      }
    } else {
      const outcomeSpeech = getRoundOutcomePhrase(
        dealerLangRef.current, 
        outcome.winner, 
        outcome.isSuitedTie, 
        finalDCard, 
        finalTCard
      );
      setDealerSubtitle(outcomeSpeech);
      if (!isMuted && configRef.current.dealerVoiceEnabled && !spokenTriggersForRoundRef.current.has('round_result')) {
        spokenTriggersForRoundRef.current.add('round_result');
        playDealerSpeech(outcomeSpeech, isMuted, dealerLangRef.current);
      }
    }

    // After 2.8s, invite player to place bet for next round calling their name
    addSafeTimeout(() => {
      if (!spokenTriggersForRoundRef.current.has('invite_next')) {
        spokenTriggersForRoundRef.current.add('invite_next');
        const invitePhrase = getNextRoundInvitePhrase(dealerLangRef.current, user.name);
        setDealerSubtitle(invitePhrase);
        if (!isMuted && configRef.current.dealerVoiceEnabled) {
          playDealerSpeech(invitePhrase, isMuted, dealerLangRef.current);
        }
      }
    }, 2800);

    // Append new bead to the RIGHT side of bead road
    const newBeadRecord: BeadRecord = {
      id: `bead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      winner: outcome.winner,
      isSuitedTie: outcome.isSuitedTie,
      dragonRank: finalDCard.rank,
      dragonSuit: finalDCard.suit,
      tigerRank: finalTCard.rank,
      tigerSuit: finalTCard.suit,
    };
    setBeadRoad((prev) => [...prev, newBeadRecord].slice(-45));

    const resolvedDtBreakdown = betsToProcess.map((b) => {
      const payoutRes = calculateDragonTigerPayout(b, outcome.winner, outcome.isSuitedTie, configRef.current);
      const isWin = payoutRes.wonAmount > 0;
      let spotLabel = b.side === 'dragon' ? '🐉 DRAGON (ড্রাগন)' : b.side === 'tiger' ? '🐯 TIGER (টাইগার)' : b.side === 'tie' ? '🤝 TIE (টাই)' : '👑 SUITED TIE (সুটেড টাই)';
      let multStr = b.side === 'suited_tie' ? '51x (50:1)' : b.side === 'tie' ? '12x (8:1)' : '2x (1:1)';
      return {
        spot: spotLabel,
        type: 'side',
        detail: b.side,
        amount: b.amount,
        isWin,
        multiplier: isWin ? multStr : '0x',
        payout: payoutRes.wonAmount,
        outcomeProof: isWin ? `Won ₹${payoutRes.wonAmount.toLocaleString('en-IN')}` : `Lost to ${outcome.winner.toUpperCase()} (${finalDCard.rank}${finalDCard.suit} vs ${finalTCard.rank}${finalTCard.suit})`
      };
    });

    // Handle Win vs Loss
    if (totalWin > 0) {
      soundFx.playWinFanfare();
      setRoundWinAmount(totalWin);
      triggerConfetti({ particleCount: 70, spread: 60 });

      const newBal = balanceRef.current + totalWin;
      balanceRef.current = newBal;
      prevReportedBalRef.current = newBal;
      setCurrentBalance(newBal);
      onUpdateBalance(newBal);

      onBigWin?.({
        id: `dt-win-${Date.now()}`,
        category: 'dragon_tiger',
        title: `${outcome.winner === 'dragon' ? 'ড্রাগন' : outcome.winner === 'tiger' ? 'টাইগার' : 'টাই'} জয়ী!`,
        subtitle: `DRAGON TIGER ROYAL WIN (${outcome.winner.toUpperCase()})`,
        amount: totalWin,
        multiplier: outcome.isSuitedTie ? '51x' : outcome.winner === 'tie' ? '12x' : '2x',
        drawOrRoundId: currentRId,
        cards: {
          dragon: finalDCard,
          tiger: finalTCard,
          side: outcome.winner
        }
      });

      const spotsPlacedText = betsToProcess.map(b => `${b.side.toUpperCase()}: ₹${b.amount}`).join(', ');
      const tx: WalletTransaction = {
        id: `TX-DT-WIN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: user.id,
        userEmail: (user.email || '').toLowerCase().trim(),
        type: 'dragon_tiger_win',
        amount: totalWin,
        description: `Won ₹${totalWin.toLocaleString('en-IN')} on Dragon Tiger #${currentRId} (${outcome.winner.toUpperCase()}) [Bets: ${spotsPlacedText}] [Cards: 🐉 ${finalDCard.rank}${finalDCard.suit} vs 🐯 ${finalTCard.rank}${finalTCard.suit}]`,
        roundId: currentRId,
        gameType: 'dragon_tiger',
        winningOutcome: `${outcome.winner.toUpperCase()} WON (🐉 ${finalDCard.rank}${finalDCard.suit} vs 🐯 ${finalTCard.rank}${finalTCard.suit})`,
        betsBreakdown: resolvedDtBreakdown,
        status: 'completed',
        date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        createdAt: new Date().toISOString(),
      };
      onAddTransaction(tx);

      setLiveWinners((prev) => [
        { id: `win_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, name: user.name || 'You', amount: totalWin },
        ...prev.slice(0, 9)
      ]);
    } else if (betsToProcess.length > 0) {
      // Zero refund on losing bets
      soundFx.playLossSound();
      setRoundWinAmount(0);
    }

    // Persist bets to Firestore
    if (betRecords.length > 0) {
      setMyBetsHistory((prev) => [...betRecords, ...prev].slice(0, 50));
      for (const bet of betRecords) {
        setDoc(doc(db, 'dragon_tiger_bets', bet.id), bet).catch(() => {});
      }
    }

    // Persist round outcome to Firestore
    const roundDoc: DragonTigerRound = {
      id: currentRId,
      roundNumber: roundNum,
      dragonCard: finalDCard,
      tigerCard: finalTCard,
      winningSide: outcome.winner,
      isSuitedTie: outcome.isSuitedTie,
      status: 'completed',
      startTime: Date.now() - 26000,
      endTime: Date.now(),
      totalBetsDragon: tablePoolDragon + activeBets.dragon,
      totalBetsTiger: tablePoolTiger + activeBets.tiger,
      totalBetsTie: tablePoolTie + activeBets.tie,
      totalBetsSuitedTie: tablePoolSuitedTie + activeBets.suitedTie,
      totalPayout: totalWin,
      createdAt: new Date().toISOString(),
    };
    setDoc(doc(db, 'dragon_tiger_rounds', currentRId), roundDoc).catch(() => {});
  };

  // Place Bet Click
  const handlePlaceBet = (side: DragonTigerSide) => {
    if (gamePhase !== 'betting') return;
    if (countdown <= 0) return;

    // 1. Strict Opposite Bet Restriction (Dragon vs Tiger)
    if (config.preventBothDragonTigerBet !== false) {
      if (side === 'dragon' && userBetTigerRef.current > 0) {
        soundFx.playError();
        setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: ড্রাগন এবং টাইগার একসাথে বাজি ধরা যাবে না!');
        return;
      }
      if (side === 'tiger' && userBetDragonRef.current > 0) {
        soundFx.playError();
        setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: ড্রাগন এবং টাইগার একসাথে বাজি ধরা যাবে না!');
        return;
      }
    }

    const minBet = config.minBet || 50;
    const maxBet = config.maxBet || 15000000;

    if (selectedChip < minBet) {
      soundFx.playError();
      setRestrictionToast(`⚠️ সর্বনিম্ন বাজি ₹${minBet.toLocaleString('en-IN')}`);
      return;
    }

    const currentBal = balanceRef.current;
    if (currentBal < selectedChip) {
      soundFx.playError();
      setShowLowBalanceModal(true);
      return;
    }

    // Check side max
    const currentBetOnSide = 
      side === 'dragon' ? userBetDragonRef.current : 
      side === 'tiger' ? userBetTigerRef.current : 
      side === 'tie' ? userBetTieRef.current : userBetSuitedTieRef.current;

    if (currentBetOnSide + selectedChip > maxBet) {
      alert(`Maximum bet per sector is ₹${maxBet.toLocaleString('en-IN')}`);
      return;
    }

    // Deduct balance
    const newBal = Math.max(0, currentBal - selectedChip);
    balanceRef.current = newBal;
    prevReportedBalRef.current = newBal;
    setCurrentBalance(newBal);
    onUpdateBalance(newBal);

    let spotLabel = side === 'dragon' ? '🐉 DRAGON (ড্রাগন)' : side === 'tiger' ? '🐯 TIGER (টাইগার)' : side === 'tie' ? '🤝 TIE (টাই)' : '👑 SUITED TIE (সুটেড টাই)';
    let multStr = side === 'suited_tie' ? '51x (50:1)' : side === 'tie' ? '12x (8:1)' : '2x (1:1)';

    // Record wallet transaction
    const betTx: WalletTransaction = {
      id: `TX-DT-BET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: user.id,
      userEmail: (user.email || '').toLowerCase().trim(),
      type: 'dragon_tiger_bet',
      amount: -selectedChip,
      description: `Bet ₹${selectedChip.toLocaleString('en-IN')} on ${side.replace('_', ' ').toUpperCase()} (Dragon Tiger #${roundId})`,
      roundId,
      gameType: 'dragon_tiger',
      betsBreakdown: [
        {
          spot: spotLabel,
          type: 'side',
          detail: side,
          amount: selectedChip,
          isWin: false,
          multiplier: multStr,
          payout: 0,
          outcomeProof: 'Round in progress'
        }
      ],
      status: 'completed',
      date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      createdAt: new Date().toISOString(),
    };
    onAddTransaction(betTx);

    // Real-time Activity Log for Admin Alert & Bengali Voice Announcement
    logLiveActivity({
      userId: user.id,
      userName: user.name || 'Player',
      userEmail: user.email,
      userPhone: user.phone,
      type: 'bet',
      gameName: 'Dragon Tiger',
      betAmount: selectedChip,
      details: `Placed ₹${selectedChip} on ${side.toUpperCase()} (Dragon Tiger)`
    });

    soundFx.playChipPlace();

    if (side === 'dragon') {
      userBetDragonRef.current += selectedChip;
      setUserBetDragon((prev) => prev + selectedChip);
      setTablePoolDragon((prev) => prev + selectedChip);
    } else if (side === 'tiger') {
      userBetTigerRef.current += selectedChip;
      setUserBetTiger((prev) => prev + selectedChip);
      setTablePoolTiger((prev) => prev + selectedChip);
    } else if (side === 'tie') {
      userBetTieRef.current += selectedChip;
      setUserBetTie((prev) => prev + selectedChip);
      setTablePoolTie((prev) => prev + selectedChip);
    } else if (side === 'suited_tie') {
      userBetSuitedTieRef.current += selectedChip;
      setUserBetSuitedTie((prev) => prev + selectedChip);
      setTablePoolSuitedTie((prev) => prev + selectedChip);
    }

    setBetHistoryStack((prev) => [...prev, { side, amount: selectedChip }]);

    // Real-Time Live Bet Sync for Admin Live Monitor (0-second latency)
    if (user?.id) {
      const liveBetDocId = `DTB_${roundId}_${user.id}_${side}`;
      const sideTotal = 
        side === 'dragon' ? userBetDragonRef.current : 
        side === 'tiger' ? userBetTigerRef.current : 
        side === 'tie' ? userBetTieRef.current : userBetSuitedTieRef.current;
      const mult = side === 'suited_tie' ? (config.suitedTieMultiplier || 51) : side === 'tie' ? (config.tieMultiplier || 12) : (side === 'tiger' ? (config.tigerMultiplier || 2) : (config.dragonMultiplier || 2));
      setDoc(doc(db, 'dragon_tiger_live_bets', liveBetDocId), {
        id: liveBetDocId,
        roundId,
        userId: user.id,
        userName: user.name || 'Player',
        userPhone: user.phone || '',
        userEmail: user.email || '',
        side,
        amount: sideTotal,
        multiplier: mult,
        potentialWin: Math.round(sideTotal * mult),
        timestamp: Date.now(),
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }, { merge: true }).catch(() => {});
    }
  };

  // Undo Last Bet
  const handleUndo = () => {
    if (gamePhase !== 'betting') return;
    if (betHistoryStack.length === 0) return;

    const lastAction = betHistoryStack[betHistoryStack.length - 1];
    const { side, amount } = lastAction;

    // Refund
    const newBal = balanceRef.current + amount;
    balanceRef.current = newBal;
    prevReportedBalRef.current = newBal;
    setCurrentBalance(newBal);
    onUpdateBalance(newBal);

    soundFx.playClick();

    if (side === 'dragon') {
      userBetDragonRef.current = Math.max(0, userBetDragonRef.current - amount);
      setUserBetDragon(userBetDragonRef.current);
      setTablePoolDragon((prev) => Math.max(0, prev - amount));
    } else if (side === 'tiger') {
      userBetTigerRef.current = Math.max(0, userBetTigerRef.current - amount);
      setUserBetTiger(userBetTigerRef.current);
      setTablePoolTiger((prev) => Math.max(0, prev - amount));
    } else if (side === 'tie') {
      userBetTieRef.current = Math.max(0, userBetTieRef.current - amount);
      setUserBetTie(userBetTieRef.current);
      setTablePoolTie((prev) => Math.max(0, prev - amount));
    } else if (side === 'suited_tie') {
      userBetSuitedTieRef.current = Math.max(0, userBetSuitedTieRef.current - amount);
      setUserBetSuitedTie(userBetSuitedTieRef.current);
      setTablePoolSuitedTie((prev) => Math.max(0, prev - amount));
    }

    setBetHistoryStack((prev) => prev.slice(0, -1));

    // Sync Undo to Real-Time Live Bets
    if (user?.id) {
      const liveBetDocId = `DTB_${roundId}_${user.id}_${side}`;
      const sideRemaining = 
        side === 'dragon' ? userBetDragonRef.current : 
        side === 'tiger' ? userBetTigerRef.current : 
        side === 'tie' ? userBetTieRef.current : userBetSuitedTieRef.current;
      if (sideRemaining <= 0) {
        deleteDoc(doc(db, 'dragon_tiger_live_bets', liveBetDocId)).catch(() => {});
      } else {
        const mult = side === 'suited_tie' ? (config.suitedTieMultiplier || 51) : side === 'tie' ? (config.tieMultiplier || 12) : 2;
        setDoc(doc(db, 'dragon_tiger_live_bets', liveBetDocId), {
          amount: sideRemaining,
          potentialWin: Math.round(sideRemaining * mult),
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }
    }
  };

  // Double Current Bets (2X)
  const handleDouble = () => {
    if (gamePhase !== 'betting') return;
    const totalPlaced = userBetDragonRef.current + userBetTigerRef.current + userBetTieRef.current + userBetSuitedTieRef.current;
    if (totalPlaced <= 0) return;

    if (balanceRef.current < totalPlaced) {
      soundFx.playError();
      setShowLowBalanceModal(true);
      return;
    }

    soundFx.playChipPlace();
    const newBal = Math.max(0, balanceRef.current - totalPlaced);
    balanceRef.current = newBal;
    prevReportedBalRef.current = newBal;
    setCurrentBalance(newBal);
    onUpdateBalance(newBal);

    setTablePoolDragon((prev) => prev + userBetDragonRef.current);
    setTablePoolTiger((prev) => prev + userBetTigerRef.current);
    setTablePoolTie((prev) => prev + userBetTieRef.current);
    setTablePoolSuitedTie((prev) => prev + userBetSuitedTieRef.current);

    userBetDragonRef.current *= 2;
    userBetTigerRef.current *= 2;
    userBetTieRef.current *= 2;
    userBetSuitedTieRef.current *= 2;

    setUserBetDragon(userBetDragonRef.current);
    setUserBetTiger(userBetTigerRef.current);
    setUserBetTie(userBetTieRef.current);
    setUserBetSuitedTie(userBetSuitedTieRef.current);

    // Sync Doubled Live Bets to Firestore
    if (user?.id) {
      const sidesToUpdate: { side: DragonTigerSide; amount: number; mult: number }[] = [
        { side: 'dragon', amount: userBetDragonRef.current, mult: config.dragonMultiplier || 2 },
        { side: 'tiger', amount: userBetTigerRef.current, mult: config.tigerMultiplier || 2 },
        { side: 'tie', amount: userBetTieRef.current, mult: config.tieMultiplier || 12 },
        { side: 'suited_tie', amount: userBetSuitedTieRef.current, mult: config.suitedTieMultiplier || 51 },
      ];
      sidesToUpdate.forEach(({ side: s, amount: amt, mult }) => {
        if (amt > 0) {
          const liveBetDocId = `DTB_${roundId}_${user.id}_${s}`;
          setDoc(doc(db, 'dragon_tiger_live_bets', liveBetDocId), {
            amount: amt,
            potentialWin: Math.round(amt * mult),
            timestamp: Date.now()
          }, { merge: true }).catch(() => {});
        }
      });
    }
  };

  // Calculate percentages for the oval display
  const totalPoolAll = (tablePoolDragon + tablePoolTiger + tablePoolTie + tablePoolSuitedTie) || 1;
  const pctDragon = Math.round((tablePoolDragon / totalPoolAll) * 100);
  const pctTiger = Math.round((tablePoolTiger / totalPoolAll) * 100);
  const pctTie = Math.round(((tablePoolTie + tablePoolSuitedTie) / totalPoolAll) * 100);

  const dragonCount = beadRoad.filter(b => b.winner === 'dragon').length;
  const tigerCount = beadRoad.filter(b => b.winner === 'tiger').length;
  const tieCount = beadRoad.filter(b => b.winner === 'tie' || b.winner === 'suited_tie').length;

  const totalUserBet = userBetDragon + userBetTiger + userBetTie + userBetSuitedTie;

  // Send Chat message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChatMessage.trim()) return;
    const msg: ChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: user.name || 'Player',
      text: inputChatMessage.trim(),
      time: generateRoundTimestampId(),
    };
    setChatMessages((prev) => [...prev, msg]);
    setInputChatMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0d12] text-white flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-200">
      
      {/* 1. TOP HEADER (Exact Evolution Bar with Language Switcher) */}
      <header className="h-12 sm:h-14 px-2 sm:px-4 bg-[#11131a] border-b border-white/10 flex items-center justify-between z-30 shrink-0 gap-1.5">
        
        {/* Left: Back Button & Language Switcher Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="flex items-center gap-1 text-slate-300 hover:text-white font-medium text-sm transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
            <span className="font-semibold hidden xs:inline">Back</span>
          </button>

          {/* Language Switcher Pill Toggle [ বাংলা | EN | हिंदी ] */}
          <div className="flex items-center bg-[#1c1f2a] border border-white/15 rounded-lg p-0.5 shadow-inner">
            <button
              onClick={() => handleSetLanguage('bn')}
              title="বাংলা ভাষা (Bengali)"
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                dealerLang === 'bn' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm scale-105' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              বাংলা
            </button>
            <button
              onClick={() => handleSetLanguage('en')}
              title="English"
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                dealerLang === 'en' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm scale-105' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => handleSetLanguage('hi')}
              title="हिंदी भाषा (Hindi)"
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                dealerLang === 'hi' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm scale-105' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Center: Currency & Balance with Deposit Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center bg-[#1c1f2a] border border-white/10 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-mono">
            <span className="text-slate-400 mr-1 sm:mr-1.5 text-[10px]">INR</span>
            <span className="font-bold text-white text-xs sm:text-sm">₹ {(currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onOpenDeposit();
            }}
            className="flex items-center gap-1 bg-[#00a859] hover:bg-[#00c868] text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span className="hidden sm:inline">Deposit</span>
          </button>
        </div>

        {/* Right: Settings & Bookmark */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              soundFx.playClick();
              setShowSettingsModal(true);
            }}
            title="Audio & Language Settings"
            className="p-1.5 rounded-lg border bg-[#1c1f2a] border-white/10 text-slate-400 hover:text-white hover:border-amber-400/50 transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setIsBookmarked(!isBookmarked);
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${isBookmarked ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'bg-[#1c1f2a] border-white/10 text-slate-400 hover:text-white'}`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* 2. LIVE DEALER VIDEO STREAM AREA */}
      <div className="relative w-full h-[38vh] sm:h-[45vh] bg-black overflow-hidden shrink-0">
        
        {/* Dynamic Live Dealer Stream Background */}
        <img 
          src={
            gamePhase === 'dealing' 
              ? dtDealerDealingImg 
              : gamePhase === 'completed' 
              ? dtDealerTableImg 
              : dtDealerWelcomeImg
          }
          alt="Dragon Tiger Live Dealer Feed"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover brightness-90 contrast-105 transition-all duration-700 scale-100"
        />

        {/* Cinematic Table Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-transparent to-black/60 pointer-events-none" />

        {/* Top Overlay: Tap to Unmute Banner */}
        {isMuted && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => {
                setIsMuted(false);
                setHasInteractedAudio(true);
                soundFx.toggleMute();
              }}
              className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg hover:bg-black/90 active:scale-95 transition-all cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
              <span>Tap to unmute</span>
            </button>
          </div>
        )}

        {/* Circular Countdown Progress Timer on Top Right */}
        {gamePhase === 'betting' && (
          <div className="absolute top-3 right-3 z-20 flex items-center justify-center">
            <div className="relative w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center bg-black/70 backdrop-blur-md rounded-full border border-white/20 shadow-2xl">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/10"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={`transition-all duration-1000 ease-linear ${countdown <= 3 ? 'text-rose-500 animate-pulse' : countdown <= 6 ? 'text-amber-400' : 'text-emerald-400'}`}
                  strokeDasharray={`${(countdown / (config.bettingDurationSeconds || 12)) * 100}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className={`absolute font-black text-sm sm:text-base font-mono ${countdown <= 3 ? 'text-rose-400 scale-110' : 'text-emerald-300'}`}>
                {countdown}
              </span>
            </div>
          </div>
        )}

        {/* Live Dealer Stage Table Felt Labels and Active Card Reveal Arena */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4 pointer-events-none">
          
          {/* Top Title Bar */}
          <div className="flex items-center justify-between px-2 sm:px-6 opacity-90">
            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-base font-serif font-black tracking-widest text-red-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] flex items-center gap-1">
                <span>🐉</span> DRAGON
              </span>
              <div className="w-12 h-0.5 bg-red-600 rounded-full mt-0.5 shadow-lg" />
            </div>

            {/* Global Round ID */}
            <div className="bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 text-[10px] sm:text-xs font-mono text-slate-300">
              #{roundId}
            </div>

            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-base font-serif font-black tracking-widest text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] flex items-center gap-1">
                TIGER <span>🐅</span>
              </span>
              <div className="w-12 h-0.5 bg-amber-500 rounded-full mt-0.5 shadow-lg" />
            </div>
          </div>

          {/* Center: Interactive Live Card Reveal Battle Arena */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 my-auto">
            
            {/* DRAGON CARD ARENA */}
            <div className="flex flex-col items-center">
              <div className={`relative w-16 h-24 sm:w-22 sm:h-32 rounded-xl sm:rounded-2xl border-2 shadow-2xl transition-all duration-500 flex flex-col justify-between p-1.5 sm:p-2 ${
                dragonCard && isDragonCardRevealed
                  ? winningSide === 'dragon'
                    ? 'bg-white border-yellow-400 ring-4 ring-yellow-400/80 shadow-[0_0_30px_rgba(250,204,21,0.8)] scale-105'
                    : 'bg-white border-slate-300'
                  : 'bg-gradient-to-br from-red-800 via-rose-900 to-red-950 border-amber-400/70 shadow-red-950/80'
              }`}>
                {dragonCard && isDragonCardRevealed ? (
                  <>
                    <div className="flex items-center justify-between leading-none font-black font-mono text-sm sm:text-base">
                      <span className={dragonCard.suit === 'hearts' || dragonCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                        {dragonCard.rank}
                      </span>
                      <span className={dragonCard.suit === 'hearts' || dragonCard.suit === 'diamonds' ? 'text-red-600 text-sm sm:text-base' : 'text-black text-sm sm:text-base'}>
                        {dragonCard.suit === 'hearts' ? '♥' : dragonCard.suit === 'diamonds' ? '♦' : dragonCard.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                    </div>

                    {/* Big Center Suit */}
                    <div className="text-center text-2xl sm:text-4xl my-auto leading-none drop-shadow-sm">
                      <span className={dragonCard.suit === 'hearts' || dragonCard.suit === 'diamonds' ? 'text-red-600' : 'text-slate-950'}>
                        {dragonCard.suit === 'hearts' ? '♥' : dragonCard.suit === 'diamonds' ? '♦' : dragonCard.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                    </div>

                    {/* Bottom Points Value */}
                    <div className="flex items-center justify-between font-mono text-[9px] sm:text-[11px] font-bold border-t border-slate-200 pt-0.5">
                      <span className="text-slate-600 bg-slate-100 px-1 rounded">
                        {getRankNumericValue(dragonCard.rank)} Pts
                      </span>
                      {winningSide === 'dragon' && (
                        <span className="text-amber-600 font-extrabold flex items-center gap-0.5">
                          <Crown className="w-3 h-3 text-amber-500 fill-amber-400" /> WIN
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-amber-300 font-serif font-black text-center">
                    <span className="text-xl sm:text-2xl drop-shadow-md">🐉</span>
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-200 font-mono mt-1">Dragon</span>
                  </div>
                )}

                {/* Winner Crown Tag on Dragon */}
                {winningSide === 'dragon' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2 py-0.5 rounded-full font-black text-[9px] sm:text-[10px] uppercase shadow-lg flex items-center gap-1 border border-white animate-bounce">
                    <Crown className="w-3 h-3 fill-slate-950" /> WINNER
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-bold font-mono text-red-300 mt-1">DRAGON</span>
            </div>

            {/* CENTER STATUS & RESULT BADGE */}
            <div className="flex flex-col items-center justify-center min-w-[90px] sm:min-w-[120px] text-center">
              {gamePhase === 'completed' && winningSide ? (
                <div className="space-y-1 animate-in zoom-in duration-300">
                  <div className={`px-2.5 sm:px-3 py-1 rounded-xl font-black font-serif text-xs sm:text-sm tracking-wide shadow-xl border ${
                    winningSide === 'dragon'
                      ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-yellow-300'
                      : winningSide === 'tiger'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 border-amber-200'
                      : winningSide === 'suited_tie'
                      ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300 text-slate-950 border-white animate-pulse'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-300'
                  }`}>
                    {winningSide === 'dragon' && '🐉 DRAGON WINS!'}
                    {winningSide === 'tiger' && '🐅 TIGER WINS!'}
                    {winningSide === 'tie' && '🟢 TIE (11:1)'}
                    {winningSide === 'suited_tie' && '✨ SUITED TIE (50:1)'}
                  </div>

                  {dragonCard && tigerCard && (
                    <div className="text-[9px] sm:text-[11px] font-mono font-bold text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
                      {getRankNumericValue(dragonCard.rank)} vs {getRankNumericValue(tigerCard.rank)}
                    </div>
                  )}

                  {/* Player Win / Loss Outcome Notification */}
                  {roundWinAmount !== null && (
                    <div className={`text-[10px] sm:text-xs font-bold font-mono px-2 py-0.5 rounded-lg shadow-lg ${
                      roundWinAmount > 0 
                        ? 'bg-emerald-500 text-slate-950 border border-white animate-bounce' 
                        : 'bg-slate-900/90 text-rose-300 border border-rose-500/30'
                    }`}>
                      {roundWinAmount > 0 
                        ? `🎉 WON ₹${roundWinAmount.toLocaleString('en-IN')}` 
                        : (userBetDragon + userBetTiger + userBetTie + userBetSuitedTie > 0 ? '❌ Round Lost' : 'Round Over')}
                    </div>
                  )}
                </div>
              ) : gamePhase === 'dealing' ? (
                <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-amber-400/40 text-center">
                  <span className="text-xs sm:text-sm font-black font-serif text-amber-300 animate-pulse tracking-wider">
                    DEALING...
                  </span>
                </div>
              ) : (
                <div className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-center">
                  <span className="text-xs sm:text-sm font-black font-serif text-white/80 tracking-wider">
                    VS
                  </span>
                </div>
              )}
            </div>

            {/* TIGER CARD ARENA */}
            <div className="flex flex-col items-center">
              <div className={`relative w-16 h-24 sm:w-22 sm:h-32 rounded-xl sm:rounded-2xl border-2 shadow-2xl transition-all duration-500 flex flex-col justify-between p-1.5 sm:p-2 ${
                tigerCard && isTigerCardRevealed
                  ? winningSide === 'tiger'
                    ? 'bg-white border-yellow-400 ring-4 ring-yellow-400/80 shadow-[0_0_30px_rgba(250,204,21,0.8)] scale-105'
                    : 'bg-white border-slate-300'
                  : 'bg-gradient-to-bl from-amber-700 via-amber-800 to-amber-950 border-amber-400/70 shadow-amber-950/80'
              }`}>
                {tigerCard && isTigerCardRevealed ? (
                  <>
                    <div className="flex items-center justify-between leading-none font-black font-mono text-sm sm:text-base">
                      <span className={tigerCard.suit === 'hearts' || tigerCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                        {tigerCard.rank}
                      </span>
                      <span className={tigerCard.suit === 'hearts' || tigerCard.suit === 'diamonds' ? 'text-red-600 text-sm sm:text-base' : 'text-black text-sm sm:text-base'}>
                        {tigerCard.suit === 'hearts' ? '♥' : tigerCard.suit === 'diamonds' ? '♦' : tigerCard.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                    </div>

                    {/* Big Center Suit */}
                    <div className="text-center text-2xl sm:text-4xl my-auto leading-none drop-shadow-sm">
                      <span className={tigerCard.suit === 'hearts' || tigerCard.suit === 'diamonds' ? 'text-red-600' : 'text-slate-950'}>
                        {tigerCard.suit === 'hearts' ? '♥' : tigerCard.suit === 'diamonds' ? '♦' : tigerCard.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                    </div>

                    {/* Bottom Points Value */}
                    <div className="flex items-center justify-between font-mono text-[9px] sm:text-[11px] font-bold border-t border-slate-200 pt-0.5">
                      <span className="text-slate-600 bg-slate-100 px-1 rounded">
                        {getRankNumericValue(tigerCard.rank)} Pts
                      </span>
                      {winningSide === 'tiger' && (
                        <span className="text-amber-600 font-extrabold flex items-center gap-0.5">
                          <Crown className="w-3 h-3 text-amber-500 fill-amber-400" /> WIN
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-amber-300 font-serif font-black text-center">
                    <span className="text-xl sm:text-2xl drop-shadow-md">🐅</span>
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-200 font-mono mt-1">Tiger</span>
                  </div>
                )}

                {/* Winner Crown Tag on Tiger */}
                {winningSide === 'tiger' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2 py-0.5 rounded-full font-black text-[9px] sm:text-[10px] uppercase shadow-lg flex items-center gap-1 border border-white animate-bounce">
                    <Crown className="w-3 h-3 fill-slate-950" /> WINNER
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-bold font-mono text-amber-300 mt-1">TIGER</span>
            </div>

          </div>

          {/* Bottom Space for Ticker */}
          <div className="h-6" />
        </div>

        {/* Floating Live Winners Feed Marquee on Left */}
        <div className="absolute top-12 left-2 z-10 max-w-[170px] pointer-events-none space-y-0.5 font-mono text-[10px] hidden sm:block">
          {liveWinners.slice(0, 5).map((w, idx) => (
            <div key={`${w.id || 'w'}_${idx}`} className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-white/90 flex items-center justify-between animate-in slide-in-from-left duration-300">
              <span className="truncate text-amber-300 mr-1">{w.name}</span>
              <span className="font-bold text-emerald-400">₹{w.amount.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>

        {/* Bottom Left: Live Subtitle / Chat Ticker (Exact Evolution style) */}
        <div className="absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-[11px] text-white/90 max-w-[85%] truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-amber-300">Dealer:</span>
            <span className="truncate">{dealerSubtitle}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              if (nextMute) soundFx.toggleMute();
            }}
            className="p-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-slate-300 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
          </button>
        </div>

      </div>

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

      {/* 3. SIGNATURE EVOLUTION OVAL / SPLIT BETTING TABLE */}
      <div className="flex-1 flex flex-col justify-between px-2 sm:px-4 py-1.5 sm:py-2 bg-[#0c0d12] overflow-y-auto">
        
        {/* The 3-Way Oval Board */}
        <div className="relative grid grid-cols-12 gap-1.5 sm:gap-2 max-w-2xl mx-auto w-full items-stretch">
          
          {/* DRAGON OVAL (LEFT 5 COLS) */}
          <div 
            onClick={() => handlePlaceBet('dragon')}
            className={`col-span-5 relative rounded-2xl sm:rounded-3xl border-2 p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xl min-h-[140px] sm:min-h-[160px] ${
              userBetTiger > 0 ? 'opacity-60 grayscale-[30%]' : ''
            } ${
              winningSide === 'dragon' 
                ? 'bg-gradient-to-br from-[#591016] via-[#7d131d] to-[#3a0a0e] border-[#ff4d5a] ring-4 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-[1.02]' 
                : 'bg-gradient-to-br from-[#400e12] via-[#2c0a0d] to-[#1a0608] border-[#7d1c24] hover:border-[#a82934] active:scale-98'
            }`}
          >
            {userBetTiger > 0 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-rose-500/60 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-bold text-rose-300 flex items-center gap-1 shadow-md z-30 pointer-events-none">
                <Lock className="w-2.5 h-2.5" />
                <span>লকড</span>
              </div>
            )}
            {/* Top Pool Info & Percent Badge */}
            <div className="flex items-start justify-between font-mono text-[10px] sm:text-xs">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-950/80 border border-red-500/40 flex items-center justify-center font-bold text-red-300">
                {pctDragon}%
              </div>
              <div className="text-right">
                <div className="font-bold text-white leading-tight">₹ {tablePoolDragon.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                <div className="text-[9px] text-red-300/80 flex items-center justify-end gap-0.5">
                  <span>👤</span>
                  <span>{dragonBettors}</span>
                </div>
              </div>
            </div>

            {/* Middle: Playing Card Spot & Reveal */}
            <div className="my-1 flex items-center justify-center">
              {dragonCard ? (
                <div className={`relative w-12 h-16 sm:w-16 sm:h-22 rounded-lg sm:rounded-xl border-2 bg-white flex flex-col justify-between p-1 shadow-2xl transition-all duration-300 ${
                  isDragonCardRevealed ? 'animate-in zoom-in-75' : 'bg-gradient-to-br from-red-800 to-red-950 border-amber-400'
                } ${winningSide === 'dragon' ? 'ring-4 ring-yellow-400 scale-105 shadow-amber-400/50' : 'border-slate-300'}`}>
                  {isDragonCardRevealed ? (
                    <>
                      <div className="flex items-center justify-between leading-none font-bold font-mono text-xs sm:text-sm">
                        <span className={dragonCard.suit === 'hearts' || dragonCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                          {dragonCard.rank}
                        </span>
                        <span className={dragonCard.suit === 'hearts' || dragonCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                          {dragonCard.suit === 'hearts' ? '♥' : dragonCard.suit === 'diamonds' ? '♦' : dragonCard.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                      <div className="text-center text-lg sm:text-2xl leading-none">
                        <span className={dragonCard.suit === 'hearts' || dragonCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                          {dragonCard.suit === 'hearts' ? '♥' : dragonCard.suit === 'diamonds' ? '♦' : dragonCard.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between leading-none font-bold font-mono text-[9px] sm:text-xs">
                        <span className="text-slate-500">{getRankNumericValue(dragonCard.rank)}pt</span>
                        {winningSide === 'dragon' && <span className="text-amber-500 font-bold">WIN</span>}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-amber-300 text-xs font-mono font-bold">
                      <span>🐉</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-12 h-16 sm:w-16 sm:h-22 rounded-lg sm:rounded-xl border-2 border-dashed border-red-500/30 bg-red-950/20 flex flex-col items-center justify-center text-red-400/60 font-mono text-[10px]">
                  <span>CARD</span>
                </div>
              )}
            </div>

            {/* Bottom Label & Multiplier */}
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[10px] text-red-300/80 font-bold font-mono">1:1</span>
                <h3 className="text-base sm:text-lg font-black font-serif tracking-wider text-white">DRAGON</h3>
              </div>

              {/* User Placed Chip Badge */}
              {userBetDragon > 0 && (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-700 border-2 border-amber-300 shadow-xl flex items-center justify-center font-mono font-black text-xs text-white animate-in zoom-in">
                  ₹{userBetDragon}
                </div>
              )}
            </div>
          </div>

          {/* CENTER TIE / SUITED TIE OVAL (CENTER 2 COLS) */}
          <div className="col-span-2 flex flex-col gap-1.5 justify-between">
            
            {/* TIE (11:1) Button */}
            <div 
              onClick={() => handlePlaceBet('tie')}
              className={`flex-1 relative rounded-xl sm:rounded-2xl border-2 p-1.5 flex flex-col items-center justify-between text-center transition-all duration-200 cursor-pointer shadow-lg ${
                winningSide === 'tie' || winningSide === 'suited_tie'
                  ? 'bg-gradient-to-b from-[#0a4d2c] via-[#107040] to-[#08331d] border-[#34d399] ring-4 ring-emerald-400/60 scale-105 shadow-[0_0_20px_rgba(52,211,153,0.6)]'
                  : 'bg-gradient-to-b from-[#0e3321] via-[#092417] to-[#05140d] border-[#1b5e3d] hover:border-[#2bb06f] active:scale-95'
              }`}
            >
              <div className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-300">{pctTie}%</div>
              <div>
                <div className="text-[8px] sm:text-[9px] text-emerald-300 font-bold font-mono">11:1</div>
                <div className="text-xs sm:text-sm font-black font-serif text-white tracking-wider">TIE</div>
              </div>
              {userBetTie > 0 && (
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black font-mono text-[9px] border border-white flex items-center justify-center animate-in zoom-in">
                  ₹{userBetTie}
                </div>
              )}
            </div>

            {/* SUITED TIE (50:1) Button */}
            <div 
              onClick={() => handlePlaceBet('suited_tie')}
              className={`flex-1 relative rounded-xl sm:rounded-2xl border-2 p-1.5 flex flex-col items-center justify-between text-center transition-all duration-200 cursor-pointer shadow-lg ${
                winningSide === 'suited_tie' || isSuitedTieResult
                  ? 'bg-gradient-to-b from-amber-600 via-yellow-500 to-amber-700 border-yellow-300 ring-4 ring-yellow-400 scale-105 shadow-[0_0_25px_rgba(251,191,36,0.8)]'
                  : 'bg-gradient-to-b from-[#0e3321] via-[#092417] to-[#05140d] border-[#1b5e3d] hover:border-amber-400 active:scale-95'
              }`}
            >
              <div>
                <div className="text-[7px] sm:text-[8px] text-amber-300 font-bold font-mono">50:1</div>
                <div className="text-[9px] sm:text-[10px] font-black font-serif text-amber-300 leading-tight">SUITED TIE</div>
              </div>
              {userBetSuitedTie > 0 && (
                <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black font-mono text-[9px] border border-white flex items-center justify-center animate-in zoom-in">
                  ₹{userBetSuitedTie}
                </div>
              )}
            </div>

          </div>

          {/* TIGER OVAL (RIGHT 5 COLS) */}
          <div 
            onClick={() => handlePlaceBet('tiger')}
            className={`col-span-5 relative rounded-2xl sm:rounded-3xl border-2 p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xl min-h-[140px] sm:min-h-[160px] ${
              userBetDragon > 0 ? 'opacity-60 grayscale-[30%]' : ''
            } ${
              winningSide === 'tiger' 
                ? 'bg-gradient-to-bl from-[#7a520a] via-[#a36e0f] to-[#4d3305] border-[#fcd34d] ring-4 ring-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.5)] scale-[1.02]' 
                : 'bg-gradient-to-bl from-[#4d3305] via-[#332204] to-[#1a1102] border-[#7d5612] hover:border-[#a8741a] active:scale-98'
            }`}
          >
            {userBetDragon > 0 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-rose-500/60 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-bold text-rose-300 flex items-center gap-1 shadow-md z-30 pointer-events-none">
                <Lock className="w-2.5 h-2.5" />
                <span>লকড</span>
              </div>
            )}
            {/* Top Pool Info & Percent Badge */}
            <div className="flex items-start justify-between font-mono text-[10px] sm:text-xs">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-950/80 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300">
                {pctTiger}%
              </div>
              <div className="text-right">
                <div className="font-bold text-white leading-tight">₹ {tablePoolTiger.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                <div className="text-[9px] text-amber-300/80 flex items-center justify-end gap-0.5">
                  <span>👤</span>
                  <span>{tigerBettors}</span>
                </div>
              </div>
            </div>

            {/* Middle: Playing Card Spot & Reveal */}
            <div className="my-1 flex items-center justify-center">
              {tigerCard ? (
                <div className={`relative w-12 h-16 sm:w-16 sm:h-22 rounded-lg sm:rounded-xl border-2 bg-white flex flex-col justify-between p-1 shadow-2xl transition-all duration-300 ${
                  isTigerCardRevealed ? 'animate-in zoom-in-75' : 'bg-gradient-to-bl from-amber-700 to-amber-950 border-amber-400'
                } ${winningSide === 'tiger' ? 'ring-4 ring-yellow-400 scale-105 shadow-amber-400/50' : 'border-slate-300'}`}>
                  {isTigerCardRevealed ? (
                    <>
                      <div className="flex items-center justify-between leading-none font-bold font-mono text-xs sm:text-sm">
                        <span className={tigerCard.suit === 'hearts' || tigerCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                          {tigerCard.rank}
                        </span>
                        <span className={tigerCard.suit === 'hearts' || tigerCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                          {tigerCard.suit === 'hearts' ? '♥' : tigerCard.suit === 'diamonds' ? '♦' : tigerCard.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                      <div className="text-center text-lg sm:text-2xl leading-none">
                        <span className={tigerCard.suit === 'hearts' || tigerCard.suit === 'diamonds' ? 'text-red-600' : 'text-black'}>
                          {tigerCard.suit === 'hearts' ? '♥' : tigerCard.suit === 'diamonds' ? '♦' : tigerCard.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between leading-none font-bold font-mono text-[9px] sm:text-xs">
                        <span className="text-slate-500">{getRankNumericValue(tigerCard.rank)}pt</span>
                        {winningSide === 'tiger' && <span className="text-amber-500 font-bold">WIN</span>}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-amber-300 text-xs font-mono font-bold">
                      <span>🐅</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-12 h-16 sm:w-16 sm:h-22 rounded-lg sm:rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-950/20 flex flex-col items-center justify-center text-amber-400/60 font-mono text-[10px]">
                  <span>CARD</span>
                </div>
              )}
            </div>

            {/* Bottom Label & Multiplier */}
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[10px] text-amber-300/80 font-bold font-mono">1:1</span>
                <h3 className="text-base sm:text-lg font-black font-serif tracking-wider text-white">TIGER</h3>
              </div>

              {/* User Placed Chip Badge */}
              {userBetTiger > 0 && (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 border-2 border-white shadow-xl flex items-center justify-center font-mono font-black text-xs text-slate-950 animate-in zoom-in">
                  ₹{userBetTiger}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 4. BEAD ROAD & STATS SUMMARY BAR */}
        <div className="my-1 sm:my-1.5 max-w-2xl mx-auto w-full bg-[#12141c] border border-white/10 rounded-xl p-1.5 font-mono text-[11px] shadow-lg">
          {/* Stats Bar */}
          <div className="flex items-center justify-between px-1 pb-1 border-b border-white/5 text-[10px]">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold">#{roundIndex}</span>
              <span className="text-red-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                <span>{dragonCount}</span>
              </span>
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>{tigerCount}</span>
              </span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>{tieCount}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-[10px]">
              <span>Real-time Live Synced</span>
            </div>
          </div>

          {/* Bead Road Matrix Circles (Oldest on left, newest always appended to the right) */}
          <div ref={beadRoadScrollRef} className="flex items-center gap-1.5 pt-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {beadRoad.map((b, idx) => {
              const isLatest = idx === beadRoad.length - 1;
              return (
                <div 
                  key={`${b.id || 'bead'}_${idx}`}
                  title={`${b.winner.toUpperCase()} (D: ${b.dragonRank}, T: ${b.tigerRank})`}
                  className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border relative transition-all ${
                    isLatest ? 'ring-2 ring-amber-300 scale-105 shadow-[0_0_10px_rgba(251,191,36,0.8)] z-10' : ''
                  } ${
                    b.winner === 'dragon' 
                      ? 'bg-red-600 border-red-400 text-white' 
                      : b.winner === 'tiger' 
                      ? 'bg-amber-500 border-amber-300 text-slate-950' 
                      : b.isSuitedTie 
                      ? 'bg-gradient-to-br from-emerald-500 to-amber-400 border-yellow-300 text-slate-950' 
                      : 'bg-emerald-600 border-emerald-400 text-white'
                  }`}
                >
                  {b.winner === 'dragon' ? 'D' : b.winner === 'tiger' ? 'T' : 'T'}
                  {isLatest && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* REAL-TIME BETTING LIMIT BAR (0S SYNC WITH ADMIN PANEL) & ACTIVE CHIP INDICATOR */}
        <div className="max-w-2xl mx-auto w-full px-2 py-1 mb-1 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 font-bold">বেটিং লিমিট:</span>
            <span className="text-emerald-400 font-black">সর্বনিম্ন ₹{(config.minBet || 50).toLocaleString('en-IN')}</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-black">সর্বোচ্চ ₹{(config.maxBet || 15000000).toLocaleString('en-IN')}</span>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              setShowChipModal(true);
            }}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/50 font-bold transition-all cursor-pointer"
          >
            <Coins className="w-3 h-3 text-amber-400" />
            <span>চিপ: ₹{selectedChip.toLocaleString('en-IN')} (বদলান)</span>
          </button>
        </div>

        {/* 5. CONTROL BAR & CHIPS SELECTOR */}
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-1.5 sm:gap-2 px-1">
          
          {/* UNDO Button */}
          <button
            disabled={gamePhase !== 'betting' || betHistoryStack.length === 0}
            onClick={handleUndo}
            className="flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#1c1f2a] border border-white/10 hover:border-amber-400 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
            title="Undo Last Bet"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">UNDO</span>
          </button>

          {/* Dedicated Chip Popup Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowChipModal(true);
            }}
            className="flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 border-2 border-amber-400 hover:bg-amber-500/30 text-amber-300 hover:text-white transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0"
            title="সব চিপ ও কাস্টম অ্যামাউন্ট সেট করুন"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-[7px] font-mono font-black uppercase text-amber-300 mt-0.5">চিপ সেট</span>
          </button>

          {/* Chips Ribbon */}
          <div className="flex-1 flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
            {/* If selectedChip is a custom value not in configured chips, render it first */}
            {!((Array.isArray(config.chipValues) && config.chipValues.length > 0) ? config.chipValues : CHIP_VALUES).includes(selectedChip) && (
              <button
                key="custom-selected-chip"
                onClick={() => {
                  soundFx.playClick();
                  setShowChipModal(true);
                }}
                className={`relative shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-mono font-black text-[10px] sm:text-xs transition-all duration-200 cursor-pointer scale-115 ring-4 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)] z-10 ${getDynamicChipStyle(selectedChip)}`}
                title="কাস্টম সিলেক্টেড চিপ"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/30 flex items-center justify-center">
                  {formatChipDisplay(selectedChip)}
                </div>
              </button>
            )}

            {((Array.isArray(config.chipValues) && config.chipValues.length > 0) ? config.chipValues : CHIP_VALUES).map((chipVal) => {
              const isSelected = selectedChip === chipVal;
              const isBelowMin = chipVal < (config.minBet || 50);
              return (
                <button
                  key={chipVal}
                  onClick={() => {
                    if (isBelowMin) {
                      soundFx.playError();
                      setRestrictionToast(`⚠️ সর্বনিম্ন বাজি ₹${(config.minBet || 50).toLocaleString('en-IN')}`);
                      return;
                    }
                    soundFx.playClick();
                    setSelectedChip(chipVal);
                  }}
                  className={`relative shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-mono font-black text-[10px] sm:text-xs transition-all duration-200 cursor-pointer ${
                    isBelowMin
                      ? 'opacity-30 grayscale cursor-not-allowed'
                      : isSelected 
                      ? 'scale-115 ring-4 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)] z-10' 
                      : 'opacity-85 hover:opacity-100 hover:scale-105'
                  } ${getDynamicChipStyle(chipVal)}`}
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/30 flex items-center justify-center">
                    {formatChipDisplay(chipVal)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2X DOUBLE Button */}
          <button
            disabled={gamePhase !== 'betting' || totalUserBet === 0}
            onClick={handleDouble}
            className="flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#1c1f2a] border border-white/10 hover:border-amber-400 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
            title="Double Current Bets"
          >
            <span className="font-mono font-black text-xs text-amber-400 leading-none">2X</span>
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">DOUBLE</span>
          </button>

          {/* Evolution Hamburger Menu Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowMenuModal(true);
            }}
            className="flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#1c1f2a] border border-white/10 hover:border-white text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Game Menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

        </div>

      </div>

      {/* 6. BOTTOM INFORMATIONAL STATUS STRIP */}
      <footer className="h-9 sm:h-10 px-3 bg-[#11131a] border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <span>Total Bet <strong className="text-white">₹{totalUserBet.toLocaleString('en-IN')}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Balance <strong className="text-amber-400">₹{(currentBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-slate-400">Dragon Tiger ₹50 - 15,000,000</span>
          <span className="text-slate-500">#{roundId}</span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: LOW BALANCE ALERT MODAL (Exact from Video at 00:04 & 00:28) */}
      {/* ========================================================================= */}
      {showLowBalanceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/15 rounded-2xl p-6 text-center shadow-2xl space-y-4 font-sans animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              LOW BALANCE
            </h3>
            
            <p className="text-sm text-slate-300">
              Your balance is too low to play. Please deposit funds into your account.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setShowLowBalanceModal(false)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm tracking-wider uppercase transition-colors cursor-pointer"
              >
                CLOSE
              </button>

              <button
                onClick={() => {
                  setShowLowBalanceModal(false);
                  onOpenDeposit();
                }}
                className="w-full py-2.5 rounded-xl bg-[#00a859] hover:bg-[#00c868] text-white font-bold text-sm tracking-wider uppercase shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                DEPOSIT FUNDS
              </button>
            </div>

            <div className="text-[10px] text-slate-500 font-mono">
              #{roundId}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: IN-GAME MENU (Exact 6-Tile Menu from Video at 00:15) */}
      {/* ========================================================================= */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-5 font-sans animate-in slide-in-from-bottom-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="w-6" />
              <h3 className="text-base font-bold text-white">Menu</h3>
              <button
                onClick={() => setShowMenuModal(false)}
                className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 6 Big Action Tiles */}
            <div className="grid grid-cols-3 gap-3">
              
              {/* Lobby */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  onClose();
                }}
                className="p-3.5 rounded-2xl bg-[#1c1f2a] border border-white/5 hover:border-amber-400/50 flex flex-col items-center justify-center text-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-200">Lobby</span>
              </button>

              {/* Chat */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  setShowChatModal(true);
                }}
                className="p-3.5 rounded-2xl bg-[#1c1f2a] border border-white/5 hover:border-amber-400/50 flex flex-col items-center justify-center text-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-200">Chat</span>
              </button>

              {/* Live Support */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  alert('Connecting with 24/7 VIP Live Casino Support.');
                }}
                className="p-3.5 rounded-2xl bg-[#1c1f2a] border border-white/5 hover:border-amber-400/50 flex flex-col items-center justify-center text-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Headphones className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-200">Live Support</span>
              </button>

              {/* Game History */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  setShowHistoryModal(true);
                }}
                className="p-3.5 rounded-2xl bg-[#1c1f2a] border border-white/5 hover:border-amber-400/50 flex flex-col items-center justify-center text-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <History className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-200">Game History</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  setShowSettingsModal(true);
                }}
                className="p-3.5 rounded-2xl bg-[#1c1f2a] border border-white/5 hover:border-amber-400/50 flex flex-col items-center justify-center text-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-200">Settings</span>
              </button>

              {/* How To Play */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  setShowRulesModal(true);
                }}
                className="p-3.5 rounded-2xl bg-[#1c1f2a] border border-white/5 hover:border-amber-400/50 flex flex-col items-center justify-center text-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-200">How To Play</span>
              </button>

            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-300 font-medium">
              <button 
                onClick={() => {
                  setShowMenuModal(false);
                  setShowRulesModal(true);
                }}
                className="flex items-center gap-1.5 hover:text-white"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Payouts & Limits</span>
              </button>

              <button
                onClick={() => {
                  const next = !isMuted;
                  setIsMuted(next);
                  soundFx.toggleMute();
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: GAME HISTORY SHEET (Exact from Video at 00:17 - 00:22) */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-[#161822] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4 font-sans max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setShowMenuModal(true);
                }}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Game History</h3>
              </div>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Volume header */}
            <div className="bg-[#1c1f2a] rounded-2xl p-3 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400">TOTAL BETS PLACED</span>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold">BET: ₹{myBetsHistory.reduce((acc, b) => acc + b.amount, 0).toLocaleString('en-IN')}</span>
                <span className="text-emerald-400 font-bold">WON: ₹{myBetsHistory.reduce((acc, b) => acc + (b.wonAmount || 0), 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Bets List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {myBetsHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-mono text-xs">
                  No rounds recorded yet in this session. Place bets to view your transaction audit.
                </div>
              ) : (
                myBetsHistory.map((b, idx) => (
                  <div key={`${b.id || 'bet'}_${idx}`} className="p-3 rounded-2xl bg-[#1c1f2a] border border-white/5 flex items-center justify-between font-mono text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">{b.roundId}</span>
                        <span className="font-bold text-white uppercase">{b.side.replace('_', ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(b.timestamp).toLocaleTimeString('en-IN')}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-slate-400">BET: ₹{b.amount.toLocaleString('en-IN')}</div>
                      <div className={`font-bold mt-0.5 ${b.status === 'won' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {b.status === 'won' ? `+₹${b.wonAmount?.toLocaleString('en-IN')}` : `-₹${b.amount.toLocaleString('en-IN')}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: HOW TO PLAY & RULES */}
      {/* ========================================================================= */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-lg bg-[#161822] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4 font-sans max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <span>Dragon Tiger Live Rules & Payouts</span>
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 font-sans leading-relaxed">
              <p>
                Dragon Tiger is a two-card baccarat-style live casino game. Two cards are dealt: one to <strong className="text-red-400">DRAGON</strong> and one to <strong className="text-amber-400">TIGER</strong>. The side with the higher card rank wins.
              </p>

              <div className="bg-[#1c1f2a] rounded-2xl p-3 border border-white/10 space-y-2">
                <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">Card Hierarchy:</h4>
                <p className="text-[11px]">
                  <strong>King (13)</strong> is highest, followed by <strong>Queen (12), Jack (11), 10, 9, 8, 7, 6, 5, 4, 3, 2</strong>, down to <strong>Ace (1)</strong> which is lowest.
                </p>
              </div>

              <div className="bg-[#1c1f2a] rounded-2xl p-3 border border-white/10 space-y-2 font-mono">
                <h4 className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">Official Payout Table:</h4>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>DRAGON:</span><span className="text-white font-bold">1:1 (2.0x Return)</span></div>
                  <div className="flex justify-between"><span>TIGER:</span><span className="text-white font-bold">1:1 (2.0x Return)</span></div>
                  <div className="flex justify-between"><span>TIE:</span><span className="text-emerald-400 font-bold">11:1 (12.0x Return)</span></div>
                  <div className="flex justify-between"><span>SUITED TIE:</span><span className="text-amber-400 font-bold">50:1 (51.0x Return)</span></div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Note: Winning bets receive the full multiplier payout (e.g. 2x for Dragon / Tiger). Losing bets receive no refund (₹0).
              </p>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase transition-colors cursor-pointer"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: LIVE PLAYER CHAT */}
      {/* ========================================================================= */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-md bg-[#161822] border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3 font-sans h-[75vh] flex flex-col animate-in slide-in-from-bottom-6">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Live Table Chat</h3>
              </div>
              <button
                onClick={() => setShowChatModal(false)}
                className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {chatMessages.map((m, idx) => (
                <div key={`${m.id || 'msg'}_${idx}`} className={`p-2 rounded-xl text-xs ${m.isDealer ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200' : m.isWin ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' : 'bg-[#1c1f2a] text-slate-200'}`}>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                    <span className="font-bold text-white">{m.sender}</span>
                    <span>{m.time}</span>
                  </div>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={inputChatMessage}
                onChange={(e) => setInputChatMessage(e.target.value)}
                placeholder="Send chat to live table..."
                className="flex-1 bg-[#1c1f2a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Send
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: SETTINGS */}
      {/* ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <span>Audio & Stream Settings</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-300">
              {/* Language Selection */}
              <div className="p-3 bg-[#1c1f2a] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-sans text-slate-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>Dealer Voice Language</span>
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono uppercase">
                    {dealerLang === 'bn' ? 'বাংলা' : dealerLang === 'hi' ? 'हिंदी' : 'English'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => handleSetLanguage('bn')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dealerLang === 'bn' 
                        ? 'bg-amber-500 text-slate-950 shadow-md' 
                        : 'bg-black/40 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    বাংলা
                  </button>
                  <button
                    onClick={() => handleSetLanguage('en')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dealerLang === 'en' 
                        ? 'bg-amber-500 text-slate-950 shadow-md' 
                        : 'bg-black/40 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleSetLanguage('hi')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dealerLang === 'hi' 
                        ? 'bg-amber-500 text-slate-950 shadow-md' 
                        : 'bg-black/40 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#1c1f2a] rounded-xl">
                <span>Dealer Voice Commentary</span>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, dealerVoiceEnabled: !prev.dealerVoiceEnabled }))}
                  className={`px-3 py-1 rounded-lg font-bold ${config.dealerVoiceEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-400'}`}
                >
                  {config.dealerVoiceEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#1c1f2a] rounded-xl">
                <span>Casino Sound Effects</span>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`px-3 py-1 rounded-lg font-bold ${!isMuted ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-400'}`}
                >
                  {!isMuted ? 'ON' : 'MUTED'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING SIDE CHIP SELECTOR QUICK-ACCESS BADGE */}
      {/* ========================================================================= */}
      <aside aria-label="Chip Selector" className="fixed right-2 sm:right-4 bottom-24 sm:bottom-28 z-40 flex flex-col items-end gap-1 pointer-events-auto">
        <button
          onClick={() => {
            soundFx.playClick();
            setShowChipModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-slate-950/95 border-2 border-amber-400 shadow-[0_4px_25px_rgba(245,158,11,0.5)] backdrop-blur-md hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="চিপ সিলেক্ট ও পরিবর্তন করতে ট্যাপ করুন"
        >
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-mono font-black text-xs ring-2 ring-amber-300 shadow-md ${getDynamicChipStyle(selectedChip)}`}>
            {formatChipDisplay(selectedChip)}
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-400 animate-pulse" /> চিপ সিলেক্ট
            </span>
            <span className="text-xs sm:text-sm font-black text-white font-mono leading-none">
              ₹{selectedChip.toLocaleString('en-IN')}
            </span>
            <span className="text-[8px] text-amber-200/70 font-semibold mt-0.5">ট্যাপ করে পরিবর্তন 👆</span>
          </div>
        </button>
      </aside>

      {/* ========================================================================= */}
      {/* DEDICATED CHIP SELECTOR POPUP MODAL (ADMIN SYNC & CUSTOM AMOUNT) */}
      {/* ========================================================================= */}
      {showChipModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-gradient-to-b from-[#181a26] to-[#0f1017] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_15px_60px_rgba(0,0,0,0.9)] space-y-5 animate-in slide-in-from-bottom-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-1.5">
                    বাজি চিপ সিলেক্ট করুন
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                      SELECT CHIP
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    চিপ সিলেক্ট করে ড্রাগন বা টাইগার বক্সে বারবার ট্যাপ করে বাজি ধরতে পারবেন
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChipModal(false)}
                className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Currently Active Selected Chip Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#1c1f2e] to-amber-950/30 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-mono font-black text-sm ring-4 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)] ${getDynamicChipStyle(selectedChip)}`}>
                  {formatChipDisplay(selectedChip)}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    বর্তমান সিলেক্টেড চিপ
                  </span>
                  <span className="text-lg font-black text-white font-mono">
                    ₹{selectedChip.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-bold block bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  ✓ প্রস্তুত বাজি ধরার জন্য
                </span>
                <span className="text-[9px] text-slate-400 mt-1 block">
                  প্রতি ট্যাপে: ₹{selectedChip.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Admin Configured Chips Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping" />
                  এডমিন প্যানেল চিপসমূহ (Admin Synced Chips)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  লিমিট: ₹{(config.minBet || 50).toLocaleString('en-IN')} - ₹{(config.maxBet || 15000000).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-52 overflow-y-auto pr-1 no-scrollbar">
                {chips.map((chipVal) => {
                  const isSelected = selectedChip === chipVal;
                  const isBelowMin = chipVal < (config.minBet || 50);
                  const isAboveMax = chipVal > (config.maxBet || 15000000);
                  const isDisabled = isBelowMin || isAboveMax;

                  return (
                    <button
                      key={chipVal}
                      disabled={isDisabled}
                      onClick={() => {
                        soundFx.playClick();
                        setSelectedChip(chipVal);
                        setRestrictionToast(`✅ চিপ সিলেক্ট হয়েছে: ₹${chipVal.toLocaleString('en-IN')}`);
                        setTimeout(() => setRestrictionToast(null), 2000);
                      }}
                      className={`relative p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group ${
                        isDisabled
                          ? 'opacity-35 grayscale bg-black/40 border-white/5 cursor-not-allowed'
                          : isSelected
                          ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-102'
                          : 'bg-[#1b1e2a] border-white/10 hover:border-amber-400/50 hover:bg-[#232738]'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      
                      {/* Casino Chip Visual */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-mono font-black text-xs shadow-md group-hover:scale-110 transition-transform ${getDynamicChipStyle(chipVal)}`}>
                        {formatChipDisplay(chipVal)}
                      </div>

                      <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-amber-300 font-black' : 'text-slate-300'}`}>
                        ₹{chipVal.toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Chip Amount Section */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  ✏️ নিজস্ব কাস্টম চিপ সেট করুন (Custom Amount)
                </span>
                <span className="text-[10px] text-slate-400">
                  যেকোনো অ্যামাউন্ট লিখুন
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400 font-mono">₹</span>
                  <input
                    type="number"
                    value={customChipInput}
                    onChange={(e) => setCustomChipInput(e.target.value)}
                    placeholder={`উদাঃ ${(config.minBet || 50) * 2}`}
                    min={config.minBet || 50}
                    max={config.maxBet || 15000000}
                    className="w-full bg-[#161822] border border-white/20 rounded-xl pl-8 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  onClick={() => {
                    const parsed = Number(customChipInput);
                    const minB = config.minBet || 50;
                    const maxB = config.maxBet || 15000000;
                    if (isNaN(parsed) || parsed < minB) {
                      soundFx.playError();
                      setRestrictionToast(`⚠️ সর্বনিম্ন বাজি ₹${minB.toLocaleString('en-IN')}`);
                      return;
                    }
                    if (parsed > maxB) {
                      soundFx.playError();
                      setRestrictionToast(`⚠️ সর্বোচ্চ বাজি ₹${maxB.toLocaleString('en-IN')}`);
                      return;
                    }
                    soundFx.playClick();
                    setSelectedChip(parsed);
                    setCustomChipInput('');
                    setRestrictionToast(`✅ চিপ সেট হয়েছে: ₹${parsed.toLocaleString('en-IN')}`);
                    setTimeout(() => setRestrictionToast(null), 2500);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  সেট করুন
                </button>
              </div>

              {/* Quick Increment Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {[50, 100, 500, 1000, 5000].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => {
                      const current = Number(customChipInput) || selectedChip || 0;
                      const next = current + inc;
                      setCustomChipInput(String(next));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 text-[10px] font-mono font-bold text-slate-300 hover:text-amber-300 whitespace-nowrap cursor-pointer transition-all"
                  >
                    +{inc >= 1000 ? `${inc / 1000}k` : inc}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const minB = config.minBet || 50;
                    setCustomChipInput(String(minB));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-slate-400 hover:text-white whitespace-nowrap cursor-pointer"
                >
                  Min
                </button>
              </div>
            </div>

            {/* Confirm & Close Button */}
            <button
              onClick={() => {
                soundFx.playClick();
                setShowChipModal(false);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase shadow-[0_4px_25px_rgba(245,158,11,0.4)] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>চিপ নিশ্চিত করুন (Confirm ₹{selectedChip.toLocaleString('en-IN')})</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 8K Ultra HD Winner Spotlight Reveal Modal (2-Second Showcase) */}
      <Card8KSpotlightModal
        isOpen={show8kRevealModal}
        data={reveal8kData}
        onClose={() => setShow8kRevealModal(false)}
        autoCloseDurationMs={2200}
      />

    </div>
  );
};
