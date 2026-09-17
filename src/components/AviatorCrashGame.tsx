import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Volume2, VolumeX, Sparkles, HelpCircle, History, 
  RotateCcw, Zap, CheckCircle2, ChevronRight, Crown, TrendingUp, 
  ShieldCheck, Plus, AlertTriangle, MessageSquare, Maximize2, 
  Minimize2, Settings, User as UserIcon, X, Send, Play, Flame, 
  Award, RefreshCw, Check, CheckSquare, Square, Receipt, FileText,
  TrendingDown, SlidersHorizontal
} from 'lucide-react';
import { 
  User, WalletTransaction, CrashGameConfig, CrashRound, CrashBet, 
  CrashCommunityBet, CrashChatMessage 
} from '../types';
import { soundFx } from '../utils/audio';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { 
  DEFAULT_CRASH_CONFIG, generateCrashMultiplier, calculateLiveMultiplier, 
  AVIATOR_AVATARS, generateCommunityBets, INITIAL_CRASH_ROUNDS_HISTORY,
  getUniversalCrashTimeState, getSyncedCrashHistory
} from '../utils/crashGame';
import { triggerConfetti } from '../utils/confetti';
import { trackUserPresence, logLiveActivity } from '../utils/activityTracker';

interface AviatorCrashGameProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
  onBigWin?: (data: any) => void;
}

export const AviatorCrashGame: React.FC<AviatorCrashGameProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit,
  onBigWin
}) => {
  // 1. Config & Live Settings State from Firestore
  const [config, setConfig] = useState<CrashGameConfig>(DEFAULT_CRASH_CONFIG);

  // 2. Game Lifecycle States
  const initialCrashState = useMemo(() => getUniversalCrashTimeState(Date.now()), []);
  const [gamePhase, setGamePhase] = useState<'waiting' | 'flying' | 'crashed'>(initialCrashState.phase);
  const [roundId, setRoundId] = useState<string>(initialCrashState.roundDetails.roundId);
  const [roundNumber, setRoundNumber] = useState<number>(initialCrashState.roundDetails.roundNumber);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(initialCrashState.currentMultiplier);
  const [crashPoint, setCrashPoint] = useState<number>(initialCrashState.roundDetails.crashMultiplier);
  const [waitingCountdown, setWaitingCountdown] = useState<number>(initialCrashState.waitingCountdown);
  const [roundHistory, setRoundHistory] = useState<number[]>(() => {
    return getSyncedCrashHistory(initialCrashState.roundIndex, 30);
  });

  // 3. Betting Panels State (Dual Panels like Spribe Aviator)
  // Panel 1
  const [bet1Amount, setBet1Amount] = useState<number>(10);
  const [bet1Placed, setBet1Placed] = useState<boolean>(false);
  const [bet1Queued, setBet1Queued] = useState<boolean>(false);
  const [bet1CashedOut, setBet1CashedOut] = useState<boolean>(false);
  const [bet1WonAmount, setBet1WonAmount] = useState<number>(0);
  const [bet1CashOutMult, setBet1CashOutMult] = useState<number>(0);
  const [isAutoBet1, setIsAutoBet1] = useState<boolean>(false);
  const [isAutoCash1, setIsAutoCash1] = useState<boolean>(false);
  const [autoCash1Target, setAutoCash1Target] = useState<number>(2.00);
  const [activeTab1, setActiveTab1] = useState<'bet' | 'auto'>('bet');
  const [betMessage1, setBetMessage1] = useState<string>('');

  // Panel 2
  const [bet2Amount, setBet2Amount] = useState<number>(10);
  const [bet2Placed, setBet2Placed] = useState<boolean>(false);
  const [bet2Queued, setBet2Queued] = useState<boolean>(false);
  const [bet2CashedOut, setBet2CashedOut] = useState<boolean>(false);
  const [bet2WonAmount, setBet2WonAmount] = useState<number>(0);
  const [bet2CashOutMult, setBet2CashOutMult] = useState<number>(0);
  const [isAutoBet2, setIsAutoBet2] = useState<boolean>(false);
  const [isAutoCash2, setIsAutoCash2] = useState<boolean>(false);
  const [autoCash2Target, setAutoCash2Target] = useState<number>(3.00);
  const [activeTab2, setActiveTab2] = useState<'bet' | 'auto'>('bet');
  const [betMessage2, setBetMessage2] = useState<string>('');

  // 4. Community Bets, Top Records & Live Chat
  const [communityBets, setCommunityBets] = useState<CrashCommunityBet[]>(() => generateCommunityBets(28));
  const [bottomTab, setBottomTab] = useState<'all' | 'previous' | 'top' | 'my_bets'>('all');
  const [topPeriod, setTopPeriod] = useState<'day' | 'month' | 'year'>('day');
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<CrashChatMessage[]>([
    { id: '1', userId: 'bot-1', userName: '8***5', avatarUrl: AVIATOR_AVATARS[0], text: 'Mega flight incoming! 🚀', timestamp: Date.now() - 120000 },
    { id: '2', userId: 'bot-2', userName: '3***2', avatarUrl: AVIATOR_AVATARS[1], text: 'Good luck pilots! ✈️', timestamp: Date.now() - 60000 },
    { id: '3', userId: 'bot-3', userName: '1***9', avatarUrl: AVIATOR_AVATARS[2], text: 'Cashed out 15x on last round! 🔥', timestamp: Date.now() - 20000 }
  ]);
  const [chatInput, setChatInput] = useState<string>('');

  // 5. Modals & Settings
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getMuted());
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAvatarModal, setShowAvatarModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [userAvatar, setUserAvatar] = useState<string>(user.avatarUrl || AVIATOR_AVATARS[0]);
  const [myBetsHistory, setMyBetsHistory] = useState<{
    id: string;
    roundId: string;
    betAmount: number;
    cashOutMultiplier?: number;
    wonAmount?: number;
    status: 'won' | 'lost';
    date: string;
  }[]>([]);

  // Canvas Ref & Animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flightStartTimeRef = useRef<number>(0);
  const currentMultRef = useRef<number>(1.00);
  const crashPointRef = useRef<number>(2.45);
  const gamePhaseRef = useRef<'waiting' | 'flying' | 'crashed'>('waiting');
  const roundIdRef = useRef<string>(roundId);
  const roundNumberRef = useRef<number>(roundNumber);
  const configRef = useRef<CrashGameConfig>(config);
  const userRef = useRef<User>(user);
  const userAvatarRef = useRef<string>(userAvatar);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  const onAddTransactionRef = useRef(onAddTransaction);
  const onBigWinRef = useRef(onBigWin);

  const activeGlobalRoundRef = useRef<number>(-1);
  const settledRoundRef = useRef<number>(-1);
  const soundTriggersRef = useRef<Set<string>>(new Set());

  // Keep refs in sync for interval / animation loops
  gamePhaseRef.current = gamePhase;
  roundIdRef.current = roundId;
  roundNumberRef.current = roundNumber;
  configRef.current = config;
  userRef.current = user;
  userAvatarRef.current = userAvatar;
  onUpdateBalanceRef.current = onUpdateBalance;
  onAddTransactionRef.current = onAddTransaction;
  onBigWinRef.current = onBigWin;

  const bet1AmountRef = useRef(bet1Amount);
  bet1AmountRef.current = bet1Amount;
  const bet1PlacedRef = useRef(bet1Placed);
  bet1PlacedRef.current = bet1Placed;
  const bet1CashedOutRef = useRef(bet1CashedOut);
  bet1CashedOutRef.current = bet1CashedOut;
  const bet1QueuedRef = useRef(bet1Queued);
  bet1QueuedRef.current = bet1Queued;
  const isAutoBet1Ref = useRef(isAutoBet1);
  isAutoBet1Ref.current = isAutoBet1;
  const isAutoCash1Ref = useRef(isAutoCash1);
  isAutoCash1Ref.current = isAutoCash1;
  const autoCash1TargetRef = useRef(autoCash1Target);
  autoCash1TargetRef.current = autoCash1Target;

  const bet2AmountRef = useRef(bet2Amount);
  bet2AmountRef.current = bet2Amount;
  const bet2PlacedRef = useRef(bet2Placed);
  bet2PlacedRef.current = bet2Placed;
  const bet2CashedOutRef = useRef(bet2CashedOut);
  bet2CashedOutRef.current = bet2CashedOut;
  const bet2QueuedRef = useRef(bet2Queued);
  bet2QueuedRef.current = bet2Queued;
  const isAutoBet2Ref = useRef(isAutoBet2);
  isAutoBet2Ref.current = isAutoBet2;
  const isAutoCash2Ref = useRef(isAutoCash2);
  isAutoCash2Ref.current = isAutoCash2;
  const autoCash2TargetRef = useRef(autoCash2Target);
  autoCash2TargetRef.current = autoCash2Target;

  // Real-time Firestore configuration synchronization & 0s latency live controller
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_settings', 'crash_game'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const forcedM = data.manualForceNextMultiplier !== undefined && data.manualForceNextMultiplier !== null && !isNaN(Number(data.manualForceNextMultiplier))
          ? Number(data.manualForceNextMultiplier)
          : null;
        setConfig((prev) => {
          const next: CrashGameConfig = { 
            ...prev, 
            ...data,
            manualForceNextMultiplier: forcedM !== null ? forcedM : prev.manualForceNextMultiplier,
            forcedCrashMultiplier: forcedM !== null ? forcedM : (prev as any).forcedCrashMultiplier,
          };
          configRef.current = next;
          return next;
        });
      }
    }, (err) => console.warn('Crash config snapshot note:', err.message));

    const unsubLiveState = onSnapshot(doc(db, 'crash_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const forcedM = data.isManualOverride && typeof data.forcedCrashMultiplier === 'number'
          ? data.forcedCrashMultiplier
          : (typeof data.manualForceNextMultiplier === 'number' ? data.manualForceNextMultiplier : null);

        if (data.forceInstantCrash && gamePhaseRef.current === 'flying') {
          crashPointRef.current = currentMultRef.current;
          setCrashPoint(currentMultRef.current);
        } else if (forcedM !== null) {
          crashPointRef.current = forcedM;
          setCrashPoint(forcedM);
        }

        const nextMin = data.minBet !== undefined ? Number(data.minBet) : undefined;
        const nextMax = data.maxBet !== undefined ? Number(data.maxBet) : undefined;

        if (nextMin !== undefined || nextMax !== undefined) {
          const effectiveMin = nextMin ?? 10;
          const effectiveMax = nextMax ?? 500000;
          setBet1Amount((prev) => {
            if (prev < effectiveMin) return effectiveMin;
            if (prev > effectiveMax) return effectiveMax;
            return prev;
          });
          setBet2Amount((prev) => {
            if (prev < effectiveMin) return effectiveMin;
            if (prev > effectiveMax) return effectiveMax;
            return prev;
          });
        }

        setConfig((prev) => {
          const next: CrashGameConfig = {
            ...prev,
            manualForceNextMultiplier: forcedM,
            forcedCrashMultiplier: forcedM,
            isManualOverride: !!data.isManualOverride,
            forceInstantCrash: !!data.forceInstantCrash,
            minBet: nextMin !== undefined ? nextMin : prev.minBet,
            maxBet: nextMax !== undefined ? nextMax : prev.maxBet,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
          } as any;
          configRef.current = next;
          return next;
        });
      }
    }, (err) => console.warn('Crash live state note:', err.message));

    return () => {
      unsub();
      unsubLiveState();
    };
  }, []);

  // Sync user balance & avatar
  useEffect(() => {
    if (user.avatarUrl) setUserAvatar(user.avatarUrl);
  }, [user.avatarUrl]);

  // Real-time Firestore Bets Synchronization across all devices/browsers
  useEffect(() => {
    if (!user?.id && !user?.email) return;

    const activeUid = user.id || '';
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const qBets = query(collection(db, 'crash_bets'), limit(300));
    const unsub = onSnapshot(qBets, (snap) => {
      if (!snap.empty) {
        const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        const userFiltered = allDocs.filter((b) => 
          b.userId === activeUid || 
          (cleanEmail && (
            b.userId === fallbackUid || 
            b.userId === cleanEmail || 
            (b.userEmail && b.userEmail.toLowerCase().trim() === cleanEmail)
          ))
        );

        // Sort newest first
        userFiltered.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        const mapped = userFiltered.map((b) => ({
          id: b.id,
          roundId: b.roundId || 'CRASH-ROUND',
          betAmount: Number(b.betAmount || 0),
          cashOutMultiplier: b.cashOutMultiplier ? Number(b.cashOutMultiplier) : undefined,
          wonAmount: b.wonAmount ? Number(b.wonAmount) : undefined,
          status: (b.status === 'won' ? 'won' : 'lost') as 'won' | 'lost',
          date: b.date || (b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString())
        }));

        setMyBetsHistory(mapped);
      } else {
        setMyBetsHistory([]);
      }
    }, (err) => {
      console.warn('Real-time crash bets snapshot notice:', err.message);
    });

    return () => unsub();
  }, [user?.id, user?.email]);

  const bet1CurrentIdRef = useRef<string>('');
  const bet2CurrentIdRef = useRef<string>('');

  // Cashout Helper function for Panel 1
  const handleCashout1 = useCallback((mult: number) => {
    if (!bet1PlacedRef.current || bet1CashedOutRef.current || gamePhaseRef.current !== 'flying') return;
    setBet1CashedOut(true);
    bet1CashedOutRef.current = true;
    const amount = bet1AmountRef.current;
    const winAmt = Math.floor(amount * mult * 100) / 100;
    setBet1WonAmount(winAmt);
    setBet1CashOutMult(mult);

    // Audio & Confetti
    if (mult >= 10.0) {
      soundFx.playCashoutBigWin();
      triggerConfetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    } else {
      soundFx.playCashoutWin();
    }

    const currentBal = userRef.current.balance || 0;
    const newBalance = currentBal + winAmt;
    onUpdateBalanceRef.current(newBalance);
    userRef.current.balance = newBalance;

    onBigWinRef.current?.({
      id: `crash-win-1-${Date.now()}`,
      category: 'crash',
      title: 'এভিয়েটর সুপারসনিক ক্যাশআউট!',
      subtitle: 'AVIATOR SUPERSONIC WIN',
      amount: winAmt,
      multiplier: `${mult.toFixed(2)}x`,
      crashMultiplier: mult,
      drawOrRoundId: roundIdRef.current
    });

    // Update Firestore crash_bets doc in real-time
    if (bet1CurrentIdRef.current) {
      try {
        setDoc(doc(db, 'crash_bets', bet1CurrentIdRef.current), {
          status: 'won',
          cashOutMultiplier: mult,
          wonAmount: winAmt,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});

        // Real-Time Live Bet Sync for Admin Live Monitor
        setDoc(doc(db, 'crash_live_bets', `CRB_${roundIdRef.current}_${userRef.current.id}_1`), {
          status: 'cashed_out',
          cashOutMultiplier: mult,
          wonAmount: winAmt,
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      } catch (_) {}
    }

    // Record transaction
    const currentRoundId = roundIdRef.current;
    const tx: WalletTransaction = {
      id: `crash-win-1-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId: userRef.current.id || 'anonymous',
      userEmail: userRef.current.email,
      type: 'crash_win',
      amount: winAmt,
      description: `Won ₹${winAmt.toLocaleString('en-IN')} (Cashed out @ ${mult.toFixed(2)}x) on Aviator #${currentRoundId} [Panel 1 Bet: ₹${amount}]`,
      roundId: currentRoundId,
      gameType: 'aviator',
      winningOutcome: `Cashed Out at ${mult.toFixed(2)}x Multiplier`,
      betsBreakdown: [
        {
          spot: '✈️ Panel 1 Aviator Bet',
          type: 'flight',
          detail: 'panel_1',
          amount: amount,
          isWin: true,
          multiplier: `${mult.toFixed(2)}x`,
          payout: winAmt,
          outcomeProof: `Successfully cashed out at ${mult.toFixed(2)}x (Won ₹${winAmt.toLocaleString('en-IN')})`
        }
      ],
      status: 'completed',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      createdAt: new Date().toISOString()
    };
    onAddTransactionRef.current(tx);

    // Live broadcast chat message if high win
    if (mult >= 3.0) {
      setChatMessages((prev) => [
        {
          id: `win-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: userRef.current.id || 'user',
          userName: `${(userRef.current.name || 'Player').slice(0, 3)}***`,
          avatarUrl: userAvatarRef.current,
          text: `Cashed out at ${mult.toFixed(2)}x! Won ₹${winAmt.toLocaleString()} INR! 🚀`,
          timestamp: Date.now(),
          isWinHighlight: true,
          winMultiplier: mult,
          winAmount: winAmt
        },
        ...prev
      ]);
    }
  }, []);

  // Cashout Helper function for Panel 2
  const handleCashout2 = useCallback((mult: number) => {
    if (!bet2PlacedRef.current || bet2CashedOutRef.current || gamePhaseRef.current !== 'flying') return;
    setBet2CashedOut(true);
    bet2CashedOutRef.current = true;
    const amount = bet2AmountRef.current;
    const winAmt = Math.floor(amount * mult * 100) / 100;
    setBet2WonAmount(winAmt);
    setBet2CashOutMult(mult);

    if (mult >= 10.0) {
      soundFx.playCashoutBigWin();
      triggerConfetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    } else {
      soundFx.playCashoutWin();
    }

    const currentBal = userRef.current.balance || 0;
    const newBalance = currentBal + winAmt;
    onUpdateBalanceRef.current(newBalance);
    userRef.current.balance = newBalance;

    onBigWinRef.current?.({
      id: `crash-win-2-${Date.now()}`,
      category: 'crash',
      title: 'এভিয়েটর সুপারসনিক ক্যাশআউট!',
      subtitle: 'AVIATOR SUPERSONIC WIN',
      amount: winAmt,
      multiplier: `${mult.toFixed(2)}x`,
      crashMultiplier: mult,
      drawOrRoundId: roundIdRef.current
    });

    // Update Firestore crash_bets doc in real-time
    if (bet2CurrentIdRef.current) {
      try {
        setDoc(doc(db, 'crash_bets', bet2CurrentIdRef.current), {
          status: 'won',
          cashOutMultiplier: mult,
          wonAmount: winAmt,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});

        // Real-Time Live Bet Sync for Admin Live Monitor
        setDoc(doc(db, 'crash_live_bets', `CRB_${roundIdRef.current}_${userRef.current.id}_2`), {
          status: 'cashed_out',
          cashOutMultiplier: mult,
          wonAmount: winAmt,
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      } catch (_) {}
    }

    const currentRoundId = roundIdRef.current;
    const tx: WalletTransaction = {
      id: `crash-win-2-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId: userRef.current.id || 'anonymous',
      userEmail: userRef.current.email,
      type: 'crash_win',
      amount: winAmt,
      description: `Won ₹${winAmt.toLocaleString('en-IN')} (Cashed out @ ${mult.toFixed(2)}x) on Aviator #${currentRoundId} [Panel 2 Bet: ₹${amount}]`,
      roundId: currentRoundId,
      gameType: 'aviator',
      winningOutcome: `Cashed Out at ${mult.toFixed(2)}x Multiplier`,
      betsBreakdown: [
        {
          spot: '✈️ Panel 2 Aviator Bet',
          type: 'flight',
          detail: 'panel_2',
          amount: amount,
          isWin: true,
          multiplier: `${mult.toFixed(2)}x`,
          payout: winAmt,
          outcomeProof: `Successfully cashed out at ${mult.toFixed(2)}x (Won ₹${winAmt.toLocaleString('en-IN')})`
        }
      ],
      status: 'completed',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      createdAt: new Date().toISOString()
    };
    onAddTransactionRef.current(tx);

    if (mult >= 3.0) {
      setChatMessages((prev) => [
        {
          id: `win-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: userRef.current.id || 'user',
          userName: `${(userRef.current.name || 'Player').slice(0, 3)}***`,
          avatarUrl: userAvatarRef.current,
          text: `Cashed out at ${mult.toFixed(2)}x! Won ₹${winAmt.toLocaleString()} INR! 🚀`,
          timestamp: Date.now(),
          isWinHighlight: true,
          winMultiplier: mult,
          winAmount: winAmt
        },
        ...prev
      ]);
    }
  }, []);

  // Place Bet 1 Handler
  const handlePlaceBet1 = () => {
    const minB = config.minBet || 10;
    const maxB = config.maxBet || 50000;
    const currentBalance = typeof userRef.current?.balance === 'number' ? userRef.current.balance : (Number(userRef.current?.balance) || 0);

    if (bet1Amount < minB) {
      soundFx.playLossSound();
      setBetMessage1(`ন্যূনতম বেট ₹${minB}`);
      setTimeout(() => setBetMessage1(''), 3500);
      return;
    }
    if (bet1Amount > maxB) {
      soundFx.playLossSound();
      setBetMessage1(`সর্বোচ্চ বেট ₹${maxB}`);
      setTimeout(() => setBetMessage1(''), 3500);
      return;
    }
    if (currentBalance < bet1Amount) {
      soundFx.playLossSound();
      setBetMessage1(`অপর্যাপ্ত ব্যালেন্স! আপনার ব্যালেন্স ₹${currentBalance.toLocaleString()}`);
      setTimeout(() => setBetMessage1(''), 4000);
      return;
    }

    const currentPhase = gamePhaseRef.current;
    if (currentPhase === 'waiting') {
      soundFx.playChipPlace();
      const newBal = Math.max(0, currentBalance - bet1Amount);
      onUpdateBalanceRef.current(newBal);
      userRef.current.balance = newBal;
      
      setBet1Placed(true);
      bet1PlacedRef.current = true;
      setBet1CashedOut(false);
      bet1CashedOutRef.current = false;
      setBet1WonAmount(0);
      setBet1CashOutMult(0);
      setBet1Queued(false);
      bet1QueuedRef.current = false;
      setBetMessage1('');

      // Realtime Firebase Firestore persistence
      const curRoundId = roundIdRef.current;
      const betId = `bet_${userRef.current.id || 'guest'}_${curRoundId}_1_${Date.now()}`;
      bet1CurrentIdRef.current = betId;

      if (userRef.current.id) {
        try {
          const betDocRef = doc(db, 'crash_bets', betId);
          setDoc(betDocRef, {
            id: betId,
            userId: userRef.current.id,
            userEmail: (userRef.current.email || '').toLowerCase().trim(),
            userName: userRef.current.name || 'Pilot',
            roundId: curRoundId,
            panel: 1,
            betAmount: bet1Amount,
            status: 'placed',
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            createdAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});

          // Real-time live bets sync for admin live monitor
          setDoc(doc(db, 'crash_live_bets', `CRB_${curRoundId}_${userRef.current.id}_1`), {
            id: `CRB_${curRoundId}_${userRef.current.id}_1`,
            roundId: curRoundId,
            userId: userRef.current.id,
            userName: userRef.current.name || 'Pilot',
            userPhone: userRef.current.phone || '',
            userEmail: userRef.current.email || '',
            panel: 1,
            amount: bet1Amount,
            autoCashOutTarget: isAutoCash1Ref.current ? autoCash1TargetRef.current : null,
            status: 'active',
            timestamp: Date.now(),
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }, { merge: true }).catch(() => {});

          trackUserPresence(userRef.current, 'Spribe Aviator Crash', 'betting').catch(() => {});
          logLiveActivity({
            userId: userRef.current.id,
            userName: userRef.current.name || 'Pilot',
            userEmail: userRef.current.email,
            userPhone: userRef.current.phone,
            type: 'bet',
            gameName: 'Spribe Aviator Crash',
            betAmount: bet1Amount,
            details: `Bet ₹${bet1Amount} on Aviator Crash #${curRoundId} (Panel 1)`
          }).catch(() => {});
        } catch (_) {}
      }

      const tx: WalletTransaction = {
        id: `crash-bet-1-${Date.now()}`,
        userId: userRef.current.id || 'anonymous',
        userEmail: userRef.current.email,
        type: 'crash_bet',
        amount: -bet1Amount,
        description: `Placed ₹${bet1Amount.toLocaleString('en-IN')} on Aviator #${curRoundId} [Panel 1 Bet]`,
        roundId: curRoundId,
        gameType: 'aviator',
        betsBreakdown: [
          {
            spot: '✈️ Panel 1 Aviator Bet',
            type: 'flight',
            detail: 'panel_1',
            amount: bet1Amount,
            isWin: false,
            multiplier: 'Dynamic Flight',
            payout: 0,
            outcomeProof: 'Flight in progress'
          }
        ],
        status: 'completed',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: new Date().toISOString()
      };
      onAddTransactionRef.current(tx);
    } else {
      // If flying or crashed, toggle queue for next round
      soundFx.playClick();
      const nextQueued = !bet1QueuedRef.current;
      setBet1Queued(nextQueued);
      bet1QueuedRef.current = nextQueued;
      if (nextQueued) {
        setBetMessage1(`পরবর্তী রাউন্ডের জন্য বেট বুক করা হয়েছে (₹${bet1Amount})`);
        setTimeout(() => setBetMessage1(''), 3500);
      } else {
        setBetMessage1('');
      }
    }
  };

  // Place Bet 2 Handler
  const handlePlaceBet2 = () => {
    const minB = config.minBet || 10;
    const maxB = config.maxBet || 50000;
    const currentBalance = typeof userRef.current?.balance === 'number' ? userRef.current.balance : (Number(userRef.current?.balance) || 0);

    if (bet2Amount < minB) {
      soundFx.playLossSound();
      setBetMessage2(`ন্যূনতম বেট ₹${minB}`);
      setTimeout(() => setBetMessage2(''), 3500);
      return;
    }
    if (bet2Amount > maxB) {
      soundFx.playLossSound();
      setBetMessage2(`সর্বোচ্চ বেট ₹${maxB}`);
      setTimeout(() => setBetMessage2(''), 3500);
      return;
    }
    if (currentBalance < bet2Amount) {
      soundFx.playLossSound();
      setBetMessage2(`অপর্যাপ্ত ব্যালেন্স! আপনার ব্যালেন্স ₹${currentBalance.toLocaleString()}`);
      setTimeout(() => setBetMessage2(''), 4000);
      return;
    }

    const currentPhase = gamePhaseRef.current;
    if (currentPhase === 'waiting') {
      soundFx.playChipPlace();
      const newBal = Math.max(0, currentBalance - bet2Amount);
      onUpdateBalanceRef.current(newBal);
      userRef.current.balance = newBal;
      
      setBet2Placed(true);
      bet2PlacedRef.current = true;
      setBet2CashedOut(false);
      bet2CashedOutRef.current = false;
      setBet2WonAmount(0);
      setBet2CashOutMult(0);
      setBet2Queued(false);
      bet2QueuedRef.current = false;
      setBetMessage2('');

      // Realtime Firebase Firestore persistence
      const curRoundId = roundIdRef.current;
      const betId = `bet_${userRef.current.id || 'guest'}_${curRoundId}_2_${Date.now()}`;
      bet2CurrentIdRef.current = betId;

      if (userRef.current.id) {
        try {
          const betDocRef = doc(db, 'crash_bets', betId);
          setDoc(betDocRef, {
            id: betId,
            userId: userRef.current.id,
            userEmail: (userRef.current.email || '').toLowerCase().trim(),
            userName: userRef.current.name || 'Pilot',
            roundId: curRoundId,
            panel: 2,
            betAmount: bet2Amount,
            status: 'placed',
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            createdAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});

          // Real-time live bets sync for admin live monitor
          setDoc(doc(db, 'crash_live_bets', `CRB_${curRoundId}_${userRef.current.id}_2`), {
            id: `CRB_${curRoundId}_${userRef.current.id}_2`,
            roundId: curRoundId,
            userId: userRef.current.id,
            userName: userRef.current.name || 'Pilot',
            userPhone: userRef.current.phone || '',
            userEmail: userRef.current.email || '',
            panel: 2,
            amount: bet2Amount,
            autoCashOutTarget: isAutoCash2Ref.current ? autoCash2TargetRef.current : null,
            status: 'active',
            timestamp: Date.now(),
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }, { merge: true }).catch(() => {});

          trackUserPresence(userRef.current, 'Spribe Aviator Crash', 'betting').catch(() => {});
          logLiveActivity({
            userId: userRef.current.id,
            userName: userRef.current.name || 'Pilot',
            userEmail: userRef.current.email,
            userPhone: userRef.current.phone,
            type: 'bet',
            gameName: 'Spribe Aviator Crash',
            betAmount: bet2Amount,
            details: `Bet ₹${bet2Amount} on Aviator Crash #${curRoundId} (Panel 2)`
          }).catch(() => {});
        } catch (_) {}
      }

      const tx: WalletTransaction = {
        id: `crash-bet-2-${Date.now()}`,
        userId: userRef.current.id || 'anonymous',
        userEmail: userRef.current.email,
        type: 'crash_bet',
        amount: -bet2Amount,
        description: `Placed ₹${bet2Amount.toLocaleString('en-IN')} on Aviator #${curRoundId} [Panel 2 Bet]`,
        roundId: curRoundId,
        gameType: 'aviator',
        betsBreakdown: [
          {
            spot: '✈️ Panel 2 Aviator Bet',
            type: 'flight',
            detail: 'panel_2',
            amount: bet2Amount,
            isWin: false,
            multiplier: 'Dynamic Flight',
            payout: 0,
            outcomeProof: 'Flight in progress'
          }
        ],
        status: 'completed',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: new Date().toISOString()
      };
      onAddTransactionRef.current(tx);
    } else {
      soundFx.playClick();
      const nextQueued = !bet2QueuedRef.current;
      setBet2Queued(nextQueued);
      bet2QueuedRef.current = nextQueued;
      if (nextQueued) {
        setBetMessage2(`পরবর্তী রাউন্ডের জন্য বেট বুক করা হয়েছে (₹${bet2Amount})`);
        setTimeout(() => setBetMessage2(''), 3500);
      } else {
        setBetMessage2('');
      }
    }
  };

  // Cancel Bet 1 (Refunds balance if placed during waiting phase)
  const handleCancelBet1 = () => {
    soundFx.playClick();
    const currentPhase = gamePhaseRef.current;
    if (currentPhase === 'waiting' && bet1PlacedRef.current) {
      const currentBal = typeof userRef.current?.balance === 'number' ? userRef.current.balance : (Number(userRef.current?.balance) || 0);
      const newBal = currentBal + bet1AmountRef.current;
      onUpdateBalanceRef.current(newBal);
      userRef.current.balance = newBal;
      
      setBet1Placed(false);
      bet1PlacedRef.current = false;
      setBetMessage1('');
      
      // Update or delete bet in Firestore
      if (bet1CurrentIdRef.current) {
        try {
          setDoc(doc(db, 'crash_bets', bet1CurrentIdRef.current), {
            status: 'cancelled',
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch (_) {}
      }
      if (userRef.current.id) {
        deleteDoc(doc(db, 'crash_live_bets', `CRB_${roundIdRef.current}_${userRef.current.id}_1`)).catch(() => {});
      }
    } else {
      setBet1Queued(false);
      bet1QueuedRef.current = false;
      setBetMessage1('');
    }
  };

  // Cancel Bet 2 (Refunds balance if placed during waiting phase)
  const handleCancelBet2 = () => {
    soundFx.playClick();
    const currentPhase = gamePhaseRef.current;
    if (currentPhase === 'waiting' && bet2PlacedRef.current) {
      const currentBal = typeof userRef.current?.balance === 'number' ? userRef.current.balance : (Number(userRef.current?.balance) || 0);
      const newBal = currentBal + bet2AmountRef.current;
      onUpdateBalanceRef.current(newBal);
      userRef.current.balance = newBal;
      
      setBet2Placed(false);
      bet2PlacedRef.current = false;
      setBetMessage2('');
      
      // Update or delete bet in Firestore
      if (bet2CurrentIdRef.current) {
        try {
          setDoc(doc(db, 'crash_bets', bet2CurrentIdRef.current), {
            status: 'cancelled',
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch (_) {}
      }
      if (userRef.current.id) {
        deleteDoc(doc(db, 'crash_live_bets', `CRB_${roundIdRef.current}_${userRef.current.id}_2`)).catch(() => {});
      }
    } else {
      setBet2Queued(false);
      bet2QueuedRef.current = false;
      setBetMessage2('');
    }
  };

  // Synchronized 24/7 Global Crash Game Engine (Synced across all players worldwide with 0 latency)
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      const syncState = getUniversalCrashTimeState(Date.now(), configRef.current);
      const { roundIndex, roundDetails, phase, currentMultiplier: liveMult, waitingCountdown: countdown } = syncState;
      const curRoundId = roundDetails.roundId;

      // 1. New round transition
      if (activeGlobalRoundRef.current !== roundIndex) {
        activeGlobalRoundRef.current = roundIndex;
        const curNum = roundDetails.roundNumber;
        roundNumberRef.current = curNum;
        roundIdRef.current = curRoundId;
        crashPointRef.current = roundDetails.crashMultiplier;

        setRoundNumber(curNum);
        setRoundId(curRoundId);
        setCrashPoint(roundDetails.crashMultiplier);
        setCommunityBets(roundDetails.communityBots);

        // Reset Panel 1 state and refs
        setBet1Placed(false);
        bet1PlacedRef.current = false;
        setBet1CashedOut(false);
        bet1CashedOutRef.current = false;
        setBet1WonAmount(0);
        setBet1CashOutMult(0);
        bet1CurrentIdRef.current = '';

        // Reset Panel 2 state and refs
        setBet2Placed(false);
        bet2PlacedRef.current = false;
        setBet2CashedOut(false);
        bet2CashedOutRef.current = false;
        setBet2WonAmount(0);
        setBet2CashOutMult(0);
        bet2CurrentIdRef.current = '';

        // Auto-place queued bets for Panel 1
        if (bet1QueuedRef.current || isAutoBet1Ref.current) {
          const amt = bet1AmountRef.current;
          const currentBal = typeof userRef.current?.balance === 'number' ? userRef.current.balance : (Number(userRef.current?.balance) || 0);
          if (currentBal >= amt) {
            const newBal = Math.max(0, currentBal - amt);
            onUpdateBalanceRef.current(newBal);
            userRef.current.balance = newBal;

            setBet1Placed(true);
            bet1PlacedRef.current = true;
            setBet1Queued(false);
            bet1QueuedRef.current = false;
            setBetMessage1('');

            const betId = `bet_${userRef.current.id || 'guest'}_${curRoundId}_1_${Date.now()}`;
            bet1CurrentIdRef.current = betId;
            if (userRef.current.id) {
              setDoc(doc(db, 'crash_bets', betId), {
                id: betId,
                userId: userRef.current.id,
                userEmail: (userRef.current.email || '').toLowerCase().trim(),
                userName: userRef.current.name || 'Pilot',
                roundId: curRoundId,
                panel: 1,
                betAmount: amt,
                status: 'placed',
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                createdAt: new Date().toISOString()
              }, { merge: true }).catch(() => {});
            }

            const tx: WalletTransaction = {
              id: `crash-bet-1-${Date.now()}`,
              userId: userRef.current.id || 'anonymous',
              userEmail: userRef.current.email,
              type: 'crash_bet',
              amount: amt,
              description: `Aviator Bet (₹${amt}) on Round ${curRoundId}`,
              status: 'completed',
              date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              createdAt: new Date().toISOString()
            };
            onAddTransactionRef.current(tx);
          } else {
            setBet1Queued(false);
            bet1QueuedRef.current = false;
          }
        }

        // Auto-place queued bets for Panel 2
        if (bet2QueuedRef.current || isAutoBet2Ref.current) {
          const amt = bet2AmountRef.current;
          const currentBal = typeof userRef.current?.balance === 'number' ? userRef.current.balance : (Number(userRef.current?.balance) || 0);
          if (currentBal >= amt) {
            const newBal = Math.max(0, currentBal - amt);
            onUpdateBalanceRef.current(newBal);
            userRef.current.balance = newBal;

            setBet2Placed(true);
            bet2PlacedRef.current = true;
            setBet2Queued(false);
            bet2QueuedRef.current = false;
            setBetMessage2('');

            const betId = `bet_${userRef.current.id || 'guest'}_${curRoundId}_2_${Date.now()}`;
            bet2CurrentIdRef.current = betId;
            if (userRef.current.id) {
              setDoc(doc(db, 'crash_bets', betId), {
                id: betId,
                userId: userRef.current.id,
                userEmail: (userRef.current.email || '').toLowerCase().trim(),
                userName: userRef.current.name || 'Pilot',
                roundId: curRoundId,
                panel: 2,
                betAmount: amt,
                status: 'placed',
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                createdAt: new Date().toISOString()
              }, { merge: true }).catch(() => {});
            }

            const tx: WalletTransaction = {
              id: `crash-bet-2-${Date.now()}`,
              userId: userRef.current.id || 'anonymous',
              userEmail: userRef.current.email,
              type: 'crash_bet',
              amount: amt,
              description: `Aviator Bet (₹${amt}) on Round ${curRoundId}`,
              status: 'completed',
              date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              createdAt: new Date().toISOString()
            };
            onAddTransactionRef.current(tx);
          } else {
            setBet2Queued(false);
            bet2QueuedRef.current = false;
          }
        }
      }

      // 2. Synchronized Phase Updates
      gamePhaseRef.current = phase;
      setGamePhase(phase);
      setWaitingCountdown(countdown);
      setCurrentMultiplier(liveMult);
      currentMultRef.current = liveMult;
      if (crashPointRef.current !== roundDetails.crashMultiplier) {
        crashPointRef.current = roundDetails.crashMultiplier;
        setCrashPoint(roundDetails.crashMultiplier);
      }

      if (phase === 'flying') {
        if (!soundTriggersRef.current.has('takeoff_' + roundIndex)) {
          soundTriggersRef.current.add('takeoff_' + roundIndex);
          soundFx.playPlaneTakeoff();
        }

        // Auto Cashout check Panel 1
        if (bet1PlacedRef.current && !bet1CashedOutRef.current && isAutoCash1Ref.current) {
          if (liveMult >= autoCash1TargetRef.current) {
            handleCashout1(autoCash1TargetRef.current);
          }
        }
        // Auto Cashout check Panel 2
        if (bet2PlacedRef.current && !bet2CashedOutRef.current && isAutoCash2Ref.current) {
          if (liveMult >= autoCash2TargetRef.current) {
            handleCashout2(autoCash2TargetRef.current);
          }
        }

        // Live update community bots only if any bot status actually changes
        setCommunityBets((prev) => {
          let hasChanges = false;
          const updated = prev.map((b) => {
            if (b.status === 'betting' && b.autoCashOutAt && liveMult >= b.autoCashOutAt) {
              hasChanges = true;
              return {
                ...b,
                status: 'cashed_out' as const,
                cashOutMultiplier: b.autoCashOutAt,
                winAmount: Math.floor(b.betAmount * b.autoCashOutAt)
              };
            }
            return b;
          });
          return hasChanges ? updated : prev;
        });
      } else if (phase === 'crashed') {
        if (settledRoundRef.current !== roundIndex) {
          settledRoundRef.current = roundIndex;
          soundFx.playPlaneCrash();

          // Lost bet handling
          if (bet1PlacedRef.current && !bet1CashedOutRef.current && bet1CurrentIdRef.current) {
            setDoc(doc(db, 'crash_bets', bet1CurrentIdRef.current), {
              status: 'lost',
              cashOutMultiplier: 0,
              wonAmount: 0,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          }
          if (bet2PlacedRef.current && !bet2CashedOutRef.current && bet2CurrentIdRef.current) {
            setDoc(doc(db, 'crash_bets', bet2CurrentIdRef.current), {
              status: 'lost',
              cashOutMultiplier: 0,
              wonAmount: 0,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          }

          // Update live bets status to crashed
          if (userRef.current?.id) {
            if (bet1PlacedRef.current && !bet1CashedOutRef.current) {
              setDoc(doc(db, 'crash_live_bets', `CRB_${curRoundId}_${userRef.current.id}_1`), {
                status: 'crashed',
                wonAmount: 0,
                timestamp: Date.now()
              }, { merge: true }).catch(() => {});
            }
            if (bet2PlacedRef.current && !bet2CashedOutRef.current) {
              setDoc(doc(db, 'crash_live_bets', `CRB_${curRoundId}_${userRef.current.id}_2`), {
                status: 'crashed',
                wonAmount: 0,
                timestamp: Date.now()
              }, { merge: true }).catch(() => {});
            }
          }

          setRoundHistory((prev) => [roundDetails.crashMultiplier, ...prev.slice(0, 40)]);
        }
      }
    }, 40);

    return () => clearInterval(cycleInterval);
  }, [handleCashout1, handleCashout2]);

  // HTML5 Canvas Render Loop - Continuous 60fps render loop with realistic smoke particles & large aircraft
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Volumetric smoke puffs particle collection
    interface SmokeParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      maxRadius: number;
      alpha: number;
      decay: number;
      growth: number;
      isHotCore: boolean;
      rot: number;
      rotSpeed: number;
    }
    const smokeParticles: SmokeParticle[] = [];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const phase = gamePhaseRef.current;
      const mult = currentMultRef.current;
      const now = Date.now();

      ctx.clearRect(0, 0, width, height);

      // 1. Dark Aviator Radar Grid Canvas
      ctx.fillStyle = '#0f131c';
      ctx.fillRect(0, 0, width, height);

      // Subtle Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // X & Y Coordinate Markers
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '10px monospace';
      ctx.fillText('1.00x', 8, height - 10);
      ctx.fillText('2.00x', 8, height / 2);
      ctx.fillText('10.00x', 8, 20);

      if (phase === 'waiting') {
        // Clear old flight smoke particles on waiting
        smokeParticles.length = 0;

        // Propeller Plane resting at runway origin (larger & detailed)
        const planeX = 85;
        const planeY = height - 50;
        drawAviatorPlane(ctx, planeX, planeY, 0, now);

      } else if (phase === 'flying' || phase === 'crashed') {
        // Curve normalization: map multiplier 1.0 to 15.0+ to canvas coordinates
        const progress = Math.min(1.0, (mult - 1.0) / 7.0);
        
        const startX = 25;
        const startY = height - 30;
        const targetX = Math.min(width - 85, 45 + progress * (width - 130));
        const targetY = Math.max(55, (height - 45) - Math.pow(progress, 0.75) * (height - 115));

        // Draw Neon Red Curve Gradient Trail Under Plane
        const gradient = ctx.createLinearGradient(0, targetY, 0, height);
        gradient.addColorStop(0, 'rgba(225, 29, 72, 0.45)');
        gradient.addColorStop(0.5, 'rgba(225, 29, 72, 0.15)');
        gradient.addColorStop(1, 'rgba(225, 29, 72, 0.0)');

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (targetX - startX) * 0.4, startY, targetX, targetY);
        ctx.lineTo(targetX, height - 20);
        ctx.lineTo(startX, height - 20);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Neon Trajectory Line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (targetX - startX) * 0.4, startY, targetX, targetY);
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#e11d48';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        if (phase === 'flying') {
          // Ultra-smooth multi-harmonic flight physics (dynamic up-down floating & aerodynamic pitching)
          const flightTime = now * 0.0036;
          const bobY = Math.sin(flightTime) * 12 + Math.sin(flightTime * 2.1) * 4.5 + Math.cos(flightTime * 0.7) * 2.2;
          const pitchOsc = Math.cos(flightTime) * 0.065 + Math.sin(flightTime * 2.1) * 0.035;

          const baseAngle = -0.32 + Math.min(0.06, progress * 0.06);
          const angle = baseAngle + pitchOsc;

          const actualPlaneX = targetX;
          const actualPlaneY = targetY + bobY;

          // 1. Spawn New Dense Smoke Particles from Plane Exhaust (Rear tail position scaled for 8K plane)
          const scaleFactor = 1.9;
          const tailDist = 36 * scaleFactor;
          const exhaustX = actualPlaneX - Math.cos(angle) * tailDist;
          const exhaustY = actualPlaneY - Math.sin(angle) * tailDist;

          // Emit 4 particles per frame for thick, billowing smoke cloud stream
          for (let p = 0; p < 4; p++) {
            smokeParticles.push({
              x: exhaustX + (Math.random() - 0.5) * 6,
              y: exhaustY + (Math.random() - 0.5) * 6,
              vx: -Math.cos(angle) * (1.8 + Math.random() * 2.2) + (Math.random() - 0.5) * 0.6,
              vy: -Math.sin(angle) * (0.9 + Math.random() * 1.4) + (Math.random() - 0.5) * 0.6,
              radius: 8 + Math.random() * 6,
              maxRadius: 36 + Math.random() * 18,
              alpha: 0.88,
              decay: 0.010 + Math.random() * 0.008,
              growth: 0.45 + Math.random() * 0.35,
              isHotCore: Math.random() < 0.4,
              rot: Math.random() * Math.PI * 2,
              rotSpeed: (Math.random() - 0.5) * 0.05
            });
          }

          // 2. Update and Render All Billowing Smoke Particles
          for (let i = smokeParticles.length - 1; i >= 0; i--) {
            const sp = smokeParticles[i];
            sp.x += sp.vx;
            sp.y += sp.vy;
            sp.radius = Math.min(sp.maxRadius, sp.radius + sp.growth);
            sp.alpha -= sp.decay;
            sp.rot += sp.rotSpeed;

            if (sp.alpha <= 0) {
              smokeParticles.splice(i, 1);
              continue;
            }

            // Draw Volumetric 8K Smoke Cloud Puff
            const smokeGrad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.radius);
            if (sp.isHotCore && sp.alpha > 0.35) {
              // Engine afterburner core glow
              smokeGrad.addColorStop(0, `rgba(255, 235, 130, ${sp.alpha})`);
              smokeGrad.addColorStop(0.25, `rgba(251, 146, 60, ${sp.alpha * 0.9})`);
              smokeGrad.addColorStop(0.65, `rgba(225, 29, 72, ${sp.alpha * 0.45})`);
              smokeGrad.addColorStop(1, 'rgba(225, 29, 72, 0)');
            } else {
              // Billowing realistic white/rose smoke clouds
              smokeGrad.addColorStop(0, `rgba(255, 255, 255, ${sp.alpha * 0.95})`);
              smokeGrad.addColorStop(0.35, `rgba(254, 205, 211, ${sp.alpha * 0.7})`);
              smokeGrad.addColorStop(0.75, `rgba(244, 63, 94, ${sp.alpha * 0.3})`);
              smokeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            }

            ctx.fillStyle = smokeGrad;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
            ctx.fill();
          }

          // 3. Draw 8K Ultra-Realistic Scaled Monoplane Aircraft
          drawAviatorPlane(ctx, actualPlaneX, actualPlaneY, angle, now);
        } else {
          // Crashed: Draw Flew Away Jet Smoke Blast Explosion
          ctx.save();
          ctx.translate(targetX + 35, targetY - 20);
          
          const crashTime = Date.now();
          const blastRadius = 32 + Math.sin(crashTime / 100) * 8;
          const blastGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, blastRadius);
          blastGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          blastGrad.addColorStop(0.3, 'rgba(251, 146, 60, 0.85)');
          blastGrad.addColorStop(0.7, 'rgba(225, 29, 72, 0.65)');
          blastGrad.addColorStop(1, 'rgba(225, 29, 72, 0)');
          
          ctx.fillStyle = blastGrad;
          ctx.beginPath();
          ctx.arc(0, 0, blastRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Helper to draw the 8K Ultra-Realistic Aviator Aircraft with Rotating Side-Wing & Front Propellers
  const drawAviatorPlane = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, timestamp: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Scale plane up to 1.9x for high-definition 8K large aircraft presentation
    ctx.scale(1.9, 1.9);

    // ==========================================
    // 1. DUAL AFTERBURNER & JET THRUST PLUMES
    // ==========================================
    const flameFlicker = (timestamp % 120) / 120;
    const flameLength = 28 + flameFlicker * 16;
    
    // Outer Plasma Envelope
    const flameGrad = ctx.createLinearGradient(0, 0, -flameLength, 0);
    flameGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    flameGrad.addColorStop(0.2, 'rgba(254, 240, 138, 0.95)');
    flameGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.85)');
    flameGrad.addColorStop(0.8, 'rgba(225, 29, 72, 0.5)');
    flameGrad.addColorStop(1, 'rgba(225, 29, 72, 0)');
    
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-34, -6);
    ctx.lineTo(-34 - flameLength, 1);
    ctx.lineTo(-34, 8);
    ctx.closePath();
    ctx.fill();

    // Supersonic Shock Diamond Inner Core
    const shockCoreLength = flameLength * 0.45;
    const shockGrad = ctx.createLinearGradient(0, 0, -shockCoreLength, 0);
    shockGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    shockGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.8)');
    shockGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = shockGrad;
    ctx.beginPath();
    ctx.moveTo(-34, -2.5);
    ctx.lineTo(-34 - shockCoreLength, 1);
    ctx.lineTo(-34, 4.5);
    ctx.closePath();
    ctx.fill();

    // ==========================================
    // 2. LOWER PORT WING + ROTATING WING PROPELLER
    // ==========================================
    const lowerWingGrad = ctx.createLinearGradient(0, 2, 0, 26);
    lowerWingGrad.addColorStop(0, '#881337');
    lowerWingGrad.addColorStop(0.5, '#991b1b');
    lowerWingGrad.addColorStop(1, '#5c0a1f');
    ctx.fillStyle = lowerWingGrad;
    ctx.beginPath();
    ctx.moveTo(-4, 3);
    ctx.lineTo(6, 24);
    ctx.lineTo(14, 24);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();

    // Port Wingtip Red Nav Light
    ctx.fillStyle = (timestamp % 500 < 250) ? '#ef4444' : '#991b1b';
    ctx.beginPath();
    ctx.arc(10, 24, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Port Wing Engine Nacelle / Propeller Pod
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(8, 16, 5, 2.5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Port Wing Spinning Propeller Blades (Side Wing Rotor)
    const sideBladeOffset1 = ((timestamp % 55) / 55) * Math.PI * 2;
    // Wing rotor blur disc
    ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
    ctx.beginPath();
    ctx.ellipse(13, 16, 2.5, 9, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Rotating Blade Tracers
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(13 + Math.cos(sideBladeOffset1) * 1.2, 16 - Math.sin(sideBladeOffset1) * 8);
    ctx.lineTo(13 - Math.cos(sideBladeOffset1) * 1.2, 16 + Math.sin(sideBladeOffset1) * 8);
    ctx.stroke();
    // Blade Safety Tips
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(13 + Math.cos(sideBladeOffset1) * 1.2, 16 - Math.sin(sideBladeOffset1) * 8, 1.4, 0, Math.PI * 2);
    ctx.arc(13 - Math.cos(sideBladeOffset1) * 1.2, 16 + Math.sin(sideBladeOffset1) * 8, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // ==========================================
    // 3. MAIN AERODYNAMIC FUSELAGE (8K Metallic Red)
    // ==========================================
    const bodyGrad = ctx.createLinearGradient(0, -15, 0, 15);
    bodyGrad.addColorStop(0, '#ff4d6d');
    bodyGrad.addColorStop(0.18, '#f43f5e');
    bodyGrad.addColorStop(0.45, '#e11d48');
    bodyGrad.addColorStop(0.75, '#be123c');
    bodyGrad.addColorStop(1, '#5c0a1f');
    
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 1, 37, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fuselage Top Metallic Gloss Edge Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(1, -4.5, 30, 4.5, 0.04, Math.PI * 0.88, Math.PI * 1.92);
    ctx.stroke();

    // Fuselage White Racing Livery Decal Stripe
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.lineTo(24, 0);
    ctx.stroke();

    // 8K Gold Accent Pinstripe
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-16, 4.5);
    ctx.lineTo(22, 2.5);
    ctx.stroke();

    // Aerodynamic Panel Rivets
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    [-12, -4, 4, 12, 18].forEach((rx) => {
      ctx.beginPath();
      ctx.arc(rx, 2, 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // ==========================================
    // 4. UPPER STARBOARD WING + ROTATING WING PROPELLER
    // ==========================================
    const upperWingGrad = ctx.createLinearGradient(0, -32, 0, 5);
    upperWingGrad.addColorStop(0, '#991b1b');
    upperWingGrad.addColorStop(0.4, '#dc2626');
    upperWingGrad.addColorStop(0.8, '#b91c1c');
    upperWingGrad.addColorStop(1, '#881337');
    
    ctx.fillStyle = upperWingGrad;
    ctx.beginPath();
    ctx.moveTo(-8, 1);
    ctx.lineTo(8, -30);
    ctx.lineTo(18, -30);
    ctx.lineTo(6, 1);
    ctx.closePath();
    ctx.fill();

    // Wing Leading Edge Chrome Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(8, -29);
    ctx.stroke();

    // Starboard Wingtip Green Nav Beacon
    ctx.fillStyle = (timestamp % 400 < 200) ? '#22c55e' : '#15803d';
    ctx.beginPath();
    ctx.arc(13, -30, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Starboard Wing Engine Nacelle / Propeller Pod
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(11, -19, 5.5, 3, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Starboard Wing Spinning Propeller Blades (Side Wing Rotor)
    const sideBladeOffset2 = ((timestamp % 52) / 52) * Math.PI * 2;
    // Wing rotor blur disc
    ctx.fillStyle = 'rgba(254, 240, 138, 0.32)';
    ctx.beginPath();
    ctx.ellipse(16, -19, 3, 11, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Rotating Blade Tracers
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(16 + Math.cos(sideBladeOffset2) * 1.5, -19 - Math.sin(sideBladeOffset2) * 10);
    ctx.lineTo(16 - Math.cos(sideBladeOffset2) * 1.5, -19 + Math.sin(sideBladeOffset2) * 10);
    ctx.stroke();
    // Blade Safety Tips
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(16 + Math.cos(sideBladeOffset2) * 1.5, -19 - Math.sin(sideBladeOffset2) * 10, 1.6, 0, Math.PI * 2);
    ctx.arc(16 - Math.cos(sideBladeOffset2) * 1.5, -19 + Math.sin(sideBladeOffset2) * 10, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // ==========================================
    // 5. COCKPIT CANOPY & PILOT AVIONICS HUD
    // ==========================================
    const glassGrad = ctx.createLinearGradient(8, -10, 20, -1);
    glassGrad.addColorStop(0, '#7dd3fc');
    glassGrad.addColorStop(0.3, '#38bdf8');
    glassGrad.addColorStop(0.7, '#0284c7');
    glassGrad.addColorStop(1, '#082f49');
    
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.ellipse(11, -3.5, 12, 6, 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Pilot Silhouette with Aviation Helmet & Visor
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(8.5, -4, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Pilot Cyan Glowing HUD Visor
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(10.5, -4.2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Canopy Double Reflection Sheen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(5, -6.5);
    ctx.lineTo(15, -4.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(7, -2);
    ctx.lineTo(17, -1);
    ctx.stroke();

    // ==========================================
    // 6. EMPENNAGE (VERTICAL TAIL FIN & STABILIZERS)
    // ==========================================
    const tailGrad = ctx.createLinearGradient(-30, -22, -18, 1);
    tailGrad.addColorStop(0, '#dc2626');
    tailGrad.addColorStop(0.6, '#991b1b');
    tailGrad.addColorStop(1, '#7f1d1d');
    
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.moveTo(-25, 1);
    ctx.lineTo(-37, -20);
    ctx.lineTo(-29, -20);
    ctx.lineTo(-19, 1);
    ctx.closePath();
    ctx.fill();

    // Tail fin white accent decal
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-34, -15);
    ctx.lineTo(-24, -1);
    ctx.stroke();

    // Tail Fin Top Flashing Red Anti-Collision Strobe
    ctx.fillStyle = (timestamp % 300 < 150) ? '#ff2222' : '#990000';
    ctx.beginPath();
    ctx.arc(-33, -20, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Rear Elevator Stabilizer
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(-26, 3);
    ctx.lineTo(-35, 10);
    ctx.lineTo(-29, 10);
    ctx.lineTo(-22, 3);
    ctx.closePath();
    ctx.fill();

    // ==========================================
    // 7. FRONT NOSE CONE & MAIN 3-BLADE PROPELLER
    // ==========================================
    // Polished Gold Nose Spinner
    const spinnerGrad = ctx.createRadialGradient(36, 1, 1, 37, 1, 6);
    spinnerGrad.addColorStop(0, '#fef08a');
    spinnerGrad.addColorStop(0.4, '#f59e0b');
    spinnerGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = spinnerGrad;
    ctx.beginPath();
    ctx.arc(37, 1, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Front High-Speed Propeller Rotor Animation
    const frontBladeOffset = ((timestamp % 65) / 65) * Math.PI * 2;
    
    // Front Motion-Blur Aerodynamic Disc
    const frontDiscGrad = ctx.createRadialGradient(38, 1, 2, 38, 1, 22);
    frontDiscGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    frontDiscGrad.addColorStop(0.6, 'rgba(250, 204, 21, 0.25)');
    frontDiscGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = frontDiscGrad;
    ctx.beginPath();
    ctx.ellipse(38, 1, 4.5, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3 Rotating Propeller Blades
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.8;
    for (let b = 0; b < 3; b++) {
      const bAngle = frontBladeOffset + (b * (Math.PI * 2) / 3);
      const bx = 38 + Math.cos(bAngle) * 2;
      const by = 1 - Math.sin(bAngle) * 19;
      
      ctx.beginPath();
      ctx.moveTo(38, 1);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Golden safety warning tip
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Chrome Center Hub Cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(38, 1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Helper for color coding round history pills (Blue <2x, Purple 2-10x, Pink >10x)
  const getPillColor = (mult: number) => {
    if (mult >= 10.0) {
      return 'bg-pink-950/80 text-pink-300 border-pink-500/60 shadow-[0_0_10px_rgba(236,72,153,0.4)] font-black';
    }
    if (mult >= 2.0) {
      return 'bg-purple-950/80 text-purple-300 border-purple-500/50 font-bold';
    }
    return 'bg-blue-950/70 text-blue-300 border-blue-500/40 font-semibold';
  };

  const totalCommunityBetsAmount = communityBets.reduce((acc, b) => acc + b.betAmount, 0);
  const totalCommunityWinAmount = communityBets
    .filter((b) => b.status === 'cashed_out')
    .reduce((acc, b) => acc + (b.winAmount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1017] text-white flex flex-col font-sans select-none overflow-hidden animate-fadeIn">
      
      {/* 1. TOP HEADER (Spribe Aviator Branding, Realtime Wallet Balance & Settings) */}
      <header className="h-11 sm:h-13 px-2 sm:px-3 bg-[#111622] border-b border-slate-800 flex items-center justify-between shadow-xl z-30 shrink-0 select-none">
        
        {/* Left: Prominent EXIT button & Compact Aviator Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black flex items-center gap-1 shadow-lg shadow-rose-600/30 text-xs sm:text-sm cursor-pointer transition-all active:scale-95 shrink-0"
            title="Exit Aviator"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>EXIT</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-rose-600 via-red-600 to-amber-500 flex items-center justify-center shadow-md shadow-rose-600/20 text-xs shrink-0">
              ✈️
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-black tracking-wide text-rose-500 italic uppercase">
                Aviator
              </span>
              <span className="text-[9px] text-emerald-400 font-mono hidden sm:inline">
                ● {communityBets.length + 840} Pilots
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Wallet Balance & Compact Tool Icons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Realtime Wallet Balance Pill */}
          <div className="flex items-center bg-slate-900 border border-amber-500/40 rounded-xl px-2 py-0.5 shadow-inner gap-1.5 shrink-0">
            <span className="text-[11px] sm:text-xs font-black font-mono text-amber-400">
              ₹{(user.balance || 0).toLocaleString()}
            </span>
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenDeposit();
              }}
              className="w-5 h-5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black flex items-center justify-center hover:scale-105 transition-transform shadow-sm cursor-pointer"
              title="Deposit Funds"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          {/* Transactions / Betting History Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowTransactionsModal(true);
            }}
            className="p-1.5 sm:px-2 sm:py-1 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-400 hover:text-white transition-all cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
            title="Transactions & Bet History"
          >
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="text-[11px] font-bold font-sans hidden md:inline text-amber-300">হিস্ট্রি</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              const muted = soundFx.toggleMute();
              setIsMuted(muted);
            }}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
              isMuted 
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' 
                : 'bg-slate-900 border-slate-700 hover:border-amber-400 text-amber-400'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Chat Drawer Toggle */}
          <button
            onClick={() => {
              soundFx.playClick();
              setChatOpen(!chatOpen);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-white transition-all cursor-pointer relative shrink-0"
            title="Live Community Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          </button>

          {/* Menu / Settings Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowSettingsModal(true);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Game Menu & Settings"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* 2. RECENT ROUNDS MULTIPLIER HISTORY STRIP */}
      <div className="h-7 sm:h-8 px-2 sm:px-3 bg-[#0a0d14] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-[11px] z-20 shrink-0">
        <span className="text-[9px] text-slate-500 uppercase font-bold shrink-0 mr-0.5 flex items-center gap-1">
          <History className="w-3 h-3 text-slate-400" />
          <span className="hidden xs:inline">ROUNDS:</span>
        </span>
        {roundHistory.map((mult, idx) => (
          <div
            key={idx}
            className={`px-1.5 py-0.5 rounded-full border text-[10px] sm:text-[11px] shrink-0 transition-transform hover:scale-110 cursor-pointer ${getPillColor(mult)}`}
            title={`Round Result: ${mult.toFixed(2)}x`}
          >
            {mult.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* 3. MAIN GAME SCREEN (FIXED RADAR ARENA AT TOP + SCROLLABLE BETTING & COMMUNITY BELOW) */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden px-2 sm:px-3 py-1 sm:py-2 space-y-2 max-w-5xl mx-auto w-full">
        
        {/* FLIGHT RADAR DISPLAY ARENA - ALWAYS VISIBLE */}
        <div className="relative w-full h-44 sm:h-56 md:h-64 lg:h-72 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl bg-[#0f131c] flex items-center justify-center shrink-0">
          {/* Background Canvas */}
          <canvas
            ref={canvasRef}
            width={1000}
            height={440}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* Official Partner Watermark */}
          <div className="absolute top-2 left-3 z-10 flex items-center gap-2 pointer-events-none opacity-40">
            <span className="text-[10px] font-black tracking-widest text-slate-400 font-mono">UFC OFFICIAL PARTNER</span>
          </div>

          {/* Online Players Counter in Arena */}
          <div className="absolute bottom-2 right-3 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">{communityBets.length + 510}</span>
          </div>

          {/* CENTER OVERLAY: MULTIPLIER OR WAITING COUNTDOWN OR FLEW AWAY */}
          <div className="relative z-20 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            {gamePhase === 'waiting' && (
              <div className="space-y-1.5 animate-fadeIn">
                <p className="text-[11px] sm:text-xs font-mono tracking-widest text-amber-400 font-bold uppercase">
                  WAITING FOR NEXT ROUND
                </p>
                <div className="w-40 sm:w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 transition-all duration-100 ease-linear"
                    style={{ width: `${(waitingCountdown / (config.roundCooldownSeconds || 5.0)) * 100}%` }}
                  />
                </div>
                <p className="text-xl sm:text-2xl font-black font-mono text-white">
                  {waitingCountdown.toFixed(1)}s
                </p>
              </div>
            )}

            {gamePhase === 'flying' && (
              <div className="space-y-1 animate-scaleUp">
                <span className="text-5xl sm:text-6xl md:text-7xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_30px_rgba(225,29,72,0.6)]">
                  {currentMultiplier.toFixed(2)}x
                </span>
              </div>
            )}

            {gamePhase === 'crashed' && (
              <div className="space-y-1 animate-shake">
                <p className="text-xs sm:text-sm font-black font-mono tracking-widest text-rose-500 uppercase">
                  FLEW AWAY!
                </p>
                <span className="text-5xl sm:text-6xl md:text-7xl font-black font-mono tracking-tight text-rose-600 drop-shadow-[0_0_30px_rgba(225,29,72,0.8)]">
                  {crashPoint.toFixed(2)}x
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SCROLLABLE SECTION FOR DUAL BET PANELS & COMMUNITY TABS */}
        <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-0.5 no-scrollbar">
          {/* Real-time Betting Limits Sync Banner (0s Latency) */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>বেটিং লিমিট: <strong className="text-white">₹{(config.minBet || 10).toLocaleString('en-IN')} - ₹{(config.maxBet || 500000).toLocaleString('en-IN')}</strong></span>
            </span>
            <span className="text-amber-400 text-[10px] font-bold">
              0s রিয়েল-টাইম সিঙ্ক
            </span>
          </div>

          {/* 4. DUAL BETTING PANELS (SPRIBE AVIATOR EXACT STYLE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          
          {/* ===== BET PANEL 1 ===== */}
          <div className="p-3 bg-[#131824] border border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col justify-between space-y-2.5">
            {/* Tab Switch: Bet / Auto */}
            <div className="flex items-center justify-between">
              <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab1('bet')}
                  className={`px-4 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab1 === 'bet' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bet
                </button>
                <button
                  onClick={() => setActiveTab1('auto')}
                  className={`px-4 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab1 === 'auto' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto
                </button>
              </div>

              {/* Auto Toggles (if Auto tab) */}
              {activeTab1 === 'auto' && (
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <label className="flex items-center gap-1 cursor-pointer bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={isAutoBet1}
                      onChange={(e) => setIsAutoBet1(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span className="text-slate-300 text-[11px]">Auto Bet</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={isAutoCash1}
                      onChange={(e) => setIsAutoCash1(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span className="text-amber-300 font-bold text-[11px]">Auto Cash ({autoCash1Target.toFixed(2)}x)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Auto Cashout Multiplier Settings (Active when Auto Tab is opened) */}
            {activeTab1 === 'auto' && (
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                    Auto Cashout Target (Max 100x):
                  </span>
                  <span className="text-xs font-black font-mono text-amber-400">{autoCash1Target.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAutoCash1Target((p) => Math.max(1.01, Number((p - 0.10).toFixed(2))))}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    -0.1
                  </button>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    max="100.00"
                    value={autoCash1Target}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setAutoCash1Target(Math.min(100.0, Math.max(1.01, parseFloat(val.toFixed(2)))));
                      }
                    }}
                    className="flex-1 text-center bg-slate-950 border border-slate-700 rounded py-0.5 text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => setAutoCash1Target((p) => Math.min(100.0, Number((p + 0.10).toFixed(2))))}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    +0.1
                  </button>
                </div>
                {/* Quick Target Multiplier Chips */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                  {[1.20, 1.50, 2.00, 3.00, 5.00, 10.00, 20.00, 50.00, 100.00].map((t) => (
                    <button
                      key={t}
                      onClick={() => setAutoCash1Target(t)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 transition-all ${
                        autoCash1Target === t 
                          ? 'bg-amber-500 text-slate-950 shadow' 
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.toFixed(t >= 10 ? 0 : 2)}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bet Input Controls & Giant Action Button */}
            <div className="flex items-center gap-2">
              
              {/* Left Column: Number Adjuster & Quick Pills */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1">
                  <button
                    disabled={bet1Placed}
                    onClick={() => {
                      soundFx.playClick();
                      setBet1Amount((p) => Math.max(config.minBet || 10, p - 10));
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    disabled={bet1Placed}
                    type="number"
                    value={bet1Amount}
                    onChange={(e) => setBet1Amount(Math.max(1, Number(e.target.value)))}
                    className="w-full text-center bg-transparent font-mono font-black text-sm text-white focus:outline-none"
                  />
                  <button
                    disabled={bet1Placed}
                    onClick={() => {
                      soundFx.playClick();
                      setBet1Amount((p) => p + 10);
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Quick Preset Pills */}
                <div className="grid grid-cols-4 gap-1">
                  {[10, 50, 100, 500].map((amt) => (
                    <button
                      key={amt}
                      disabled={bet1Placed}
                      onClick={() => {
                        soundFx.playClick();
                        setBet1Amount(amt);
                      }}
                      className={`py-1 rounded-lg font-mono text-[10px] font-bold border transition-all cursor-pointer ${
                        bet1Amount === amt 
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Giant Green BET / Golden CASHOUT Button */}
              <div className="w-1/2 flex flex-col">
                {gamePhase === 'waiting' ? (
                  !bet1Placed ? (
                    <button
                      onClick={handlePlaceBet1}
                      className="w-full h-16 rounded-2xl bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-mono font-black shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-900 font-bold">BET</span>
                      <span className="text-base sm:text-lg">₹{bet1Amount.toFixed(2)} INR</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelBet1}
                      className="w-full h-16 rounded-2xl bg-gradient-to-b from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-mono font-black shadow-lg active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-xs uppercase tracking-wider text-rose-200">CANCEL</span>
                      <span className="text-sm">WAITING...</span>
                    </button>
                  )
                ) : gamePhase === 'flying' ? (
                  bet1Placed && !bet1CashedOut ? (
                    <button
                      onClick={() => handleCashout1(currentMultiplier)}
                      className="w-full h-16 rounded-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-mono font-black shadow-xl shadow-amber-500/30 active:scale-98 transition-all flex flex-col items-center justify-center animate-pulse cursor-pointer"
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-900 font-bold">CASH OUT</span>
                      <span className="text-base sm:text-lg">₹{(bet1Amount * currentMultiplier).toFixed(2)} INR</span>
                    </button>
                  ) : bet1CashedOut ? (
                    <div className="w-full h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-400 font-mono font-black flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase tracking-wider">CASHED OUT @ {bet1CashOutMult.toFixed(2)}x</span>
                      <span className="text-sm">+₹{bet1WonAmount.toFixed(2)}</span>
                    </div>
                  ) : (
                    <button
                      onClick={handlePlaceBet1}
                      className={`w-full h-16 rounded-2xl font-mono font-black active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer ${
                        bet1Queued 
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                          : 'bg-gradient-to-b from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-slate-950 shadow-lg shadow-emerald-600/20'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider">{bet1Queued ? 'CANCEL QUEUE' : 'BET NEXT ROUND'}</span>
                      <span className="text-sm">₹{bet1Amount.toFixed(2)} INR</span>
                    </button>
                  )
                ) : (
                  // Crashed phase: allow pre-betting for upcoming round
                  <button
                    onClick={handlePlaceBet1}
                    className={`w-full h-16 rounded-2xl font-mono font-black active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer ${
                      bet1Queued 
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                        : 'bg-gradient-to-b from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-slate-950 shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider">{bet1Queued ? 'CANCEL QUEUE' : 'BET NEXT ROUND'}</span>
                    <span className="text-sm">₹{bet1Amount.toFixed(2)} INR</span>
                  </button>
                )}
              </div>

            </div>

            {betMessage1 && (
              <div className="text-[11px] font-bold text-center py-1 px-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono animate-fadeIn flex items-center justify-center gap-1.5">
                <span>⚠️ {betMessage1}</span>
              </div>
            )}
          </div>

          {/* ===== BET PANEL 2 ===== */}
          <div className="p-3 bg-[#131824] border border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col justify-between space-y-2.5">
            {/* Tab Switch: Bet / Auto */}
            <div className="flex items-center justify-between">
              <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab2('bet')}
                  className={`px-4 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab2 === 'bet' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bet
                </button>
                <button
                  onClick={() => setActiveTab2('auto')}
                  className={`px-4 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab2 === 'auto' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto
                </button>
              </div>

              {activeTab2 === 'auto' && (
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <label className="flex items-center gap-1 cursor-pointer bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={isAutoBet2}
                      onChange={(e) => setIsAutoBet2(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span className="text-slate-300 text-[11px]">Auto Bet</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={isAutoCash2}
                      onChange={(e) => setIsAutoCash2(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span className="text-amber-300 font-bold text-[11px]">Auto Cash ({autoCash2Target.toFixed(2)}x)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Auto Cashout Multiplier Settings Panel 2 */}
            {activeTab2 === 'auto' && (
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                    Auto Cashout Target (Max 100x):
                  </span>
                  <span className="text-xs font-black font-mono text-amber-400">{autoCash2Target.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAutoCash2Target((p) => Math.max(1.01, Number((p - 0.10).toFixed(2))))}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    -0.1
                  </button>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    max="100.00"
                    value={autoCash2Target}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setAutoCash2Target(Math.min(100.0, Math.max(1.01, parseFloat(val.toFixed(2)))));
                      }
                    }}
                    className="flex-1 text-center bg-slate-950 border border-slate-700 rounded py-0.5 text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => setAutoCash2Target((p) => Math.min(100.0, Number((p + 0.10).toFixed(2))))}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    +0.1
                  </button>
                </div>
                {/* Quick Target Multiplier Chips */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                  {[1.20, 1.50, 2.00, 3.00, 5.00, 10.00, 20.00, 50.00, 100.00].map((t) => (
                    <button
                      key={t}
                      onClick={() => setAutoCash2Target(t)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 transition-all ${
                        autoCash2Target === t 
                          ? 'bg-amber-500 text-slate-950 shadow' 
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.toFixed(t >= 10 ? 0 : 2)}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bet Input Controls & Action Button */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1">
                  <button
                    disabled={bet2Placed}
                    onClick={() => {
                      soundFx.playClick();
                      setBet2Amount((p) => Math.max(config.minBet || 10, p - 10));
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    disabled={bet2Placed}
                    type="number"
                    value={bet2Amount}
                    onChange={(e) => setBet2Amount(Math.max(1, Number(e.target.value)))}
                    className="w-full text-center bg-transparent font-mono font-black text-sm text-white focus:outline-none"
                  />
                  <button
                    disabled={bet2Placed}
                    onClick={() => {
                      soundFx.playClick();
                      setBet2Amount((p) => p + 10);
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[10, 50, 100, 500].map((amt) => (
                    <button
                      key={amt}
                      disabled={bet2Placed}
                      onClick={() => {
                        soundFx.playClick();
                        setBet2Amount(amt);
                      }}
                      className={`py-1 rounded-lg font-mono text-[10px] font-bold border transition-all cursor-pointer ${
                        bet2Amount === amt 
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="w-1/2 flex flex-col">
                {gamePhase === 'waiting' ? (
                  !bet2Placed ? (
                    <button
                      onClick={handlePlaceBet2}
                      className="w-full h-16 rounded-2xl bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-mono font-black shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-900 font-bold">BET</span>
                      <span className="text-base sm:text-lg">₹{bet2Amount.toFixed(2)} INR</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelBet2}
                      className="w-full h-16 rounded-2xl bg-gradient-to-b from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-mono font-black shadow-lg active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-xs uppercase tracking-wider text-rose-200">CANCEL</span>
                      <span className="text-sm">WAITING...</span>
                    </button>
                  )
                ) : gamePhase === 'flying' ? (
                  bet2Placed && !bet2CashedOut ? (
                    <button
                      onClick={() => handleCashout2(currentMultiplier)}
                      className="w-full h-16 rounded-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-mono font-black shadow-xl shadow-amber-500/30 active:scale-98 transition-all flex flex-col items-center justify-center animate-pulse cursor-pointer"
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-900 font-bold">CASH OUT</span>
                      <span className="text-base sm:text-lg">₹{(bet2Amount * currentMultiplier).toFixed(2)} INR</span>
                    </button>
                  ) : bet2CashedOut ? (
                    <div className="w-full h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-400 font-mono font-black flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase tracking-wider">CASHED OUT @ {bet2CashOutMult.toFixed(2)}x</span>
                      <span className="text-sm">+₹{bet2WonAmount.toFixed(2)}</span>
                    </div>
                  ) : (
                    <button
                      onClick={handlePlaceBet2}
                      className={`w-full h-16 rounded-2xl font-mono font-black active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer ${
                        bet2Queued 
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                          : 'bg-gradient-to-b from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-slate-950 shadow-lg shadow-emerald-600/20'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider">{bet2Queued ? 'CANCEL QUEUE' : 'BET NEXT ROUND'}</span>
                      <span className="text-sm">₹{bet2Amount.toFixed(2)} INR</span>
                    </button>
                  )
                ) : (
                  // Crashed phase: allow pre-betting for upcoming round
                  <button
                    onClick={handlePlaceBet2}
                    className={`w-full h-16 rounded-2xl font-mono font-black active:scale-98 transition-all flex flex-col items-center justify-center cursor-pointer ${
                      bet2Queued 
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' 
                        : 'bg-gradient-to-b from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-slate-950 shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider">{bet2Queued ? 'CANCEL QUEUE' : 'BET NEXT ROUND'}</span>
                    <span className="text-sm">₹{bet2Amount.toFixed(2)} INR</span>
                  </button>
                )}
              </div>

            </div>

            {betMessage2 && (
              <div className="text-[11px] font-bold text-center py-1 px-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono animate-fadeIn flex items-center justify-center gap-1.5">
                <span>⚠️ {betMessage2}</span>
              </div>
            )}
          </div>

        </div>

        {/* 5. COMMUNITY FEED & HISTORY TABS (All Bets, My Bets, Previous, Top) */}
        <div className="bg-[#111622] border border-slate-800 rounded-2xl sm:rounded-3xl p-3 shadow-xl space-y-2 flex-1">
          
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={() => setBottomTab('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                  bottomTab === 'all' ? 'bg-slate-800 text-rose-400 border border-slate-700' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Bets ({communityBets.length})
              </button>
              <button
                onClick={() => setBottomTab('my_bets')}
                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1 ${
                  bottomTab === 'my_bets' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3 h-3 text-rose-400" />
                My Bets ({myBetsHistory.length})
              </button>
              <button
                onClick={() => setBottomTab('previous')}
                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                  bottomTab === 'previous' ? 'bg-slate-800 text-rose-400 border border-slate-700' : 'text-slate-400 hover:text-white'
                }`}
              >
                Previous Round
              </button>
              <button
                onClick={() => setBottomTab('top')}
                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                  bottomTab === 'top' ? 'bg-slate-800 text-rose-400 border border-slate-700' : 'text-slate-400 hover:text-white'
                }`}
              >
                Top Wins
              </button>
            </div>

            {/* Total Win summary */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <span>Total Win:</span>
              <span className="text-emerald-400 font-bold">₹{totalCommunityWinAmount.toLocaleString()} INR</span>
            </div>
          </div>

          {/* Sub-Filter for Top tab */}
          {bottomTab === 'top' && (
            <div className="flex items-center gap-2 pt-1">
              {(['day', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setTopPeriod(p)}
                  className={`px-3 py-0.5 rounded-lg text-[10px] uppercase font-mono font-bold transition-all cursor-pointer ${
                    topPeriod === p ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Table Header */}
          <div className="grid grid-cols-4 px-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>{bottomTab === 'my_bets' ? 'Round / Time' : 'User'}</span>
            <span className="text-center">Bet INR</span>
            <span className="text-center">X Multiplier</span>
            <span className="text-right">Win INR</span>
          </div>

          {/* Table Rows Feed */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 no-scrollbar font-mono text-xs">
            {bottomTab === 'my_bets' ? (
              myBetsHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No betting history recorded on your account yet.
                </div>
              ) : (
                myBetsHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-4 items-center px-2 py-1.5 rounded-xl border transition-all ${
                      item.status === 'won'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/20 text-slate-300'
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <span className="font-bold text-white truncate">{item.roundId}</span>
                      <span className="text-[10px] text-slate-500">{item.date}</span>
                    </div>
                    <span className="text-center text-slate-300">₹{item.betAmount}</span>
                    <span className="text-center">
                      {item.status === 'won' && item.cashOutMultiplier ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 text-[11px]">
                          {item.cashOutMultiplier.toFixed(2)}x
                        </span>
                      ) : (
                        <span className="text-rose-400 text-[11px] font-bold">CRASHED</span>
                      )}
                    </span>
                    <span className={`text-right font-black ${item.status === 'won' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.status === 'won' ? `+₹${item.wonAmount?.toLocaleString()}` : `-₹${item.betAmount}`}
                    </span>
                  </div>
                ))
              )
            ) : bottomTab === 'top' ? (
              // Top Historic Mega Multiplier Records
              [
                { user: '8***5', mult: 11155.44, bet: 10, win: 111554.40, avatar: AVIATOR_AVATARS[0] },
                { user: '3***6', mult: 1840.84, bet: 100, win: 184084.00, avatar: AVIATOR_AVATARS[1] },
                { user: '1***2', mult: 1102.35, bet: 70, win: 77164.50, avatar: AVIATOR_AVATARS[2] },
                { user: '7***9', mult: 680.83, bet: 50, win: 34041.50, avatar: AVIATOR_AVATARS[3] },
                { user: '2***5', mult: 579.68, bet: 500, win: 289840.00, avatar: AVIATOR_AVATARS[4] }
              ].map((top, idx) => (
                <div key={idx} className="grid grid-cols-4 items-center px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <img src={top.avatar} alt="Avatar" className="w-5 h-5 rounded-full object-cover border border-amber-500/40" />
                    <span className="text-slate-300">{top.user}</span>
                  </div>
                  <span className="text-center text-slate-400">₹{top.bet}</span>
                  <span className="text-center text-pink-400 font-bold">{top.mult.toFixed(2)}x</span>
                  <span className="text-right text-emerald-400 font-black">₹{top.win.toLocaleString()}</span>
                </div>
              ))
            ) : (
              // Live Round Community Bets
              communityBets.map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-4 items-center px-2 py-1.5 rounded-xl border transition-all ${
                    item.status === 'cashed_out'
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <img src={item.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
                    <span className="truncate">{item.userName}</span>
                  </div>
                  <span className="text-center text-slate-400">₹{item.betAmount}</span>
                  <span className="text-center">
                    {item.status === 'cashed_out' ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 text-[11px]">
                        {item.cashOutMultiplier?.toFixed(2)}x
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </span>
                  <span className="text-right font-bold text-emerald-400">
                    {item.status === 'cashed_out' ? `₹${item.winAmount?.toLocaleString()}` : '-'}
                  </span>
                </div>
              ))
            )}
          </div>

        </div>

        </div>
      </main>

      {/* 6. LIVE COMMUNITY CHAT DRAWER */}
      {chatOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-[#111622] border-l border-slate-800 z-50 flex flex-col shadow-2xl animate-slideLeft">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-white">Pilot Chat</h3>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {chatMessages.map((msg, idx) => (
              <div
                key={`${msg.id || 'msg'}_${idx}`}
                className={`p-2.5 rounded-2xl text-xs space-y-1 ${
                  msg.isWinHighlight 
                    ? 'bg-gradient-to-r from-amber-950/60 to-rose-950/60 border border-amber-500/40' 
                    : 'bg-slate-900/80 border border-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <img src={msg.avatarUrl} alt="Avatar" className="w-4 h-4 rounded-full" />
                  <span className="font-bold text-slate-300">{msg.userName}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-200">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Quick Reaction Pills */}
          <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {['✈️', '🚀', '🔥', '💰', '👑', '🎉'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setChatMessages((prev) => [
                    {
                      id: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                      userId: user.id || 'user',
                      userName: (user.name || 'You').slice(0, 4),
                      avatarUrl: userAvatar,
                      text: emoji,
                      timestamp: Date.now()
                    },
                    ...prev
                  ]);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-all cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              soundFx.playClick();
              setChatMessages((prev) => [
                {
                  id: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                  userId: user.id || 'user',
                  userName: (user.name || 'You').slice(0, 4),
                  avatarUrl: userAvatar,
                  text: chatInput.trim(),
                  timestamp: Date.now()
                },
                ...prev
              ]);
              setChatInput('');
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Your message..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* 7. SETTINGS / IN-GAME MENU MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#111622] border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">Aviator Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar Card */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <img src={userAvatar} alt="Avatar" className="w-10 h-10 rounded-full border border-rose-500 object-cover" />
                <div>
                  <h4 className="text-xs font-bold text-white">{user.name || 'Aviator Pilot'}</h4>
                  <p className="text-[10px] text-slate-400">{user.email || user.phone}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowAvatarModal(true);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl text-[11px] font-bold border border-slate-700 cursor-pointer"
              >
                Change Avatar
              </button>
            </div>

            {/* Audio & Visual Toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span>Sound FX</span>
                <button
                  onClick={() => {
                    const muted = soundFx.toggleMute();
                    setIsMuted(muted);
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    !isMuted ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    !isMuted ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span>Music Track</span>
                <span className="text-emerald-400 font-bold">ON</span>
              </div>
            </div>

            {/* Navigation links */}
            <div className="space-y-1 pt-1">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowHistoryModal(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-left text-xs font-bold text-slate-300 flex items-center justify-between cursor-pointer"
              >
                <span>My Bet History</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowRulesModal(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-left text-xs font-bold text-slate-300 flex items-center justify-between cursor-pointer"
              >
                <span>Game Rules & How to Play</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. CHANGE AVATAR MODAL (Matching Spribe Aviator Avatar Grid) */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#111622] border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Select Pilot Avatar</h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
              {AVIATOR_AVATARS.map((avUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUserAvatar(avUrl);
                    soundFx.playClick();
                    setShowAvatarModal(false);
                  }}
                  className={`relative p-1 rounded-2xl border-2 transition-transform hover:scale-105 cursor-pointer ${
                    userAvatar === avUrl ? 'border-rose-500 ring-2 ring-rose-500/50' : 'border-slate-800'
                  }`}
                >
                  <img src={avUrl} alt="Avatar" className="w-full h-16 object-cover rounded-xl" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. TRANSACTIONS & BET HISTORY MODAL */}
      {showTransactionsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#111622] border border-slate-800 rounded-3xl max-w-xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>Transactions & Bet History</span>
                    <span className="text-xs text-amber-400 font-normal">(হিস্ট্রি)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Detailed record of your Aviator bets, wins, and cashouts</p>
                </div>
              </div>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Statistics Strip */}
            {(() => {
              const totalBet = myBetsHistory.reduce((acc, b) => acc + b.betAmount, 0);
              const totalWon = myBetsHistory.reduce((acc, b) => acc + (b.wonAmount || 0), 0);
              const netProfit = totalWon - totalBet;
              const winCount = myBetsHistory.filter((b) => b.status === 'won').length;
              const winRate = myBetsHistory.length > 0 ? ((winCount / myBetsHistory.length) * 100).toFixed(1) : '0.0';

              return (
                <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Total Wagered</p>
                    <p className="text-sm font-black font-mono text-white">₹{totalBet.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Total Won</p>
                    <p className="text-sm font-black font-mono text-emerald-400">₹{totalWon.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Net P/L ({winRate}% Win)</p>
                    <p className={`text-sm font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {netProfit >= 0 ? `+₹${netProfit.toLocaleString()}` : `-₹${Math.abs(netProfit).toLocaleString()}`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Filter Tabs */}
            <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold mr-1">Filter:</span>
              {(['all', 'won', 'lost'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setHistoryFilter(tab)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    historyFilter === tab 
                      ? 'bg-amber-500 text-slate-950 shadow' 
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'all' ? `All Bets (${myBetsHistory.length})` : tab === 'won' ? `Wins (${myBetsHistory.filter((b) => b.status === 'won').length})` : `Losses (${myBetsHistory.filter((b) => b.status === 'lost').length})`}
                </button>
              ))}
            </div>

            {/* Transaction List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
              {(() => {
                const filtered = myBetsHistory.filter((b) => {
                  if (historyFilter === 'won') return b.status === 'won';
                  if (historyFilter === 'lost') return b.status === 'lost';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 space-y-2 font-sans">
                      <Receipt className="w-8 h-8 mx-auto opacity-30" />
                      <p>No transaction records found in this view.</p>
                      <p className="text-xs text-slate-600">Place bets to view your live round outcomes here.</p>
                    </div>
                  );
                }

                return filtered.map((b) => {
                  const net = (b.wonAmount || 0) - b.betAmount;
                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                        b.status === 'won' 
                          ? 'bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/30' 
                          : 'bg-gradient-to-r from-rose-950/40 to-slate-900 border-rose-500/30'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            b.status === 'won' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}>
                            {b.status === 'won' ? 'CASHOUT' : 'FLEW AWAY'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-sans">{b.roundId}</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Bet: <strong className="text-white">₹{b.betAmount}</strong> • Time: <span className="text-slate-400">{b.date}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        {b.status === 'won' ? (
                          <>
                            <p className="text-xs font-black text-amber-400">@{b.cashOutMultiplier?.toFixed(2)}x</p>
                            <p className="text-sm font-black text-emerald-400">+₹{b.wonAmount?.toFixed(2)}</p>
                            <p className="text-[10px] text-emerald-500 font-bold font-sans">Profit: +₹{net.toFixed(2)}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-black text-rose-400">0.00x</p>
                            <p className="text-sm font-black text-rose-500">-₹{b.betAmount.toFixed(2)}</p>
                            <p className="text-[10px] text-rose-400 font-bold font-sans">Loss</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center">
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Close Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MY BETS HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#111622] border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">My Aviator History</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 font-mono text-xs pr-1">
              {myBetsHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No bets recorded in this session yet.</p>
                </div>
              ) : (
                myBetsHistory.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Bet: ₹{b.betAmount}</p>
                      <p className="text-[10px] text-slate-400">{b.date}</p>
                    </div>
                    {b.status === 'won' ? (
                      <div className="text-right text-emerald-400">
                        <span className="font-bold">+{b.cashOutMultiplier?.toFixed(2)}x</span>
                        <p className="font-black">+₹{b.wonAmount?.toFixed(2)}</p>
                      </div>
                    ) : (
                      <div className="text-right text-rose-500 font-bold">
                        <span>FLEW AWAY</span>
                        <p>-₹{b.betAmount}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. RULES & HOW TO PLAY MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#111622] border border-slate-800 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Aviator Game Rules</h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 font-sans max-h-72 overflow-y-auto pr-1">
              <p>
                <strong>1. How to Play:</strong> Place a bet (or two bets simultaneously) before the plane takes off. Once the round starts, the multiplier increases continuously from 1.00x upwards.
              </p>
              <p>
                <strong>2. Cashing Out:</strong> Click <em>Cash Out</em> before the airplane flies away. Your win will be calculated as: <code>Bet Amount × Multiplier</code>.
              </p>
              <p>
                <strong>3. Crash:</strong> If the plane flies away before you cash out, your bet is lost.
              </p>
              <p>
                <strong>4. Auto Bet & Auto Cashout:</strong> Set your target multiplier (e.g. 2.00x) and the game will cash out automatically when reached!
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
