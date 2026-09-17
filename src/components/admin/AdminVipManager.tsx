import React, { useState, useEffect } from 'react';
import { 
  Crown, Award, Sparkles, Search, Filter, CheckCircle2, Shield, 
  ArrowUpRight, Plus, Minus, RefreshCw, Star, Gift, User as UserIcon, 
  Check, Save, Zap, AlertCircle, Edit, ChevronRight, Sliders, Users,
  TrendingUp, Wallet
} from 'lucide-react';
import { User, WalletTransaction } from '../../types';
import { VIP_TIERS, calculateVipLevel, getNextTierInfo, VipTierInfo } from '../../utils/vip';
import { soundFx } from '../../utils/audio';
import { doc, setDoc, collection, onSnapshot, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { isMockDemoUser, getUserDisplayCode, calculateUserSearchScore } from '../../utils/databaseSync';
import { PaginationBar } from '../PaginationBar';

interface AdminVipManagerProps {
  users?: User[];
  currentUser?: User;
}

export const AdminVipManager: React.FC<AdminVipManagerProps> = ({ users: initialUsers = [], currentUser }) => {
  const [usersList, setUsersList] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<'all' | 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum' | 'Diamond'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'vip_only' | 'standard'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Edit states per user
  const [editingPoints, setEditingPoints] = useState<{ [userId: string]: string }>({});
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Listen to Firestore users collection in real-time
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const usersRef = collection(db, 'users');
      unsubscribe = onSnapshot(usersRef, (snapshot) => {
        const list: User[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const email = (data.email || '').toLowerCase().trim();
          if (isMockDemoUser(docSnap.id, email)) {
            deleteDoc(doc(db, 'users', docSnap.id)).catch(() => {});
            return;
          }

          list.push({
            id: docSnap.id,
            name: data.name || (email ? email.split('@')[0] : 'Player'),
            email: email,
            phone: data.phone || 'N/A',
            avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            balance: typeof data.balance === 'number' ? data.balance : 0,
            bonusBalance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
            totalWon: typeof data.totalWon === 'number' ? data.totalWon : 0,
            totalSpent: typeof data.totalSpent === 'number' ? data.totalSpent : 0,
            referralCode: data.referralCode || '',
            vipLevel: data.vipLevel || 'Bronze',
            vipPoints: typeof data.vipPoints === 'number' ? data.vipPoints : 120,
            isVip: data.isVip ?? (data.vipLevel === 'Gold' || data.vipLevel === 'VIP Platinum'),
            vipExpiryDate: data.vipExpiryDate || '',
            status: data.status || 'active',
            role: data.role || 'user',
            regDate: data.regDate || ''
          });
        });

        // Deduplicate by email
        const emailMap: { [email: string]: User } = {};
        list.forEach((u) => {
          const key = u.email ? u.email.toLowerCase().trim() : u.id;
          if (!emailMap[key] || u.vipPoints! > (emailMap[key].vipPoints || 0)) {
            emailMap[key] = u;
          }
        });

        const deduplicated = Object.values(emailMap);
        setUsersList(deduplicated.length > 0 ? deduplicated : list);
        setLoading(false);
      }, (err) => {
        console.warn('Error listening to users collection in AdminVipManager:', err);
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Update User VIP Info directly in Firestore
  const handleUpdateUserVip = async (
    targetUser: User, 
    newVipLevel: 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum' | 'Platinum' | 'Diamond', 
    newVipPoints: number,
    newIsVip: boolean,
    auditNote: string
  ) => {
    setSavingUserId(targetUser.id);
    soundFx.playClick();

    const cleanPoints = Math.max(0, Math.round(newVipPoints));
    const updatePayload = {
      vipLevel: newVipLevel,
      vipPoints: cleanPoints,
      isVip: newIsVip,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Primary document update
      const userRef = doc(db, 'users', targetUser.id);
      await setDoc(userRef, updatePayload, { merge: true });

      // 2. Clean up legacy alias doc or other duplicate documents for this email
      if (targetUser.email) {
        const cleanEmail = targetUser.email.toLowerCase().trim();
        const aliasId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (aliasId !== targetUser.id) {
          deleteDoc(doc(db, 'users', aliasId)).catch(() => {});
        }

        try {
          const qByEmail = query(collection(db, 'users'), where('email', '==', cleanEmail));
          const snap = await getDocs(qByEmail);
          snap.forEach((dSnap) => {
            if (dSnap.id !== targetUser.id) {
              deleteDoc(doc(db, 'users', dSnap.id)).catch(() => {});
            }
          });
        } catch (_) {}
      }

      // 3. Write audit log transaction
      const txId = `TXN-VIP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await setDoc(doc(db, 'transactions', txId), {
        id: txId,
        userId: targetUser.id,
        type: 'vip_bonus',
        amount: 0,
        description: `👑 VIP Update: ${targetUser.name} set to ${newVipLevel} (${cleanPoints} Pts, VIP Status: ${newIsVip ? 'Active' : 'Inactive'}) - ${auditNote}`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      soundFx.playCoin();
      setActionSuccessMsg(`✅ ${targetUser.name} VIP status & points updated successfully in Firestore!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);

      // Local update
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id || (u.email && u.email === targetUser.email) ? {
          ...u,
          vipLevel: newVipLevel,
          vipPoints: cleanPoints,
          isVip: newIsVip
        } : u))
      );

      if (selectedUserForDetail && selectedUserForDetail.id === targetUser.id) {
        setSelectedUserForDetail({
          ...selectedUserForDetail,
          vipLevel: newVipLevel,
          vipPoints: cleanPoints,
          isVip: newIsVip
        });
      }
    } catch (err) {
      console.error('Failed to update VIP status:', err);
      alert('Error updating user VIP details in Firestore.');
    } finally {
      setSavingUserId(null);
    }
  };

  // Toggle VIP Status between Active & Inactive
  const handleToggleVipStatus = async (user: User) => {
    const currentIsVip = Boolean(user.isVip);
    const newIsVip = !currentIsVip;
    // If turning on VIP, ensure at least Silver or Gold level if currently Bronze
    const newLevel = newIsVip && user.vipLevel === 'Bronze' ? 'Gold' : user.vipLevel;
    const newPts = newIsVip && (user.vipPoints || 0) < 500 ? 2000 : (user.vipPoints || 0);

    await handleUpdateUserVip(
      user, 
      newLevel, 
      newPts, 
      newIsVip, 
      newIsVip ? 'Admin Toggled VIP Active' : 'Admin Toggled VIP Inactive'
    );
  };

  // Adjust Points by delta (+100, +500, -100, etc.)
  const handleAdjustPoints = async (user: User, delta: number) => {
    const currentPts = user.vipPoints || 0;
    const newPts = Math.max(0, currentPts + delta);
    const calculatedTier = calculateVipLevel(newPts);
    const isVipActive = user.isVip ?? (calculatedTier === 'Gold' || calculatedTier === 'Platinum' || calculatedTier === 'Diamond');

    await handleUpdateUserVip(
      user, 
      calculatedTier, 
      newPts, 
      isVipActive, 
      `Points adjusted by ${delta > 0 ? `+${delta}` : delta}`
    );
  };

  // Grant VIP Gift Reward / Weekly Bonus
  const handleGiftVipBonus = async (user: User) => {
    const safeTierKey = (user.vipLevel === 'VIP Platinum' ? 'Platinum' : user.vipLevel) || 'Bronze';
    const tierInfo = VIP_TIERS[safeTierKey] || VIP_TIERS.Bronze;
    const defaultAmount = tierInfo.weeklyBonusAmount > 0 ? tierInfo.weeklyBonusAmount : 500;
    const input = prompt(`Enter VIP Gift Bonus amount (₹) to credit to ${user.name}'s wallet:`, defaultAmount.toString());
    
    if (!input) return;
    const bonusAmount = parseFloat(input);
    if (isNaN(bonusAmount) || bonusAmount <= 0) return;

    soundFx.playWinFanfare();
    try {
      const newBonusBal = (user.bonusBalance || 0) + bonusAmount;
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, { bonusBalance: newBonusBal }, { merge: true });

      const txId = `TXN-VIP-GIFT-${Date.now()}`;
      await setDoc(doc(db, 'transactions', txId), {
        id: txId,
        userId: user.id,
        type: 'vip_bonus',
        amount: bonusAmount,
        walletType: 'bonus',
        description: `🎁 Special Admin VIP Loyalty Gift: Credited ₹${bonusAmount} to Bonus Wallet`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString()
      }, { merge: true });

      setActionSuccessMsg(`🎁 Successfully gifted ₹${bonusAmount.toLocaleString('en-IN')} VIP Bonus to ${user.name}!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (e) {
      console.error(e);
      alert('Failed to grant VIP bonus.');
    }
  };

  // Filter users
  const filteredUsers = (() => {
    const term = searchTerm.trim();
    const matchesTierAndStatus = (u: User) => {
      const matchesTier = tierFilter === 'all' || u.vipLevel === tierFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'vip_only' && (u.isVip || u.vipLevel === 'Gold' || u.vipLevel === 'VIP Platinum')) ||
        (statusFilter === 'standard' && !u.isVip && u.vipLevel === 'Bronze');
      return matchesTier && matchesStatus;
    };

    if (term) {
      return usersList
        .map((u) => ({ user: u, ...calculateUserSearchScore(u, term) }))
        .filter((item) => item.matches)
        .sort((a, b) => b.score - a.score)
        .filter((item) => item.score >= 5000 || matchesTierAndStatus(item.user))
        .map((item) => item.user);
    }

    return usersList.filter(matchesTierAndStatus);
  })();

  // Calculate high-level stats
  const totalUsers = usersList.length;
  const diamondCount = usersList.filter((u) => u.vipLevel === 'Diamond').length;
  const platinumCount = usersList.filter((u) => u.vipLevel === 'VIP Platinum' || u.vipLevel === 'Platinum').length;
  const goldCount = usersList.filter((u) => u.vipLevel === 'Gold').length;
  const silverCount = usersList.filter((u) => u.vipLevel === 'Silver').length;
  const bronzeCount = usersList.filter((u) => u.vipLevel === 'Bronze' || !u.vipLevel).length;
  const totalVipPointsInSystem = usersList.reduce((sum, u) => sum + (u.vipPoints || 0), 0);
  const activeVipCount = usersList.filter((u) => u.isVip || u.vipLevel === 'Gold' || u.vipLevel === 'VIP Platinum' || u.vipLevel === 'Platinum' || u.vipLevel === 'Diamond').length;

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      
      {/* Top Hero Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-950/80 via-slate-900 to-yellow-950/40 border border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/20">
              <Crown className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-mono uppercase tracking-tight">
                  VIP & LOYALTY CLUB MANAGER
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono">
                  LIVE FIRESTORE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Manually toggle VIP status, adjust VIP loyalty points, upgrade member tiers, and distribute VIP bonus perks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-slate-950/90 text-amber-400 border border-amber-500/30 px-3.5 py-2 rounded-2xl text-xs font-mono font-black shadow-lg flex items-center gap-1.5">
              <span>👑 {activeVipCount} Active VIP Players</span>
            </span>
          </div>
        </div>

        {/* Tier Distribution Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 mt-5 pt-4 border-t border-amber-500/20 font-mono">
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-cyan-400/60 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-cyan-200 font-bold flex items-center gap-1">
                <span className="animate-diamond-roll text-xs" role="img" aria-label="Diamond">💎</span>
                <span>Diamond</span>
              </span>
            </div>
            <span className="text-xl font-black text-cyan-200 block mt-1">{diamondCount}</span>
            <span className="text-[9px] text-slate-400">25,000+ Pts</span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-cyan-500/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-cyan-300 font-bold">Platinum</span>
              <Crown className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-xl font-black text-cyan-200 block mt-1">{platinumCount}</span>
            <span className="text-[9px] text-slate-400">10,000 - 24,999</span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-yellow-500/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-yellow-300 font-bold">Gold VIP</span>
              <Crown className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <span className="text-xl font-black text-yellow-200 block mt-1">{goldCount}</span>
            <span className="text-[9px] text-slate-400">2,000 - 9,999</span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-slate-300 font-bold">Silver</span>
              <Award className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-black text-slate-200 block mt-1">{silverCount}</span>
            <span className="text-[9px] text-slate-400">500 - 1,999</span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-amber-500 font-bold">Bronze</span>
              <Star className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-xl font-black text-amber-300 block mt-1">{bronzeCount}</span>
            <span className="text-[9px] text-slate-400">0 - 499</span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-amber-500/30 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-amber-400 font-bold">Total VIP Pts</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xl font-black text-amber-300 block mt-1">
              {totalVipPointsInSystem.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-slate-400">{totalUsers} Users</span>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-bold">{actionSuccessMsg}</span>
        </div>
      )}

      {/* SEARCH, FILTER & ACTION BAR */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 font-mono">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search player name, email, phone, user ID, or VIP tier..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Tier Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <Filter className="w-3 h-3" /> Tier:
            </span>
            {(['all', 'Bronze', 'Silver', 'Gold', 'VIP Platinum', 'Diamond'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => {
                  soundFx.playClick();
                  setTierFilter(tier);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  tierFilter === tier
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tier === 'all' ? 'All Tiers' : tier === 'Diamond' ? '💎 Diamond' : tier}
              </button>
            ))}
          </div>

          {/* VIP Status Filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                soundFx.playClick();
                setStatusFilter(statusFilter === 'vip_only' ? 'all' : 'vip_only');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'vip_only'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>VIP Only ({activeVipCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIP USERS DIRECTORY LIST */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3 font-mono">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading VIP players directory from Firestore...</p>
        </div>
      ) : paginatedUsers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3 font-mono">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">No players matching the selected VIP filters</p>
          <p className="text-xs text-slate-400">Try clearing the search or changing tier filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedUsers.map((u) => {
            const safeTierKey = (u.vipLevel === 'VIP Platinum' ? 'Platinum' : u.vipLevel) || 'Bronze';
            const tierInfo = VIP_TIERS[safeTierKey] || VIP_TIERS.Bronze;
            const isDiamond = safeTierKey === 'Diamond';
            const currentEditPts = editingPoints[u.id] ?? (u.vipPoints || 0).toString();
            const isSaving = savingUserId === u.id;
            const isVipActive = Boolean(u.isVip);

            return (
              <div
                key={u.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-amber-500/40 transition-all font-mono shadow-xl"
              >
                {/* User Identity & VIP Badge Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <img
                      src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={u.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400 flex-shrink-0 shadow-md"
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-white">{u.name}</h4>
                        
                        {/* VIP Tier Badge */}
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase flex items-center gap-1 ${
                          isDiamond
                            ? 'bg-gradient-to-r from-cyan-950 via-indigo-950 to-pink-950 text-cyan-200 border-cyan-300 animate-diamond-badge shadow-md ring-1 ring-cyan-400/50'
                            : tierInfo.badgeBg
                        }`}>
                          {isDiamond ? (
                            <span className="animate-diamond-roll text-xs" role="img" aria-label="Diamond">💎</span>
                          ) : (
                            <Crown className="w-3 h-3" />
                          )}
                          <span>{safeTierKey} VIP</span>
                        </span>

                        {/* VIP Active Status Switch Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                          isVipActive 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {isVipActive ? '👑 VIP ACTIVE' : 'STANDARD'}
                        </span>

                        {u.role === 'admin' && (
                          <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-500/30 uppercase">
                            🛡️ ADMIN
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-amber-400 font-bold">Email: {u.email}</span>
                        <span className="text-slate-400">Phone: {u.phone}</span>
                        <span className="text-slate-400">UID: <strong className="text-white">{u.id}</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* VIP Actions (Toggle Status & Gift Bonus) */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {/* One-Click VIP Status Toggle */}
                    <button
                      onClick={() => handleToggleVipStatus(u)}
                      disabled={isSaving}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                        isVipActive
                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                          : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 shadow-amber-500/20'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>{isVipActive ? 'Revoke VIP Status' : 'Grant VIP Status'}</span>
                    </button>

                    {/* Gift Special VIP Bonus */}
                    <button
                      onClick={() => handleGiftVipBonus(u)}
                      className="px-3.5 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
                    >
                      <Gift className="w-3.5 h-3.5 text-purple-300" />
                      <span>Gift VIP Bonus</span>
                    </button>
                  </div>
                </div>

                {/* VIP Points Editor & Direct Tier Promoters */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                  
                  {/* Left Column: Direct VIP Points Editor */}
                  <div className="lg:col-span-7 bg-slate-950 p-3.5 rounded-2xl border border-amber-500/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> VIP LOYALTY POINTS
                      </span>
                      <span className="text-sm font-black text-amber-300">
                        {(u.vipPoints || 0).toLocaleString('en-IN')} PTS
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        value={currentEditPts}
                        onChange={(e) =>
                          setEditingPoints((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        className="w-28 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl font-black text-amber-300 text-xs outline-none focus:border-amber-500"
                        placeholder="Points"
                      />

                      <button
                        onClick={() => {
                          const parsed = parseInt(currentEditPts, 10);
                          if (!isNaN(parsed) && parsed >= 0) {
                            const newTier = calculateVipLevel(parsed);
                            handleUpdateUserVip(u, newTier, parsed, isVipActive, `Direct point override to ${parsed}`);
                          }
                        }}
                        disabled={isSaving}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md"
                      >
                        Set Points
                      </button>

                      {/* Quick Adjust Buttons */}
                      <button
                        onClick={() => handleAdjustPoints(u, 100)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold cursor-pointer"
                      >
                        +100
                      </button>
                      <button
                        onClick={() => handleAdjustPoints(u, 500)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold cursor-pointer"
                      >
                        +500
                      </button>
                      <button
                        onClick={() => handleAdjustPoints(u, 2000)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/30 rounded-xl text-[10px] font-bold cursor-pointer"
                      >
                        +2K (Gold)
                      </button>
                      <button
                        onClick={() => handleAdjustPoints(u, 10000)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-xl text-[10px] font-bold cursor-pointer"
                      >
                        +10K (Plat)
                      </button>
                      <button
                        onClick={() => handleAdjustPoints(u, 25000)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-pink-300 border border-pink-500/30 rounded-xl text-[10px] font-bold cursor-pointer"
                      >
                        +25K (💎)
                      </button>
                      <button
                        onClick={() => handleAdjustPoints(u, -100)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-bold cursor-pointer"
                      >
                        -100
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Direct Tier Selection Controls */}
                  <div className="lg:col-span-5 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      Direct Tier Promotion:
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['Bronze', 'Silver', 'Gold', 'VIP Platinum', 'Diamond'] as const).map((tierKey) => {
                        const isCurrent = u.vipLevel === tierKey || (tierKey === 'VIP Platinum' && u.vipLevel === 'Platinum');
                        const defaultPointsForTier = tierKey === 'Diamond' ? 25000 : tierKey === 'VIP Platinum' ? 10000 : tierKey === 'Gold' ? 2000 : tierKey === 'Silver' ? 500 : 100;

                        return (
                          <button
                            key={tierKey}
                            onClick={() => {
                              handleUpdateUserVip(
                                u, 
                                tierKey, 
                                Math.max(u.vipPoints || 0, defaultPointsForTier), 
                                tierKey === 'Gold' || tierKey === 'VIP Platinum' || tierKey === 'Diamond' ? true : isVipActive,
                                `Promoted directly to ${tierKey}`
                              );
                            }}
                            disabled={isSaving}
                            className={`p-2 rounded-xl text-[10px] font-bold text-center border transition-all cursor-pointer ${
                              isCurrent
                                ? tierKey === 'Diamond'
                                  ? 'bg-gradient-to-r from-cyan-950 via-indigo-950 to-pink-950 text-cyan-200 font-black border-cyan-300 shadow-md ring-1 ring-cyan-400'
                                  : 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span className="block truncate">{tierKey === 'Diamond' ? '💎 Dia' : tierKey.replace('VIP ', '')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* User Balance & Perk Snapshot Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-4">
                    <span>Main Cash: <strong className="text-amber-300 font-bold">₹{u.balance.toLocaleString('en-IN')}</strong></span>
                    <span>Bonus Wallet: <strong className="text-purple-300 font-bold">₹{(u.bonusBalance || 0).toLocaleString('en-IN')}</strong></span>
                    <span>Daily Limit: <strong className="text-white font-bold">₹{tierInfo.dailyWithdrawalLimit.toLocaleString('en-IN')}</strong></span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Weekly Reward: <strong className="text-emerald-400">₹{tierInfo.weeklyBonusAmount}</strong>
                  </div>
                </div>

              </div>
            );
          })}

          {/* Pagination */}
          <PaginationBar
            currentPage={currentPage}
            totalPages={Math.ceil(filteredUsers.length / pageSize) || 1}
            pageSize={pageSize}
            totalItems={filteredUsers.length}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            label="VIP player profiles"
          />
        </div>
      )}

      {/* VIP LOYALTY PROGRAM TIERS REFERENCE CARD */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Crown className="w-4 h-4" />
            <span>VIP Loyalty Program Structure & Tier Benefits</span>
          </h3>
          <span className="text-[10px] text-slate-400">Standard Payout Rules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(VIP_TIERS).map(([tierName, info]) => (
            <div key={tierName} className={`p-4 rounded-2xl border ${info.bgColor} ${info.borderColor} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black uppercase ${info.color}`}>{tierName}</span>
                <span className="text-[10px] text-slate-400 font-bold">{info.minPoints} - {info.maxPoints === Infinity ? '∞' : info.maxPoints} Pts</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Daily Withdraw:</span>
                  <span className="font-bold text-white">₹{info.dailyWithdrawalLimit.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Weekly Bonus:</span>
                  <span className="font-bold text-emerald-400">₹{info.weeklyBonusAmount}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                {info.perks.slice(0, 2).map((p, i) => (
                  <div key={i} className="flex items-center gap-1 truncate">
                    <Check className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
