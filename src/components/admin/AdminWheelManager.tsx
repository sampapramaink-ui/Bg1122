import React, { useState, useEffect } from 'react';
import { Dices, Sparkles, Gift, Save, CheckCircle2, RefreshCw, UserCheck, Plus, Search, Trophy, Lock, ShieldCheck, Zap } from 'lucide-react';
import { WheelSector, WheelConfig, User } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { isMockDemoUser, getUserDisplayCode, calculateUserSearchScore } from '../../utils/databaseSync';

interface AdminWheelManagerProps {
  users?: User[];
  onUsersUpdated?: () => void;
}

const DEFAULT_WHEEL_SECTORS: WheelSector[] = [
  { id: '1', label: '₹50', amount: 50, color: '#D4AF37' },
  { id: '2', label: '₹100', amount: 100, color: '#059669' },
  { id: '3', label: '₹250', amount: 250, color: '#2563EB' },
  { id: '4', label: '₹500', amount: 500, color: '#7C3AED' },
  { id: '5', label: '₹1,000', amount: 1000, color: '#DB2777' },
  { id: '6', label: '₹2,500', amount: 2500, color: '#EA580C' },
  { id: '7', label: '₹100', amount: 100, color: '#059669' },
  { id: '8', label: '₹5,000', amount: 5000, color: '#EAB308' }
];

export const AdminWheelManager: React.FC<AdminWheelManagerProps> = ({ users = [], onUsersUpdated }) => {
  const [sectors, setSectors] = useState<WheelSector[]>(DEFAULT_WHEEL_SECTORS);
  const [minDepositAmount, setMinDepositAmount] = useState<number>(1000);
  const [defaultTargetWallet, setDefaultTargetWallet] = useState<'bonus' | 'main'>('bonus');
  const [isSavingWheel, setIsSavingWheel] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // User search & grant state
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsersList, setAllUsersList] = useState<User[]>(users);
  const [grantingForUser, setGrantingForUser] = useState<string | null>(null);

  // Load wheel config from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'wheel_config', 'default'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as WheelConfig;
        if (data.sectors && data.sectors.length > 0) {
          setSectors(data.sectors);
        }
        if (typeof data.minDepositAmount === 'number') {
          setMinDepositAmount(data.minDepositAmount);
        }
        if (data.defaultTargetWallet === 'main' || data.defaultTargetWallet === 'bonus') {
          setDefaultTargetWallet(data.defaultTargetWallet);
        }
      }
    }, (err) => console.warn('Wheel config listener error:', err.message));

    return () => unsub();
  }, []);

  // Sync users list
  useEffect(() => {
    if (users && users.length > 0) {
      setAllUsersList(users.filter(u => !isMockDemoUser(u.id, u.email)));
    } else {
      // Fetch users directly if prop is empty
      getDocs(collection(db, 'users')).then((snap) => {
        const list: User[] = [];
        snap.forEach((d) => {
          const email = (d.data().email || '').toLowerCase().trim();
          if (isMockDemoUser(d.id, email)) {
            deleteDoc(doc(db, 'users', d.id)).catch(() => {});
            return;
          }
          list.push({ id: d.id, ...d.data() } as User);
        });
        setAllUsersList(list);
      }).catch(err => console.warn('Fetch users error:', err));
    }
  }, [users]);

  const handleSectorChange = (index: number, field: keyof WheelSector, value: any) => {
    const updated = [...sectors];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? Number(value) || 0 : value
    };
    setSectors(updated);
  };

  const handleSaveWheelConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWheel(true);
    try {
      const configData: WheelConfig = {
        minDepositAmount: Number(minDepositAmount) || 1000,
        sectors: sectors,
        defaultTargetWallet: defaultTargetWallet || 'bonus',
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'wheel_config', 'default'), configData, { merge: true });
      setStatusNotice(`✅ Wheel Prize Sectors, Min Deposit & Default Wallet (${defaultTargetWallet === 'main' ? 'Main Wallet' : 'Bonus Wallet'}) updated live in Firestore!`);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err) {
      console.error('Save wheel config error:', err);
      alert('Error saving wheel config to Firestore!');
    } finally {
      setIsSavingWheel(false);
    }
  };

  const handleGrantSpinCredits = async (targetUserId: string, creditsToAdd: number, specificWallet?: 'bonus' | 'main') => {
    setGrantingForUser(targetUserId);
    try {
      const targetUser = allUsersList.find(u => u.id === targetUserId);
      const currentCredits = targetUser?.spinCredits ?? 0;
      const newCredits = Math.max(0, currentCredits + creditsToAdd);

      const updatePayload: Record<string, any> = {
        spinCredits: newCredits
      };
      if (specificWallet) {
        updatePayload.spinTargetWallet = specificWallet;
      }

      await setDoc(doc(db, 'users', targetUserId), updatePayload, { merge: true });

      // Update local list
      setAllUsersList(prev => prev.map(u => u.id === targetUserId ? { 
        ...u, 
        spinCredits: newCredits,
        ...(specificWallet ? { spinTargetWallet: specificWallet } : {})
      } : u));
      
      const destinationText = specificWallet ? (specificWallet === 'main' ? ' [Main Wallet]' : ' [Bonus Wallet]') : '';
      setStatusNotice(`🎁 Granted ${creditsToAdd > 0 ? `+${creditsToAdd}` : creditsToAdd} Spin Credit(s) to ${targetUser?.name || 'Player'}${destinationText}! (Total: ${newCredits})`);
      setTimeout(() => setStatusNotice(null), 3500);
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      console.error('Grant spin credits error:', err);
      alert('Failed to update spin credits!');
    } finally {
      setGrantingForUser(null);
    }
  };

  const handleToggleUserTargetWallet = async (targetUserId: string, currentTarget?: 'bonus' | 'main') => {
    const newTarget: 'bonus' | 'main' = currentTarget === 'main' ? 'bonus' : 'main';
    try {
      await setDoc(doc(db, 'users', targetUserId), {
        spinTargetWallet: newTarget
      }, { merge: true });

      setAllUsersList(prev => prev.map(u => u.id === targetUserId ? { ...u, spinTargetWallet: newTarget } : u));
      setStatusNotice(`🎯 Updated spin reward destination to ${newTarget === 'main' ? '💵 Main Wallet' : '🎁 Bonus Wallet'}!`);
      setTimeout(() => setStatusNotice(null), 3500);
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      console.error('Update user target wallet error:', err);
      alert('Failed to update user spin target wallet!');
    }
  };

  const filteredUsers = searchQuery.trim()
    ? allUsersList
        .map((u) => ({ user: u, ...calculateUserSearchScore(u, searchQuery) }))
        .filter((item) => item.matches)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.user)
    : allUsersList;

  return (
    <div className="space-y-6 font-mono">
      
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 rounded-2xl border border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Dices className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>Lucky Wheel & VIP Spin Control Center</span>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize wheel prize amounts, set min deposit spin unlocks (₹1,000+), and grant free bonus spins to players.
            </p>
          </div>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Grid Layout: Left = Wheel Prize Slices Config, Right = Deposit Rule & User Free Spin Grant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: WHEEL PRIZES CONFIGURATION */}
        <div className="p-5 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Wheel Sector Cash Prizes (8 Slices)
              </h3>
            </div>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
              Real-time Sync
            </span>
          </div>

          <form onSubmit={handleSaveWheelConfig} className="space-y-3">
            
            {/* Global Default Target Wallet Selector */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-amber-300 uppercase font-black flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Default Win Payout Target Wallet (ডিফল্ট ওয়ালেট নির্বাচন)</span>
                </label>
                <span className="text-[9px] text-slate-400 font-bold">Standard: Bonus Wallet</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDefaultTargetWallet('bonus')}
                  className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    defaultTargetWallet === 'bonus'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-md shadow-purple-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                  <span>🎁 Bonus Wallet (ডিফল্ট)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDefaultTargetWallet('main')}
                  className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    defaultTargetWallet === 'main'
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>💵 Main Wallet (মেইন ক্যাশ)</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                • <strong>Bonus Wallet:</strong> প্লেয়ার জিতলে টাকা বোনাস ওয়ালেটে জমা হবে। (Default)
                <br />
                • <strong>Main Wallet:</strong> প্লেয়ার জিতলে টাকা সরাসরি মেইন ওয়ালেটে (উইথড্রয়াল যোগ্য ব্যালেন্সে) যোগ হবে।
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                <span>Min Deposit Amount Required for 1 Spin Credit</span>
                <span className="text-amber-400 font-bold">Default: ₹1,000</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400">₹</span>
                <input
                  type="number"
                  required
                  value={minDepositAmount}
                  onChange={(e) => setMinDepositAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-400"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Every approved deposit of this amount or more grants 1 free spin credit to the user automatically!
              </p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {sectors.map((sector, idx) => (
                <div key={sector.id || idx} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-3 text-xs">
                  <span className="w-6 text-center text-slate-500 font-bold text-[10px]">#{idx + 1}</span>
                  
                  {/* Color Picker */}
                  <input
                    type="color"
                    value={sector.color}
                    onChange={(e) => handleSectorChange(idx, 'color', e.target.value)}
                    className="w-8 h-8 rounded border-none bg-transparent cursor-pointer shrink-0"
                  />

                  {/* Sector Label */}
                  <div className="flex-1 space-y-0.5">
                    <span className="text-[9px] text-slate-500 block">Label Text</span>
                    <input
                      type="text"
                      required
                      value={sector.label}
                      onChange={(e) => handleSectorChange(idx, 'label', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>

                  {/* Cash Reward Amount */}
                  <div className="w-28 space-y-0.5">
                    <span className="text-[9px] text-slate-500 block">Cash Reward (₹)</span>
                    <input
                      type="number"
                      required
                      value={sector.amount}
                      onChange={(e) => handleSectorChange(idx, 'amount', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSavingWheel}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {isSavingWheel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Wheel Configuration</span>
            </button>
          </form>
        </div>

        {/* SECTION 2: PLAYER SPIN CREDITS & ADMIN BONUS GIFTS */}
        <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Grant Bonus Spin Credits to Players
              </h3>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-xs text-amber-200">
            <p className="font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Spin Lock & Unlock Policy</span>
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              • Players without Spin Credits cannot spin the wheel.
              <br />
              • Each approved deposit of ₹1,000+ automatically gives 1 Spin Credit.
              <br />
              • Admins can also grant custom bonus spins directly below at any time!
            </p>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player by name, email or phone..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          {/* Player List with Spin Credits & Target Wallet Toggle */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {filteredUsers.slice(0, 30).map((u) => {
              const effectiveWallet = u.spinTargetWallet || defaultTargetWallet || 'bonus';
              const isMain = effectiveWallet === 'main';

              return (
                <div key={u.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 hover:border-slate-700 transition-all text-xs">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                        <span>{u.name}</span>
                        <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                          {u.spinCredits || 0} Spins Left
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400">{u.email}</p>
                    </div>

                    {/* Target Wallet Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleUserTargetWallet(u.id, u.spinTargetWallet || defaultTargetWallet)}
                      title="Click to toggle user's spin winnings destination between Bonus and Main Wallet"
                      className={`px-2 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 transition-all cursor-pointer ${
                        isMain
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                      }`}
                    >
                      <span>Payout:</span>
                      <span>{isMain ? '💵 Main Wallet' : '🎁 Bonus Wallet'}</span>
                    </button>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">Quick Grant:</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleGrantSpinCredits(u.id, 1)}
                        disabled={grantingForUser === u.id}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg shadow flex items-center gap-1 cursor-pointer"
                        title="Grant 1 Spin using current wallet setting"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+1 Spin</span>
                      </button>

                      <button
                        onClick={() => handleGrantSpinCredits(u.id, 5)}
                        disabled={grantingForUser === u.id}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-[10px] rounded-lg shadow flex items-center gap-1 cursor-pointer"
                        title="Grant 5 Spins using current wallet setting"
                      >
                        <Gift className="w-3 h-3" />
                        <span>+5 Spins</span>
                      </button>

                      <button
                        onClick={() => handleGrantSpinCredits(u.id, 1, 'main')}
                        disabled={grantingForUser === u.id}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-lg shadow flex items-center gap-1 cursor-pointer"
                        title="Grant 1 Spin directly set to Main Cash Wallet"
                      >
                        <span>+1 Main</span>
                      </button>

                      <button
                        onClick={() => handleGrantSpinCredits(u.id, 1, 'bonus')}
                        disabled={grantingForUser === u.id}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] rounded-lg shadow flex items-center gap-1 cursor-pointer"
                        title="Grant 1 Spin directly set to Bonus Wallet"
                      >
                        <span>+1 Bonus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-xs">
                No matching players found.
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
