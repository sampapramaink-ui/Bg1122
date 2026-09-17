import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Share2, Users, Gift, Sparkles, AlertCircle, 
  CheckCircle2, Clock, DollarSign, ArrowRight, ShieldCheck, 
  ExternalLink, MessageCircle, Send, Award
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { User, ReferralRecord, ReferralSettings } from '../types';
import { getDynamicReferralLink, getReferralSettings, DEFAULT_REFERRAL_SETTINGS } from '../utils/referralEngine';
import { soundFx } from '../utils/audio';

interface ReferralModalProps {
  user: User;
  onClose: () => void;
  onOpenDeposit?: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ user, onClose, onOpenDeposit }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<'share' | 'history' | 'rules'>('share');

  const referralCode = user.referralCode || `BG${user.id.slice(0, 6).toUpperCase()}`;
  const referralLink = getDynamicReferralLink(referralCode);

  // Load Settings
  useEffect(() => {
    getReferralSettings().then(setSettings);
  }, []);

  // Listen to User's Referrals in Real-time
  useEffect(() => {
    if (!user.id) return;
    setLoadingReferrals(true);

    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', user.id),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralRecord));
      // Sort newest first
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setReferrals(list);
      setLoadingReferrals(false);
    }, (err) => {
      console.warn('Notice listening to referrals:', err);
      setLoadingReferrals(false);
    });

    return () => unsubscribe();
  }, [user.id]);

  const handleCopyLink = () => {
    soundFx.playClick();
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyCode = () => {
    soundFx.playClick();
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const handleShareNative = async () => {
    soundFx.playClick();
    const shareText = `🔥 BETGURU লটারি ও গেমিং প্ল্যাটফর্মে যোগ দিন এবং ফ্রি ক্যাশ বোনাস জিতে নিন! আমার ইনভাইট কোড: ${referralCode}\nসাইন-আপ করুন: ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BETGURU Referral Program',
          text: shareText,
          url: referralLink
        });
      } catch (_) {}
    } else {
      handleCopyLink();
    }
  };

  const handleShareWhatsApp = () => {
    soundFx.playClick();
    const text = encodeURIComponent(`🔥 BETGURU লটারি ও গেমিং প্ল্যাটফর্মে যোগ দিন এবং ফ্রি ক্যাশ বোনাস জিতে নিন!\nআমার ইনভাইট কোড: ${referralCode}\nরেজিস্ট্রেশন লিংক: ${referralLink}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareTelegram = () => {
    soundFx.playClick();
    const text = encodeURIComponent(`🔥 BETGURU প্ল্যাটফর্মে যোগ দিন এবং ক্যাশ বোনাস উপভোগ করুন! ইনভাইট কোড: ${referralCode}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, '_blank');
  };

  // Metrics calculation
  const totalInvited = referrals.length;
  const completedReferrals = referrals.filter((r) => r.status === 'completed');
  const pendingReferrals = referrals.filter((r) => r.status === 'pending_deposit');
  const totalEarned = completedReferrals.reduce((sum, r) => sum + (r.bonusAmount || settings.bonusAmount || 100), 0);

  // Mask email for privacy (e.g. ra***@gmail.com)
  const maskEmail = (email?: string) => {
    if (!email) return 'User';
    const [name, domain] = email.split('@');
    if (!domain) return email;
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
      <div 
        className="w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/90 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  রেফারেল ও ইনভাইট হাব
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                  ৳{settings.bonusAmount} Cash per Friend
                </span>
              </div>
              <p className="text-xs text-slate-400">
                বন্ধুদের আমন্ত্রণ জানান এবং আনলিমিটেড রিয়েল ক্যাশ বোনাস আয় করুন
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SUB NAVIGATION TABS */}
        <div className="grid grid-cols-3 bg-slate-950 p-1.5 border-b border-slate-800/80 text-xs font-bold">
          <button
            onClick={() => { soundFx.playClick(); setActiveTab('share'); }}
            className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'share'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>ইনভাইট লিংক ও কোড</span>
          </button>
          <button
            onClick={() => { soundFx.playClick(); setActiveTab('history'); }}
            className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>রেফারেল লিস্ট ({totalInvited})</span>
          </button>
          <button
            onClick={() => { soundFx.playClick(); setActiveTab('rules'); }}
            className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>নিয়মাবলী ও শর্ত</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
                <span>মোট আমন্ত্রিত</span>
                <Users className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-black text-white mt-1">
                {totalInvited} <span className="text-xs text-slate-400 font-normal">জন</span>
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-2xl bg-emerald-950/10">
              <div className="flex items-center justify-between text-emerald-400 text-[10px] uppercase">
                <span>মোট অর্জিত বোনাস</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-lg font-black text-emerald-400 mt-1">
                ₹{totalEarned.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
                <span>সফল ডিপোজিট</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-lg font-black text-white mt-1">
                {completedReferrals.length} <span className="text-xs text-slate-400 font-normal">জন</span>
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 border border-amber-500/30 rounded-2xl bg-amber-950/10">
              <div className="flex items-center justify-between text-amber-400 text-[10px] uppercase">
                <span>ডিপোজিট পেন্ডিং</span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-black text-amber-400 mt-1">
                {pendingReferrals.length} <span className="text-xs text-slate-400 font-normal">জন</span>
              </p>
            </div>
          </div>

          {/* TAB 1: SHARE CODE & LINK */}
          {activeTab === 'share' && (
            <div className="space-y-5 animate-in fade-in">
              {/* SPECIAL BANNER */}
              <div className="p-4 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-500/40 rounded-2xl relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-300">
                      বন্ধু ইনভাইট করলেই পাবেন ₹{settings.bonusAmount} ক্যাশ বোনাস!
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      আপনার বন্ধু লিংকের মাধ্যমে রেজিস্ট্রেশন করে ন্যূনতম <strong className="text-white">₹{settings.minDepositAmount.toLocaleString('en-IN')}</strong> ডিপোজিট করলেই সাথে সাথে আপনার একাউন্টে <strong className="text-emerald-400">₹{settings.bonusAmount}</strong> ইনস্ট্যান্ট বোনাস ক্রেডিট হবে!
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. UNIQUE REFERRAL CODE */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                  <span>আপনার ব্যক্তিগত রেফারেল কোড (Unique Referral Code)</span>
                  <span className="text-[10px] text-amber-400 lowercase font-normal">বন্ধুরা সাইন-আপে এই কোডটি দিবে</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950 border-2 border-amber-500/40 rounded-2xl px-4 py-3 text-center text-xl font-black tracking-widest text-amber-400 font-mono select-all">
                    {referralCode}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-2xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-slate-950 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'কপি হয়েছে!' : 'কোড কপি করুন'}</span>
                  </button>
                </div>
              </div>

              {/* 2. DYNAMIC WEBSITE REFERRAL LINK */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                  <span>ডায়নামিক রেফারেল লিংক (Dynamic Website Referral Link)</span>
                  <span className="text-[10px] text-emerald-400 lowercase font-normal">অটোমেটিক বর্তমান ডোমেইন যুক্ত</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-4 pr-32 py-3 text-xs text-slate-300 font-mono focus:outline-none select-all truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-slate-700 active:scale-95"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'কপাইড!' : 'লিংক কপি'}</span>
                  </button>
                </div>
              </div>

              {/* 3. SOCIAL SHARING CHANNELS */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  সোশ্যাল মিডিয়া ও বন্ধুদের সাথে শেয়ার করুন
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleShareWhatsApp}
                    className="p-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 rounded-2xl flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={handleShareTelegram}
                    className="p-3 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/40 hover:border-sky-400 rounded-2xl flex items-center justify-center gap-2 text-sky-300 text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <Send className="w-4 h-4 text-sky-400" />
                    <span>Telegram</span>
                  </button>

                  <button
                    onClick={handleShareNative}
                    className="p-3 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 hover:border-amber-400 rounded-2xl flex items-center justify-center gap-2 text-amber-300 text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <Share2 className="w-4 h-4 text-amber-400" />
                    <span>অন্যান্য / Share</span>
                  </button>
                </div>
              </div>

              {/* HOW IT WORKS HIGHLIGHT */}
              <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>কিভাবে বোনাস পাবেন? ৩টি সহজ ধাপ:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px]">1</span>
                    <h5 className="font-bold text-white pt-1">লিংক শেয়ার করুন</h5>
                    <p className="text-[11px] text-slate-400">বন্ধুকে রেফারেল লিংক বা কোড পাঠিয়ে দিন</p>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px]">2</span>
                    <h5 className="font-bold text-white pt-1">বন্ধু ডিপোজিট করবে</h5>
                    <p className="text-[11px] text-slate-400">বন্ধু ন্যূনতম ₹{settings.minDepositAmount} ডিপোজিট করবে</p>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-[10px]">3</span>
                    <h5 className="font-bold text-white pt-1">ইনস্ট্যান্ট ₹{settings.bonusAmount} বোনাস</h5>
                    <p className="text-[11px] text-slate-400">ডিপোজিট অ্যাপ্রুভ হলেই ওয়ালেটে ক্যাশ যুক্ত হবে</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REFERRALS LIST & STATUS TRACKING */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">আপনার আমন্ত্রিত ফ্রেন্ডলিস্ট</h3>
                  <p className="text-xs text-slate-400">কে ডিপোজিট করেছে এবং কার স্ট্যাটাস পেন্ডিং তা ট্র্যাক করুন</p>
                </div>
                <span className="px-2.5 py-1 bg-slate-900 text-slate-300 border border-slate-800 rounded-lg text-xs font-bold">
                  মোট: {totalInvited}
                </span>
              </div>

              {loadingReferrals ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>রেফারেল তথ্য লোড হচ্ছে...</span>
                </div>
              ) : referrals.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl space-y-3">
                  <Users className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    এখনও পর্যন্ত কোনো বন্ধু আপনার কোড ব্যবহার করে সাইন-আপ করেনি।
                  </p>
                  <button
                    onClick={() => setActiveTab('share')}
                    className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl cursor-pointer hover:bg-amber-400 transition"
                  >
                    এখনই বন্ধুদের ইনভাইট করুন
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80">
                  {referrals.map((ref) => {
                    const isCompleted = ref.status === 'completed';
                    return (
                      <div key={ref.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}>
                            {ref.refereeName ? ref.refereeName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-white">{ref.refereeName || 'New Player'}</h4>
                              <span className="text-[10px] text-slate-500">
                                ({maskEmail(ref.refereeEmail)})
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              যোগদান: {new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                          {isCompleted ? (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>সফল ডিপোজিট সম্পন্ন</span>
                              </span>
                              <p className="text-[10px] text-emerald-300 font-bold mt-0.5">
                                +₹{ref.bonusAmount || settings.bonusAmount} বোনাস ক্রেডিট
                              </p>
                            </div>
                          ) : (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>পেন্ডিং (ডিপোজিটের অপেক্ষায়)</span>
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                মিনিমাম ₹{ref.minDepositRequired || settings.minDepositAmount} ডিপোজিট প্রয়োজন
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RULES & RESTRICTIONS */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>রেফারেল পলিসি, নিয়মাবলী ও শর্তসমূহ</span>
                </h3>
                <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed list-disc list-inside">
                  <li>
                    <strong className="text-white">বোনাস অ্যাক্টিভেশন:</strong> আমন্ত্রিত বন্ধু রেজিস্ট্রেশন করার পর একাউন্টে ন্যূনতম <span className="text-amber-400 font-bold">₹{settings.minDepositAmount.toLocaleString('en-IN')}</span> ডিপোজিট সম্পন্ন করে অ্যাডমিন কর্তৃক অ্যাপ্রুভ হলেই আপনার ওয়ালেটে <span className="text-emerald-400 font-bold">₹{settings.bonusAmount}</span> ক্যাশ বোনাস যোগ হবে।
                  </li>
                  <li>
                    <strong className="text-white">পেন্ডিং স্ট্যাটাস:</strong> বন্ধু যতক্ষণ না ন্যূনতম ডিপোজিট সম্পন্ন করছে, ততক্ষণ তার স্ট্যাটাস 'পেন্ডিং (Pending)' হিসেবে প্রদর্শিত হবে। ডিপোজিট না করলে কোনো বোনাস প্রদান করা হবে না।
                  </li>
                  <li>
                    <strong className="text-white">স্বয়ংক্রিয় ওয়ালেট ক্রেডিট:</strong> অ্যাডমিন প্যানেল থেকে ডিপোজিট অনুমোদনের সাথে সাথে স্বয়ংক্রিয়ভাবে আপনার ওয়ালেটে বোনাস যোগ হয়ে যাবে এবং ট্রানজেকশন হিস্ট্রিতে 'Referral Bonus' হিসেবে এন্ট্রি হবে।
                  </li>
                  <li>
                    <strong className="text-white">আনলিমিটেড রেফারেল:</strong> আপনি যত খুশি বন্ধুকে ইনভাইট করতে পারেন। কোনো রেফারেল লিমিট নেই!
                  </li>
                  <li>
                    <strong className="text-rose-400">নিরাপত্তা ও রেস্ট্রিকশন:</strong> একই ডিভাইস, একই আইপি বা ভিপিএন ব্যবহার করে সেলফ-রেফারেল বা কোনো ধরনের জালিয়াতি সনাক্ত হলে স্বয়ংক্রিয়ভাবে অ্যাকাউন্ট সাসপেন্ড করা হবে।
                  </li>
                </ul>
              </div>

              {onOpenDeposit && (
                <div className="p-4 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-white">নিজেও ডিপোজিট করতে চান?</h4>
                    <p className="text-[11px] text-slate-400">গেমিং ও লটারিতে অংশগ্রহণ করতে এখনই ওয়ালেটে টাকা যোগ করুন</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDeposit();
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
                  >
                    ডিপোজিট করুন
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>স্বয়ংক্রিয় ভেরিফাইড রেফারেল ইঞ্জিন</span>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
