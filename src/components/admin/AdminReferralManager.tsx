import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Gift, DollarSign, Calendar, Search, Filter, CheckCircle2, 
  Clock, ArrowUpRight, TrendingUp, Settings, Save, ShieldCheck, 
  ExternalLink, Sparkles, RefreshCw, AlertCircle, Award, Check
} from 'lucide-react';
import { collection, query, onSnapshot, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, ReferralRecord, ReferralSettings } from '../../types';
import { getReferralSettings, saveReferralSettings, DEFAULT_REFERRAL_SETTINGS, processReferralOnDepositApproval } from '../../utils/referralEngine';
import { soundFx } from '../../utils/audio';

interface AdminReferralManagerProps {
  users?: User[];
  currentUser?: User;
}

export const AdminReferralManager: React.FC<AdminReferralManagerProps> = ({ users = [], currentUser }) => {
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // Settings edit states
  const [bonusAmountInput, setBonusAmountInput] = useState<number>(100);
  const [minDepositInput, setMinDepositInput] = useState<number>(1000);
  const [enabledInput, setEnabledInput] = useState<boolean>(true);

  // Filter & Search states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending_deposit'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'top_referrers' | 'settings'>('dashboard');

  // Load Settings
  useEffect(() => {
    getReferralSettings().then((s) => {
      setSettings(s);
      setBonusAmountInput(s.bonusAmount || 100);
      setMinDepositInput(s.minDepositAmount || 1000);
      setEnabledInput(s.enabled ?? true);
    });
  }, []);

  // Listen to All Referrals in Real-time
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'referrals'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralRecord));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setReferrals(list);
      setLoading(false);
    }, (err) => {
      console.warn('Notice listening to all referrals in Admin:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    setSavingSettings(true);
    try {
      const updated = await saveReferralSettings({
        enabled: enabledInput,
        bonusAmount: Number(bonusAmountInput),
        minDepositAmount: Number(minDepositInput)
      }, currentUser?.email || 'admin');

      setSettings(updated);
      setSettingsSavedSuccess(true);
      setTimeout(() => setSettingsSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Date filtering logic
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const filteredReferrals = useMemo(() => {
    return referrals.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = (item.refereeName || '').toLowerCase().includes(term);
        const matchEmail = (item.refereeEmail || '').toLowerCase().includes(term);
        const matchReferrerName = (item.referrerName || '').toLowerCase().includes(term);
        const matchCode = (item.referrerCode || '').toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchReferrerName && !matchCode) {
          return false;
        }
      }

      // Date filter
      if (dateFilter === 'all') return true;

      const itemDateStr = item.createdAt ? item.createdAt.split('T')[0] : '';
      if (dateFilter === 'today') {
        return itemDateStr === todayStr;
      }
      if (dateFilter === 'yesterday') {
        return itemDateStr === yesterdayStr;
      }
      if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
        return (item.timestamp || 0) >= weekAgo;
      }
      if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
        return (item.timestamp || 0) >= monthAgo;
      }
      if (dateFilter === 'custom' && customDate) {
        return itemDateStr === customDate;
      }

      return true;
    });
  }, [referrals, dateFilter, customDate, statusFilter, searchTerm, todayStr, yesterdayStr]);

  // Overall Metrics
  const totalCount = referrals.length;
  const todayCount = referrals.filter((r) => r.createdAt && r.createdAt.split('T')[0] === todayStr).length;
  const yesterdayCount = referrals.filter((r) => r.createdAt && r.createdAt.split('T')[0] === yesterdayStr).length;
  const completedCount = referrals.filter((r) => r.status === 'completed').length;
  const pendingCount = referrals.filter((r) => r.status === 'pending_deposit').length;
  const totalPaidBonus = referrals
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + (r.bonusAmount || settings.bonusAmount || 100), 0);

  // Daily / Yesterday / Tomorrow stats breakdown
  const yesterdayReferrals = referrals.filter((r) => r.createdAt && r.createdAt.split('T')[0] === yesterdayStr);
  const yesterdayCompleted = yesterdayReferrals.filter((r) => r.status === 'completed').length;
  const yesterdayPending = yesterdayReferrals.filter((r) => r.status === 'pending_deposit').length;
  const yesterdayPaidBonus = yesterdayReferrals
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + (r.bonusAmount || settings.bonusAmount || 100), 0);

  const todayReferrals = referrals.filter((r) => r.createdAt && r.createdAt.split('T')[0] === todayStr);
  const todayCompleted = todayReferrals.filter((r) => r.status === 'completed').length;
  const todayPending = todayReferrals.filter((r) => r.status === 'pending_deposit').length;
  const todayPaidBonus = todayReferrals
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + (r.bonusAmount || settings.bonusAmount || 100), 0);

  // Tomorrow / Projected Pipeline (Unfunded signups ready to qualify)
  const tomorrowPipelineCount = pendingCount;
  const tomorrowProjectedBonus = tomorrowPipelineCount * (settings.bonusAmount || 100);

  // Top Referrers Calculation
  const topReferrers = useMemo(() => {
    const map = new Map<string, {
      referrerId: string;
      referrerName: string;
      referrerCode: string;
      referrerEmail?: string;
      totalInvited: number;
      completedDeposits: number;
      pendingDeposits: number;
      totalEarned: number;
    }>();

    referrals.forEach((r) => {
      const key = r.referrerId || r.referrerCode;
      if (!key) return;

      const existing = map.get(key) || {
        referrerId: r.referrerId,
        referrerName: r.referrerName || 'User',
        referrerCode: r.referrerCode,
        referrerEmail: r.referrerEmail,
        totalInvited: 0,
        completedDeposits: 0,
        pendingDeposits: 0,
        totalEarned: 0
      };

      existing.totalInvited += 1;
      if (r.status === 'completed') {
        existing.completedDeposits += 1;
        existing.totalEarned += (r.bonusAmount || settings.bonusAmount || 100);
      } else {
        existing.pendingDeposits += 1;
      }

      map.set(key, existing);
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.totalInvited - a.totalInvited || b.completedDeposits - a.completedDeposits);
    return list;
  }, [referrals, settings.bonusAmount]);

  // Force Credit Bonus (Admin Manual Action)
  const handleForceCredit = async (ref: ReferralRecord) => {
    if (ref.status === 'completed') return;
    if (!window.confirm(`আপনি কি নিশ্চিত যে ${ref.referrerName}-কে রেফারেল বোনাস (₹${ref.bonusAmount || settings.bonusAmount}) ম্যানুয়ালি প্রদান করতে চান?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'referrals', ref.id), {
        status: 'completed',
        creditedAt: new Date().toISOString(),
        manualAdminCredit: true
      });
      soundFx.playWin();
      alert('সফলভাবে রেফারেল বোনাস অ্যাপ্রুভ ও ক্রেডিট করা হয়েছে!');
    } catch (err) {
      console.error('Error force crediting:', err);
      alert('ত্রুটি: বোনাস ক্রেডিট করা সম্ভব হয়নি।');
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* TOP BANNER & STATS */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border border-amber-500/40 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Users className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  রেফারেল সিস্টেম ও কন্ট্রোলার হাব
                </h2>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                  settings.enabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                }`}>
                  {settings.enabled ? '● ACTIVE PROGRAM' : '○ DISABLED'}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                টপ রেফারার, ডেইলি স্ট্যাটস, ট্র্যাকিং এবং বোনাস কনফিগারেশন পরিচালনা করুন
              </p>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => { soundFx.playClick(); setActiveTab('dashboard'); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>স্ট্যাটস ও লগ ({referrals.length})</span>
            </button>
            <button
              onClick={() => { soundFx.playClick(); setActiveTab('top_referrers'); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'top_referrers' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>টপ রেফারার ({topReferrers.length})</span>
            </button>
            <button
              onClick={() => { soundFx.playClick(); setActiveTab('settings'); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>কন্ট্রোলার সেটিংস</span>
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">মোট রেফারেল</span>
            <p className="text-xl font-black text-white mt-1">{totalCount} জন</p>
            <span className="text-[10px] text-slate-500 mt-1 block font-mono">সর্বমোট সাইন-আপ</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-amber-500/30 rounded-2xl bg-amber-950/10">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">আজকের রেফারেল (Today)</span>
            <p className="text-xl font-black text-amber-400 mt-1">{todayCount} জন</p>
            <span className="text-[10px] text-slate-400 mt-1 block font-mono">গতকাল: {yesterdayCount} জন</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-emerald-500/30 rounded-2xl bg-emerald-950/10">
            <span className="text-[10px] text-emerald-400 uppercase font-bold block">ডিপোজিট সফল (Completed)</span>
            <p className="text-xl font-black text-emerald-400 mt-1">{completedCount} জন</p>
            <span className="text-[10px] text-emerald-400/80 mt-1 block font-mono">কোয়ালিফাইড মেম্বার</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">ডিপোজিট পেন্ডিং</span>
            <p className="text-xl font-black text-amber-300 mt-1">{pendingCount} জন</p>
            <span className="text-[10px] text-slate-500 mt-1 block font-mono">ডিপোজিটের অপেক্ষায়</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-emerald-500/40 rounded-2xl bg-emerald-950/20 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-emerald-300 uppercase font-bold block">মোট পেইড বোনাস</span>
            <p className="text-xl font-black text-emerald-400 mt-1">₹{totalPaidBonus.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-slate-400 mt-1 block font-mono">সরাসরি ওয়ালেট পেইড</span>
          </div>
        </div>

        {/* DAILY, YESTERDAY & TOMORROW (PIPELINE) STATS BREAKDOWN */}
        <div className="pt-2">
          <div className="p-4 bg-slate-950/90 border border-amber-500/30 rounded-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>রেফারেল সময়ভিত্তিক অ্যানালিটিক্স (Yesterday / Today / Tomorrow Pipeline)</span>
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">
                রিয়েলটাইম আপডেট
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Yesterday */}
              <div 
                onClick={() => { soundFx.playClick(); setDateFilter('yesterday'); }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  dateFilter === 'yesterday' 
                    ? 'bg-slate-900 border-amber-400 shadow-md shadow-amber-500/10' 
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-slate-300">📅 গতকাল (Yesterday)</span>
                  <span className="text-[10px] text-slate-500">{yesterdayStr}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">ইনভাইট</span>
                    <strong className="text-xs text-white">{yesterdayReferrals.length}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-emerald-400 block">সফল</span>
                    <strong className="text-xs text-emerald-400">{yesterdayCompleted}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-amber-400 block">পেইড</span>
                    <strong className="text-xs text-amber-300">₹{yesterdayPaidBonus}</strong>
                  </div>
                </div>
              </div>

              {/* Today */}
              <div 
                onClick={() => { soundFx.playClick(); setDateFilter('today'); }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  dateFilter === 'today' 
                    ? 'bg-amber-950/20 border-amber-400 shadow-md shadow-amber-500/20' 
                    : 'bg-slate-900/60 border-amber-500/30 hover:border-amber-500/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-amber-300 flex items-center gap-1">
                    <span>☀️ আজ (Today / Daily)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </span>
                  <span className="text-[10px] text-amber-400/80">{todayStr}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">ইনভাইট</span>
                    <strong className="text-xs text-amber-300">{todayReferrals.length}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-emerald-400 block">সফল</span>
                    <strong className="text-xs text-emerald-400">{todayCompleted}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-amber-400 block">পেইড</span>
                    <strong className="text-xs text-amber-300">₹{todayPaidBonus}</strong>
                  </div>
                </div>
              </div>

              {/* Tomorrow / Pipeline Forecast */}
              <div 
                onClick={() => { soundFx.playClick(); setStatusFilter('pending_deposit'); }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  statusFilter === 'pending_deposit' 
                    ? 'bg-purple-950/20 border-purple-400 shadow-md shadow-purple-500/20' 
                    : 'bg-slate-900/60 border-purple-500/30 hover:border-purple-500/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-purple-300">🔮 আগামীকাল / পাইপলাইন</span>
                  <span className="text-[10px] text-purple-400">ডিপোজিটের অপেক্ষায়</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">পেন্ডিং</span>
                    <strong className="text-xs text-purple-300">{tomorrowPipelineCount}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-purple-300 block">টার্গেট</span>
                    <strong className="text-[10px] text-white">≥₹{settings.minDepositAmount || 1000}</strong>
                  </div>
                  <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-purple-400 block">প্রত্যাশিত</span>
                    <strong className="text-xs text-purple-300">₹{tomorrowProjectedBonus}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: DASHBOARD & REFERRALS LOG TABLE */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 animate-in fade-in">
          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ইউজার নাম, ইমেইল বা রেফারেল কোড দিয়ে সার্চ করুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>তারিখ:</span>
              </span>
              {[
                { id: 'all', label: 'সব (All)' },
                { id: 'today', label: 'আজ (Today)' },
                { id: 'yesterday', label: 'গতকাল' },
                { id: 'week', label: '৭ দিন' },
                { id: 'month', label: 'এই মাস' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => { soundFx.playClick(); setDateFilter(btn.id as any); }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    dateFilter === btn.id
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {btn.label}
                </button>
              ))}

              {/* Custom Date Input */}
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateFilter('custom');
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">স্ট্যাটাস:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-white rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="all">সব স্ট্যাটাস</option>
                <option value="completed">✅ ডিপোজিট সফল (Completed)</option>
                <option value="pending_deposit">⏳ ডিপোজিট পেন্ডিং (Pending)</option>
              </select>
            </div>
          </div>

          {/* REFERRALS AUDIT TABLE */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="p-3.5">আমন্ত্রণকারী (Referrer)</th>
                    <th className="p-3.5">আমন্ত্রিত বন্ধু (Referee)</th>
                    <th className="p-3.5">তারিখ ও সময়</th>
                    <th className="p-3.5">ন্যূনতম ডিপোজিট</th>
                    <th className="p-3.5">অর্জিত বোনাস</th>
                    <th className="p-3.5">স্ট্যাটাস</th>
                    <th className="p-3.5 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span>রেফারেল রেকর্ড লোড হচ্ছে...</span>
                      </td>
                    </tr>
                  ) : filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        কোনো রেফারেল রেকর্ড খুঁজে পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map((ref) => {
                      const isCompleted = ref.status === 'completed';
                      return (
                        <tr key={ref.id} className="hover:bg-slate-900/40 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-white">{ref.referrerName || 'User'}</div>
                            <div className="text-[10px] text-amber-400 font-mono">
                              কোড: {ref.referrerCode}
                            </div>
                            {ref.referrerEmail && (
                              <div className="text-[10px] text-slate-500">{ref.referrerEmail}</div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{ref.refereeName || 'New User'}</div>
                            <div className="text-[10px] text-slate-400">{ref.refereeEmail}</div>
                            {ref.refereePhone && (
                              <div className="text-[10px] text-slate-500 font-mono">{ref.refereePhone}</div>
                            )}
                          </td>

                          <td className="p-3.5 text-slate-300">
                            <div>{new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(ref.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className="text-white font-bold">
                              ₹{(ref.minDepositRequired || settings.minDepositAmount).toLocaleString('en-IN')}
                            </span>
                            {ref.totalDepositedByReferee > 0 && (
                              <div className="text-[10px] text-emerald-400">
                                জমা: ₹{ref.totalDepositedByReferee.toLocaleString('en-IN')}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 font-bold text-emerald-400">
                            ₹{(ref.bonusAmount || settings.bonusAmount).toLocaleString('en-IN')}
                          </td>

                          <td className="p-3.5">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>সফল (Credited)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>পেন্ডিং (Deposit Awaiting)</span>
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right">
                            {!isCompleted && (
                              <button
                                onClick={() => handleForceCredit(ref)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                title="ম্যানুয়ালি বোনাস ক্রেডিট অনুমোদন করুন"
                              >
                                ফোর্স ক্রেডিট
                              </button>
                            )}
                          </td>
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

      {/* TAB 2: TOP REFERRERS LEADERBOARD */}
      {activeTab === 'top_referrers' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white">টপ রেফারার লিডারবোর্ড</h3>
              <p className="text-xs text-slate-400">যেসব ইউজার সর্বোচ্চ সংখ্যক ফ্রেন্ড ইনভাইট করেছেন তাদের তালিকা</p>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl font-black text-xs">
              মোট রেফারার: {topReferrers.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topReferrers.slice(0, 9).map((ref, idx) => (
              <div 
                key={ref.referrerId || idx}
                className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl relative overflow-hidden space-y-3"
              >
                {/* RANK BADGE */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                      idx === 0 ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30' :
                      idx === 1 ? 'bg-slate-300 text-slate-950' :
                      idx === 2 ? 'bg-amber-700 text-white' :
                      'bg-slate-900 border border-slate-800 text-slate-400'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-black text-white text-xs truncate max-w-[150px]">{ref.referrerName}</h4>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{ref.referrerEmail || 'N/A'}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-mono font-bold">
                    {ref.referrerCode}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-800/80">
                  <div className="bg-slate-900/60 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 uppercase block">মোট আমন্ত্রিত</span>
                    <span className="text-xs font-black text-white">{ref.totalInvited} জন</span>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-2 rounded-xl">
                    <span className="text-[9px] text-emerald-400 uppercase block">ডিপোজিট সফল</span>
                    <span className="text-xs font-black text-emerald-400">{ref.completedDeposits} জন</span>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-500/20 p-2 rounded-xl">
                    <span className="text-[9px] text-amber-400 uppercase block">বোনাস লাভ</span>
                    <span className="text-xs font-black text-amber-300">₹{ref.totalEarned}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CONTROLLER SETTINGS */}
      {activeTab === 'settings' && (
        <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl space-y-6 max-w-2xl animate-in fade-in">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" />
              <span>রেফারেল সিস্টেম কন্ট্রোলার ও কনফিগারেশন</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ইউজার কত টাকা রেফারেল বোনাস পাবে এবং ন্যূনতম কত টাকা ডিপোজিট করলে বোনাস আনলক হবে তা নির্ধারণ করুন
            </p>
          </div>

          {settingsSavedSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>রেফারেল সিস্টেমের সেটিংস সফলভাবে সেভ ও কার্যকর করা হয়েছে!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* ENABLE/DISABLE TOGGLE */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-xs">রেফারেল প্রোগ্রাম চালু / বন্ধ রাখুন</h4>
                <p className="text-[11px] text-slate-400">বন্ধ রাখলে নতুন কোনো রেফারেল বোনাস ক্রেডিট হবে না</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledInput}
                  onChange={(e) => setEnabledInput(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* BONUS AMOUNT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                <span>রেফারেল বোনাস পরিমাণ (প্রতি বন্ধুতে কত টাকা পাবে)</span>
                <span className="text-[10px] text-amber-400 lowercase">বর্তমানে: ₹{settings.bonusAmount}</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min={1}
                  required
                  value={bonusAmountInput}
                  onChange={(e) => setBonusAmountInput(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none"
                  placeholder="e.g. 100"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                আমন্ত্রিত বন্ধু সফলভাবে ন্যূনতম ডিপোজিট করলে আমন্ত্রণকারী ইউজারের ওয়ালেটে এই পরিমাণ টাকা ক্যাশ হিসেবে ক্রেডিট হবে।
              </p>
            </div>

            {/* MINIMUM QUALIFYING DEPOSIT AMOUNT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                <span>ন্যূনতম কোয়ালিফাইং ডিপোজিট (Min Required Deposit for Referee)</span>
                <span className="text-[10px] text-amber-400 lowercase">বর্তমানে: ₹{settings.minDepositAmount}</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min={1}
                  required
                  value={minDepositInput}
                  onChange={(e) => setMinDepositInput(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none"
                  placeholder="e.g. 1000"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                আমন্ত্রিত বন্ধু ন্যূনতম এত টাকা ডিপোজিট না করা পর্যন্ত রেফারেল স্ট্যাটাস 'পেন্ডিং' থাকবে এবং কোনো বোনাস দেওয়া হবে না।
              </p>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {savingSettings ? (
                <span>সেটিংস সেভ হচ্ছে...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>সেটিংস সেভ করুন (Save Configuration)</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
