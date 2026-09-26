import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Volume2, VolumeX, History, RotateCcw, Trash2, 
  Zap, Crown, Bookmark, Menu as MenuIcon, X, BarChart2,
  MessageSquare, Headphones, Settings, HelpCircle, ArrowUpDown,
  Sparkles, Layers, ShieldCheck, ChevronDown, Check, AlertTriangle, Lock
} from 'lucide-react';
import { 
  User, 
  WalletTransaction, 
  AndarBaharConfig, 
  AndarBaharRound, 
  AndarBaharBet, 
  PlayingCard, 
  AndarBaharSide,
  SuperAndarBaharRange,
  AndarBaharBetTarget
} from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, limit } from 'firebase/firestore';
import { 
  DEFAULT_ANDAR_BAHAR_CONFIG, 
  createDeck, 
  pickJokerCard, 
  simulateAndarBaharRound,
  SUPER_ANDAR_BAHAR_RANGES,
  SuperAndarBaharRangeDef,
  getSuitDetails,
  getUniversalAndarBaharTimeState,
  getSyncedAndarBaharRoadHistory
} from '../utils/andarBahar';
import { PlayingCardView } from './PlayingCardView';
import { triggerConfetti } from '../utils/confetti';
import { Card8KSpotlightModal, Card8KSpotlightData } from './Card8KSpotlightModal';
import { logLiveActivity } from '../utils/activityTracker';

// Import newly generated high-res dealer stage assets
import dealerWelcomeImg from '../assets/images/ab_dealer_welcome_1787544159680.jpg';
import dealerDealingImg from '../assets/images/ab_dealer_dealing_1787544175076.jpg';
import dealerTableImg from '../assets/images/ab_dealer_table_1787544190306.jpg';

interface AndarBaharGameProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
  onBigWin?: (data: any) => void;
}

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

export const AndarBaharGame: React.FC<AndarBaharGameProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit,
  onBigWin
}) => {
  // 1. Config State (synced with Firestore)
  const [config, setConfig] = useState<AndarBaharConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_andar_bahar_config');
      return cached ? { ...DEFAULT_ANDAR_BAHAR_CONFIG, ...JSON.parse(cached) } : DEFAULT_ANDAR_BAHAR_CONFIG;
    } catch {
      return DEFAULT_ANDAR_BAHAR_CONFIG;
    }
  });
  const configRef = useRef<AndarBaharConfig>(config);
  configRef.current = config;

  // 2. Lifecycle States
  const initialTimeState = useMemo(() => getUniversalAndarBaharTimeState(Date.now(), config), []);
  const [gamePhase, setGamePhase] = useState<'betting' | 'dealing' | 'completed'>(initialTimeState.phase);
  const [countdown, setCountdown] = useState<number>(initialTimeState.countdown);
  const [roundId, setRoundId] = useState<string>(initialTimeState.roundDetails.roundId);
  const roundIdRef = useRef<string>(initialTimeState.roundDetails.roundId);
  roundIdRef.current = roundId;
  
  // 3. Card Dealing States
  const [jokerCard, setJokerCard] = useState<PlayingCard | null>(initialTimeState.roundDetails.jokerCard);
  const [andarCards, setAndarCards] = useState<PlayingCard[]>(initialTimeState.visibleAndarCards);
  const [baharCards, setBaharCards] = useState<PlayingCard[]>(initialTimeState.visibleBaharCards);
  const [winningSide, setWinningSide] = useState<AndarBaharSide | null>(initialTimeState.phase === 'completed' ? initialTimeState.roundDetails.winningSide : null);
  const [winningCard, setWinningCard] = useState<PlayingCard | null>(initialTimeState.phase === 'completed' ? initialTimeState.roundDetails.winningCard : null);
  const [dealingActiveSide, setDealingActiveSide] = useState<AndarBaharSide | null>(initialTimeState.activeDealingSide);
  const [currentCardsDealtCount, setCurrentCardsDealtCount] = useState<number>(initialTimeState.currentDealtCount);

  // 4. Super Multipliers State (Evolution style random lightning multipliers)
  const [superMultipliers, setSuperMultipliers] = useState<Record<string, number>>(initialTimeState.roundDetails.superMultipliers);

  // 5. Betting States
  const [selectedChip, setSelectedChip] = useState<number>(50);
  const [bets, setBets] = useState<Record<string, number>>({});
  const betsRef = useRef<Record<string, number>>({});
  betsRef.current = bets;
  const firestoreLiveBetsRef = useRef<{ andar: number; bahar: number }>({ andar: 0, bahar: 0 });

  const [betHistoryStack, setBetHistoryStack] = useState<{ target: AndarBaharBetTarget; amount: number }[]>([]);
  const [lastRoundBets, setLastRoundBets] = useState<Record<string, number> | null>(null);

  // Simulated Table Stats for authentic live multiplayer casino atmosphere
  const [tableBetsAndar, setTableBetsAndar] = useState<number>(7345);
  const [tableBetsBahar, setTableBetsBahar] = useState<number>(5865);
  const [tablePlayersAndar, setTablePlayersAndar] = useState<number>(14);
  const [tablePlayersBahar, setTablePlayersBahar] = useState<number>(9);

  // Live Dealer greeting ticker text
  const [dealerMessage, setDealerMessage] = useState<string>('Hello, Welcome to Super Andar Bahar!');

  // Modals & Drawers
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voiceLang, setVoiceLang] = useState<'bn' | 'hi' | 'en'>(() => {
    try {
      return (localStorage.getItem('ab_voice_lang') as 'bn' | 'hi' | 'en') || 'bn';
    } catch {
      return 'bn';
    }
  });
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ab_voice_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Auto-scroll refs for live dealt cards to ensure freshly drawn cards are always visible
  const andarCardsRef = useRef<HTMLDivElement>(null);
  const baharCardsRef = useRef<HTMLDivElement>(null);
  const [showResultOverlay, setShowResultOverlay] = useState<boolean>(true);
  const [show8kRevealModal, setShow8kRevealModal] = useState<boolean>(false);
  const [reveal8kData, setReveal8kData] = useState<Card8KSpotlightData | null>(null);
  const [selectedRoadItem, setSelectedRoadItem] = useState<{ id: string; winner: AndarBaharSide; cardsCount: number; rank: string } | null>(null);

  const [showMenuModal, setShowMenuModal] = useState<boolean>(false);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState<boolean>(false);
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
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showPayoutsModal, setShowPayoutsModal] = useState<boolean>(false);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; user: string; text: string; time: string }[]>([
    { id: '1', user: 'Rajesh_K', text: 'Andar will win this time for sure!', time: '09:25' },
    { id: '2', user: 'Dealer', text: 'Welcome to Super Andar Bahar! Good luck everyone.', time: '09:26' },
    { id: '3', user: 'Amit_99', text: 'Placed 500 on Bahar 🔥', time: '09:27' },
  ]);
  const [newChatText, setNewChatText] = useState<string>('');

  // Road history / Bead plate reactively synchronized with Firestore (0s parity with Admin)
  const [dbRounds, setDbRounds] = useState<AndarBaharRound[]>([]);

  useEffect(() => {
    const qRounds = query(collection(db, 'andar_bahar_rounds'), limit(30));
    const unsub = onSnapshot(qRounds, (snap) => {
      const list: AndarBaharRound[] = [];
      snap.forEach((d) => list.push(d.data() as AndarBaharRound));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setDbRounds(list);
    }, (err) => console.warn('Andar Bahar rounds listener note:', err.message));
    return () => unsub();
  }, []);

  const roadHistory = useMemo(() => {
    const curIdx = getUniversalAndarBaharTimeState().roundIndex;
    const synced = getSyncedAndarBaharRoadHistory(curIdx, 30);
    if (!dbRounds || dbRounds.length === 0) return synced;
    const dbMap = new Map<string, AndarBaharRound>();
    dbRounds.forEach(r => {
      const rId = r.id;
      if (rId && r.winningSide) dbMap.set(rId, r);
    });
    return synced.map(s => {
      const dbMatch = dbMap.get(s.id);
      if (dbMatch && dbMatch.winningSide) {
        return {
          id: s.id,
          winner: dbMatch.winningSide,
          cardsCount: dbMatch.totalCardsDealt || s.cardsCount,
          rank: dbMatch.winningCard?.rank || s.rank,
        };
      }
      return s;
    });
  }, [dbRounds]);

  // User's bet records
  const [myBetsHistory, setMyBetsHistory] = useState<AndarBaharBet[]>([]);

  // Authoritative synchronous wallet balance
  const [currentBalance, setCurrentBalance] = useState<number>(() => (typeof user.balance === 'number' ? user.balance : 0));
  const balanceRef = useRef<number>(typeof user.balance === 'number' ? user.balance : 0);
  const prevReportedBalRef = useRef<number>(typeof user.balance === 'number' ? user.balance : 0);

  // Sync references
  const activeRoundIndexRef = useRef<number>(-1);
  const settledRoundRef = useRef<number>(-1);
  const spokenTriggersRef = useRef<Set<string>>(new Set());

  // Total user bet in current round
  const totalUserBet = useMemo(() => {
    return (Object.values(bets) as number[]).reduce((acc: number, val: number) => acc + (Number(val) || 0), 0);
  }, [bets]);

  // 1. Sync user balance from external updates
  useEffect(() => {
    const externalBal = typeof user.balance === 'number' ? user.balance : 0;
    if (Math.abs(externalBal - prevReportedBalRef.current) > 0.001) {
      if (totalUserBet === 0 && gamePhase === 'betting') {
        balanceRef.current = externalBal;
        prevReportedBalRef.current = externalBal;
        setCurrentBalance(externalBal);
      }
    }
  }, [user.balance, gamePhase, totalUserBet]);

  // 2. Real-time Firestore Configuration Sync
  useEffect(() => {
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'andar_bahar'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          const targetWinner = (data.manualForceTarget as AndarBaharSide) || (data.manualForceWinner as AndarBaharSide) || (data.forcedWinner as AndarBaharSide) || prev.manualForceWinner;
          const isManual = !!(data.isManualOverride || (targetWinner && targetWinner !== 'random'));
          const next: AndarBaharConfig = {
            ...prev,
            isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled,
            minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
            andarMultiplier: data.multiplierPrimary !== undefined ? data.multiplierPrimary : (data.andarMultiplier || prev.andarMultiplier),
            baharMultiplier: data.multiplierSecondary !== undefined ? data.multiplierSecondary : (data.baharMultiplier || prev.baharMultiplier),
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpMode: isManual ? 'manual_force_winner' : 'house_protect',
            manualForceWinner: targetWinner,
            forcedWinner: targetWinner,
            isManualOverride: isManual,
            manualJokerRank: data.manualJokerRank || prev.manualJokerRank,
          } as any;
          configRef.current = next;
          try {
            localStorage.setItem('bg_andar_bahar_config', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }, (err) => console.warn('Andar Bahar game_settings listener notice:', err.message));

    const unsubLegacy = onSnapshot(doc(db, 'andar_bahar_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AndarBaharConfig>;
        setConfig((prev) => {
          const next = { 
            ...prev, 
            ...data,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
          };
          configRef.current = next;
          return next;
        });
      }
    }, (err) => console.warn('Andar Bahar config listener notice:', err.message));

    // Real-time bets history listener
    const qBets = query(collection(db, 'andar_bahar_bets'), limit(200));
    const unsubBets = onSnapshot(qBets, (snap) => {
      if (!snap.empty && user?.id) {
        const activeUid = user.id;
        const cleanEmail = (user.email || '').toLowerCase().trim();
        const allBets = snap.docs.map(d => ({ id: d.id, ...d.data() } as AndarBaharBet));
        const userBets = allBets.filter(b => b.userId === activeUid || (cleanEmail && (b as any).userEmail === cleanEmail));
        userBets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (userBets.length > 0) {
          setMyBetsHistory(userBets.slice(0, 50));
        }
      }
    }, () => {});

    // Live table bets listener across all players (strictly scoped to active roundId to prevent stale data repetition)
    const unsubLiveBetsColl = onSnapshot(collection(db, 'andar_bahar_live_bets'), (snap) => {
      let aStakes = 0;
      let bStakes = 0;
      const curRId = roundIdRef.current;
      snap.forEach((d) => {
        const item = d.data();
        // Disregard bets from different/past rounds
        if (item.roundId && curRId && item.roundId !== curRId) {
          return;
        }
        const amt = Number(item.amount) || 0;
        if (item.side === 'andar') aStakes += amt;
        else if (item.side === 'bahar') bStakes += amt;
      });
      firestoreLiveBetsRef.current = { andar: aStakes, bahar: bStakes };
    }, () => {});

    // 0-second latency Live State listener from Admin Live Controller
    const unsubLiveState = onSnapshot(doc(db, 'andar_bahar_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          const candidate = data.forcedWinner || data.manualForceWinner || data.manualForceTarget;
          const isManual = Boolean(data.isManualOverride) && Boolean(candidate && (candidate as string) !== 'random');
          let forcedWinner: AndarBaharSide | 'random' = isManual ? (candidate as AndarBaharSide) : 'random';
          let autoLowRiskWinner: AndarBaharSide | undefined = (data.autoLowRiskWinner && data.autoLowRiskWinner !== 'random') ? data.autoLowRiskWinner : undefined;
          let rtpMode: 'fair_rng' | 'house_protect' | 'manual_force_winner' = isManual ? 'manual_force_winner' : 'house_protect';

          const nextMin = data.minBet !== undefined ? Number(data.minBet) : prev.minBet;
          const nextMax = data.maxBet !== undefined ? Number(data.maxBet) : prev.maxBet;

          if (data.minBet !== undefined || data.maxBet !== undefined) {
            setSelectedChip((prevChip) => {
              if (prevChip < nextMin) return nextMin;
              if (prevChip > nextMax) return nextMax;
              return prevChip;
            });
          }

          const next: AndarBaharConfig = {
            ...prev,
            manualForceWinner: forcedWinner,
            forcedWinner: forcedWinner,
            autoLowRiskWinner,
            isManualOverride: isManual && forcedWinner !== 'random',
            rtpMode,
            minBet: nextMin,
            maxBet: nextMax,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
          } as any;
          configRef.current = next;
          return next;
        });
      }
    }, () => {});

    return () => {
      unsubGameSettings();
      unsubLegacy();
      unsubBets();
      unsubLiveBetsColl();
      unsubLiveState();
    };
  }, [user?.id, user?.email]);

  // 3. Announce Welcome Dealer Voice on mount
  useEffect(() => {
    // Announce Welcome Dealer Voice when user enters the game
    const enterTimeout = setTimeout(() => {
      if (voiceEnabled) {
        soundFx.speakWelcome(user.name || user.phone || 'Player', voiceLang);
      }
    }, 700);
    return () => clearTimeout(enterTimeout);
  }, []);

  const handleSelectLanguage = (lang: 'bn' | 'hi' | 'en') => {
    setVoiceLang(lang);
    try {
      localStorage.setItem('ab_voice_lang', lang);
    } catch {}
    soundFx.playClick();
    if (lang === 'bn') {
      soundFx.speakDealer('বাংলা ভাষা নির্বাচন করা হয়েছে।', 'bn');
    } else if (lang === 'hi') {
      soundFx.speakDealer('हिन्दी भाषा चुनी गई है।', 'hi');
    } else {
      soundFx.speakDealer('English voice selected.', 'en');
    }
  };

  // Auto-scroll hooks so newly dealt cards are always visible immediately
  useEffect(() => {
    if (andarCardsRef.current) {
      andarCardsRef.current.scrollTo({
        left: andarCardsRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [andarCards]);

  useEffect(() => {
    if (baharCardsRef.current) {
      baharCardsRef.current.scrollTo({
        left: baharCardsRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [baharCards]);

  // Synchronized 24/7 Global Game Loop (Zero Latency across all clients worldwide)
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      const userAndar = Number(betsRef.current['andar']) || 0;
      const userBahar = Number(betsRef.current['bahar']) || 0;
      const combinedAndar = Math.max(userAndar, firestoreLiveBetsRef.current.andar);
      const combinedBahar = Math.max(userBahar, firestoreLiveBetsRef.current.bahar);

      const activeConfig: AndarBaharConfig = {
        ...configRef.current,
        liveBetsAndar: combinedAndar,
        liveBetsBahar: combinedBahar,
      };

      const syncState = getUniversalAndarBaharTimeState(Date.now(), activeConfig);
      const { 
        roundIndex, 
        roundDetails, 
        phase, 
        countdown: curCountdown, 
        currentDealtCount, 
        visibleAndarCards, 
        visibleBaharCards, 
        activeDealingSide 
      } = syncState;

      // 1. New round transition
      if (activeRoundIndexRef.current !== roundIndex) {
        activeRoundIndexRef.current = roundIndex;
        setRoundId(roundDetails.roundId);
        setJokerCard(roundDetails.jokerCard);
        setSuperMultipliers(roundDetails.superMultipliers);
        setWinningSide(null);
        setWinningCard(null);
        setShowResultOverlay(true);
        setShow8kRevealModal(false);
        setReveal8kData(null);

        // Save last bets for rebet
        if (Object.keys(betsRef.current).length > 0) {
          setLastRoundBets({ ...betsRef.current });
        }
        setBets({});
        setBetHistoryStack([]);

        setTableBetsAndar(roundDetails.tableBetsAndar);
        setTableBetsBahar(roundDetails.tableBetsBahar);
        setTablePlayersAndar(roundDetails.tablePlayersAndar);
        setTablePlayersBahar(roundDetails.tablePlayersBahar);

        spokenTriggersRef.current.clear();
        if (voiceEnabled) {
          soundFx.speakPleasePlaceBets(voiceLang);
        }
        soundFx.playCardFlip();
      }

      // 2. Continuous State Sync
      setGamePhase(phase);
      setCountdown(curCountdown);
      setAndarCards(visibleAndarCards);
      setBaharCards(visibleBaharCards);
      setCurrentCardsDealtCount(currentDealtCount);
      setDealingActiveSide(activeDealingSide);

      if (phase === 'betting') {
        if (curCountdown <= 5 && curCountdown > 0) {
          soundFx.playCountdownTick();
        }
      } else if (phase === 'dealing') {
        const closedKey = `bets_closed_${roundIndex}`;
        if (!spokenTriggersRef.current.has(closedKey)) {
          spokenTriggersRef.current.add(closedKey);
          soundFx.playBetsClosed();
          if (voiceEnabled) {
            soundFx.speakNoMoreBets(voiceLang);
          }
        }
      } else if (phase === 'completed') {
        // Ensure winner state is always immediately set from deterministic round details
        setWinningSide(roundDetails.winningSide);
        setWinningCard(roundDetails.winningCard);

        if (settledRoundRef.current !== roundIndex) {
          settledRoundRef.current = roundIndex;
          soundFx.playCardFlip();
          resolveRoundOutcome(
            roundDetails.winningSide, 
            roundDetails.winningCard, 
            roundDetails.totalCardsCount, 
            roundDetails.superMultipliers
          );
        }
      }
    }, 200);

    return () => clearInterval(cycleInterval);
  }, [voiceLang, voiceEnabled]);

  // 6. Resolve Winnings, Losses & Persist to Firestore
  const resolveRoundOutcome = async (
    winSide: AndarBaharSide, 
    winCard: PlayingCard, 
    totalCardsCount: number,
    activeSuperMults: Record<string, number>
  ) => {
    let totalWonAmt = 0;
    const currentBets = { ...betsRef.current };
    const placedTotal: number = (Object.values(currentBets) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0);

    const andarMult = configRef.current.andarMultiplier || 1.90;
    const baharMult = configRef.current.baharMultiplier || 2.00;

    // Main Bets Payout
    if (winSide === 'andar' && currentBets['andar']) {
      totalWonAmt += Math.round(Number(currentBets['andar']) * andarMult);
    } else if (winSide === 'bahar' && currentBets['bahar']) {
      totalWonAmt += Math.round(Number(currentBets['bahar']) * baharMult);
    }

    // Side Bets (Range Bets: 1-5, 6-10, etc.)
    SUPER_ANDAR_BAHAR_RANGES.forEach((range) => {
      const rangeBet = Number(currentBets[range.key]) || 0;
      if (rangeBet > 0 && totalCardsCount >= range.minCards && totalCardsCount <= range.maxCards) {
        const mult = activeSuperMults[range.key] || range.baseMultiplier;
        totalWonAmt += Math.round(rangeBet * mult);
      }
    });

    // Update Road History
    // Trigger 8K Ultra HD Winner Spotlight Reveal Modal (2-second showcase)
    setReveal8kData({
      gameType: 'andar_bahar',
      winner: winSide,
      winningCard: winCard,
      matchingCard: winCard,
      jokerCard: jokerCard,
      totalCardsDealt: totalCardsCount,
      userWonAmount: totalWonAmt
    });
    setShow8kRevealModal(true);

    // Voice announcement for round winner & win celebration with player name
    if (voiceEnabled) {
      setTimeout(() => {
        soundFx.speakRoundWinner(winSide, voiceLang, user.name || user.phone || 'Player', totalWonAmt);
      }, 400);
    }

    // Process user winning or loss
    if (totalWonAmt > 0) {
      const currentBal = balanceRef.current;
      const newBal = currentBal + totalWonAmt;
      balanceRef.current = newBal;
      prevReportedBalRef.current = newBal;
      setCurrentBalance(newBal);

      onUpdateBalance(newBal);
      soundFx.playLoudWinSound();
      triggerConfetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.55 }
      });

      onBigWin?.({
        id: `ab-win-${Date.now()}`,
        category: 'andar_bahar',
        title: 'সুপার আন্দার বাহার বিজয়ী!',
        subtitle: `SUPER ANDAR BAHAR (${winSide.toUpperCase()} MATCH)`,
        amount: totalWonAmt,
        multiplier: `${winSide === 'andar' ? andarMult : baharMult}x`,
        drawOrRoundId: roundId,
        cards: {
          joker: jokerCard,
          matching: winCard,
          side: winSide
        }
      });

      const resolvedAbBreakdown = Object.entries(currentBets)
        .filter(([_, amt]) => (Number(amt) || 0) > 0)
        .map(([spotKey, amtVal]) => {
          const amt = Number(amtVal);
          let spotLabel = spotKey === 'andar' ? '🎴 ANDAR (আন্দার)' : spotKey === 'bahar' ? '🃏 BAHAR (বাহার)' : `📊 Range (${spotKey.replace('range_', '').replace('_', '-')})`;
          let isWin = false;
          let mult = 0;
          let payout = 0;

          if (spotKey === 'andar' && winSide === 'andar') {
            isWin = true;
            mult = andarMult;
            payout = Math.round(amt * andarMult);
          } else if (spotKey === 'bahar' && winSide === 'bahar') {
            isWin = true;
            mult = baharMult;
            payout = Math.round(amt * baharMult);
          } else {
            const rangeObj = SUPER_ANDAR_BAHAR_RANGES.find(r => r.key === spotKey);
            if (rangeObj && totalCardsCount >= rangeObj.minCards && totalCardsCount <= rangeObj.maxCards) {
              isWin = true;
              mult = activeSuperMults[rangeObj.key] || rangeObj.baseMultiplier;
              payout = Math.round(amt * mult);
            }
          }

          return {
            spot: spotLabel,
            type: 'side',
            detail: spotKey,
            amount: amt,
            isWin,
            multiplier: isWin ? `${mult}x` : '0x',
            payout,
            outcomeProof: isWin ? `Won ₹${payout.toLocaleString('en-IN')}` : `Lost (Joker ${jokerCard?.rank}${jokerCard?.suit} matched on ${winSide.toUpperCase()})`
          };
        });

      const spotsPlacedText = Object.entries(currentBets).filter(([_, a]) => Number(a) > 0).map(([k, a]) => `${k.toUpperCase()}: ₹${a}`).join(', ');
      const winTx: WalletTransaction = {
        id: `tx-ab-win-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: user.id,
        userEmail: (user.email || '').toLowerCase().trim(),
        type: 'andar_bahar_win',
        amount: totalWonAmt,
        description: `Won ₹${totalWonAmt.toLocaleString('en-IN')} on Super Andar Bahar (${winSide.toUpperCase()} - ${totalCardsCount} cards) [Bets: ${spotsPlacedText}] [Joker: 🃏 ${jokerCard?.rank}${jokerCard?.suit} | Match: ${winCard.rank}${winCard.suit}]`,
        roundId,
        gameType: 'andar_bahar',
        winningOutcome: `${winSide.toUpperCase()} WON (🃏 Joker: ${jokerCard?.rank}${jokerCard?.suit} | Match: ${winCard.rank}${winCard.suit} in ${totalCardsCount} cards)`,
        betsBreakdown: resolvedAbBreakdown,
        status: 'completed',
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: new Date().toISOString()
      };
      onAddTransaction(winTx);

      logAnalyticsEvent('andar_bahar_win', {
        roundId,
        wonAmount: totalWonAmt,
        side: winSide,
        totalCards: totalCardsCount
      });
    } else if (placedTotal > 0) {
      soundFx.playLossSound();
      prevReportedBalRef.current = balanceRef.current;
      onUpdateBalance(balanceRef.current);
      logAnalyticsEvent('andar_bahar_loss', {
        roundId,
        lostAmount: placedTotal,
        winningSide: winSide
      });
    }

    // Persist user bet record
    if (placedTotal > 0) {
      const betRecord: AndarBaharBet = {
        id: `bet-${Date.now()}-${user.id}`,
        roundId,
        userId: user.id,
        userName: user.name || 'Player',
        userPhone: user.phone,
        side: winSide,
        amount: placedTotal,
        payoutMultiplier: winSide === 'andar' ? andarMult : baharMult,
        wonAmount: totalWonAmt > 0 ? totalWonAmt : 0,
        status: totalWonAmt > 0 ? 'won' : 'lost',
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      setMyBetsHistory((prev) => [betRecord, ...prev.slice(0, 49)]);
      try {
        await setDoc(doc(db, 'andar_bahar_bets', betRecord.id), betRecord, { merge: true });
      } catch (e) {}
    }

    // Clean up live bets in Firestore after round settlement
    if (user?.id) {
      Object.keys(currentBets).forEach((t) => {
        deleteDoc(doc(db, 'andar_bahar_live_bets', `ABB_${roundId}_${user.id}_${t}`)).catch(() => {});
      });
    }

    // Persist Completed Round & Sync with Live State
    try {
      const roundDoc: AndarBaharRound = {
        id: roundId,
        roundNumber: roadHistory.length + 1,
        jokerCard: jokerCard!,
        andarCards: andarCards,
        baharCards: baharCards,
        winningSide: winSide,
        winningCard: winCard,
        totalCardsDealt: totalCardsCount,
        status: 'completed',
        startTime: Date.now() - ((configRef.current.bettingDurationSeconds || 15) * 1000),
        endTime: Date.now(),
        totalBetsAndar: tableBetsAndar + (currentBets['andar'] || 0),
        totalBetsBahar: tableBetsBahar + (currentBets['bahar'] || 0),
        totalPayout: totalWonAmt,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'andar_bahar_rounds', roundId.trim()), roundDoc, { merge: true });

      // Synchronize live_state with 0-second outcome and reset single-round manual overrides
      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        phase: 'completed',
        roundId: roundId.trim(),
        winningSide: winSide,
        winningCard: winCard,
        totalCardsDealt: totalCardsCount,
        lastSettledResult: {
          roundId: roundId.trim(),
          winningSide: winSide,
          settledAt: new Date().toISOString(),
        },
        // Reset manual override flags so future rounds calculate dynamically via House Edge
        isManualOverride: false,
        isAutoLowRiskActive: true,
        forcedWinner: 'random',
        manualForceWinner: 'random',
        manualForceTarget: 'random',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Guarantee game_settings reverts to Auto Low-Risk even if Admin is offline
      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        isManualOverride: false,
        forcedWinner: 'random',
        manualForceWinner: 'random',
        manualForceTarget: 'random',
        rtpMode: 'house_protect',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {}
  };

  // 7. Bet Placement Handler
  const handlePlaceBet = (target: AndarBaharBetTarget) => {
    if (gamePhase !== 'betting') {
      soundFx.playLossSound();
      return;
    }

    // Strict Opposite Bet Restriction (Andar vs Bahar)
    if (config.preventBothAndarBaharBet !== false) {
      if (target === 'andar' && (bets['bahar'] || 0) > 0) {
        soundFx.playError();
        setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: আন্দার এবং বাহার একসাথে বাজি ধরা যাবে না!');
        return;
      }
      if (target === 'bahar' && (bets['andar'] || 0) > 0) {
        soundFx.playError();
        setRestrictionToast('⚠️ বিপরীত বাজি নিষিদ্ধ: আন্দার এবং বাহার একসাথে বাজি ধরা যাবে না!');
        return;
      }
    }

    const effectiveMinBet = config.minBet || 50;
    const effectiveMaxBet = config.maxBet || 15000000;
    if (selectedChip < effectiveMinBet) {
      soundFx.playError();
      setRestrictionToast(`⚠️ সর্বনিম্ন বাজি সীমা ₹${effectiveMinBet.toLocaleString('en-IN')}`);
      return;
    }
    const targetTotal = (bets[target] || 0) + selectedChip;
    if (targetTotal > effectiveMaxBet) {
      soundFx.playError();
      setRestrictionToast(`⚠️ সর্বোচ্চ বাজি সীমা ₹${effectiveMaxBet.toLocaleString('en-IN')}`);
      return;
    }

    const currentBal = balanceRef.current;
    if (currentBal < selectedChip) {
      soundFx.playLossSound();
      setShowLowBalanceModal(true);
      return;
    }

    // Deduct chip amount from balance
    const newBal = Math.max(0, currentBal - selectedChip);
    balanceRef.current = newBal;
    prevReportedBalRef.current = newBal;
    setCurrentBalance(newBal);
    onUpdateBalance(newBal);

    const updatedUserBets = { ...betsRef.current, [target]: (betsRef.current[target] || 0) + selectedChip };
    betsRef.current = updatedUserBets;
    setBets(updatedUserBets);

    setBetHistoryStack((prev) => [...prev, { target, amount: selectedChip }]);

    if (target === 'andar') {
      setTableBetsAndar((prev) => prev + selectedChip);
    } else if (target === 'bahar') {
      setTableBetsBahar((prev) => prev + selectedChip);
    }

    // Persist real-time live bet to Firestore for 0-second Admin visibility & liability defense
    const liveBetDocId = `live_${roundId}_${user.id}_${target}_${Date.now()}`;
    setDoc(doc(db, 'andar_bahar_live_bets', liveBetDocId), {
      id: liveBetDocId,
      roundId,
      userId: user.id,
      userName: user.name || user.phone || 'Player',
      side: target,
      amount: selectedChip,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    soundFx.playChipPlace();
    if (voiceEnabled) {
      soundFx.speakBetPlaced(target, selectedChip, voiceLang);
    }

    let spotName = target === 'andar' ? '🎴 ANDAR (আন্দার)' : target === 'bahar' ? '🃏 BAHAR (বাহার)' : `📊 Range (${target.replace('range_', '').replace('_', '-')})`;
    let multStr = target === 'andar' ? '1.90x (0.9:1)' : target === 'bahar' ? '2.00x (1:1)' : 'Super Multiplier';

    // Log wallet transaction for bet placement
    const betTx: WalletTransaction = {
      id: `tx-ab-bet-${Date.now()}-${target}-${Math.floor(Math.random() * 10000)}`,
      userId: user.id,
      userEmail: (user.email || '').toLowerCase().trim(),
      type: 'andar_bahar_bet',
      amount: -selectedChip,
      description: `Placed ₹${selectedChip.toLocaleString('en-IN')} on ${target.toUpperCase()} (Round ${roundId})`,
      roundId,
      gameType: 'andar_bahar',
      betsBreakdown: [
        {
          spot: spotName,
          type: 'side',
          detail: target,
          amount: selectedChip,
          isWin: false,
          multiplier: multStr,
          payout: 0,
          outcomeProof: 'Round in progress'
        }
      ],
      status: 'completed',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      createdAt: new Date().toISOString()
    };
    onAddTransaction(betTx);

    // Real-Time Live Bet Sync for Admin Live Monitor (0-second latency)
    if (user?.id) {
      const liveBetDocId = `ABB_${roundId}_${user.id}_${target}`;
      const targetTotal = (bets[target] || 0) + selectedChip;
      const mult = target === 'andar' ? (config.andarMultiplier || 1.90) :
                   target === 'bahar' ? (config.baharMultiplier || 2.00) : 3.5;
      setDoc(doc(db, 'andar_bahar_live_bets', liveBetDocId), {
        id: liveBetDocId,
        roundId,
        userId: user.id,
        userName: user.name || 'Player',
        userPhone: user.phone || '',
        userEmail: user.email || '',
        spot: target,
        side: target === 'andar' ? 'andar' : target === 'bahar' ? 'bahar' : 'super_range',
        amount: targetTotal,
        multiplier: mult,
        potentialWin: Math.round(targetTotal * mult),
        timestamp: Date.now(),
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }, { merge: true }).catch(() => {});
    }

    // Real-time Activity Log for Admin Alert & Voice Shouting
    logLiveActivity({
      userId: user.id,
      userName: user.name || 'Player',
      userEmail: user.email,
      userPhone: user.phone,
      type: 'bet',
      gameName: 'Andar Bahar',
      betAmount: selectedChip,
      details: `Placed ₹${selectedChip} on ${target.toUpperCase()} (Andar Bahar)`
    });
  };

  // Undo last placed chip action
  const handleUndoBet = () => {
    if (gamePhase !== 'betting' || betHistoryStack.length === 0) return;
    const lastAction = betHistoryStack[betHistoryStack.length - 1];
    
    // Refund amount
    const newBal = balanceRef.current + lastAction.amount;
    balanceRef.current = newBal;
    prevReportedBalRef.current = newBal;
    setCurrentBalance(newBal);
    onUpdateBalance(newBal);

    const remainingAmount = (bets[lastAction.target] || 0) - lastAction.amount;

    setBets((prev) => {
      const current = prev[lastAction.target] || 0;
      const updated = current - lastAction.amount;
      const next = { ...prev };
      if (updated <= 0) {
        delete next[lastAction.target];
      } else {
        next[lastAction.target] = updated;
      }
      return next;
    });

    setBetHistoryStack((prev) => prev.slice(0, -1));
    soundFx.playClick();

    // Sync Undo to Real-Time Live Bets
    if (user?.id) {
      const liveBetDocId = `ABB_${roundId}_${user.id}_${lastAction.target}`;
      if (remainingAmount <= 0) {
        deleteDoc(doc(db, 'andar_bahar_live_bets', liveBetDocId)).catch(() => {});
      } else {
        const mult = lastAction.target === 'andar' ? (config.andarMultiplier || 1.90) :
                     lastAction.target === 'bahar' ? (config.baharMultiplier || 2.00) : 3.5;
        setDoc(doc(db, 'andar_bahar_live_bets', liveBetDocId), {
          amount: remainingAmount,
          potentialWin: Math.round(remainingAmount * mult),
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }
    }
  };

  // Double current placed bets
  const handleDoubleBets = () => {
    if (gamePhase !== 'betting' || totalUserBet <= 0) return;

    const currentBal = balanceRef.current;
    if (currentBal < totalUserBet) {
      setShowLowBalanceModal(true);
      return;
    }

    const newBal = Math.max(0, currentBal - totalUserBet);
    balanceRef.current = newBal;
    prevReportedBalRef.current = newBal;
    setCurrentBalance(newBal);
    onUpdateBalance(newBal);

    setBets((prev) => {
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([key, val]) => {
        next[key] = (Number(val) || 0) * 2;
      });
      return next;
    });

    soundFx.playChipPlace();

    // Sync Doubled Live Bets to Firestore
    if (user?.id) {
      Object.entries(bets).forEach(([target, prevAmt]) => {
        const doubledAmt = (Number(prevAmt) || 0) * 2;
        if (doubledAmt > 0) {
          const liveBetDocId = `ABB_${roundId}_${user.id}_${target}`;
          const mult = target === 'andar' ? (config.andarMultiplier || 1.90) :
                       target === 'bahar' ? (config.baharMultiplier || 2.00) : 3.5;
          setDoc(doc(db, 'andar_bahar_live_bets', liveBetDocId), {
            amount: doubledAmt,
            potentialWin: Math.round(doubledAmt * mult),
            timestamp: Date.now()
          }, { merge: true }).catch(() => {});
        }
      });
    }
  };

  // Calculate percentages for distribution
  const totalPool = tableBetsAndar + tableBetsBahar || 1;
  const andarPercentage = Math.round((tableBetsAndar / totalPool) * 100);
  const baharPercentage = 100 - andarPercentage;

  // Render dealer background based on current phase
  const dealerBg = gamePhase === 'betting' 
    ? dealerWelcomeImg 
    : gamePhase === 'dealing' 
    ? dealerDealingImg 
    : dealerTableImg;

  return (
    <div className="fixed inset-0 z-50 bg-[#12060a] flex flex-col h-screen h-[100dvh] overflow-hidden text-white select-none font-sans">
      
      {/* 1. TOP HEADER (EXACT REPLICA FROM VIDEO: < Back | INR ▾ 12.49 | Deposit | Bookmark) */}
      <header className="h-12 shrink-0 bg-[#0d0407]/95 border-b border-rose-950/40 px-3 flex items-center justify-between z-30 shadow-lg">
        {/* Left: Back button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="flex items-center gap-1.5 text-white/90 hover:text-white font-medium text-sm transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
          <span>Back</span>
        </button>

        {/* Center / Right: Currency + Balance Dropdown & Deposit Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Currency Dropdown & Real Wallet Balance */}
          <div className="flex flex-col items-end leading-tight cursor-pointer">
            <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium">
              <span>INR</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
              {(currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Green Pill Deposit Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              onOpenDeposit();
            }}
            className="px-4 py-1.5 rounded-full bg-[#00b16a] hover:bg-[#00c978] active:scale-95 text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer"
          >
            Deposit
          </button>

          {/* Bookmark / Ribbon Icon */}
          <button
            onClick={() => soundFx.playClick()}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Saved Games"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN CASINO STAGE */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
        
        {/* === LIVE DEALER VIDEO BROADCAST STAGE === */}
        <div className="relative w-full h-[36vh] sm:h-[40vh] bg-black overflow-hidden shrink-0 border-b border-rose-950/60 shadow-inner">
          {/* Live Studio Video Background Frame */}
          <img 
            src={dealerBg} 
            alt="Live Dealer" 
            className="w-full h-full object-cover object-center filter brightness-90 contrast-105 transition-all duration-700"
          />

          {/* Ambient Lighting Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#12060a] via-transparent to-black/40 pointer-events-none" />

          {/* Live Indicator at Top Right & 3 Voice Language Tabs */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
            {/* 3 Voice Language Tabs: বাংলা | हिन्दी | English */}
            <div className="flex items-center bg-black/80 backdrop-blur-md rounded-full border border-white/20 p-0.5 shadow-lg">
              <button
                type="button"
                onClick={() => handleSelectLanguage('bn')}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  voiceLang === 'bn' 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow ring-1 ring-emerald-300' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="বাংলা কণ্ঠস্বর"
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => handleSelectLanguage('hi')}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  voiceLang === 'hi' 
                    ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow ring-1 ring-amber-300' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="हिन्दी आवाज़"
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => handleSelectLanguage('en')}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  voiceLang === 'en' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow ring-1 ring-blue-300' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="English Voice"
              >
                English
              </button>
            </div>

            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[9px] font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-rose-400 uppercase tracking-wider">LIVE</span>
            </div>
          </div>

          {/* Top Left: Tap to Unmute Button */}
          <button
            onClick={() => {
              const muted = soundFx.toggleMute();
              setIsMuted(muted);
            }}
            className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-white text-[11px] font-medium transition-all active:scale-95 cursor-pointer shadow z-20"
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                <span>Tap to unmute</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio on</span>
              </>
            )}
          </button>

          {/* Table Joker Slot Marker on Dealer Table (Top Right of Felt) with Rainbow Animation */}
          <div className="absolute top-10 right-3 sm:right-6 flex flex-col items-center z-10">
            <div className="text-[9px] font-black text-amber-300 drop-shadow uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
              ANDAR BAHAR
            </div>
            <div className="relative w-10 h-14 bg-slate-900/90 rounded-lg rainbow-card-highlight shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center justify-center p-0.5">
              {jokerCard ? (
                <div className="text-center font-mono font-bold leading-tight">
                  <div className={`text-xs ${jokerCard.color === 'red' ? 'text-rose-500' : 'text-white'}`}>
                    {jokerCard.rank}
                  </div>
                  <div className={`text-[10px] ${jokerCard.color === 'red' ? 'text-rose-500' : 'text-white'}`}>
                    {getSuitDetails(jokerCard.suit).symbol}
                  </div>
                </div>
              ) : (
                <span className="text-amber-400 text-xs font-bold">?</span>
              )}
            </div>
          </div>

          {/* Status Message Overlay */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 shadow-xl flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gamePhase === 'betting' ? 'bg-emerald-400 animate-ping' : gamePhase === 'dealing' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400 animate-bounce'}`} />
              <span className="text-xs sm:text-sm font-black text-white tracking-wider uppercase drop-shadow">
                {gamePhase === 'betting' 
                  ? 'PLACE YOUR BETS' 
                  : gamePhase === 'dealing' 
                  ? 'CARDS DEALING...' 
                  : `${(winningSide || 'andar').toUpperCase()} WON`}
              </span>
            </div>
          </div>

          {/* Dynamic Physical Cards Dealt Across Green Felt with Rainbow Highlight Animation */}
          {gamePhase !== 'betting' && (
            <div className="absolute inset-x-2 sm:inset-x-4 bottom-2 flex flex-col gap-1 z-20 animate-fade-in bg-black/85 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(0,0,0,0.8)]">
              
              {/* ANDAR Row */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-cyan-300 w-16 shrink-0 drop-shadow flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${dealingActiveSide === 'andar' ? 'bg-cyan-400 animate-ping' : 'bg-cyan-400/50'}`} />
                  ANDAR ({andarCards.length})
                </span>
                <div 
                  ref={andarCardsRef}
                  className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none flex-1"
                >
                  {andarCards.length === 0 ? (
                    <span className="text-[10px] text-slate-500 italic">Waiting for cards...</span>
                  ) : (
                    andarCards.map((c, i) => {
                      const isMatchWinner = winningSide === 'andar' && c.rank === jokerCard?.rank && i === andarCards.length - 1;
                      const cardIndex = (i * 2) + 1; // 1, 3, 5, 7...
                      return (
                        <div 
                          key={`dealer_a_${c.id}_${i}`} 
                          className={`relative w-7 h-10 sm:w-8 sm:h-11 bg-white rounded-md shadow-md border flex flex-col items-center justify-center font-bold text-[11px] leading-tight shrink-0 transition-transform ${
                            isMatchWinner
                              ? 'rainbow-card-highlight border-amber-400 ring-2 ring-amber-400 scale-115 z-30 shadow-[0_0_20px_rgba(255,215,0,0.9)]'
                              : 'border-slate-300'
                          }`}
                        >
                          <span className="absolute -top-1.5 -left-1 px-1 bg-cyan-700 text-white text-[7px] font-mono rounded font-black">
                            #{cardIndex}
                          </span>
                          <span className={c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}>{c.rank}</span>
                          <span className={`text-[9px] -mt-1 ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {getSuitDetails(c.suit).symbol}
                          </span>
                          {isMatchWinner && (
                            <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-1 rounded-full shadow">
                              WIN
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* BAHAR Row */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-rose-300 w-16 shrink-0 drop-shadow flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${dealingActiveSide === 'bahar' ? 'bg-rose-400 animate-ping' : 'bg-rose-400/50'}`} />
                  BAHAR ({baharCards.length})
                </span>
                <div 
                  ref={baharCardsRef}
                  className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none flex-1"
                >
                  {baharCards.length === 0 ? (
                    <span className="text-[10px] text-slate-500 italic">Waiting for cards...</span>
                  ) : (
                    baharCards.map((c, i) => {
                      const isMatchWinner = winningSide === 'bahar' && c.rank === jokerCard?.rank && i === baharCards.length - 1;
                      const cardIndex = (i + 1) * 2; // 2, 4, 6, 8...
                      return (
                        <div 
                          key={`dealer_b_${c.id}_${i}`} 
                          className={`relative w-7 h-10 sm:w-8 sm:h-11 bg-white rounded-md shadow-md border flex flex-col items-center justify-center font-bold text-[11px] leading-tight shrink-0 transition-transform ${
                            isMatchWinner
                              ? 'rainbow-card-highlight border-amber-400 ring-2 ring-amber-400 scale-115 z-30 shadow-[0_0_20px_rgba(255,215,0,0.9)]'
                              : 'border-slate-300'
                          }`}
                        >
                          <span className="absolute -top-1.5 -left-1 px-1 bg-rose-700 text-white text-[7px] font-mono rounded font-black">
                            #{cardIndex}
                          </span>
                          <span className={c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}>{c.rank}</span>
                          <span className={`text-[9px] -mt-1 ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {getSuitDetails(c.suit).symbol}
                          </span>
                          {isMatchWinner && (
                            <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-1 rounded-full shadow">
                              WIN
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Circular Countdown Timer Badge (Green ring decreasing 11, 10, 9... 1) */}
          {gamePhase === 'betting' && (
            <div className="absolute bottom-2 right-3 flex items-center justify-center z-20">
              <div className="relative w-9 h-9 rounded-full bg-black/80 border-2 border-emerald-500 flex items-center justify-center font-bold text-white text-xs shadow-lg">
                <span>{countdown}</span>
              </div>
            </div>
          )}
        </div>

        {/* === PROMINENT WINNER RESULT OVERLAY / POPUP WHEN ROUND COMPLETES === */}
        {gamePhase === 'completed' && winningCard && jokerCard && showResultOverlay && (
          <div className="bg-[#1f0912] border-y-2 border-amber-400 px-3 py-2 animate-in slide-in-from-top-4 duration-300 shadow-[0_0_30px_rgba(255,215,0,0.3)] z-30 relative">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
              
              {/* Left Side: Matching Cards Pair (Joker & Winning Match) */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Joker Card */}
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-amber-300 uppercase">JOKER</span>
                  <div className="w-8 h-11 bg-white rounded-md border-2 border-amber-400 shadow flex flex-col items-center justify-center font-bold text-xs leading-none">
                    <span className={jokerCard.color === 'red' ? 'text-rose-600' : 'text-slate-900'}>{jokerCard.rank}</span>
                    <span className={`text-[9px] ${jokerCard.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {getSuitDetails(jokerCard.suit).symbol}
                    </span>
                  </div>
                </div>

                {/* Match Icon */}
                <div className="flex flex-col items-center justify-center text-amber-400 px-0.5">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span className="text-[8px] font-black">MATCH</span>
                </div>

                {/* Winning Card */}
                <div className="flex flex-col items-center">
                  <span className={`text-[8px] font-bold uppercase ${winningSide === 'andar' ? 'text-cyan-300' : 'text-rose-300'}`}>
                    WINNER
                  </span>
                  <div className="w-8 h-11 bg-white rounded-md border-2 border-amber-400 ring-2 ring-amber-400 shadow-lg flex flex-col items-center justify-center font-bold text-xs leading-none rainbow-card-highlight">
                    <span className={winningCard.color === 'red' ? 'text-rose-600' : 'text-slate-900'}>{winningCard.rank}</span>
                    <span className={`text-[9px] ${winningCard.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                      {getSuitDetails(winningCard.suit).symbol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Center: Winner Announcement Details */}
              <div className="flex-1 text-center min-w-0">
                <div className={`text-sm sm:text-base font-black tracking-wide uppercase flex items-center justify-center gap-1 ${
                  winningSide === 'andar' ? 'text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                }`}>
                  <Crown className="w-4 h-4 text-amber-400 inline" />
                  {winningSide === 'andar' ? 'ANDAR WINS!' : 'BAHAR WINS!'}
                </div>
                <div className="text-[10px] text-slate-300 font-mono">
                  Matched on Card <strong className="text-white">#{currentCardsDealtCount}</strong> • Total <strong className="text-amber-300">{andarCards.length + baharCards.length} Cards</strong>
                </div>
              </div>

              {/* Right: Dismiss button */}
              <button
                type="button"
                onClick={() => setShowResultOverlay(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
                title="Hide Result Banner"
              >
                <X className="w-4 h-4" />
              </button>

            </div>
          </div>
        )}

        {/* === ROAD BEADS (Roadmap History Dots: Cyan for Andar, Coral for Bahar) === */}
        <div className="px-3 py-1.5 bg-[#1a080f] border-b border-white/5 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Road:</span>
            {roadHistory.map((item, idx) => (
              <button
                key={`road_dot_${item.id}_${idx}`}
                type="button"
                onClick={() => setSelectedRoadItem(item)}
                className={`w-4 h-4 rounded-full shrink-0 shadow-sm flex items-center justify-center text-[8px] font-black text-white cursor-pointer transition-transform hover:scale-125 ${
                  item.winner === 'andar'
                    ? 'bg-cyan-500 ring-1 ring-cyan-300'
                    : 'bg-rose-500 ring-1 ring-rose-300'
                }`}
                title={`Click to view: ${item.winner.toUpperCase()} (${item.cardsCount} cards)`}
              >
                {item.winner === 'andar' ? 'A' : 'B'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 ml-2 shrink-0 underline cursor-pointer"
          >
            Stats & Cards
          </button>
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

        {/* === EVOLUTION SUPER ANDAR BAHAR MAIN BETTING BOARD === */}
        <div className="flex-1 px-2.5 sm:px-4 py-1.5 flex flex-col justify-between max-w-lg w-full mx-auto gap-1.5 overflow-y-auto">
          
          {/* TOP DUAL MAIN BETS: ANDAR vs BAHAR */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-stretch">
            
            {/* ANDAR & BAHAR Buttons Column */}
            <div className="flex flex-col gap-1.5">
              
              {/* ANDAR Main Box */}
              <button
                type="button"
                onClick={() => handlePlaceBet('andar')}
                className={`relative w-full h-11 sm:h-12 px-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                  (bets['bahar'] || 0) > 0 ? 'opacity-60 grayscale-[30%]' : ''
                } ${
                  winningSide === 'andar'
                    ? 'bg-[#15343d] border-cyan-400 ring-2 ring-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                    : bets['andar']
                    ? 'bg-[#15343d]/80 border-cyan-500 shadow-md'
                    : 'bg-[#2b1019] hover:bg-[#381622] border-white/10'
                }`}
              >
                {(bets['bahar'] || 0) > 0 && (
                  <div className="absolute top-1 right-2 bg-slate-950/95 border border-rose-500/60 px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold text-rose-300 flex items-center gap-1 shadow z-20 pointer-events-none">
                    <Lock className="w-2.5 h-2.5" />
                    <span>লকড</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm sm:text-base font-bold text-white tracking-wide">ANDAR</span>
                  <span className="text-[10px] text-slate-300 font-medium">{config.andarMultiplier ? `${(config.andarMultiplier - 1).toFixed(1)}:1` : '0.9:1'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Placed Chip Badge */}
                  {bets['andar'] && (
                    <div className="w-6 h-6 rounded-full bg-cyan-500 text-black font-black text-[10px] flex items-center justify-center shadow">
                      {bets['andar'] >= 1000 ? `${bets['andar']/1000}k` : bets['andar']}
                    </div>
                  )}
                  {/* Live player count & pool */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                    <span className="text-slate-400 text-xs">👤 {tablePlayersAndar}</span>
                    <span className="text-white font-medium">₹ {tableBetsAndar.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </button>

              {/* BAHAR Main Box */}
              <button
                type="button"
                onClick={() => handlePlaceBet('bahar')}
                className={`relative w-full h-11 sm:h-12 px-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                  (bets['andar'] || 0) > 0 ? 'opacity-60 grayscale-[30%]' : ''
                } ${
                  winningSide === 'bahar'
                    ? 'bg-[#40131d] border-rose-400 ring-2 ring-rose-400/80 shadow-[0_0_15px_rgba(244,63,94,0.5)]'
                    : bets['bahar']
                    ? 'bg-[#40131d]/80 border-rose-500 shadow-md'
                    : 'bg-[#2b1019] hover:bg-[#381622] border-white/10'
                }`}
              >
                {(bets['andar'] || 0) > 0 && (
                  <div className="absolute top-1 right-2 bg-slate-950/95 border border-rose-500/60 px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold text-rose-300 flex items-center gap-1 shadow z-20 pointer-events-none">
                    <Lock className="w-2.5 h-2.5" />
                    <span>লকড</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm sm:text-base font-bold text-white tracking-wide">BAHAR</span>
                  <span className="text-[10px] text-slate-300 font-medium">1:1</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Placed Chip Badge */}
                  {bets['bahar'] && (
                    <div className="w-6 h-6 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow">
                      {bets['bahar'] >= 1000 ? `${bets['bahar']/1000}k` : bets['bahar']}
                    </div>
                  )}
                  {/* Live player count & pool */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                    <span className="text-slate-400 text-xs">👤 {tablePlayersBahar}</span>
                    <span className="text-white font-medium">₹ {tableBetsBahar.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Percentage Distribution Indicator (Exact from video: Cyan Andar % / Coral Bahar %) */}
            <div className="w-9 h-full flex flex-col rounded-xl overflow-hidden border border-white/10 shrink-0 text-[9px] font-bold font-mono">
              <div 
                className="bg-[#009fb7] flex items-center justify-center text-white py-1 transition-all"
                style={{ height: `${andarPercentage}%` }}
              >
                <span>{andarPercentage}%</span>
              </div>
              <div 
                className="bg-[#e63946] flex items-center justify-center text-white py-1 transition-all"
                style={{ height: `${baharPercentage}%` }}
              >
                <span>{baharPercentage}%</span>
              </div>
            </div>

            {/* Joker Card Display Slot with Rainbow Animation */}
            <div className="w-14 sm:w-16 h-full rounded-xl bg-[#230c14] border border-white/15 rainbow-card-highlight shadow-[0_0_20px_rgba(255,215,0,0.3)] flex flex-col items-center justify-center p-1 shrink-0">
              {jokerCard ? (
                <div className="text-center font-bold">
                  <div className={`text-base font-mono leading-none ${jokerCard.color === 'red' ? 'text-rose-500' : 'text-white'}`}>
                    {jokerCard.rank}
                  </div>
                  <div className={`text-xs -mt-0.5 ${jokerCard.color === 'red' ? 'text-rose-500' : 'text-white'}`}>
                    {getSuitDetails(jokerCard.suit).symbol}
                  </div>
                  <span className="text-[7px] text-amber-400 font-mono uppercase block mt-0.5">JOKER</span>
                </div>
              ) : (
                <span className="text-amber-400 font-bold text-lg">?</span>
              )}
            </div>

          </div>

          {/* === SUPER ANDAR BAHAR SIDE BETS (CARDS DEALT 10-RANGE GRID) === */}
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-1">
              {SUPER_ANDAR_BAHAR_RANGES.map((range) => {
                const superMult = superMultipliers[range.key];
                const hasBet = bets[range.key];
                const isWinningRange = gamePhase === 'completed' && 
                  currentCardsDealtCount >= range.minCards && 
                  currentCardsDealtCount <= range.maxCards;

                return (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => handlePlaceBet(range.key as SuperAndarBaharRange)}
                    className={`relative h-11 sm:h-12 rounded-lg border p-1 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      isWinningRange
                        ? 'rainbow-card-highlight bg-amber-950 border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(255,215,0,0.6)] scale-102 z-10'
                        : hasBet
                        ? 'bg-[#3b1523] border-amber-500'
                        : 'bg-[#210a13] hover:bg-[#2e101b] border-white/10'
                    }`}
                  >
                    {/* Range Label */}
                    <span className="text-[10px] sm:text-xs font-bold text-slate-200 leading-none">
                      {range.key}
                    </span>

                    {/* Multiplier / Super Multiplier Badge */}
                    {superMult ? (
                      <span className="text-[10px] sm:text-[11px] font-black text-amber-300 font-mono bg-amber-500/30 px-1 rounded mt-0.5 animate-pulse shadow-sm">
                        {superMult}x
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 font-mono mt-0.5">
                        {range.baseRatio}
                      </span>
                    )}

                    {/* Placed Chip indicator on Side Bet */}
                    {hasBet && (
                      <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-amber-400 text-black font-black text-[8px] flex items-center justify-center shadow">
                        {hasBet >= 1000 ? `${hasBet/1000}k` : hasBet}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Center "Cards dealt: X" Tracker Badge */}
            <div className="flex items-center justify-center">
              <div className="px-3 py-0.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-medium text-slate-300 tracking-wide">
                Cards dealt <strong className="text-white ml-1">{currentCardsDealtCount}</strong>
              </div>
            </div>

            {/* Real-time Betting Limits Display (0s Latency) */}
            <div className="flex items-center justify-between px-3 py-1 rounded-xl bg-black/40 border border-white/5 text-[10px] text-slate-300 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>লিমিট: <strong className="text-white">₹{(config.minBet || 50).toLocaleString('en-IN')} - ₹{(config.maxBet || 15000000).toLocaleString('en-IN')}</strong></span>
              </span>
              <span className="text-amber-400/90 text-[9px] font-bold">
                0s রিয়েল-টাইম সিঙ্ক
              </span>
            </div>
          </div>

          {/* === INTERACTIVE CHIPS & ACTION BAR (Undo, Chips, 2X Double, Menu) === */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            
            {/* Left: Repeat / Undo button */}
            <button
              type="button"
              onClick={handleUndoBet}
              disabled={gamePhase !== 'betting' || betHistoryStack.length === 0}
              className="w-10 h-10 rounded-full bg-[#260d16] hover:bg-[#351320] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 transition-all cursor-pointer active:scale-95 shrink-0 shadow"
              title="Undo last chip"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Center: Chip Selector Carousel */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              {CHIP_VALUES.map((val) => {
                const isSelected = selectedChip === val;
                return (
                  <button
                    key={`chip_${val}`}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedChip(val);
                    }}
                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex flex-col items-center justify-center font-mono font-black border-2 transition-all transform cursor-pointer shrink-0 ${
                      isSelected
                        ? 'scale-110 -translate-y-1 ring-2 ring-white shadow-xl z-10'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    } ${
                      val === 10
                        ? 'bg-gradient-to-br from-slate-700 to-slate-900 border-dashed border-slate-400 text-white'
                        : val === 50
                        ? 'bg-gradient-to-br from-amber-700 to-amber-900 border-dashed border-amber-300 text-white'
                        : val === 100
                        ? 'bg-gradient-to-br from-blue-700 to-blue-900 border-dashed border-blue-300 text-white'
                        : val === 500
                        ? 'bg-gradient-to-br from-purple-700 to-purple-900 border-dashed border-purple-300 text-white'
                        : val === 1000
                        ? 'bg-gradient-to-br from-emerald-700 to-emerald-900 border-dashed border-emerald-300 text-white'
                        : 'bg-gradient-to-br from-yellow-500 to-amber-600 border-dashed border-yellow-200 text-slate-950'
                    }`}
                  >
                    <span className="text-[9px] sm:text-[10px] font-black leading-none">
                      {val >= 1000 ? `${val / 1000}k` : val}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Double 2X button */}
            <button
              type="button"
              onClick={handleDoubleBets}
              disabled={gamePhase !== 'betting' || totalUserBet === 0}
              className="w-10 h-10 rounded-full bg-[#260d16] hover:bg-[#351320] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white font-bold text-xs disabled:opacity-30 transition-all cursor-pointer active:scale-95 shrink-0 shadow"
              title="Double bets (2X)"
            >
              2X
            </button>

            {/* Right: Hamburger Menu (Opens Evolution 6-Tile Menu) */}
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setShowMenuModal(true);
              }}
              className="w-10 h-10 rounded-full bg-[#260d16] hover:bg-[#351320] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 shrink-0 shadow"
              title="Game Menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

          </div>

        </div>

        {/* === 3. BOTTOM FOOTER BAR (Exact from video) === */}
        <footer className="h-10 shrink-0 bg-[#0a0306] border-t border-white/5 px-3 flex items-center justify-between text-[11px] text-slate-300 font-sans z-20">
          {/* Left: Live dealer greeting */}
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <span className="text-white font-medium truncate max-w-[150px] sm:max-w-xs">
              Vjacelavs: <span className="text-slate-300 font-normal">Hello, Welcome to Super Andar Bahar!</span>
            </span>
          </div>

          {/* Right: Total Bet | Limits | Timestamp */}
          <div className="flex items-center gap-3 shrink-0 text-[10px] sm:text-[11px] text-slate-400 font-mono">
            <div>
              <span>Total Bet: </span>
              <strong className="text-white font-bold">₹{totalUserBet}</strong>
            </div>

            <div className="hidden sm:block text-slate-400">
              Super Andar Bahar <span className="text-white">₹50 - 2,500,000</span>
            </div>

            <div className="text-slate-400">
              {roundId}
            </div>
          </div>
        </footer>

      </div>

      {/* ========================================================================= */}
      {/* 4. EVOLUTION 6-TILE BOTTOM SHEET MENU (EXACT REPLICA FROM VIDEO AT 0:33)   */}
      {/* ========================================================================= */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#16070c] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 text-white space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white tracking-wide">Menu</h3>
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 6 Square Grid Tiles (Lobby, Statistics, Chat, Live Support, Game History, Settings) */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* 1. Lobby */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  onClose();
                }}
                className="h-20 bg-[#250d15] hover:bg-[#34131e] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Lobby</span>
              </button>

              {/* 2. Statistics */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  setShowStatsModal(true);
                }}
                className="h-20 bg-[#250d15] hover:bg-[#34131e] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Statistics</span>
              </button>

              {/* 3. Chat */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  setShowChatModal(true);
                }}
                className="h-20 bg-[#250d15] hover:bg-[#34131e] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Chat</span>
              </button>

              {/* 4. Live Support */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  alert('24/7 VIP Live Casino Support is active via WhatsApp & Live Chat.');
                }}
                className="h-20 bg-[#250d15] hover:bg-[#34131e] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Live Support</span>
              </button>

              {/* 5. Game History */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  setShowHistoryModal(true);
                }}
                className="h-20 bg-[#250d15] hover:bg-[#34131e] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Game History</span>
              </button>

              {/* 6. Settings */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  setShowRulesModal(true);
                }}
                className="h-20 bg-[#250d15] hover:bg-[#34131e] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-white">Settings</span>
              </button>
            </div>

            {/* Bottom Links (How to Play, Payouts & Limits, Volume) */}
            <div className="pt-2 border-t border-white/10 space-y-2 text-xs text-slate-300">
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  setShowRulesModal(true);
                }}
                className="w-full py-1.5 flex items-center justify-between hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>How to Play</span>
                </div>
              </button>

              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowMenuModal(false);
                  setShowPayoutsModal(true);
                }}
                className="w-full py-1.5 flex items-center justify-between hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                  <span>Payouts & Limits</span>
                </div>
              </button>

              {/* Dealer Voice Language Selector */}
              <div className="py-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Dealer Voice Announcement</span>
                  <button
                    onClick={() => {
                      const next = !voiceEnabled;
                      setVoiceEnabled(next);
                      try {
                        localStorage.setItem('ab_voice_enabled', String(next));
                      } catch {}
                      soundFx.playClick();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                      voiceEnabled 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {voiceEnabled ? 'VOICE ON' : 'MUTED'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => handleSelectLanguage('bn')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      voiceLang === 'bn'
                        ? 'bg-emerald-600/90 text-white ring-2 ring-emerald-400 shadow'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span>🇧🇩 বাংলা</span>
                    <span className="text-[9px] font-normal opacity-80">Bengali</span>
                  </button>

                  <button
                    onClick={() => handleSelectLanguage('hi')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      voiceLang === 'hi'
                        ? 'bg-amber-600/90 text-white ring-2 ring-amber-400 shadow'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span>🇮🇳 हिन्दी</span>
                    <span className="text-[9px] font-normal opacity-80">Hindi</span>
                  </button>

                  <button
                    onClick={() => handleSelectLanguage('en')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      voiceLang === 'en'
                        ? 'bg-blue-600/90 text-white ring-2 ring-blue-400 shadow'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span>🇬🇧 English</span>
                    <span className="text-[9px] font-normal opacity-80">English</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Sound Effects (SFX)</span>
                <button
                  onClick={() => {
                    const muted = soundFx.toggleMute();
                    setIsMuted(muted);
                  }}
                  className="p-1.5 rounded-lg bg-[#250d15] hover:bg-[#34131e] text-slate-200 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LOW BALANCE MODAL (EXACT REPLICA FROM VIDEO AT 0:05 AND 1:44)         */}
      {/* ========================================================================= */}
      {showLowBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-[#1a080f] border border-cyan-500/40 rounded-3xl p-6 text-center space-y-4 shadow-[0_0_40px_rgba(6,182,212,0.3)] animate-in zoom-in-95 duration-200">
            
            <h3 className="text-lg font-black text-cyan-400 tracking-wider uppercase">
              LOW BALANCE
            </h3>

            <p className="text-sm text-slate-200 font-sans leading-relaxed">
              Your balance is too low to play. Please deposit funds into your account.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowLowBalanceModal(false);
                  onOpenDeposit();
                }}
                className="w-full py-3 bg-[#00b16a] hover:bg-[#00c978] text-white font-bold text-sm rounded-full transition-all cursor-pointer shadow"
              >
                DEPOSIT NOW
              </button>

              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowLowBalanceModal(false);
                }}
                className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs rounded-full transition-all cursor-pointer"
              >
                CLOSE
              </button>
            </div>

            <div className="text-[10px] text-slate-500 font-mono">
              03:56:37
            </div>
          </div>
        </div>
      )}

      {/* 6. STATISTICS MODAL */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#1a080f] border border-white/15 rounded-3xl p-5 text-white space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold">Game Statistics & Road</h3>
              <button
                onClick={() => setShowStatsModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3 bg-[#260d16] rounded-xl border border-cyan-500/30 text-center">
                <span className="text-xs text-cyan-400 font-bold block">ANDAR WINS</span>
                <span className="text-2xl font-black text-white mt-1 block">{andarPercentage}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{roadHistory.filter(r => r.winner === 'andar').length} Rounds</span>
              </div>

              <div className="p-3 bg-[#260d16] rounded-xl border border-rose-500/30 text-center">
                <span className="text-xs text-rose-400 font-bold block">BAHAR WINS</span>
                <span className="text-2xl font-black text-white mt-1 block">{baharPercentage}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{roadHistory.filter(r => r.winner === 'bahar').length} Rounds</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">Recent Road History</span>
              <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
                {roadHistory.map((r, i) => (
                  <button 
                    key={`hist_${r.id}_${i}`} 
                    type="button"
                    onClick={() => {
                      setSelectedRoadItem(r);
                    }}
                    className={`p-2 rounded-lg text-center border cursor-pointer transition-transform hover:scale-105 ${
                      r.winner === 'andar' ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span className="font-black block">{r.winner === 'andar' ? 'ANDAR' : 'BAHAR'}</span>
                    <span className="text-[9px] text-slate-400 block">{r.cardsCount} cards</span>
                    <span className="text-[8px] text-amber-400 block">Rank {r.rank}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowStatsModal(false)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* 6B. ROAD DETAIL MODAL */}
      {selectedRoadItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xs bg-[#1a080f] border border-amber-400/40 rounded-3xl p-5 text-white space-y-3 text-center shadow-[0_0_35px_rgba(255,215,0,0.3)]">
            <div className={`text-base font-black uppercase tracking-wider ${selectedRoadItem.winner === 'andar' ? 'text-cyan-400' : 'text-rose-400'}`}>
              {selectedRoadItem.winner === 'andar' ? 'ANDAR WON' : 'BAHAR WON'}
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Cards Drawn:</span>
                <span className="font-bold text-amber-300">{selectedRoadItem.cardsCount} Cards</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Winning Card Rank:</span>
                <span className="font-bold text-white">{selectedRoadItem.rank}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Winning Range:</span>
                <span className="font-bold text-emerald-400">
                  {selectedRoadItem.cardsCount <= 5 ? '1-5 (3.5x)' : selectedRoadItem.cardsCount <= 10 ? '6-10 (4x)' : selectedRoadItem.cardsCount <= 15 ? '11-15 (5x)' : '16+ (Long Game)'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedRoadItem(null)}
              className="w-full py-2.5 bg-[#00b16a] hover:bg-[#00c978] text-white font-bold text-xs rounded-xl"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* 7. LIVE CHAT MODAL */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#1a080f] border border-white/15 rounded-3xl p-5 text-white space-y-3 flex flex-col h-[70vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">Live Casino Table Chat</h3>
              </div>
              <button onClick={() => setShowChatModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-amber-400">{msg.user}</span>
                    <span>{msg.time}</span>
                  </div>
                  <p className="text-slate-200">{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-white/10 shrink-0">
              <input
                type="text"
                value={newChatText}
                onChange={(e) => setNewChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newChatText.trim()) {
                    setChatMessages(prev => [...prev, {
                      id: `${Date.now()}`,
                      user: user.name || 'Player',
                      text: newChatText.trim(),
                      time: new Date().toTimeString().slice(0, 5)
                    }]);
                    setNewChatText('');
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => {
                  if (newChatText.trim()) {
                    setChatMessages(prev => [...prev, {
                      id: `${Date.now()}`,
                      user: user.name || 'Player',
                      text: newChatText.trim(),
                      time: new Date().toTimeString().slice(0, 5)
                    }]);
                    setNewChatText('');
                  }
                }}
                className="px-3 py-2 bg-[#00b16a] text-white font-bold text-xs rounded-xl"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. PAYOUTS & LIMITS MODAL */}
      {showPayoutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#1a080f] border border-white/15 rounded-3xl p-5 text-white space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-sm font-bold">Super Andar Bahar Payouts & Limits</h3>
              <button onClick={() => setShowPayoutsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#260d16] border border-white/5 flex items-center justify-between">
                <span>ANDAR</span>
                <span className="font-bold text-cyan-400">0.9:1 (1.90x)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#260d16] border border-white/5 flex items-center justify-between">
                <span>BAHAR</span>
                <span className="font-bold text-rose-400">1:1 (2.00x)</span>
              </div>

              <span className="text-xs font-bold text-amber-400 block pt-1">Side Bet Super Multipliers</span>
              {SUPER_ANDAR_BAHAR_RANGES.map(r => (
                <div key={r.key} className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[11px]">
                  <span>Cards {r.key}</span>
                  <span className="text-slate-300">{r.baseRatio} <strong className="text-amber-400 ml-1">(Up to {r.possibleSuperMultipliers[r.possibleSuperMultipliers.length - 1]}x)</strong></span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPayoutsModal(false)}
              className="w-full py-2 bg-white/10 text-white font-bold text-xs rounded-xl"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* 9. GAME RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#1a080f] border border-white/15 rounded-3xl p-5 text-white space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-sm font-bold">How to Play Super Andar Bahar</h3>
              <button onClick={() => setShowRulesModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong className="text-white">1. The Joker (Lead Card):</strong> The round begins with the dealer drawing one Joker card (e.g. 10 of Diamonds).
              </p>
              <p>
                <strong className="text-white">2. Betting:</strong> Place your bets on <span className="text-cyan-400 font-bold">ANDAR</span>, <span className="text-rose-400 font-bold">BAHAR</span>, or any of the 10 Side Bet Ranges (1-5, 6-10, up to 46-49).
              </p>
              <p>
                <strong className="text-white">3. Super Multipliers:</strong> Random lightning multipliers are applied to side bets (up to 4000x)!
              </p>
              <p>
                <strong className="text-white">4. Dealing & Winning:</strong> Cards are dealt alternately to Andar, then Bahar. The first card that matches the Joker's rank wins the round!
              </p>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 bg-[#00b16a] text-white font-bold text-xs rounded-xl"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* 10. HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#1a080f] border border-white/15 rounded-3xl p-5 text-white space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 shrink-0">
              <h3 className="text-sm font-bold">My Bet History</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
              {myBetsHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No bets placed in this session yet.
                </div>
              ) : (
                myBetsHistory.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white uppercase">{b.side}</span>
                      <span className="text-[10px] text-slate-400 block">{b.roundId}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-300">₹{b.amount}</span>
                      <span className={`block font-bold text-[11px] ${b.status === 'won' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {b.status === 'won' ? `+₹${b.wonAmount}` : 'LOST'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full py-2 bg-white/10 text-white font-bold text-xs rounded-xl shrink-0"
            >
              CLOSE
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
