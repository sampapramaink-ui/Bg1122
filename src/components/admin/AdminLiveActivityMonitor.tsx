import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Volume2, VolumeX, Bell, Dices, UserCheck, Flame, 
  Eye, Search, MessageSquare
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { LiveUserActivityLog, OnlineUserPresence } from '../../types';
import { soundFx } from '../../utils/audio';
import { generatePermanentUserCode } from '../../utils/databaseSync';

interface AdminLiveActivityMonitorProps {
  onInspectUser?: (userId: string) => void;
  onQuickMessage?: (userId: string, userName: string) => void;
}

export const AdminLiveActivityMonitor: React.FC<AdminLiveActivityMonitorProps> = ({
  onInspectUser,
  onQuickMessage
}) => {
  const [activities, setActivities] = useState<LiveUserActivityLog[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'bet' | 'login' | 'finance'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'live_feed' | 'online_users'>('live_feed');
  
  const lastProcessedActId = useRef<string | null>(null);
  const isInitialLoad = useRef<boolean>(true);

  // 1. Subscribe to Live Online Presence (Real-time Firestore)
  useEffect(() => {
    const unsubPresence = onSnapshot(
      collection(db, 'user_presence'),
      (snapshot) => {
        const now = Date.now();
        const users: OnlineUserPresence[] = [];
        snapshot.forEach((docSnap) => {
          const u = docSnap.data() as OnlineUserPresence;
          // Mark online if active in last 3 minutes (180,000ms)
          if (now - (u.lastSeen || 0) < 180000) {
            users.push(u);
          }
        });
        setOnlineUsers(users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)));
      },
      (err) => console.warn('Presence snapshot warning:', err)
    );

    return () => unsubPresence();
  }, []);

  // 2. Subscribe to Real-time User Activity Logs & Play Loud Alerts
  useEffect(() => {
    const q = query(
      collection(db, 'live_activities'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubActivity = onSnapshot(
      q,
      (snapshot) => {
        const loaded: LiveUserActivityLog[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push(docSnap.data() as LiveUserActivityLog);
        });

        if (loaded.length > 0) {
          const newest = loaded[0];

          // Trigger Loud Sound & Visual Signal for new live events after initial load
          if (!isInitialLoad.current && lastProcessedActId.current && newest.id !== lastProcessedActId.current) {
            if (soundEnabled) {
              if (newest.type === 'login') {
                soundFx.playAdminAlert('login');
              } else if (newest.type === 'bet') {
                soundFx.playAdminAlert('bet');
              }
            }
          }

          lastProcessedActId.current = newest.id;
        }

        isInitialLoad.current = false;
        setActivities(loaded);
      },
      (err) => console.warn('Live activities snapshot warning:', err)
    );

    return () => unsubActivity();
  }, [soundEnabled]);

  const filteredActivities = activities.filter((act) => {
    if (filterType === 'bet' && act.type !== 'bet') return false;
    if (filterType === 'login' && act.type !== 'login') return false;
    if (filterType === 'finance' && act.type !== 'deposit' && act.type !== 'withdraw') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanNumericQ = q.replace(/^[#\s]+/, '').trim();
      const uCode = (generatePermanentUserCode(undefined, (act as any).userCode, act.userId)).toLowerCase();
      return (
        act.userName?.toLowerCase().includes(q) ||
        act.userId?.toLowerCase().includes(q) ||
        (cleanNumericQ && act.userId?.toLowerCase().includes(cleanNumericQ)) ||
        act.details?.toLowerCase().includes(q) ||
        act.gameName?.toLowerCase().includes(q) ||
        uCode === cleanNumericQ ||
        uCode.includes(cleanNumericQ) ||
        (cleanNumericQ && `#${uCode}`.includes(q))
      );
    }
    return true;
  });

  const testLoudAlert = () => {
    soundFx.playAdminAlert('bet');
  };

  return (
    <div className="space-y-5 font-mono">
      {/* Top Real-time Control & Status Bar */}
      <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 rounded-3xl border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">Live User Radar & Betting Monitor</h2>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
                LIVE 0s DELAY
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live tracking of real-time logins, bets placed across all games, and active online players.
            </p>
          </div>
        </div>

        {/* Action Controls: Sound Toggle, Test Siren, Tab Switch */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              soundFx.playClick();
            }}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span>{soundEnabled ? 'Loud Alert ON' : 'Sound Muted'}</span>
          </button>

          {/* Test Alert Button */}
          <button
            type="button"
            onClick={testLoudAlert}
            className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Siren</span>
          </button>

          {/* Active Online Counter Badge */}
          <div className="px-3.5 py-2 bg-slate-950 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400 font-bold">Online Now:</span>
            <span className="text-emerald-400 font-black text-sm">{onlineUsers.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('live_feed')}
            className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'live_feed'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Live Action Feed ({activities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('online_users')}
            className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'online_users'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Online Users Radar ({onlineUsers.length})</span>
          </button>
        </div>

        {/* Filter & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'live_feed' && (
            <div className="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterType === 'all' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('bet')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterType === 'bet' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'}`}
              >
                Bets
              </button>
              <button
                type="button"
                onClick={() => setFilterType('login')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterType === 'login' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'}`}
              >
                Logins
              </button>
            </div>
          )}

          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user / bet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl pl-8 pr-3 py-1.5 outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* VIEW 1: REALTIME LIVE ACTION FEED */}
      {activeTab === 'live_feed' && (
        <div className="space-y-2.5">
          {filteredActivities.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl text-slate-400 font-mono space-y-2">
              <Radio className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
              <p className="text-sm font-bold text-slate-300">Listening for user activities...</p>
              <p className="text-xs text-slate-500">Every time a player logs in or places a bet, it appears here with a loud alert chime.</p>
            </div>
          ) : (
            filteredActivities.map((act, index) => {
              const isBet = act.type === 'bet';
              const isLogin = act.type === 'login';
              const isNewest = index === 0;

              return (
                <div
                  key={act.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${
                    isNewest
                      ? 'bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-950 border-amber-500/50 shadow-amber-500/5'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-2xl shrink-0 border ${
                      isBet 
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                        : isLogin
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {isBet ? <Dices className="w-5 h-5" /> : isLogin ? <UserCheck className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-white text-sm hover:underline cursor-pointer" onClick={() => onInspectUser?.(act.userId)}>
                          {act.userName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          ID: {act.userId}
                        </span>
                        {act.userPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            📞 {act.userPhone}
                          </span>
                        )}
                        <span className="text-[10px] text-amber-400/90 font-mono ml-auto sm:ml-0">
                          ⏰ {act.dateStr}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isBet ? 'bg-amber-500/20 text-amber-300' : isLogin ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {act.type}
                        </span>
                        {act.gameName && (
                          <span className="font-black text-amber-400">
                            🎮 {act.gameName}
                          </span>
                        )}
                        <span className="text-slate-300">{act.details}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bet Amount & Admin Action Buttons */}
                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {act.betAmount !== undefined && (
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block uppercase">Bet Stake</span>
                        <span className="text-base font-black text-amber-400 font-mono">
                          ₹{act.betAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInspectUser?.(act.userId)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                        title="Open User Dossier & Controls"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Monitor</span>
                      </button>

                      {onQuickMessage && (
                        <button
                          type="button"
                          onClick={() => onQuickMessage(act.userId, act.userName)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 transition-all cursor-pointer"
                          title="Send Direct Broadcast to User"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: ONLINE USERS RADAR GRID */}
      {activeTab === 'online_users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {onlineUsers.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400">
              <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-bold text-slate-300">No users currently online.</p>
            </div>
          ) : (
            onlineUsers.map((u) => {
              const isBettingNow = u.status === 'betting';
              return (
                <div
                  key={u.userId}
                  className="p-5 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl space-y-3 shadow-xl transition-all relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wide">
                        {isBettingNow ? '🔥 ACTIVE BETTING' : '🟢 LIVE ONLINE'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {u.device || 'Web Browser'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-base font-extrabold text-white truncate">{u.userName}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">
                      ID: <strong className="text-slate-300">{u.userId}</strong>
                    </div>
                    {u.userPhone && (
                      <div className="text-xs text-slate-400 font-mono">
                        Phone: <strong className="text-slate-300">{u.userPhone}</strong>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Current Balance</span>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        ₹{(u.balance || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Location / Game</span>
                      <span className="text-xs font-bold text-white truncate max-w-[120px] block">
                        {u.currentGame || 'Lobby'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onInspectUser?.(u.userId)}
                      className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:from-amber-400 hover:to-yellow-400 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Dossier</span>
                    </button>
                    {onQuickMessage && (
                      <button
                        type="button"
                        onClick={() => onQuickMessage(u.userId, u.userName)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 cursor-pointer"
                        title="Broadcast Notification to User"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
