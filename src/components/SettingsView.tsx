import React, { useState, useEffect } from 'react';
import { 
  Volume2, VolumeX, Bell, Vibrate, Flame, Type, ShieldCheck, 
  Check, ArrowLeft, Settings as SettingsIcon, MessageSquare, Headphones, 
  Key, Lock, ShieldAlert, Mail, Sparkles, RefreshCw, User as UserIcon,
  Building2, Wallet, ArrowUpRight, Edit3, Camera, MapPin, Phone, Calendar,
  CreditCard, ChevronRight, Shield, Smartphone, Fingerprint
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserSettings } from '../types';
import { soundFx } from '../utils/audio';
import { VIP_TIERS } from '../utils/vip';
import { TransactionPinModal, PinModalMode } from './TransactionPinModal';
import { UserEditProfileModal } from './UserEditProfileModal';
import { isAndroidNativeApp, getStoredFcmToken } from '../utils/androidBridge';
import { 
  checkBiometricSupport, 
  isUserBiometricEnrolled, 
  registerBiometric, 
  setBiometricPreference 
} from '../utils/biometricAuth';

export type SettingsTab = 'all' | 'security' | 'withdrawal' | 'profile' | 'audio' | 'display';

interface SettingsViewProps {
  user: User;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onBack?: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  onOpenWithdraw?: () => void;
  onOpenSupportChat?: () => void;
  onOpenPwaNotifications?: () => void;
  onLogout?: () => void;
  onLockSession?: () => void;
  initialTab?: SettingsTab;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUpdateSettings,
  onBack,
  onUpdateUser,
  onOpenWithdraw,
  onOpenSupportChat,
  onOpenPwaNotifications,
  onLogout,
  onLockSession,
  initialTab = 'all'
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [pinModalOpen, setPinModalOpen] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<PinModalMode>('setup');
  const [editProfileModalOpen, setEditProfileModalOpen] = useState<boolean>(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [biometricActive, setBiometricActive] = useState<boolean>(() => {
    return isUserBiometricEnrolled(user.id) || Boolean(user.biometricEnabled || user.settings?.biometricEnabled);
  });
  const [isBiometricLoading, setIsBiometricLoading] = useState<boolean>(false);
  const [biometricNotice, setBiometricNotice] = useState<string>('');

  useEffect(() => {
    checkBiometricSupport().then((supp) => {
      setBiometricSupported(supp);
    });
  }, []);

  const handleToggleBiometric = async () => {
    soundFx.playClick();
    setBiometricNotice('');
    if (biometricActive) {
      setBiometricPreference(currentUser.id, false);
      setBiometricActive(false);
      try {
        const userRef = doc(db, 'users', currentUser.id);
        await setDoc(userRef, {
          biometricEnabled: false,
          settings: { ...(currentUser.settings || {}), biometricEnabled: false }
        }, { merge: true });
        const updated: User = {
          ...currentUser,
          biometricEnabled: false,
          settings: { ...(currentUser.settings || {}), biometricEnabled: false }
        };
        setCurrentUser(updated);
        onUpdateUser?.(updated);
        setBiometricNotice('বায়োমেট্রিক লগইন নিষ্ক্রিয় করা হয়েছে।');
      } catch (_) {}
    } else {
      setIsBiometricLoading(true);
      const res = await registerBiometric(currentUser.id, currentUser.name);
      setIsBiometricLoading(false);
      if (res.success) {
        soundFx.playWin();
        setBiometricPreference(currentUser.id, true);
        setBiometricActive(true);
        try {
          const userRef = doc(db, 'users', currentUser.id);
          await setDoc(userRef, {
            biometricEnabled: true,
            settings: { ...(currentUser.settings || {}), biometricEnabled: true }
          }, { merge: true });
          const updated: User = {
            ...currentUser,
            biometricEnabled: true,
            settings: { ...(currentUser.settings || {}), biometricEnabled: true }
          };
          setCurrentUser(updated);
          onUpdateUser?.(updated);
          setBiometricNotice('🎉 বায়োমেট্রিক (Fingerprint / Face ID) সক্রিয় করা হয়েছে!');
        } catch (_) {}
      } else {
        soundFx.playLoss();
        setBiometricNotice(res.error || 'বায়োমেট্রিক সংযোগ ব্যর্থ হয়েছে।');
      }
    }
  };

  React.useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const hasTransactionPin = !!(currentUser.settings?.transactionPin || currentUser.transactionPin);
  const vipTier = VIP_TIERS[currentUser.vipLevel || 'Bronze'] || VIP_TIERS['Bronze'];

  const settings: UserSettings = currentUser.settings || {
    bgMusicEnabled: true,
    soundEffectsEnabled: true,
    hapticEnabled: true,
    fireFxEnabled: true,
    fontSize: 'normal',
    chatNewMessageSound: true,
    chatAgentNotificationSound: true
  };

  const handleToggle = (key: keyof UserSettings) => {
    soundFx.playClick();
    const updated: UserSettings = {
      ...settings,
      [key]: settings[key] !== false ? false : true
    };
    if (key === 'bgMusicEnabled') soundFx.setBgMusicEnabled(updated.bgMusicEnabled ?? true);
    if (key === 'soundEffectsEnabled') soundFx.setSoundEffectsEnabled(updated.soundEffectsEnabled ?? true);
    if (key === 'hapticEnabled') soundFx.setHapticEnabled(updated.hapticEnabled ?? true);

    onUpdateSettings(updated);
  };

  const handleSetFontSize = (size: 'compact' | 'normal' | 'large') => {
    soundFx.playClick();
    const updated: UserSettings = {
      ...settings,
      fontSize: size
    };
    onUpdateSettings(updated);
  };

  const handleOpenPinModal = (mode: PinModalMode) => {
    soundFx.playClick();
    setPinModalMode(mode);
    setPinModalOpen(true);
  };

  const handleUserUpdated = (updated: User) => {
    setCurrentUser(updated);
    if (onUpdateUser) {
      onUpdateUser(updated);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'all', label: 'All Settings (সব)', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'security', label: 'Security & PIN (নিরাপত্তা)', icon: <Key className="w-4 h-4 text-amber-400" />, badge: hasTransactionPin ? 'Active' : 'Required' },
    { id: 'withdrawal', label: 'Withdrawal & Bank (উইথড্রয়াল)', icon: <Building2 className="w-4 h-4 text-emerald-400" /> },
    { id: 'profile', label: 'Personal & KYC (প্রোফাইল)', icon: <UserIcon className="w-4 h-4 text-cyan-400" /> },
    { id: 'audio', label: 'Sound & Audio (সাউন্ড)', icon: <Volume2 className="w-4 h-4 text-yellow-400" /> },
    { id: 'display', label: 'Visual & Display (ডিসপ্লে)', icon: <Flame className="w-4 h-4 text-rose-400" /> }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-28">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 p-5 sm:p-6 rounded-3xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={() => { soundFx.playClick(); onBack(); }}
              className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer hover:border-amber-500/40"
              title="Go Back to Profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <SettingsIcon className="w-6 h-6 animate-spin [animation-duration:15s]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/30 font-mono">
                ACCOUNT PREFERENCES
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-mono text-white">সেটিংস ও নিরাপত্তা কেন্দ্র</h1>
            <p className="text-xs text-slate-400 font-mono">Manage mandatory Transaction PIN, withdrawal accounts, personal profile, audio and display settings.</p>
          </div>
        </div>
      </div>

      {/* Sub-Settings Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-mono text-xs">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundFx.playClick();
                setActiveTab(tab.id);
              }}
              className={`px-3.5 py-2.5 rounded-2xl border transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20 scale-[1.02]'
                  : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 font-bold'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                  isSelected 
                    ? 'bg-slate-950 text-amber-300' 
                    : tab.badge === 'Active' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MANDATORY TRANSACTION PIN & WITHDRAWAL SECURITY CARD           */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'security') && (
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-3xl border-2 border-amber-500/40 shadow-xl shadow-amber-500/5 space-y-5 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className={`p-3 rounded-2xl border ${
                hasTransactionPin 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
              }`}>
                <Key className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">Mandatory Transaction PIN (উইথড্রয়াল পিন)</h2>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                    hasTransactionPin
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                  }`}>
                    {hasTransactionPin ? 'ACTIVE & PROTECTED' : 'REQUIRED FOR WITHDRAWALS'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  টাকা উইথড্র করার সময় ৪-সংখ্যার বাধ্যতামূলক পিন প্রয়োজন হয়। অ্যাকাউন্ট নিরাপদ রাখতে এটি সক্রিয় রাখুন।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasTransactionPin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  PIN Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold animate-pulse">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  PIN Not Set
                </span>
              )}
            </div>
          </div>

          {/* PIN Controls & OTP Reset Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {!hasTransactionPin ? (
              <button
                onClick={() => handleOpenPinModal('setup')}
                className="sm:col-span-3 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <Key className="w-4 h-4" />
                ৪-সংখ্যার ট্রানজ্যাকশন পিন তৈরি করুন (Create PIN)
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleOpenPinModal('change')}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  পিন পরিবর্তন করুন (Change PIN)
                </button>

                <button
                  onClick={() => handleOpenPinModal('verify')}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  পিন টেস্ট করুন (Test Verify)
                </button>

                <button
                  onClick={() => handleOpenPinModal('reset_otp')}
                  className="py-3 px-4 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 hover:from-blue-900 hover:to-indigo-900 border border-blue-500/40 text-blue-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-blue-400" />
                  ইমেইল OTP দিয়ে রিসেট (Reset PIN)
                </button>
              </>
            )}
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>সিকিউরিটি নোট: পিন ভুলে গেলে রেজিস্টার্ড ইমেইলে ({currentUser.email || 'আপনার ইমেইল'}) ৬-সংখ্যার ওটিপি কোড পাঠিয়ে তাৎক্ষণিক রিসেট করতে পারবেন।</span>
            </div>
          </div>

          {/* Biometric (Fingerprint / Face ID) Settings Card */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${biometricActive ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>বায়োমেট্রিক লগইন (Fingerprint / Face ID)</span>
                    {biometricActive && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black">
                        ACTIVE
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">
                    পাসকোড ছাড়াও আঙ্গুলের ছাপ বা ফেস রিকগনিশন দিয়ে সুরক্ষিত ও দ্রুত লগইন করুন।
                  </p>
                </div>
              </div>

              {biometricSupported ? (
                <button
                  onClick={handleToggleBiometric}
                  disabled={isBiometricLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                    biometricActive
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  } disabled:opacity-50`}
                >
                  {isBiometricLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>প্রসেসিং...</span>
                    </>
                  ) : biometricActive ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>সক্রিয় আছে (চালু)</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>সক্রিয় করুন</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  ডিভাইসে সেন্সর নেই
                </span>
              )}
            </div>

            {biometricNotice && (
              <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                biometricNotice.includes('ব্যর্থ') || biometricNotice.includes('ত্রুটি')
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              }`}>
                <span>{biometricNotice}</span>
              </div>
            )}

            {/* Manual App Lock Button */}
            {onLockSession && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onLockSession();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>লক স্ক্রিন পরীক্ষা করুন (Lock App Now)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: WITHDRAWAL & BANKING PREFERENCES                               */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'withdrawal') && (
        <div className="p-6 bg-slate-900/90 rounded-3xl border border-slate-800 space-y-5 font-mono shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">Withdrawal & Banking Preferences (উইথড্রয়াল তথ্য)</h3>
                <p className="text-xs text-slate-400">Manage payment channels, verified bank limits, and instant withdrawal methods.</p>
              </div>
            </div>

            {onOpenWithdraw && (
              <button
                onClick={() => { soundFx.playClick(); onOpenWithdraw(); }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>উইথড্রয়াল পেজ</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>দৈনিক উইথড্রয়াল লিমিট (Daily Limit):</span>
              </span>
              <div className="text-lg font-black text-emerald-400">
                ₹{vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')}/দিন ({currentUser.vipLevel || 'Bronze'} VIP)
              </div>
              <p className="text-[10px] text-slate-500">VIP পয়েন্ট বাড়িয়ে দৈনিক লিমিট বৃদ্ধি করতে পারবেন।</p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>সাপোর্টেড উইথড্রয়াল মেথড:</span>
              </span>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">IMPS Bank</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">UPI / QR</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">Crypto (USDT)</span>
              </div>
              <p className="text-[10px] text-slate-500">উইথড্র করার সময় অ্যাকাউন্ট নম্বর ও IFSC কোড চেক করে সাবমিট করুন।</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: PERSONAL PROFILE & KYC DETAILS                                 */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'profile') && (
        <div className="p-6 bg-slate-900/90 rounded-3xl border border-slate-800 space-y-5 font-mono shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-xl">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">Personal Profile & KYC Details (ব্যক্তিগত তথ্য ও পরিচয়পত্র)</h3>
                <p className="text-xs text-slate-400">View and edit personal details, identity verification document, and address.</p>
              </div>
            </div>

            <button
              onClick={() => { soundFx.playClick(); setEditProfileModalOpen(true); }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>✏️ Edit Profile</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Full Name:</span>
              <span className="font-bold text-white">{currentUser.name || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Email Address:</span>
              <span className="font-bold text-white truncate max-w-[180px]">{currentUser.email || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Mobile Phone:</span>
              <span className="font-bold text-white">{currentUser.phone || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Age & Gender:</span>
              <span className="font-bold text-amber-300">
                {currentUser.age ? `${currentUser.age} yrs` : '18+'} • {currentUser.gender || 'Not specified'}
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Document Type:</span>
              <span className="font-bold text-cyan-400">{currentUser.documentType || 'Aadhaar Card'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-slate-400">Document ID:</span>
              <span className="font-bold text-emerald-400">{currentUser.documentId || 'Not Set'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between sm:col-span-2">
              <span className="text-slate-400">Address & City:</span>
              <span className="font-bold text-slate-300 truncate max-w-[280px]">
                {[currentUser.address, currentUser.city, currentUser.state, currentUser.pincode].filter(Boolean).join(', ') || 'Not specified'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: PRIMARY AUDIO & LIVE SOUND SETTINGS                            */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'audio') && (
        <div className="space-y-4 font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 1. Background Music */}
            <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl border transition-colors ${
                  settings.bgMusicEnabled ?? true
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}>
                  {settings.bgMusicEnabled ?? true ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Background Music</h3>
                  <p className="text-[11px] text-slate-400">
                    {settings.bgMusicEnabled ?? true ? 'Ambient casino music ON' : 'Background audio muted'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('bgMusicEnabled')}
                className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
                  settings.bgMusicEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
              </button>
            </div>

            {/* 2. Sound FX */}
            <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl border transition-colors ${
                  settings.soundEffectsEnabled ?? true
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Game Sound Effects</h3>
                  <p className="text-[11px] text-slate-400">
                    {settings.soundEffectsEnabled ?? true ? 'Spin, win & button sounds ON' : 'All game audio muted'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('soundEffectsEnabled')}
                className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
                  settings.soundEffectsEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
              </button>
            </div>

            {/* 3. Haptic Feedback */}
            <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl border transition-colors ${
                  settings.hapticEnabled ?? true
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}>
                  <Vibrate className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Haptic Vibration</h3>
                  <p className="text-[11px] text-slate-400">
                    {settings.hapticEnabled ?? true ? 'Touch vibration feedback ON' : 'Vibration feedback disabled'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('hapticEnabled')}
                className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
                  settings.hapticEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
              </button>
            </div>

            {/* 4. Live Chat New Message Sound */}
            <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl border transition-colors ${
                  settings.chatNewMessageSound ?? true
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Live Chat Message Chime</h3>
                  <p className="text-[11px] text-slate-400">
                    {settings.chatNewMessageSound ?? true ? 'Sound alert on messages' : 'Chat messages muted'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggle('chatNewMessageSound')}
                className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
                  settings.chatNewMessageSound ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: VISUAL, DISPLAY & FONT SIZING                                  */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'display') && (
        <div className="space-y-4 font-mono">
          
          {/* Fire & Glow Particle FX */}
          <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl border transition-colors ${
                settings.fireFxEnabled ?? true
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}>
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Fire & Glow Visual Effects</h3>
                <p className="text-[11px] text-slate-400">
                  {settings.fireFxEnabled ?? true ? 'High performance fire particle glow ON' : 'Reduced animations mode'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleToggle('fireFxEnabled')}
              className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
                settings.fireFxEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
            </button>
          </div>

          {/* Font Size Selector Card */}
          <div className="p-6 bg-slate-900/90 rounded-3xl border border-slate-800 space-y-4 font-mono shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-xl">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Interface Font Size Preference</h3>
                <p className="text-xs text-slate-400">Adjust text size density across the application UI.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { id: 'compact', label: 'Compact (Small)' },
                { id: 'normal', label: 'Normal (Standard)' },
                { id: 'large', label: 'Large (Bold Display)' }
              ].map((opt) => {
                const isSel = (settings.fontSize || 'normal') === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSetFontSize(opt.id as 'compact' | 'normal' | 'large')}
                    className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      isSel
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSel && <Check className="w-4 h-4 text-slate-950" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Android Native Bridge & FCM Push Status Banner */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2.5">
          <Smartphone className={`w-4 h-4 ${isAndroidNativeApp() || currentUser.fcmToken || getStoredFcmToken() ? 'text-emerald-400' : 'text-slate-500'}`} />
          <div>
            <div className="text-slate-200 font-bold flex items-center gap-2">
              <span>Android Native App & Push Notification Bridge</span>
              {isAndroidNativeApp() || currentUser.fcmToken || getStoredFcmToken() ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/30">
                  ● Connected (FCM Active)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] border border-slate-700">
                  Web Mode
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              App Package: com.aistudio.betguru.pxvmbq {currentUser.fcmToken ? `| FCM: ${currentUser.fcmToken.slice(0, 14)}...` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* PWA Background Push Notification & Sleep Mode Settings Card */}
      {onOpenPwaNotifications && (
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Bell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">
                  PWA ব্যাকগ্রাউন্ড নোটিফিকেশন
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                  স্লিপ মোড অ্যাক্টিভ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                মোবাইল স্ক্রিন অফ বা অ্যাপ বন্ধ (Sleep Mode) থাকলেও ড্র ও জয় অ্যালার্ট পান
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onOpenPwaNotifications();
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <span>কনফিগার ও টেস্ট</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Account Sync Banner */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Preferences automatically synchronized to cloud profile ({currentUser.email || currentUser.id}).</span>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editProfileModalOpen && (
        <UserEditProfileModal
          user={currentUser}
          onClose={() => setEditProfileModalOpen(false)}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        user={currentUser}
        mode={pinModalMode}
        onSuccess={(newPin) => {
          if (newPin) {
            const updatedSettings: UserSettings = {
              ...settings,
              transactionPin: newPin,
              hasTransactionPin: true,
              pinUpdatedAt: new Date().toISOString()
            };
            onUpdateSettings(updatedSettings);
            const updatedUser: User = {
              ...currentUser,
              transactionPin: newPin,
              settings: updatedSettings
            };
            handleUserUpdated(updatedUser);
          }
        }}
      />

    </div>
  );
};

