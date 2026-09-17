import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, CheckCircle2, Copy, Upload, ArrowRight, ShieldCheck, QrCode, 
  AlertCircle, Sparkles, Info, Download, Coins, ArrowUpRight, Check, RefreshCw, Clock,
  MessageSquare, HelpCircle, ShieldAlert, Tag
} from 'lucide-react';
import { PaymentMethodType, PaymentConfig, DepositCategory, DepositRequest, User, PromoCode } from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { checkDuplicateDeposit, downloadQrCode, generateImageFingerprint } from '../utils/depositSecurity';
import { sendAdminNotification } from '../utils/adminNotificationService';
import { getUserDisplayCode, checkIsAdminEmail } from '../utils/databaseSync';
import { validatePromoCode, calculateDepositPromoBonus } from '../utils/promoCodeService';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitDeposit: (
    amount: number,
    method: PaymentMethodType,
    utr: string,
    screenshotUrl: string,
    cryptoAmount?: number,
    cryptoCurrency?: string,
    category?: DepositCategory,
    promoCode?: string,
    promoBonusAmount?: number,
    promoTargetWallet?: 'main' | 'bonus',
    promoPercentage?: number
  ) => void;
  existingDeposits?: DepositRequest[];
  user?: User | null;
  onOpenSupportChat?: (initialMessage?: string) => void;
  initialPromoCode?: string;
}

const FIAT_PAYMENT_METHODS: { id: PaymentMethodType; name: string; icon: string }[] = [
  { id: 'phonepe', name: 'PhonePe', icon: '📱' },
  { id: 'gpay', name: 'Google Pay', icon: '💳' },
  { id: 'paytm', name: 'Paytm UPI', icon: '🔷' },
  { id: 'upi', name: 'BHIM / Any UPI', icon: '⚡' }
];

interface CryptoOption {
  id: PaymentMethodType;
  name: string;
  symbol: string;
  network: string;
  color: string;
  tag: string;
}

const CRYPTO_OPTIONS: CryptoOption[] = [
  { id: 'usdt_trc20', name: 'USDT (TRC20)', symbol: 'USDT', network: 'Tron (TRC20) - Fast & Low Fee', color: 'text-emerald-400', tag: 'RECOMMENDED' },
  { id: 'usdt_bep20', name: 'USDT (BEP20)', symbol: 'USDT', network: 'BNB Smart Chain (BEP20)', color: 'text-yellow-400', tag: 'FAST' },
  { id: 'usdt_erc20', name: 'USDT (ERC20)', symbol: 'USDT', network: 'Ethereum (ERC20)', color: 'text-blue-400', tag: 'STANDARD' },
  { id: 'btc', name: 'Bitcoin (BTC)', symbol: 'BTC', network: 'Bitcoin Mainnet', color: 'text-amber-400', tag: 'CRYPTO' },
  { id: 'eth', name: 'Ethereum (ETH)', symbol: 'ETH', network: 'Ethereum Mainnet', color: 'text-indigo-400', tag: 'CRYPTO' }
];

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onSubmitDeposit,
  existingDeposits = [],
  user,
  onOpenSupportChat,
  initialPromoCode
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'deposit' | 'status'>('deposit');
  const [category, setCategory] = useState<DepositCategory>('fiat');
  const [fiatMethod, setFiatMethod] = useState<PaymentMethodType>('phonepe');
  const [cryptoMethod, setCryptoMethod] = useState<PaymentMethodType>('usdt_trc20');
  
  // Fiat State
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  
  // Crypto State
  const [cryptoAmount, setCryptoAmount] = useState<number>(15);
  const [customCryptoAmount, setCustomCryptoAmount] = useState<string>('15');

  // Promo Code State
  const [promoInput, setPromoInput] = useState<string>(initialPromoCode || '');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [appliedBonusAmount, setAppliedBonusAmount] = useState<number>(0);
  const [isApplyingPromo, setIsApplyingPromo] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string>('');

  const [utr, setUtr] = useState<string>('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [copiedCrypto, setCopiedCrypto] = useState<boolean>(false);
  const [copiedDepositUtr, setCopiedDepositUtr] = useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ title: string; message: string } | null>(null);

  // Strict User Isolation for Deposit Modal: Ensure users only see their own personal deposit history & alerts
  const userDeposits = useMemo(() => {
    if (!user) return [];
    const uUid = (user.canonicalUid || user.id || '').trim();
    const uEmail = (user.email || '').toLowerCase().trim();
    const uCode = getUserDisplayCode(user);

    return (existingDeposits || []).filter((dep) => {
      if (!dep) return false;
      const depUid = (dep.userId || (dep as any).uid || '').trim();
      const depEmail = (((dep as any).userEmail || (dep as any).email || '') as string).toLowerCase().trim();

      if (depUid === 'anonymous' || depUid === 'admin' || depUid === 'ALL') {
        return Boolean(uEmail && uEmail.includes('@') && depEmail && depEmail === uEmail);
      }

      const matchesUid = Boolean(
        uUid && depUid && (
          depUid === uUid ||
          (user.canonicalUid && depUid === user.canonicalUid) ||
          (Array.isArray(user.linkedDocIds) && user.linkedDocIds.includes(depUid))
        )
      );
      const matchesEmail = Boolean(uEmail && uEmail.includes('@') && depEmail && depEmail === uEmail);
      const matchesCode = Boolean(uCode && (depUid === uCode || ((dep as any).userCode && (dep as any).userCode === uCode)));

      return matchesUid || matchesEmail || matchesCode;
    });
  }, [existingDeposits, user]);

  // Telemetry: Alert Admin when user opens the deposit page (with 2 min session debounce)
  useEffect(() => {
    if (!isOpen || !user || checkIsAdminEmail(user.email)) return;

    try {
      const uUid = user.canonicalUid || user.id || 'anonymous';
      const lastAlertKey = `deposit_open_alert_${uUid}`;
      const lastAlertTime = Number(sessionStorage.getItem(lastAlertKey) || '0');
      const now = Date.now();

      // Check if user has a recent failed/rejected deposit (strictly from their own personal deposits)
      const rejectedDeps = userDeposits.filter(d => d.status === 'rejected');
      const latestRejected = rejectedDeps[0];

      if (now - lastAlertTime > 2 * 60 * 1000) {
        sessionStorage.setItem(lastAlertKey, String(now));
        const uCode = getUserDisplayCode(user);

        const alertDesc = latestRejected
          ? `⚠️ Player ${user.name || 'User'} (#${uCode}) opened deposit desk. Previous deposit of ₹${latestRejected.amount} failed/rejected (${latestRejected.rejectReason || 'verification issue'}). They may need support assistance.`
          : `💰 Player ${user.name || 'User'} (#${uCode}) entered the deposit desk at ${new Date().toLocaleTimeString('en-IN')}. If payment fails or user is stuck, click 'Chat with Player' to assist them.`;

        sendAdminNotification({
          type: 'deposit',
          title: `💰 Deposit Desk: ${user.name || 'Player'} (#${uCode})`,
          description: alertDesc,
          userName: user.name || 'Player',
          userId: uUid,
          status: 'deposit_viewing',
          metadata: {
            userCode: uCode,
            email: user.email,
            phone: user.phone,
            balance: user.balance,
            hasPreviousFailure: Boolean(latestRejected),
            openedAt: now
          }
        });
      }
    } catch (err) {
      console.warn('Deposit page admin notification error:', err);
    }
  }, [isOpen, user, userDeposits]);

  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    upiId: 'betguru.pay@ybl',
    qrCodeUrl: '',
    accountName: 'BETGURU OFFICIAL ENTERPRISES',
    minDeposit: 100,
    maxDeposit: 100000,
    instructions: '1. Scan QR code or copy UPI ID.\n2. Complete payment in PhonePe, GPay, Paytm or BHIM.\n3. Enter 12-digit UTR/Reference number.\n4. Upload payment screenshot proof and submit.',
    cryptoEnabled: true,
    minCryptoDeposit: 10,
    maxCryptoDeposit: 10000,
    usdtToInrRate: 92,
    usdtTrc20Address: 'TYDzsYUEpvnYmQk4zGbpA8Z2kQ5z3qfL2b',
    usdtBep20Address: '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
    usdtErc20Address: '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
    btcAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    ethAddress: '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
    cryptoInstructions: '1. Select desired Crypto network (e.g. USDT TRC20).\n2. Copy wallet address or scan QR code.\n3. Transfer exact amount from Binance, Bybit, TrustWallet, etc.\n4. Enter Transaction Hash (TXID) & upload proof.'
  });

  // Real-time Firestore sync of admin payment gateway settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'payment_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PaymentConfig;
        setPaymentConfig((prev) => {
          const updated = { ...prev, ...data };
          // If current amount is below newly configured minDeposit, auto-update
          if (updated.minDeposit && amount < updated.minDeposit) {
            setAmount(updated.minDeposit);
            setCustomAmount(updated.minDeposit.toString());
          }
          if (updated.minCryptoDeposit && cryptoAmount < updated.minCryptoDeposit) {
            setCryptoAmount(updated.minCryptoDeposit);
            setCustomCryptoAmount(updated.minCryptoDeposit.toString());
          }
          return updated;
        });
      }
    }, (err) => console.warn('Payment config listener notice:', err.message));

    return () => unsub();
  }, [amount, cryptoAmount]);

  const conversionRate = paymentConfig.usdtToInrRate || 92;

  // Auto-fill and validate promo code if provided via initialPromoCode
  useEffect(() => {
    if (initialPromoCode) {
      setPromoInput(initialPromoCode);
      (async () => {
        setIsApplyingPromo(true);
        const val = await validatePromoCode(initialPromoCode, { id: user?.id, email: user?.email });
        if (val.valid && val.promo) {
          const currentInr = category === 'crypto' ? Math.round(cryptoAmount * conversionRate) : amount;
          const calc = calculateDepositPromoBonus(val.promo, currentInr);
          setAppliedPromo(val.promo);
          setAppliedBonusAmount(calc.bonusAmount);
          if (!calc.eligible && calc.message) {
            setPromoError(calc.message);
          } else {
            setPromoError('');
          }
        }
        setIsApplyingPromo(false);
      })();
    }
  }, [initialPromoCode, user?.id, user?.email]);

  // Recalculate bonus dynamically when amount changes
  useEffect(() => {
    if (appliedPromo) {
      const currentInr = category === 'crypto' ? Math.round(cryptoAmount * conversionRate) : amount;
      const calc = calculateDepositPromoBonus(appliedPromo, currentInr);
      setAppliedBonusAmount(calc.bonusAmount);
      if (!calc.eligible && calc.message) {
        setPromoError(calc.message);
      } else {
        setPromoError('');
      }
    }
  }, [amount, cryptoAmount, category, appliedPromo, conversionRate]);

  const handleApplyPromo = async () => {
    const clean = promoInput.trim().toUpperCase();
    if (!clean) {
      setPromoError('অনুগ্রহ করে একটি প্রোমো কোড লিখুন');
      return;
    }
    soundFx.playClick();
    setIsApplyingPromo(true);
    setPromoError('');

    try {
      const val = await validatePromoCode(clean, { id: user?.id, email: user?.email });
      if (!val.valid || !val.promo) {
        setPromoError(val.error || '❌ অবৈধ প্রোমো কোড!');
        soundFx.playError();
        setAppliedPromo(null);
        setAppliedBonusAmount(0);
        setIsApplyingPromo(false);
        return;
      }

      const currentInr = category === 'crypto' ? Math.round(cryptoAmount * conversionRate) : amount;
      const calc = calculateDepositPromoBonus(val.promo, currentInr);

      setAppliedPromo(val.promo);
      setAppliedBonusAmount(calc.bonusAmount);

      if (!calc.eligible && calc.message) {
        setPromoError(calc.message);
      } else {
        soundFx.playWin();
      }
    } catch (err: any) {
      setPromoError(err?.message || 'প্রোমো কোড যাচাই করতে সমস্যা হয়েছে');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    soundFx.playClick();
    setAppliedPromo(null);
    setAppliedBonusAmount(0);
    setPromoInput('');
    setPromoError('');
  };

  if (!isOpen) return null;

  const currentFiatMethod = FIAT_PAYMENT_METHODS.find(m => m.id === fiatMethod) || FIAT_PAYMENT_METHODS[0];
  const currentCryptoOption = CRYPTO_OPTIONS.find(c => c.id === cryptoMethod) || CRYPTO_OPTIONS[0];
  const activeUpiId = paymentConfig.upiId || 'betguru.pay@ybl';

  // Active Crypto Address & QR Code based on chosen crypto option
  const getActiveCryptoDetails = () => {
    switch (cryptoMethod) {
      case 'usdt_trc20':
        return {
          address: paymentConfig.usdtTrc20Address || 'TYDzsYUEpvnYmQk4zGbpA8Z2kQ5z3qfL2b',
          qrUrl: paymentConfig.usdtTrc20QrUrl || ''
        };
      case 'usdt_bep20':
        return {
          address: paymentConfig.usdtBep20Address || '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
          qrUrl: paymentConfig.usdtBep20QrUrl || ''
        };
      case 'usdt_erc20':
        return {
          address: paymentConfig.usdtErc20Address || '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
          qrUrl: paymentConfig.usdtErc20QrUrl || ''
        };
      case 'btc':
        return {
          address: paymentConfig.btcAddress || '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          qrUrl: paymentConfig.btcQrUrl || ''
        };
      case 'eth':
        return {
          address: paymentConfig.ethAddress || '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
          qrUrl: paymentConfig.ethQrUrl || ''
        };
      default:
        return {
          address: paymentConfig.usdtTrc20Address || 'TYDzsYUEpvnYmQk4zGbpA8Z2kQ5z3qfL2b',
          qrUrl: paymentConfig.usdtTrc20QrUrl || ''
        };
    }
  };

  const activeCrypto = getActiveCryptoDetails();

  // Generate UPI Deep Link for Fiat
  const triggerUpiRedirect = (targetApp?: PaymentMethodType, targetAmt?: number) => {
    const amtToPay = targetAmt || amount;
    const upiId = activeUpiId;
    const payeeName = paymentConfig.accountName || 'BETGURU OFFICIAL ENTERPRISES';
    const note = 'Wallet Deposit';

    let upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amtToPay}&cu=INR&tn=${encodeURIComponent(note)}`;

    if (targetApp === 'phonepe') {
      upiUrl = `phonepe://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amtToPay}&cu=INR&tn=${encodeURIComponent(note)}`;
    } else if (targetApp === 'gpay') {
      upiUrl = `tez://upi/pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amtToPay}&cu=INR&tn=${encodeURIComponent(note)}`;
    } else if (targetApp === 'paytm') {
      upiUrl = `paytmmp://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amtToPay}&cu=INR&tn=${encodeURIComponent(note)}`;
    }

    soundFx.playClick();
    logAnalyticsEvent('deposit_attempt', {
      type: 'quick_upi_link',
      targetApp: targetApp || fiatMethod,
      amount: amtToPay,
      upiId
    });
    try {
      window.location.href = upiUrl;
    } catch (err) {
      console.warn('UPI redirection notice:', err);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(activeUpiId);
    setCopiedUpi(true);
    soundFx.playClick();
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyCryptoAddress = () => {
    navigator.clipboard.writeText(activeCrypto.address);
    setCopiedCrypto(true);
    soundFx.playClick();
    setTimeout(() => setCopiedCrypto(false), 2000);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 600;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = (e.target?.result as string) || '';
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setScreenshot(compressed);
      } catch (err) {
        console.error('Error compressing screenshot:', err);
      }
    }
  };

  // Submit Handler with Strict Duplicate Checking
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setDuplicateWarning(null);

    const isCrypto = category === 'crypto';
    const activeMethod = isCrypto ? cryptoMethod : fiatMethod;
    
    // Amount Validations
    let finalInrAmount = amount;
    if (isCrypto) {
      const minCrypto = paymentConfig.minCryptoDeposit || 10;
      if (cryptoAmount < minCrypto) {
        setErrorMsg(`Minimum crypto deposit is ${minCrypto} ${currentCryptoOption.symbol}.`);
        return;
      }
      finalInrAmount = Math.round(cryptoAmount * conversionRate);
    } else {
      const minFiat = paymentConfig.minDeposit || 100;
      if (amount < minFiat) {
        setErrorMsg(`Minimum deposit amount is ₹${minFiat.toLocaleString('en-IN')}.`);
        return;
      }
      if (paymentConfig.maxDeposit && amount > paymentConfig.maxDeposit) {
        setErrorMsg(`Maximum deposit amount is ₹${paymentConfig.maxDeposit.toLocaleString('en-IN')}.`);
        return;
      }
    }

    // UTR / Transaction Hash Validation
    const cleanUtr = utr.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setErrorMsg(isCrypto ? 'Please enter a valid Transaction Hash (TXID).' : 'Please enter a valid 12-digit UTR / Reference Number.');
      return;
    }

    const finalScreenshot = screenshot || 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80';

    // Anti-Fraud & Duplicate UTR / Screenshot Check
    const dupCheck = checkDuplicateDeposit(cleanUtr, finalScreenshot, existingDeposits);
    if (dupCheck.isDuplicate) {
      soundFx.playLoss();
      setDuplicateWarning({
        title: dupCheck.duplicateType === 'utr' ? 'DUPLICATE TRANSACTION ID' : 'DUPLICATE PAYMENT SCREENSHOT',
        message: dupCheck.message || 'This transaction or screenshot proof has already been registered on our system.'
      });
      return;
    }

    soundFx.playCoin();
    onSubmitDeposit(
      finalInrAmount,
      activeMethod,
      cleanUtr,
      finalScreenshot,
      isCrypto ? cryptoAmount : undefined,
      isCrypto ? currentCryptoOption.name : undefined,
      category,
      appliedPromo ? appliedPromo.code : undefined,
      appliedPromo && appliedBonusAmount > 0 ? appliedBonusAmount : undefined,
      appliedPromo ? appliedPromo.targetWallet : undefined,
      appliedPromo?.bonusPercentage
    );
    setShowSuccessPopup(true);
  };

  const handleFinish = () => {
    setShowSuccessPopup(false);
    onClose();
    setUtr('');
    setScreenshot('');
    setDuplicateWarning(null);
    setAppliedPromo(null);
    setAppliedBonusAmount(0);
    setPromoInput('');
    setPromoError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white font-mono">Deposit Funds</h2>
              <p className="text-[11px] text-amber-400/90 font-medium">
                {category === 'fiat' ? 'Instant Indian UPI / Bank Top-Up' : 'Crypto Currency (USDT, BTC, ETH) Deposit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Mode: Deposit Form vs Deposit Status Tracker */}
        <div className="flex border-b border-amber-500/20 bg-slate-950">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setActiveModalTab('deposit');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeModalTab === 'deposit'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>New Deposit (ডিপোজিট)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setActiveModalTab('status');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeModalTab === 'status'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Deposit Status ({userDeposits.length})</span>
            {userDeposits.some(d => d.status === 'pending') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>
        </div>

        {activeModalTab === 'status' ? (
          /* ===================== DEPOSIT STATUS TRACKER VIEW ===================== */
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>My Deposit Status (ডিপোজিট হিস্টোরি)</span>
              </h3>
              <span className="text-[11px] text-slate-400">Total: {userDeposits.length}</span>
            </div>

            {userDeposits.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-300 font-bold">এখনো কোনো ডিপোজিট করা হয়নি</p>
                <p className="text-xs text-slate-500">আপনার সমস্ত ডিপোজিটের লাইভ স্ট্যাটাস এখানে দেখতে পাবেন।</p>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setActiveModalTab('deposit');
                  }}
                  className="mt-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                >
                  এখনই ডিপোজিট করুন
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {userDeposits.map((dep) => {
                  const isPending = dep.status === 'pending';
                  const isApproved = dep.status === 'approved';
                  const isRejected = dep.status === 'rejected';

                  return (
                    <div
                      key={dep.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isApproved
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : isRejected
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                          : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-base font-black text-white font-mono flex items-center gap-1.5">
                            <span>₹{dep.amount?.toLocaleString('en-IN')}</span>
                            {dep.cryptoAmount && (
                              <span className="text-xs text-emerald-400 font-normal">
                                ({dep.cryptoAmount} {dep.cryptoCurrency || 'USDT'})
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 capitalize">
                            Method: {dep.method || 'UPI / Bank'}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isRejected
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {isRejected && <AlertCircle className="w-3 h-3 text-rose-400" />}
                            {isPending && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                            {isApproved ? 'Approved & Credited' : isRejected ? 'Rejected' : 'Pending Verification'}
                          </span>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="text-xs bg-black/40 p-2.5 rounded-xl border border-slate-800/80 space-y-1 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">UTR / Ref No:</span>
                          <span className="font-bold text-amber-400 truncate max-w-[200px]">{dep.utr || 'N/A'}</span>
                        </div>
                        {dep.date && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Date:</span>
                            <span className="text-slate-300">{dep.date}</span>
                          </div>
                        )}
                        {dep.rejectReason && (
                          <div className="flex justify-between text-rose-400">
                            <span>Admin Note:</span>
                            <span className="font-bold">{dep.rejectReason}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions row: Copy UTR and Live Support */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                        {dep.utr && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(dep.utr);
                              setCopiedDepositUtr(dep.id);
                              soundFx.playClick();
                              setTimeout(() => setCopiedDepositUtr(null), 2000);
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer active:scale-95 ${
                              copiedDepositUtr === dep.id
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                            }`}
                          >
                            {copiedDepositUtr === dep.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="font-bold">Copied UTR!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-amber-400" />
                                <span>Copy UTR: {dep.utr.length > 10 ? dep.utr.substring(0, 8) + '…' : dep.utr}</span>
                              </>
                            )}
                          </button>
                        )}

                        {onOpenSupportChat && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const supportMsg = `Hi BETGURU Support, I need assistance with my Deposit:\n• Amount: ₹${dep.amount}\n• Method: ${dep.method || 'UPI'}\n• UTR/TXID: ${dep.utr || 'N/A'}\n• Date: ${dep.date || 'Recent'}\n• Status: ${dep.status || 'Pending'}${dep.rejectReason ? `\n• Reject Reason: ${dep.rejectReason}` : ''}`;
                              navigator.clipboard.writeText(supportMsg);
                              soundFx.playClick();
                              onClose();
                              onOpenSupportChat(supportMsg);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-400 text-[10px] font-mono text-blue-300 transition-all cursor-pointer active:scale-95"
                          >
                            <MessageSquare className="w-3 h-3 text-blue-400" />
                            <span>💬 Contact Support</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
        {/* Currency Category Tabs: Fiat (INR) vs Crypto */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/90 border-b border-slate-800 gap-2">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setCategory('fiat');
              setErrorMsg('');
              setDuplicateWarning(null);
            }}
            className={`py-2.5 px-3 rounded-2xl font-mono text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              category === 'fiat'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>🇮🇳</span>
            <span>Indian UPI / INR</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 font-bold">
              Min ₹{paymentConfig.minDeposit || 100}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setCategory('crypto');
              setErrorMsg('');
              setDuplicateWarning(null);
            }}
            className={`py-2.5 px-3 rounded-2xl font-mono text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              category === 'crypto'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Crypto Currency</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 font-bold">
              USDT/BTC
            </span>
          </button>
        </div>

        {/* REAL-TIME DEPOSIT GATEWAY & LIVE ASSISTANCE STATUS BANNER */}
        {(() => {
          const rejectedDeps = userDeposits.filter(d => d.status === 'rejected');
          const pendingDeps = userDeposits.filter(d => d.status === 'pending');
          const latestRejected = rejectedDeps[0];
          const latestPending = pendingDeps[0];

          if (latestRejected) {
            return (
              <div className="p-3.5 bg-rose-950/70 border-b border-rose-500/30 text-rose-200 text-xs font-mono animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-300 flex items-center gap-1.5">
                        <span>⚠️ Previous Deposit Failed / Rejected</span>
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                          {latestRejected.date || 'Recent'}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-300/90 mt-0.5">
                        Amount: <strong className="text-white">₹{latestRejected.amount}</strong> • Reason: {latestRejected.rejectReason || 'Verification check failed / Invalid UTR'}
                      </p>
                    </div>
                  </div>

                  {onOpenSupportChat && (
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `Hi Support, my previous deposit of ₹${latestRejected.amount} on ${latestRejected.date || 'today'} failed/was rejected (Reason: ${latestRejected.rejectReason || 'Unknown'}). Please assist me.`;
                        navigator.clipboard.writeText(msg);
                        soundFx.playClick();
                        onClose();
                        onOpenSupportChat(msg);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-[11px] shrink-0 transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                      💬 Support Chat
                    </button>
                  )}
                </div>
              </div>
            );
          }

          if (latestPending) {
            return (
              <div className="p-3 bg-amber-950/70 border-b border-amber-500/30 text-amber-200 text-xs font-mono animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
                    <div>
                      <span className="font-bold text-amber-300">⏳ Verification in Progress: </span>
                      <span className="text-white font-bold">₹{latestPending.amount}</span>
                      <span className="text-[11px] text-amber-400/80 ml-1">({latestPending.date || 'Pending'})</span>
                    </div>
                  </div>

                  {onOpenSupportChat && (
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `Hi Support, I have a pending deposit of ₹${latestPending.amount} (UTR: ${latestPending.utr || 'N/A'}) submitted at ${latestPending.date || 'recently'}. Please verify and approve.`;
                        navigator.clipboard.writeText(msg);
                        soundFx.playClick();
                        onClose();
                        onOpenSupportChat(msg);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0 transition-all cursor-pointer active:scale-95"
                    >
                      💬 Fast Verify
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Gateway Active • 24/7 Fast Auto-Credit</span>
              </div>
              <span className="text-amber-400/80">
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
          );
        })()}

        {/* DUPLICATE SUBMISSION WARNING MODAL OVERLAY */}
        {duplicateWarning && (
          <div className="p-6 bg-rose-950/90 border-b border-rose-500/40 text-rose-200 animate-in slide-in-from-top duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40 shrink-0">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 space-y-1.5">
                <h4 className="text-sm font-black text-white uppercase font-mono tracking-wide">
                  {duplicateWarning.title}
                </h4>
                <p className="text-xs leading-relaxed text-rose-200 font-sans">
                  {duplicateWarning.message}
                </p>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs rounded-xl font-mono cursor-pointer"
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Popup View */}
        {showSuccessPopup ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white font-mono mb-2">Deposit Submitted!</h3>
            <p className="text-amber-300 font-medium text-sm leading-relaxed max-w-md bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 mb-6">
              "Your deposit request of <span className="font-extrabold text-white">
                {category === 'crypto' ? `${cryptoAmount} ${currentCryptoOption.symbol} (₹${(cryptoAmount * conversionRate).toLocaleString('en-IN')})` : `₹${amount.toLocaleString('en-IN')}`}
              </span> has been sent to the Admin Verification queue."
            </p>
            <div className="w-full bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-2 font-mono text-slate-300 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Category:</span>
                <span className="font-bold text-amber-400 uppercase">{category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method / Network:</span>
                <span className="font-bold text-white uppercase">{category === 'crypto' ? currentCryptoOption.name : currentFiatMethod.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID / UTR:</span>
                <span className="font-bold text-emerald-400 truncate max-w-[200px]">{utr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-amber-400 font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  Pending Admin Approval
                </span>
              </div>
            </div>
            <button
              onClick={handleFinish}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto font-mono">
            
            {/* ===================== TAB 1: FIAT (INR) DEPOSIT ===================== */}
            {category === 'fiat' && (
              <>
                {/* Step 1: Select Payment App */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-between">
                    <span>1. Select UPI App</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Auto App Redirect Enabled</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {FIAT_PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setFiatMethod(pm.id);
                          triggerUpiRedirect(pm.id, amount);
                        }}
                        className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all group cursor-pointer ${
                          fiatMethod === pm.id
                            ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-400 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{pm.icon}</span>
                          <span className="font-bold text-xs">{pm.name}</span>
                        </div>
                        <span className="text-[9px] font-mono text-amber-400 font-bold">
                          PAY
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Amount Selection */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                      2. Deposit Amount (₹)
                    </label>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      Min Deposit: ₹{paymentConfig.minDeposit || 100}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    {[
                      paymentConfig.minDeposit || 100,
                      500,
                      1000,
                      2000,
                      5000,
                      10000
                    ].filter((v, idx, arr) => arr.indexOf(v) === idx).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setAmount(amt);
                          setCustomAmount(amt.toString());
                          triggerUpiRedirect(fiatMethod, amt);
                        }}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                          amount === amt
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-slate-950/80 border-slate-800 text-amber-300 hover:border-amber-500/40'
                        }`}
                      >
                        <span>+₹{amt.toLocaleString('en-IN')}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold font-mono">₹</span>
                    <input
                      type="number"
                      min={paymentConfig.minDeposit || 100}
                      max={paymentConfig.maxDeposit || 100000}
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        const p = parseFloat(e.target.value);
                        if (!isNaN(p)) setAmount(p);
                      }}
                      placeholder={`Enter amount (Min ₹${paymentConfig.minDeposit || 100})`}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl pl-8 pr-4 py-2.5 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Instant Deep Link Pay Button */}
                <button
                  type="button"
                  onClick={() => triggerUpiRedirect(fiatMethod, amount)}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 border border-emerald-400/30 transition-all cursor-pointer font-mono"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                  <span>⚡ Open {currentFiatMethod.name} to Pay ₹{amount.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Payment Details & QR Code Scanner Box */}
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/20 flex flex-col sm:flex-row items-center gap-3.5">
                  <div className="w-28 h-28 bg-white p-1 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-lg overflow-hidden relative group">
                    {paymentConfig.qrCodeUrl ? (
                      <img src={paymentConfig.qrCodeUrl} alt="UPI Payment QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-950 p-1.5 rounded flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-4 h-4 bg-amber-400 border border-white"></div>
                          <div className="w-4 h-4 bg-amber-400 border border-white"></div>
                        </div>
                        <div className="text-[7px] font-mono font-bold text-amber-400 text-center">
                          SCAN QR
                        </div>
                        <div className="flex justify-between">
                          <div className="w-4 h-4 bg-amber-400 border border-white"></div>
                          <div className="w-2 h-2 bg-emerald-400"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-1 text-xs text-slate-300">
                      <span className="text-slate-400">Payee:</span>
                      <span className="font-bold text-amber-300 text-[11px] truncate max-w-[180px]">
                        {paymentConfig.accountName || 'BETGURU OFFICIAL'}
                      </span>
                    </div>

                    <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-white truncate">{activeUpiId}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="text-amber-400 hover:text-amber-300 p-1 font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {paymentConfig.qrCodeUrl && (
                      <button
                        type="button"
                        onClick={() => downloadQrCode(paymentConfig.qrCodeUrl, `upi-deposit-qr-₹${amount}.png`)}
                        className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-amber-400 text-[11px] font-bold rounded-lg border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download QR Code Image</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                {paymentConfig.instructions && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-200/90 font-mono space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Instructions:</span>
                    </div>
                    <div className="whitespace-pre-line leading-relaxed pl-5 text-[10px] text-slate-300">
                      {paymentConfig.instructions}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===================== TAB 2: CRYPTO DEPOSIT ===================== */}
            {category === 'crypto' && (
              <>
                {/* Step 1: Select Crypto Network */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center justify-between">
                    <span>1. Select Crypto Asset / Network</span>
                    <span className="text-[10px] text-amber-400 font-mono">1 USDT ≈ ₹{conversionRate} INR</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CRYPTO_OPTIONS.map((co) => (
                      <button
                        key={co.id}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setCryptoMethod(co.id);
                        }}
                        className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          cryptoMethod === co.id
                            ? 'bg-emerald-950/50 border-emerald-400 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-black text-xs text-white">{co.name}</div>
                          <div className="text-[9px] text-slate-400 truncate max-w-[140px]">{co.network}</div>
                        </div>
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                          {co.tag}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Crypto Amount Selection */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                      2. Deposit Amount ({currentCryptoOption.symbol})
                    </label>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      Min: {paymentConfig.minCryptoDeposit || 10} {currentCryptoOption.symbol}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-2.5">
                    {[
                      paymentConfig.minCryptoDeposit || 10,
                      25,
                      50,
                      100
                    ].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setCryptoAmount(amt);
                          setCustomCryptoAmount(amt.toString());
                        }}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                          cryptoAmount === amt
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-950/80 border-slate-800 text-emerald-300 hover:border-emerald-500/40'
                        }`}
                      >
                        <span>{amt} {currentCryptoOption.symbol}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold font-mono text-xs">
                      {currentCryptoOption.symbol}
                    </span>
                    <input
                      type="number"
                      min={paymentConfig.minCryptoDeposit || 10}
                      max={paymentConfig.maxCryptoDeposit || 10000}
                      value={customCryptoAmount}
                      onChange={(e) => {
                        setCustomCryptoAmount(e.target.value);
                        const p = parseFloat(e.target.value);
                        if (!isNaN(p)) setCryptoAmount(p);
                      }}
                      placeholder={`Enter amount in ${currentCryptoOption.symbol}`}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 text-white font-mono font-bold text-sm rounded-xl pl-16 pr-24 py-2.5 outline-none transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-xs">
                      ≈ ₹{(cryptoAmount * conversionRate).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Crypto Wallet Address & Scanner Box */}
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-emerald-500/20 flex flex-col sm:flex-row items-center gap-3.5">
                  <div className="w-28 h-28 bg-white p-1 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-lg overflow-hidden relative">
                    {activeCrypto.qrUrl ? (
                      <img src={activeCrypto.qrUrl} alt="Crypto QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-950 p-1.5 rounded flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-4 h-4 bg-emerald-400 border border-white"></div>
                          <div className="w-4 h-4 bg-emerald-400 border border-white"></div>
                        </div>
                        <div className="text-[7px] font-mono font-bold text-emerald-400 text-center">
                          SCAN CRYPTO
                        </div>
                        <div className="flex justify-between">
                          <div className="w-4 h-4 bg-emerald-400 border border-white"></div>
                          <div className="w-2 h-2 bg-yellow-400"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                    <div className="text-xs text-slate-300">
                      <span>Network: </span>
                      <strong className="text-emerald-400">{currentCryptoOption.network}</strong>
                    </div>

                    <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-white truncate max-w-[190px]">
                        {activeCrypto.address}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCryptoAddress}
                        className="text-emerald-400 hover:text-emerald-300 p-1 font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedCrypto ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCrypto ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {activeCrypto.qrUrl && (
                      <button
                        type="button"
                        onClick={() => downloadQrCode(activeCrypto.qrUrl, `crypto-qr-${cryptoMethod}.png`)}
                        className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 text-[11px] font-bold rounded-lg border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download QR Code Image</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Crypto Instructions */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] text-emerald-200/90 font-mono space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Crypto Deposit Guide:</span>
                  </div>
                  <p className="text-[10px] text-slate-300 whitespace-pre-line leading-relaxed pl-5">
                    {paymentConfig.cryptoInstructions || 'Transfer exact funds to the wallet above. Enter TXID / Hash below and attach payment proof.'}
                  </p>
                </div>
              </>
            )}

            {/* Promo Code Section */}
            <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-amber-500/25 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>প্রোমো কোড (Promo Code)</span>
                </div>
                {appliedPromo && (
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>

              {!appliedPromo ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoError('');
                      }}
                      placeholder="e.g. WELCOME100, BONUS50"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs font-black tracking-widest rounded-xl pl-3 pr-8 py-2.5 outline-none uppercase"
                    />
                    {promoInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setPromoInput('');
                          setPromoError('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={isApplyingPromo || !promoInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition active:scale-95 shrink-0"
                  >
                    {isApplyingPromo ? 'যাচাই...' : 'প্রয়োগ করুন'}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-black">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>কোড সক্রিয়: {appliedPromo.code}</span>
                    </div>
                    <span className="font-black text-white font-mono text-xs">
                      +₹{appliedBonusAmount.toLocaleString('en-IN')} Extra Bonus
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300/90">
                    ডিপোজিট অ্যাপ্রুভ হলেই অতিরিক্ত <strong className="text-white font-bold">+₹{appliedBonusAmount.toLocaleString('en-IN')}</strong> আপনার <strong className="text-amber-300">{appliedPromo.targetWallet === 'main' ? 'মেইন ওয়ালেটে' : 'বোনাস ওয়ালেটে'}</strong> সরাসরি যুক্ত হবে!
                  </p>
                </div>
              )}

              {promoError && (
                <div className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{promoError}</span>
                </div>
              )}
            </div>

            {/* Step 3: Transaction ID / UTR & Screenshot Proof (Common to both) */}
            <div className="space-y-3 pt-1 border-t border-slate-800">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center justify-between">
                  <span>
                    {category === 'crypto' ? 'Transaction Hash (TXID)' : '12-Digit UTR / Ref Number'} <span className="text-rose-400">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Strictly Unique</span>
                </label>
                <input
                  type="text"
                  required
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder={category === 'crypto' ? "e.g. 7f18b329402a9b348f..." : "e.g. 423189071234"}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 block">
                  Payment Screenshot Proof <span className="text-rose-400">*</span>
                </label>
                <div className="relative border-2 border-dashed border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 text-center bg-slate-950/60 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {screenshot ? (
                    <div className="flex items-center justify-between px-2 text-emerald-400 font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Screenshot Attached</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScreenshot('');
                        }}
                        className="text-rose-400 hover:text-rose-300 text-[10px] underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>Click to upload payment receipt screenshot</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <span>
                Submit {category === 'crypto' ? `${cryptoAmount} ${currentCryptoOption.symbol} (₹${(cryptoAmount * conversionRate).toLocaleString('en-IN')})` : `₹${amount.toLocaleString('en-IN')}`} Deposit
              </span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anti-Duplicate Protected • 256-Bit SSL Encrypted Verification</span>
            </div>

            {/* 24/7 Live Payment Support Assistance Card */}
            {onOpenSupportChat && (
              <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-[11px]">পেমেন্ট বা ডিপোজিটে সমস্যা হচ্ছে?</p>
                    <p className="text-slate-400 text-[10px]">আমাদের ২৪/৭ লাইভ কাস্টমার সাপোর্ট সর্বদা প্রস্তুত</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const helpMsg = `Hi Support, I am on the Deposit page (Attempting: ₹${amount}) and need assistance with my payment. Please guide me.`;
                    navigator.clipboard.writeText(helpMsg);
                    soundFx.playClick();
                    onClose();
                    onOpenSupportChat(helpMsg);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 hover:border-blue-400 text-blue-300 font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  💬 Live Support
                </button>
              </div>
            )}

          </form>
          )}
        </>
        )}

      </div>
    </div>
  );
};
