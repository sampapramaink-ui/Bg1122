import React, { useState, useEffect } from 'react';
import { 
  Gift, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, 
  Search, Plus, Minus, RotateCcw, Wallet, Info, Lock, Check, Save, Zap,
  Sliders, Trophy, Dices, HelpCircle, ArrowRightLeft
} from 'lucide-react';
import { User, BonusBalanceRules } from '../../types';
import { soundFx } from '../../utils/audio';
import { doc, onSnapshot, setDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { isMockDemoUser, getUserDisplayCode, calculateUserSearchScore } from '../../utils/databaseSync';

interface AdminBonusManagerProps {
  users: User[];
  onUpdateUserBonusBalance?: (newBonusBalance: number) => void;
  currentUser?: User;
}

const DEFAULT_BONUS_RULES: BonusBalanceRules = {
  allowSuperCar: true,          // Allowed by default (Only Free Super Car)
  allowRegularLottery: false,   // Disabled by default
  allowLiveRoulette: false,     // Disabled by default
  allowLuckyWheel: false,       // Disabled by default
  defaultBonusAmount: 100,
  isBonusSystemActive: true,
  bonusNotice: 'বোনাস ব্যালেন্স দিয়ে শুধুমাত্র থ্রী সুপার কার টিকিট কেনা যাবে। বোনাস ব্যালেন্স দিয়ে জেতা টাকা সরাসরি বোনাস ওয়ালেটে যোগ হবে।',
  updatedAt: new Date().toISOString()
};

export const AdminBonusManager: React.FC<AdminBonusManagerProps> = ({
  users,
  onUpdateUserBonusBalance,
  currentUser
}) => {
  const [rules, setRules] = useState<BonusBalanceRules>(DEFAULT_BONUS_RULES);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allUsersList, setAllUsersList] = useState<User[]>(users);
  const [customBonusAmount, setCustomBonusAmount] = useState<{ [userId: string]: string }>({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Real-time Firestore sync with system_settings/bonus_rules
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'bonus_rules'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<BonusBalanceRules>;
        setRules({
          allowSuperCar: data.allowSuperCar !== undefined ? data.allowSuperCar : true,
          allowRegularLottery: data.allowRegularLottery || false,
          allowLiveRoulette: data.allowLiveRoulette || false,
          allowLuckyWheel: data.allowLuckyWheel || false,
          defaultBonusAmount: typeof data.defaultBonusAmount === 'number' ? data.defaultBonusAmount : 100,
          isBonusSystemActive: data.isBonusSystemActive !== undefined ? data.isBonusSystemActive : true,
          bonusNotice: data.bonusNotice || DEFAULT_BONUS_RULES.bonusNotice,
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      }
      setLoading(false);
    }, (err) => {
      console.warn('Error listening to bonus rules snapshot:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Real-time Users list sync
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uList: User[] = [];

      snap.forEach((d) => {
        const data = d.data();
        const email = (data.email || '').toLowerCase().trim();
        if (isMockDemoUser(d.id, email)) {
          deleteDoc(doc(db, 'users', d.id)).catch(() => {});
          return;
        }

        uList.push({
          id: d.id,
          name: data.name || (email ? email.split('@')[0] : 'User'),
          email: email,
          phone: data.phone || '',
          balance: typeof data.balance === 'number' ? data.balance : 0,
          bonusBalance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
          avatarUrl: data.avatarUrl || '',
          regDate: data.regDate || '',
          vipLevel: data.vipLevel || 'Bronze',
          referralCode: data.referralCode || '',
          totalWon: typeof data.totalWon === 'number' ? data.totalWon : 0,
          totalSpent: typeof data.totalSpent === 'number' ? data.totalSpent : 0,
          status: data.status || 'active'
        });
      });

      // Deduplicate by email
      const emailMap: { [email: string]: User } = {};
      uList.forEach((u) => {
        const key = u.email ? u.email.toLowerCase().trim() : u.id;
        if (!emailMap[key] || u.bonusBalance > emailMap[key].bonusBalance) {
          emailMap[key] = u;
        }
      });

      const deduplicated = Object.values(emailMap);
      setAllUsersList(deduplicated.length > 0 ? deduplicated : uList);
    }, (err) => {
      console.warn('Error listening to users for bonus manager:', err);
    });

    return () => unsubUsers();
  }, []);

  // Save Bonus Rules to Firestore
  const handleSaveBonusRules = async () => {
    setSaving(true);
    try {
      const updatedPayload: BonusBalanceRules = {
        ...rules,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'system_settings', 'bonus_rules'), updatedPayload, { merge: true });
      
      // Also sync default registration bonus to registration_config
      await setDoc(doc(db, 'system_settings', 'registration_config'), {
        bonusAmount: rules.defaultBonusAmount,
        isBonusEnabled: rules.isBonusSystemActive,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      soundFx.playCoin();
      setSaveSuccess(true);
      setActionSuccessMsg('✅ বোনাস পলিসি ও গেম পারমিশন সফলভাবে ফায়ারবেসে রিয়েল-টাইমে সেভ হয়েছে!');
      setTimeout(() => {
        setSaveSuccess(false);
        setActionSuccessMsg(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to save bonus rules:', err);
      alert('Failed to save bonus rules to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Modify individual user bonus balance in real-time Firestore
  const handleUpdateTargetUserBonus = async (targetUser: User, newBonusBalance: number, note: string) => {
    soundFx.playClick();
    const cleanNewBonus = Math.max(0, Math.round(newBonusBalance));

    try {
      // 1. Update strictly the canonical primary user document
      await setDoc(doc(db, 'users', targetUser.id), { bonusBalance: cleanNewBonus, updatedAt: new Date().toISOString() }, { merge: true });

      // 2. Clean up legacy alias doc or other duplicate documents for this email to avoid duplicates
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

      // If updating current logged in user
      if (currentUser && (currentUser.id === targetUser.id || currentUser.email === targetUser.email)) {
        if (onUpdateUserBonusBalance) {
          onUpdateUserBonusBalance(cleanNewBonus);
        }
      }

      // Update local state
      setAllUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id || (u.email && u.email === targetUser.email) ? { ...u, bonusBalance: cleanNewBonus } : u))
      );

      soundFx.playCoin();
      setActionSuccessMsg(`✨ ${targetUser.name || 'User'}-এর বোনাস ব্যালেন্স আপডেট করা হয়েছে: ₹${cleanNewBonus} (${note})`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error updating user bonus balance:', err);
      alert('Error updating user bonus balance in Firestore.');
    }
  };

  const totalBonusInCirculation = allUsersList.reduce((sum, u) => sum + (u.bonusBalance || 0), 0);
  const totalMainBalanceInCirculation = allUsersList.reduce((sum, u) => sum + (u.balance || 0), 0);

  const filteredUsers = searchQuery.trim()
    ? allUsersList
        .map((u) => ({ user: u, ...calculateUserSearchScore(u, searchQuery) }))
        .filter((item) => item.matches)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.user)
    : allUsersList;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Summary Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-purple-950/80 via-slate-900 to-amber-950/40 border border-purple-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-purple-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Gift className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white font-mono uppercase tracking-tight">
                  BONUS BALANCE & GAME PERMISSIONS
                </h2>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                  LIVE REAL-TIME
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                কন্ট্রোল করুন কোন কোন গেমের টিকিট বোনাস ব্যালেন্স দিয়ে কেনা যাবে এবং কোনগুলো কেনা যাবে না।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveBonusRules}
              disabled={saving}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-98'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>SAVED TO FIRESTORE!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>SAVE RULES & PERMISSIONS</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Total Circulation Stat Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-purple-500/20 font-mono">
          <div className="p-3 bg-slate-950/60 rounded-2xl border border-purple-500/30">
            <span className="text-[10px] uppercase text-purple-300 font-bold block">Total Bonus in Circulation</span>
            <span className="text-lg font-black text-purple-200">₹{totalBonusInCirculation.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Main Balance in Circulation</span>
            <span className="text-lg font-black text-amber-400">₹{totalMainBalanceInCirculation.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Registered Users</span>
            <span className="text-lg font-black text-white">{allUsersList.length} Accounts</span>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* SECTION 1: GAME PURCHASE PERMISSION SWITCHES */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white font-mono uppercase">
              1. GAME TICKET PURCHASE PERMISSION RULES
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            (এখান থেকে টিক অন/অফ করলেই ইউজারের ডিভাইসে রিয়েলটাইমে আপডেট হবে)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Game 1: Three Super Car Draw (Default Allowed) */}
          <div className={`p-4 rounded-2xl border transition-all ${
            rules.allowSuperCar
              ? 'bg-purple-950/40 border-purple-500/50 shadow-md ring-1 ring-purple-500/20'
              : 'bg-slate-950/60 border-slate-800 opacity-70'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white font-mono">Three Super Car Draw (থ্রী সুপার কার ড্র)</h4>
                    {rules.allowSuperCar ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                        ALLOWED (অনুমোদিত)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                        LOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    ইউজার তার বোনাস ব্যালেন্স ব্যবহার করে Red, Black, Yellow সুপার কার টিকিট কিনতে পারবে।
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setRules((prev) => ({ ...prev, allowSuperCar: !prev.allowSuperCar }));
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rules.allowSuperCar ? 'bg-purple-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rules.allowSuperCar ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Game 2: Regular Lottery Draws (4D, Bumper, Speed 1m, Daily Mega) */}
          <div className={`p-4 rounded-2xl border transition-all ${
            rules.allowRegularLottery
              ? 'bg-amber-950/40 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white font-mono">Regular Lottery Draws (রেগুলার লটারি ড্র)</h4>
                    {rules.allowRegularLottery ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                        ALLOWED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
                        BLOCKED (ডিফল্ট বন্ধ)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    4D Express, Bumper Jackpot, Speed 1m ও Daily Mega লটারির টিকিট বোনাস দিয়ে কেনা অনুমোদিত কিনা।
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setRules((prev) => ({ ...prev, allowRegularLottery: !prev.allowRegularLottery }));
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rules.allowRegularLottery ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rules.allowRegularLottery ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Game 3: Live Roulette Casino */}
          <div className={`p-4 rounded-2xl border transition-all ${
            rules.allowLiveRoulette
              ? 'bg-amber-950/40 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Dices className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white font-mono">Live Roulette Casino (লাইভ রুলেট ক্যাসিনো)</h4>
                    {rules.allowLiveRoulette ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                        ALLOWED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
                        BLOCKED (ডিফল্ট বন্ধ)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    ইউজার লাইভ রুলেট টেবিলে বোনাস ব্যালেন্স দিয়ে চিপস বেট ধরতে পারবে কিনা।
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setRules((prev) => ({ ...prev, allowLiveRoulette: !prev.allowLiveRoulette }));
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rules.allowLiveRoulette ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rules.allowLiveRoulette ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Game 4: Lucky Spin Wheel */}
          <div className={`p-4 rounded-2xl border transition-all ${
            rules.allowLuckyWheel
              ? 'bg-amber-950/40 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white font-mono">Daily Lucky Wheel Spin (লাকি হুইল)</h4>
                    {rules.allowLuckyWheel ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                        ALLOWED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
                        BLOCKED (ডিফল্ট বন্ধ)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    বোনাস ব্যালেন্স দিয়ে লাকি হুইল ক্রেডিট কেনা অনুমোদিত কিনা।
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setRules((prev) => ({ ...prev, allowLuckyWheel: !prev.allowLuckyWheel }));
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rules.allowLuckyWheel ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rules.allowLuckyWheel ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Same-Wallet Win Guarantee Card */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-2xl flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white font-mono uppercase">
                SAME-WALLET WINNING PAYOUT GUARANTEE (ওয়ালেট অনুযায়ী উইনিং যোগ হওয়ার নিশ্চয়তা)
              </h4>
              <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded font-mono">
                100% AUTOMATED
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              সিস্টেমে নিশ্চিত করা হয়েছে: ইউজার যদি <strong>বোনাস ওয়ালেট</strong> দিয়ে টিকিট ক্রয় করে, ড্র-তে জিতলে উইনিং টাকা সরাসরি তার <strong>বোনাস ব্যালেন্সেই</strong> জমা হবে। আর যদি <strong>মূল ওয়ালেট (Main Cash)</strong> দিয়ে ক্রয় করে, তবে উইনিং টাকা সরাসরি <strong>মূল ব্যালেন্সে</strong> জমা হবে।
            </p>
          </div>
        </div>

        {/* Global Settings Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold font-mono text-slate-300 flex items-center justify-between">
              <span>Default Welcome Bonus for New Signups (₹)</span>
              <span className="text-amber-400">₹{rules.defaultBonusAmount}</span>
            </label>
            <input
              type="number"
              min="0"
              value={rules.defaultBonusAmount}
              onChange={(e) => setRules({ ...rules, defaultBonusAmount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold font-mono text-slate-300">
              Bonus System Master Status
            </label>
            <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-700">
              <span className="text-xs font-mono text-slate-300">
                {rules.isBonusSystemActive ? 'Bonus System Active (সক্রিয়)' : 'Bonus System Paused (স্থগিত)'}
              </span>
              <button
                type="button"
                onClick={() => setRules({ ...rules, isBonusSystemActive: !rules.isBonusSystemActive })}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                  rules.isBonusSystemActive
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {rules.isBonusSystemActive ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: REAL-TIME USER BONUS WALLET INSPECTOR & ADJUSTER */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white font-mono uppercase flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" />
              <span>2. REAL-TIME USER BONUS WALLET MANAGER</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              যেকোনো ইউজারের বোনাস ব্যালেন্স সরাসরি বাড়ান, কমান অথবা রিসেট করুন (ফায়ারবেসে সাথে সাথে সেভ হবে)।
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 font-mono focus:border-purple-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px]">
                <th className="p-3">User</th>
                <th className="p-3 text-right">Main Cash Wallet</th>
                <th className="p-3 text-right">Bonus Wallet</th>
                <th className="p-3 text-center">Quick Adjust Bonus</th>
                <th className="p-3 text-right">Custom Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                filteredUsers.slice(0, 50).map((u) => {
                  const currentBonus = u.bonusBalance || 0;
                  const currentCustomInput = customBonusAmount[u.id] || '';

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white line-clamp-1">{u.name || 'User'}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{u.email || u.phone || u.id}</div>
                      </td>
                      <td className="p-3 text-right font-bold text-amber-400">
                        ₹{(u.balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-black">
                          ₹{currentBonus.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetUserBonus(u, currentBonus + 100, '+₹100 Bonus Credit')}
                            className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            +₹100
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetUserBonus(u, currentBonus + 500, '+₹500 Bonus Credit')}
                            className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-slate-950 border border-purple-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            +₹500
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetUserBonus(u, Math.max(0, currentBonus - 100), '-₹100 Bonus Debit')}
                            className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            -₹100
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetUserBonus(u, 0, 'Reset Bonus to ₹0')}
                            className="px-1.5 py-1 bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            title="Reset bonus to 0"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            placeholder="Amount"
                            value={currentCustomInput}
                            onChange={(e) => setCustomBonusAmount({ ...customBonusAmount, [u.id]: e.target.value })}
                            className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-mono text-center focus:border-purple-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = parseInt(currentCustomInput, 10);
                              if (!isNaN(val)) {
                                handleUpdateTargetUserBonus(u, val, `Set Bonus to ₹${val}`);
                                setCustomBonusAmount({ ...customBonusAmount, [u.id]: '' });
                              }
                            }}
                            className="px-2 py-1 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
                          >
                            SET
                          </button>
                        </div>
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
  );
};
