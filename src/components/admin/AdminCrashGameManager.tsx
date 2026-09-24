import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Percent, ShieldCheck, Sparkles, Save, CheckCircle2, AlertTriangle, 
  RotateCcw, Sliders, Eye, Target, TrendingUp, ShieldAlert, Lock, 
  Zap, RefreshCw, BarChart2, Flame, Layers, HelpCircle, ArrowRight,
  Plane, Settings2, Activity, Radio, Clock, Users, Search, Trash2,
  TrendingDown, Award, DollarSign, History
} from 'lucide-react';
import { CrashGameConfig, CrashRound } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, limit } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';
import { DEFAULT_CRASH_CONFIG, getUniversalCrashTimeState, UniversalCrashTimeState, getSyncedCrashHistory } from '../../utils/crashGame';
import { generatePermanentUserCode } from '../../utils/databaseSync';
import { 
  CrashLiveBetItem, 
  analyzeCrashLiveBets, 
  CrashRiskAnalysis 
} from '../../utils/crashRiskEngine';

export const AdminCrashGameManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'rounds' | 'bets'>('monitor');

  const [config, setConfig] = useState<CrashGameConfig>(DEFAULT_CRASH_CONFIG);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Universal Synced 24/7 Flight State
  const [currentRoundId, setCurrentRoundId] = useState<string>('CRASH-LIVE');
  const [gamePhase, setGamePhase] = useState<'waiting' | 'flying' | 'crashed'>('waiting');
  const [liveFlightMultiplier, setLiveFlightMultiplier] = useState<number>(1.00);
  const [waitingCountdown, setWaitingCountdown] = useState<number>(5.0);
  const [universalTimeState, setUniversalTimeState] = useState<UniversalCrashTimeState | null>(null);
  const lastSavedRoundRef = useRef<string>('');

  // Live Bets Stream & Overrides
  const [liveBets, setLiveBets] = useState<CrashLiveBetItem[]>([]);
  const [isAutoLowRiskActive, setIsAutoLowRiskActive] = useState<boolean>(true);
  const [isManualOverrideEnabled, setIsManualOverrideEnabled] = useState<boolean>(false);
  const [forcedCrashMultiplier, setForcedCrashMultiplier] = useState<number | null>(null);
  const [customCrashInput, setCustomCrashInput] = useState<string>('');

  // Real-time Bet Limits Input State (0s delay sync)
  const [inputMinBet, setInputMinBet] = useState<number>(config.minBet || 10);
  const [inputMaxBet, setInputMaxBet] = useState<number>(config.maxBet || 500000);

  // History & Table States
  const [recentRounds, setRecentRounds] = useState<any[]>([]);
  const [recentBets, setRecentBets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveSearchQuery, setLiveSearchQuery] = useState<string>('');

  // Color coding round history pills (Blue <2x, Purple 2-10x, Pink >10x) matching user panel
  const getPillColor = (mult: number) => {
    if (mult >= 10.0) {
      return 'bg-pink-950/80 text-pink-300 border-pink-500/60 shadow-[0_0_10px_rgba(236,72,153,0.4)] font-black';
    }
    if (mult >= 2.0) {
      return 'bg-purple-950/80 text-purple-300 border-purple-500/50 font-bold';
    }
    return 'bg-blue-950/70 text-blue-300 border-blue-500/40 font-semibold';
  };

  // Previous 15 Rounds Multiplier History (Mirrored 1:1 with User Panel)
  const roundHistory = useMemo(() => {
    const curIdx = universalTimeState?.roundIndex ?? getUniversalCrashTimeState().roundIndex;
    const synced = getSyncedCrashHistory(curIdx, 25);
    if (recentRounds && recentRounds.length > 0) {
      const dbMults = recentRounds
        .map(r => Number(r.crashMultiplier || r.crashPoint || 0))
        .filter(m => m > 0);
      if (dbMults.length > 0) {
        const combined = [...dbMults, ...synced];
        return combined.slice(0, 15);
      }
    }
    return synced.slice(0, 15);
  }, [universalTimeState?.roundIndex, recentRounds]);

  // Real-Time Risk & Flight Curve Analysis
  const riskAnalysis: CrashRiskAnalysis = useMemo(() => {
    return analyzeCrashLiveBets(liveBets, config);
  }, [liveBets, config]);

  // 1. Synchronized Universal 24/7 Crash Game Engine Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const activeForced = isManualOverrideEnabled && typeof forcedCrashMultiplier === 'number'
        ? forcedCrashMultiplier
        : (isAutoLowRiskActive && riskAnalysis.totalBetsCount > 0 && typeof riskAnalysis.autoRecommendedCrashMultiplier === 'number'
            ? riskAnalysis.autoRecommendedCrashMultiplier
            : (config.manualForceNextMultiplier || null));

      const activeConfig: CrashGameConfig = {
        ...config,
        manualForceNextMultiplier: activeForced,
        forcedCrashMultiplier: activeForced,
        isManualOverride: isManualOverrideEnabled && typeof forcedCrashMultiplier === 'number',
        autoCrashMultiplier: (isAutoLowRiskActive && riskAnalysis.totalBetsCount > 0 && typeof riskAnalysis.autoRecommendedCrashMultiplier === 'number')
          ? riskAnalysis.autoRecommendedCrashMultiplier
          : undefined,
      } as any;

      const syncState = getUniversalCrashTimeState(Date.now(), activeConfig);
      setUniversalTimeState(syncState);
      setCurrentRoundId(syncState.roundDetails.roundId);
      setGamePhase(syncState.phase);
      setLiveFlightMultiplier(syncState.currentMultiplier);
      setWaitingCountdown(syncState.waitingCountdown);
    }, 100);

    return () => clearInterval(timer);
  }, [config, isManualOverrideEnabled, forcedCrashMultiplier, isAutoLowRiskActive, riskAnalysis]);

  // 2. Real-Time Firestore Listeners
  useEffect(() => {
    // Config listener
    const unsubConfig = onSnapshot(doc(db, 'game_settings', 'crash_game'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<CrashGameConfig>;
        setConfig((prev) => ({ ...prev, ...data }));
        if (data.manualForceNextMultiplier) {
          setForcedCrashMultiplier(Number(data.manualForceNextMultiplier));
        }
      }
    }, (err) => console.warn('Crash settings snapshot notice:', err.message));

    // Live State listener
    const unsubLiveState = onSnapshot(doc(db, 'crash_live_state', 'current_round'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setIsAutoLowRiskActive(data.isAutoLowRiskActive !== false);
        setIsManualOverrideEnabled(!!data.isManualOverride);
        if (typeof data.forcedCrashMultiplier === 'number') {
          setForcedCrashMultiplier(data.forcedCrashMultiplier);
        }
        if (data.minBet !== undefined || data.maxBet !== undefined) {
          const nextMin = data.minBet !== undefined ? Number(data.minBet) : config.minBet || 10;
          const nextMax = data.maxBet !== undefined ? Number(data.maxBet) : config.maxBet || 500000;
          setInputMinBet(nextMin);
          setInputMaxBet(nextMax);
          setConfig((prev) => ({
            ...prev,
            minBet: nextMin,
            maxBet: nextMax,
          }));
        }
      }
    }, (err) => console.warn('Crash live state notice:', err.message));

    // Live Bets listener
    const unsubLiveBets = onSnapshot(collection(db, 'crash_live_bets'), (snap) => {
      const items: CrashLiveBetItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLiveBets(items);
    }, (err) => console.warn('Crash live bets notice:', err.message));

    // Recent rounds listener
    const qRounds = query(collection(db, 'crash_rounds'), limit(25));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (b.createdAt || 0) > (a.createdAt || 0) ? -1 : 1);
      setRecentRounds(list);
    }, (err) => console.warn('Crash rounds listener notice:', err.message));

    // Recent bets ledger listener
    const qBets = query(collection(db, 'crash_bets'), limit(50));
    const unsubBets = onSnapshot(qBets, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (b.createdAt || 0) > (a.createdAt || 0) ? -1 : 1);
      setRecentBets(list);
    }, (err) => console.warn('Crash bets ledger notice:', err.message));

    return () => {
      unsubConfig();
      unsubLiveState();
      unsubLiveBets();
      unsubRounds();
      unsubBets();
    };
  }, []);

  // Keep live state updated when Auto Low Risk is active
  useEffect(() => {
    if (isAutoLowRiskActive && !isManualOverrideEnabled && riskAnalysis.autoRecommendedCrashMultiplier) {
      setDoc(doc(db, 'crash_live_state', 'current_round'), {
        isAutoLowRiskActive: true,
        isManualOverride: false,
        autoCrashMultiplier: riskAnalysis.autoRecommendedCrashMultiplier,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }
  }, [isAutoLowRiskActive, isManualOverrideEnabled, riskAnalysis.autoRecommendedCrashMultiplier]);

  // Instant 0-second Crash Now Trigger
  const handleInstantCrashNow = async () => {
    try {
      soundFx.playClick();
      await setDoc(doc(db, 'crash_live_state', 'current_round'), {
        forceInstantCrash: true,
        forcedCrashMultiplier: liveFlightMultiplier,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMessage(`💥 INSTANT CRASH TRIGGERED AT ${liveFlightMultiplier.toFixed(2)}x (0s delay applied)`);
      setTimeout(() => {
        // Reset the trigger flag
        setDoc(doc(db, 'crash_live_state', 'current_round'), {
          forceInstantCrash: false,
        }, { merge: true }).catch(() => {});
        setStatusMessage(null);
      }, 3500);
    } catch (e: any) {
      console.error('Failed to trigger instant crash:', e);
    }
  };

  // Set Target Crash Multiplier
  const handleSetTargetMultiplier = async (mult: number | null) => {
    try {
      soundFx.playClick();
      setForcedCrashMultiplier(mult);

      const isManual = mult !== null;
      setIsManualOverrideEnabled(isManual);
      if (isManual) {
        setIsAutoLowRiskActive(false);
      }

      await setDoc(doc(db, 'crash_live_state', 'current_round'), {
        isManualOverride: isManual,
        forcedCrashMultiplier: mult,
        manualForceNextMultiplier: mult,
        targetRoundId: currentRoundId,
        isAutoLowRiskActive: !isManual,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'crash_game'), {
        manualForceNextMultiplier: mult,
        forcedCrashMultiplier: mult,
        isManualOverride: isManual,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMessage(isManual ? `🎯 Forced Crash Point set to ${mult.toFixed(2)}x (0s delay applied)` : '🎲 Reset to Auto RNG / House Edge mode');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      console.error('Failed to set target multiplier:', e);
    }
  };

  // Toggle Auto Low Risk
  const handleToggleAutoLowRisk = async () => {
    try {
      soundFx.playClick();
      const nextState = !isAutoLowRiskActive;
      setIsAutoLowRiskActive(nextState);
      if (nextState) {
        setIsManualOverrideEnabled(false);
        setForcedCrashMultiplier(null);
      }

      await setDoc(doc(db, 'crash_live_state', 'current_round'), {
        isAutoLowRiskActive: nextState,
        isManualOverride: false,
        autoCrashMultiplier: riskAnalysis.autoRecommendedCrashMultiplier,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'crash_game'), {
        manualForceNextMultiplier: nextState ? riskAnalysis.autoRecommendedCrashMultiplier : null,
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
      await setDoc(doc(db, 'crash_live_state', 'current_round'), {
        houseEdgePercentage: clampedEdge,
        rtpPercentage: rtp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'crash_game'), {
        houseEdgePercentage: clampedEdge,
        rtpPercentage: rtp,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync house edge:', e);
    }
  };

  // Synchronized 24x7 Round Persistence
  useEffect(() => {
    if (
      universalTimeState?.phase === 'crashed' &&
      universalTimeState.roundDetails.roundId &&
      lastSavedRoundRef.current !== universalTimeState.roundDetails.roundId
    ) {
      lastSavedRoundRef.current = universalTimeState.roundDetails.roundId;
      const rId = universalTimeState.roundDetails.roundId;
      const crashMult = universalTimeState.roundDetails.crashMultiplier;
      const roundDoc: CrashRound = {
        id: rId,
        roundNumber: universalTimeState.roundIndex || 1,
        crashMultiplier: crashMult,
        status: 'crashed',
        startTime: universalTimeState.roundStartTimeMs,
        crashedAt: universalTimeState.crashedStartTimeMs,
        totalBetsCount: riskAnalysis.totalBetsCount,
        totalBetsAmount: riskAnalysis.totalPot,
        totalPayoutAmount: riskAnalysis.totalCashedOutPayouts,
        createdAt: new Date().toISOString(),
      };
      setDoc(doc(db, 'crash_rounds', rId), roundDoc, { merge: true }).catch(() => {});

      // Automatically reset manual override after round crashes, returning immediately to Auto Low Risk
      if (isManualOverrideEnabled) {
        setIsManualOverrideEnabled(false);
        setForcedCrashMultiplier(null);
        setIsAutoLowRiskActive(true);
        setDoc(doc(db, 'crash_live_state', 'current_round'), {
          isManualOverride: false,
          forcedCrashMultiplier: null,
          manualForceNextMultiplier: null,
          forceInstantCrash: false,
          isAutoLowRiskActive: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'game_settings', 'crash_game'), {
          isManualOverride: false,
          manualForceNextMultiplier: null,
          forcedCrashMultiplier: null,
          forceInstantCrash: false,
          rtpMode: 'house_protect',
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }
    }
  }, [universalTimeState, riskAnalysis, isManualOverrideEnabled]);

  // Handle Instant 0-second Bet Amount Limits (Min Bet / Max Bet)
  const handleUpdateBetLimits = async (minB: number, maxB: number) => {
    try {
      soundFx.playClick();
      setInputMinBet(minB);
      setInputMaxBet(maxB);

      await setDoc(doc(db, 'crash_live_state', 'current_round'), {
        minBet: minB,
        maxBet: maxB,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'game_settings', 'crash_game'), {
        minBet: minB,
        maxBet: maxB,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setConfig((prev) => ({ ...prev, minBet: minB, maxBet: maxB }));
      setStatusMessage(`🎯 এভিয়েটর বাজি সীমা সেট করা হয়েছে: সর্বনিম্ন ₹${(Number(minB) || 0).toLocaleString('en-IN')} — সর্বোচ্চ ₹${(Number(maxB) || 0).toLocaleString('en-IN')} (০ সেকেন্ডের দেরিতে কার্যকর)`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      setStatusMessage(`⚠️ এরর: ${e.message}`);
    }
  };

  // 4. Pre-Result Outcome Calculation (0s Latency Advance Prediction Engine)
  const preResult = useMemo(() => {
    let predictedMultiplier = 1.00;
    let calculationReason = 'Mathematical RTP Curve';

    if (isManualOverrideEnabled && forcedCrashMultiplier !== null) {
      predictedMultiplier = forcedCrashMultiplier;
      calculationReason = `Admin 0s Manual Force Target (${forcedCrashMultiplier.toFixed(2)}x)`;
    } else if (isAutoLowRiskActive && riskAnalysis.autoRecommendedCrashMultiplier) {
      predictedMultiplier = riskAnalysis.autoRecommendedCrashMultiplier;
      calculationReason = `Auto Low-Risk AI Guard (${predictedMultiplier.toFixed(2)}x)`;
    } else if (universalTimeState?.roundDetails?.crashMultiplier) {
      predictedMultiplier = universalTimeState.roundDetails.crashMultiplier;
      calculationReason = `RTP Algorithm (${config.rtpPercentage || 97.0}% RTP, Cap ${config.maxMultiplierCap || 100}x)`;
    }

    // Estimate liability based on current active bets if round flies to predictedMultiplier
    const totalPot = riskAnalysis.totalPot;
    const projectedLiability = liveBets.reduce((acc, b) => {
      const bAmt = Number(b.amount ?? b.betAmount) || 0;
      if (b.status === 'won' || b.status === 'cashed_out') {
        return acc + (b.wonAmount || 0);
      }
      const targetCashOut = b.autoCashOutAt || b.autoCashOutTarget;
      // If target auto cashout is below or equal to predicted multiplier, user wins
      if (targetCashOut && targetCashOut <= predictedMultiplier) {
        return acc + (bAmt * targetCashOut);
      }
      return acc;
    }, 0);

    const projectedProfit = totalPot - projectedLiability;
    const marginPercent = totalPot > 0 ? Math.round((projectedProfit / totalPot) * 100) : 100;

    return {
      predictedMultiplier,
      calculationReason,
      totalPot,
      projectedLiability,
      projectedProfit,
      marginPercent,
    };
  }, [isManualOverrideEnabled, forcedCrashMultiplier, isAutoLowRiskActive, riskAnalysis, universalTimeState, config, liveBets]);

  // Clear live bets monitoring
  const handleClearLiveBets = async () => {
    if (!confirm('Clear all live bets from monitoring stream? (This does not affect user balances)')) return;
    try {
      soundFx.playClick();
      for (const b of liveBets) {
        await deleteDoc(doc(db, 'crash_live_bets', b.id)).catch(() => {});
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
    setIsSaving(true);
    setStatusMessage(null);
    try {
      soundFx.playClick();
      const rtp = typeof config.rtpPercentage === 'number' ? config.rtpPercentage : 97.0;
      const houseEdge = typeof config.houseEdgePercentage === 'number' ? config.houseEdgePercentage : Math.round((100 - rtp) * 10) / 10;

      const updated: CrashGameConfig = {
        ...config,
        rtpPercentage: rtp,
        houseEdgePercentage: houseEdge,
        minBet: Number(config.minBet),
        maxBet: Number(config.maxBet),
        maxMultiplierCap: Number(config.maxMultiplierCap),
        roundCooldownSeconds: Number(config.roundCooldownSeconds),
        manualForceNextMultiplier: forcedCrashMultiplier,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      };

      await setDoc(doc(db, 'game_settings', 'crash_game'), updated, { merge: true });
      await setDoc(doc(db, 'crash_config', 'main'), updated, { merge: true }).catch(() => {});

      soundFx.playWin();
      setSaveSuccess(true);
      setStatusMessage('✅ Aviator configuration saved in real-time to Firestore!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving crash config:', err);
      soundFx.playLossSound();
      setStatusMessage(`❌ Failed to save: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLiveBets = liveBets.filter((b) => {
    const q = liveSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const uCode = (generatePermanentUserCode(undefined, undefined, b.userId)).toLowerCase();
    return (
      (b.userName || '').toLowerCase().includes(q) ||
      (b.userId || '').toLowerCase().includes(q) ||
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
      uCode === cleanNumericQ ||
      uCode.includes(cleanNumericQ)
    );
  });

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* HEADER BAR */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shadow-lg shadow-rose-500/10">
            <Plane className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-mono tracking-wider text-white">
                AVIATOR / CRASH LIVE RISK CONTROLLER
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
              Live Flight Monitoring • 0% - 99.9% House Edge • 0s Instant Crash Controls
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'monitor' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
            <span>Live Flight & Risk</span>
            {liveBets.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] bg-red-500 text-white font-black rounded-full">
                {liveBets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'config' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Game Math & Limits
          </button>
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rounds' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rounds ({recentRounds.length})
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bets' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bets Ledger ({recentBets.length})
          </button>
        </div>
      </div>

      {/* STATUS TOAST NOTIFICATION */}
      {statusMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-mono font-bold flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-400" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* TAB 1: LIVE MONITOR & 0S RISK CONTROLS */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">

          {/* SYNCHRONIZED UNIVERSAL LIVE FLIGHT BAR */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border font-black text-xl transition-all ${
                gamePhase === 'flying' ? 'bg-rose-600/30 border-rose-500 text-rose-400 shadow-lg shadow-rose-600/20 animate-pulse' :
                gamePhase === 'waiting' ? 'bg-amber-600/20 border-amber-500/40 text-amber-300' :
                'bg-slate-800 border-slate-700 text-slate-500'
              }`}>
                <Plane className={`w-6 h-6 ${gamePhase === 'flying' ? 'animate-bounce' : ''}`} />
                <span className="text-[10px] font-mono mt-0.5">{liveFlightMultiplier.toFixed(2)}x</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase">Flight Round:</span>
                  <span className="text-sm font-black text-rose-300">{currentRoundId}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    gamePhase === 'flying' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' :
                    gamePhase === 'waiting' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {gamePhase === 'flying' ? 'AIRBORNE' : gamePhase.toUpperCase()}
                  </span>
                  {gamePhase === 'waiting' && (
                    <span className="text-xs text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Takeoff in {waitingCountdown.toFixed(1)}s</span>
                    </span>
                  )}
                  {gamePhase === 'flying' && (
                    <span className="text-xs text-rose-400 font-black flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{liveFlightMultiplier.toFixed(2)}x</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Pot & Bettors Summary */}
            <div className="flex items-center gap-3 sm:gap-6 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Total Pot</span>
                <span className="text-base font-black text-white">₹{(Number(riskAnalysis?.totalPot) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Active In-Air</span>
                <span className="text-base font-black text-amber-400">₹{(Number(riskAnalysis?.totalActiveWagers) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Cashed Out</span>
                <span className="text-base font-black text-emerald-400">₹{(Number(riskAnalysis?.totalCashedOutPayouts) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Pilots</span>
                <span className="text-base font-black text-cyan-400">{riskAnalysis?.uniqueUsersCount || 0}</span>
              </div>
            </div>
          </div>

          {/* === PREVIOUS 15 ROUNDS MULTIPLIER HISTORY STRIP (EXACT USER PANEL DESIGN) === */}
          <div className="px-4 py-2.5 bg-[#0a0d14] border border-slate-800/80 rounded-3xl flex flex-wrap items-center justify-between gap-2.5 font-mono text-[11px] shadow-xl">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-[280px]">
              <span className="text-[10px] text-slate-400 uppercase font-black shrink-0 flex items-center gap-1.5 mr-1">
                <History className="w-3.5 h-3.5 text-rose-400" />
                <span>পূর্ববর্তী ১৫ রাউন্ড:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {roundHistory.slice(0, 15).map((mult, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded-full border text-[11px] shrink-0 transition-transform hover:scale-110 cursor-pointer ${getPillColor(mult)}`}
                    title={`Round Result: ${mult.toFixed(2)}x`}
                  >
                    {mult.toFixed(2)}x
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
              <span className="text-blue-400 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span>&lt;2x: {roundHistory.slice(0, 15).filter(m => m < 2.0).length}</span>
              </span>
              <span className="text-purple-400 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                <span>2-10x: {roundHistory.slice(0, 15).filter(m => m >= 2.0 && m < 10.0).length}</span>
              </span>
              <span className="text-pink-400 flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                <span>10x+: {roundHistory.slice(0, 15).filter(m => m >= 10.0).length}</span>
              </span>
            </div>
          </div>

          {/* 1. 24x7 REAL-TIME MIRRORED LIVE ROUND & OUTCOME DISPLAY */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  24x7 এভিয়েটর লাইভ মনিটর (ইউজার প্যানেলের সাথে 0s সিঙ্ক)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">ফ্লাইট আইডি:</span>
                <span className="font-bold text-rose-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">{currentRoundId}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Live Flight Multiplier Status */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                gamePhase === 'flying'
                  ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-400 shadow-lg shadow-rose-950/50'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-rose-400 uppercase flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5" />
                    <span>বর্তমান গুণক (LIVE MULTIPLIER)</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/40 text-rose-300 font-bold">
                    {gamePhase === 'flying' ? 'উড়ছে...' : gamePhase.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-2xl font-black text-white">{liveFlightMultiplier.toFixed(2)}x</div>
                  <div className="text-slate-400">সক্রিয় বাজি (ইন-এয়ার): <strong className="text-amber-400">₹{(Number(riskAnalysis?.totalActiveWagers) || 0).toLocaleString('en-IN')}</strong></div>
                  <div className="text-slate-400">ক্যাশ আউট সংখ্যা: <strong className="text-emerald-400">{liveBets.filter((b) => b.status === 'won' || b.status === 'cashed_out').length} জন</strong></div>
                </div>
              </div>

              {/* Takeoff Countdown & Crash Point Preview */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">ফ্লাইট সময়কাল ও অবস্থা:</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    gamePhase === 'flying' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {gamePhase === 'waiting' ? `টেকঅফ: ${waitingCountdown.toFixed(1)}s` :
                     gamePhase === 'flying' ? `ফ্লাইট টাইম: ${(universalTimeState?.flightElapsedSeconds || 0).toFixed(1)}s` : 'ক্র্যাশড (পরবর্তী রাউন্ড অপেক্ষা)'}
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-xs text-slate-400 block">পূর্ববর্তী ক্র্যাশ পয়েন্ট:</span>
                  <span className="text-base font-black text-slate-200">
                    {universalTimeState?.roundDetails?.crashMultiplier ? `${universalTimeState.roundDetails.crashMultiplier.toFixed(2)}x` : '1.00x'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex justify-between">
                  <span>সর্বোচ্চ মাল্টিপ্লায়ার ক্যাপ:</span>
                  <strong className="text-white">{config.maxMultiplierCap || 100}x</strong>
                </div>
              </div>

              {/* Instant Crash Trigger Status */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 uppercase">জরুরি ক্র্যাশ কন্ট্রোল (0s)</span>
                  <span className="text-[10px] text-slate-500 font-mono">INSTANT</span>
                </div>
                <div className="my-2">
                  <button
                    onClick={handleInstantCrashNow}
                    disabled={gamePhase !== 'flying'}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-black font-mono transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${
                      gamePhase === 'flying'
                        ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-red-600/30 active:scale-95'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-amber-300" />
                    <span>এখনই ক্র্যাশ করুন (CRASH NOW)</span>
                  </button>
                </div>
                <div className="text-[9px] text-slate-400 text-center">
                  বিমানটি উড়ন্ত অবস্থায় ক্লিক করার সাথে সাথে ইউজার স্ক্রিনে 0s এ বিমান ক্র্যাশ করবে।
                </div>
              </div>
            </div>
          </div>

          {/* 2. PRE-RESULT PREDICTIVE CALCULATION ENGINE (আগাম রেজাল্ট গণনা ও প্রিভিউ - 0s Latency) */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-900 border-2 border-rose-500/40 shadow-2xl space-y-4 font-mono relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                    <span>⚡ আগাম ক্র্যাশ পয়েন্ট গণনা ইঞ্জিন (0s Advance Prediction)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE CALCULATION
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    উড়ানের আগেই লাইভ বাজি ও এলগরিদম বিশ্লেষণ করে বিমান কত গুণকে ক্র্যাশ করবে তা আগে থেকেই নির্ধারিত থাকে।
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">ক্যালকুলেশন স্ট্যাটাস:</span>
                <span className="text-xs font-black text-emerald-400">0s সিঙ্ক সম্পন্ন</span>
              </div>
            </div>

            {/* Predicted Multiplier Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">আসন্ন নিশ্চিত ক্র্যাশ পয়েন্ট (Predicted Crash):</span>
                <div className="my-2">
                  <span className="text-2xl sm:text-3xl font-black text-rose-400 block">
                    {preResult.predictedMultiplier.toFixed(2)}x
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block mt-1">
                    ক্যালকুলেশন মেথড: <span className="text-amber-300">{preResult.calculationReason}</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                  <span>লক্ষ্যমাত্রা অবস্থা:</span>
                  <strong className={isManualOverrideEnabled ? 'text-amber-400' : isAutoLowRiskActive ? 'text-emerald-400' : 'text-cyan-400'}>
                    {isManualOverrideEnabled ? 'ADMIN FORCED' : isAutoLowRiskActive ? 'AUTO LOW RISK' : 'FAIR RTP'}
                  </strong>
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

              {/* Quick 1-Click Action to Change Predicted Crash Multiplier */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">ক্র্যাশ পয়েন্ট দ্রুত পরিবর্তন (0s Latency):</span>
                <div className="grid grid-cols-3 gap-1.5 my-2">
                  {[1.10, 1.25, 1.50, 2.00, 5.00, 10.00].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleSetTargetMultiplier(m)}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border ${
                        forcedCrashMultiplier === m ? 'bg-rose-600 text-white border-white' : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {m.toFixed(2)}x
                    </button>
                  ))}
                  <button
                    onClick={handleToggleAutoLowRisk}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black transition cursor-pointer border col-span-3 ${
                      isAutoLowRiskActive ? 'bg-emerald-600 text-white border-white' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🛡️ AUTO LOW-RISK (MAX PROFIT)
                  </button>
                </div>
                <div className="text-[9px] text-slate-500 text-center">
                  ক্লিক করার সাথে সাথে পরবর্তী ফ্লাইটের ক্র্যাশ পয়েন্ট নির্ধারিত হবে।
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
                  এভিয়েটর বাজি সীমা কন্ট্রোলার (০ সেকেন্ডে ইউজার প্যানেলে সিঙ্ক)
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
                  {[10, 20, 50, 100, 500].map((amt) => (
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
                  {[5000, 10000, 50000, 500000].map((amt) => (
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
                    onClick={handleInstantCrashNow}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] uppercase font-black transition cursor-pointer"
                  >
                    💥 Crash Immediately
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
                <h3 className="text-sm font-black font-mono text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Real-Time House Edge (0% - 99.9%) & Instant Flight Override</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Flight controls broadcast to all connected players with 0-second latency.
                </p>
              </div>

              {/* Auto Low-Risk Toggle */}
              <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
                <div className="text-right">
                  <span className="text-xs font-black text-white block">Auto Low-Risk Mode</span>
                  <span className="text-[10px] text-slate-400">Crash Before High Liability</span>
                </div>
                <button
                  onClick={handleToggleAutoLowRisk}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isAutoLowRiskActive ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  title="Auto Low Risk Mode automatically calculates maximum house profit"
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
                  <Percent className="w-3.5 h-3.5 text-rose-400" />
                  <span>House Edge Percentage (0% - 99.9%):</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">RTP: {(100 - (config.houseEdgePercentage || 3.0)).toFixed(1)}%</span>
                  <span className="px-2.5 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-lg text-sm font-black">
                    {config.houseEdgePercentage || 3.0}%
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="99.9"
                step="0.1"
                value={config.houseEdgePercentage !== undefined ? config.houseEdgePercentage : 3.0}
                onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500 uppercase">Presets:</span>
                {[
                  { label: '0% (Fair 100% RTP)', val: 0 },
                  { label: '3.0% (Standard)', val: 3.0 },
                  { label: '5.0%', val: 5.0 },
                  { label: '10.0%', val: 10.0 },
                  { label: '25.0%', val: 25.0 },
                  { label: '50.0%', val: 50.0 },
                  { label: '99.9% (Instant 1.00x Crash)', val: 99.9 },
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => handleHouseEdgeChange(p.val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                      Math.abs((config.houseEdgePercentage || 3.0) - p.val) < 0.1
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DIRECT 1-CLICK INSTANT CRASH / MULTIPLIER CONTROLLER */}
            <div className="space-y-3 font-mono border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-400" />
                  <span>Direct 1-Click Flight Interceptor (0s Latency):</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Target Point: <strong className="text-white">{forcedCrashMultiplier ? `${forcedCrashMultiplier.toFixed(2)}x` : 'AUTO / FAIR RNG'}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {/* Instant Crash Now Button */}
                <button
                  onClick={handleInstantCrashNow}
                  className="col-span-2 p-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                >
                  <Flame className="w-4 h-4 animate-bounce" />
                  <span>CRASH FLIGHT NOW</span>
                </button>

                {/* Quick Target Presets */}
                {[
                  { label: '1.00x (Instant)', val: 1.00 },
                  { label: '1.15x (Ultra Low)', val: 1.15 },
                  { label: '1.35x (Low Risk)', val: 1.35 },
                  { label: '2.00x (Double)', val: 2.00 },
                  { label: '5.00x (Mid Win)', val: 5.00 },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleSetTargetMultiplier(item.val)}
                    className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      forcedCrashMultiplier === item.val
                        ? 'bg-rose-600 text-white border-white ring-1 ring-white'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom input + reset button */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <input
                  type="number"
                  step="0.05"
                  min="1.00"
                  max="1000"
                  placeholder="Custom multiplier e.g. 1.85"
                  value={customCrashInput}
                  onChange={(e) => setCustomCrashInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 w-48"
                />
                <button
                  onClick={() => {
                    const parsed = parseFloat(customCrashInput);
                    if (!isNaN(parsed) && parsed >= 1.0) {
                      handleSetTargetMultiplier(parsed);
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Set Custom Point
                </button>
                <button
                  onClick={() => handleSetTargetMultiplier(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Reset to Auto / Fair RNG
                </button>
              </div>
            </div>

          </div>

          {/* REAL-TIME FLIGHT RISK & LIABILITY MATRIX */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-rose-400 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Flight Liability Curve & Projected House Margin</span>
              </h3>
              <span className="text-[10px] text-slate-400">
                Recommended Crash Point: <strong className="text-emerald-400">{riskAnalysis.autoRecommendedCrashMultiplier.toFixed(2)}x</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Crash Point</th>
                    <th className="p-3">Active Wagers Exposed</th>
                    <th className="p-3">Total Payout Liability</th>
                    <th className="p-3">Net House Profit</th>
                    <th className="p-3">House Margin</th>
                    <th className="p-3">Risk Rating</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {riskAnalysis?.thresholds?.map((t) => (
                    <tr key={t.multiplier} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-black text-white">{t.label}</td>
                      <td className="p-3 text-slate-300">₹{(Number(t?.activeWagersExposed) || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-rose-400 font-bold">₹{(Number(t?.totalPayoutLiability) || 0).toLocaleString('en-IN')}</td>
                      <td className={`p-3 font-black ${(t?.netHouseProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(t?.netHouseProfit || 0) >= 0 ? '+' : ''}₹{(Number(t?.netHouseProfit) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-slate-300">{t.profitMarginPercentage.toFixed(1)}%</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          t.riskRating === 'safe' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          t.riskRating === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {t.riskRating}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleSetTargetMultiplier(t.multiplier)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                            forcedCrashMultiplier === t.multiplier
                              ? 'bg-rose-600 text-white font-black'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {forcedCrashMultiplier === t.multiplier ? 'TARGETED' : 'Target'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* === 0-SECOND LATENCY EXACT USER PANEL LIVE RESULT DISPLAY WITH ROUND ID === */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
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
                    অ্যাভিয়েটর ক্র্যাশ গেম ইউজার প্যানেলের লাইভ মাল্টিপ্লায়ার ও ক্র্যাশ ফলাফল ০ সেকেন্ডের ব্যবধানে সরাসরি প্রদর্শিত।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">রাউন্ড আইডি:</span>
                  <span className="text-xs font-black text-rose-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-rose-500/30">
                    {currentRoundId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">ফ্লাইট স্ট্যাটাস:</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    gamePhase === 'crashed'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                      : gamePhase === 'flying'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {gamePhase === 'crashed' ? '💥 FLEW AWAY (ক্র্যাশড)' : gamePhase === 'flying' ? '🚀 ইন-ফ্লাইট সক্রিয়' : `⏱️ অপেক্ষা (${waitingCountdown.toFixed(1)}s)`}
                  </span>
                </div>
              </div>
            </div>

            {/* User Panel Mirrored Flight Arena */}
            <div className="bg-gradient-to-b from-slate-950 via-[#150a12] to-slate-950 border-2 border-rose-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden text-center">
              {/* Background flight grid lines */}
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:16px_16px]" />

              {gamePhase === 'crashed' ? (
                <div className="relative z-10 space-y-3 animate-in zoom-in-95 duration-150 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs sm:text-sm font-black tracking-widest text-rose-500 uppercase">
                      FLEW AWAY!
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 border border-rose-600 text-rose-300 font-bold uppercase">
                      ফাইনাল ক্র্যাশ রেজাল্ট
                    </span>
                  </div>

                  <div className="text-5xl sm:text-6xl md:text-7xl font-black font-mono tracking-tight text-rose-500 drop-shadow-[0_0_35px_rgba(225,29,72,0.85)]">
                    {(universalTimeState?.roundDetails?.crashMultiplier || liveFlightMultiplier).toFixed(2)}x
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <div className="text-xs text-slate-300">
                      রাউন্ড আইডি: <strong className="text-white font-mono">{currentRoundId}</strong>
                    </div>
                    <div className="w-px h-4 bg-slate-800" />
                    <div className="text-xs text-slate-300">
                      ক্র্যাশ পয়েন্ট: <span className={`px-2 py-0.5 rounded font-black text-xs ${
                        (universalTimeState?.roundDetails?.crashMultiplier || liveFlightMultiplier) >= 10
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : (universalTimeState?.roundDetails?.crashMultiplier || liveFlightMultiplier) >= 2
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {(universalTimeState?.roundDetails?.crashMultiplier || liveFlightMultiplier).toFixed(2)}x
                      </span>
                    </div>
                    <div className="w-px h-4 bg-slate-800" />
                    <div className="text-[10px] text-emerald-400 font-bold">
                      0s DELAY EXACT USER MIRROR
                    </div>
                  </div>
                </div>
              ) : gamePhase === 'flying' ? (
                <div className="relative z-10 space-y-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <Plane className="w-5 h-5 text-emerald-400 animate-bounce" />
                    <span className="text-xs sm:text-sm font-black tracking-widest text-emerald-400 uppercase">
                      PLANE FLYING...
                    </span>
                  </div>

                  <div className="text-5xl sm:text-6xl md:text-7xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_30px_rgba(16,185,129,0.7)]">
                    {liveFlightMultiplier.toFixed(2)}x
                  </div>

                  <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                    <span>লাইভ মাল্টিপ্লায়ার উঠছে</span>
                    <span>•</span>
                    <span>টার্গেটেড ক্র্যাশ: <strong className="text-rose-400">{(universalTimeState?.roundDetails?.crashMultiplier || 1.00).toFixed(2)}x</strong></span>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 space-y-3 py-4">
                  <div className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>WAITING FOR NEXT ROUND</span>
                  </div>

                  <div className="text-3xl sm:text-4xl font-black font-mono text-white">
                    {waitingCountdown.toFixed(1)}s
                  </div>

                  {/* Progress bar */}
                  <div className="max-w-xs mx-auto h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-100"
                      style={{ width: `${Math.min(100, Math.max(0, ((5.0 - waitingCountdown) / 5.0) * 100))}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-400">
                    পরবর্তী রাউন্ড শুরু হচ্ছে • রাউন্ড আইডি: <strong className="text-white font-mono">{currentRoundId}</strong>
                  </div>
                </div>
              )}

              {/* Recent crash multiplier history bar mirroring user panel */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-black shrink-0 flex items-center gap-1">
                  <History className="w-3 h-3 text-rose-400" />
                  <span>পূর্ববর্তী ১৫ রাউন্ড:</span>
                </span>
                {roundHistory.slice(0, 15).map((mult, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded-full border text-[11px] shrink-0 font-mono transition-transform hover:scale-110 cursor-pointer ${getPillColor(mult)}`}
                    title={`Round Result: ${mult.toFixed(2)}x`}
                  >
                    {mult.toFixed(2)}x
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* REAL-TIME LIVE BETS STREAM TABLE */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-black text-white uppercase">
                  Real-Time Live Pilots Stream ({liveBets.length})
                </h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search pilot or code..."
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
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
                    <th className="p-3">Pilot</th>
                    <th className="p-3">Panel</th>
                    <th className="p-3">Wager Amount</th>
                    <th className="p-3">Auto Cashout Target</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Cashed Multiplier</th>
                    <th className="p-3">Won Payout</th>
                    <th className="p-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLiveBets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No active live bets in this flight yet. Bets stream here in real time as players hit bet.
                      </td>
                    </tr>
                  ) : (
                    filteredLiveBets.map((b) => {
                      const uCode = generatePermanentUserCode(undefined, undefined, b.userId);
                      const amt = Number(b.amount ?? b.betAmount) || 0;
                      return (
                        <tr key={b.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <span className="font-bold text-white">{b.userName || 'Pilot'}</span>
                            <span className="block text-[9px] text-slate-500">#{uCode}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold">
                              Panel {b.panel || 1}
                            </span>
                          </td>
                          <td className="p-3 text-white font-bold">₹{(Number(amt) || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-400">
                            {b.autoCashOutTarget || b.autoCashOutAt ? `${Number(b.autoCashOutTarget || b.autoCashOutAt).toFixed(2)}x` : 'Manual'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              b.status === 'won' || b.status === 'cashed_out' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              b.status === 'crashed' || b.status === 'lost' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            }`}>
                              {b.status === 'won' || b.status === 'cashed_out' ? 'CASHED OUT' :
                               b.status === 'crashed' || b.status === 'lost' ? 'CRASHED' : 'IN AIR'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 font-bold">
                            {b.cashOutMultiplier ? `${Number(b.cashOutMultiplier).toFixed(2)}x` : '-'}
                          </td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {b.wonAmount ? `₹${Number(b.wonAmount).toLocaleString('en-IN')}` : '₹0'}
                          </td>
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
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <h3 className="text-sm font-black font-mono text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>1. Basic Aviator Rules & Engine Limits</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              
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

              {/* Min Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white">Min Bet (₹)</label>
                <input
                  type="number"
                  value={config.minBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, minBet: parseInt(e.target.value, 10) || 10 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Max Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white">Max Bet (₹)</label>
                <input
                  type="number"
                  value={config.maxBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxBet: parseInt(e.target.value, 10) || 50000 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Max Multiplier Cap */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white">Max Multiplier Cap</label>
                <input
                  type="number"
                  value={config.maxMultiplierCap || 1000}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxMultiplierCap: parseFloat(e.target.value) || 1000 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Round Cooldown (Waiting Seconds) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white">Round Cooldown (Seconds)</label>
                <input
                  type="number"
                  value={config.roundCooldownSeconds || 5}
                  onChange={(e) => setConfig((prev) => ({ ...prev, roundCooldownSeconds: parseInt(e.target.value, 10) || 5 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Simulated Community Bots */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Community Aviator Bots</h4>
                  <p className="text-[10px] text-slate-400">Display active simulated player bets</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, simulatedBotsEnabled: !prev.simulatedBotsEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.simulatedBotsEnabled !== false ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    config.simulatedBotsEnabled !== false ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

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
              disabled={isSaving}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-mono text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: ROUNDS HISTORY */}
      {activeTab === 'rounds' && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 font-mono">
          <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-rose-400" />
            <span>Recent Completed Flights Audit</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Round ID</th>
                  <th className="p-3">Crash Multiplier</th>
                  <th className="p-3">Total Bets Wagered</th>
                  <th className="p-3">Total Payouts Won</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentRounds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No recorded crash rounds yet.
                    </td>
                  </tr>
                ) : (
                  recentRounds.map((r, i) => (
                    <tr key={r.roundId || i} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-300">{r.roundId || `CRASH-ROUND-${i}`}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-black ${
                          Number(r.crashMultiplier || 1.0) >= 2.0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {Number(r.crashMultiplier || 1.0).toFixed(2)}x
                        </span>
                      </td>
                      <td className="p-3 text-white">₹{Number(r.totalBetsAmount || 0).toLocaleString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">₹{Number(r.totalPayoutAmount || 0).toLocaleString()}</td>
                      <td className="p-3 text-slate-500 text-[10px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : '-'}
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
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-400" />
              <span>Pilot Bets Ledger</span>
            </h3>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pilot or round..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Pilot</th>
                  <th className="p-3">Round</th>
                  <th className="p-3">Panel</th>
                  <th className="p-3">Bet Amount</th>
                  <th className="p-3">Cashed At</th>
                  <th className="p-3">Won Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No pilot bets matching search found.
                    </td>
                  </tr>
                ) : (
                  filteredBets.map((b, i) => (
                    <tr key={b.id || i} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <span className="font-bold text-white">{b.userName || 'Pilot'}</span>
                        {b.userId && <span className="block text-[9px] text-slate-500">{b.userId}</span>}
                      </td>
                      <td className="p-3 text-slate-400">{b.roundId}</td>
                      <td className="p-3 text-slate-300">Panel {b.panel || 1}</td>
                      <td className="p-3 text-white font-bold">₹{Number(b.betAmount || 0).toLocaleString()}</td>
                      <td className="p-3 text-slate-300 font-bold">
                        {b.cashOutMultiplier ? `${Number(b.cashOutMultiplier).toFixed(2)}x` : '-'}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">
                        {b.wonAmount ? `+₹${Number(b.wonAmount).toLocaleString()}` : '₹0'}
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
                        {b.date || (b.createdAt ? new Date(b.createdAt).toLocaleTimeString() : '-')}
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
