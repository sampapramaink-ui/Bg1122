import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Settings, 
  User as UserIcon, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  RotateCcw, 
  Sparkles, 
  HelpCircle, 
  Coins, 
  Flame, 
  Lock, 
  Unlock, 
  Sliders, 
  Check, 
  ArrowRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { User, WithdrawalWagerSettings } from '../../types';
import { 
  DEFAULT_WAGER_SETTINGS, 
  subscribeWithdrawalWagerSettings, 
  saveWithdrawalWagerSettings, 
  calculateUserWagerStatus,
  adminUpdateUserWager
} from '../../utils/wagerEngine';
import { getUserDisplayCode, calculateUserSearchScore } from '../../utils/databaseSync';
import { soundFx } from '../../utils/audio';

interface AdminWithdrawalWagerManagerProps {
  allUsers?: User[];
  onUserUpdated?: (user: User) => void;
  currentUser?: User | null;
}

export const AdminWithdrawalWagerManager: React.FC<AdminWithdrawalWagerManagerProps> = ({
  allUsers = [],
  onUserUpdated,
  currentUser
}) => {
  // Global settings state
  const [settings, setSettings] = useState<WithdrawalWagerSettings>(DEFAULT_WAGER_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User search & custom wager management state
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSavingUserWager, setIsSavingUserWager] = useState<boolean>(false);
  const [userWagerSaveMsg, setUserWagerSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields for selected user
  const [userMainRequired, setUserMainRequired] = useState<string>('0');
  const [userMainCompleted, setUserMainCompleted] = useState<string>('0');
  const [userBonusRequired, setUserBonusRequired] = useState<string>('0');
  const [userBonusCompleted, setUserBonusCompleted] = useState<string>('0');
  const [userWagerExempt, setUserWagerExempt] = useState<boolean>(false);

  // Active subtab
  const [activeTab, setActiveTab] = useState<'global' | 'user_specific'>('global');

  // Subscribe to real-time global wager settings
  useEffect(() => {
    const unsub = subscribeWithdrawalWagerSettings((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsub();
  }, []);

  // Update form fields when selected user changes
  useEffect(() => {
    if (selectedUser) {
      const status = calculateUserWagerStatus(selectedUser, settings);
      setUserMainRequired(String(status.mainRequired));
      setUserMainCompleted(String(status.mainCompleted));
      setUserBonusRequired(String(status.bonusRequired));
      setUserBonusCompleted(String(status.bonusCompleted));
      setUserWagerExempt(Boolean(selectedUser.wagerExempt));
      setUserWagerSaveMsg(null);
    }
  }, [selectedUser, settings]);

  // Handle saving global settings
  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveMsg(null);

    const success = await saveWithdrawalWagerSettings(settings, currentUser?.email || 'Admin');
    setIsSavingSettings(false);

    if (success) {
      soundFx.playCoin();
      setSettingsSaveMsg({
        type: 'success',
        text: 'উইথড্রয়াল উয়েজার সেটিংস সফলভাবে সেভ ও সমস্ত প্লেয়ারদের জন্য রিয়েল-টাইমে কার্যকর করা হয়েছে!'
      });
      setTimeout(() => setSettingsSaveMsg(null), 5000);
    } else {
      setSettingsSaveMsg({
        type: 'error',
        text: 'উয়েজার সেটিংস সেভ করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।'
      });
    }
  };

  // Filter users based on search
  const filteredUsers = userSearchTerm.trim()
    ? allUsers
        .filter((u) => calculateUserSearchScore(u, userSearchTerm).matches)
        .slice(0, 10)
    : allUsers.slice(0, 8);

  // Handle saving user-specific wager
  const handleSaveUserWager = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) return;

    setIsSavingUserWager(true);
    setUserWagerSaveMsg(null);

    const parsedMainReq = Math.max(0, parseFloat(userMainRequired) || 0);
    const parsedMainComp = Math.max(0, parseFloat(userMainCompleted) || 0);
    const parsedBonusReq = Math.max(0, parseFloat(userBonusRequired) || 0);
    const parsedBonusComp = Math.max(0, parseFloat(userBonusCompleted) || 0);

    const updates = {
      mainWagerRequired: parsedMainReq,
      mainWagerCompleted: parsedMainComp,
      bonusWagerRequired: parsedBonusReq,
      bonusWagerCompleted: parsedBonusComp,
      wagerExempt: userWagerExempt
    };

    const success = await adminUpdateUserWager(selectedUser.id, updates);
    setIsSavingUserWager(false);

    if (success) {
      soundFx.playCoin();
      const updatedObj: User = {
        ...selectedUser,
        ...updates
      };
      setSelectedUser(updatedObj);
      onUserUpdated?.(updatedObj);
      setUserWagerSaveMsg({
        type: 'success',
        text: `ইউজার ${selectedUser.name} (${getUserDisplayCode(selectedUser)})-এর উয়েজার সফলভাবে আপডেট হয়েছে!`
      });
      setTimeout(() => setUserWagerSaveMsg(null), 4000);
    } else {
      setUserWagerSaveMsg({
        type: 'error',
        text: 'ইউজার উয়েজার আপডেট করতে ত্রুটি হয়েছে।'
      });
    }
  };

  // Quick action presets for selected user
  const applyPresetWager = (type: '100%_complete' | '1x_main' | '2x_main' | '5x_bonus' | 'reset_0') => {
    soundFx.playClick();
    if (!selectedUser) return;

    const userBal = selectedUser.balance || 0;
    const userBonus = selectedUser.bonusBalance || 0;

    switch (type) {
      case '100%_complete':
        // Mark main and bonus 100% completed
        const reqMain = Math.max(parseFloat(userMainRequired) || 0, userBal);
        const reqBonus = Math.max(parseFloat(userBonusRequired) || 0, userBonus);
        setUserMainRequired(String(reqMain));
        setUserMainCompleted(String(reqMain));
        setUserBonusRequired(String(reqBonus));
        setUserBonusCompleted(String(reqBonus));
        setUserWagerExempt(false);
        break;

      case '1x_main':
        setUserMainRequired(String(userBal * 1));
        setUserMainCompleted('0');
        setUserWagerExempt(false);
        break;

      case '2x_main':
        setUserMainRequired(String(userBal * 2));
        setUserMainCompleted('0');
        setUserWagerExempt(false);
        break;

      case '5x_bonus':
        setUserBonusRequired(String(userBonus * 5));
        setUserBonusCompleted('0');
        setUserWagerExempt(false);
        break;

      case 'reset_0':
        setUserMainRequired('0');
        setUserMainCompleted('0');
        setUserBonusRequired('0');
        setUserBonusCompleted('0');
        setUserWagerExempt(false);
        break;
    }
  };

  const selectedUserStatus = selectedUser ? calculateUserWagerStatus(selectedUser, settings) : null;

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner / Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md shadow-amber-500/10">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-sans flex items-center gap-2">
              <span>উইথড্রয়াল উয়েজার কন্ট্রোল প্যানেল (Withdrawal Wager Settings)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                settings.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
              }`}>
                {settings.enabled ? 'ACTIVE (সক্রিয়)' : 'DISABLED (নিষ্ক্রিয়)'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              মেইন ব্যালেন্স ও বোনাস ব্যালেন্সের উইথড্রয়াল উয়েজার টার্নওভার নীতি নির্ধারণ ও যেকোনো ইউজারের উয়েজার সেট করুন।
            </p>
          </div>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'global'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>গ্লোবাল উয়েজার অপশন (Global Rules)</span>
          </button>

          <button
            onClick={() => setActiveTab('user_specific')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'user_specific'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>ইউজার উয়েজার কন্ট্রোলার (User Wager)</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: GLOBAL WAGER RULES */}
      {activeTab === 'global' && (
        <form onSubmit={handleSaveGlobalSettings} className="space-y-6 animate-in fade-in duration-200">
          {/* Status Message */}
          {settingsSaveMsg && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-sans ${
              settingsSaveMsg.type === 'success' 
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
            }`}>
              {settingsSaveMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{settingsSaveMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Main Balance Wager Multiplier Card */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white font-sans">
                      মেইন ব্যালেন্স উয়েজার (Main Balance Wager)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans">
                      ডিপোজিট বা মেইন ব্যালেন্স উত্তোলনের জন্য প্রয়োজনীয় টার্নওভার
                    </p>
                  </div>
                </div>
                <span className="text-base font-black text-amber-400 font-mono">
                  {settings.mainWagerMultiplier}x
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5 font-sans">
                  মেইন ব্যালেন্স উয়েজার মাল্টিপ্লায়ার (Multiplier):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={settings.mainWagerMultiplier}
                    onChange={(e) => setSettings({ ...settings, mainWagerMultiplier: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none"
                    placeholder="1.0"
                  />
                  <span className="text-sm text-slate-400 font-mono font-bold">গুণ (x)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  উদাহরণ: ১.০x দিলে প্লেয়ার ₹১,০০০ ডিপোজিট করলে ₹১,০০০ পরিমাণের বাজি না ধরা পর্যন্ত উইথড্র ব্লক থাকবে।
                </p>
              </div>

              {/* Quick Multiplier Buttons */}
              <div className="flex items-center gap-2 pt-2">
                {[1.0, 1.5, 2.0, 3.0].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettings({ ...settings, mainWagerMultiplier: m })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      settings.mainWagerMultiplier === m
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>

            {/* Bonus Balance Wager Multiplier Card */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white font-sans">
                      বোনাস ব্যালেন্স উয়েজার (Bonus Balance Wager)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans">
                      রেজিস্ট্রেশন, লাকি হুইল বা উপহার বোনাসের জন্য প্রয়োজনীয় টার্নওভার
                    </p>
                  </div>
                </div>
                <span className="text-base font-black text-purple-400 font-mono">
                  {settings.bonusWagerMultiplier}x
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5 font-sans">
                  বোনাস ব্যালেন্স উয়েজার মাল্টিপ্লায়ার (Multiplier):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={settings.bonusWagerMultiplier}
                    onChange={(e) => setSettings({ ...settings, bonusWagerMultiplier: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none"
                    placeholder="5.0"
                  />
                  <span className="text-sm text-slate-400 font-mono font-bold">গুণ (x)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  উদাহরণ: ৫.০x দিলে প্লেয়ার ₹১০০ বোনাস পেলে ₹৫০০ বাজি ধরতে হবে।
                </p>
              </div>

              {/* Quick Multiplier Buttons */}
              <div className="flex items-center gap-2 pt-2">
                {[0, 3.0, 5.0, 10.0, 15.0].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettings({ ...settings, bonusWagerMultiplier: m })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      settings.bonusWagerMultiplier === m
                        ? 'bg-purple-500 text-white font-black shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Enforce & Policy Toggles */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
            <h3 className="text-sm font-black text-white font-sans flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <span>উইথড্রয়াল যাচাইকরণ ও ডিসপ্লে সেটিংস (Policy Controls)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Toggle 1: Enable Wager Enforcement */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-black text-white block font-sans">
                    উয়েজার প্রয়োগ সক্রিয় রাখুন (Enforce Wagering)
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">
                    চালু থাকলে উয়েজার অপূর্ণ থাকা অবস্থায় উইথড্র ব্লক করা হবে
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Toggle 2: Block and Show Modal */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-black text-white block font-sans">
                    উইথড্রয়াল জমা লক ও সতর্কবার্তা পপআপ
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">
                    উইথড্র বাটনে ক্লিক করলে বিস্তারিত ওয়ার্নিং মডাল দেখাবে
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lockWithdrawalOnPendingWager}
                  onChange={(e) => setSettings({ ...settings, lockWithdrawalOnPendingWager: e.target.checked })}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Custom Bengali Notice Text */}
            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1.5 font-sans">
                ইউজার প্যানেলের সতর্কবার্তা টেক্সট (Player Notice Text):
              </label>
              <textarea
                rows={2}
                value={settings.noticeBangla || ''}
                onChange={(e) => setSettings({ ...settings, noticeBangla: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-xs text-white font-sans outline-none resize-none"
                placeholder="উইথড্রয়াল রিকোয়েস্ট করতে হলে মেইন ব্যালেন্স ও বোনাস ব্যালেন্সের প্রয়োজনীয় উয়েজার সম্পন্ন করতে হবে।"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs font-sans flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSettings ? 'সেভ হচ্ছে...' : 'উয়েজার সেটিংস সেভ করুন (Save Wager Rules)'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 2: INDIVIDUAL USER WAGER CONTROLLER */}
      {activeTab === 'user_specific' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white font-sans flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>যেকোনো ইউজারের উয়েজার সেট ও পরিবর্তন করুন (Custom User Wager Controller)</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  ইউজারের আইডি, নাম, ফোন বা ইমেইল দিয়ে সার্চ করে নির্দিষ্ট প্লেয়ারের উয়েজার কাস্টমাইজ করুন।
                </p>
              </div>

              {selectedUser && (
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-sans cursor-pointer"
                >
                  অন্য ইউজার নির্বাচন করুন
                </button>
              )}
            </div>

            {/* User Search Bar */}
            {!selectedUser && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="প্লেয়ারের নাম, 5-ডিজিট ইউজার কোড (যেমন: 84921), ইমেইল বা ফোন লিখুন..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none"
                  />
                  {userSearchTerm && (
                    <button
                      onClick={() => setUserSearchTerm('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* User List Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredUsers.map((u) => {
                    const uStatus = calculateUserWagerStatus(u, settings);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          soundFx.playClick();
                          setSelectedUser(u);
                        }}
                        className="bg-slate-950 border border-slate-800/80 hover:border-amber-500/60 p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] shadow-md flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={u.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">{u.name}</span>
                              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1 rounded">
                                #{getUserDisplayCode(u)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">{u.email || u.phone || 'No Contact'}</span>
                            <div className="flex items-center gap-2 text-[10px] mt-0.5">
                              <span className="text-slate-300 font-mono">ব্যালেন্স: ₹{u.balance || 0}</span>
                              <span className={`font-sans font-bold ${uStatus.isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {uStatus.isCompleted ? '✓ উয়েজার ওকে' : `${uStatus.progressPercentage}%`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-400">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected User Wager Editor */}
            {selectedUser && (
              <div className="space-y-5 pt-2">
                {/* User Header Profile Card */}
                <div className="bg-slate-950 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={selectedUser.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-amber-500/30 shrink-0 shadow-md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white font-sans">{selectedUser.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          ID: #{getUserDisplayCode(selectedUser)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                          {selectedUser.vipLevel || 'Bronze'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-sans">
                        <span>মেইন ওয়ালেট: <strong className="text-white font-mono">₹{(selectedUser.balance || 0).toLocaleString('en-IN')}</strong></span>
                        <span>বোনাস ওয়ালেট: <strong className="text-purple-400 font-mono">₹{(selectedUser.bonusBalance || 0).toLocaleString('en-IN')}</strong></span>
                        <span>মোট বাজি: <strong className="text-slate-300 font-mono">₹{(selectedUser.totalSpent || 0).toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase block font-sans">উইথড্রয়াল যোগ্যতা স্ট্যাটাস</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full inline-block mt-1 font-sans ${
                      selectedUserStatus?.isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}>
                      {selectedUserStatus?.isCompleted ? 'উইথড্রয়াল অনুমোদিত (Can Withdraw)' : 'উইথড্রয়াল ব্লকড (Wager Remaining)'}
                    </span>
                  </div>
                </div>

                {/* Status Notice */}
                {userWagerSaveMsg && (
                  <div className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-sans ${
                    userWagerSaveMsg.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  }`}>
                    {userWagerSaveMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span>{userWagerSaveMsg.text}</span>
                  </div>
                )}

                {/* Quick Action Preset Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase font-sans">
                    দ্রুত উয়েজার অ্যাকশন (Quick 1-Click Wager Presets):
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyPresetWager('100%_complete')}
                      className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>✅ ১০০% উয়েজার সম্পন্ন করুন (Mark 100% Complete)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetWager('1x_main')}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>১x মেইন ব্যালেন্স সেট (₹{selectedUser.balance || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPresetWager('2x_main')}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>২x মেইন ব্যালেন্স সেট (₹{(selectedUser.balance || 0) * 2})</span>
                    </button>

                    {(selectedUser.bonusBalance || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => applyPresetWager('5x_bonus')}
                        className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>৫x বোনাস উয়েজার সেট</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => applyPresetWager('reset_0')}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>রিসেট (০ করুন)</span>
                    </button>
                  </div>
                </div>

                {/* Form Inputs for Main & Bonus Wager */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Main Wager Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 font-sans">
                      <Coins className="w-4 h-4" />
                      <span>মেইন ব্যালেন্স উয়েজার (Main Balance Wager)</span>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-sans">
                        প্রয়োজনীয় উয়েজার (Target Required ₹):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={userMainRequired}
                        onChange={(e) => setUserMainRequired(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-sans">
                        সম্পন্ন হয়েছে (Completed Turnover ₹):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={userMainCompleted}
                        onChange={(e) => setUserMainCompleted(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none"
                      />
                    </div>
                  </div>

                  {/* Bonus Wager Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-400 font-sans">
                      <Flame className="w-4 h-4" />
                      <span>বোনাস ব্যালেন্স উয়েজার (Bonus Balance Wager)</span>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-sans">
                        প্রয়োজনীয় উয়েজার (Target Required ₹):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={userBonusRequired}
                        onChange={(e) => setUserBonusRequired(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-sans">
                        সম্পন্ন হয়েছে (Completed Turnover ₹):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={userBonusCompleted}
                        onChange={(e) => setUserBonusCompleted(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Exemption Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-white block font-sans">
                        উয়েজার থেকে পূর্ণ ছাড় (VIP Wager Exemption)
                      </span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        সক্রিয় থাকলে এই প্লেয়ার উয়েজার ছাড়া যেকোনো সময় আনলিমিটেড উইথড্র করতে পারবে
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userWagerExempt}
                    onChange={(e) => setUserWagerExempt(e.target.checked)}
                    className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
                  />
                </div>

                {/* Save User Wager Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-sans font-bold cursor-pointer"
                  >
                    বাতিল করুন
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveUserWager()}
                    disabled={isSavingUserWager}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs font-sans flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingUserWager ? 'সংরক্ষণ হচ্ছে...' : 'ইউজারের উয়েজার সেভ করুন (Save Wager)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
