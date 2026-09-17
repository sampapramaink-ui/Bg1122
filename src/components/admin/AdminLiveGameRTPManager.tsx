import React, { useState, useEffect } from 'react';
import { 
  Percent, ShieldCheck, Sparkles, Save, CheckCircle2, AlertTriangle, 
  RotateCcw, Sliders, Eye, Target, TrendingUp, 
  ShieldAlert, Lock, Zap, RefreshCw, BarChart2, Flame, Layers, Dices, 
  Settings2, Activity, HelpCircle, ArrowRight
} from 'lucide-react';
import { LiveGameRtpSettings } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';

export const DEFAULT_RTP_SETTINGS: Record<string, LiveGameRtpSettings> = {
  roulette: {
    id: 'roulette',
    gameName: 'Live European Roulette 3D',
    rtpPercentage: 97.3,
    houseEdgePercentage: 2.7,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 2.7,
    multiplierPrimary: 36.0, // Straight-up
    multiplierSecondary: 2.0, // Red/Black/Even/Odd
    notes: 'European single-zero wheel with natural 2.70% house edge.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  },
  dragon_tiger: {
    id: 'dragon_tiger',
    gameName: 'Live Dragon Tiger Asian Classic',
    rtpPercentage: 96.8,
    houseEdgePercentage: 3.2,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 3.2,
    multiplierPrimary: 2.0, // Dragon / Tiger (1:1)
    multiplierSecondary: 2.0,
    multiplierSpecial: 9.0, // Tie (8:1)
    notes: '2-card high rank showdown with 8:1 Tie payout.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  },
  andar_bahar: {
    id: 'andar_bahar',
    gameName: 'Live Andar Bahar HD Casino',
    rtpPercentage: 96.5,
    houseEdgePercentage: 3.5,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 3.5,
    multiplierPrimary: 1.95, // Andar
    multiplierSecondary: 2.0,  // Bahar
    notes: 'Standard 52-card Asian card match duel.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  },
  crash: {
    id: 'crash',
    gameName: 'Live Aviator Crash Game',
    rtpPercentage: 97.0,
    houseEdgePercentage: 3.0,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 3.0,
    multiplierPrimary: 1000.0,
    multiplierSecondary: 1.0,
    notes: 'High-altitude exponential curve crash rocket with auto-cashout.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  }
};

export const AdminLiveGameRTPManager: React.FC = () => {
  const [activeGame, setActiveGame] = useState<'roulette' | 'andar_bahar' | 'dragon_tiger' | 'crash'>('roulette');
  const [settings, setSettings] = useState<Record<string, LiveGameRtpSettings>>(() => {
    try {
      const cached = localStorage.getItem('bg_game_settings_cache');
      if (cached) {
        return { ...DEFAULT_RTP_SETTINGS, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('Failed to parse cached game_settings:', e);
    }
    return DEFAULT_RTP_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Forced Next Outcomes State for Live Games
  const [forcedRouletteNumber, setForcedRouletteNumber] = useState<number | null>(null);
  const [forcedDtWinner, setForcedDtWinner] = useState<'dragon' | 'tiger' | 'tie' | 'random'>('random');
  const [forcedAbWinner, setForcedAbWinner] = useState<'andar' | 'bahar' | 'random'>('random');
  const [forcedCrashMultiplier, setForcedCrashMultiplier] = useState<string>('');

  // Real-time Firestore sync on `game_settings` collection
  useEffect(() => {
    const unsubRoulette = onSnapshot(doc(db, 'game_settings', 'roulette'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiveGameRtpSettings>;
        setSettings((prev) => ({
          ...prev,
          roulette: { ...prev.roulette, ...data }
        }));
      }
    }, (err) => console.warn('game_settings roulette listener notice:', err.message));

    const unsubAndarBahar = onSnapshot(doc(db, 'game_settings', 'andar_bahar'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiveGameRtpSettings>;
        setSettings((prev) => ({
          ...prev,
          andar_bahar: { ...prev.andar_bahar, ...data }
        }));
      }
    }, (err) => console.warn('game_settings andar_bahar listener notice:', err.message));

    const unsubDragonTiger = onSnapshot(doc(db, 'game_settings', 'dragon_tiger'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiveGameRtpSettings>;
        setSettings((prev) => ({
          ...prev,
          dragon_tiger: { ...prev.dragon_tiger, ...data }
        }));
      }
    }, (err) => console.warn('game_settings dragon_tiger listener notice:', err.message));

    const unsubCrash = onSnapshot(doc(db, 'game_settings', 'crash_game'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setSettings((prev) => ({
          ...prev,
          crash: { 
            ...prev.crash, 
            rtpPercentage: data.rtpPercentage !== undefined ? data.rtpPercentage : prev.crash?.rtpPercentage ?? 97,
            houseEdgePercentage: data.houseEdgePercentage !== undefined ? data.houseEdgePercentage : (100 - (data.rtpPercentage ?? 97)),
            isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.crash?.isEnabled ?? true,
            minBet: data.minBet !== undefined ? data.minBet : prev.crash?.minBet ?? 10,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.crash?.maxBet ?? 50000
          }
        }));
        if (data.manualForceNextMultiplier) {
          setForcedCrashMultiplier(data.manualForceNextMultiplier.toString());
        }
      }
    }, (err) => console.warn('game_settings crash listener notice:', err.message));

    // Listen to Roulette config for forced number
    const unsubRouletteConfig = onSnapshot(doc(db, 'roulette_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.manualNextNumberActive && typeof data.manualNextNumber === 'number') {
          setForcedRouletteNumber(data.manualNextNumber);
        } else {
          setForcedRouletteNumber(null);
        }
      }
    }, (err) => console.warn('roulette_config listener notice:', err.message));

    return () => {
      unsubRoulette();
      unsubAndarBahar();
      unsubDragonTiger();
      unsubCrash();
      unsubRouletteConfig();
    };
  }, []);

  const currentSetting = settings[activeGame] || DEFAULT_RTP_SETTINGS[activeGame] || DEFAULT_RTP_SETTINGS.roulette;

  // Handle RTP change (0% to 99.9%, dynamically calculates House Edge = 100 - RTP)
  const handleRtpChange = (newRtp: number) => {
    const clampedRtp = Math.max(0, Math.min(99.9, Math.round(newRtp * 10) / 10));
    const calculatedEdge = Math.round((100 - clampedRtp) * 10) / 10;
    
    setSettings((prev) => ({
      ...prev,
      [activeGame]: {
        ...prev[activeGame],
        rtpPercentage: clampedRtp,
        houseEdgePercentage: calculatedEdge,
        targetProfitMargin: calculatedEdge
      }
    }));
  };

  // Handle House Edge change (dynamically adjusts RTP = 100 - House Edge)
  const handleHouseEdgeChange = (newEdge: number) => {
    const clampedEdge = Math.max(0.1, Math.min(100, Math.round(newEdge * 10) / 10));
    const calculatedRtp = Math.max(0, Math.min(99.9, Math.round((100 - clampedEdge) * 10) / 10));
    
    setSettings((prev) => ({
      ...prev,
      [activeGame]: {
        ...prev[activeGame],
        houseEdgePercentage: clampedEdge,
        rtpPercentage: calculatedRtp,
        targetProfitMargin: clampedEdge
      }
    }));
  };

  // Quick Action: Force Winning Result for Active Game
  const handleForceResult = async (gameType: string, forcedValue: any) => {
    soundFx.playClick();
    try {
      if (gameType === 'roulette') {
        if (forcedValue === null || forcedValue === 'random') {
          setForcedRouletteNumber(null);
          await setDoc(doc(db, 'roulette_config', 'main'), {
            manualNextNumberActive: false,
            manualNextNumber: null,
            rtpMode: 'european_standard'
          }, { merge: true });
          await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
            isManualOverride: false,
            manualWinningNumber: null,
            isAutoLowRiskEnabled: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          await setDoc(doc(db, 'game_settings', 'roulette'), {
            manualForceWinner: null,
            rtpMode: 'european_standard',
            updatedAt: new Date().toISOString()
          }, { merge: true });
          setStatusMessage('Roulette: Result reset to Fair RNG / Synced seed!');
        } else {
          const num = Number(forcedValue);
          setForcedRouletteNumber(num);
          await setDoc(doc(db, 'roulette_config', 'main'), {
            manualNextNumberActive: true,
            manualNextNumber: num,
            rtpMode: 'manual_next_number'
          }, { merge: true });
          await setDoc(doc(db, 'roulette_live_state', 'current_round'), {
            isManualOverride: true,
            isAutoLowRiskEnabled: false,
            manualWinningNumber: num,
            predeterminedWinningNumber: num,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          await setDoc(doc(db, 'game_settings', 'roulette'), {
            manualForceWinner: num,
            rtpMode: 'manual_force',
            updatedAt: new Date().toISOString()
          }, { merge: true });
          setStatusMessage(`Roulette: Forced next winning number to Pocket #${num}!`);
        }
      } else if (gameType === 'dragon_tiger') {
        setForcedDtWinner(forcedValue);
        await setDoc(doc(db, 'dragon_tiger_config', 'main'), {
          rtpMode: forcedValue === 'random' ? 'fair_rng' : 'manual_force_winner',
          manualForceWinner: forcedValue
        }, { merge: true });
        await setDoc(doc(db, 'game_settings', 'dragon_tiger'), {
          rtpMode: forcedValue === 'random' ? 'fair_rng' : 'manual_force',
          manualForceTarget: forcedValue
        }, { merge: true });
        setStatusMessage(`Dragon Tiger: Forced next winner to ${forcedValue.toUpperCase()}!`);
      } else if (gameType === 'andar_bahar') {
        setForcedAbWinner(forcedValue);
        await setDoc(doc(db, 'andar_bahar_config', 'main'), {
          rtpMode: forcedValue === 'random' ? 'fair_rng' : 'manual_force_winner',
          manualForceWinner: forcedValue
        }, { merge: true });
        await setDoc(doc(db, 'game_settings', 'andar_bahar'), {
          rtpMode: forcedValue === 'random' ? 'fair_rng' : 'manual_force',
          manualForceTarget: forcedValue
        }, { merge: true });
        setStatusMessage(`Andar Bahar: Forced next winner to ${forcedValue.toUpperCase()}!`);
      } else if (gameType === 'crash') {
        const val = forcedValue === 'random' || forcedValue === null ? null : parseFloat(forcedValue);
        setForcedCrashMultiplier(val ? val.toString() : '');
        await setDoc(doc(db, 'game_settings', 'crash_game'), {
          manualForceNextMultiplier: val
        }, { merge: true });
        await setDoc(doc(db, 'crash_config', 'main'), {
          manualForceNextMultiplier: val
        }, { merge: true });
        setStatusMessage(val ? `Aviator Crash: Forced next crash point to ${val.toFixed(2)}x!` : 'Aviator Crash: Reset to RTP Curve!');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setStatusMessage(null);
      }, 4000);
    } catch (e: any) {
      console.error('Error forcing result:', e);
      setStatusMessage(`Failed to set result: ${e.message}`);
    }
  };

  // Save changes to Firestore collection `game_settings` & backward-compatible documents
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    soundFx.playClick();

    try {
      const nowIso = new Date().toISOString();
      const updatedCurrent: LiveGameRtpSettings = {
        ...currentSetting,
        updatedAt: nowIso,
        updatedBy: 'Admin'
      };

      // 1. Primary write to `game_settings` collection
      const targetCollectionDoc = activeGame === 'crash' ? 'crash_game' : activeGame;
      await setDoc(doc(db, 'game_settings', targetCollectionDoc), updatedCurrent, { merge: true });

      // 2. Backward compatibility writes to legacy config docs
      if (activeGame === 'roulette') {
        await setDoc(doc(db, 'roulette_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          rtpMode: updatedCurrent.rtpMode === 'fair_rng' ? 'european_standard' : updatedCurrent.rtpMode === 'house_protect' ? 'house_protection' : 'custom_rtp',
          isRouletteEnabled: updatedCurrent.isEnabled,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          lastUpdated: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      } else if (activeGame === 'andar_bahar') {
        await setDoc(doc(db, 'andar_bahar_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          rtpMode: updatedCurrent.rtpMode === 'house_protect' ? 'house_protect' : updatedCurrent.rtpMode === 'manual_force' ? 'manual_force_winner' : 'fair_rng',
          isEnabled: updatedCurrent.isEnabled,
          andarMultiplier: updatedCurrent.multiplierPrimary || 1.95,
          baharMultiplier: updatedCurrent.multiplierSecondary || 2.0,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          updatedAt: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      } else if (activeGame === 'dragon_tiger') {
        await setDoc(doc(db, 'dragon_tiger_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          rtpMode: updatedCurrent.rtpMode === 'house_protect' ? 'house_protect' : updatedCurrent.rtpMode === 'manual_force' ? 'manual_force_winner' : 'fair_rng',
          isEnabled: updatedCurrent.isEnabled,
          dragonMultiplier: updatedCurrent.multiplierPrimary || 2.0,
          tigerMultiplier: updatedCurrent.multiplierSecondary || 2.0,
          tieMultiplier: updatedCurrent.multiplierSpecial || 9.0,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          updatedAt: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      } else if (activeGame === 'crash') {
        await setDoc(doc(db, 'crash_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          isEnabled: updatedCurrent.isEnabled,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          updatedAt: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      }

      // Update local storage cache
      try {
        localStorage.setItem('bg_game_settings_cache', JSON.stringify(settings));
        localStorage.setItem(`bg_game_settings_${activeGame}`, JSON.stringify(updatedCurrent));
      } catch (_) {}

      setSaveSuccess(true);
      setStatusMessage(`Real-time RTP settings for ${updatedCurrent.gameName} updated successfully in Firestore collection 'game_settings'!`);
      soundFx.playCoin();

      setTimeout(() => {
        setSaveSuccess(false);
        setStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving game_settings:', err);
      setStatusMessage(`Failed to save settings: ${err.message || 'Firestore error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default settings
  const handleResetToDefaults = () => {
    soundFx.playClick();
    if (window.confirm(`Reset ${currentSetting.gameName} RTP to standard default values?`)) {
      const defaults = DEFAULT_RTP_SETTINGS[activeGame];
      setSettings((prev) => ({
        ...prev,
        [activeGame]: { ...defaults }
      }));
      setStatusMessage('Reset to defaults in local state. Click "Save Real-Time Settings" to persist.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Percent className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                Live Games RTP & House Edge Controller
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                collection: game_settings
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly hidden from standard user interface. Real-time probability algorithms, house edge controls (0-99% RTP) & instant draw results.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefaults}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-amber-500 hover:from-indigo-400 hover:to-amber-400 text-slate-950 text-xs font-mono font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved to Firestore!' : 'Save Real-Time Settings'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-3 animate-in fade-in duration-200 ${
          saveSuccess 
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
            : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
        }`}>
          {saveSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0" />}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Live Games Selector Tabs (All 4 Live Games) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'roulette', label: 'Roulette 3D', icon: Dices, color: 'from-amber-950/60 to-slate-900 border-amber-500/30' },
          { id: 'dragon_tiger', label: 'Dragon Tiger', icon: Flame, color: 'from-rose-950/60 to-slate-900 border-rose-500/30' },
          { id: 'andar_bahar', label: 'Andar Bahar', icon: Layers, color: 'from-emerald-950/60 to-slate-900 border-emerald-500/30' },
          { id: 'crash', label: 'Aviator Crash', icon: Zap, color: 'from-cyan-950/60 to-slate-900 border-cyan-500/30' },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeGame === item.id;
          const gameSetting = settings[item.id] || DEFAULT_RTP_SETTINGS[item.id] || DEFAULT_RTP_SETTINGS.roulette;

          return (
            <button
              key={item.id}
              onClick={() => {
                soundFx.playClick();
                setActiveGame(item.id as typeof activeGame);
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-b from-indigo-900/60 via-slate-900 to-slate-950 border-indigo-400 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    isActive ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {item.label}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      RTP: <span className="font-mono font-black text-amber-400">{gameSetting.rtpPercentage}%</span>
                    </p>
                  </div>
                </div>

                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold border ${
                  gameSetting.isEnabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {gameSetting.isEnabled ? 'ON' : 'OFF'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-800/60">
                <span>Edge: <strong className="text-rose-400">{gameSetting.houseEdgePercentage}%</strong></span>
                <span>Mode: <strong className="text-slate-300 capitalize">{gameSetting.rtpMode}</strong></span>
              </div>

              {isActive && (
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent mt-2" />
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN SETTINGS & RESULT CONTROL PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: RTP & House Edge Dual Interactive Sliders + Manual Result Rigging */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. RTP & House Edge Calibration */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase">
                    RTP (0-99%) & House Edge Calibration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dual mathematical synchronizer for {currentSetting.gameName}
                  </p>
                </div>
              </div>

              {/* Master Game Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-mono font-bold text-slate-400">Game Status:</span>
                <input
                  type="checkbox"
                  checked={currentSetting.isEnabled}
                  onChange={(e) => {
                    soundFx.playClick();
                    setSettings((prev) => ({
                      ...prev,
                      [activeGame]: { ...prev[activeGame], isEnabled: e.target.checked }
                    }));
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            {/* Visual Gauge Comparison */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  RTP to Players: {currentSetting.rtpPercentage}%
                </span>
                <span className="text-rose-400 font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                  Casino House Edge: {currentSetting.houseEdgePercentage}%
                </span>
              </div>

              <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 relative group"
                  style={{ width: `${currentSetting.rtpPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300"
                  style={{ width: `${currentSetting.houseEdgePercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>0% RTP (100% Casino Win / Zero Player Payout)</span>
                <span>99% RTP (Max Fair Player Payout)</span>
              </div>
            </div>

            {/* RTP Slider & Direct Input (0% to 99%) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Return To Player (RTP: 0% - 99%)
                  </label>
                  <p className="text-[11px] text-slate-400">Total expected payout returned to players over time</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99.9"
                    step="0.1"
                    value={currentSetting.rtpPercentage}
                    onChange={(e) => handleRtpChange(parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right font-mono font-black text-sm text-emerald-400 focus:border-emerald-400 outline-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-400">%</span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="99.9"
                step="0.1"
                value={currentSetting.rtpPercentage}
                onChange={(e) => handleRtpChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />

              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-500">
                {[0, 10, 25, 50, 75, 90, 95, 97.3, 99].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleRtpChange(preset)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      Math.abs(currentSetting.rtpPercentage - preset) < 0.1
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset === 0 ? '0% (Max Profit)' : `${preset}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* House Edge Slider & Direct Input */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Casino House Edge % (100 - RTP)
                  </label>
                  <p className="text-[11px] text-slate-400">Mathematical statistical profit retained by casino</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={currentSetting.houseEdgePercentage}
                    onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value) || 0.1)}
                    className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right font-mono font-black text-sm text-rose-400 focus:border-rose-400 outline-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-400">%</span>
                </div>
              </div>

              <input
                type="range"
                min="0.1"
                max="100"
                step="0.1"
                value={currentSetting.houseEdgePercentage}
                onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />

              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-500">
                {[1.0, 2.7, 3.5, 5.0, 10.0, 25.0, 50.0, 75.0, 100.0].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleHouseEdgeChange(preset)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      Math.abs(currentSetting.houseEdgePercentage - preset) < 0.1
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset}% Edge
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. DIRECT RESULT FORCING / DRAW RESULT OVERRIDE */}
          <div className="p-6 bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase flex items-center gap-2">
                    <span>Live Draw Result Rigging & Override</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      1-CLICK FORCE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Directly force the exact winning outcome for the current or upcoming draw number
                  </p>
                </div>
              </div>
            </div>

            {/* ROULETTE FORCE RESULT */}
            {activeGame === 'roulette' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300">
                    Selected Forced Number:{' '}
                    <strong className="text-amber-400 font-black">
                      {forcedRouletteNumber !== null ? `${forcedRouletteNumber} (ACTIVE)` : 'None (Fair Synced)'}
                    </strong>
                  </span>
                  <button
                    onClick={() => handleForceResult('roulette', null)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Clear / Fair RNG
                  </button>
                </div>

                {/* 37 Number Clickable Grid */}
                <div className="grid grid-cols-7 sm:grid-cols-13 gap-1.5 font-mono text-xs">
                  <button
                    onClick={() => handleForceResult('roulette', 0)}
                    className={`p-2 rounded-lg font-bold border transition-all cursor-pointer ${
                      forcedRouletteNumber === 0
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg scale-105'
                        : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                    }`}
                  >
                    0
                  </button>
                  {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                    const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
                    const isSelected = forcedRouletteNumber === n;
                    return (
                      <button
                        key={n}
                        onClick={() => handleForceResult('roulette', n)}
                        className={`p-2 rounded-lg font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg scale-105 font-black'
                            : isRed
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DRAGON TIGER FORCE RESULT */}
            {activeGame === 'dragon_tiger' && (
              <div className="space-y-3">
                <span className="text-xs font-mono text-slate-300 block">
                  Click to Force Next Dragon Tiger Round Outcome:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                  <button
                    onClick={() => handleForceResult('dragon_tiger', 'dragon')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedDtWinner === 'dragon'
                        ? 'bg-red-500 text-slate-950 border-red-300 shadow-lg font-black'
                        : 'bg-red-950/40 text-red-300 border-red-800/60 hover:bg-red-900/40'
                    }`}
                  >
                    <span className="text-base">🐉</span>
                    <span>FORCE DRAGON</span>
                  </button>

                  <button
                    onClick={() => handleForceResult('dragon_tiger', 'tiger')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedDtWinner === 'tiger'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg font-black'
                        : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40'
                    }`}
                  >
                    <span className="text-base">🐅</span>
                    <span>FORCE TIGER</span>
                  </button>

                  <button
                    onClick={() => handleForceResult('dragon_tiger', 'tie')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedDtWinner === 'tie'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg font-black'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
                    }`}
                  >
                    <span className="text-base">🟢</span>
                    <span>FORCE TIE (8:1)</span>
                  </button>

                  <button
                    onClick={() => handleForceResult('dragon_tiger', 'random')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedDtWinner === 'random'
                        ? 'bg-slate-700 text-white border-slate-500 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">🎲</span>
                    <span>FAIR RNG</span>
                  </button>
                </div>
              </div>
            )}

            {/* ANDAR BAHAR FORCE RESULT */}
            {activeGame === 'andar_bahar' && (
              <div className="space-y-3">
                <span className="text-xs font-mono text-slate-300 block">
                  Click to Force Next Andar Bahar Round Outcome:
                </span>
                <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
                  <button
                    onClick={() => handleForceResult('andar_bahar', 'andar')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedAbWinner === 'andar'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-lg font-black'
                        : 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60 hover:bg-cyan-900/40'
                    }`}
                  >
                    <span className="text-base">🔵</span>
                    <span>FORCE ANDAR</span>
                  </button>

                  <button
                    onClick={() => handleForceResult('andar_bahar', 'bahar')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedAbWinner === 'bahar'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg font-black'
                        : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40'
                    }`}
                  >
                    <span className="text-base">🔴</span>
                    <span>FORCE BAHAR</span>
                  </button>

                  <button
                    onClick={() => handleForceResult('andar_bahar', 'random')}
                    className={`p-3 rounded-xl border font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      forcedAbWinner === 'random'
                        ? 'bg-slate-700 text-white border-slate-500 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">🎲</span>
                    <span>FAIR RNG</span>
                  </button>
                </div>
              </div>
            )}

            {/* AVIATOR CRASH FORCE MULTIPLIER */}
            {activeGame === 'crash' && (
              <div className="space-y-3">
                <span className="text-xs font-mono text-slate-300 block">
                  Quick Force Next Aviator Crash Multiplier:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  {[
                    { label: '1.00x (Instant Crash)', val: 1.00, color: 'text-rose-400 border-rose-500/40' },
                    { label: '1.20x (Early Bail)', val: 1.20, color: 'text-amber-400 border-amber-500/40' },
                    { label: '2.50x (Medium)', val: 2.50, color: 'text-cyan-400 border-cyan-500/40' },
                    { label: '10.00x (High Rocket)', val: 10.00, color: 'text-emerald-400 border-emerald-500/40' },
                    { label: '50.00x (Mega Flight)', val: 50.00, color: 'text-purple-400 border-purple-500/40' },
                    { label: '100.00x (Moon Shot)', val: 100.00, color: 'text-pink-400 border-pink-500/40' },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => handleForceResult('crash', btn.val)}
                      className={`p-2.5 rounded-xl border bg-slate-950 font-bold transition-all cursor-pointer hover:bg-slate-800 ${btn.color} ${
                        forcedCrashMultiplier === btn.val.toString() ? 'bg-indigo-500/30 font-black border-indigo-400' : ''
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                  
                  {/* Custom Multiplier Input */}
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="1.00"
                      placeholder="Custom Multiplier (e.g. 7.77)"
                      value={forcedCrashMultiplier}
                      onChange={(e) => setForcedCrashMultiplier(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white focus:border-cyan-400 outline-none"
                    />
                    <button
                      onClick={() => handleForceResult('crash', forcedCrashMultiplier)}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs font-mono rounded-xl cursor-pointer"
                    >
                      Set
                    </button>
                    <button
                      onClick={() => handleForceResult('crash', null)}
                      className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-mono rounded-xl cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* 3. RTP Strategy Modes */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  Probability Algorithm Strategy
                </h3>
                <p className="text-xs text-slate-400">Controls how outcomes are generated in live gameplay</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  id: 'fair_rng',
                  name: 'Natural Fair RNG (Standard)',
                  desc: 'True certified random number generation matching European/Asian physical casino decks/wheel.',
                  icon: Sparkles,
                  color: 'border-indigo-500/30 text-indigo-300'
                },
                {
                  id: 'house_protect',
                  name: 'Dynamic House Protection',
                  desc: 'Real-time table liability sensor. Dynamically minimizes aggregate table payout to guarantee house edge.',
                  icon: ShieldCheck,
                  color: 'border-emerald-500/30 text-emerald-300'
                },
                {
                  id: 'high_house_edge',
                  name: 'Enhanced Margin Optimization',
                  desc: 'Biases outcome slightly against heavy high-roller clusters to maintain high liquidity.',
                  icon: TrendingUp,
                  color: 'border-amber-500/30 text-amber-300'
                },
                {
                  id: 'manual_force',
                  name: 'Manual Result Force Mode',
                  desc: 'Admin manually designates the exact winning number, side, or card for upcoming rounds.',
                  icon: Lock,
                  color: 'border-rose-500/30 text-rose-300'
                }
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = currentSetting.rtpMode === mode.id;

                return (
                  <div
                    key={mode.id}
                    onClick={() => {
                      soundFx.playClick();
                      setSettings((prev) => ({
                        ...prev,
                        [activeGame]: { ...prev[activeGame], rtpMode: mode.id as any }
                      }));
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-400 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <h4 className={`text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {mode.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{mode.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Game Betting Limits & Multipliers */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Table Stake Limits</h3>
                <p className="text-[11px] text-slate-400">Min/Max limits per player/side</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Minimum Bet (₹)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={currentSetting.minBet}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 10;
                    setSettings((prev) => ({
                      ...prev,
                      [activeGame]: { ...prev[activeGame], minBet: val }
                    }));
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Maximum Bet per Side (₹)</label>
                <input
                  type="number"
                  min="100"
                  max="500000"
                  value={currentSetting.maxBet}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 50000;
                    setSettings((prev) => ({
                      ...prev,
                      [activeGame]: { ...prev[activeGame], maxBet: val }
                    }));
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-white focus:border-amber-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Game Multipliers */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Payout Multipliers</h3>
                <p className="text-[11px] text-slate-400">Active payout coefficients</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {activeGame === 'dragon_tiger' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-red-400 font-bold">🐉 Dragon Win (1:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierPrimary || 2.0}x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold">🐅 Tiger Win (1:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierSecondary || 2.0}x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">🟢 Tie Win (8:1)</span>
                    <span className="text-emerald-400 font-black">{currentSetting.multiplierSpecial || 9.0}x</span>
                  </div>
                </>
              )}

              {activeGame === 'andar_bahar' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">🔵 Andar Win (0.95:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierPrimary || 1.95}x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-rose-400 font-bold">🔴 Bahar Win (1:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierSecondary || 2.0}x</span>
                  </div>
                </>
              )}

              {activeGame === 'roulette' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold">🎯 Single Number (Straight)</span>
                    <span className="text-amber-400 font-black">36.0x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-rose-400 font-bold">🔴 Red / ⚫ Black (1:1)</span>
                    <span className="text-rose-400 font-black">2.0x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-blue-400 font-bold">📊 Dozen / Column (2:1)</span>
                    <span className="text-blue-400 font-black">3.0x</span>
                  </div>
                </>
              )}

              {activeGame === 'crash' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-cyan-400 font-bold">🚀 Rocket Multiplier Max</span>
                    <span className="text-cyan-400 font-black">1000.00x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">⏱️ Cooldown Interval</span>
                    <span className="text-emerald-400 font-black">5.0s</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold">🛡️ Min Flight Multiplier</span>
                    <span className="text-amber-400 font-black">1.15x</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Security Badge */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-white">Firestore Real-time Sync Active</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All changes to collection <code className="text-indigo-300 bg-indigo-950 px-1 py-0.5 rounded">game_settings</code> take effect instantly in live gaming client rooms without needing server restart.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
