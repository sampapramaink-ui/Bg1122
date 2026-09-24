import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Zap, RefreshCw, Save, CheckCircle2, AlertTriangle, 
  Crown, Play, Layers, RotateCcw, TrendingUp, DollarSign, Award,
  Users, Eye, Search, Filter, Radio, Clock, Trash2, ShieldAlert,
  Target, Percent, ArrowRight, Sparkles, Coins
} from 'lucide-react';
import { AndarBaharConfig, AndarBaharRound, AndarBaharBet, AndarBaharSide, CardRank } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { DEFAULT_ANDAR_BAHAR_CONFIG, RANKS, getUniversalAndarBaharTimeState, UniversalAndarBaharTimeState, getSyncedAndarBaharRoadHistory } from '../../utils/andarBahar';
import { soundFx } from '../../utils/audio';
import { generatePermanentUserCode } from '../../utils/databaseSync';
import { 
  AndarBaharLiveBetItem, 
  analyzeAndarBaharLiveBets, 
  AndarBaharRiskAnalysis 
} from '../../utils/andarBaharRiskEngine';

export const AdminAndarBaharManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'rounds' | 'bets'>('monitor');

  const [config, setConfig] = useState<AndarBaharConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_andar_bahar_config');
      return cached ? { ...DEFAULT_ANDAR_BAHAR_CONFIG, ...JSON.parse(cached) } : DEFAULT_ANDAR_BAHAR_CONFIG;
    } catch {
      return DEFAULT_ANDAR_BAHAR_CONFIG;
    }
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live Round State & Universal Synced Clock
  const [currentRoundId, setCurrentRoundId] = useState<string>('AB-LIVE');
  const [roundPhase, setRoundPhase] = useState<'betting' | 'dealing' | 'settling' | 'completed'>('betting');
  const [roundCountdown, setRoundCountdown] = useState<number>(15);
  const [currentJokerRank, setCurrentJokerRank] = useState<string>('K');
  const [universalTimeState, setUniversalTimeState] = useState<UniversalAndarBaharTimeState | null>(null);
  const lastSavedRoundRef = useRef<string>('');

  // Live Bets Stream & Controls
  const [liveBets, setLiveBets] = useState<AndarBaharLiveBetItem[]>([]);
  const [isAutoLowRiskActive, setIsAutoLowRiskActive] = useState<boolean>(true);
  const [isManualOverrideEnabled, setIsManualOverrideEnabled] = useState<boolean>(false);
  const [selectedForcedWinner, setSelectedForcedWinner] = useState<AndarBaharSide | 'random'>('random');

  // Real-time Bet Limits Input State (0s delay sync)
  const [inputMinBet, setInputMinBet] = useState<number>(config.minBet || 50);
  const [inputMaxBet, setInputMaxBet] = useState<number>(config.maxBet || 15000000);

  // History & Table States
  const [recentRounds, setRecentRounds] = useState<AndarBaharRound[]>([]);
  const [recentBets, setRecentBets] = useState<AndarBaharBet[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveSearchQuery, setLiveSearchQuery] = useState<string>('');

  // Previous 15 Rounds Road History (Mirrored 1:1 with User Panel)
  const [selectedRoadItem, setSelectedRoadItem] = useState<{ id: string; winner: AndarBaharSide; cardsCount: number; rank: string } | null>(null);

  const roadHistory = useMemo(() => {
    const curIdx = universalTimeState?.roundIndex ?? getUniversalAndarBaharTimeState().roundIndex;
    const synced = getSyncedAndarBaharRoadHistory(curIdx, 20);
    if (recentRounds && recentRounds.length > 0) {
      const dbMap = new Map<string, AndarBaharRound>();
      recentRounds.forEach(r => {
        const rId = r.id || (r as any).roundId;
        if (rId && r.winningSide) dbMap.set(rId, r);
      });
      return synced.map(s => {
        const dbMatch = dbMap.get(s.id);
        if (dbMatch && dbMatch.winningSide) {
          return {
            id: s.id,
            winner: dbMatch.winningSide,
            cardsCount: dbMatch.totalCardsDealt || s.cardsCount,
            rank: (dbMatch as any).winningCard?.rank || s.rank
          };
        }
        return s;
      });
    }
    return synced;
  }, [universalTimeState?.roundIndex, recentRounds]);

  // Chip Settings State
  const [chipValues, setChipValues] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem('bg_andar_bahar_chips');
      return cached ? JSON.parse(cached) : (config.chipValues || [10, 50, 100, 500, 1000, 5000, 25000]);
    } catch {
      return config.chipValues || [10, 50, 100, 500, 1000, 5000, 25000];
    }
  });
  const [newChipInput, setNewChipInput] = useState<string>('');
  const [savingChips, setSavingChips] = useState<boolean>(false);
  const [chipSaveSuccess, setChipSaveSuccess] = useState<boolean>(false);

  // Real-Time Risk & Liability Analysis (Scoped to current round)
  const currentRoundBets = useMemo(() => {
    const curId = currentRoundId || universalTimeState?.roundDetails?.roundId;
    if (!curId) return liveBets;
    return liveBets.filter((b) => b.roundId === curId);
  }, [liveBets, currentRoundId, universalTimeState?.roundDetails?.roundId]);

  const riskAnalysis: AndarBaharRiskAnalysis = useMemo(() => {
    return analyzeAndarBaharLiveBets(currentRoundBets, config);
  }, [currentRoundBets, config]);

  // 1. Synchronized Universal 24/7 Game Clock Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const andarStakes = riskAnalysis?.outcomes?.andar?.straightBetAmount || 0;
      const baharStakes = riskAnalysis?.outcomes?.bahar?.straightBetAmount || 0;
      const totalStakes = andarStakes + baharStakes;

      const activeForced = isManualOverrideEnabled && selectedForcedWinner !== 'random'
        ? selectedForcedWinner
        : (isAutoLowRiskActive && totalStakes > 0 && riskAnalysis.lowestRiskSide && riskAnalysis.lowestRiskSide !== 'random'
            ? riskAnalysis.lowestRiskSide
            : (config.manualForceWinner || 'random'));

      const activeConfig: AndarBaharConfig = {
        ...config,
        liveBetsAndar: andarStakes,
        liveBetsBahar: baharStakes,
        manualForceWinner: (isManualOverrideEnabled && selectedForcedWinner !== 'random') ? selectedForcedWinner : 'random',
        isManualOverride: isManualOverrideEnabled && selectedForcedWinner !== 'random',
        autoLowRiskWinner: activeForced !== 'random' ? activeForced : undefined,
      } as any;

      const syncState = getUniversalAndarBaharTimeState(Date.now(), activeConfig);
      setUniversalTimeState(syncState);
      setCurrentRoundId(syncState.roundDetails.roundId);
      setRoundPhase(syncState.phase);
      setRoundCountdown(syncState.countdown);
      if (syncState.roundDetails?.jokerCard?.rank) {
        setCurrentJokerRank(syncState.roundDetails.jokerCard.rank);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [config, isManualOverrideEnabled, selectedForcedWinner, isAutoLowRiskActive, riskAnalysis]);

  // 2. Real-Time Firestore Listeners
  useEffect(() => {
    // Config listener
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'andar_bahar'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (Array.isArray(data.chipValues) && data.chipValues.length > 0) {
          setChipValues(data.chipValues);
        }
        setConfig((prev) => ({
          ...prev,
          chipValues: Array.isArray(data.chipValues) && data.chipValues.length > 0 ? data.chipValues : prev.chipValues,
          isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled,
          minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
          maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
          andarMultiplier: data.multiplierPrimary !== undefined ? data.multiplierPrimary : (data.andarMultiplier || prev.andarMultiplier),
          baharMultiplier: data.multiplierSecondary !== undefined ? data.multiplierSecondary : (data.baharMultiplier || prev.baharMultiplier),
          rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
          houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
          rtpMode: data.rtpMode || prev.rtpMode,
          manualForceWinner: data.manualForceTarget || data.manualForceWinner || prev.manualForceWinner,
          manualJokerRank: data.manualJokerRank || prev.manualJokerRank,
          preventBothAndarBaharBet: data.preventBothAndarBaharBet !== undefined ? data.preventBothAndarBaharBet : prev.preventBothAndarBaharBet,
        }));
      }
    }, (err) => console.warn('Admin Andar Bahar game_settings listener notice:', err.message));

    // Live State listener
    const unsubLiveState = onSnapshot(doc(db, 'andar_bahar_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (Array.isArray(data.chipValues) && data.chipValues.length > 0) {
          setChipValues(data.chipValues);
        }
        setIsAutoLowRiskActive(data.isAutoLowRiskActive !== false);
        setIsManualOverrideEnabled(!!data.isManualOverride);
        if (data.isManualOverride && data.forcedWinner) {
          setSelectedForcedWinner(data.forcedWinner);
        } else {
          setSelectedForcedWinner('random');
        }
        if (data.minBet !== undefined || data.maxBet !== undefined) {
          const nextMin = data.minBet !== undefined ? Number(data.minBet) : config.minBet || 50;
          const nextMax = data.maxBet !== undefined ? Number(data.maxBet) : config.maxBet || 15000000;
          setInputMinBet(nextMin);
          setInputMaxBet(nextMax);
          setConfig((prev) => ({
            ...prev,
            minBet: nextMin,
            maxBet: nextMax,
          }));
        }
      }
    }, (err) => console.warn('Live state listener notice:', err.message));

    // Live Bets listener
    const unsubLiveBets = onSnapshot(collection(db, 'andar_bahar_live_bets'), (snap) => {
      const items: AndarBaharLiveBetItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLiveBets(items);
    }, (err) => console.warn('Live bets listener notice:', err.message));

    // Recent rounds listener
    const qRounds = query(collection(db, 'andar_bahar_rounds'), limit(30));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const list: AndarBaharRound[] = [];
      snap.forEach((d) => list.push(d.data() as AndarBaharRound));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setRecentRounds(list);
    }, (err) => console.warn('Admin rounds listener notice:', err.message));

    // Recent bets listener
    const qBets = query(collection(db, 'andar_bahar_bets'), limit(50));
    const unsubBets = onSnapshot(qBets, (snap) => {
      const list: AndarBaharBet[] = [];
      snap.forEach((d) => list.push(d.data() as AndarBaharBet));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecentBets(list);
    }, (err) => console.warn('Admin bets listener notice:', err.message));

    return () => {
      unsubGameSettings();
      unsubLiveState();
      unsubLiveBets();
      unsubRounds();
      unsubBets();
    };
  }, []);

  // Keep live state updated when Auto Low Risk is active
  useEffect(() => {
    if (isAutoLowRiskActive && !isManualOverrideEnabled) {
      setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        isAutoLowRiskActive: true,
        isManualOverride: false,
        autoLowRiskWinner: riskAnalysis.lowestRiskSide || 'random',
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }
  }, [isAutoLowRiskActive, isManualOverrideEnabled, riskAnalysis.lowestRiskSide]);

  // Synchronized 24x7 Round Persistence
  useEffect(() => {
    if (
      universalTimeState?.phase === 'completed' &&
      universalTimeState.roundDetails.roundId &&
      lastSavedRoundRef.current !== universalTimeState.roundDetails.roundId
    ) {
      lastSavedRoundRef.current = universalTimeState.roundDetails.roundId;
      const rId = universalTimeState.roundDetails.roundId;
      const winSide = universalTimeState.roundDetails.winningSide;
      const roundDoc: AndarBaharRound = {
        id: rId,
        roundNumber: universalTimeState.roundIndex || 1,
        startTime: universalTimeState.roundStartTimeMs,
        endTime: universalTimeState.roundStartTimeMs + (universalTimeState.roundDetails.totalRoundDurationMs || 30000),
        jokerCard: universalTimeState.roundDetails.jokerCard,
        andarCards: universalTimeState.roundDetails.andarCards || [],
        baharCards: universalTimeState.roundDetails.baharCards || [],
        winningSide: winSide,
        winningCard: universalTimeState.roundDetails.winningCard,
        totalCardsDealt: universalTimeState.roundDetails.totalCardsCount || 1,
        totalBetsAndar: riskAnalysis.outcomes.andar.straightBetAmount || 0,
        totalBetsBahar: riskAnalysis.outcomes.bahar.straightBetAmount || 0,
        totalPayout: riskAnalysis.outcomes[winSide]?.totalPayoutLiability || 0,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      setDoc(doc(db, 'andar_bahar_rounds', rId), roundDoc, { merge: true }).catch(() => {});

      // Automatically reset manual override after round completes, returning immediately to Auto Low Risk
      if (isManualOverrideEnabled) {
        setIsManualOverrideEnabled(false);
        setSelectedForcedWinner('random');
        setIsAutoLowRiskActive(true);
        setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
          isManualOverride: false,
          forcedWinner: 'random',
          manualForceWinner: 'random',
          manualForceTarget: 'random',
          isAutoLowRiskActive: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'game_settings', 'andar_bahar'), {
          isManualOverride: false,
          manualForceWinner: 'random',
          manualForceTarget: 'random',
          rtpMode: 'house_protect',
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }

      // Auto clean up stale live bets from previous rounds
      getDocs(collection(db, 'andar_bahar_live_bets')).then((snap) => {
        snap.forEach((docSnap) => {
          const betData = docSnap.data();
          if (betData.roundId && betData.roundId !== rId) {
            deleteDoc(doc(db, 'andar_bahar_live_bets', docSnap.id)).catch(() => {});
          }
        });
      }).catch(() => {});
    }
  }, [universalTimeState, riskAnalysis]);

  // Handle Instant 0-second Bet Amount Limits (Min Bet / Max Bet)
  const handleUpdateBetLimits = async (minB: number, maxB: number) => {
    try {
      soundFx.playClick();
      setInputMinBet(minB);
      setInputMaxBet(maxB);

      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        minBet: minB,
        maxBet: maxB,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        minBet: minB,
        maxBet: maxB,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setConfig((prev) => ({ ...prev, minBet: minB, maxBet: maxB }));
      setStatusMessage(`🎯 আন্দার বাহার বেটিং লিমিট সেট করা হয়েছে: সর্বনিম্ন ₹${(Number(minB) || 0).toLocaleString('en-IN')} — সর্বোচ্চ ₹${(Number(maxB) || 0).toLocaleString('en-IN')} (০ সেকেন্ডের দেরিতে কার্যকর)`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      setStatusMessage(`⚠️ এরর: ${e.message}`);
    }
  };

  // 4. Pre-Result Outcome Calculation (0s Latency Advance Prediction Engine)
  const preResult = useMemo(() => {
    let outcomeWinner: AndarBaharSide = 'andar';
    let outcomeReason = 'RTP Engine (Fair RNG)';
    const jokerCard = universalTimeState?.roundDetails?.jokerCard;
    const winningCard = universalTimeState?.roundDetails?.winningCard;

    if (isManualOverrideEnabled && selectedForcedWinner !== 'random') {
      outcomeWinner = selectedForcedWinner;
      outcomeReason = `Admin 0s Manual Force (${selectedForcedWinner.toUpperCase()})`;
    } else if (isAutoLowRiskActive && riskAnalysis.lowestRiskSide && riskAnalysis.lowestRiskSide !== 'random') {
      outcomeWinner = riskAnalysis.lowestRiskSide;
      outcomeReason = `Auto Low-Risk AI Guard (House Protect)`;
    } else if (universalTimeState?.roundDetails?.winningSide) {
      outcomeWinner = universalTimeState.roundDetails.winningSide;
      outcomeReason = `Mathematical RTP Curve (${config.rtpPercentage || 97.2}% Fair RNG)`;
    }

    const projectedLiability = 
      riskAnalysis.outcomes[outcomeWinner]?.totalPayoutLiability || 0;

    const projectedProfit = riskAnalysis.totalPot - projectedLiability;

    return {
      winner: outcomeWinner,
      reason: outcomeReason,
      jokerCard,
      winningCard,
      projectedLiability,
      projectedProfit,
      totalPot: riskAnalysis.totalPot,
      marginPercent: riskAnalysis.totalPot > 0 ? Math.round((projectedProfit / riskAnalysis.totalPot) * 100) : 100,
    };
  }, [isManualOverrideEnabled, selectedForcedWinner, isAutoLowRiskActive, riskAnalysis, universalTimeState, config]);

  // Handle Instant 0-second Outcome Override
  const handleSetForcedWinner = async (target: AndarBaharSide | 'random') => {
    try {
      soundFx.playClick();
      setSelectedForcedWinner(target);

      const isManual = target !== 'random';
      setIsManualOverrideEnabled(isManual);
      if (isManual) {
        setIsAutoLowRiskActive(false);
      }

      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        isManualOverride: isManual,
        forcedWinner: target,
        manualForceWinner: target,
        manualForceTarget: target,
        targetRoundId: currentRoundId,
        isAutoLowRiskActive: !isManual,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        manualForceTarget: target,
        manualForceWinner: target,
        forcedWinner: target,
        isManualOverride: isManual,
        rtpMode: isManual ? 'manual_force_winner' : 'house_protect',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMessage(isManual ? `🎯 Forced Winner set to ${target.toUpperCase()} (0s delay applied)` : '🎲 Reset to Auto Anti-Streak / 100% House Defense mode');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      console.error('Failed to set forced winner:', e);
    }
  };

  // Handle Auto Low-Risk Toggle
  const handleToggleAutoLowRisk = async () => {
    try {
      soundFx.playClick();
      const nextState = !isAutoLowRiskActive;
      setIsAutoLowRiskActive(nextState);
      if (nextState) {
        setIsManualOverrideEnabled(false);
        setSelectedForcedWinner('random');
      }

      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        isAutoLowRiskActive: nextState,
        isManualOverride: false,
        forcedWinner: 'random',
        autoLowRiskWinner: 'random',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        rtpMode: nextState ? 'house_protect' : 'fair_rng',
        manualForceTarget: 'random',
        isManualOverride: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMessage(nextState ? '🛡️ Auto Low-Risk Maximum House Profit Mode ACTIVE' : '⚠️ Auto Low-Risk Mode Disabled');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      console.error('Failed to toggle auto low risk:', e);
    }
  };

  // Real-Time House Edge (0 to 99.9%) Change
  const handleHouseEdgeChange = async (edge: number) => {
    const clampedEdge = Math.max(0, Math.min(99.9, Math.round(edge * 10) / 10));
    const rtp = Math.round((100 - clampedEdge) * 10) / 10;

    setConfig((prev) => ({
      ...prev,
      houseEdgePercentage: clampedEdge,
      rtpPercentage: rtp,
    }));

    try {
      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        houseEdgePercentage: clampedEdge,
        rtpPercentage: rtp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        houseEdgePercentage: clampedEdge,
        rtpPercentage: rtp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync house edge:', e);
    }
  };

  // Clear live bets table
  const handleClearLiveBets = async () => {
    if (!confirm('Clear all live bets from monitoring stream? (This does not affect user balances)')) return;
    try {
      soundFx.playClick();
      for (const b of liveBets) {
        await deleteDoc(doc(db, 'andar_bahar_live_bets', b.id)).catch(() => {});
      }
      setLiveBets([]);
      setStatusMessage('🧹 Live bets monitoring cleared.');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (e: any) {
      console.error('Failed to clear live bets:', e);
    }
  };

  // Save Full Config to Firestore
  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      soundFx.playClick();
      const rtp = typeof config.rtpPercentage === 'number' ? config.rtpPercentage : 96.8;
      const houseEdge = typeof config.houseEdgePercentage === 'number' ? config.houseEdgePercentage : Math.round((100 - rtp) * 10) / 10;
      const payload: AndarBaharConfig = {
        ...config,
        rtpPercentage: rtp,
        houseEdgePercentage: houseEdge,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      };
      
      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        isEnabled: payload.isEnabled,
        minBet: payload.minBet,
        maxBet: payload.maxBet,
        chipValues: chipValues,
        rtpPercentage: payload.rtpPercentage,
        houseEdgePercentage: payload.houseEdgePercentage,
        bettingDurationSeconds: payload.bettingDurationSeconds,
        multiplierPrimary: payload.andarMultiplier,
        multiplierSecondary: payload.baharMultiplier,
        andarMultiplier: payload.andarMultiplier,
        baharMultiplier: payload.baharMultiplier,
        rtpMode: payload.rtpMode,
        manualForceTarget: payload.manualForceWinner || 'random',
        manualJokerRank: payload.manualJokerRank || 'random',
        preventBothAndarBaharBet: payload.preventBothAndarBaharBet !== undefined ? payload.preventBothAndarBaharBet : true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'andar_bahar_config', 'main'), { ...payload, chipValues }, { merge: true });
      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), { chipValues }, { merge: true });
      localStorage.setItem('bg_andar_bahar_config', JSON.stringify({ ...payload, chipValues }));
      localStorage.setItem('bg_andar_bahar_chips', JSON.stringify(chipValues));
      setSaveSuccess(true);
      soundFx.playWin();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save Andar Bahar config:', e);
      alert('Error saving configuration to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Instant 0-second Save for Chip Settings
  const handleSaveChips = async (chipsToSave = chipValues) => {
    setSavingChips(true);
    setChipSaveSuccess(false);
    try {
      soundFx.playClick();
      const validChips = chipsToSave
        .map(v => Math.max(1, Math.round(Number(v) || 0)))
        .filter(v => v > 0)
        .sort((a, b) => a - b);
      
      const finalChips = validChips.length > 0 ? validChips : [10, 50, 100, 500, 1000, 5000, 25000];
      setChipValues(finalChips);

      // Instant 0-second sync across all Firestore listeners
      await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
        chipValues: finalChips,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'andar_bahar_live_state', 'current_round'), {
        chipValues: finalChips,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'andar_bahar_config', 'main'), {
        chipValues: finalChips,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      localStorage.setItem('bg_andar_bahar_chips', JSON.stringify(finalChips));
      setConfig(prev => ({ ...prev, chipValues: finalChips }));
      setChipSaveSuccess(true);
      soundFx.playWin();
      setStatusMessage('🪙 Chips updated and synced to user panel in 0 seconds!');
      setTimeout(() => {
        setChipSaveSuccess(false);
        setStatusMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to save chip values:', err);
      alert('Error saving chips to Firestore.');
    } finally {
      setSavingChips(false);
    }
  };

  const handleAddChip = () => {
    const val = parseInt(newChipInput.trim(), 10);
    if (!isNaN(val) && val > 0 && !chipValues.includes(val)) {
      soundFx.playClick();
      const updated = [...chipValues, val].sort((a, b) => a - b);
      setChipValues(updated);
      setNewChipInput('');
    }
  };

  const handleRemoveChip = (indexToRemove: number) => {
    if (chipValues.length <= 1) {
      alert('কমপক্ষে ১টি চিপ থাকতে হবে!');
      return;
    }
    soundFx.playClick();
    const updated = chipValues.filter((_, idx) => idx !== indexToRemove);
    setChipValues(updated);
  };

  const handleChipChange = (index: number, val: number) => {
    const updated = [...chipValues];
    updated[index] = val;
    setChipValues(updated);
  };

  const handleApplyPresetChips = (preset: number[]) => {
    soundFx.playClick();
    setChipValues(preset);
  };

  const filteredLiveBets = liveBets.filter((b) => {
    const q = liveSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const uCode = (generatePermanentUserCode(undefined, undefined, b.userId)).toLowerCase();
    return (
      (b.userName || '').toLowerCase().includes(q) ||
      (b.userId || '').toLowerCase().includes(q) ||
      (b.spot || '').toLowerCase().includes(q) ||
      uCode.includes(q.replace('#', ''))
    );
  });

  const filteredBets = recentBets.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const cleanNumericQ = q.replace(/^[#\s]+/, '').trim();
    const uCode = (generatePermanentUserCode(undefined, undefined, b.userId)).toLowerCase();
    return (
      !q ||
      (b.userName || '').toLowerCase().includes(q) ||
      (b.roundId || '').toLowerCase().includes(q) ||
      (b.userId || '').toLowerCase().includes(q) ||
      (cleanNumericQ && (b.userId || '').toLowerCase().includes(cleanNumericQ)) ||
      uCode === cleanNumericQ ||
      uCode.includes(cleanNumericQ) ||
      (cleanNumericQ && `#${uCode}`.includes(q))
    );
  });

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* HEADER BAR */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-mono tracking-wider text-white">
                ANDAR BAHAR LIVE RISK CONTROLLER
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black border ${
                config.isEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {config.isEnabled ? '0s LIVE ACTIVE' : 'MAINTENANCE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live Bet Monitoring • 0% - 99.9% House Edge • Instant 0s Result Overrides
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'monitor' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Live Monitor & Risk</span>
            {liveBets.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] bg-red-500 text-white font-black rounded-full">
                {liveBets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'config' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Game Math & Limits
          </button>
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rounds' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rounds ({recentRounds.length})
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bets' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bets Ledger ({recentBets.length})
          </button>
        </div>
      </div>

      {/* STATUS TOAST NOTIFICATION */}
      {statusMessage && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl text-amber-300 text-xs font-mono font-bold flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* TAB 1: LIVE MONITOR & 0S RISK CONTROLS */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">

          {/* SYNCHRONIZED UNIVERSAL LIVE ROUND BAR */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-xl">
                🃏
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase">Synchronized Round:</span>
                  <span className="text-sm font-black text-amber-300">{currentRoundId}</span>
                  <span className="text-xs text-slate-500 font-bold">(Joker: {currentJokerRank})</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    roundPhase === 'betting' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse' :
                    roundPhase === 'dealing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {roundPhase.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{roundCountdown}s</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Live Pot & Bettors Summary */}
            <div className="flex items-center gap-3 sm:gap-6 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Live Pot</span>
                <span className="text-base font-black text-white">₹{(Number(riskAnalysis?.totalPot) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Active Bets</span>
                <span className="text-base font-black text-amber-400">{riskAnalysis?.totalBetsCount || 0}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Players</span>
                <span className="text-base font-black text-cyan-400">{riskAnalysis?.uniqueUsersCount || 0}</span>
              </div>
            </div>
          </div>

          {/* === PREVIOUS 15 ROUNDS ROAD BEADS (EXACT USER PANEL DESIGN) === */}
          <div className="px-4 py-3 bg-[#1a080f] border border-white/10 rounded-3xl flex flex-wrap items-center justify-between gap-3 font-mono shadow-xl">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-[280px]">
              <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>পূর্ববর্তী ১৫ রাউন্ড:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                {roadHistory.slice(0, 15).map((item, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <button
                      key={`road_dot_${item.id}_${idx}`}
                      type="button"
                      onClick={() => setSelectedRoadItem(item)}
                      className={`w-6 h-6 rounded-full shrink-0 shadow-md flex items-center justify-center text-[10px] font-black text-white cursor-pointer transition-transform hover:scale-125 relative ${
                        item.winner === 'andar'
                          ? 'bg-cyan-500 ring-1 ring-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                          : 'bg-rose-500 ring-1 ring-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                      } ${isLatest ? 'ring-2 ring-amber-300 scale-105' : ''}`}
                      title={`রাউন্ড: ${item.id} | বিজয়ী: ${item.winner.toUpperCase()} (${item.cardsCount} cards, Rank ${item.rank})`}
                    >
                      {item.winner === 'andar' ? 'A' : 'B'}
                      {isLatest && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                <span>Andar: {roadHistory.slice(0, 15).filter(r => r.winner === 'andar').length}</span>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span>Bahar: {roadHistory.slice(0, 15).filter(r => r.winner === 'bahar').length}</span>
              </span>
            </div>
          </div>

          {/* ROAD DETAIL MODAL (MATCHING USER PANEL) */}
          {selectedRoadItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
              <div className="relative w-full max-w-xs bg-[#1a080f] border border-amber-400/40 rounded-3xl p-5 text-white space-y-3 text-center shadow-[0_0_35px_rgba(255,215,0,0.3)]">
                <div className={`text-base font-black uppercase tracking-wider ${selectedRoadItem.winner === 'andar' ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {selectedRoadItem.winner === 'andar' ? 'ANDAR WON' : 'BAHAR WON'}
                </div>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1.5 font-mono text-xs text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Round ID:</span>
                    <span className="font-bold text-slate-200">{selectedRoadItem.id}</span>
                  </div>
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
                  type="button"
                  onClick={() => setSelectedRoadItem(null)}
                  className="w-full py-2.5 bg-[#00b16a] hover:bg-[#00c978] text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                >
                  CLOSE
                </button>
              </div>
            </div>
          )}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  24x7 আন্দার বাহার লাইভ মনিটর (ইউজার প্যানেলের সাথে 0s সিঙ্ক)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">লাইভ আইডি:</span>
                <span className="font-bold text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">{currentRoundId}</span>
              </div>
            </div>

            {/* Live Center Joker Card & Side Cards Dealt Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Andar Side */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'andar'
                  ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-400 shadow-lg shadow-blue-950/50'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-blue-400 uppercase">🔵 ANDAR (আন্দার)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300 font-bold">1.90x</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-slate-400">লাইভ বাজি: <strong className="text-amber-400">₹{(Number(riskAnalysis?.outcomes?.andar?.straightBetAmount) || 0).toLocaleString('en-IN')}</strong></div>
                  <div className="text-slate-400">প্লেয়ার: <strong className="text-cyan-400">{riskAnalysis?.outcomes?.andar?.userCount || 0} জন</strong></div>
                  <div className="text-slate-400">কার্ডস ডিল: <strong className="text-white">{universalTimeState?.visibleAndarCards?.length || 0} টি</strong></div>
                </div>
              </div>

              {/* Joker Card in Center */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/40 flex flex-col items-center justify-center text-center shadow-lg">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">
                  জোকার কার্ড (Joker)
                </span>
                <div className="w-14 h-20 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/50 flex flex-col items-center justify-center text-white shadow-inner my-1">
                  <span className={`text-base font-black ${
                    universalTimeState?.roundDetails?.jokerCard?.suit === 'hearts' || universalTimeState?.roundDetails?.jokerCard?.suit === 'diamonds'
                      ? 'text-red-500' : 'text-slate-100'
                  }`}>
                    {universalTimeState?.roundDetails?.jokerCard?.rank || 'K'}
                  </span>
                  <span className="text-base">
                    {universalTimeState?.roundDetails?.jokerCard?.suit === 'hearts' ? '♥' :
                     universalTimeState?.roundDetails?.jokerCard?.suit === 'diamonds' ? '♦' :
                     universalTimeState?.roundDetails?.jokerCard?.suit === 'clubs' ? '♣' : '♠'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  ম্যাচ কার্ড: <strong className="text-amber-300">{universalTimeState?.roundDetails?.jokerCard?.rank || 'K'}</strong>
                </span>
              </div>

              {/* Bahar Side */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'bahar'
                  ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-400 shadow-lg shadow-rose-950/50'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-rose-400 uppercase">🔴 BAHAR (বাহার)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/40 text-rose-300 font-bold">2.00x</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-slate-400">লাইভ বাজি: <strong className="text-amber-400">₹{(Number(riskAnalysis?.outcomes?.bahar?.straightBetAmount) || 0).toLocaleString('en-IN')}</strong></div>
                  <div className="text-slate-400">প্লেয়ার: <strong className="text-cyan-400">{riskAnalysis?.outcomes?.bahar?.userCount || 0} জন</strong></div>
                  <div className="text-slate-400">কার্ডস ডিল: <strong className="text-white">{universalTimeState?.visibleBaharCards?.length || 0} টি</strong></div>
                </div>
              </div>
            </div>

            {/* Current Phase Live Outcome Banner */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">বর্তমান অবস্থা:</span>
                {roundPhase === 'betting' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    বেটিং চলছে ({roundCountdown}s বাকি)
                  </span>
                ) : roundPhase === 'dealing' ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    কার্ড ডিল হচ্ছে... ({universalTimeState?.currentDealtCount || 0} টি কার্ড সমাপ্ত)
                  </span>
                ) : (
                  <span className="text-cyan-400 font-black flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    ফলাফল: {universalTimeState?.roundDetails?.winningSide === 'andar' ? '🔵 আন্দার জয়ী (MATCH FOUND)' : '🔴 বাহার জয়ী (MATCH FOUND)'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">24x7 Live Stream</span>
            </div>
          </div>

          {/* 2. PRE-RESULT PREDICTIVE CALCULATION ENGINE (আগাম রেজাল্ট গণনা ও প্রিভিউ - 0s Latency) */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-900 border-2 border-amber-500/40 shadow-2xl space-y-4 font-mono relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <span>⚡ আগাম রেজাল্ট গণনা ইঞ্জিন (0s Advance Prediction)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE CALCULATION
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    রেজাল্ট আসার আগেই রিয়েল-টাইম বাজি ও এলগরিদম হিসাব করে আগাম ফলাফল নির্ধারিত হয় (০ সেকেন্ড বিলম্ব)।
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">ক্যালকুলেশন স্ট্যাটাস:</span>
                <span className="text-xs font-black text-emerald-400">0s সিঙ্ক সম্পন্ন</span>
              </div>
            </div>

            {/* Predicted Winner Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">আসন্ন নিশ্চিত ফলাফল (Predicted Winner):</span>
                <div className="my-2">
                  <span className={`text-xl sm:text-2xl font-black block ${
                    preResult.winner === 'andar' ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {preResult.winner === 'andar' ? '🔵 ANDAR (আন্দার জয়ী)' : '🔴 BAHAR (বাহার জয়ী)'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block mt-1">
                    ম্যাচ কার্ড: <span className="text-amber-400 font-mono">{preResult.winningCard?.rank || preResult.jokerCard?.rank || 'K'}{preResult.winningCard?.suit === 'hearts' ? '♥' : '♠'}</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                  নির্ধারণ পদ্ধতি: <strong className="text-amber-300">{preResult.reason}</strong>
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">লাইভ পট ও পে-আউট হিসাব:</span>
                <div className="space-y-1.5 my-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">মোট সক্রিয় বাজি:</span>
                    <span className="font-bold text-white">₹{(Number(preResult?.totalPot) || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">সম্ভাব্য পে-আউট দায়:</span>
                    <span className="font-bold text-rose-400">₹{(Number(preResult?.projectedLiability) || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1">
                    <span className="text-slate-400 font-bold">হাউস নেট প্রফিট:</span>
                    <span className={`font-black ${(preResult?.projectedProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(preResult?.projectedProfit || 0) >= 0 ? '+' : ''}₹{(Number(preResult?.projectedProfit) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                  <span>হাউস মার্জিন:</span>
                  <strong className="text-emerald-400 font-bold">{preResult?.marginPercent || 100}%</strong>
                </div>
              </div>

              {/* Quick 1-Click Action to Change Predicted Result with 0s Latency */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">ফলাফল তাৎক্ষণিক পরিবর্তন (0s Latency):</span>
                <div className="grid grid-cols-2 gap-1.5 my-2">
                  <button
                    onClick={() => handleSetForcedWinner('andar')}
                    className={`py-2 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                      preResult.winner === 'andar' ? 'bg-blue-600 text-white border-white' : 'bg-blue-950/40 text-blue-300 border-blue-800/60 hover:bg-blue-900/40'
                    }`}
                  >
                    🔵 FORCE ANDAR
                  </button>
                  <button
                    onClick={() => handleSetForcedWinner('bahar')}
                    className={`py-2 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                      preResult.winner === 'bahar' ? 'bg-rose-600 text-white border-white' : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/40'
                    }`}
                  >
                    🔴 FORCE BAHAR
                  </button>
                  <button
                    onClick={handleToggleAutoLowRisk}
                    className={`py-2 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border col-span-2 ${
                      isAutoLowRiskActive ? 'bg-amber-600 text-white border-white' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🛡️ AUTO LOW-RISK (MAX HOUSE PROFIT)
                  </button>
                </div>
                <div className="text-[9px] text-slate-500 text-center">
                  ক্লিক করার সাথে সাথে প্রিভিউ ও ফলাফল আপডেট হবে।
                </div>
              </div>
            </div>
          </div>

          {/* 3. REAL-TIME BETTING LIMIT CONTROLLER (0S LATENCY SYNC) */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  আন্দার বাহার বেটিং লিমিট কন্ট্রোলার (০ সেকেন্ডে ইউজার প্যানেলে সিঙ্ক)
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                0S INSTANT BROADCAST
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Min Bet Control */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">সর্বনিম্ন বাজি (Min Bet):</span>
                  <span className="text-sm font-black text-emerald-400">₹{(Number(inputMinBet) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={inputMaxBet}
                    value={inputMinBet}
                    onChange={(e) => setInputMinBet(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    placeholder="সর্বনিম্ন বাজি"
                  />
                  <button
                    onClick={() => handleUpdateBetLimits(inputMinBet, inputMaxBet)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer whitespace-nowrap"
                  >
                    সেভ 0s
                  </button>
                </div>
                {/* Min Bet Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[10, 50, 100, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleUpdateBetLimits(amt, inputMaxBet)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        inputMinBet === amt
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Bet Control */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">সর্বোচ্চ বাজি (Max Bet):</span>
                  <span className="text-sm font-black text-amber-400">₹{(Number(inputMaxBet) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={inputMinBet}
                    value={inputMaxBet}
                    onChange={(e) => setInputMaxBet(Math.max(inputMinBet, Number(e.target.value)))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    placeholder="সর্বোচ্চ বাজি"
                  />
                  <button
                    onClick={() => handleUpdateBetLimits(inputMinBet, inputMaxBet)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black transition cursor-pointer whitespace-nowrap"
                  >
                    সেভ 0s
                  </button>
                </div>
                {/* Max Bet Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[10000, 50000, 500000, 15000000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleUpdateBetLimits(inputMinBet, amt)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                        inputMaxBet === amt
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ₹{amt >= 100000 ? `${amt / 100000}L` : `${amt / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ABNORMAL CONCENTRATION RISK BANNER */}
          {riskAnalysis.hasAbnormalConcentration && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold flex items-start gap-3 shadow-xl animate-in fade-in duration-200">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{riskAnalysis.concentrationAlertMessage}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSetForcedWinner(riskAnalysis.lowestRiskSide)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] uppercase font-black transition cursor-pointer"
                  >
                    Force Lowest Risk ({riskAnalysis.lowestRiskSide.toUpperCase()})
                  </button>
                  <button
                    onClick={handleToggleAutoLowRisk}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] uppercase font-black transition cursor-pointer"
                  >
                    Activate Auto-Protect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MASTER 0-SECOND LATENCY RISK & HOUSE EDGE CONTROLLER */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Real-Time House Edge (0% - 99.9%) & Instant Result Override</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  All adjustments write with 0-second latency to players worldwide in real-time.
                </p>
              </div>

              {/* Auto Low-Risk Toggle */}
              <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
                <div className="text-right">
                  <span className="text-xs font-black text-white block">Auto Low-Risk Mode</span>
                  <span className="text-[10px] text-slate-400">Maximize House Profit</span>
                </div>
                <button
                  onClick={handleToggleAutoLowRisk}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isAutoLowRiskActive ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  title="Auto Low Risk Mode automatically targets the lowest liability outcome"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    isAutoLowRiskActive ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* HOUSE EDGE SLIDER (0% TO 99.9%) */}
            <div className="space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  <span>House Edge Percentage (0% - 99.9%):</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">RTP: {(100 - (config.houseEdgePercentage || 3.2)).toFixed(1)}%</span>
                  <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-sm font-black">
                    {config.houseEdgePercentage || 3.2}%
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="99.9"
                step="0.1"
                value={config.houseEdgePercentage !== undefined ? config.houseEdgePercentage : 3.2}
                onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500 uppercase">Presets:</span>
                {[
                  { label: '0% (Fair 100% RTP)', val: 0 },
                  { label: '3.2% (Standard)', val: 3.2 },
                  { label: '5.0%', val: 5.0 },
                  { label: '10.0%', val: 10.0 },
                  { label: '25.0%', val: 25.0 },
                  { label: '50.0%', val: 50.0 },
                  { label: '99.9% (Max House)', val: 99.9 },
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => handleHouseEdgeChange(p.val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                      Math.abs((config.houseEdgePercentage || 3.2) - p.val) < 0.1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DIRECT 1-CLICK INSTANT OUTCOME FORCING */}
            <div className="space-y-3 font-mono border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Direct 1-Click Manual Outcome Forcing (0s Latency):</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Active Override: <strong className="text-white uppercase">{selectedForcedWinner}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { side: 'andar' as const, label: '🎴 FORCE ANDAR (IN)', color: 'border-red-600 bg-red-950/40 hover:bg-red-900/60' },
                  { side: 'bahar' as const, label: '🃏 FORCE BAHAR (OUT)', color: 'border-cyan-600 bg-cyan-950/40 hover:bg-cyan-900/60' },
                  { side: 'random' as const, label: '🎲 AUTO / FAIR RNG', color: 'border-slate-700 bg-slate-950 hover:bg-slate-800' },
                ].map((item) => {
                  const isSelected = selectedForcedWinner === item.side;
                  return (
                    <button
                      key={item.side}
                      onClick={() => handleSetForcedWinner(item.side)}
                      className={`p-3.5 rounded-2xl border text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        item.color
                      } ${isSelected ? 'ring-2 ring-white scale-[1.02] shadow-xl' : 'opacity-85'}`}
                    >
                      <span>{item.label}</span>
                      {isSelected && (
                        <span className="text-[9px] px-2 py-0.5 bg-white text-slate-950 rounded-full font-black">
                          ACTIVE OVERRIDE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* REAL-TIME SECTOR LIABILITY & RISK CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
            {(['andar', 'bahar'] as AndarBaharSide[]).map((side) => {
              const data = riskAnalysis?.outcomes?.[side] || {
                side,
                title: side === 'andar' ? 'Andar (আন্দার)' : 'Bahar (বাহার)',
                symbol: side === 'andar' ? '🎴' : '🃏',
                multiplier: side === 'andar' ? 1.90 : 2.00,
                straightBetAmount: 0,
                userCount: 0,
                totalPayoutLiability: 0,
                netHouseProfit: 0,
                profitMarginPercentage: 100,
                riskRating: 'safe',
              };
              const isLowestRisk = riskAnalysis?.lowestRiskSide === side;
              const isHighestRisk = riskAnalysis?.highestRiskSide === side;
              const isTargeted = selectedForcedWinner === side;

              return (
                <div
                  key={side}
                  className={`p-5 rounded-3xl border transition-all relative ${
                    isTargeted ? 'bg-slate-900 border-white ring-1 ring-white shadow-2xl' :
                    isLowestRisk ? 'bg-emerald-950/20 border-emerald-500/40' :
                    isHighestRisk ? 'bg-rose-950/20 border-rose-500/40' :
                    'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{data.symbol}</span>
                      <div>
                        <h4 className="text-sm font-black text-white">{data.title}</h4>
                        <span className="text-[10px] text-slate-400 uppercase">Side Bet</span>
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-950 text-slate-300 border border-slate-800">
                      {data.multiplier}x
                    </span>
                  </div>

                  <div className="space-y-2 my-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 uppercase">Total Wagered:</span>
                      <span className="font-bold text-white">₹{(Number(data.straightBetAmount) || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 uppercase">Active Bettors:</span>
                      <span className="font-bold text-slate-300">{data.userCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 uppercase">Payout Liability:</span>
                      <span className="font-bold text-rose-400">₹{(Number(data.totalPayoutLiability) || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2">
                      <span className="text-slate-500 uppercase">Net House Profit:</span>
                      <span className={`font-black text-sm ${(data.netHouseProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(data.netHouseProfit || 0) >= 0 ? '+' : ''}₹{(Number(data.netHouseProfit) || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                    <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      data.riskRating === 'safe' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      data.riskRating === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {data.riskRating.toUpperCase()} RISK
                    </span>

                    <button
                      onClick={() => handleSetForcedWinner(side)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                        isTargeted ? 'bg-white text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isTargeted ? 'TARGETED' : 'FORCE THIS OUTCOME'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* === 0-SECOND LATENCY EXACT USER PANEL LIVE RESULT DISPLAY WITH ROUND ID === */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>লাইভ রাউন্ড রেজাল্ট (ইউজার প্যানেল মিরর - 0s Delay)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SYNCHRONIZED
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ইউজার প্যানেলে ঠিক যেভাবে ০ সেকেন্ডের ব্যবধানে ফলাফল ভেসে ওঠে, এখানেও নিখুঁতভাবে একই প্রদর্শন।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">রাউন্ড আইডি:</span>
                  <span className="text-xs font-black text-amber-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    {currentRoundId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">স্ট্যাটাস:</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    roundPhase === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : roundPhase === 'dealing'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {roundPhase === 'completed' ? '🏆 ফলাফল সম্পন্ন' : roundPhase === 'dealing' ? '⚡ কার্ড ডিল চলছে' : `⏱️ বেটিং ওপেন (${roundCountdown}s)`}
                  </span>
                </div>
              </div>
            </div>

            {/* User Panel Mirror Result Container */}
            {roundPhase === 'completed' && universalTimeState?.roundDetails?.winningCard && universalTimeState?.roundDetails?.jokerCard ? (
              <div className="bg-[#1f0912] border-2 border-amber-400 rounded-2xl p-4 shadow-[0_0_35px_rgba(255,215,0,0.25)] relative overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Matching Cards Pair (Joker & Winning Match) */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Joker Card */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-amber-300 uppercase">JOKER</span>
                      <div className="w-11 h-16 bg-white rounded-lg border-2 border-amber-400 shadow-md flex flex-col items-center justify-center font-bold text-sm leading-none text-slate-900">
                        <span className={universalTimeState.roundDetails.jokerCard.suit === 'hearts' || universalTimeState.roundDetails.jokerCard.suit === 'diamonds' ? 'text-rose-600' : 'text-slate-900'}>
                          {universalTimeState.roundDetails.jokerCard.rank}
                        </span>
                        <span className={`text-xs mt-0.5 ${universalTimeState.roundDetails.jokerCard.suit === 'hearts' || universalTimeState.roundDetails.jokerCard.suit === 'diamonds' ? 'text-rose-600' : 'text-slate-900'}`}>
                          {universalTimeState.roundDetails.jokerCard.suit === 'hearts' ? '♥' :
                           universalTimeState.roundDetails.jokerCard.suit === 'diamonds' ? '♦' :
                           universalTimeState.roundDetails.jokerCard.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                    </div>

                    {/* Match Sparkle Icon */}
                    <div className="flex flex-col items-center justify-center text-amber-400 px-1">
                      <Sparkles className="w-5 h-5 animate-spin text-amber-400" />
                      <span className="text-[9px] font-black tracking-wider">MATCH</span>
                    </div>

                    {/* Winning Card */}
                    <div className="flex flex-col items-center">
                      <span className={`text-[9px] font-bold uppercase ${universalTimeState.roundDetails.winningSide === 'andar' ? 'text-cyan-300' : 'text-rose-300'}`}>
                        WINNER
                      </span>
                      <div className="w-11 h-16 bg-white rounded-lg border-2 border-amber-400 ring-2 ring-amber-400 shadow-xl flex flex-col items-center justify-center font-bold text-sm leading-none text-slate-900">
                        <span className={universalTimeState.roundDetails.winningCard.suit === 'hearts' || universalTimeState.roundDetails.winningCard.suit === 'diamonds' ? 'text-rose-600' : 'text-slate-900'}>
                          {universalTimeState.roundDetails.winningCard.rank}
                        </span>
                        <span className={`text-xs mt-0.5 ${universalTimeState.roundDetails.winningCard.suit === 'hearts' || universalTimeState.roundDetails.winningCard.suit === 'diamonds' ? 'text-rose-600' : 'text-slate-900'}`}>
                          {universalTimeState.roundDetails.winningCard.suit === 'hearts' ? '♥' :
                           universalTimeState.roundDetails.winningCard.suit === 'diamonds' ? '♦' :
                           universalTimeState.roundDetails.winningCard.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Winner Announcement Details */}
                  <div className="flex-1 text-center min-w-0">
                    <div className={`text-lg sm:text-2xl font-black tracking-wide uppercase flex items-center justify-center gap-1.5 ${
                      universalTimeState.roundDetails.winningSide === 'andar' 
                        ? 'text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.9)]' 
                        : 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]'
                    }`}>
                      <Crown className="w-6 h-6 text-amber-400 inline" />
                      {universalTimeState.roundDetails.winningSide === 'andar' ? '🔵 ANDAR WINS!' : '🔴 BAHAR WINS!'}
                    </div>
                    <div className="text-xs text-slate-300 mt-1 font-mono">
                      Matched on Card <strong className="text-white">#{universalTimeState.currentDealtCount || universalTimeState.roundDetails.totalCardsCount}</strong> • Total <strong className="text-amber-300">{(universalTimeState.visibleAndarCards?.length || 0) + (universalTimeState.visibleBaharCards?.length || 0)} Cards Dealt</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Winning Multiplier: <span className="font-bold text-amber-400">{universalTimeState.roundDetails.winningSide === 'andar' ? '1.90x' : '2.00x'}</span>
                    </div>
                  </div>

                  {/* Round ID pill badge */}
                  <div className="text-right sm:border-l border-white/10 sm:pl-4">
                    <span className="text-[9px] text-slate-400 block uppercase">লাইভ রাউন্ড কোড</span>
                    <span className="text-sm font-black text-amber-300 font-mono block">
                      {currentRoundId}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-block mt-1 font-bold">
                      0s DELAY SYNCED
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-14 bg-slate-900 border border-amber-500/40 rounded-lg flex flex-col items-center justify-center font-bold text-white text-xs">
                    <span className="text-amber-400 text-sm font-black">
                      {universalTimeState?.roundDetails?.jokerCard?.rank || currentJokerRank}
                    </span>
                    <span className="text-[10px]">
                      {universalTimeState?.roundDetails?.jokerCard?.suit === 'hearts' ? '♥' :
                       universalTimeState?.roundDetails?.jokerCard?.suit === 'diamonds' ? '♦' :
                       universalTimeState?.roundDetails?.jokerCard?.suit === 'clubs' ? '♣' : '♠'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      {roundPhase === 'betting' ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          বেটিং চলছে ({roundCountdown}s বাকি)
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          কার্ড ডিল হচ্ছে... ({universalTimeState?.currentDealtCount || 0} টি সম্পন্ন)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      জোকার কার্ড: <strong className="text-amber-300">{universalTimeState?.roundDetails?.jokerCard?.rank || currentJokerRank}</strong> • ম্যাচ কার্ড বের হওয়া মাত্রই ইউজার প্যানেলের মতো তাৎক্ষণিক রেজাল্ট প্রদর্শিত হবে।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">আন্দার কার্ডস:</span>
                    <span className="text-xs font-bold text-cyan-400">{universalTimeState?.visibleAndarCards?.length || 0} টি</span>
                  </div>
                  <div className="w-px h-6 bg-slate-800" />
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">বাহার কার্ডস:</span>
                    <span className="text-xs font-bold text-rose-400">{universalTimeState?.visibleBaharCards?.length || 0} টি</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* REAL-TIME LIVE BETS STREAM TABLE */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase">
                  Real-Time Live Bets Stream ({liveBets.length})
                </h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search player or code..."
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {liveBets.length > 0 && (
                  <button
                    onClick={handleClearLiveBets}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Flush live stream"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Flush</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Player</th>
                    <th className="p-3">Spot</th>
                    <th className="p-3">Bet Amount</th>
                    <th className="p-3">Multiplier</th>
                    <th className="p-3">Potential Payout</th>
                    <th className="p-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLiveBets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No active live bets in this round yet. Bets will stream here in real time as players place chips.
                      </td>
                    </tr>
                  ) : (
                    filteredLiveBets.map((b) => {
                      const uCode = generatePermanentUserCode(undefined, undefined, b.userId);
                      return (
                        <tr key={b.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <span className="font-bold text-white">{b.userName || 'Player'}</span>
                            <span className="block text-[9px] text-slate-500">#{uCode}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              b.spot === 'andar' ? 'bg-red-600 text-white' :
                              b.spot === 'bahar' ? 'bg-cyan-600 text-slate-950' :
                              'bg-amber-600 text-slate-950'
                            }`}>
                              {b.spot?.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-white font-bold">₹{(Number(b?.amount || (b as any)?.betAmount) || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-400">{b?.multiplier || 1.95}x</td>
                          <td className="p-3 text-rose-400 font-bold">₹{(Number(b?.potentialWin) || (Number(b?.amount || (b as any)?.betAmount || 0) * (Number(b?.multiplier) || 1.95))).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-500 text-[10px]">{b.date || 'Just now'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: CONFIGURATION & MATH LIMITS */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          
          {/* Master Enable & Basic Limits */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>1. Basic Game Rules & Limits</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Game Active Switch */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Game Status</h4>
                  <p className="text-[10px] text-slate-400">Enable or disable game for all players</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    config.isEnabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Opposite Betting Restriction Switch */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-white">Opposite Betting Block</h4>
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      config.preventBothAndarBaharBet !== false ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {config.preventBothAndarBaharBet !== false ? 'RESTRICTED' : 'ALLOWED'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Block simultaneous bet on Andar & Bahar in 1 round</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, preventBothAndarBaharBet: prev.preventBothAndarBaharBet === false }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.preventBothAndarBaharBet !== false ? 'bg-rose-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    config.preventBothAndarBaharBet !== false ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Min Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Min Bet (₹)</label>
                <input
                  type="number"
                  value={config.minBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, minBet: parseInt(e.target.value, 10) || 10 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Max Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Max Bet (₹)</label>
                <input
                  type="number"
                  value={config.maxBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxBet: parseInt(e.target.value, 10) || 100000 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Betting Duration Seconds */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Betting Duration (Seconds)</label>
                <input
                  type="number"
                  value={config.bettingDurationSeconds || 15}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bettingDurationSeconds: parseInt(e.target.value, 10) || 15 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Joker Card Rank Selection */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Manual Joker Rank Override</label>
                <select
                  value={config.manualJokerRank || 'random'}
                  onChange={(e) => setConfig((p) => ({ ...p, manualJokerRank: e.target.value as CardRank | 'random' }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="random">🎲 Random Deck Shuffled</option>
                  {RANKS.map((r) => (
                    <option key={r} value={r}>🃏 Rank {r}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Payout Multipliers */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>2. Payout Multipliers</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-red-400">🎴 Andar Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.andarMultiplier || 1.90}
                  onChange={(e) => setConfig((p) => ({ ...p, andarMultiplier: parseFloat(e.target.value) || 1.90 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-cyan-400">🃏 Bahar Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.baharMultiplier || 2.00}
                  onChange={(e) => setConfig((p) => ({ ...p, baharMultiplier: parseFloat(e.target.value) || 2.00 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
              </div>
            </div>
          </div>

          {/* 3. Chip Values Configuration (Admin to User Panel 0s Sync) */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>3. Chip Values Settings (বাজি চিপ কন্ট্রোল)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ইউজার প্যানেলের চিপ সিলেক্টরে প্রদর্শিত সমস্ত চিপ এখানে কাস্টমাইজ করুন। ০ সেকেন্ডে ইউজারের স্ক্রিনে রিয়েল-টাইমে আপডেট হবে।
                </p>
              </div>

              {/* Instant 0s Chip Save Button */}
              <div className="flex items-center gap-2">
                {chipSaveSuccess && (
                  <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>চিপ সেভ সম্পন্ন!</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveChips()}
                  disabled={savingChips}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-mono text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingChips ? 'সেভ হচ্ছে...' : 'চিপ সেভ করুন (Save Chips)'}</span>
                </button>
              </div>
            </div>

            {/* Live Visual Preview of Chips in User Panel */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Preview (ইউজারের স্ক্রিনে যেমন দেখাবে):</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Total Chips: {chipValues.length}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 no-scrollbar">
                {chipValues.map((chipVal, i) => (
                  <div
                    key={i}
                    className="relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-mono font-black text-xs shadow-md border-2 border-dashed border-white/80 transition hover:scale-105"
                    style={{
                      background: chipVal < 25
                        ? 'linear-gradient(135deg, #334155, #1e293b)'
                        : chipVal < 100
                        ? 'linear-gradient(135deg, #2563eb, #1e1b4b)'
                        : chipVal < 500
                        ? 'linear-gradient(135deg, #059669, #064e3b)'
                        : chipVal < 1000
                        ? 'linear-gradient(135deg, #7c3aed, #581c87)'
                        : chipVal < 5000
                        ? 'linear-gradient(135deg, #f59e0b, #78350f)'
                        : chipVal < 25000
                        ? 'linear-gradient(135deg, #e11d48, #881337)'
                        : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                      color: chipVal >= 1000 && chipVal < 5000 ? '#020617' : chipVal >= 25000 ? '#020617' : '#ffffff'
                    }}
                  >
                    <div className="w-8 h-8 rounded-full border border-black/30 flex items-center justify-center">
                      {chipVal >= 1000000 ? `${chipVal / 1000000}M` : chipVal >= 1000 ? `${chipVal / 1000}k` : chipVal}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400">Quick Presets (দ্রুত প্রিসেট লোড করুন):</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPresetChips([10, 50, 100, 500, 1000, 5000, 25000])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
                >
                  ⭐ Default (10, 50, 100, 500, 1k, 5k, 25k)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetChips([10, 20, 50, 100, 200, 500, 1000])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
                >
                  🌱 Standard (10, 20, 50, 100, 200, 500, 1k)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetChips([100, 500, 1000, 5000, 10000, 25000, 50000])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
                >
                  🔥 High Roller (100, 500, 1k, 5k, 10k, 25k, 50k)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetChips([5, 10, 25, 50, 100, 250, 500])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
                >
                  🪙 Micro (5, 10, 25, 50, 100, 250, 500)
                </button>
              </div>
            </div>

            {/* Editable Chip Inputs Grid */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400">Edit Individual Chips (চিপ অ্যামাউন্ট পরিবর্তন / রিমুভ করুন):</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                {chipValues.map((chipVal, index) => (
                  <div key={index} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-amber-400">Chip #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChip(index)}
                        disabled={chipValues.length <= 1}
                        className="text-slate-600 hover:text-red-400 transition disabled:opacity-20 cursor-pointer"
                        title="Remove chip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={chipVal}
                        onChange={(e) => handleChipChange(index, Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-1.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Chip Field */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/80">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newChipInput}
                  onChange={(e) => setNewChipInput(e.target.value)}
                  placeholder="নতুন চিপ অ্যামাউন্ট (উদাঃ 2000)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddChip}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-mono text-xs font-bold transition border border-slate-700 cursor-pointer"
              >
                + চিপ যোগ করুন (Add Chip)
              </button>
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saveSuccess && (
              <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved successfully to Firestore!</span>
              </span>
            )}
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-mono text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-600/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>

        </div>
      )}

      {/* TAB 3: ROUNDS HISTORY */}
      {activeTab === 'rounds' && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
          <h3 className="text-sm font-black font-mono text-white uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Recent Completed Rounds Audit</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Round ID</th>
                  <th className="p-3">Joker Card</th>
                  <th className="p-3">Winning Side</th>
                  <th className="p-3">Matching Card</th>
                  <th className="p-3">Cards Count</th>
                  <th className="p-3">Total Bets</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentRounds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No recent rounds recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentRounds.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-300">{r.id}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded font-black">
                          {r.jokerCard ? `${r.jokerCard.rank} ${r.jokerCard.suit}` : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          r.winningSide === 'andar' ? 'bg-red-600 text-white' : 'bg-cyan-600 text-slate-950'
                        }`}>
                          {r.winningSide || 'COMPLETED'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {r.winningCard ? `${r.winningCard.rank} ${r.winningCard.suit}` : '-'}
                      </td>
                      <td className="p-3 text-slate-400">{r.totalCardsDealt || 0}</td>
                      <td className="p-3 text-slate-300">
                        ₹{((r.totalBetsAndar || 0) + (r.totalBetsBahar || 0)).toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-500 text-[10px]">
                        {new Date(r.startTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PLAYER BETS HISTORY */}
      {activeTab === 'bets' && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black font-mono text-white uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Live Player Bets Ledger</span>
            </h3>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user or round..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Round</th>
                  <th className="p-3">Side</th>
                  <th className="p-3">Bet Amount</th>
                  <th className="p-3">Won Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No player bets matching search found.
                    </td>
                  </tr>
                ) : (
                  filteredBets.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <span className="font-bold text-white">{b.userName}</span>
                        {b.userPhone && <span className="block text-[9px] text-slate-500">{b.userPhone}</span>}
                      </td>
                      <td className="p-3 text-slate-400">{b.roundId}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          b.side === 'andar' ? 'bg-red-600 text-white' : 'bg-cyan-600 text-slate-950'
                        }`}>
                          {b.side}
                        </span>
                      </td>
                      <td className="p-3 text-white font-bold">₹{(Number(b?.amount || (b as any)?.betAmount) || 0).toLocaleString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">
                        {b?.wonAmount ? `+₹${(Number(b.wonAmount) || 0).toLocaleString()}` : '₹0'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          b.status === 'won' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[10px]">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
