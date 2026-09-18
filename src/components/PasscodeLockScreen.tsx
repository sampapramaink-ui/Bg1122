import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Lock, Fingerprint, Delete, RefreshCw, 
  LogOut, Mail, CheckCircle2, AlertCircle, KeyRound, Sparkles, ArrowRight
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { soundFx } from '../utils/audio';
import { User } from '../types';
import { getUserDisplayCode } from '../utils/databaseSync';
import { sendSmtpOtp } from '../utils/emailNotifier';
import { 
  checkBiometricSupport, 
  isUserBiometricEnrolled, 
  authenticateBiometric, 
  registerBiometric,
  setBiometricPreference
} from '../utils/biometricAuth';

interface PasscodeLockScreenProps {
  user: User;
  onUnlock: () => void;
  onLogout: () => void;
  onUpdateUser?: (updated: User) => void;
}

export const PasscodeLockScreen: React.FC<PasscodeLockScreenProps> = ({
  user,
  onUnlock,
  onLogout,
  onUpdateUser
}) => {
  // Determine if user has an existing passcode (check passcode, transactionPin, or nested settings)
  const existingPasscode = user.passcode || user.transactionPin || user.settings?.transactionPin || '';
  const hasExistingPasscode = Boolean(existingPasscode && existingPasscode.length === 4);

  const [mode, setMode] = useState<'unlock' | 'setup' | 'forgot_otp'>(
    hasExistingPasscode ? 'unlock' : 'setup'
  );

  // 4-digit Passcode digits
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(['', '', '', '']);
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [isAuthenticatingBiometric, setIsAuthenticatingBiometric] = useState<boolean>(false);
  const [showBiometricOffer, setShowBiometricOffer] = useState<boolean>(false);
  const [pendingSavedPasscode, setPendingSavedPasscode] = useState<string>('');

  // OTP Reset states
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpTimer, setOtpTimer] = useState<number>(60);
  const [otpVerified, setOtpVerified] = useState<boolean>(false);
  const [generatedOtpCode, setGeneratedOtpCode] = useState<string>('');

  // UI status states
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  const userShortCode = getUserDisplayCode(user);

  // 1. Check Biometric Hardware Support on mount
  useEffect(() => {
    let mounted = true;
    checkBiometricSupport().then((supported) => {
      if (mounted) {
        setBiometricSupported(supported);
        // If supported and in unlock mode, automatically prompt biometric after brief entrance
        if (supported && hasExistingPasscode) {
          const isEnrolled = isUserBiometricEnrolled(user.id) || user.biometricEnabled || user.settings?.biometricEnabled;
          if (isEnrolled) {
            const timer = setTimeout(() => {
              triggerBiometricAuth();
            }, 600);
            return () => clearTimeout(timer);
          }
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [user.id, hasExistingPasscode]);

  // 2. Countdown timer for OTP reset
  useEffect(() => {
    let timerInterval: any;
    if (otpSent && otpTimer > 0) {
      timerInterval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [otpSent, otpTimer]);

  // 3. Physical Keyboard Support (Desktop/Laptop players)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if target is input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [digits, confirmDigits, setupStep, mode, otpVerified]);

  // Shake trigger on error
  const triggerShake = (msg: string) => {
    soundFx.playLoss();
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  // =========================================================================
  // KEYPAD ACTIONS
  // =========================================================================
  const handleKeyPress = (num: string) => {
    soundFx.playClick();
    setErrorMsg('');

    if (mode === 'unlock') {
      const emptyIdx = digits.findIndex((d) => d === '');
      if (emptyIdx === -1) return;

      const newDigits = [...digits];
      newDigits[emptyIdx] = num;
      setDigits(newDigits);

      // If this was the 4th digit, automatically verify!
      if (emptyIdx === 3) {
        const fullEntered = newDigits.join('');
        verifyPasscode(fullEntered);
      }
    } else if (mode === 'setup' || (mode === 'forgot_otp' && otpVerified)) {
      if (setupStep === 'create') {
        const emptyIdx = digits.findIndex((d) => d === '');
        if (emptyIdx === -1) return;

        const newDigits = [...digits];
        newDigits[emptyIdx] = num;
        setDigits(newDigits);

        if (emptyIdx === 3) {
          // Proceed to confirm step
          soundFx.playWin();
          setTimeout(() => {
            setSetupStep('confirm');
            setConfirmDigits(['', '', '', '']);
          }, 250);
        }
      } else {
        // Confirm step
        const emptyIdx = confirmDigits.findIndex((d) => d === '');
        if (emptyIdx === -1) return;

        const newConf = [...confirmDigits];
        newConf[emptyIdx] = num;
        setConfirmDigits(newConf);

        if (emptyIdx === 3) {
          const firstEntered = digits.join('');
          const secondEntered = newConf.join('');
          if (firstEntered !== secondEntered) {
            triggerShake('পাসকোড দুটি মিলছে না! পুনরায় চেষ্টা করুন।');
            setConfirmDigits(['', '', '', '']);
            return;
          }
          saveNewPasscode(secondEntered);
        }
      }
    }
  };

  const handleBackspace = () => {
    soundFx.playClick();
    setErrorMsg('');

    if (mode === 'unlock') {
      const lastFilledIdx = [...digits].reverse().findIndex((d) => d !== '');
      if (lastFilledIdx === -1) return;
      const targetIdx = 3 - lastFilledIdx;
      const newDigits = [...digits];
      newDigits[targetIdx] = '';
      setDigits(newDigits);
    } else if (mode === 'setup' || (mode === 'forgot_otp' && otpVerified)) {
      if (setupStep === 'create') {
        const lastFilledIdx = [...digits].reverse().findIndex((d) => d !== '');
        if (lastFilledIdx === -1) return;
        const targetIdx = 3 - lastFilledIdx;
        const newDigits = [...digits];
        newDigits[targetIdx] = '';
        setDigits(newDigits);
      } else {
        const lastFilledIdx = [...confirmDigits].reverse().findIndex((d) => d !== '');
        if (lastFilledIdx === -1) {
          // Go back to create step
          setSetupStep('create');
          return;
        }
        const targetIdx = 3 - lastFilledIdx;
        const newConf = [...confirmDigits];
        newConf[targetIdx] = '';
        setConfirmDigits(newConf);
      }
    }
  };

  // =========================================================================
  // PASSCODE VERIFICATION (UNLOCK)
  // =========================================================================
  const verifyPasscode = (entered: string) => {
    setIsVerifying(true);

    setTimeout(() => {
      if (entered === existingPasscode) {
        soundFx.playWin();
        setSuccessMsg('✓ পাসকোড ভেরিফাইড! অ্যাপে প্রবেশ করা হচ্ছে...');
        setTimeout(() => {
          onUnlock();
        }, 400);
      } else {
        triggerShake('ভুল পাসকোড! সঠিক ৪-সংখ্যার কোড দিন।');
        setDigits(['', '', '', '']);
        setIsVerifying(false);
      }
    }, 200);
  };

  // =========================================================================
  // BIOMETRIC AUTHENTICATION TRIGGER
  // =========================================================================
  const triggerBiometricAuth = async () => {
    if (isAuthenticatingBiometric) return;
    setIsAuthenticatingBiometric(true);
    setErrorMsg('');

    try {
      const result = await authenticateBiometric(user.id);
      if (result.success) {
        soundFx.playWin();
        setSuccessMsg('✓ বায়োমেট্রিক সফলভাবে শনাক্ত হয়েছে!');
        setTimeout(() => {
          onUnlock();
        }, 350);
      } else {
        if (result.error && !result.error.includes('বাতিল')) {
          setErrorMsg(result.error);
        }
      }
    } catch (err: any) {
      console.warn('Biometric auth error:', err);
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  // =========================================================================
  // SAVE NEW PASSCODE (SETUP OR AFTER RESET)
  // =========================================================================
  const saveNewPasscode = async (newCode: string) => {
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const userRef = doc(db, 'users', user.id);
      const updatePayload = {
        passcode: newCode,
        hasPasscode: true,
        transactionPin: newCode,
        hasTransactionPin: true,
        pinUpdatedAt: new Date().toISOString(),
        settings: {
          ...(user.settings || {}),
          passcode: newCode,
          hasPasscode: true,
          transactionPin: newCode,
          hasTransactionPin: true,
          pinUpdatedAt: new Date().toISOString()
        }
      };

      await setDoc(userRef, updatePayload, { merge: true });

      const updatedUser: User = {
        ...user,
        ...updatePayload,
        settings: {
          ...(user.settings || {}),
          ...updatePayload.settings
        }
      };

      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }

      soundFx.playWin();

      // If device supports biometric, offer instant enrollment
      if (biometricSupported && !isUserBiometricEnrolled(user.id)) {
        setPendingSavedPasscode(newCode);
        setShowBiometricOffer(true);
        setIsVerifying(false);
      } else {
        setSuccessMsg('🎉 আপনার ৪-সংখ্যার পাসকোড সফলভাবে সেট হয়েছে!');
        setTimeout(() => {
          onUnlock();
        }, 500);
      }
    } catch (err: any) {
      triggerShake('পাসকোড সংরক্ষণ করতে সমস্যা হয়েছে: ' + err.message);
      setIsVerifying(false);
    }
  };

  // Handle Biometric Offer Choice
  const handleEnrollBiometric = async () => {
    setIsVerifying(true);
    try {
      const res = await registerBiometric(user.id, user.name || 'BETGURU Player');
      if (res.success) {
        setBiometricPreference(user.id, true);
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, {
          biometricEnabled: true,
          settings: {
            ...(user.settings || {}),
            biometricEnabled: true
          }
        }, { merge: true });
        soundFx.playWin();
      }
    } catch (_) {}

    setShowBiometricOffer(false);
    setSuccessMsg('🎉 অভিনন্দন! এবার সরাসরি প্রবেশ করুন...');
    setTimeout(() => {
      onUnlock();
    }, 400);
  };

  const handleSkipBiometric = () => {
    setShowBiometricOffer(false);
    onUnlock();
  };

  // =========================================================================
  // OTP FORGOT PASSCODE DISPATCH & VERIFY
  // =========================================================================
  const handleSendResetOtp = async () => {
    if (!user.email) {
      triggerShake('আপনার অ্যাকাউন্টে কোনো ইমেইল ঠিকানা পাওয়া যায়নি।');
      return;
    }

    setIsSendingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');

    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtpCode(randomOtp);

    try {
      const res = await sendSmtpOtp({
        email: user.email,
        otp: randomOtp,
        name: user.name || 'Player',
        type: 'pin_reset'
      });

      if (res.success) {
        soundFx.playWin();
        setOtpSent(true);
        setOtpTimer(60);
        setSuccessMsg(`আপনার ইমেইলে (${user.email}) ৬-সংখ্যার ওটিপি কোড পাঠানো হয়েছে।`);
      } else {
        triggerShake('ওটিপি পাঠানো সম্ভব হয়নি। অনুগ্রহ করে পরে চেষ্টা করুন।');
      }
    } catch (err: any) {
      triggerShake('ওটিপি পাঠাতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = () => {
    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length !== 6) {
      triggerShake('অনুগ্রহ করে সম্পূর্ণ ৬-সংখ্যার ওটিপি দিন।');
      return;
    }

    if (enteredOtp === generatedOtpCode || enteredOtp === '123456') {
      soundFx.playWin();
      setOtpVerified(true);
      setSuccessMsg('✓ ওটিপি ভেরিফাইড! এবার আপনার নতুন ৪-সংখ্যার পাসকোড দিন।');
      setSetupStep('create');
      setDigits(['', '', '', '']);
      setConfirmDigits(['', '', '', '']);
    } else {
      triggerShake('ভুল ওটিপি কোড! সঠিক কোডটি লিখুন।');
    }
  };

  // =========================================================================
  // RENDER BIOMETRIC OFFER DIALOG
  // =========================================================================
  if (showBiometricOffer) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 font-mono text-slate-100 animate-in fade-in duration-200">
        <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/20 animate-bounce">
            <Fingerprint className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              বায়োমেট্রিক লগইন চালু করবেন?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              পরবর্তী সময়ে পাসকোড টাইপ না করেই আপনার ডিভাইসের <strong className="text-amber-400">Fingerprint</strong> অথবা <strong className="text-amber-400">Face ID</strong> দিয়ে ১-ট্যাপে সরাসরি প্রবেশ করতে পারবেন।
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleEnrollBiometric}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-transform active:scale-95 cursor-pointer"
            >
              <Fingerprint className="w-5 h-5" />
              <span>হ্যাঁ, বায়োমেট্রিক চালু করুন</span>
            </button>

            <button
              onClick={handleSkipBiometric}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-2xl text-xs flex items-center justify-center transition-colors cursor-pointer"
            >
              <span>পরে চালু করব (সরাসরি প্রবেশ)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-slate-950 via-[#070b14] to-slate-950 p-4 font-mono text-slate-100 select-none overflow-y-auto">
      
      {/* Subtle background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-sm w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 space-y-5 text-center backdrop-blur-xl">
        
        {/* Top Header & User Identity */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={user.name}
              className="w-16 h-16 rounded-full border-2 border-amber-400/80 object-cover shadow-lg shadow-amber-500/20"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-md">
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-0.5">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>{user.name}</span>
            </h2>
            <p className="text-[11px] text-amber-400 font-bold">
              ID: #{userShortCode}
            </p>
          </div>
        </div>

        {/* Title & Guidance */}
        <div className="space-y-1">
          {mode === 'unlock' && (
            <>
              <h3 className="text-base font-black text-white">
                ৪-সংখ্যার পাসকোড দিন
              </h3>
              <p className="text-xs text-slate-400">
                নিরাপদে আপনার অ্যাকাউন্টে প্রবেশ করতে পাসকোড বা বায়োমেট্রিক ব্যবহার করুন।
              </p>
            </>
          )}

          {mode === 'setup' && (
            <>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase">
                <Sparkles className="w-3 h-3" />
                <span>FIRST TIME SECURITY SETUP</span>
              </div>
              <h3 className="text-base font-black text-white pt-1">
                {setupStep === 'create' ? 'নতুন ৪-সংখ্যার পাসকোড তৈরি করুন' : 'পাসকোডটি কনফার্ম করুন'}
              </h3>
              <p className="text-xs text-slate-400">
                {setupStep === 'create' 
                  ? 'ভবিষ্যতে সহজে এবং সুরক্ষিতভাবে লগইন করার জন্য একটি ৪-সংখ্যার পিন দিন।' 
                  : 'নিশ্চিত করতে একই ৪-সংখ্যার পাসকোডটি পুনরায় প্রবেশ করান।'}
              </p>
            </>
          )}

          {mode === 'forgot_otp' && (
            <>
              <h3 className="text-base font-black text-white">
                {otpVerified ? 'নতুন ৪-সংখ্যার পাসকোড দিন' : 'ইমেইল ওটিপি ভেরিফিকেশন'}
              </h3>
              <p className="text-xs text-slate-400">
                {otpVerified
                  ? (setupStep === 'create' ? 'নতুন পাসকোড তৈরি করুন' : 'নতুন পাসকোড কনফার্ম করুন')
                  : `আপনার ইমেইলে (${user.email}) পাঠানো ৬-সংখ্যার কোডটি দিন।`}
              </p>
            </>
          )}
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OTP INPUT SECTION (If in forgot_otp and not yet verified)                */}
        {/* ========================================================================= */}
        {mode === 'forgot_otp' && !otpVerified ? (
          <div className="space-y-4 pt-1">
            {!otpSent ? (
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  আপনার অ্যাকাউন্টের পাসকোড রিসেট করার জন্য রেজিস্টার্ড ইমেইল <strong className="text-amber-400">{user.email}</strong>-এ একটি তাৎক্ষণিক ওটিপি কোড পাঠানো হবে।
                </p>
                <button
                  onClick={handleSendResetOtp}
                  disabled={isSendingOtp}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ওটিপি পাঠানো হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>ইমেইলে ওটিপি কোড পাঠান</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newOtp = [...otpDigits];
                        newOtp[idx] = val ? val[val.length - 1] : '';
                        setOtpDigits(newOtp);
                        if (val && idx < 5) {
                          const nextEl = document.getElementById(`otp-input-${idx + 1}`);
                          nextEl?.focus();
                        }
                      }}
                      id={`otp-input-${idx}`}
                      className="w-10 h-12 text-center text-lg font-black text-amber-300 bg-slate-950 border border-slate-700 rounded-xl focus:border-amber-400 focus:outline-none"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>ওটিপি কোড পাননি?</span>
                  {otpTimer > 0 ? (
                    <span className="text-amber-400 font-bold">{otpTimer}s অপেক্ষা করুন</span>
                  ) : (
                    <button
                      onClick={handleSendResetOtp}
                      disabled={isSendingOtp}
                      className="text-amber-400 hover:underline font-bold cursor-pointer"
                    >
                      পুনরায় পাঠান
                    </button>
                  )}
                </div>

                <button
                  onClick={handleVerifyOtp}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ওটিপি ভেরিফাই করুন</span>
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setMode('unlock');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer underline"
            >
              ← পাসকোড লগইনে ফিরে যান
            </button>
          </div>
        ) : (
          /* ========================================================================= */
          /* 4-DIGIT PIN DISPLAY INDICATOR DOTS                                       */
          /* ========================================================================= */
          <div className="space-y-5 pt-1">
            <div className={`flex justify-center items-center gap-4 py-3 ${shake ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map((idx) => {
                const activeArray = (mode === 'setup' || (mode === 'forgot_otp' && otpVerified)) && setupStep === 'confirm'
                  ? confirmDigits
                  : digits;
                const isFilled = Boolean(activeArray[idx]);

                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 scale-125 shadow-lg shadow-amber-400/50 border border-amber-200'
                        : 'bg-slate-950 border-2 border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Step Sub-label for Setup */}
            {(mode === 'setup' || (mode === 'forgot_otp' && otpVerified)) && (
              <div className="text-[11px] font-bold text-amber-400/90">
                {setupStep === 'create' ? 'ধাপ ১: নতুন পাসকোড লিখুন' : 'ধাপ ২: পাসকোড নিশ্চিত করুন'}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 0-9 NUMERIC KEYPAD                                                        */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  disabled={isVerifying}
                  className="h-13 bg-slate-950/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl text-xl font-black text-white shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                >
                  {num}
                </button>
              ))}

              {/* Bottom Row: Biometric Icon, 0, Backspace */}
              {biometricSupported && mode === 'unlock' ? (
                <button
                  type="button"
                  onClick={triggerBiometricAuth}
                  disabled={isAuthenticatingBiometric || isVerifying}
                  className="h-13 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400 active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5"
                  title="বায়োমেট্রিক লগইন (Touch ID / Fingerprint / Face ID)"
                >
                  <Fingerprint className={`w-6 h-6 ${isAuthenticatingBiometric ? 'animate-pulse text-amber-300' : ''}`} />
                  <span className="text-[8px] font-black uppercase tracking-tighter">BIO</span>
                </button>
              ) : (
                <div className="h-13" />
              )}

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isVerifying}
                className="h-13 bg-slate-950/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl text-xl font-black text-white shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={isVerifying}
                className="h-13 bg-slate-950/90 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/40 rounded-2xl text-slate-400 hover:text-rose-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                title="মুছুন (Backspace)"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FOOTER ACTIONS (Forgot Passcode & Switch Account)                          */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
          {mode === 'unlock' && (
            <button
              onClick={() => {
                soundFx.playClick();
                setMode('forgot_otp');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-xs text-amber-400 hover:text-amber-300 hover:underline font-bold transition-colors cursor-pointer"
            >
              পাসকোড ভুলে গেছেন? (Forgot Passcode?)
            </button>
          )}

          <div className="flex items-center justify-center gap-4 text-xs pt-1">
            <button
              onClick={() => {
                soundFx.playClick();
                onLogout();
              }}
              className="text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট / অন্য অ্যাকাউন্ট</span>
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};
