import React, { useState, useEffect } from 'react';
import { 
  ToggleLeft, ToggleRight, Sparkles, ShieldCheck, 
  AlertTriangle, CheckCircle2, RefreshCw, Eye, EyeOff, 
  Flame, Dices, Layers, Zap, Clock, Trophy, 
  Sliders, MessageSquare, Play, HelpCircle, Power
} from 'lucide-react';
import { GameControlItem, AllGameStatuses, DEFAULT_GAME_STATUSES } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';

interface AdminGameControlsProps {
  onAddAuditLog?: (action: string, details: string) => void;
  onLaunchGamePreview?: (gameId: string) => void;
}

export const AdminGameControls: React.FC<AdminGameControlsProps> = ({
  onAddAuditLog,
  onLaunchGamePreview
}) => {
  const [gameStatuses, setGameStatuses] = useState<AllGameStatuses>(() => {
    try {
      const cached = localStorage.getItem('bg_game_controls_cache');
      if (cached) {
        return { ...DEFAULT_GAME_STATUSES, ...JSON.parse(cached) };
      }
    } catch (_) {}
    return DEFAULT_GAME_STATUSES;
  });

  const [filterCategory, setFilterCategory] = useState<'all' | 'live_casino' | 'special_draw' | 'lottery'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [tempMessage, setTempMessage] = useState<string>('');

  // Real-time Firestore listener for game_controls configuration
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_config', 'game_controls'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AllGameStatuses>;
        setGameStatuses((prev) => {
          const merged: AllGameStatuses = { ...prev };
          Object.keys(DEFAULT_GAME_STATUSES).forEach((k) => {
            if (data[k]) {
              merged[k] = { ...DEFAULT_GAME_STATUSES[k], ...data[k] };
            }
          });
          try {
            localStorage.setItem('bg_game_controls_cache', JSON.stringify(merged));
          } catch (_) {}
          return merged;
        });
      }
    }, (err) => {
      console.warn('Game controls realtime snapshot notice:', err.message);
    });

    return () => unsub();
  }, []);

  // Handle individual toggle switch for a game
  const handleToggleGame = async (gameId: string, currentEnabled: boolean) => {
    soundFx.playClick();
    const newStatus = !currentEnabled;
    const nowIso = new Date().toISOString();

    const updatedItem: GameControlItem = {
      ...(gameStatuses[gameId] || DEFAULT_GAME_STATUSES[gameId]),
      isEnabled: newStatus,
      lastUpdated: nowIso,
      updatedBy: 'Admin'
    };

    const newAllStatuses: AllGameStatuses = {
      ...gameStatuses,
      [gameId]: updatedItem
    };

    // Optimistic local state update
    setGameStatuses(newAllStatuses);
    try {
      localStorage.setItem('bg_game_controls_cache', JSON.stringify(newAllStatuses));
    } catch (_) {}

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_config', 'game_controls'), {
        [gameId]: updatedItem
      }, { merge: true });

      soundFx.playCoin();
      const statusText = newStatus ? 'ONLINE (Visible to Players)' : 'MAINTENANCE (Hidden from Players)';
      setSaveSuccessMsg(`✅ ${updatedItem.name} status updated to ${statusText}`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);

      if (onAddAuditLog) {
        onAddAuditLog(
          'Game Maintenance Toggle',
          `Admin toggled ${updatedItem.name} (${gameId}) to ${statusText}`
        );
      }
    } catch (err) {
      console.error('Error updating game control status in Firestore:', err);
      alert('Failed to save to Firestore. Please verify internet connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Bulk Action: Enable All or Put All in Maintenance
  const handleBulkToggle = async (enableAll: boolean) => {
    const confirmation = window.confirm(
      enableAll 
        ? 'Are you sure you want to ENABLE ALL games and make them visible to all players?' 
        : 'Are you sure you want to put ALL games into MAINTENANCE MODE (hidden from players)?'
    );
    if (!confirmation) return;

    soundFx.playClick();
    setIsSaving(true);
    const nowIso = new Date().toISOString();
    const bulkUpdate: Record<string, Partial<GameControlItem>> = {};
    const newStatuses: AllGameStatuses = { ...gameStatuses };

    Object.keys(DEFAULT_GAME_STATUSES).forEach((k) => {
      const existing = gameStatuses[k] || DEFAULT_GAME_STATUSES[k];
      const updated: GameControlItem = {
        ...existing,
        isEnabled: enableAll,
        lastUpdated: nowIso,
        updatedBy: 'Admin (Bulk)'
      };
      bulkUpdate[k] = updated;
      newStatuses[k] = updated;
    });

    setGameStatuses(newStatuses);

    try {
      await setDoc(doc(db, 'system_config', 'game_controls'), bulkUpdate, { merge: true });
      soundFx.playCoin();
      setSaveSuccessMsg(
        enableAll 
          ? '✅ All games have been ENABLED and are LIVE on the website!' 
          : '⚠️ All games are now in MAINTENANCE MODE and hidden from users.'
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);

      if (onAddAuditLog) {
        onAddAuditLog(
          'Bulk Game Maintenance Action',
          `Admin set ALL games to ${enableAll ? 'ONLINE (Enabled)' : 'MAINTENANCE (Disabled)'}`
        );
      }
    } catch (err) {
      console.error('Bulk update error:', err);
      alert('Failed to apply bulk update.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle saving custom maintenance message
  const handleSaveCustomMessage = async (gameId: string) => {
    soundFx.playClick();
    const existing = gameStatuses[gameId] || DEFAULT_GAME_STATUSES[gameId];
    const updated: GameControlItem = {
      ...existing,
      maintenanceMessage: tempMessage.trim() || 'Game is under scheduled maintenance.',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin'
    };

    setGameStatuses((prev) => ({ ...prev, [gameId]: updated }));
    setEditingMessageId(null);

    try {
      await setDoc(doc(db, 'system_config', 'game_controls'), {
        [gameId]: updated
      }, { merge: true });
      soundFx.playCoin();
    } catch (err) {
      console.error('Error saving custom maintenance message:', err);
    }
  };

  // Filtered list of games
  const gameKeys = Object.keys(DEFAULT_GAME_STATUSES);
  const filteredGameKeys = gameKeys.filter((k) => {
    const item = gameStatuses[k] || DEFAULT_GAME_STATUSES[k];
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalGamesCount = gameKeys.length;
  const onlineGamesCount = gameKeys.filter(
    (k) => (gameStatuses[k]?.isEnabled ?? DEFAULT_GAME_STATUSES[k].isEnabled)
  ).length;
  const maintenanceGamesCount = totalGamesCount - onlineGamesCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-mono">
      
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 border border-amber-500/30 rounded-3xl shadow-2xl relative overflow-hidden space-y-4">
        
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-lg">
                <Power className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>GAME SWITCH & MAINTENANCE MANAGER</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                    REAL-TIME SYNC
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Toggle any game ON / OFF. Turning OFF immediately puts the game in maintenance mode and hides it from player views in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Bulk Toggle Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={isSaving}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>ENABLE ALL (ALL LIVE)</span>
            </button>

            <button
              onClick={() => handleBulkToggle(false)}
              disabled={isSaving}
              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/50 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>MAINTENANCE ALL (PAUSE ALL)</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 relative z-10">
          
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Total Games</span>
                <span className="text-sm font-black text-white">{totalGamesCount} Platform Games</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-emerald-300 block uppercase">Live on Website</span>
                <span className="text-sm font-black text-emerald-400">{onlineGamesCount} Active Online</span>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>

          <div className="p-3 bg-rose-950/40 rounded-2xl border border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <EyeOff className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-rose-300 block uppercase">In Maintenance</span>
                <span className="text-sm font-black text-rose-400">{maintenanceGamesCount} Hidden</span>
              </div>
            </div>
            {maintenanceGamesCount > 0 && (
              <span className="text-[10px] bg-rose-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                PAUSED
              </span>
            )}
          </div>

        </div>

        {/* Success / Feedback notification */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-900/60 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All Games', icon: Sliders },
            { id: 'live_casino', label: 'Live Casino (4)', icon: Flame },
            { id: 'special_draw', label: 'Special Draws (2)', icon: Sparkles },
            { id: 'lottery', label: 'Lotteries (4)', icon: Trophy }
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = filterCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  soundFx.playClick();
                  setFilterCategory(cat.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px]">
          <input
            type="text"
            placeholder="Search game name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

      </div>

      {/* Main Game Control Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGameKeys.map((key) => {
          const game = gameStatuses[key] || DEFAULT_GAME_STATUSES[key];
          const isLive = game.isEnabled;
          const isEditingThis = editingMessageId === key;

          return (
            <div
              key={key}
              className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 shadow-xl flex flex-col justify-between space-y-4 ${
                isLive
                  ? 'bg-slate-900/90 border-emerald-500/40 hover:border-emerald-500 shadow-emerald-950/20'
                  : 'bg-slate-950/90 border-rose-500/40 hover:border-rose-500 shadow-rose-950/30'
              }`}
            >
              
              {/* Card Header: Icon, Name & Status Switch */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${
                    isLive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30 grayscale'
                  }`}>
                    <span>{game.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-black text-white">{game.name}</h4>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-black border uppercase ${
                        game.category === 'live_casino'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : game.category === 'special_draw'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}>
                        {game.category.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">ID: {game.id}</span>
                      <span className="text-[10px] text-amber-400 font-bold">• {game.badge}</span>
                    </div>
                  </div>
                </div>

                {/* Big Tactile Interactive Toggle Button */}
                <button
                  onClick={() => handleToggleGame(key, isLive)}
                  disabled={isSaving}
                  className={`px-3.5 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                    isLive
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-300'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400'
                  }`}
                  title={isLive ? 'Click to pause game and put in maintenance' : 'Click to enable game on website'}
                >
                  {isLive ? (
                    <>
                      <ToggleRight className="w-5 h-5 text-slate-950" />
                      <div className="text-left">
                        <span className="block text-[11px] leading-tight">ONLINE</span>
                        <span className="block text-[8px] opacity-80">Visible</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5 text-white" />
                      <div className="text-left">
                        <span className="block text-[11px] leading-tight">MAINTENANCE</span>
                        <span className="block text-[8px] opacity-90">Hidden</span>
                      </div>
                    </>
                  )}
                </button>
              </div>

              {/* Status Visual Banner */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                isLive
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                  <span className="font-bold">
                    {isLive ? 'Status: Active & Playable on App' : 'Status: In Maintenance (Hidden from website)'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {game.lastUpdated ? new Date(game.lastUpdated).toLocaleTimeString() : 'Synced'}
                </span>
              </div>

              {/* Maintenance Message Box */}
              <div className="space-y-1.5 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-amber-400" />
                    <span>Maintenance Notice to Players:</span>
                  </span>
                  {!isEditingThis ? (
                    <button
                      onClick={() => {
                        setEditingMessageId(key);
                        setTempMessage(game.maintenanceMessage || '');
                      }}
                      className="text-amber-400 hover:underline text-[10px] font-bold cursor-pointer"
                    >
                      Edit Message
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingMessageId(null)}
                      className="text-slate-400 hover:text-white text-[10px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {isEditingThis ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={tempMessage}
                      onChange={(e) => setTempMessage(e.target.value)}
                      placeholder="e.g. Under scheduled server maintenance..."
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleSaveCustomMessage(key)}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Save Notice
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-300 text-[11px] italic bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                    "{game.maintenanceMessage || 'Game is temporarily under scheduled maintenance.'}"
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-500">
                <span>Updated by: {game.updatedBy || 'System'}</span>
                {onLaunchGamePreview && (
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onLaunchGamePreview(game.id);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Quick Test Modal</span>
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
