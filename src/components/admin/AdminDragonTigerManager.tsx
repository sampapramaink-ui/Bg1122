import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Zap, RefreshCw, Save, CheckCircle2, AlertTriangle, 
  Crown, Play, Layers, RotateCcw, TrendingUp, DollarSign, Award,
  Users, Eye, Search, Filter, Flame, Sliders, Radio, Clock,
  Trash2, ShieldAlert, Target, Percent, ArrowRight, Coins, Plus, Sparkles
} from 'lucide-react';
import { DragonTigerConfig, DragonTigerRound, DragonTigerBet, DragonTigerSide, CardRank } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { DEFAULT_DRAGON_TIGER_CONFIG, getUniversalDragonTigerTimeState, UniversalDragonTigerTimeState, getRankNumericValue, getSyncedDragonTigerBeadRoad } from '../../utils/dragonTiger';
import { soundFx } from '../../utils/audio';
import { generatePermanentUserCode } from '../../utils/databaseSync';
import { 
  DragonTigerLiveBetItem, 
  analyzeDragonTigerLiveBets, 
  DragonTigerRiskAnalysis 
} from '../../utils/dragonTigerRiskEngine';

export const AdminDragonTigerManager: React.FC = () => {
  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'rounds' | 'bets'>('monitor');

  // Config State
  const [config, setConfig] = useState<DragonTigerConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_dragon_tiger_config');
      return cached ? { ...DEFAULT_DRAGON_TIGER_CONFIG, ...JSON.parse(cached) } : DEFAULT_DRAGON_TIGER_CONFIG;
    } catch {
      return DEFAULT_DRAGON_TIGER_CONFIG;
    }
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Chip Configuration State (Synced in real-time with User Panel)
  const [chipValues, setChipValues] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem('bg_dragon_tiger_chips');
      return cached ? JSON.parse(cached) : (config.chipValues || [10, 50, 100, 500, 1000, 5000, 25000]);
    } catch {
      return config.chipValues || [10, 50, 100, 500, 1000, 5000, 25000];
    }
  });
  const [chipSaveSuccess, setChipSaveSuccess] = useState<boolean>(false);
  const [savingChips, setSavingChips] = useState<boolean>(false);
  const [newChipInput, setNewChipInput] = useState<string>('');

  // Live Round State & Universal Synced Clock
  const [currentRoundId, setCurrentRoundId] = useState<string>('DT-LIVE');
  const [roundPhase, setRoundPhase] = useState<'betting' | 'dealing' | 'completed'>('betting');
  const [roundCountdown, setRoundCountdown] = useState<number>(15);
  const [universalTimeState, setUniversalTimeState] = useState<UniversalDragonTigerTimeState | null>(null);
  const lastSavedRoundRef = useRef<string>('');

  // Live Bets Stream & Controls
  const [liveBets, setLiveBets] = useState<DragonTigerLiveBetItem[]>([]);
  const [isAutoLowRiskActive, setIsAutoLowRiskActive] = useState<boolean>(true);
  const [isManualOverrideEnabled, setIsManualOverrideEnabled] = useState<boolean>(false);
  const [selectedForcedWinner, setSelectedForcedWinner] = useState<DragonTigerSide | 'random'>('random');

  // Real-time Bet Limits Input State (0s delay sync)
  const [inputMinBet, setInputMinBet] = useState<number>(config.minBet || 50);
  const [inputMaxBet, setInputMaxBet] = useState<number>(config.maxBet || 15000000);

  // History & Table States
  const [recentRounds, setRecentRounds] = useState<DragonTigerRound[]>([]);
  const [recentBets, setRecentBets] = useState<DragonTigerBet[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveSearchQuery, setLiveSearchQuery] = useState<string>('');

  // Previous 15 Rounds Bead Road (Mirrored 1:1 with User Panel)
  const beadRoad = useMemo(() => {
    const curIdx = universalTimeState?.roundIndex ?? getUniversalDragonTigerTimeState().roundIndex;
    const synced = getSyncedDragonTigerBeadRoad(curIdx, 25);
    const mapped = synced.map(h => ({
      id: h.id,
      winner: h.winner,
      isSuitedTie: h.isSuitedTie,
      dragonRank: h.dragonRank,
      tigerRank: h.tigerRank,
    })).reverse();

    if (recentRounds && recentRounds.length > 0) {
      const dbMap = new Map<string, DragonTigerRound>();
      recentRounds.forEach(r => {
        const rId = r.id || (r as any).roundId;
        if (rId && r.winningSide) dbMap.set(rId, r);
      });
      return mapped.map(b => {
        const match = dbMap.get(b.id);
        if (match && match.winningSide) {
          return {
            ...b,
            winner: match.winningSide,
            dragonRank: match.dragonCard?.rank || b.dragonRank,
            tigerRank: match.tigerCard?.rank || b.tigerRank,
          };
        }
        return b;
      });
    }
    return mapped;
  }, [universalTimeState?.roundIndex, recentRounds]);

  const dragonCount = useMemo(() => beadRoad.slice(-15).filter(b => b.winner === 'dragon').length, [beadRoad]);
  const tigerCount = useMemo(() => beadRoad.slice(-15).filter(b => b.winner === 'tiger').length, [beadRoad]);
  const tieCount = useMemo(() => beadRoad.slice(-15).filter(b => b.winner === 'tie' || b.winner === 'suited_tie').length, [beadRoad]);

  // Real-Time Risk & Liability Analysis (Current Active Round Only)
  const currentRoundBets = useMemo(() => {
    return liveBets.filter(b => !currentRoundId || b.roundId === currentRoundId);
  }, [liveBets, currentRoundId]);

  const riskAnalysis: DragonTigerRiskAnalysis = useMemo(() => {
    return analyzeDragonTigerLiveBets(currentRoundBets, config);
  }, [currentRoundBets, config]);

  // 1. Synchronized Universal 24/7 Game Clock Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const activeForced = isManualOverrideEnabled && selectedForcedWinner !== 'random'
        ? selectedForcedWinner
        : (isAutoLowRiskActive && riskAnalysis.totalPot > 0 && riskAnalysis.lowestRiskSide && riskAnalysis.lowestRiskSide !== 'random'
            ? riskAnalysis.lowestRiskSide 
            : (config.manualForceWinner || 'random'));
      const activeConfig: DragonTigerConfig = {
        ...config,
        manualForceWinner: activeForced,
        forcedWinner: activeForced,
        isManualOverride: isManualOverrideEnabled && selectedForcedWinner !== 'random',
        autoLowRiskWinner: activeForced !== 'random' ? activeForced : undefined,
      } as any;
      const timeState = getUniversalDragonTigerTimeState(Date.now(), activeConfig);
      setUniversalTimeState(timeState);
      setCurrentRoundId(timeState.roundDetails.roundId);
      setRoundPhase(timeState.phase);
      setRoundCountdown(timeState.countdown);
    }, 250);

    return () => clearInterval(timer);
  }, [config, isManualOverrideEnabled, selectedForcedWinner, isAutoLowRiskActive, riskAnalysis]);

  // 2. Real-Time Firestore Listeners
  useEffect(() => {
    // Config listener
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'dragon_tiger'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (Array.isArray(data.chipValues) && data.chipValues.length > 0) {
          setChipValues(data.chipValues);
        }
        setConfig((prev) => ({
          ...prev,
          isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled,
          minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
          maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
          rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
          houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
          dragonMultiplier: data.multiplierPrimary !== undefined ? data.multiplierPrimary : (data.dragonMultiplier || prev.dragonMultiplier),
          tigerMultiplier: data.multiplierSecondary !== undefined ? data.multiplierSecondary : (data.tigerMultiplier || prev.tigerMultiplier),
          tieMultiplier: data.tieMultiplier !== undefined ? data.tieMultiplier : (data.tieMultiplier || prev.tieMultiplier),
          suitedTieMultiplier: data.suitedTieMultiplier !== undefined ? data.suitedTieMultiplier : (data.suitedTieMultiplier || prev.suitedTieMultiplier),
          rtpMode: data.rtpMode || prev.rtpMode,
          manualForceWinner: data.manualForceTarget || data.manualForceWinner || prev.manualForceWinner,
          preventBothDragonTigerBet: data.preventBothDragonTigerBet !== undefined ? data.preventBothDragonTigerBet : prev.preventBothDragonTigerBet,
          chipValues: Array.isArray(data.chipValues) && data.chipValues.length > 0 ? data.chipValues : prev.chipValues,
        }));
      }
    }, (err) => console.warn('Admin Dragon Tiger game_settings listener notice:', err.message));

    // Live State listener
    const unsubLiveState = onSnapshot(doc(db, 'dragon_tiger_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (Array.isArray(data.chipValues) && data.chipValues.length > 0) {
          setChipValues(data.chipValues);
        }
        setIsAutoLowRiskActive(data.isAutoLowRiskActive !== false);
        setIsManualOverrideEnabled(!!data.isManualOverride);
        if (data.forcedWinner) {
          setSelectedForcedWinner(data.forcedWinner);
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
            chipValues: Array.isArray(data.chipValues) && data.chipValues.length > 0 ? data.chipValues : prev.chipValues,
          }));
        }
      }
    }, (err) => console.warn('Live state listener notice:', err.message));

    // Live Bets listener
    const unsubLiveBets = onSnapshot(collection(db, 'dragon_tiger_live_bets'), (snap) => {
      const items: DragonTigerLiveBetItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLiveBets(items);
    }, (err) => console.warn('Live bets listener notice:', err.message));

    // Recent rounds listener
    const qRounds = query(collection(db, 'dragon_tiger_rounds'), limit(30));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const list: DragonTigerRound[] = [];
      snap.forEach((d) => list.push(d.data() as DragonTigerRound));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setRecentRounds(list);
    }, (err) => console.warn('Admin rounds listener notice:', err.message));

    // Recent bets listener
    const qBets = query(collection(db, 'dragon_tiger_bets'), limit(50));
    const unsubBets = onSnapshot(qBets, (snap) => {
      const list: DragonTigerBet[] = [];
      snap.forEach((d) => list.push(d.data() as DragonTigerBet));
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
      const activeWinner = (riskAnalysis.totalPot > 0 && riskAnalysis.lowestRiskSide && riskAnalysis.lowestRiskSide !== 'random')
        ? riskAnalysis.lowestRiskSide
        : 'random';
      setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        isAutoLowRiskActive: true,
        isManualOverride: false,
        autoLowRiskWinner: activeWinner,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }
  }, [isAutoLowRiskActive, isManualOverrideEnabled, riskAnalysis.lowestRiskSide, riskAnalysis.totalPot]);

  // Synchronized 24x7 Round Persistence & Clean Up Completed Live Bets
  useEffect(() => {
    if (
      universalTimeState?.phase === 'completed' &&
      universalTimeState.roundDetails.roundId &&
      lastSavedRoundRef.current !== universalTimeState.roundDetails.roundId
    ) {
      lastSavedRoundRef.current = universalTimeState.roundDetails.roundId;
      const rId = universalTimeState.roundDetails.roundId;
      const winSide = universalTimeState.roundDetails.winningSide;
      const roundDoc: DragonTigerRound = {
        id: rId,
        roundNumber: universalTimeState.roundIndex || 1,
        startTime: universalTimeState.roundStartTimeMs,
        endTime: universalTimeState.roundEndTimeMs,
        dragonCard: universalTimeState.roundDetails.dragonCard,
        tigerCard: universalTimeState.roundDetails.tigerCard,
        winningSide: winSide,
        isSuitedTie: universalTimeState.roundDetails.isSuitedTie,
        totalBetsDragon: riskAnalysis.outcomes.dragon?.straightBetAmount || 0,
        totalBetsTiger: riskAnalysis.outcomes.tiger?.straightBetAmount || 0,
        totalBetsTie: riskAnalysis.outcomes.tie?.straightBetAmount || 0,
        totalBetsSuitedTie: riskAnalysis.outcomes.suited_tie?.straightBetAmount || 0,
        totalPayout: riskAnalysis.outcomes[winSide]?.totalPayoutLiability || 0,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      setDoc(doc(db, 'dragon_tiger_rounds', rId), roundDoc, { merge: true }).catch(() => {});

      // Automatically reset manual override after round completes, returning immediately to Auto Low Risk
      if (isManualOverrideEnabled) {
        setIsManualOverrideEnabled(false);
        setSelectedForcedWinner('random');
        setIsAutoLowRiskActive(true);
        setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
          isManualOverride: false,
          forcedWinner: 'random',
          manualForceWinner: 'random',
          manualForceTarget: 'random',
          isAutoLowRiskActive: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
          isManualOverride: false,
          manualForceWinner: 'random',
          manualForceTarget: 'random',
          rtpMode: 'house_protect',
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }

      // Delete stale live bets for the finished round
      liveBets.filter(b => b.roundId === rId).forEach(b => {
        deleteDoc(doc(db, 'dragon_tiger_live_bets', b.id)).catch(() => {});
      });
    }
  }, [universalTimeState, riskAnalysis, liveBets, isManualOverrideEnabled]);

  // Handle Instant 0-second Bet Amount Limits (Min Bet / Max Bet)
  const handleUpdateBetLimits = async (minB: number, maxB: number) => {
    try {
      soundFx.playClick();
      setInputMinBet(minB);
      setInputMaxBet(maxB);

      await setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        minBet: minB,
        maxBet: maxB,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
        minBet: minB,
        maxBet: maxB,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setConfig((prev) => ({ ...prev, minBet: minB, maxBet: maxB }));
      setStatusMessage(`🎯 বেটিং লিমিট সেট করা হয়েছে: সর্বনিম্ন ₹${(Number(minB) || 0).toLocaleString('en-IN')} — সর্বোচ্চ ₹${(Number(maxB) || 0).toLocaleString('en-IN')} (০ সেকেন্ডের দেরিতে কার্যকর)`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      setStatusMessage(`⚠️ এরর: ${e.message}`);
    }
  };

  // 4. Pre-Result Outcome Calculation (0s Latency Advance Prediction Engine)
  const preResult = useMemo(() => {
    let outcomeWinner: DragonTigerSide = 'dragon';
    let outcomeReason = 'RTP Engine (Fair RNG)';
    const dragonCard = universalTimeState?.roundDetails?.dragonCard;
    const tigerCard = universalTimeState?.roundDetails?.tigerCard;

    if (isManualOverrideEnabled && selectedForcedWinner !== 'random') {
      outcomeWinner = selectedForcedWinner;
      outcomeReason = `Admin 0s Manual Force (${selectedForcedWinner.toUpperCase()})`;
    } else if (isAutoLowRiskActive && riskAnalysis.totalPot > 0 && riskAnalysis.lowestRiskSide && riskAnalysis.lowestRiskSide !== 'random') {
      outcomeWinner = riskAnalysis.lowestRiskSide;
      outcomeReason = `Auto Low-Risk AI Guard (House Protect)`;
    } else if (universalTimeState?.roundDetails?.winningSide) {
      outcomeWinner = universalTimeState.roundDetails.winningSide;
      outcomeReason = `Mathematical RTP Curve (${config.rtpPercentage || 96.8}%)`;
    }

    const projectedLiability = riskAnalysis.outcomes[outcomeWinner]?.totalPayoutLiability || 0;

    const projectedProfit = riskAnalysis.totalPot - projectedLiability;

    return {
      winner: outcomeWinner,
      reason: outcomeReason,
      dragonCard,
      tigerCard,
      projectedLiability,
      projectedProfit,
      totalPot: riskAnalysis.totalPot,
      marginPercent: riskAnalysis.totalPot > 0 ? Math.round((projectedProfit / riskAnalysis.totalPot) * 100) : 100,
    };
  }, [isManualOverrideEnabled, selectedForcedWinner, isAutoLowRiskActive, riskAnalysis, universalTimeState, config]);

  // Handle Instant 0-second Outcome Override
  const handleSetForcedWinner = async (target: DragonTigerSide | 'random') => {
    try {
      soundFx.playClick();
      setSelectedForcedWinner(target);

      const isManual = target !== 'random';
      setIsManualOverrideEnabled(isManual);
      if (isManual) {
        setIsAutoLowRiskActive(false);
      }

      // Instant 0-second Firestore sync
      await setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        isManualOverride: isManual,
        forcedWinner: target,
        manualForceWinner: target,
        manualForceTarget: target,
        targetRoundId: currentRoundId,
        isAutoLowRiskActive: !isManual,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
        manualForceTarget: target,
        manualForceWinner: target,
        forcedWinner: target,
        isManualOverride: isManual,
        rtpMode: isManual ? 'manual_force_winner' : 'house_protect',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMessage(isManual ? `🎯 Forced Winner set to ${target.toUpperCase()} (0s delay applied)` : '🎲 Reset to Auto RNG / House Edge mode');
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

      const targetWinner = (nextState && riskAnalysis.totalPot > 0 && riskAnalysis.lowestRiskSide) ? riskAnalysis.lowestRiskSide : 'random';
      await setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        isAutoLowRiskActive: nextState,
        isManualOverride: false,
        autoLowRiskWinner: targetWinner,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
        rtpMode: nextState ? 'house_protect' : 'fair_random',
        manualForceTarget: targetWinner,
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

    // Instantly sync to Firestore with zero delay
    try {
      await setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        houseEdgePercentage: clampedEdge,
        rtpPercentage: rtp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
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
        await deleteDoc(doc(db, 'dragon_tiger_live_bets', b.id)).catch(() => {});
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
      const payload: DragonTigerConfig = {
        ...config,
        rtpPercentage: rtp,
        houseEdgePercentage: houseEdge,
        chipValues: chipValues,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      };
      
      await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
        isEnabled: payload.isEnabled,
        minBet: payload.minBet,
        maxBet: payload.maxBet,
        rtpPercentage: payload.rtpPercentage,
        houseEdgePercentage: payload.houseEdgePercentage,
        bettingDurationSeconds: payload.bettingDurationSeconds,
        multiplierPrimary: payload.dragonMultiplier,
        multiplierSecondary: payload.tigerMultiplier,
        dragonMultiplier: payload.dragonMultiplier,
        tigerMultiplier: payload.tigerMultiplier,
        tieMultiplier: payload.tieMultiplier,
        suitedTieMultiplier: payload.suitedTieMultiplier || 51.0,
        rtpMode: payload.rtpMode,
        manualForceTarget: payload.manualForceWinner || 'random',
        dealerVoiceEnabled: payload.dealerVoiceEnabled !== undefined ? payload.dealerVoiceEnabled : true,
        preventBothDragonTigerBet: payload.preventBothDragonTigerBet !== undefined ? payload.preventBothDragonTigerBet : true,
        chipValues: chipValues,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        chipValues: chipValues,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'dragon_tiger_config', 'main'), payload, { merge: true });
      localStorage.setItem('bg_dragon_tiger_config', JSON.stringify(payload));
      localStorage.setItem('bg_dragon_tiger_chips', JSON.stringify(chipValues));
      setSaveSuccess(true);
      soundFx.playWin();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save Dragon Tiger config:', e);
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
      await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
        chipValues: finalChips,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'dragon_tiger_live_state', 'current_round'), {
        chipValues: finalChips,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'dragon_tiger_config', 'main'), {
        chipValues: finalChips,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      localStorage.setItem('bg_dragon_tiger_chips', JSON.stringify(finalChips));
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

  // Analytics Calculation
  const totalVolume = recentBets.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalPayout = recentBets.reduce((acc, b) => acc + (b.wonAmount || 0), 0);
  const netHouseProfit = totalVolume - totalPayout;
  const houseMargin = totalVolume > 0 ? ((netHouseProfit / totalVolume) * 100).toFixed(1) : '6.4';

  const filteredLiveBets = liveBets.filter((b) => {
    const q = liveSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const uCode = (generatePermanentUserCode(undefined, undefined, b.userId)).toLowerCase();
    return (
      (b.userName || '').toLowerCase().includes(q) ||
      (b.userId || '').toLowerCase().includes(q) ||
      (b.side || '').toLowerCase().includes(q) ||
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
      <div className="p-5 bg-gradient-to-r from-slate-900 via-red-950/50 to-slate-900 border border-red-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 shadow-lg shadow-red-500/10">
            <Flame className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-mono tracking-wider text-white">
                DRAGON TIGER LIVE RISK CONTROLLER
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
              activeTab === 'monitor' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
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
              activeTab === 'config' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Game Math & Limits
          </button>
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rounds' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rounds ({recentRounds.length})
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bets' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
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
              <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-black">
                🐉
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase">Synchronized Round:</span>
                  <span className="text-sm font-black text-amber-300">{currentRoundId}</span>
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

          {/* === PREVIOUS 15 ROUNDS BEAD ROAD (EXACT USER PANEL DESIGN) === */}
          <div className="p-3.5 bg-[#12141c] border border-white/10 rounded-3xl font-mono text-[11px] shadow-xl space-y-2">
            {/* Stats Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 border-b border-white/5 text-[10px]">
              <div className="flex items-center gap-3">
                <span className="text-slate-300 font-black uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>পূর্ববর্তী ১৫ রাউন্ড:</span>
                </span>
                <span className="text-red-400 flex items-center gap-1 font-bold bg-red-950/40 px-2 py-0.5 rounded-lg border border-red-500/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                  <span>Dragon: {dragonCount}</span>
                </span>
                <span className="text-amber-400 flex items-center gap-1 font-bold bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>Tiger: {tigerCount}</span>
                </span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Tie: {tieCount}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                <span className="text-emerald-400 font-bold">Real-time Live Synced</span>
              </div>
            </div>

            {/* Bead Road Matrix Circles (Oldest on left, newest always appended to the right) */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar scroll-smooth py-1">
              {beadRoad.slice(-15).map((b, idx, arr) => {
                const isLatest = idx === arr.length - 1;
                return (
                  <div 
                    key={`${b.id || 'bead'}_${idx}`}
                    title={`রাউন্ড: ${b.id} | ${b.winner.toUpperCase()} (D: ${b.dragonRank}, T: ${b.tigerRank})`}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border relative transition-all cursor-pointer hover:scale-125 shadow-md ${
                      isLatest ? 'ring-2 ring-amber-300 scale-105 shadow-[0_0_10px_rgba(251,191,36,0.8)] z-10' : ''
                    } ${
                      b.winner === 'dragon' 
                        ? 'bg-red-600 border-red-400 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]' 
                        : b.winner === 'tiger' 
                        ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.4)]' 
                        : b.isSuitedTie 
                        ? 'bg-gradient-to-br from-emerald-500 to-amber-400 border-yellow-300 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                        : 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]'
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

          {/* 1. 24x7 REAL-TIME MIRRORED LIVE ROUND & OUTCOME DISPLAY */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  24x7 লাইভ রাউন্ড মনিটর (ইউজার প্যানেলের সাথে 0s সিঙ্ক)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">লাইভ আইডি:</span>
                <span className="font-bold text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">{currentRoundId}</span>
              </div>
            </div>

            {/* Live Cards Comparison & Real-Time Deal Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dragon Side */}
              <div className={`p-4 rounded-2xl border transition-all ${
                roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'dragon'
                  ? 'bg-red-950/40 border-red-500 ring-2 ring-red-400 shadow-lg shadow-red-950/50'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐉</span>
                    <span className="text-sm font-black text-red-400 uppercase">DRAGON (ড্রাগন)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-700/50 font-bold">2.00x</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-22 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex flex-col items-center justify-center text-white shadow-inner">
                    {roundPhase === 'betting' ? (
                      <span className="text-xs text-slate-500 font-bold">FACE DOWN</span>
                    ) : (
                      <>
                        <span className={`text-base font-black ${
                          universalTimeState?.roundDetails?.dragonCard?.suit === 'hearts' || universalTimeState?.roundDetails?.dragonCard?.suit === 'diamonds'
                            ? 'text-red-500' : 'text-slate-100'
                        }`}>
                          {universalTimeState?.roundDetails?.dragonCard?.rank || 'K'}
                        </span>
                        <span className="text-lg">
                          {universalTimeState?.roundDetails?.dragonCard?.suit === 'hearts' ? '♥' :
                           universalTimeState?.roundDetails?.dragonCard?.suit === 'diamonds' ? '♦' :
                           universalTimeState?.roundDetails?.dragonCard?.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="text-slate-400">কার্ড: <strong className="text-white">{roundPhase === 'betting' ? 'অপেক্ষা করছে...' : `${universalTimeState?.roundDetails?.dragonCard?.rank} of ${universalTimeState?.roundDetails?.dragonCard?.suit}`}</strong></div>
                    <div className="text-slate-400">লাইভ বাজি: <strong className="text-amber-400">₹{(Number(riskAnalysis?.outcomes?.dragon?.straightBetAmount) || 0).toLocaleString('en-IN')}</strong></div>
                    <div className="text-slate-400">প্লেয়ার: <strong className="text-cyan-400">{riskAnalysis?.outcomes?.dragon?.userCount || 0} জন</strong></div>
                  </div>
                </div>
              </div>

              {/* Tiger Side */}
              <div className={`p-4 rounded-2xl border transition-all ${
                roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'tiger'
                  ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-400 shadow-lg shadow-cyan-950/50'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐯</span>
                    <span className="text-sm font-black text-cyan-400 uppercase">TIGER (টাইগার)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 font-bold">2.00x</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-22 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex flex-col items-center justify-center text-white shadow-inner">
                    {roundPhase === 'betting' ? (
                      <span className="text-xs text-slate-500 font-bold">FACE DOWN</span>
                    ) : (
                      <>
                        <span className={`text-base font-black ${
                          universalTimeState?.roundDetails?.tigerCard?.suit === 'hearts' || universalTimeState?.roundDetails?.tigerCard?.suit === 'diamonds'
                            ? 'text-red-500' : 'text-slate-100'
                        }`}>
                          {universalTimeState?.roundDetails?.tigerCard?.rank || '7'}
                        </span>
                        <span className="text-lg">
                          {universalTimeState?.roundDetails?.tigerCard?.suit === 'hearts' ? '♥' :
                           universalTimeState?.roundDetails?.tigerCard?.suit === 'diamonds' ? '♦' :
                           universalTimeState?.roundDetails?.tigerCard?.suit === 'clubs' ? '♣' : '♠'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="text-slate-400">কার্ড: <strong className="text-white">{roundPhase === 'betting' ? 'অপেক্ষা করছে...' : `${universalTimeState?.roundDetails?.tigerCard?.rank} of ${universalTimeState?.roundDetails?.tigerCard?.suit}`}</strong></div>
                    <div className="text-slate-400">লাইভ বাজি: <strong className="text-amber-400">₹{(Number(riskAnalysis?.outcomes?.tiger?.straightBetAmount) || 0).toLocaleString('en-IN')}</strong></div>
                    <div className="text-slate-400">প্লেয়ার: <strong className="text-cyan-400">{riskAnalysis?.outcomes?.tiger?.userCount || 0} জন</strong></div>
                  </div>
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
                    কার্ড ডিল হচ্ছে...
                  </span>
                ) : (
                  <span className="text-cyan-400 font-black flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    ফলাফল: {universalTimeState?.roundDetails?.winningSide === 'dragon' ? '🐉 ড্রাগন জয়ী' :
                             universalTimeState?.roundDetails?.winningSide === 'tiger' ? '🐯 টাইগার জয়ী' :
                             universalTimeState?.roundDetails?.isSuitedTie ? '👑 সুটেড টাই' : '🤝 টাই ড্র'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">24x7 Continuous Stream</span>
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
                    preResult.winner === 'dragon' ? 'text-red-400' :
                    preResult.winner === 'tiger' ? 'text-cyan-400' :
                    preResult.winner === 'suited_tie' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {preResult.winner === 'dragon' ? '🐉 DRAGON (ড্রাগন)' :
                     preResult.winner === 'tiger' ? '🐯 TIGER (টাইগার)' :
                     preResult.winner === 'suited_tie' ? '👑 SUITED TIE' : '🤝 TIE (টাই)'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block mt-1">
                    কার্ড: <span className="text-white font-mono">D: {preResult.dragonCard?.rank || 'K'}{preResult.dragonCard?.suit === 'hearts' ? '♥' : '♠'} vs T: {preResult.tigerCard?.rank || '7'}{preResult.tigerCard?.suit === 'spades' ? '♠' : '♦'}</span>
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
                    onClick={() => handleSetForcedWinner('dragon')}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                      preResult.winner === 'dragon' ? 'bg-red-600 text-white border-white' : 'bg-red-950/40 text-red-300 border-red-800/60 hover:bg-red-900/40'
                    }`}
                  >
                    🐉 FORCE DRAGON
                  </button>
                  <button
                    onClick={() => handleSetForcedWinner('tiger')}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                      preResult.winner === 'tiger' ? 'bg-cyan-600 text-white border-white' : 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60 hover:bg-cyan-900/40'
                    }`}
                  >
                    🐯 FORCE TIGER
                  </button>
                  <button
                    onClick={() => handleSetForcedWinner('tie')}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                      preResult.winner === 'tie' ? 'bg-emerald-600 text-white border-white' : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
                    }`}
                  >
                    🤝 FORCE TIE
                  </button>
                  <button
                    onClick={handleToggleAutoLowRisk}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                      isAutoLowRiskActive ? 'bg-amber-600 text-white border-white' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🛡️ AUTO LOW-RISK
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
                  লাইভ বেটিং লিমিট কন্ট্রোলার (০ সেকেন্ডে ইউজার প্যানেলে সিঙ্ক)
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
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
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
                  <Target className="w-3.5 h-3.5 text-red-400" />
                  <span>Direct 1-Click Manual Outcome Forcing (0s Latency):</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Active Override: <strong className="text-white uppercase">{selectedForcedWinner}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { side: 'dragon' as const, label: '🐉 FORCE DRAGON', color: 'border-red-600 bg-red-950/40 hover:bg-red-900/60' },
                  { side: 'tiger' as const, label: '🐯 FORCE TIGER', color: 'border-cyan-600 bg-cyan-950/40 hover:bg-cyan-900/60' },
                  { side: 'tie' as const, label: '🤝 FORCE TIE', color: 'border-emerald-600 bg-emerald-950/40 hover:bg-emerald-900/60' },
                  { side: 'suited_tie' as const, label: '👑 SUITED TIE', color: 'border-amber-600 bg-amber-950/40 hover:bg-amber-900/60' },
                  { side: 'random' as const, label: '🎲 AUTO / FAIR RNG', color: 'border-slate-700 bg-slate-950 hover:bg-slate-800' },
                ].map((item) => {
                  const isSelected = selectedForcedWinner === item.side;
                  return (
                    <button
                      key={item.side}
                      onClick={() => handleSetForcedWinner(item.side)}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        item.color
                      } ${isSelected ? 'ring-2 ring-white scale-[1.02] shadow-xl' : 'opacity-85'}`}
                    >
                      <span>{item.label}</span>
                      {isSelected && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-white text-slate-950 rounded-full font-black">
                          ACTIVE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* REAL-TIME SECTOR LIABILITY & RISK HEATMAP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            {(['dragon', 'tiger', 'tie', 'suited_tie'] as DragonTigerSide[]).map((side) => {
              const data = riskAnalysis?.outcomes?.[side] || {
                side,
                title: side === 'dragon' ? 'Dragon' : side === 'tiger' ? 'Tiger' : side === 'suited_tie' ? 'Suited Tie' : 'Tie',
                symbol: side === 'dragon' ? '🐉' : side === 'tiger' ? '🐯' : side === 'suited_tie' ? '👑' : '🤝',
                multiplier: side === 'dragon' ? 1.95 : side === 'tiger' ? 1.95 : side === 'suited_tie' ? 50 : 8,
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
                  className={`p-4 rounded-3xl border transition-all relative ${
                    isTargeted ? 'bg-slate-900 border-white ring-1 ring-white shadow-2xl' :
                    isLowestRisk ? 'bg-emerald-950/20 border-emerald-500/40' :
                    isHighestRisk ? 'bg-rose-950/20 border-rose-500/40' :
                    'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{data.symbol}</span>
                      <h4 className="text-xs font-black text-white">{data.title}</h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-950 text-slate-300 border border-slate-800">
                      {data.multiplier}x
                    </span>
                  </div>

                  <div className="space-y-1.5 my-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px] uppercase">Wagered:</span>
                      <span className="font-bold text-white">₹{(Number(data.straightBetAmount) || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px] uppercase">Bettors:</span>
                      <span className="font-bold text-slate-300">{data.userCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px] uppercase">Payout Liability:</span>
                      <span className="font-bold text-rose-400">₹{(Number(data.totalPayoutLiability) || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1.5">
                      <span className="text-slate-500 text-[10px] uppercase">House Net:</span>
                      <span className={`font-black ${(data.netHouseProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(data.netHouseProfit || 0) >= 0 ? '+' : ''}₹{(Number(data.netHouseProfit) || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      data.riskRating === 'safe' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      data.riskRating === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {data.riskRating.toUpperCase()} RISK
                    </span>

                    <button
                      onClick={() => handleSetForcedWinner(side)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                        isTargeted ? 'bg-white text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isTargeted ? 'TARGETED' : 'FORCE'}
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
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
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
                    ড্রাগন ভার্সেস টাইগার ইউজার প্যানেলের কার্ড শোডাউন ও ফলাফল ০ সেকেন্ডের ব্যবধানে সরাসরি প্রদর্শিত।
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
                    {roundPhase === 'completed' ? '🏆 ফলাফল সম্পন্ন' : roundPhase === 'dealing' ? '⚡ কার্ড শোডাউন' : `⏱️ বেটিং ওপেন (${roundCountdown}s)`}
                  </span>
                </div>
              </div>
            </div>

            {/* User Panel Mirrored Showdown Table Felt Arena */}
            <div className="bg-gradient-to-b from-[#0e2a1b] via-[#091b11] to-[#040e09] border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                {/* DRAGON SIDE CARD */}
                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center relative transition-all ${
                  roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'dragon'
                    ? 'bg-red-950/60 border-red-500 ring-2 ring-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)]'
                    : 'bg-slate-950/50 border-red-900/40'
                }`}>
                  <span className="text-xs font-black text-red-400 tracking-wider flex items-center gap-1 mb-2">
                    <span>🐉 DRAGON</span>
                    {roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'dragon' && (
                      <span className="px-1.5 py-0.2 bg-red-600 text-white text-[9px] rounded font-bold uppercase animate-bounce">
                        WINNER
                      </span>
                    )}
                  </span>

                  {universalTimeState?.roundDetails?.dragonCard ? (
                    <div className="w-14 h-20 bg-white rounded-lg border-2 border-red-500/80 shadow-xl flex flex-col items-center justify-center font-bold leading-none text-slate-900 relative">
                      <span className={`text-base font-black ${
                        universalTimeState.roundDetails.dragonCard.suit === 'hearts' || universalTimeState.roundDetails.dragonCard.suit === 'diamonds'
                          ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {universalTimeState.roundDetails.dragonCard.rank}
                      </span>
                      <span className={`text-sm mt-0.5 ${
                        universalTimeState.roundDetails.dragonCard.suit === 'hearts' || universalTimeState.roundDetails.dragonCard.suit === 'diamonds'
                          ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {universalTimeState.roundDetails.dragonCard.suit === 'hearts' ? '♥' :
                         universalTimeState.roundDetails.dragonCard.suit === 'diamonds' ? '♦' :
                         universalTimeState.roundDetails.dragonCard.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                      <span className="text-[9px] text-slate-500 absolute bottom-1 font-mono">
                        Val: {getRankNumericValue(universalTimeState.roundDetails.dragonCard.rank)}
                      </span>
                    </div>
                  ) : (
                    <div className="w-14 h-20 bg-slate-900/80 rounded-lg border border-red-500/30 flex items-center justify-center text-red-400/50 text-xs">
                      ?
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 mt-2 font-mono">
                    Odds: 2.00x (1:1)
                  </span>
                </div>

                {/* CENTER SHOWDOWN & WINNER BADGE */}
                <div className="flex flex-col items-center justify-center text-center px-2 py-2">
                  {roundPhase === 'completed' && universalTimeState?.roundDetails ? (
                    <div className="space-y-2 animate-in zoom-in-95 duration-150">
                      {/* Winner Badge */}
                      <div className={`px-4 py-2 rounded-xl text-sm font-black tracking-wide border uppercase shadow-xl flex items-center justify-center gap-1.5 ${
                        universalTimeState.roundDetails.winningSide === 'dragon'
                          ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-yellow-300'
                          : universalTimeState.roundDetails.winningSide === 'tiger'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 border-amber-200'
                          : universalTimeState.roundDetails.winningSide === 'suited_tie'
                          ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300 text-slate-950 border-white animate-pulse'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-300'
                      }`}>
                        <Crown className="w-4 h-4 text-yellow-300 inline" />
                        <span>
                          {universalTimeState.roundDetails.winningSide === 'dragon' && '🐉 DRAGON WINS!'}
                          {universalTimeState.roundDetails.winningSide === 'tiger' && '🐅 TIGER WINS!'}
                          {universalTimeState.roundDetails.winningSide === 'tie' && '🟢 TIE (11:1)'}
                          {universalTimeState.roundDetails.winningSide === 'suited_tie' && '✨ SUITED TIE (50:1)'}
                        </span>
                      </div>

                      {/* Rank Comparison */}
                      {universalTimeState.roundDetails.dragonCard && universalTimeState.roundDetails.tigerCard && (
                        <div className="text-xs text-slate-300 font-mono">
                          Card Value: <strong className="text-red-400">{getRankNumericValue(universalTimeState.roundDetails.dragonCard.rank)}</strong> vs <strong className="text-amber-400">{getRankNumericValue(universalTimeState.roundDetails.tigerCard.rank)}</strong>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400">
                        {universalTimeState.roundDetails.isSuitedTie ? 'Same Rank + Same Suit' : 'Standard Dragon Tiger Showdown'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-sm">
                        VS
                      </div>
                      <span className="text-xs font-bold text-slate-300">
                        {roundPhase === 'betting' ? `বেটিং কাউন্টডাউন (${roundCountdown}s)` : 'কার্ড শোডাউন ডিলিং...'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ০ সেকেন্ডে ইউজার প্যানেলের সাথে সম্পূর্ণ সিঙ্ক
                      </span>
                    </div>
                  )}
                </div>

                {/* TIGER SIDE CARD */}
                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center relative transition-all ${
                  roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'tiger'
                    ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)]'
                    : 'bg-slate-950/50 border-amber-900/40'
                }`}>
                  <span className="text-xs font-black text-amber-400 tracking-wider flex items-center gap-1 mb-2">
                    <span>🐅 TIGER</span>
                    {roundPhase === 'completed' && universalTimeState?.roundDetails?.winningSide === 'tiger' && (
                      <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] rounded font-bold uppercase animate-bounce">
                        WINNER
                      </span>
                    )}
                  </span>

                  {universalTimeState?.roundDetails?.tigerCard ? (
                    <div className="w-14 h-20 bg-white rounded-lg border-2 border-amber-500/80 shadow-xl flex flex-col items-center justify-center font-bold leading-none text-slate-900 relative">
                      <span className={`text-base font-black ${
                        universalTimeState.roundDetails.tigerCard.suit === 'hearts' || universalTimeState.roundDetails.tigerCard.suit === 'diamonds'
                          ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {universalTimeState.roundDetails.tigerCard.rank}
                      </span>
                      <span className={`text-sm mt-0.5 ${
                        universalTimeState.roundDetails.tigerCard.suit === 'hearts' || universalTimeState.roundDetails.tigerCard.suit === 'diamonds'
                          ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {universalTimeState.roundDetails.tigerCard.suit === 'hearts' ? '♥' :
                         universalTimeState.roundDetails.tigerCard.suit === 'diamonds' ? '♦' :
                         universalTimeState.roundDetails.tigerCard.suit === 'clubs' ? '♣' : '♠'}
                      </span>
                      <span className="text-[9px] text-slate-500 absolute bottom-1 font-mono">
                        Val: {getRankNumericValue(universalTimeState.roundDetails.tigerCard.rank)}
                      </span>
                    </div>
                  ) : (
                    <div className="w-14 h-20 bg-slate-900/80 rounded-lg border border-amber-500/30 flex items-center justify-center text-amber-400/50 text-xs">
                      ?
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 mt-2 font-mono">
                    Odds: 2.00x (1:1)
                  </span>
                </div>
              </div>

              {/* Bottom Multiplier Payout Guide */}
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">পে-আউট হার:</span>
                  <span className="text-red-400 font-bold">Dragon 2.00x</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400 font-bold">Tiger 2.00x</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-bold">Tie 11:1</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-yellow-300 font-bold">Suited Tie 50:1</span>
                </div>
                <div className="text-slate-400 font-mono">
                  রাউন্ড কোড: <strong className="text-white">{currentRoundId}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* REAL-TIME LIVE BETS STREAM TABLE */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-red-400" />
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
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
                    <th className="p-3">Side / Spot</th>
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
                              b.side === 'dragon' ? 'bg-red-600 text-white' :
                              b.side === 'tiger' ? 'bg-cyan-600 text-slate-950' :
                              b.side === 'tie' ? 'bg-emerald-600 text-slate-950' :
                              'bg-amber-600 text-slate-950'
                            }`}>
                              {b.side.replace('_', ' ')}
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
                      config.preventBothDragonTigerBet !== false ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {config.preventBothDragonTigerBet !== false ? 'RESTRICTED' : 'ALLOWED'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Block simultaneous bet on Dragon & Tiger in 1 round</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, preventBothDragonTigerBet: prev.preventBothDragonTigerBet === false }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.preventBothDragonTigerBet !== false ? 'bg-rose-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    config.preventBothDragonTigerBet !== false ? 'left-7' : 'left-1'
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Max Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Max Bet (₹)</label>
                <input
                  type="number"
                  value={config.maxBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxBet: parseInt(e.target.value, 10) || 100000 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Betting Duration Seconds */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Betting Duration (Seconds)</label>
                <input
                  type="number"
                  value={config.bettingDurationSeconds || 15}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bettingDurationSeconds: parseInt(e.target.value, 10) || 15 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Dealer Audio Enabled */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Dealer Voice Commentary</h4>
                  <p className="text-[10px] text-slate-400">Bangla/English interactive audio dealer</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, dealerVoiceEnabled: !prev.dealerVoiceEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.dealerVoiceEnabled !== false ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    config.dealerVoiceEnabled !== false ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

            </div>
          </div>

          {/* Payout Multipliers */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>2. Payout Multipliers</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-red-400">🐉 Dragon Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.dragonMultiplier || 2.0}
                  onChange={(e) => setConfig((p) => ({ ...p, dragonMultiplier: parseFloat(e.target.value) || 2.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-cyan-400">🐯 Tiger Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.tigerMultiplier || 2.0}
                  onChange={(e) => setConfig((p) => ({ ...p, tigerMultiplier: parseFloat(e.target.value) || 2.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-emerald-400">🤝 Tie Multiplier</label>
                <input
                  type="number"
                  step="0.5"
                  value={config.tieMultiplier || 12.0}
                  onChange={(e) => setConfig((p) => ({ ...p, tieMultiplier: parseFloat(e.target.value) || 12.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-amber-400">👑 Suited Tie Multiplier</label>
                <input
                  type="number"
                  step="1"
                  value={config.suitedTieMultiplier || 51.0}
                  onChange={(e) => setConfig((p) => ({ ...p, suitedTieMultiplier: parseFloat(e.target.value) || 51.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: REAL-TIME BETTING CHIPS CONFIGURATION */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black font-mono text-white uppercase flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Section 3: Betting Chips Configuration (ইউজার প্যানেল চিপস নিয়ন্ত্রণ)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  এডমিন প্যানেল থেকে যে অ্যামাউন্টের চিপ রাখবেন, সেভ বাটনে ক্লিক করলে <strong>0 সেকেন্ডের মধ্যে ইউজার প্যানেলে সরাসরি লাইভ আপডেট</strong> হবে।
                </p>
              </div>

              {/* Dedicated Save Chips Button */}
              <div className="flex items-center gap-2 shrink-0">
                {chipSaveSuccess && (
                  <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>User Panel Synced (0s)!</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveChips()}
                  disabled={savingChips}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 rounded-xl font-mono text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingChips ? 'Syncing...' : 'Save Chips (0s Sync)'}</span>
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
                  placeholder="নতুন চিপ অ্যামাউন্ট (e.g. 200, 2000)"
                  value={newChipInput}
                  onChange={(e) => setNewChipInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddChip()}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="button"
                onClick={handleAddChip}
                disabled={!newChipInput.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Chip</span>
              </button>
            </div>
          </div>

          {/* SAVE ALL CONFIG BUTTON */}
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
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-mono text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/20"
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
            <Layers className="w-4 h-4 text-red-400" />
            <span>Recent Completed Rounds Audit</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Round ID</th>
                  <th className="p-3">Dragon Card</th>
                  <th className="p-3">Tiger Card</th>
                  <th className="p-3">Winning Side</th>
                  <th className="p-3">Total Bets</th>
                  <th className="p-3">Payout</th>
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
                        <span className="px-2 py-1 bg-red-950 text-red-300 border border-red-800 rounded font-black">
                          {r.dragonCard ? `${r.dragonCard.rank} ${r.dragonCard.suit}` : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-black">
                          {r.tigerCard ? `${r.tigerCard.rank} ${r.tigerCard.suit}` : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          r.winningSide === 'dragon' ? 'bg-red-600 text-white' :
                          r.winningSide === 'tiger' ? 'bg-cyan-600 text-slate-950' :
                          'bg-emerald-600 text-slate-950'
                        }`}>
                          {r.winningSide || 'COMPLETED'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        ₹{((r.totalBetsDragon || 0) + (r.totalBetsTiger || 0) + (r.totalBetsTie || 0)).toLocaleString()}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">
                        ₹{(r.totalPayout || 0).toLocaleString()}
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
              <Users className="w-4 h-4 text-red-400" />
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-500"
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
                          b.side === 'dragon' ? 'bg-red-600 text-white' :
                          b.side === 'tiger' ? 'bg-cyan-600 text-slate-950' :
                          'bg-emerald-600 text-slate-950'
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
                          b.status === 'tie_push' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
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
