import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Dices, ShieldCheck, Sparkles, Save, CheckCircle2, AlertTriangle, 
  RotateCcw, Sliders, Eye, EyeOff, Target, Percent, TrendingUp, 
  ShieldAlert, Lock, Zap, RefreshCw, BarChart2, Radio, Users, 
  DollarSign, Activity, Clock, Award, Filter, ArrowUpRight, 
  Check, Flame, ArrowRight, ArrowDownRight, Layers, HelpCircle,
  Plus, Trash2, Wand2, Hash, Sparkle, Tag, CheckSquare, X,
  History as HistoryIcon
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { RouletteConfig, RouletteRtpMode } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, collection, query, limit, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';
import { 
  RouletteLiveBetItem, 
  calculateAllNumbersLiability, 
  getRouletteNumberColor,
  NumberLiabilitySummary,
  RED_NUMBERS_SET,
  BLACK_NUMBERS_SET,
  LightningMultiplier,
  getSyncedLightningMultipliers,
  LIGHTNING_MULTIPLIERS_LIST,
  getUniversalRouletteTimeState,
  getContinuous24x7History,
  getDeterministicRoundOutcome,
  SyncedRoundResultItem,
  getSyncedRoundDeterministicWinNumber
} from '../../utils/rouletteRiskEngine';

const DEFAULT_ROULETTE_CONFIG: RouletteConfig = {
  rtpPercentage: 97.3,
  houseEdgePercentage: 2.7,
  rtpMode: 'european_standard',
  manualNextNumber: 17,
  manualNextNumberActive: false,
  minBet: 20,
  maxBet: 50000,
  maxTotalPayoutLimit: 200000,
  isRouletteEnabled: true,
  preventOppositeBets: true,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Admin'
};

export interface PastRouletteRound {
  roundId: string;
  winningNumber: number;
  color: string;
  parity: string;
  range: string;
  dozen: string;
  column: string;
  multiplier?: number;
  lightningNumbers?: LightningMultiplier[];
  totalWagered?: number;
  totalPayout?: number;
  houseProfit?: number;
  totalBets?: number;
  activeUsers?: number;
  settledAt: string;
}

export const AdminRouletteManager: React.FC = () => {
  // Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'live_monitor' | 'analytics' | 'rtp_settings'>('live_monitor');

  // Config State
  const [config, setConfig] = useState<RouletteConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_roulette_config');
      if (cached) {
        return { ...DEFAULT_ROULETTE_CONFIG, ...JSON.parse(cached) };
      }
    } catch (e) {}
    return DEFAULT_ROULETTE_CONFIG;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live Round State from Firestore
  const [currentRoundId, setCurrentRoundId] = useState<string>('HLR-LIVE');
  const [roundPhase, setRoundPhase] = useState<'betting' | 'lightning' | 'spinning' | 'settled'>('betting');
  const [roundCountdown, setRoundCountdown] = useState<number>(18);
  const [liveBets, setLiveBets] = useState<RouletteLiveBetItem[]>([]);
  const [isAutoLowRiskActive, setIsAutoLowRiskActive] = useState<boolean>(true);
  const [selectedManualNumber, setSelectedManualNumber] = useState<number | null>(null);
  const [isManualOverrideEnabled, setIsManualOverrideEnabled] = useState<boolean>(false);

  // Lightning Numbers (লাইটিং নম্বর) State & Real-Time Sync
  const [activeLightningNumbers, setActiveLightningNumbers] = useState<LightningMultiplier[]>([]);
  const [isManualLightningEnabled, setIsManualLightningEnabled] = useState<boolean>(false);
  const [manualLightningNumbers, setManualLightningNumbers] = useState<LightningMultiplier[] | null>(null);
  const [customLightningDraft, setCustomLightningDraft] = useState<LightningMultiplier[]>([
    { number: 7, multiplier: 100 },
    { number: 17, multiplier: 200 },
    { number: 29, multiplier: 50 }
  ]);
  const [draftNumberInput, setDraftNumberInput] = useState<number>(7);
  const [draftMultiplierInput, setDraftMultiplierInput] = useState<number>(100);
  const [lastSettledResult, setLastSettledResult] = useState<{
    roundId?: string;
    winningNumber?: number;
    color?: string;
    multiplier?: number | null;
    settledAt?: string;
    timestamp?: string;
  } | null>(null);

  // Historical Rounds State
  const [pastRounds, setPastRounds] = useState<PastRouletteRound[]>([]);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [riskTableSort, setRiskTableSort] = useState<'profit_desc' | 'profit_asc' | 'bets_desc' | 'number_asc'>('profit_desc');

  // 1. Sync Live Round State & Config with Firestore in Real-Time
  useEffect(() => {
    // Config listener from game_settings
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'roulette'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          const next = {
            ...prev,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' 
              ? data.houseEdgePercentage 
              : Math.round((100 - (data.rtpPercentage || prev.rtpPercentage)) * 10) / 10,
            rtpMode: data.rtpMode || prev.rtpMode,
            isRouletteEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isRouletteEnabled,
            preventOppositeBets: data.preventOppositeBets !== undefined ? data.preventOppositeBets : prev.preventOppositeBets,
            minBet: typeof data.minBet === 'number' ? data.minBet : prev.minBet,
            maxBet: typeof data.maxBet === 'number' ? data.maxBet : prev.maxBet,
          };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }, (err) => console.warn('Roulette game_settings listener error:', err.message));

    // Fallback Config listener
    const unsubConfig = onSnapshot(doc(db, 'roulette_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RouletteConfig>;
        setConfig((prev) => {
          const next = {
            ...prev,
            ...data,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' 
              ? data.houseEdgePercentage 
              : Math.round((100 - (data.rtpPercentage || prev.rtpPercentage)) * 10) / 10,
            rtpMode: data.rtpMode || prev.rtpMode,
            isRouletteEnabled: data.isRouletteEnabled ?? prev.isRouletteEnabled
          };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
        if (data.isManualLightningOverride !== undefined) {
          setIsManualLightningEnabled(data.isManualLightningOverride);
        }
        if (data.manualLightningNumbers !== undefined) {
          setManualLightningNumbers(data.manualLightningNumbers);
          if (Array.isArray(data.manualLightningNumbers) && data.manualLightningNumbers.length > 0) {
            setCustomLightningDraft(data.manualLightningNumbers);
          }
        }
      }
    }, (err) => console.warn('Roulette config listener error:', err.message));

    // Live Round State listener
    const unsubLiveRound = onSnapshot(doc(db, 'roulette_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.isAutoLowRiskEnabled !== undefined) setIsAutoLowRiskActive(data.isAutoLowRiskEnabled);
        if (data.isManualOverride !== undefined) setIsManualOverrideEnabled(data.isManualOverride);
        if (data.manualWinningNumber !== undefined) setSelectedManualNumber(data.manualWinningNumber);
        
        // Real-time lightning numbers sync
        if (Array.isArray(data.lightningNumbers) && data.lightningNumbers.length > 0) {
          setActiveLightningNumbers(data.lightningNumbers);
        }
        if (data.isManualLightningOverride !== undefined) {
          setIsManualLightningEnabled(data.isManualLightningOverride);
        }
        if (data.manualLightningNumbers !== undefined) {
          setManualLightningNumbers(data.manualLightningNumbers);
          if (Array.isArray(data.manualLightningNumbers) && data.manualLightningNumbers.length > 0) {
            setCustomLightningDraft(data.manualLightningNumbers);
          }
        }
        if (data.lastSettledResult) {
          setLastSettledResult(data.lastSettledResult);
        }
      }
    }, (err) => console.warn('Roulette live round state listener error:', err.message));

    // Live Bets listener for the active round - zero delay, no arbitrary limits
    const unsubLiveBets = onSnapshot(collection(db, 'roulette_live_bets'), (snap) => {
      const betsList: RouletteLiveBetItem[] = [];
      const now = Date.now();
      snap.forEach((d) => {
        const bData = { id: d.id, ...d.data() } as RouletteLiveBetItem;
        betsList.push(bData);
        // Automatic cleanup of stale bets older than 5 minutes
        const placedAt = (bData as any).placedAt || 0;
        if (placedAt && now - placedAt > 300000) {
          deleteDoc(doc(db, 'roulette_live_bets', d.id)).catch(() => {});
        }
      });
      // Sort newest first
      betsList.sort((a, b) => {
        const timeA = (a as any).placedAt || 0;
        const timeB = (b as any).placedAt || 0;
        if (timeA && timeB) return timeB - timeA;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      setLiveBets(betsList);
    }, (err) => console.warn('Live bets listener error:', err.message));

    // Past Rounds history listener
    const qRounds = query(collection(db, 'roulette_rounds'), limit(60));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const roundsList: PastRouletteRound[] = [];
      snap.forEach((d) => {
        roundsList.push({ ...d.data() } as PastRouletteRound);
      });
      roundsList.sort((a, b) => (b.settledAt || '').localeCompare(a.settledAt || ''));
      setPastRounds(roundsList);
    }, (err) => console.warn('Roulette history listener error:', err.message));

    return () => {
      unsubConfig();
      unsubLiveRound();
      unsubLiveBets();
      unsubRounds();
    };
  }, []);

  // Real-time universal 24x7 clock synchronizer for admin radar
  useEffect(() => {
    const updateTime = () => {
      const timeState = getUniversalRouletteTimeState(Date.now());
      setRoundCountdown(timeState.countdown);
      setRoundPhase(timeState.phase);
      if (timeState.roundId !== currentRoundId) {
        setCurrentRoundId(timeState.roundId);
        // Automatically reset single-round manual override on new round transition
        if (isManualOverrideEnabled) {
          setIsManualOverrideEnabled(false);
          setSelectedManualNumber(null);
          setIsAutoLowRiskActive(true);
          setDoc(doc(db, 'roulette_live_state', 'current_round'), {
            isManualOverride: false,
            manualWinningNumber: null,
            isAutoLowRiskEnabled: true,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
          setDoc(doc(db, 'roulette_config', 'main'), {
            manualNextNumberActive: false,
            isManualOverride: false,
            manualWinningNumber: null,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
          setDoc(doc(db, 'game_settings', 'roulette'), {
            manualNextNumberActive: false,
            manualForceWinner: null,
            manualWinningNumber: null,
            rtpMode: 'house_protect',
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 250);
    return () => clearInterval(interval);
  }, [currentRoundId, isManualOverrideEnabled]);

  // Real-time bets strictly for the active round (empty if no bets placed in this round)
  const currentRoundBets = useMemo(() => {
    if (!currentRoundId || currentRoundId === 'HLR-LIVE') {
      return [];
    }
    return liveBets.filter(b => b.roundId === currentRoundId);
  }, [liveBets, currentRoundId]);

  // Resolved active lightning numbers with fallback to deterministic synced generation
  const resolvedLightningNumbers = useMemo(() => {
    if (isManualLightningEnabled && manualLightningNumbers && manualLightningNumbers.length > 0) {
      return manualLightningNumbers;
    }
    return getSyncedLightningMultipliers(currentRoundId);
  }, [isManualLightningEnabled, manualLightningNumbers, currentRoundId]);

  // Calculate complete real-time liabilities & AI recommended low-risk pocket with deterministic round seed
  const riskAnalysis = useMemo(() => {
    return calculateAllNumbersLiability(
      currentRoundBets, 
      currentRoundId,
      { lightningNumbers: resolvedLightningNumbers.map(l => l.number) }
    );
  }, [currentRoundBets, currentRoundId, resolvedLightningNumbers]);

  // Sync calculated low-risk recommendation automatically to Firestore current_round state for admin monitoring
  useEffect(() => {
    if (!currentRoundId || currentRoundId === 'HLR-LIVE' || isManualOverrideEnabled) return;
    
    const syncPayload: any = {
      roundId: currentRoundId,
      recommendedLowRiskNumber: riskAnalysis.lowestRiskNumber,
      recommendedLowRiskProfit: riskAnalysis.lowestRiskProfit,
      predeterminedWinningNumber: isAutoLowRiskActive ? riskAnalysis.lowestRiskNumber : null,
      totalWagered: riskAnalysis.totalPot,
      totalBetsCount: riskAnalysis.totalBetsCount,
      activeUsersCount: riskAnalysis.uniqueUsersCount,
      isAutoLowRiskEnabled: isAutoLowRiskActive,
      updatedAt: new Date().toISOString()
    };

    setDoc(doc(db, 'roulette_live_state', 'current_round'), syncPayload, { merge: true }).catch(() => {});
  }, [
    currentRoundId, 
    riskAnalysis.lowestRiskNumber, 
    riskAnalysis.lowestRiskProfit, 
    riskAnalysis.totalPot, 
    riskAnalysis.totalBetsCount, 
    riskAnalysis.uniqueUsersCount,
    isAutoLowRiskActive,
    isManualOverrideEnabled
  ]);

  // Handlers for Setting Outcome (Auto Low-Risk vs Manual Override)
  const handleToggleAutoLowRisk = async (enabled: boolean) => {
    soundFx.playClick();
    setIsAutoLowRiskActive(enabled);
    if (enabled) {
      setIsManualOverrideEnabled(false);
      setSelectedManualNumber(null);
    }
    try {
      await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
        isAutoLowRiskEnabled: enabled,
        isManualOverride: false,
        manualWinningNumber: null,
        predeterminedWinningNumber: enabled ? riskAnalysis.lowestRiskNumber : null,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'roulette_config', 'main'), {
        manualNextNumberActive: false,
        manualNextNumber: null,
        rtpMode: enabled ? 'house_protect' : 'european_standard'
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'roulette'), {
        manualForceWinner: null,
        rtpMode: enabled ? 'house_protect' : 'european_standard',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setStatusMessage(enabled ? `🤖 Auto Low-Risk Maximum House Profit Mode Enabled (Winning #${riskAnalysis.lowestRiskNumber})` : 'Manual / Fair RNG Mode Selected');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {}
  };

  const handleSelectManualNumber = async (num: number) => {
    soundFx.playCoin();
    setSelectedManualNumber(num);
    setIsManualOverrideEnabled(true);
    setIsAutoLowRiskActive(false);

    try {
      await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
        isManualOverride: true,
        isAutoLowRiskEnabled: false,
        manualWinningNumber: num,
        predeterminedWinningNumber: num,
        targetRoundId: currentRoundId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Also sync to roulette_config and game_settings for fallback
      await setDoc(doc(db, 'roulette_config', 'main'), {
        manualNextNumber: num,
        manualNextNumberActive: true,
        rtpMode: 'manual_next_number'
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'roulette'), {
        manualForceWinner: num,
        rtpMode: 'manual_force',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setStatusMessage(`🎯 Forced Manual Winning Outcome set to Pocket #${num} (${getRouletteNumberColor(num).toUpperCase()})`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e) {}
  };

  const handleClearManualOverride = async () => {
    soundFx.playClick();
    setIsManualOverrideEnabled(false);
    setSelectedManualNumber(null);
    setIsAutoLowRiskActive(true);

    try {
      await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
        isManualOverride: false,
        isAutoLowRiskEnabled: true,
        predeterminedWinningNumber: riskAnalysis.lowestRiskNumber,
        manualWinningNumber: null,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'roulette_config', 'main'), {
        manualNextNumberActive: false,
        manualNextNumber: null,
        rtpMode: 'european_standard'
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'roulette'), {
        manualForceWinner: null,
        rtpMode: 'european_standard',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setStatusMessage('Restored to Auto Low-Risk Profit calculation mode.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {}
  };

  // Continuous 24/7 history map merged with Firestore records
  const firestoreRoundsMap = useMemo(() => {
    const map = new Map<string, any>();
    pastRounds.forEach(r => {
      if (r.roundId) map.set(r.roundId, r);
    });
    return map;
  }, [pastRounds]);

  const synced24x7History = useMemo(() => {
    return getContinuous24x7History(30, firestoreRoundsMap, Date.now());
  }, [firestoreRoundsMap, currentRoundId, roundPhase]);

  const displayLastSettledResult = useMemo(() => {
    if (synced24x7History.length > 0) {
      return synced24x7History[0];
    }
    return lastSettledResult;
  }, [synced24x7History, lastSettledResult]);

  const settledRoundsRecordedRef = useRef<Set<string>>(new Set());

  // Automatic 0-sec latency settlement recorder in Admin
  useEffect(() => {
    if (roundPhase !== 'settled' || !currentRoundId || currentRoundId === 'HLR-LIVE') return;
    if (settledRoundsRecordedRef.current.has(currentRoundId)) return;
    settledRoundsRecordedRef.current.add(currentRoundId);

    // Get the exact winning outcome
    let winNum: number;
    const isBettingActive = currentRoundBets.length > 0;
    const lightningSet = new Set(resolvedLightningNumbers.map(l => l.number));

    const existingDoc = firestoreRoundsMap.get(currentRoundId);
    if (isManualOverrideEnabled && typeof selectedManualNumber === 'number') {
      // 1. Explicit Admin Force Manual Override
      winNum = selectedManualNumber;
    } else if (existingDoc && typeof existingDoc.winningNumber === 'number' && (!isBettingActive || !lightningSet.has(existingDoc.winningNumber))) {
      winNum = existingDoc.winningNumber;
    } else if (isAutoLowRiskActive && typeof riskAnalysis.lowestRiskNumber === 'number' && (!isBettingActive || !lightningSet.has(riskAnalysis.lowestRiskNumber))) {
      winNum = riskAnalysis.lowestRiskNumber;
    } else {
      const naturalWin = getSyncedRoundDeterministicWinNumber(currentRoundId);
      if (isBettingActive && lightningSet.has(naturalWin)) {
        winNum = riskAnalysis.lowestRiskNumber;
      } else {
        winNum = naturalWin;
      }
    }

    // 100% Guaranteed Protection: While bets are active, ball CANNOT land on lightning number unless manually forced
    if (isBettingActive && !isManualOverrideEnabled && lightningSet.has(winNum)) {
      const safeNonLightning = riskAnalysis.numberSummaries
        .filter(s => !lightningSet.has(s.number))
        .sort((a, b) => b.netHouseProfit - a.netHouseProfit);
      winNum = safeNonLightning[0]?.number ?? (winNum === 0 ? 1 : 0);
    }

    const lucky = resolvedLightningNumbers.find(l => l.number === winNum);
    const multiplier = lucky ? lucky.multiplier : 30;
    const color = getRouletteNumberColor(winNum);
    const nowIso = new Date().toISOString();

    const settledDoc = {
      roundId: currentRoundId,
      winningNumber: winNum,
      color,
      multiplier,
      lightningNumbers: resolvedLightningNumbers,
      settledAt: nowIso,
      updatedAt: nowIso
    };

    setDoc(doc(db, 'roulette_live_state', 'current_round'), {
      lastSettledResult: settledDoc,
      targetRoundId: currentRoundId,
      updatedAt: nowIso
    }, { merge: true }).catch(() => {});

    setDoc(doc(db, 'roulette_rounds', currentRoundId), settledDoc, { merge: true }).catch(() => {});
  }, [roundPhase, currentRoundId, isManualOverrideEnabled, selectedManualNumber, isAutoLowRiskActive, riskAnalysis.lowestRiskNumber, resolvedLightningNumbers]);

  // Handlers for Lightning Numbers (লাইটিং নম্বর)
  const handleAddLightningDraft = (num: number, mult: number) => {
    soundFx.playClick();
    setCustomLightningDraft((prev) => {
      const filtered = prev.filter((item) => item.number !== num);
      if (filtered.length >= 5) {
        setStatusMessage('⚠️ Maximum 5 Lightning numbers allowed per round.');
        setTimeout(() => setStatusMessage(null), 2500);
        return prev;
      }
      return [...filtered, { number: num, multiplier: mult }].sort((a, b) => a.number - b.number);
    });
  };

  const handleRemoveLightningDraft = (num: number) => {
    soundFx.playClick();
    setCustomLightningDraft((prev) => prev.filter((item) => item.number !== num));
  };

  const handleApplyManualLightning = async (explicitList?: LightningMultiplier[]) => {
    soundFx.playCoin();
    const listToApply = explicitList || customLightningDraft;
    if (!listToApply || listToApply.length === 0) {
      setStatusMessage('⚠️ Please add at least 1 lightning number before applying.');
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    try {
      setIsManualLightningEnabled(true);
      setManualLightningNumbers(listToApply);
      setActiveLightningNumbers(listToApply);

      await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
        isManualLightningOverride: true,
        manualLightningNumbers: listToApply,
        lightningNumbers: listToApply,
        roundId: currentRoundId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'roulette_config', 'main'), {
        isManualLightningOverride: true,
        manualLightningNumbers: listToApply
      }, { merge: true });

      setStatusMessage(`⚡ Manual Lightning Numbers applied to round #${currentRoundId}: [${listToApply.map(l => `#${l.number} (${l.multiplier}x)`).join(', ')}]`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e) {
      console.error('Error applying manual lightning numbers:', e);
    }
  };

  const handleResetAutoLightning = async () => {
    soundFx.playClick();
    const autoSynced = getSyncedLightningMultipliers(currentRoundId);
    setIsManualLightningEnabled(false);
    setManualLightningNumbers(null);
    setActiveLightningNumbers(autoSynced);

    try {
      await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
        isManualLightningOverride: false,
        manualLightningNumbers: null,
        lightningNumbers: autoSynced,
        roundId: currentRoundId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'roulette_config', 'main'), {
        isManualLightningOverride: false,
        manualLightningNumbers: null
      }, { merge: true });

      setStatusMessage(`🔄 Restored to Dynamic Auto Lightning Multipliers for round #${currentRoundId}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error('Error resetting lightning numbers:', e);
    }
  };

  const handleApplyPresetLightning = (preset: 'random' | 'max500' | 'vip') => {
    let presetList: LightningMultiplier[] = [];
    if (preset === 'random') {
      const nums = [Math.floor(Math.random() * 37), Math.floor(Math.random() * 37), Math.floor(Math.random() * 37)];
      const uniqueNums = Array.from(new Set(nums));
      const mults = [50, 100, 200, 300, 500];
      presetList = uniqueNums.map((n) => ({
        number: n,
        multiplier: mults[Math.floor(Math.random() * mults.length)]
      }));
    } else if (preset === 'max500') {
      presetList = [
        { number: 7, multiplier: 500 },
        { number: 17, multiplier: 500 },
        { number: 29, multiplier: 500 }
      ];
    } else if (preset === 'vip') {
      presetList = [
        { number: 0, multiplier: 500 },
        { number: 8, multiplier: 300 },
        { number: 18, multiplier: 200 },
        { number: 28, multiplier: 100 }
      ];
    }
    setCustomLightningDraft(presetList);
    handleApplyManualLightning(presetList);
  };

  // RTP Handlers
  const handleRtpChange = (newRtp: number) => {
    const clampedRtp = Math.max(0, Math.min(99.5, Math.round(newRtp * 10) / 10));
    const calculatedHouseEdge = Math.round((100 - clampedRtp) * 10) / 10;
    const autoMode: RouletteRtpMode = clampedRtp < 97 ? 'house_protect' : 'european_standard';
    
    setConfig((prev) => ({
      ...prev,
      rtpPercentage: clampedRtp,
      houseEdgePercentage: calculatedHouseEdge,
      rtpMode: prev.rtpMode === 'manual_next_number' ? 'manual_next_number' : autoMode
    }));
  };

  const handleHouseEdgeChange = (newEdge: number) => {
    const clampedEdge = Math.max(0.5, Math.min(100, Math.round(newEdge * 10) / 10));
    const calculatedRtp = Math.round((100 - clampedEdge) * 10) / 10;
    const autoMode: RouletteRtpMode = calculatedRtp < 97 ? 'house_protect' : 'european_standard';

    setConfig((prev) => ({
      ...prev,
      houseEdgePercentage: clampedEdge,
      rtpPercentage: calculatedRtp,
      rtpMode: prev.rtpMode === 'manual_next_number' ? 'manual_next_number' : autoMode
    }));
  };

  const handleApplyPreset = (rtp: number, mode: RouletteRtpMode, label: string) => {
    soundFx.playClick();
    const clampedRtp = Math.max(0, Math.min(99.5, Math.round(rtp * 10) / 10));
    const calculatedHouseEdge = Math.round((100 - clampedRtp) * 10) / 10;
    
    setConfig((prev) => ({
      ...prev,
      rtpPercentage: clampedRtp,
      houseEdgePercentage: calculatedHouseEdge,
      rtpMode: mode
    }));

    setStatusMessage(`Preset applied: ${label}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    soundFx.playClick();
    try {
      const payload: RouletteConfig = {
        ...config,
        rtpPercentage: Number(config.rtpPercentage),
        houseEdgePercentage: Math.round((100 - Number(config.rtpPercentage)) * 10) / 10,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Admin'
      };

      try {
        localStorage.setItem('bg_roulette_config', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('bg_roulette_config_change', { detail: payload }));
      } catch (e) {}

      await setDoc(doc(db, 'roulette_config', 'main'), payload, { merge: true });
      await setDoc(doc(db, 'game_settings', 'roulette'), {
        gameId: 'roulette',
        gameName: 'Hindi Lightning Roulette',
        isEnabled: payload.isRouletteEnabled ?? true,
        preventOppositeBets: payload.preventOppositeBets !== undefined ? payload.preventOppositeBets : true,
        rtpPercentage: payload.rtpPercentage,
        houseEdgePercentage: payload.houseEdgePercentage,
        rtpMode: payload.rtpMode,
        minBet: payload.minBet,
        maxBet: payload.maxBet,
        manualForceWinner: payload.manualNextNumberActive ? payload.manualNextNumber : null,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin'
      }, { merge: true });
      soundFx.playCoin();
      setSaveSuccess(true);
      setStatusMessage('Live Roulette RTP & House Edge configuration saved successfully!');
      setTimeout(() => {
        setSaveSuccess(false);
        setStatusMessage(null);
      }, 4000);
    } catch (e: any) {
      alert('Failed to save configuration: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // High Concentration / Abnormal Betting Alert Calculation
  const concentrationAlert = useMemo(() => {
    if (riskAnalysis.totalPot <= 0) return null;
    // Check if any single number has > 35% of total pot
    const highestNumber = [...riskAnalysis.numberSummaries].sort((a, b) => b.straightBetAmount - a.straightBetAmount)[0];
    if (highestNumber && highestNumber.straightBetAmount > 500 && highestNumber.percentageOfPot >= 35) {
      return {
        type: 'number',
        number: highestNumber.number,
        amount: highestNumber.straightBetAmount,
        percentage: Math.round(highestNumber.percentageOfPot),
        payoutExposure: highestNumber.totalPayoutIfLands
      };
    }
    return null;
  }, [riskAnalysis]);

  // Sorted list for 37-number liability ranking table with rock-solid tie-breaking
  const sortedNumbersList = useMemo(() => {
    const list = [...riskAnalysis.numberSummaries];
    if (riskTableSort === 'profit_desc') {
      return list.sort((a, b) => (b.netHouseProfit - a.netHouseProfit) || (a.number - b.number));
    }
    if (riskTableSort === 'profit_asc') {
      return list.sort((a, b) => (a.netHouseProfit - b.netHouseProfit) || (a.number - b.number));
    }
    if (riskTableSort === 'bets_desc') {
      return list.sort((a, b) => (b.straightBetAmount - a.straightBetAmount) || (a.number - b.number));
    }
    return list.sort((a, b) => a.number - b.number);
  }, [riskAnalysis.numberSummaries, riskTableSort]);

  // Chart Data for History Analytics
  const profitHistoryChartData = useMemo(() => {
    return pastRounds.slice(0, 20).reverse().map((r, idx) => ({
      round: r.roundId ? r.roundId.replace('HLR-', '#') : `#${idx + 1}`,
      wagered: r.totalWagered || 500,
      payout: r.totalPayout || 0,
      profit: r.houseProfit !== undefined ? r.houseProfit : ((r.totalWagered || 500) - (r.totalPayout || 0)),
      number: r.winningNumber
    }));
  }, [pastRounds]);

  const numberHitFrequencyData = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i <= 36; i++) counts[i] = 0;
    pastRounds.forEach(r => {
      if (typeof r.winningNumber === 'number' && r.winningNumber >= 0 && r.winningNumber <= 36) {
        counts[r.winningNumber] = (counts[r.winningNumber] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([num, count]) => ({
      number: `#${num}`,
      count,
      color: getRouletteNumberColor(Number(num))
    }));
  }, [pastRounds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans text-slate-100">
      
      {/* Top Banner Notice */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-2 border-amber-500/40 rounded-3xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/20">
            <Dices className="w-7 h-7 animate-spin" style={{ animationDuration: '20s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase font-mono px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-sm">
                REAL-TIME MONITORING HUB
              </span>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Firestore Stream Active
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight flex items-center gap-2">
              <span>Live Roulette Risk & Admin Dashboard</span>
            </h2>
            <p className="text-xs text-slate-300 font-mono">
              Synchronized real-time round monitoring, live betting heatmap, auto low-risk profit calculation, and manual pocket overrides.
            </p>
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 font-mono w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => { soundFx.playClick(); setActiveSubTab('live_monitor'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'live_monitor'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Monitor & Risk</span>
          </button>

          <button
            onClick={() => { soundFx.playClick(); setActiveSubTab('analytics'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'analytics'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>History & Charts</span>
          </button>

          <button
            onClick={() => { soundFx.playClick(); setActiveSubTab('rtp_settings'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'rtp_settings'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>RTP & Math Settings</span>
          </button>
        </div>
      </div>

      {/* Status Notification Alert */}
      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-mono flex items-center gap-3 animate-in fade-in shadow-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold">{statusMessage}</span>
        </div>
      )}

      {/* Abnormal Betting Alert Banner */}
      {concentrationAlert && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs font-mono flex items-center justify-between gap-4 animate-pulse shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <span className="font-black text-white block">⚠️ HIGH BETTING CONCENTRATION ALERT</span>
              <span>Pocket #{concentrationAlert.number} ({getRouletteNumberColor(concentrationAlert.number).toUpperCase()}) has ₹{(Number(concentrationAlert?.amount) || 0).toLocaleString('en-IN')} wagered ({concentrationAlert.percentage}% of pot). Payout exposure: ₹{(Number(concentrationAlert?.payoutExposure) || 0).toLocaleString('en-IN')}.</span>
            </div>
          </div>
          <button
            onClick={() => handleSelectManualNumber(riskAnalysis.lowestRiskNumber)}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shrink-0 cursor-pointer shadow-md"
          >
            Switch to Low Risk #{riskAnalysis.lowestRiskNumber}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: LIVE REAL-TIME MONITORING & RISK ENGINE */}
      {/* ========================================================================= */}
      {activeSubTab === 'live_monitor' && (
        <div className="space-y-6 font-mono">
          
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            
            {/* 1. Synchronized Round ID */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Synchronized Round ID
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-amber-400 truncate">
                  {currentRoundId}
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              </div>
              <span className="text-[9px] text-slate-400 block mt-1">Exact match with User Screen</span>
            </div>

            {/* 2. Round Phase & Timer */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Live Status & Timer
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-base sm:text-lg font-black uppercase ${
                  roundPhase === 'betting' ? 'text-emerald-400' : roundPhase === 'spinning' ? 'text-amber-400' : 'text-purple-400'
                }`}>
                  {roundPhase}
                </span>
                {roundPhase === 'betting' && (
                  <span className="text-xs bg-emerald-950 border border-emerald-700 text-emerald-300 font-black px-2 py-0.5 rounded-lg">
                    {roundCountdown}s
                  </span>
                )}
              </div>
              <span className="text-[9px] text-slate-400 block mt-1">Live game controller state</span>
            </div>

            {/* 3. Active Players Count */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Active Players
              </span>
              <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-1.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>{riskAnalysis.uniqueUsersCount}</span>
              </div>
              <span className="text-[9px] text-indigo-300 block mt-1">Unique betting users</span>
            </div>

            {/* 4. Total Bets Count */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Total Stakes Placed
              </span>
              <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-1.5">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>{riskAnalysis.totalBetsCount}</span>
              </div>
              <span className="text-[9px] text-amber-300 block mt-1">Individual wager spots</span>
            </div>

            {/* 5. Total Round Pot (₹) */}
            <div className="p-4 bg-gradient-to-br from-amber-950/50 to-slate-900 border-2 border-amber-500/40 rounded-2xl shadow-lg col-span-2 sm:col-span-1">
              <span className="text-[10px] text-amber-300 font-black uppercase tracking-wider block mb-1">
                Total Pot / Wagered
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                ₹{riskAnalysis.totalPot.toLocaleString('en-IN')}
              </div>
              <span className="text-[9px] text-slate-300 block mt-1">Total revenue collected</span>
            </div>

          </div>

          {/* === PREVIOUS 15 ROUNDS RESULTS TAPE (EXACT USER PANEL DESIGN) === */}
          <div className="px-4 py-2.5 bg-[#080a0f] border border-amber-500/20 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 font-mono text-[11px] shadow-xl">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-[280px]">
              <span className="text-[10px] text-slate-400 uppercase font-black shrink-0 flex items-center gap-1.5 mr-1">
                <HistoryIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>পূর্ববর্তী ১৫ রাউন্ড:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                {synced24x7History.slice(0, 15).map((r, idx) => {
                  const isGreen = r.color === 'green' || r.winningNumber === 0;
                  const isRed = r.color === 'red';
                  const hasLightningMult = Boolean(r.multiplier && r.multiplier > 30);
                  const isNewest = idx === 0;

                  return (
                    <div
                      key={r.roundId || idx}
                      className={`relative shrink-0 flex items-center justify-center font-bold text-[10px] transition-all cursor-pointer hover:scale-125 ${
                        hasLightningMult
                          ? 'px-2 py-0.5 rounded-lg bg-gradient-to-b from-amber-500 to-amber-700 border border-amber-300 text-slate-950 font-black shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-lightning-blink'
                          : isNewest
                          ? 'w-6 h-6 rounded-full font-black ring-2 ring-amber-400 shadow-md scale-105'
                          : 'w-6 h-6 rounded-full opacity-90'
                      } ${
                        hasLightningMult ? '' :
                        isGreen ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(5,150,105,0.5)]' :
                        isRed ? 'bg-rose-600 text-white shadow-[0_0_8px_rgba(225,29,72,0.5)]' :
                        'bg-slate-900 border border-slate-700 text-white shadow-[0_0_8px_rgba(15,23,42,0.5)]'
                      }`}
                      title={`রাউন্ড #${r.roundId} | বিজয়ী সংখ্যা: ${r.winningNumber} (${r.color}) | মাল্টিপ্লায়ার: ${r.multiplier || 30}X`}
                    >
                      <span>{r.winningNumber}</span>
                      {hasLightningMult && <span className="ml-1 text-[8px]">⚡{r.multiplier}X</span>}
                      {isNewest && !hasLightningMult && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
              <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                <span>Red: {synced24x7History.slice(0, 15).filter(r => r.color === 'red').length}</span>
              </span>
              <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-slate-800 border border-slate-600 inline-block" />
                <span>Black: {synced24x7History.slice(0, 15).filter(r => r.color === 'black').length}</span>
              </span>
              <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                <span>Green: {synced24x7History.slice(0, 15).filter(r => r.color === 'green' || r.winningNumber === 0).length}</span>
              </span>
            </div>
          </div>

          {/* AI / ALGORITHM LOW-RISK PROFIT PREDICTOR & CONTROL PANEL */}
          <div className="p-5 sm:p-6 bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl space-y-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                    AI PROFIT MAXIMIZER
                  </span>
                  <span className="text-xs text-amber-400 font-bold">• Automated Risk Engine</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>Calculated Lowest-Risk (Maximum House Profit) Result</span>
                </h3>
                <p className="text-xs text-slate-400 max-w-2xl">
                  The mathematical engine continuously evaluates all live stakes in round #{currentRoundId} and identifies the exact pocket that yields the maximum retained profit for the house.
                </p>
              </div>

              {/* Mode Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleToggleAutoLowRisk(true)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    isAutoLowRiskActive && !isManualOverrideEnabled
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>AUTO LOW-RISK MODE</span>
                </button>

                <button
                  onClick={() => {
                    if (isManualOverrideEnabled) {
                      handleClearManualOverride();
                    } else {
                      handleSelectManualNumber(selectedManualNumber !== null ? selectedManualNumber : 17);
                    }
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    isManualOverrideEnabled
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-yellow-300'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  <span>{isManualOverrideEnabled ? `MANUAL ACTIVE (#${selectedManualNumber})` : 'MANUAL OVERRIDE'}</span>
                </button>
              </div>
            </div>

            {/* Live Recommendation Output Display */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              
              {/* Selected / Calculated Number Emblem */}
              <div className="p-4 bg-slate-950 rounded-2xl border-2 border-emerald-500/60 flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-xl shrink-0 ${
                  getRouletteNumberColor(isManualOverrideEnabled && selectedManualNumber !== null ? selectedManualNumber : riskAnalysis.lowestRiskNumber) === 'green'
                    ? 'bg-emerald-600 text-white border-2 border-emerald-300 shadow-emerald-500/50'
                    : getRouletteNumberColor(isManualOverrideEnabled && selectedManualNumber !== null ? selectedManualNumber : riskAnalysis.lowestRiskNumber) === 'red'
                    ? 'bg-rose-600 text-white border-2 border-rose-300 shadow-rose-500/50'
                    : 'bg-slate-950 text-white border-2 border-slate-600 shadow-slate-900/80'
                }`}>
                  {isManualOverrideEnabled && selectedManualNumber !== null ? selectedManualNumber : riskAnalysis.lowestRiskNumber}
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                    {isManualOverrideEnabled ? 'FORCED OUTCOME' : 'RECOMMENDED NUMBER'}
                  </span>
                  <span className="text-base font-black text-white">
                    Pocket #{isManualOverrideEnabled && selectedManualNumber !== null ? selectedManualNumber : riskAnalysis.lowestRiskNumber}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 uppercase">
                    Color: {getRouletteNumberColor(isManualOverrideEnabled && selectedManualNumber !== null ? selectedManualNumber : riskAnalysis.lowestRiskNumber)}
                  </span>
                </div>
              </div>

              {/* Projected House Profit */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Projected House Profit</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  ₹{riskAnalysis.lowestRiskProfit.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-400/80 block mt-1">100% Retained if this number lands</span>
              </div>

              {/* Total Payout Exposure to Players */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Total Payout Exposure</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">
                  ₹{(riskAnalysis.totalPot - riskAnalysis.lowestRiskProfit).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Player liability for this outcome</span>
              </div>

              {/* Zero-Bet Pockets Count */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Zero-Bet Pockets (100% Safe)</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-300">
                  {riskAnalysis.zeroBetNumbers.length} Pockets
                </span>
                <span className="text-[10px] text-slate-400 block mt-1 truncate">
                  e.g. {riskAnalysis.zeroBetNumbers.slice(0, 5).map(n => `#${n}`).join(', ') || 'None'}
                </span>
              </div>

            </div>

          </div>

          {/* INTERACTIVE COMPLETE ROULETTE BOARD (0-36) HEATMAP */}
          <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Real-Time Roulette Board Heatmap & Direct Pocket Selector (0–36)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Click any number on the board below to instantly force it as the round result, or inspect live straight bet volume.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-400" />
                  <span className="text-slate-300">Safe / Low Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-600 border border-amber-400" />
                  <span className="text-slate-300">Medium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-600 border border-rose-400" />
                  <span className="text-slate-300">High Liability</span>
                </div>
              </div>
            </div>

            {/* Board Layout Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[760px] flex gap-2">
                
                {/* 0 (Green) Tile */}
                {(() => {
                  const s0 = riskAnalysis.numberSummaries.find(s => s.number === 0)!;
                  const isSelected = selectedManualNumber === 0 && isManualOverrideEnabled;
                  const isRecommended = riskAnalysis.lowestRiskNumber === 0;
                  const lucky0 = resolvedLightningNumbers.find(l => l.number === 0);

                  return (
                    <button
                      onClick={() => handleSelectManualNumber(0)}
                      className={`w-16 rounded-2xl flex flex-col items-center justify-center p-2.5 transition-all cursor-pointer relative group ${
                        lucky0 ? 'animate-lightning-blink border-2 border-amber-300' : ''
                      } ${
                        isSelected 
                          ? 'bg-amber-400 text-slate-950 ring-4 ring-yellow-300 scale-105 z-10'
                          : isRecommended
                          ? 'bg-emerald-700 hover:bg-emerald-600 text-white ring-2 ring-emerald-400'
                          : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/40'
                      }`}
                    >
                      {lucky0 && (
                        <span className="absolute -top-2.5 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase shadow-md animate-multiplier-blink flex items-center gap-0.5 z-20 border border-white">
                          ⚡{lucky0.multiplier}X
                        </span>
                      )}
                      {isRecommended && !lucky0 && (
                        <span className="absolute -top-2 px-1.5 py-0.2 rounded-full bg-yellow-400 text-slate-950 text-[8px] font-black uppercase">
                          LOW RISK
                        </span>
                      )}
                      <span className="text-2xl font-black">0</span>
                      <span className="text-[10px] font-bold mt-1">₹{s0.straightBetAmount}</span>
                      <span className="text-[9px] opacity-80">{s0.userCount} users</span>
                      <span className={`text-[9px] font-black mt-1 ${s0.netHouseProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {s0.netHouseProfit >= 0 ? `+₹${s0.netHouseProfit}` : `-₹${Math.abs(s0.netHouseProfit)}`}
                      </span>
                    </button>
                  );
                })()}

                {/* Grid 1 to 36 (3 Rows x 12 Columns) */}
                <div className="flex-1 grid grid-rows-3 grid-flow-col gap-2">
                  {[
                    // Row 1: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
                    3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36,
                    // Row 2: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
                    2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35,
                    // Row 3: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
                    1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
                  ].map((num) => {
                    const sum = riskAnalysis.numberSummaries.find(s => s.number === num)!;
                    const isRed = RED_NUMBERS_SET.has(num);
                    const isSelected = selectedManualNumber === num && isManualOverrideEnabled;
                    const isRecommended = riskAnalysis.lowestRiskNumber === num;
                    const luckyHit = resolvedLightningNumbers.find(l => l.number === num);

                    return (
                      <button
                        key={num}
                        onClick={() => handleSelectManualNumber(num)}
                        className={`h-20 rounded-2xl flex flex-col items-center justify-center p-1.5 transition-all cursor-pointer relative group border ${
                          luckyHit ? 'animate-lightning-blink border-2 border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.85)]' : ''
                        } ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 ring-4 ring-yellow-300 scale-105 z-10 font-black'
                            : isRecommended
                            ? 'bg-emerald-900/90 text-white ring-2 ring-emerald-400 border-emerald-400'
                            : isRed
                            ? 'bg-rose-950/80 hover:bg-rose-900/90 text-rose-100 border-rose-800/60'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-100 border-slate-800'
                        }`}
                      >
                        {luckyHit && (
                          <span className="absolute -top-2.5 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase shadow-md animate-multiplier-blink flex items-center gap-0.5 z-20 border border-white">
                            ⚡{luckyHit.multiplier}X
                          </span>
                        )}
                        {isRecommended && !luckyHit && (
                          <span className="absolute -top-2 px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 text-[8px] font-black uppercase shadow">
                            MAX PROFIT
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${isRed ? 'bg-rose-500' : 'bg-slate-400'}`} />
                          <span className="text-xl font-black">{num}</span>
                        </div>

                        <span className="text-[10px] font-bold text-amber-300 leading-tight">
                          ₹{sum.straightBetAmount}
                        </span>

                        <span className="text-[9px] text-slate-400 leading-none">
                          {sum.userCount} {sum.userCount === 1 ? 'user' : 'users'}
                        </span>

                        <span className={`text-[9px] font-black mt-0.5 ${sum.netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {sum.netHouseProfit >= 0 ? `+₹${sum.netHouseProfit}` : `-₹${Math.abs(sum.netHouseProfit)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* Clear Override Button if active */}
            {isManualOverrideEnabled && (
              <div className="flex items-center justify-between p-3 bg-amber-950/40 rounded-2xl border border-amber-500/40">
                <span className="text-xs text-amber-300 font-bold">
                  ⚠️ Manual override active for Pocket #{selectedManualNumber}. Game will land on this exact number.
                </span>
                <button
                  onClick={handleClearManualOverride}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
                >
                  Clear & Revert to Auto
                </button>
              </div>
            )}
          </div>

          {/* CATEGORY-BASED SUMMARIES GRID */}
          <div className="space-y-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Category-Based Volume & Payout Exposure Summaries</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              
              {/* Red */}
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-2xl space-y-1">
                <span className="text-[10px] text-rose-300 font-bold uppercase block">RED</span>
                <div className="text-base font-black text-white">₹{(Number(riskAnalysis?.categorySummaries?.red?.amount) || 0).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">{riskAnalysis?.categorySummaries?.red?.users || 0} users</div>
                <div className="text-[10px] text-amber-300">Liability: ₹{riskAnalysis?.categorySummaries?.red?.exposure || 0}</div>
              </div>

              {/* Black */}
              <div className="p-3.5 bg-slate-950 border border-slate-700 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-300 font-bold uppercase block">BLACK</span>
                <div className="text-base font-black text-white">₹{(Number(riskAnalysis?.categorySummaries?.black?.amount) || 0).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">{riskAnalysis?.categorySummaries?.black?.users || 0} users</div>
                <div className="text-[10px] text-amber-300">Liability: ₹{riskAnalysis?.categorySummaries?.black?.exposure || 0}</div>
              </div>

              {/* Even */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-indigo-300 font-bold uppercase block">EVEN</span>
                <div className="text-base font-black text-white">₹{(Number(riskAnalysis?.categorySummaries?.even?.amount) || 0).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">{riskAnalysis?.categorySummaries?.even?.users || 0} users</div>
                <div className="text-[10px] text-amber-300">Liability: ₹{riskAnalysis?.categorySummaries?.even?.exposure || 0}</div>
              </div>

              {/* Odd */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-indigo-300 font-bold uppercase block">ODD</span>
                <div className="text-base font-black text-white">₹{(Number(riskAnalysis?.categorySummaries?.odd?.amount) || 0).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">{riskAnalysis?.categorySummaries?.odd?.users || 0} users</div>
                <div className="text-[10px] text-amber-300">Liability: ₹{riskAnalysis?.categorySummaries?.odd?.exposure || 0}</div>
              </div>

              {/* Low 1-18 */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-teal-300 font-bold uppercase block">LOW (1–18)</span>
                <div className="text-base font-black text-white">₹{(Number(riskAnalysis?.categorySummaries?.low?.amount) || 0).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">{riskAnalysis?.categorySummaries?.low?.users || 0} users</div>
                <div className="text-[10px] text-amber-300">Liability: ₹{riskAnalysis?.categorySummaries?.low?.exposure || 0}</div>
              </div>

              {/* High 19-36 */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-teal-300 font-bold uppercase block">HIGH (19–36)</span>
                <div className="text-base font-black text-white">₹{(Number(riskAnalysis?.categorySummaries?.high?.amount) || 0).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">{riskAnalysis?.categorySummaries?.high?.users || 0} users</div>
                <div className="text-[10px] text-amber-300">Liability: ₹{riskAnalysis?.categorySummaries?.high?.exposure || 0}</div>
              </div>

            </div>
          </div>

          {/* REAL-TIME ANALYTICS & LIVE 37-NUMBER RANKING TABLE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top 5 Highest & Lowest Volume Widgets (1 Col) */}
            <div className="space-y-4">
              
              {/* Top 5 Highest Volume */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                <h4 className="text-xs font-black text-rose-400 uppercase flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <span>Top 5 Highest Volume Numbers</span>
                </h4>
                <div className="space-y-2">
                  {[...riskAnalysis.numberSummaries]
                    .sort((a, b) => b.straightBetAmount - a.straightBetAmount)
                    .slice(0, 5)
                    .map((s, idx) => (
                      <div key={s.number} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold">#{idx + 1}</span>
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black ${
                            s.color === 'green' ? 'bg-emerald-600 text-white' : s.color === 'red' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
                          }`}>
                            {s.number}
                          </span>
                          <span className="text-slate-300">{s.userCount} users</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">₹{s.straightBetAmount}</div>
                          <div className="text-[10px] text-rose-400">Exp: ₹{s.totalPayoutIfLands}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Top 5 Lowest Volume */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                <h4 className="text-xs font-black text-emerald-400 uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Top 5 Safest (Lowest Exposure)</span>
                </h4>
                <div className="space-y-2">
                  {[...riskAnalysis.numberSummaries]
                    .sort((a, b) => a.totalPayoutIfLands - b.totalPayoutIfLands)
                    .slice(0, 5)
                    .map((s, idx) => (
                      <div key={s.number} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold">#{idx + 1}</span>
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black ${
                            s.color === 'green' ? 'bg-emerald-600 text-white' : s.color === 'red' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
                          }`}>
                            {s.number}
                          </span>
                          <span className="text-slate-300">{s.userCount} users</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">+₹{s.netHouseProfit}</div>
                          <div className="text-[10px] text-slate-400">Exp: ₹{s.totalPayoutIfLands}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

            </div>

            {/* Complete 37-Number Liability & Ranking Table (2 Cols) */}
            <div className="lg:col-span-2 p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-amber-400" />
                    <span>Complete 37-Pocket Operational Liability & Profit Table</span>
                  </h4>
                  <span className="text-xs text-slate-400">All numbers 0 to 36 sorted by risk & profit</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Sort By:</span>
                  <select
                    value={riskTableSort}
                    onChange={(e) => setRiskTableSort(e.target.value as any)}
                    className="bg-slate-950 text-amber-300 border border-slate-800 rounded-xl px-2.5 py-1 text-xs outline-none cursor-pointer"
                  >
                    <option value="profit_desc">Max House Profit (Lowest Risk)</option>
                    <option value="profit_asc">Min Profit (Highest Exposure)</option>
                    <option value="bets_desc">Highest Straight Wagers</option>
                    <option value="number_asc">Number Order (0-36)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Pocket</th>
                      <th className="p-2.5">Straight Wagers</th>
                      <th className="p-2.5">Users</th>
                      <th className="p-2.5">Payout Liability</th>
                      <th className="p-2.5">Net House Profit</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {sortedNumbersList.map((s) => {
                      const isRecommended = riskAnalysis.lowestRiskNumber === s.number;
                      const isSelected = selectedManualNumber === s.number && isManualOverrideEnabled;

                      return (
                        <tr key={s.number} className={`hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-amber-500/10' : isRecommended ? 'bg-emerald-500/5' : ''
                        }`}>
                          <td className="p-2.5 flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                              s.color === 'green' ? 'bg-emerald-600 text-white' : s.color === 'red' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
                            }`}>
                              {s.number}
                            </span>
                            {isRecommended && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black">
                                LOWEST RISK
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 font-bold text-white">
                            ₹{s.straightBetAmount.toLocaleString('en-IN')}
                          </td>

                          <td className="p-2.5 text-slate-400">
                            {s.userCount}
                          </td>

                          <td className="p-2.5 text-amber-300 font-bold">
                            ₹{s.totalPayoutIfLands.toLocaleString('en-IN')}
                          </td>

                          <td className={`p-2.5 font-black ${s.netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {s.netHouseProfit >= 0 ? `+₹${s.netHouseProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(s.netHouseProfit).toLocaleString('en-IN')}`}
                          </td>

                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => handleSelectManualNumber(s.number)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-black rounded-lg border border-slate-700 text-[10px] transition-all cursor-pointer"
                            >
                              Force #{s.number}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* USER PANEL SYNCHRONIZED RESULTS FEED (0-SEC REAL-TIME OUTCOME SYNC)       */}
          {/* ========================================================================= */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-emerald-400" />
                    <span>ইউজার প্যানেল সিঙ্কড রেজাল্ট স্ট্রিম (0-Sec Real-Time Results Feed)</span>
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ইউজার স্ক্রিনের সাথে রিয়েল-টাইমে সেম টু সেম টাইমে রেজাল্ট ও হিস্ট্রি দেখাচ্ছে (Zero Latency)
                </p>
              </div>

              {displayLastSettledResult && (
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400">সর্বশেষ ফলাফল:</span>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white ${
                    displayLastSettledResult.color === 'green' ? 'bg-emerald-600' : displayLastSettledResult.color === 'red' ? 'bg-rose-600' : 'bg-slate-800'
                  } ${displayLastSettledResult.multiplier && displayLastSettledResult.multiplier > 30 ? 'animate-lightning-blink ring-2 ring-amber-300' : ''}`}>
                    {displayLastSettledResult.winningNumber}
                  </span>
                  {displayLastSettledResult.multiplier && displayLastSettledResult.multiplier > 30 && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] border border-white animate-multiplier-blink shadow-sm">
                      ⚡ {displayLastSettledResult.multiplier}X
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono font-bold">#{displayLastSettledResult.roundId}</span>
                </div>
              )}
            </div>

            {/* Results Tape (Matching User Ribbon) */}
            <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-950/80 rounded-2xl border border-slate-800 scrollbar-thin">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 shrink-0">
                RECENT:
              </span>
              {synced24x7History.length === 0 ? (
                <span className="text-xs text-slate-500 py-1 px-2">24x7 Engine Synced...</span>
              ) : (
                synced24x7History.slice(0, 15).map((r, idx) => {
                  const isGreen = r.color === 'green' || r.winningNumber === 0;
                  const isRed = r.color === 'red';
                  const hasLightningMult = r.multiplier && r.multiplier > 30;

                  return (
                    <div 
                      key={r.roundId || idx} 
                      className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-xl border shrink-0 transition-all ${
                        hasLightningMult
                          ? 'bg-amber-950/40 border-amber-400 shadow-md shadow-amber-500/20 animate-lightning-blink'
                          : idx === 0 
                          ? 'bg-slate-900 border-amber-500/50 shadow-md shadow-amber-500/10' 
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                      title={`Round #${r.roundId} | ${r.winningNumber} (${r.color}) | Multiplier: ${r.multiplier || 30}X | ${r.settledAt}`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 ${
                        isGreen ? 'bg-emerald-600' : isRed ? 'bg-rose-600' : 'bg-slate-800'
                      } ${hasLightningMult ? 'animate-lightning-blink' : ''}`}>
                        {r.winningNumber}
                      </span>

                      {hasLightningMult && (
                        <span className="text-[10px] font-black text-slate-950 bg-amber-400 border border-white px-1.5 py-0.2 rounded-md animate-multiplier-blink flex items-center gap-0.5">
                          ⚡{r.multiplier}X
                        </span>
                      )}

                      <span className="text-[9px] text-slate-400 font-mono hidden sm:inline">
                        {r.roundId ? r.roundId.slice(-4) : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ACTIVE ROUND LIGHTNING NUMBERS (লাইটিং নম্বর) LIVE DISPLAY & ADMIN CONTROL */}
          {/* ========================================================================= */}
          <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-500/30 rounded-3xl space-y-4 shadow-xl shadow-amber-500/5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black">
                    <Zap className="w-4 h-4 fill-amber-400 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white flex items-center gap-2">
                      <span>রাউন্ড #{currentRoundId} লাইটিং নম্বর (Lightning Multipliers)</span>
                      {isManualLightningEnabled ? (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-md tracking-wider uppercase">
                          MANUAL OVERRIDE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-[10px] rounded-md tracking-wider uppercase">
                          AUTO SYNCED RNG
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400">
                      এই রাউন্ডে যেসব লাইটিং নম্বর আসছে তা নিচে দেখানো হচ্ছে। এডমিন চাইলে এখান থেকেই ম্যানুয়ালি লাইটিং নম্বর ও মাল্টিপ্লায়ার সেট করতে পারেন।
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {isManualLightningEnabled && (
                  <button
                    onClick={handleResetAutoLightning}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>অটো লাইটিং রিস্টোর</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Lightning Numbers Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>বর্তমানে সক্রিয় লাইটিং নম্বরসমূহ ({resolvedLightningNumbers.length} Lucky Numbers):</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {roundPhase === 'betting' ? `কাউন্টডাউন চলছে (${roundCountdown}s)` : `ফেজ: ${roundPhase.toUpperCase()}`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {resolvedLightningNumbers.map((item, idx) => {
                  const color = getRouletteNumberColor(item.number);
                  return (
                    <div 
                      key={`${item.number}-${idx}`}
                      className="p-3 bg-slate-950/90 border-2 border-amber-400 rounded-2xl flex items-center justify-between gap-2 shadow-[0_0_15px_rgba(245,158,11,0.4)] relative overflow-hidden group hover:border-amber-300 transition-all animate-lightning-blink"
                    >
                      <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/20 rounded-full blur-lg pointer-events-none"></div>
                      
                      <div className="flex items-center gap-2.5">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md ${
                          color === 'green' ? 'bg-emerald-600' : color === 'red' ? 'bg-rose-600' : 'bg-slate-800'
                        }`}>
                          {item.number}
                        </span>
                        <div>
                          <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                            {color}
                          </div>
                          <div className="text-[9px] text-slate-300 font-mono font-bold">
                            Pocket #{item.number}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1 border border-white animate-multiplier-blink">
                          <Zap className="w-3.5 h-3.5 fill-slate-950" />
                          <span>{item.multiplier}X</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Admin Manual Lightning Setting Control Box */}
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-white">
                    ম্যানুয়াল লাইটিং নম্বর কনফিগারেশন (Manual Lightning Builder)
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold">কুইক প্রিসেট:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetLightning('random')}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    🎲 3 Random
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetLightning('max500')}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    ⚡ Triple 500x
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetLightning('vip')}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    👑 VIP Storm (4 Nums)
                  </button>
                </div>
              </div>

              {/* Add Custom Lightning Number Form */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Number Select */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-slate-400 font-bold">নম্বর (0-36):</label>
                  <select
                    value={draftNumberInput}
                    onChange={(e) => setDraftNumberInput(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {Array.from({ length: 37 }, (_, i) => (
                      <option key={i} value={i}>
                        #{i} ({getRouletteNumberColor(i).toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multiplier Select */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-slate-400 font-bold">মাল্টিপ্লায়ার:</label>
                  <select
                    value={draftMultiplierInput}
                    onChange={(e) => setDraftMultiplierInput(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 text-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-black focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {LIGHTNING_MULTIPLIERS_LIST.map((m) => (
                      <option key={m} value={m}>
                        ⚡ {m}x
                      </option>
                    ))}
                  </select>
                </div>

                {/* Add to Draft Button */}
                <button
                  type="button"
                  onClick={() => handleAddLightningDraft(draftNumberInput, draftMultiplierInput)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নম্বর যোগ করুন</span>
                </button>
              </div>

              {/* Draft List & Save Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-bold">কনফিগার করা নম্বর:</span>
                  {customLightningDraft.length === 0 ? (
                    <span className="text-xs text-slate-500">কোনো নম্বর সিলেক্ট করা নেই</span>
                  ) : (
                    customLightningDraft.map((item) => {
                      const color = getRouletteNumberColor(item.number);
                      return (
                        <span
                          key={item.number}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-amber-500/40 rounded-xl text-xs"
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center font-black text-[10px] text-white ${
                            color === 'green' ? 'bg-emerald-600' : color === 'red' ? 'bg-rose-600' : 'bg-slate-800'
                          }`}>
                            {item.number}
                          </span>
                          <span className="font-black text-amber-300">⚡{item.multiplier}x</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLightningDraft(item.number)}
                            className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyManualLightning()}
                    disabled={customLightningDraft.length === 0}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>ম্যানুয়াল লাইটিং সেভ ও প্রয়োগ করুন</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LIVE TRANSACTION FEED (Real-Time Wagers Stream) */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Live Transaction Feed ({currentRoundBets.length} Incoming Wagers)</span>
              </h4>
              <span className="text-xs text-slate-400">Auto-streaming live from user tables</span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-800 rounded-2xl p-2 bg-slate-950/60">
              {currentRoundBets.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Waiting for incoming player wagers in round #{currentRoundId}...
                </div>
              ) : (
                currentRoundBets.map((bet) => (
                  <div key={bet.id} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-black text-xs shrink-0">
                        ₹
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{bet.userName || 'Player'}</span>
                          <span className="text-[10px] text-slate-400">({bet.userEmail || bet.userId})</span>
                        </div>
                        <span className="text-[11px] text-amber-300 font-bold">{bet.label}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-white">₹{Number(bet.amount).toLocaleString('en-IN')}</div>
                      <div className="text-[9px] text-slate-400">{bet.timestamp || 'Live'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTORICAL ANALYTICS & RECHARTS */}
      {/* ========================================================================= */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6 font-mono">
          
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Profit / Loss Trends AreaChart */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Round House Profit / Loss Trends</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitHistoryChartData}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="round" stroke="#64748b" textAnchor="end" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#profitGrad)" name="Net House Profit (₹)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Winning Number Hit Frequency BarChart */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-400" />
                <span>Winning Number Hit Distribution (0–36)</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={numberHitFrequencyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="number" stroke="#64748b" tick={{ fontSize: 8 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Hits Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Past Rounds History Table */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Past Rounds Archive & Outcome Log</span>
              </h3>

              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Search by Round ID or Number..."
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none w-full sm:w-64"
              />
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Round ID</th>
                    <th className="p-3">Winning Pocket</th>
                    <th className="p-3">Attributes</th>
                    <th className="p-3">Wager Volume</th>
                    <th className="p-3">Payout</th>
                    <th className="p-3">House Profit</th>
                    <th className="p-3">Settled At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {pastRounds
                    .filter(r => {
                      if (!historySearchTerm) return true;
                      const term = historySearchTerm.toLowerCase();
                      return (r.roundId || '').toLowerCase().includes(term) || String(r.winningNumber).includes(term);
                    })
                    .map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-amber-400">{r.roundId || 'HLR-Archived'}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-lg font-black text-xs text-white ${
                            r.color === 'green' ? 'bg-emerald-600' : r.color === 'red' ? 'bg-rose-600' : 'bg-slate-800'
                          }`}>
                            #{r.winningNumber}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 uppercase text-[10px]">
                          {r.color} • {r.parity} • {r.range}
                        </td>
                        <td className="p-3 font-bold text-white">
                          ₹{(r.totalWagered || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-amber-300 font-bold">
                          ₹{(r.totalPayout || 0).toLocaleString('en-IN')}
                        </td>
                        <td className={`p-3 font-black ${(r.houseProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(r.houseProfit || 0) >= 0 ? `+₹${(r.houseProfit || 0).toLocaleString('en-IN')}` : `-₹${Math.abs(r.houseProfit || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td className="p-3 text-slate-500 text-[10px]">
                          {r.settledAt ? new Date(r.settledAt).toLocaleTimeString('en-IN') : 'Completed'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RTP & CASINO MATH SETTINGS */}
      {/* ========================================================================= */}
      {activeSubTab === 'rtp_settings' && (
        <div className="space-y-6 font-mono">
          
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <Percent className="w-4 h-4 text-emerald-400" />
                  Target RTP %
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">Return to Player</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400 tracking-tight">
                  {config.rtpPercentage.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">payout rate</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full mt-3 overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, config.rtpPercentage)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  House Edge %
                </span>
                <span className="text-[10px] text-amber-400 font-bold">Casino Retention</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400 tracking-tight">
                  {config.houseEdgePercentage.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">net hold</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full mt-3 overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, config.houseEdgePercentage * 2.5)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg col-span-1 sm:col-span-2">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Algorithm Mode
                </span>
              </div>
              <div className="text-base font-black text-purple-300 truncate">
                {config.rtpMode === 'european_standard' && 'European Standard (97.3%)'}
                {config.rtpMode === 'dynamic_rtp' && 'Dynamic RTP Balancing'}
                {config.rtpMode === 'house_protect' && 'House Edge Protection'}
                {config.rtpMode === 'manual_next_number' && 'Manual Pocket Override'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {config.rtpMode === 'european_standard' && 'Natural physics pseudo-random RNG'}
                {config.rtpMode === 'dynamic_rtp' && `Actively balances to ${config.rtpPercentage}% RTP`}
                {config.rtpMode === 'house_protect' && `Guarantees ${config.houseEdgePercentage}% House Retention`}
                {config.rtpMode === 'manual_next_number' && `Forced Next Pocket: #${config.manualNextNumber}`}
              </p>
            </div>

          </div>

          {/* RTP & House Edge Sliders */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-6">
            <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-amber-400" />
              <span>Interactive RTP & House Margin Controls</span>
            </h3>

            {/* RTP Control (Slider + Precision Input) */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-white block">Return to Player (RTP Percentage)</span>
                  <span className="text-[10px] text-slate-400">Configurable range: 0.0% – 99.5%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="99.5"
                    step="0.1"
                    value={config.rtpPercentage}
                    onChange={(e) => handleRtpChange(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-900 border border-emerald-500/40 rounded-xl px-2.5 py-1 text-emerald-400 font-black text-right text-sm outline-none"
                  />
                  <span className="font-bold text-emerald-400 text-xs">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="99.5"
                step="0.1"
                value={config.rtpPercentage}
                onChange={(e) => handleRtpChange(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0.0% (Zero Payout)</span>
                <span>50.0%</span>
                <span>80.0%</span>
                <span>97.3% (European Standard)</span>
                <span>99.5% (Max RTP)</span>
              </div>
            </div>

            {/* House Edge Control (Slider + Precision Input) */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-white block">House Edge Margin (Casino Retention)</span>
                  <span className="text-[10px] text-slate-400">Configurable range: 0.5% – 100.0%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.1"
                    value={config.houseEdgePercentage}
                    onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value) || 0.5)}
                    className="w-20 bg-slate-900 border border-amber-500/40 rounded-xl px-2.5 py-1 text-amber-400 font-black text-right text-sm outline-none"
                  />
                  <span className="font-bold text-amber-400 text-xs">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.5"
                max="100"
                step="0.1"
                value={config.houseEdgePercentage}
                onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0.5% (Min Margin)</span>
                <span>2.7% (European Standard)</span>
                <span>20.0%</span>
                <span>50.0%</span>
                <span>100.0% (Total Retention)</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="pt-2">
              <span className="text-xs text-slate-400 block mb-2 font-bold">Standard Presets:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => handleApplyPreset(97.3, 'european_standard', 'European Standard (97.3%)')}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left cursor-pointer transition-all"
                >
                  <div className="text-xs font-black text-white">European Std</div>
                  <div className="text-[10px] text-emerald-400">97.3% RTP • 2.7% Edge</div>
                </button>

                <button
                  onClick={() => handleApplyPreset(94.74, 'dynamic_rtp', 'American Dual Zero (94.7%)')}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left cursor-pointer transition-all"
                >
                  <div className="text-xs font-black text-white">American Std</div>
                  <div className="text-[10px] text-amber-400">94.7% RTP • 5.3% Edge</div>
                </button>

                <button
                  onClick={() => handleApplyPreset(85.0, 'house_protect', 'High House Edge (85%)')}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left cursor-pointer transition-all"
                >
                  <div className="text-xs font-black text-white">High Margin</div>
                  <div className="text-[10px] text-rose-400">85.0% RTP • 15.0% Edge</div>
                </button>

                <button
                  onClick={() => handleApplyPreset(70.0, 'house_protect', 'VIP House Shield (70%)')}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left cursor-pointer transition-all"
                >
                  <div className="text-xs font-black text-white">Max Retention</div>
                  <div className="text-[10px] text-purple-400">70.0% RTP • 30.0% Edge</div>
                </button>
              </div>
            </div>

            {/* Min / Max Bet Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Minimum Bet per Spot (₹)</label>
                <input
                  type="number"
                  value={config.minBet}
                  onChange={(e) => setConfig({ ...config, minBet: parseInt(e.target.value) || 20 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Maximum Bet Limit per Round (₹)</label>
                <input
                  type="number"
                  value={config.maxBet}
                  onChange={(e) => setConfig({ ...config, maxBet: parseInt(e.target.value) || 50000 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Opposite Bet Restriction Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono text-white block">Opposite Bet Restriction</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    config.preventOppositeBets !== false ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {config.preventOppositeBets !== false ? 'RESTRICTED' : 'ALLOWED'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Disallow Red & Black, Even & Odd, 1-18 & 19-36, and all 3 Columns/Dozens (Tiers) simultaneously</span>
              </div>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, preventOppositeBets: prev.preventOppositeBets === false }))}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  config.preventOppositeBets !== false ? 'bg-rose-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-all absolute top-1 ${
                    config.preventOppositeBets !== false ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Save Config Button */}
            <div className="pt-4">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>SAVING CONFIGURATION TO FIRESTORE...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SAVE ALL ROULETTE SETTINGS</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
