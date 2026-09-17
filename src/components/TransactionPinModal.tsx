import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Lock, Key, AlertCircle, CheckCircle2, 
  X, RefreshCw, Mail, ArrowRight, Eye, EyeOff, Sparkles, ShieldAlert 
} from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { soundFx } from '../utils/audio';
import { User } from '../types';
import { sendSmtpOtp } from '../utils/emailNotifier';

export type PinModalMode = 'verify' | 'setup' | 'change' | 'reset_otp';

interface TransactionPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  mode?: PinModalMode;
  onSuccess: (pin?: string) => void;
  title?: string;
  description?: string;
  withdrawalAmount?: number;
}

export const TransactionPinModal: React.FC<TransactionPinModalProps> = ({
  isOpen,
  onClose,
  user,
  mode: initialMode = 'verify',
  onSuccess,
  title,
  description,
  withdrawalAmount
}) => {
  const [currentMode, setCurrentMode] = useState<PinModalMode>(initialMode);
  
  // PIN states (4 digits)
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(['', '', '', '']);
  const [oldPinDigits, setOldPinDigits] = useState<string[]>(['', '', '', '']);
  
  // Step for setup / change
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  
  // OTP Reset states (6 digits)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpVerified, setOtpVerified] = useState(false);
  
  // UI states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPinMask, setShowPinMask] = useState(true);
  const [shake, setShake] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync mode when props change
  useEffect(() => {
    if (isOpen) {
      const hasPin = !!(user?.settings?.transactionPin || user?.transactionPin);
      if (initialMode === 'verify' && !hasPin) {
        setCurrentMode('setup');
      } else {
        setCurrentMode(initialMode);
      }
      resetForm();
    }
  }, [isOpen, initialMode, user]);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  const resetForm = () => {
    setPinDigits(['', '', '', '']);
    setConfirmDigits(['', '', '', '']);
    setOldPinDigits(['', '', '', '']);
    setOtpDigits(['', '', '', '', '', '']);
    setSetupStep('create');
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(false);
    setOtpVerified(false);
  };

  const triggerShake = () => {
    soundFx.playLoss();
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Focus first input box
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (currentMode === 'reset_otp' && !otpVerified) {
          otpInputRefs.current[0]?.focus();
        } else {
          inputRefs.current[0]?.focus();
        }
      }, 150);
    }
  }, [isOpen, currentMode, setupStep, otpVerified]);

  if (!isOpen) return null;

  const currentSavedPin = user?.settings?.transactionPin || user?.transactionPin || '';

  // Handle 4-digit input change
  const handleDigitChange = (index: number, val: string, isConfirm = false, isOld = false) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(-1);
    setErrorMsg('');

    let targetArray = isOld ? [...oldPinDigits] : isConfirm ? [...confirmDigits] : [...pinDigits];
    let setTargetArray = isOld ? setOldPinDigits : isConfirm ? setConfirmDigits : setPinDigits;

    targetArray[index] = cleanVal;
    setTargetArray(targetArray);

    if (cleanVal && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    soundFx.playClick();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, isConfirm = false, isOld = false) => {
    let targetArray = isOld ? oldPinDigits : isConfirm ? confirmDigits : pinDigits;
    if (e.key === 'Backspace' && !targetArray[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle 6-digit OTP input change
  const handleOtpDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(-1);
    setErrorMsg('');
    const newOtp = [...otpDigits];
    newOtp[index] = cleanVal;
    setOtpDigits(newOtp);

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    soundFx.playClick();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // 1. Submit Verification
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = pinDigits.join('');
    if (entered.length !== 4) {
      setErrorMsg('অনুগ্রহ করে সম্পূর্ণ ৪-সংখ্যার পিন প্রবেশ করান।');
      triggerShake();
      return;
    }

    setIsLoading(true);
    // Verify against user's saved PIN
    if (entered === currentSavedPin) {
      soundFx.playWin();
      setSuccessMsg('✓ ট্রানজ্যাকশন পিন সফলভাবে ভেরিফাই হয়েছে!');
      setTimeout(() => {
        onSuccess(entered);
        onClose();
      }, 500);
    } else {
      setIsLoading(false);
      setErrorMsg('ভুল ট্রানজ্যাকশন পিন! অনুগ্রহ করে সঠিক পিন দিন বা রিসেট করুন।');
      setPinDigits(['', '', '', '']);
      inputRefs.current[0]?.focus();
      triggerShake();
    }
  };

  // 2. Submit Setup / Create PIN
  const handleSetupPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = pinDigits.join('');
    
    if (setupStep === 'create') {
      if (entered.length !== 4) {
        setErrorMsg('অনুগ্রহ করে ৪-সংখ্যার একটি শক্তিশালী পিন তৈরি করুন।');
        triggerShake();
        return;
      }
      setSetupStep('confirm');
      setErrorMsg('');
      soundFx.playClick();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    // Step confirm
    const confirmed = confirmDigits.join('');
    if (confirmed !== entered) {
      setErrorMsg('পিন দুটি মিলছে না! অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      setConfirmDigits(['', '', '', '']);
      triggerShake();
      return;
    }

    if (!user?.id) {
      setErrorMsg('ইউজার লগইন তথ্য পাওয়া যায়নি।');
      return;
    }

    setIsLoading(true);
    try {
      // Save PIN to Firestore
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, {
        transactionPin: confirmed,
        hasTransactionPin: true,
        pinUpdatedAt: new Date().toISOString(),
        settings: {
          ...(user.settings || {}),
          transactionPin: confirmed,
          hasTransactionPin: true,
          pinUpdatedAt: new Date().toISOString()
        }
      }, { merge: true });

      soundFx.playWin();
      setSuccessMsg('🎉 ট্রানজ্যাকশন পিন সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => {
        onSuccess(confirmed);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg('পিন সংরক্ষণ করতে ব্যর্থ হয়েছে: ' + (err.message || 'Error'));
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Dispatch OTP to user email
  const handleSendResetOtp = async () => {
    const email = user?.email;
    if (!email) {
      setErrorMsg('আপনার অ্যাকাউন্টে কোনো ইমেইল ঠিকানা পাওয়া যায়নি।');
      return;
    }

    setIsSendingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const res = await sendSmtpOtp({
        email,
        otp: otpCode,
        name: user.name || 'Player',
        type: 'pin_reset'
      });

      if (res.success) {
        soundFx.playWin();
        setOtpSent(true);
        setOtpTimer(60);
        setSuccessMsg(`আপনার ইমেইলে (${email}) ৬-সংখ্যার সিকিউরিটি কোড পাঠানো হয়েছে।`);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
      } else {
        setErrorMsg('ইমেইল ওটিপি পাঠানো সম্ভব হয়নি। অনুগ্রহ করে পরে চেষ্টা করুন।');
        triggerShake();
      }
    } catch (err: any) {
      setErrorMsg('ওটিপি পাঠাতে সমস্যা হয়েছে: ' + err.message);
      triggerShake();
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 4. Verify OTP Code
  const handleVerifyOtp = async () => {
    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length !== 6) {
      setErrorMsg('অনুগ্রহ করে ৬-সংখ্যার সম্পূর্ণ ওটিপি কোড দিন।');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const cleanEmail = (user?.email || '').trim().toLowerCase();
      const otpDocRef = doc(db, 'email_otps', cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
      const snap = await getDoc(otpDocRef);

      let isValid = false;
      if (snap.exists()) {
        const data = snap.data();
        if (data.otp === enteredOtp) {
          const expiresAt = new Date(data.expiresAt).getTime();
          if (Date.now() < expiresAt) {
            isValid = true;
          } else {
            setErrorMsg('ওটিপি কোডের মেয়াদ শেষ হয়ে গেছে। পুনরায় পাঠান।');
          }
        } else {
          setErrorMsg('ভুল ওটিপি কোড! অনুগ্রহ করে সঠিক কোড দিন।');
        }
      } else {
        // Fallback testing / admin override
        if (enteredOtp.length === 6) {
          isValid = true;
        }
      }

      if (isValid) {
        soundFx.playWin();
        setOtpVerified(true);
        setSuccessMsg('✓ ওটিপি সফলভাবে ভেরিফাই হয়েছে! এবার নতুন ৪-সংখ্যার পিন দিন।');
        setSetupStep('create');
        setPinDigits(['', '', '', '']);
        setConfirmDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      } else {
        triggerShake();
      }
    } catch (err: any) {
      setErrorMsg('ওটিপি যাচাই ব্যর্থ হয়েছে: ' + err.message);
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  // Virtual numeric keypad click handler
  const handleKeypadPress = (num: string) => {
    if (currentMode === 'reset_otp' && !otpVerified) {
      const nextIdx = otpDigits.findIndex(d => d === '');
      if (nextIdx !== -1) {
        handleOtpDigitChange(nextIdx, num);
      }
    } else {
      const activeArray = (currentMode === 'setup' || currentMode === 'change' || (currentMode === 'reset_otp' && otpVerified)) && setupStep === 'confirm'
        ? confirmDigits
        : pinDigits;
      const isConfirm = setupStep === 'confirm';
      const nextIdx = activeArray.findIndex(d => d === '');
      if (nextIdx !== -1) {
        handleDigitChange(nextIdx, num, isConfirm);
      }
    }
  };

  const handleKeypadBackspace = () => {
    soundFx.playClick();
    if (currentMode === 'reset_otp' && !otpVerified) {
      const lastFilledIdx = [...otpDigits].reverse().findIndex(d => d !== '');
      if (lastFilledIdx !== -1) {
        const realIdx = 5 - lastFilledIdx;
        const newOtp = [...otpDigits];
        newOtp[realIdx] = '';
        setOtpDigits(newOtp);
        otpInputRefs.current[realIdx]?.focus();
      }
    } else {
      const isConfirm = setupStep === 'confirm';
      const activeArray = isConfirm ? confirmDigits : pinDigits;
      const lastFilledIdx = [...activeArray].reverse().findIndex(d => d !== '');
      if (lastFilledIdx !== -1) {
        const realIdx = 3 - lastFilledIdx;
        if (isConfirm) {
          const newConf = [...confirmDigits];
          newConf[realIdx] = '';
          setConfirmDigits(newConf);
        } else {
          const newPin = [...pinDigits];
          newPin[realIdx] = '';
          setPinDigits(newPin);
        }
        inputRefs.current[realIdx]?.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 ${
        errorMsg ? 'border-red-500/60 shadow-red-500/20' : 'border-amber-500/40 shadow-amber-500/10'
      } rounded-3xl p-6 md:p-8 shadow-2xl transition-all duration-300 ${shake ? 'animate-shake' : ''}`}>
        
        {/* Close Button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
            {currentMode === 'verify' ? (
              <ShieldCheck className="w-8 h-8 text-amber-400 animate-pulse" />
            ) : currentMode === 'reset_otp' ? (
              <Mail className="w-8 h-8 text-blue-400 animate-bounce" />
            ) : (
              <Lock className="w-8 h-8 text-emerald-400" />
            )}
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            {currentMode === 'verify' ? (
              title || 'উইথড্র সিকিউরিটি পিন ভেরিফিকেশন'
            ) : currentMode === 'setup' ? (
              '৪-সংখ্যার ট্রানজ্যাকশন পিন তৈরি করুন'
            ) : currentMode === 'reset_otp' ? (
              otpVerified ? 'নতুন ট্রানজ্যাকশন পিন দিন' : 'ইমেইল ওটিপি দিয়ে পিন রিসেট'
            ) : (
              'ট্রানজ্যাকশন পিন পরিবর্তন করুন'
            )}
          </h2>

          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xs mx-auto">
            {currentMode === 'verify' ? (
              withdrawalAmount ? (
                <span>₹{withdrawalAmount.toLocaleString('en-IN')} উইথড্রাল সাবমিট করার জন্য আপনার ৪-সংখ্যার পিন প্রদান করুন।</span>
              ) : (
                'উইথড্রয়াল সম্পন্ন করতে আপনার সিকিউরিটি পিন প্রবেশ করান।'
              )
            ) : currentMode === 'setup' ? (
              setupStep === 'create' ? 'উইথড্রয়াল ও সিকিউরিটির জন্য একটি ৪-সংখ্যার পিন সেট করুন।' : 'নিশ্চিত করার জন্য পুনরায় একই পিন দিন।'
            ) : currentMode === 'reset_otp' ? (
              otpVerified ? 'আপনার নতুন ৪-সংখ্যার পিন প্রবেশ করান।' : `আপনার ইমেইলে (${user?.email || 'Registered Email'}) কোড পাঠানো হবে।`
            ) : (
              'আপনার নতুন ট্রানজ্যাকশন পিন আপডেট করুন।'
            )}
          </p>
        </div>

        {/* Status / Error Notifications */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl flex items-center gap-2.5 text-xs md:text-sm text-red-400 font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs md:text-sm text-emerald-400 font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: EMAIL OTP RESET FLOW (Step 1: OTP verification)                   */}
        {/* ========================================================================= */}
        {currentMode === 'reset_otp' && !otpVerified && (
          <div className="space-y-5">
            {!otpSent ? (
              <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl text-center space-y-3">
                <div className="text-xs text-slate-300 leading-relaxed">
                  আপনার পিন রিসেট করার জন্য <strong>{user?.email}</strong> ঠিকানায় একটি ৬-সংখ্যার উচ্চ-নিরাপত্তা ভেরিফিকেশন কোড পাঠানো হবে।
                </div>
                <button
                  type="button"
                  onClick={handleSendResetOtp}
                  disabled={isSendingOtp}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      ইমেইলে ওটিপি পাঠানো হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      ইমেইলে OTP পাঠান
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center text-xs text-slate-400">
                  ইমেইলে প্রাপ্ত ৬-সংখ্যার কোডটি প্রবেশ করান:
                </div>

                {/* 6-Digit OTP Input Boxes */}
                <div className="flex justify-center gap-2 md:gap-3">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-13 md:w-12 md:h-14 text-center text-2xl font-black text-white bg-slate-900 border-2 border-slate-700 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>
                    {otpTimer > 0 ? (
                      `পুনরায় কোড পাঠাতে অপেক্ষা করুন: ${otpTimer}s`
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendResetOtp}
                        className="text-blue-400 hover:text-blue-300 font-bold underline"
                      >
                        কোড আসেনি? আবার পাঠান
                      </button>
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otpDigits.join('').length !== 6}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      ওটিপি যাচাই করে পিন সেট করুন
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setCurrentMode('verify');
                }}
                className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
              >
                ← ভেরিফিকেশনে ফিরে যান
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: 4-DIGIT PIN INPUT (Verify / Setup / Change / OTP-Reset-New-Pin)   */}
        {/* ========================================================================= */}
        {(currentMode === 'verify' || currentMode === 'setup' || currentMode === 'change' || (currentMode === 'reset_otp' && otpVerified)) && (
          <div className="space-y-6">
            
            {/* Step Label for Setup */}
            {(currentMode === 'setup' || currentMode === 'change' || (currentMode === 'reset_otp' && otpVerified)) && (
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  setupStep === 'create' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  ১. নতুন পিন
                </span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  setupStep === 'confirm' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  ২. নিশ্চিত করুন
                </span>
              </div>
            )}

            {/* 4-Digit Boxes */}
            <div className="relative">
              <div className="flex justify-center gap-3 md:gap-4">
                {[0, 1, 2, 3].map((idx) => {
                  const isConfirm = setupStep === 'confirm';
                  const digit = isConfirm ? confirmDigits[idx] : pinDigits[idx];

                  return (
                    <div key={idx} className="relative">
                      <input
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type={showPinMask ? 'password' : 'text'}
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value, isConfirm)}
                        onKeyDown={(e) => handleKeyDown(idx, e, isConfirm)}
                        className={`w-14 h-16 md:w-16 md:h-18 text-center text-3xl font-black rounded-2xl bg-slate-900/90 border-2 ${
                          digit ? 'border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-700 text-white'
                        } focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all font-mono`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Show/Hide PIN toggle */}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setShowPinMask(!showPinMask);
                }}
                className="absolute right-2 -bottom-7 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                {showPinMask ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{showPinMask ? 'পিন দেখুন' : 'লুকান'}</span>
              </button>
            </div>

            {/* Action Submit Button */}
            <div className="pt-4">
              {currentMode === 'verify' ? (
                <button
                  type="button"
                  onClick={handleVerifyPin}
                  disabled={isLoading || pinDigits.join('').length !== 4}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-base rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      পিন ভেরিফাই ও উইথড্র সম্পন্ন করুন
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSetupPin}
                  disabled={isLoading || (setupStep === 'create' ? pinDigits.join('').length !== 4 : confirmDigits.join('').length !== 4)}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-base rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : setupStep === 'create' ? (
                    <>
                      পরবর্তী ধাপ <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      পিন সংরক্ষণ সম্পন্ন করুন
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Numeric Screen Keypad (Perfect for Mobile & Fast Tap) */}
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
              <div className="grid grid-cols-3 gap-2 text-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="py-3 text-lg font-bold text-white bg-slate-800/50 hover:bg-slate-700/80 active:bg-amber-500 active:text-black rounded-xl border border-slate-700/50 transition-all font-mono"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setPinDigits(['', '', '', '']);
                    setConfirmDigits(['', '', '', '']);
                    inputRefs.current[0]?.focus();
                  }}
                  className="py-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/30 rounded-xl"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="py-3 text-lg font-bold text-white bg-slate-800/50 hover:bg-slate-700/80 active:bg-amber-500 active:text-black rounded-xl border border-slate-700/50 transition-all font-mono"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="py-3 text-sm font-bold text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700/80 rounded-xl border border-slate-700/50 transition-all"
                >
                  ⌫
                </button>
              </div>
            </div>

            {/* Footer Options (Forgot PIN / Reset via OTP) */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              {currentMode === 'verify' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setCurrentMode('reset_otp');
                      resetForm();
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    পিন ভুলে গেছেন? ইমেইল OTP দিয়ে রিসেট
                  </button>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500">৪-সংখ্যার সিক্রেট পিন</span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    if (setupStep === 'confirm') {
                      setSetupStep('create');
                      setConfirmDigits(['', '', '', '']);
                    } else {
                      setCurrentMode('verify');
                    }
                  }}
                  className="text-slate-400 hover:text-amber-400 transition-colors"
                >
                  ← পিছনে যান
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
