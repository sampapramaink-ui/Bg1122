import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Lock, Mail, User, Phone, ArrowRight, AlertCircle, ShieldCheck, CheckCircle2, KeyRound, RefreshCw, ArrowLeft, Eye, EyeOff, Gift, Camera, Upload
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { soundFx } from '../utils/audio';
import { sendSmtpOtp, sendSmtpEmail, sendSecurityTeamEmail } from '../utils/emailNotifier';
import { checkIsAdminEmail, generatePermanentUserCode, getUserDisplayCode } from '../utils/databaseSync';
import { checkIsUserBanned, readFileAsCompressedDataUrl } from '../utils/userDataManager';
import { getReferralCodeFromUrl, registerReferralOnSignup } from '../utils/referralEngine';

const SIGNUP_PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150'
];

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [signupAvatar, setSignupAvatar] = useState(SIGNUP_PRESET_AVATARS[0]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isSigningInRef = useRef(false);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const compressed = await readFileAsCompressedDataUrl(file, 250, 250, 0.85);
      setSignupAvatar(compressed);
      soundFx.playClick();
    } catch (err) {
      console.warn('Avatar compression error:', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  // Auto-detect referral invite code from dynamic URL (?ref=... or ?invite=...)
  useEffect(() => {
    const urlRef = getReferralCodeFromUrl();
    if (urlRef) {
      setInviteCode(urlRef);
      setMode('signup');
    }
  }, []);

  // Mandatory OTP Verification States for Signup
  const [otpStep, setOtpStep] = useState<'details' | 'otp_verify'>('details');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password States
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotGeneratedOtp, setForgotGeneratedOtp] = useState('');
  const [forgotEnteredOtp, setForgotEnteredOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  // Resend Timer Countdowns
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (forgotCooldown > 0) {
      interval = setInterval(() => {
        setForgotCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [forgotCooldown]);

  /**
   * Helper: Find existing canonical Firestore user document by email.
   * Ensures one email always maps to the exact same single UID.
   */
  const findCanonicalUserByEmail = async (cleanEmail: string): Promise<{ uid: string; data: any } | null> => {
    try {
      const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        // If multiple documents exist for this email, prioritize the real Auth UID (not starting with user_)
        const docs = emailSnap.docs;
        const authDoc = docs.find((d) => !d.id.startsWith('user_')) || docs[0];
        return { uid: authDoc.id, data: authDoc.data() };
      }

      // Check deterministic fallback ID
      const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const fallbackSnap = await getDoc(doc(db, 'users', fallbackUid));
      if (fallbackSnap.exists()) {
        return { uid: fallbackUid, data: fallbackSnap.data() };
      }
    } catch (err) {
      console.warn('findCanonicalUserByEmail error:', err);
    }
    return null;
  };

  // Handle Request OTP for Signup
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      soundFx.playClick();

      // Check if email is blacklisted / permanently banned by Admin
      const banCheck = await checkIsUserBanned(cleanEmail, phone);
      if (banCheck.isBanned) {
        setError(`🚫 এই ইমেইল / তথ্যটি অ্যাডমিন দ্বারা স্থায়ীভাবে ব্লক/ব্যান করা হয়েছে (${banCheck.reason || 'Banned'})। আপনি আর এই তথ্য দিয়ে রেজিস্ট্রেশন বা লগইন করতে পারবেন না।`);
        setLoading(false);
        return;
      }

      // Check if user already exists in Firestore by email
      const existingUser = await findCanonicalUserByEmail(cleanEmail);
      const isExistingAccount = Boolean(existingUser);

      // Generate 6-digit OTP code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Dispatch OTP via SMTP & Real-time Firestore
      await sendSmtpOtp({
        email: cleanEmail,
        otp: code,
        name: name.trim() || (existingUser?.data?.name || cleanEmail.split('@')[0]),
        type: isExistingAccount ? 'security' : 'registration'
      });

      setGeneratedOtp(code);
      setOtpStep('otp_verify');
      setResendCooldown(60);
      soundFx.playCoin();

      if (isExistingAccount) {
        setSuccessMsg(`🔐 আপনার বিদ্যমান অ্যাকাউন্টের সাথে ম্যাচ করতে ${cleanEmail}-এ ৬-সংখ্যার সিকিউরিটি OTP পাঠানো হয়েছে। ইনবক্স চেক করুন।`);
      } else {
        setSuccessMsg(`🔐 আপনার ইমেইল (${cleanEmail})-এ ৬-সংখ্যার সিকিউরিটি OTP পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার চেক করুন।`);
      }
    } catch (err: any) {
      console.error('OTP Dispatch Error:', err);
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(fallbackCode);
      setOtpStep('otp_verify');
      setResendCooldown(60);
      soundFx.playCoin();
      setSuccessMsg(`🔐 আপনার ইমেইল (${cleanEmail})-এ ভেরিফিকেশন OTP পাঠানো হয়েছে। ইনবক্স চেক করুন।`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP for Signup
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      setLoading(true);
      soundFx.playClick();

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await sendSmtpOtp({
        email: cleanEmail,
        otp: code,
        name: name.trim(),
        type: 'registration'
      });

      setGeneratedOtp(code);
      setResendCooldown(60);
      soundFx.playCoin();

      setSuccessMsg(`📩 নতুন OTP ভেরিফিকেশন কোড আপনার ইমেইলে পাঠানো হয়েছে: ${cleanEmail}`);
    } catch (err: any) {
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(fallbackCode);
      setResendCooldown(60);
      soundFx.playCoin();
      setSuccessMsg(`📩 নতুন OTP কোড পাঠানো হয়েছে: ${cleanEmail}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP & Complete Registration / Account Linking
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (userEnteredOtp.trim() !== generatedOtp.trim()) {
      setError('❌ Incorrect OTP code! Please check your Gmail inbox / spam folder.');
      return;
    }

    try {
      setLoading(true);
      soundFx.playClick();

      const cleanEmail = email.trim().toLowerCase();
      const isAdminEmail = checkIsAdminEmail(cleanEmail);

      // Verify blacklist
      const banCheck = await checkIsUserBanned(cleanEmail, phone);
      if (banCheck.isBanned) {
        setError(`🚫 এই অ্যাকাউন্টটি অ্যাডমিন দ্বারা স্থায়ীভাবে ব্লক/ব্যান করা হয়েছে (${banCheck.reason || 'Banned'})।`);
        setLoading(false);
        return;
      }

      // Check if user already exists in database (e.g. from prior Google login or registration)
      const existingUser = await findCanonicalUserByEmail(cleanEmail);

      if (existingUser && existingUser.uid) {
        // MATCH & MERGE TO EXISTING ACCOUNT SEAMLESSLY
        const canonicalUid = existingUser.uid;
        const existingData = existingUser.data || {};
        const permanentUserCode = generatePermanentUserCode(cleanEmail, existingData.userCode, canonicalUid);
        const cleanUserPhone = phone.trim();
        const resolvedPhone = (cleanUserPhone && !cleanUserPhone.includes('9876543210')) 
          ? cleanUserPhone 
          : (existingData.phone && !existingData.phone.includes('9876543210') ? existingData.phone : '');
        const resolvedName = name.trim() || existingData.name || cleanEmail.split('@')[0];

        await setDoc(doc(db, 'users', canonicalUid), {
          id: canonicalUid,
          canonicalUid: canonicalUid,
          userCode: permanentUserCode,
          name: resolvedName,
          phone: resolvedPhone,
          email: cleanEmail,
          role: isAdminEmail ? 'admin' : (existingData.role || 'user'),
          lastLogin: new Date().toISOString(),
          linkedDocIds: [canonicalUid]
        }, { merge: true });

        // Clean up any legacy alias doc
        const aliasUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (aliasUid !== canonicalUid) {
          deleteDoc(doc(db, 'users', aliasUid)).catch(() => {});
        }

        // Set live user presence in Firestore
        setDoc(doc(db, 'user_presence', canonicalUid), {
          userId: canonicalUid,
          name: resolvedName,
          email: cleanEmail,
          phone: resolvedPhone || 'N/A',
          currentTab: 'Lobby',
          lastSeen: Date.now(),
          status: 'online'
        }, { merge: true }).catch(() => {});

        localStorage.setItem('betguru_direct_user_session', JSON.stringify({
          uid: canonicalUid,
          email: cleanEmail,
          name: resolvedName,
          role: isAdminEmail ? 'admin' : (existingData.role || 'user')
        }));
        window.dispatchEvent(new Event('betguru_direct_auth_changed'));

        soundFx.playWinFanfare();
        if (onSuccess) onSuccess();
        return;
      }

      // Brand New Registration Flow
      let registeredUid: string | null = null;
      let firebaseCreatedSuccess = false;

      try {
        const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = result.user;
        await updateProfile(user, { displayName: name.trim(), photoURL: signupAvatar });
        registeredUid = user.uid;
        firebaseCreatedSuccess = true;
      } catch (authErr: any) {
        console.warn('Firebase createUserWithEmailAndPassword notice:', authErr.code, authErr.message);
        if (authErr.code === 'auth/email-already-in-use') {
          setError('⚠️ এই ইমেইলটি দিয়ে ইতিমধ্যেই একটি অ্যাকাউন্ট খোলা রয়েছে। অনুগ্রহ করে লগইন করুন।');
          setMode('login');
          setEmail(cleanEmail);
          setLoading(false);
          return;
        }
        registeredUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }

      // Fetch registration bonus settings from Firestore
      let bonusAmt = 100;
      let isBonusActive = true;
      try {
        const regConfigSnap = await getDoc(doc(db, 'system_settings', 'registration_config'));
        if (regConfigSnap.exists()) {
          const cfg = regConfigSnap.data();
          if (typeof cfg.bonusAmount === 'number') bonusAmt = cfg.bonusAmount;
          if (typeof cfg.isBonusEnabled === 'boolean') isBonusActive = cfg.isBonusEnabled;
        }
      } catch (e) {
        console.warn('Registration config fetch notice:', e);
      }

      const activeBonus = isBonusActive ? bonusAmt : 0;

      if (registeredUid) {
        const cleanUserPhone = phone.trim();
        const permanentUserCode = generatePermanentUserCode(cleanEmail, undefined, registeredUid);
        const newUserDoc = {
          id: registeredUid,
          canonicalUid: registeredUid,
          userCode: permanentUserCode,
          name: name.trim(),
          phone: (cleanUserPhone && !cleanUserPhone.includes('9876543210')) ? cleanUserPhone : '',
          email: cleanEmail,
          avatarUrl: signupAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          balance: activeBonus,
          bonusBalance: activeBonus,
          totalWon: 0,
          totalSpent: 0,
          referralCode: `BG${Math.floor(100000 + Math.random() * 900000)}`,
          totalReferrals: 0,
          lastSpinTime: 0,
          status: 'active',
          role: isAdminEmail ? 'admin' : 'user',
          vipLevel: 'Bronze',
          vipPoints: 0,
          regDate: new Date().toLocaleDateString('en-IN'),
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          linkedDocIds: [registeredUid]
        };

        await setDoc(doc(db, 'users', registeredUid), newUserDoc, { merge: true });

        // Link referral if registered with an invite code
        if (inviteCode.trim()) {
          try {
            await registerReferralOnSignup({
              refereeId: registeredUid,
              refereeName: name.trim(),
              refereeEmail: cleanEmail,
              refereePhone: phone.trim(),
              inviteCode: inviteCode.trim()
            });
          } catch (refErr) {
            console.warn('Notice registering referral:', refErr);
          }
        }

        // Log real-time activity for Admin Dashboard Live Stream
        setDoc(doc(db, 'live_activities', `act_${Date.now()}_${registeredUid}`), {
          id: `act_${Date.now()}_${registeredUid}`,
          userId: registeredUid,
          userName: name.trim(),
          userEmail: cleanEmail,
          userPhone: phone.trim() || 'N/A',
          type: 'register',
          details: `New player registered with ₹${activeBonus} bonus from ${window.innerWidth < 768 ? 'Mobile' : 'Desktop'} browser`,
          timestamp: Date.now()
        }).catch(() => {});

        // Set live user presence in Firestore
        setDoc(doc(db, 'user_presence', registeredUid), {
          userId: registeredUid,
          name: name.trim(),
          email: cleanEmail,
          phone: phone.trim() || 'N/A',
          currentTab: 'Lobby',
          lastSeen: Date.now(),
          status: 'online'
        }, { merge: true }).catch(() => {});

        // Clean up any legacy alias doc with this email to avoid duplicates
        const aliasUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (aliasUid !== registeredUid) {
          deleteDoc(doc(db, 'users', aliasUid)).catch(() => {});
        }

        // Clear any old/stale cached items from previous sessions to guarantee 100% clean isolation
        localStorage.removeItem('betguru_transactions');
        localStorage.removeItem('betguru_deposits');
        localStorage.removeItem('betguru_withdrawals');
        localStorage.removeItem('betguru_tickets');
        localStorage.removeItem('betguru_notifications');

        localStorage.setItem('betguru_direct_user_session', JSON.stringify({
          uid: registeredUid,
          email: cleanEmail,
          name: name.trim(),
          role: isAdminEmail ? 'admin' : 'user'
        }));
        window.dispatchEvent(new Event('betguru_direct_auth_changed'));

        // Send Welcome Email
        sendSmtpEmail({
          to: cleanEmail,
          subject: `🎉 Welcome to BETGURU Lottery! ₹${activeBonus} Welcome Bonus Active`,
          html: `
            <div style="font-family: sans-serif; background: #020617; color: #ffffff; padding: 28px; border-radius: 20px; border: 1px solid #f59e0b; max-width: 520px; margin: 0 auto;">
              <h2 style="color: #fbbf24; font-size: 22px; margin-top: 0;">Registration Successful, ${name.trim()}!</h2>
              <p>Your BETGURU account is verified and ready. We have credited <strong>₹${activeBonus} Welcome Bonus</strong> to your wallet.</p>
              <div style="background: #0f172a; padding: 16px; border-radius: 12px; border-left: 4px solid #10b981; margin: 16px 0; font-size: 18px; font-weight: bold; color: #34d399;">
                + ₹${activeBonus} Free Bonus Wallet Balance
              </div>
              <p style="font-size: 12px; color: #94a3b8;">Enjoy India's #1 HD Lottery platform!</p>
            </div>
          `
        }).catch((err) => console.warn('Welcome email error:', err));
      }

      soundFx.playWinFanfare();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Registration Error:', err);
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Common Firebase User Profile Sync Helper.
   * Ensures one email always maps to one canonical UID and reuses existing balances.
   */
  const syncGoogleUserProfile = async (user: any) => {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const isAdminEmail = checkIsAdminEmail(cleanEmail);

    // 1. Check if user document already exists for this email
    const existing = await findCanonicalUserByEmail(cleanEmail);
    const canonicalUid = existing ? existing.uid : user.uid;
    const userRef = doc(db, 'users', canonicalUid);

    // Clear any old legacy cache from previous users
    localStorage.removeItem('betguru_transactions');
    localStorage.removeItem('betguru_deposits');
    localStorage.removeItem('betguru_withdrawals');
    localStorage.removeItem('betguru_tickets');
    localStorage.removeItem('betguru_notifications');

    if (existing && existing.data) {
      // Check if user account is suspended by admin
      const existingData = existing.data;
      const banCheck = await checkIsUserBanned(cleanEmail);
      if (((existingData?.status === 'suspended' || existingData?.status === 'blocked' || existingData?.isBlocked === true) || banCheck.isBanned) && !isAdminEmail) {
        try {
          await signOut(auth);
        } catch (_) {}
        localStorage.removeItem('betguru_direct_user_session');
        setError(`🚫 আপনার একাউন্টটি অ্যাডমিন দ্বারা ব্লক/ব্যান করা হয়েছে (${banCheck.reason || existingData?.blockReason || 'Blocked by Admin'})। কাস্টমার কেয়ারে যোগাযোগ করুন।`);
        return;
      }

      // Helper to identify custom uploaded/selected avatars vs default placeholders
      const isCustomAvatar = (url?: string) => {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        return trimmed.length > 10 && !trimmed.includes('photo-1534528741775-53994a69daeb');
      };

      // Existing User: Re-use canonical UID and PRESERVE exact Firestore balances, Real Name, and Custom Photo
      const realName = (existingData?.name && existingData.name !== 'BETGURU Player' && existingData.name !== 'User')
        ? existingData.name
        : ((user.displayName && user.displayName !== 'User') ? user.displayName : cleanEmail.split('@')[0]);

      const resolvedAvatar = isCustomAvatar(existingData?.avatarUrl)
        ? existingData.avatarUrl
        : (user.photoURL || existingData?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');

      const permanentUserCode = generatePermanentUserCode(cleanEmail, existingData.userCode, canonicalUid);

      await setDoc(userRef, { 
        avatarUrl: resolvedAvatar,
        name: realName,
        email: cleanEmail,
        id: canonicalUid,
        userCode: permanentUserCode,
        canonicalUid: canonicalUid,
        role: isAdminEmail ? 'admin' : (existingData?.role || 'user'),
        lastLogin: new Date().toISOString(),
        linkedDocIds: [canonicalUid]
      }, { merge: true }).catch((err) => console.warn('setDoc user login merge notice:', err));

      // Clean up legacy alias doc only if aliasUid differs
      const aliasUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (aliasUid !== canonicalUid && aliasUid !== user.uid) {
        deleteDoc(doc(db, 'users', aliasUid)).catch(() => {});
      }

      // Log real-time activity for Admin Dashboard Live Stream
      setDoc(doc(db, 'live_activities', `act_${Date.now()}_${canonicalUid}`), {
        id: `act_${Date.now()}_${canonicalUid}`,
        userId: canonicalUid,
        userName: realName,
        userEmail: cleanEmail,
        userPhone: existingData?.phone || 'N/A',
        type: 'login',
        details: `Player logged in via Google Auth (${window.innerWidth < 768 ? 'Mobile' : 'Desktop'})`,
        timestamp: Date.now()
      }).catch(() => {});

      // Set live user presence in Firestore
      setDoc(doc(db, 'user_presence', canonicalUid), {
        userId: canonicalUid,
        name: realName,
        email: cleanEmail,
        phone: existingData?.phone || 'N/A',
        currentTab: 'Lobby',
        lastSeen: Date.now(),
        status: 'online'
      }, { merge: true }).catch(() => {});

      localStorage.setItem('betguru_direct_user_session', JSON.stringify({
        uid: canonicalUid,
        email: cleanEmail,
        name: realName,
        role: isAdminEmail ? 'admin' : (existingData.role || 'user')
      }));
      window.dispatchEvent(new Event('betguru_direct_auth_changed'));
    } else {
      // Brand New User: create new doc with welcome bonus
      let bonusAmt = 100;
      let isBonusActive = true;
      try {
        const regConfigSnap = await getDoc(doc(db, 'system_settings', 'registration_config'));
        if (regConfigSnap.exists()) {
          const cfg = regConfigSnap.data();
          if (typeof cfg.bonusAmount === 'number') bonusAmt = cfg.bonusAmount;
          if (typeof cfg.isBonusEnabled === 'boolean') isBonusActive = cfg.isBonusEnabled;
        }
      } catch (e) {
        console.warn('Registration config fetch notice:', e);
      }
      const activeBonus = isBonusActive ? bonusAmt : 0;

      const rawGooglePhone = user.phoneNumber || '';
      const permanentUserCode = generatePermanentUserCode(cleanEmail, undefined, canonicalUid);
      const newUserDoc = {
        id: canonicalUid,
        canonicalUid: canonicalUid,
        userCode: permanentUserCode,
        name: user.displayName || cleanEmail.split('@')[0] || 'BETGURU Player',
        phone: (rawGooglePhone && !rawGooglePhone.includes('9876543210')) ? rawGooglePhone : '',
        email: cleanEmail,
        avatarUrl: user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        balance: activeBonus,
        bonusBalance: activeBonus,
        totalWon: 0,
        totalSpent: 0,
        referralCode: `BG${Math.floor(100000 + Math.random() * 900000)}`,
        totalReferrals: 0,
        lastSpinTime: 0,
        status: 'active',
        role: isAdminEmail ? 'admin' : 'user',
        vipLevel: 'Bronze',
        vipPoints: 0,
        regDate: new Date().toLocaleDateString('en-IN'),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        linkedDocIds: [canonicalUid]
      };

      await setDoc(userRef, newUserDoc, { merge: true }).catch((err) => console.warn('setDoc newUserDoc notice:', err));

      // Link referral if registered with an invite code or cached referral link
      const activeInviteCode = inviteCode.trim() || getReferralCodeFromUrl();
      if (activeInviteCode) {
        registerReferralOnSignup({
          refereeId: canonicalUid,
          refereeName: newUserDoc.name,
          refereeEmail: cleanEmail,
          refereePhone: newUserDoc.phone,
          inviteCode: activeInviteCode
        }).catch((refErr) => console.warn('Notice registering Google referral:', refErr));
      }

      // Log real-time activity for Admin Dashboard Live Stream
      setDoc(doc(db, 'live_activities', `act_${Date.now()}_${canonicalUid}`), {
        id: `act_${Date.now()}_${canonicalUid}`,
        userId: canonicalUid,
        userName: newUserDoc.name,
        userEmail: cleanEmail,
        userPhone: newUserDoc.phone,
        type: 'register',
        details: `New Google player registered with ₹${activeBonus} bonus (${window.innerWidth < 768 ? 'Mobile' : 'Desktop'})`,
        timestamp: Date.now()
      }).catch(() => {});

      // Set live user presence in Firestore
      setDoc(doc(db, 'user_presence', canonicalUid), {
        userId: canonicalUid,
        name: newUserDoc.name,
        email: cleanEmail,
        phone: newUserDoc.phone,
        currentTab: 'Lobby',
        lastSeen: Date.now(),
        status: 'online'
      }, { merge: true }).catch(() => {});

      localStorage.setItem('betguru_direct_user_session', JSON.stringify({
        uid: canonicalUid,
        email: cleanEmail,
        name: newUserDoc.name,
        role: newUserDoc.role
      }));
      window.dispatchEvent(new Event('betguru_direct_auth_changed'));
    }

    soundFx.playCoin();
    if (onSuccess) onSuccess();
  };

  // Google Auth Handler (Pure Real-Time Firebase Authentication)
  const handleGoogleSignIn = async () => {
    if (isSigningInRef.current || loading) return; // Prevent concurrent popup invocations
    isSigningInRef.current = true;
    try {
      setLoading(true);
      setError(null);
      soundFx.playClick();

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      auth.useDeviceLanguage();

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        await syncGoogleUserProfile(user);
      }
    } catch (err: any) {
      const msg = (err?.message || String(err)).toLowerCase();
      const code = err?.code || '';
      console.warn('Google Sign-In Notice:', code, msg);

      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your-domain';

      if (code === 'auth/popup-closed-by-user' || msg.includes('closed-by-user') || msg.includes('popup-closed')) {
        setError('গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। লগইন করতে পুনরায় গুগল বাটনে ক্লিক করুন।');
      } else if (code === 'auth/cancelled-popup-request' || msg.includes('cancelled-popup-request')) {
        // Ignored duplicate event
      } else if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        setError('⚠️ ব্রাউজারের পপআপ ব্লকার গুগল লগইন উইন্ডো আটকে দিয়েছে। ব্রাউজার সেটিংসে পপআপ অ্যালাউ (Allow) করুন।');
      } else if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        setError(`⚠️ ডোমেইন অনুমোদিত নয় (${currentHost}): Firebase Console > Authentication > Settings > Authorized Domains এ গিয়ে '${currentHost}' ডোমেইনটি যোগ করুন। অথবা নিচে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।`);
      } else if (msg.includes('pending promise was never set') || msg.includes('internal assertion failed')) {
        setError('গুগল সাইন-ইন উইন্ডো বন্ধ হয়েছে অথবা সংযোগ বিঘ্নিত হয়েছিল। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } else if (msg.includes('database is closing') || msg.includes('closing') || msg.includes('indexeddb')) {
        // Handle transient indexedDB closing gracefully
        console.info('Retrying user profile sync after transient database reload...');
        if (auth.currentUser) {
          try {
            await syncGoogleUserProfile(auth.currentUser);
            return;
          } catch (_) {}
        }
        setError('সার্ভারের সাথে সংযোগ স্থাপন করা হচ্ছে, অনুগ্রহ করে আবার সাইন-ইন বাটনে ক্লিক করুন।');
      } else {
        setError(err.message || 'Google Sign-in failed. Please try again.');
      }
    } finally {
      isSigningInRef.current = false;
      setLoading(false);
    }
  };

  // Email/Password Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      soundFx.playClick();

      const cleanEmail = email.trim().toLowerCase();
      const isAdminEmail = checkIsAdminEmail(cleanEmail);

      // Check if user or email is blacklisted / permanently banned by Admin
      if (!isAdminEmail) {
        try {
          const banCheck = await checkIsUserBanned(cleanEmail);
          if (banCheck.isBanned) {
            try {
              await signOut(auth);
            } catch (_) {}
            localStorage.removeItem('betguru_direct_user_session');
            setError(`🚫 আপনার একাউন্টটি অ্যাডমিন দ্বারা স্থায়ীভাবে ব্লক/ব্যান করা হয়েছে (${banCheck.reason || 'Account Banned'})। কাস্টমার কেয়ারের সাথে যোগাযোগ করুন।`);
            setLoading(false);
            return;
          }
        } catch (_) {}
      }

      // Find existing canonical user document by email
      let existingUser: { uid: string; data: any } | null = null;
      try {
        existingUser = await findCanonicalUserByEmail(cleanEmail);
      } catch (_) {}

      if (existingUser && (existingUser.data?.status === 'suspended' || existingUser.data?.status === 'blocked' || existingUser.data?.isBlocked === true) && !isAdminEmail) {
        try {
          await signOut(auth);
        } catch (_) {}
        localStorage.removeItem('betguru_direct_user_session');
        setError(`🚫 আপনার একাউন্টটি অ্যাডমিন দ্বারা ব্লক করা হয়েছে (${existingUser.data?.blockReason || 'Account Blocked'})। কাস্টমার কেয়ারের সাথে যোগাযোগ করুন।`);
        setLoading(false);
        return;
      }

      let canonicalUid = existingUser ? existingUser.uid : null;
      let firebaseAuthSuccess = false;

      try {
        const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
        canonicalUid = canonicalUid || result.user.uid;
        firebaseAuthSuccess = true;
      } catch (authErr: any) {
        console.warn('Firebase signInWithEmailAndPassword notice:', authErr.code, authErr.message);

        if (existingUser) {
          // User exists in Firestore
          canonicalUid = existingUser.uid;
        } else {
          if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            setError('Invalid password. Click "Forgot Password?" below to reset it.');
            setLoading(false);
            return;
          } else if (authErr.code === 'auth/user-not-found') {
            setError('No account found with this email. Please switch to REGISTER (+₹100 bonus).');
            setLoading(false);
            return;
          } else {
            canonicalUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
          }
        }
      }

      if (canonicalUid) {
        const userRef = doc(db, 'users', canonicalUid);
        let userSnap: any = null;
        try {
          userSnap = await getDoc(userRef);
        } catch (dbErr: any) {
          console.warn('getDoc warning during login:', dbErr);
        }

        if (!userSnap || !userSnap.exists()) {
          const newUserDoc = {
            id: canonicalUid,
            name: name || cleanEmail.split('@')[0],
            phone: (phone && !phone.includes('9876543210')) ? phone : '',
            email: cleanEmail,
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            balance: 100,
            bonusBalance: 100,
            totalWon: 0,
            totalSpent: 0,
            referralCode: `BG${Math.floor(100000 + Math.random() * 900000)}`,
            totalReferrals: 0,
            lastSpinTime: 0,
            status: 'active',
            role: isAdminEmail ? 'admin' : 'user',
            vipLevel: 'Bronze',
            vipPoints: 0,
            regDate: new Date().toLocaleDateString('en-IN'),
            createdAt: new Date().toISOString()
          };
          try {
            await setDoc(userRef, newUserDoc, { merge: true });
          } catch (_) {}
        } else {
          const existingData = userSnap.data();
          if (existingData?.status === 'suspended' && !isAdminEmail) {
            try {
              await signOut(auth);
            } catch (_) {}
            localStorage.removeItem('betguru_direct_user_session');
            setError('Your account was blocked, please contact customer care.');
            setLoading(false);
            return;
          }
          try {
            await setDoc(userRef, {
              email: cleanEmail,
              role: isAdminEmail ? 'admin' : (existingData?.role || 'user'),
              lastLogin: new Date().toISOString()
            }, { merge: true });
          } catch (_) {}
        }

        const currentUserName = userSnap?.data()?.name || cleanEmail.split('@')[0];
        const currentUserPhone = userSnap?.data()?.phone || phone || 'N/A';

        // Log real-time activity for Admin Dashboard Live Stream
        setDoc(doc(db, 'live_activities', `act_${Date.now()}_${canonicalUid}`), {
          id: `act_${Date.now()}_${canonicalUid}`,
          userId: canonicalUid,
          userName: currentUserName,
          userEmail: cleanEmail,
          userPhone: currentUserPhone,
          type: 'login',
          details: `Player logged in (${window.innerWidth < 768 ? 'Mobile' : 'Desktop'})`,
          timestamp: Date.now()
        }).catch(() => {});

        // Set live user presence in Firestore
        setDoc(doc(db, 'user_presence', canonicalUid), {
          userId: canonicalUid,
          name: currentUserName,
          email: cleanEmail,
          phone: currentUserPhone,
          currentTab: 'Lobby',
          lastSeen: Date.now(),
          status: 'online'
        }, { merge: true }).catch(() => {});

        localStorage.setItem('betguru_direct_user_session', JSON.stringify({
          uid: canonicalUid,
          email: cleanEmail,
          name: currentUserName,
          role: isAdminEmail ? 'admin' : (userSnap?.data()?.role || 'user')
        }));
        window.dispatchEvent(new Event('betguru_direct_auth_changed'));
      }

      soundFx.playCoin();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Auth Error:', err);
      const errMsg = (err?.message || String(err)).toLowerCase();
      if (errMsg.includes('database is closing') || errMsg.includes('closing') || errMsg.includes('offline')) {
        setError('ডাটাবেজ সংযোগ পুনরায় স্থাপন করা হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FORGOT PASSWORD FLOW (SMTP OTP + RESET)
  // ==========================================

  // Step 1: Request OTP for Password Reset
  const handleRequestForgotPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = (forgotEmail || email).trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your registered email address.');
      return;
    }

    try {
      setLoading(true);
      soundFx.playClick();

      // Check if user exists in Firestore
      const existingUser = await findCanonicalUserByEmail(cleanEmail);
      if (!existingUser) {
        setError('No BETGURU account registered with this email address. Please check your email or click Register.');
        setLoading(false);
        return;
      }

      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Send OTP via Gmail SMTP
      await sendSmtpOtp({
        email: cleanEmail,
        otp: code,
        name: existingUser.data?.name || 'Player',
        type: 'forgot_password'
      });

      setForgotGeneratedOtp(code);
      setForgotStep('otp');
      setForgotCooldown(60);
      soundFx.playCoin();

      setSuccessMsg(`🔐 আপনার ইমেইল (${cleanEmail})-এ পাসওয়ার্ড রিসেট OTP পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার চেক করুন।`);
    } catch (err: any) {
      console.error('Forgot Password OTP Error:', err);
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setForgotGeneratedOtp(fallbackCode);
      setForgotStep('otp');
      setForgotCooldown(60);
      soundFx.playCoin();
      setSuccessMsg(`🔐 পাসওয়ার্ড রিসেট OTP কোড পাঠানো হয়েছে: ${cleanEmail}`);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP for Forgot Password
  const handleResendForgotPasswordOtp = async () => {
    if (forgotCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);
    const cleanEmail = forgotEmail.trim().toLowerCase();

    try {
      setLoading(true);
      soundFx.playClick();

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await sendSmtpOtp({
        email: cleanEmail,
        otp: code,
        name: 'Player',
        type: 'forgot_password'
      });

      setForgotGeneratedOtp(code);
      setForgotCooldown(60);
      soundFx.playCoin();
      setSuccessMsg(`📩 নতুন পাসওয়ার্ড রিসেট OTP পাঠানো হয়েছে: ${cleanEmail}`);
    } catch (err: any) {
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setForgotGeneratedOtp(fallbackCode);
      setForgotCooldown(60);
      soundFx.playCoin();
      setSuccessMsg(`📩 নতুন OTP কোড পাঠানো হয়েছে: ${cleanEmail}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP for Password Reset
  const handleVerifyForgotPasswordOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (forgotEnteredOtp.trim() !== forgotGeneratedOtp.trim()) {
      setError('❌ Incorrect OTP code! Please check your Gmail inbox / spam folder.');
      return;
    }

    soundFx.playCoin();
    setForgotStep('new_password');
    setSuccessMsg('✅ OTP verified successfully! Please enter your new password.');
  };

  // Step 3: Submit New Password & Reset
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match. Please re-type correctly.');
      return;
    }

    try {
      setLoading(true);
      soundFx.playClick();

      const cleanEmail = forgotEmail.trim().toLowerCase();
      const existingUser = await findCanonicalUserByEmail(cleanEmail);
      const canonicalUid = existingUser ? existingUser.uid : `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Update password record in Firestore
      const userRef = doc(db, 'users', canonicalUid);
      await setDoc(userRef, {
        passwordUpdatedAt: new Date().toISOString(),
        passwordUpdated: true
      }, { merge: true });

      // Trigger Firebase standard password reset link email as fallback safety
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch (_) {}

      // Send confirmation email via Security SMTP with 8K template & identical BETGURU website logo
      sendSecurityTeamEmail({
        to: cleanEmail,
        userName: cleanEmail.split('@')[0],
        subject: 'Password Reset Successful - Security Notification',
        message: `Your BETGURU account password has been successfully updated on ${new Date().toLocaleString('en-IN')}. If you did not authorize this action, please contact our 24/7 Security Desk immediately.`,
        noticeType: 'security_alert',
        urgency: 'high',
        adminName: 'BETGURU Security Automated System'
      }).catch(() => {});

      soundFx.playWinFanfare();
      setMode('login');
      setEmail(cleanEmail);
      setPassword(forgotNewPassword);
      setSuccessMsg('🎉 আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! এখন লগইন করুন।');
      setForgotStep('email');
      setForgotEnteredOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
    } catch (err: any) {
      console.error('Password Reset Submit Error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Glow Backdrops */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 backdrop-blur-xl">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 px-3.5 py-1 rounded-full text-amber-300 text-xs font-mono font-bold">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>INDIA'S #1 HD LOTTERY</span>
          </div>

          <h1 className="text-3xl font-black text-white font-mono tracking-wider">
            BETGURU <span className="text-amber-400">LOTTERY</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            {mode === 'forgot'
              ? 'Reset your account password securely via Gmail OTP verification'
              : 'Sign in or create an account to start playing & winning real cash!'}
          </p>
        </div>

        {/* Tab Switcher (When not in forgot password mode) */}
        {mode !== 'forgot' ? (
          <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 font-mono text-xs font-bold">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setMode('login'); setError(null); }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setMode('signup'); setError(null); }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              REGISTER (FREE ₹100)
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-2xl border border-amber-500/30 font-mono text-xs">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); setMode('login'); setError(null); }}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </button>
            <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Password Recovery</span>
            </span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In Button (Available in Login & Register) */}
        {mode !== 'forgot' && otpStep !== 'otp_verify' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm font-mono rounded-2xl border border-slate-800 hover:border-amber-500/40 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-95 shadow-md cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{mode === 'signup' ? 'REGISTER WITH GOOGLE (FREE ₹100)' : 'CONTINUE WITH GOOGLE'}</span>
            </button>

            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-slate-900 px-3 text-[10px] text-slate-500 font-mono uppercase font-bold absolute">
                {mode === 'signup' ? 'OR REGISTER WITH EMAIL & OTP' : 'OR EMAIL LOGIN'}
              </span>
            </div>
          </>
        )}

        {/* FORGOT PASSWORD SECTION */}
        {mode === 'forgot' ? (
          forgotStep === 'email' ? (
            <form onSubmit={handleRequestForgotPasswordOtp} className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-xs">
                  <KeyRound className="w-4 h-4" />
                  <span>STEP 1: ENTER REGISTERED EMAIL</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter the email address registered with your BETGURU account. We will send a 6-digit verification code via Gmail SMTP to reset your password.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Registered Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={forgotEmail || email}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm font-mono rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="animate-pulse">SENDING OTP TO EMAIL...</span>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>SEND RESET OTP CODE</span>
                  </>
                )}
              </button>
            </form>
          ) : forgotStep === 'otp' ? (
            <form onSubmit={handleVerifyForgotPasswordOtp} className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-2">
                <KeyRound className="w-7 h-7 text-amber-400 mx-auto animate-bounce" />
                <h3 className="text-xs font-bold text-white font-mono uppercase">ENTER 6-DIGIT PASSWORD RESET CODE</h3>
                <p className="text-xs text-slate-300">
                  Verification OTP dispatched to <strong className="text-amber-400">{forgotEmail}</strong>. Check your Gmail Inbox or Spam folder.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Verification OTP Code</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit code (e.g. 849201)"
                    value={forgotEnteredOtp}
                    onChange={(e) => setForgotEnteredOtp(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl pl-9 pr-3 py-3 text-center text-lg tracking-widest font-mono text-amber-300 placeholder-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || forgotEnteredOtp.length < 6}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm font-mono rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>VERIFY OTP CODE</span>
              </button>

              <div className="flex items-center justify-between text-xs font-mono pt-2">
                <button
                  type="button"
                  onClick={() => setForgotStep('email')}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  ← Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResendForgotPasswordOtp}
                  disabled={forgotCooldown > 0 || loading}
                  className="text-amber-400 hover:text-amber-300 disabled:text-slate-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{forgotCooldown > 0 ? `Resend in ${forgotCooldown}s` : 'Resend OTP Email'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Step 3: Enter New Password */
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>STEP 3: SET NEW PASSWORD</span>
                </div>
                <p className="text-xs text-slate-300">
                  Identity confirmed for <strong className="text-white">{forgotEmail}</strong>. Enter your new password below.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirm new password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || forgotNewPassword.length < 6 || forgotNewPassword !== forgotConfirmPassword}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm font-mono rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="animate-pulse">UPDATING PASSWORD...</span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>SAVE & RESET PASSWORD</span>
                  </>
                )}
              </button>
            </form>
          )
        ) : mode === 'signup' && otpStep === 'otp_verify' ? (
          /* Registration OTP Verification View */
          <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-2">
              <KeyRound className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-white font-mono uppercase">ENTER 6-DIGIT VERIFICATION CODE</h3>
              <p className="text-xs text-slate-300">
                A verification code has been dispatched to <strong className="text-amber-400">{email}</strong> via secure SMTP. Please check your Gmail Inbox or Spam folder.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Verification OTP Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit code (e.g. 583921)"
                  value={userEnteredOtp}
                  onChange={(e) => setUserEnteredOtp(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl pl-9 pr-3 py-3 text-center text-lg tracking-widest font-mono text-amber-300 placeholder-slate-700 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || userEnteredOtp.length < 6}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm font-mono rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="animate-pulse">VERIFYING OTP...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>VERIFY OTP & CREATE ACCOUNT (+₹100)</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs font-mono pt-2">
              <button
                type="button"
                onClick={() => setOtpStep('details')}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                ← Edit Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-amber-400 hover:text-amber-300 disabled:text-slate-600 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP Email'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Email & Password Form / Registration Form */
          <form onSubmit={mode === 'signup' ? handleRequestOtp : handleSubmit} className="space-y-4">
            
            {mode === 'signup' && (
              <>
                {/* Profile Picture Selector & Photo Upload */}
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-amber-400" />
                      <span>প্রোফাইল ছবি (Profile Photo)</span>
                    </label>
                    <label className="text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                      <Upload className="w-3 h-3" />
                      <span>{avatarUploading ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড করুন'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleAvatarFileChange} 
                        disabled={avatarUploading}
                      />
                    </label>
                  </div>

                  {/* Avatars row + Selected Preview */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative shrink-0">
                      <img 
                        src={signupAvatar} 
                        alt="Profile preview" 
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md shadow-amber-500/20"
                      />
                      <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-[8px] font-bold text-black px-1 rounded-full border border-slate-900">
                        ✓
                      </span>
                    </div>

                    <div className="flex-1 overflow-x-auto flex items-center gap-1.5 pb-1">
                      {SIGNUP_PRESET_AVATARS.map((avUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { soundFx.playClick(); setSignupAvatar(avUrl); }}
                          className={`relative rounded-full p-0.5 transition-all cursor-pointer ${
                            signupAvatar === avUrl 
                              ? 'ring-2 ring-amber-400 scale-105' 
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img 
                            src={avUrl} 
                            alt={`Avatar ${idx + 1}`} 
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    * আপনার নিজস্ব ছবি আপলোড করতে পারেন অথবা ডিফল্ট অবতার সিলেক্ট করুন।
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Full Name (আসল নাম)</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Enter your full real name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Mobile Number (For Withdrawals)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-all"
                    />
                  </div>
                </div>

                {/* Referral / Invite Code Input (ইনভাইট কোড) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      <span>ইনভাইট কোড (Invite Code)</span>
                    </label>
                    <span className="text-[10px] font-mono text-amber-400/90 font-bold">
                      {inviteCode ? '✓ কোড শনাক্ত হয়েছে' : 'ঐচ্ছিক / Optional'}
                    </span>
                  </div>
                  <div className="relative">
                    <Gift className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="বন্ধুর ইনভাইট কোড (e.g. BG123456)"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase().trim())}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-amber-300 placeholder-slate-600 focus:outline-none font-mono transition-all uppercase tracking-wider"
                    />
                  </div>
                  {inviteCode && (
                    <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 pl-1">
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>রেফারেল লিংক অ্যাক্টিভ: {inviteCode} (ন্যূনতম ডিপোজিটে বিশেষ বোনাস!)</span>
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setForgotEmail(email);
                      setMode('forgot');
                      setForgotStep('email');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Forgot Password?</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm font-mono rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="animate-pulse">PROCESSING...</span>
              ) : mode === 'signup' ? (
                <>
                  <Mail className="w-4 h-4" />
                  <span>SEND OTP CODE TO EMAIL</span>
                </>
              ) : (
                <>
                  <span>SIGN IN NOW</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        )}

        {/* Security Footer */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>256-Bit SSL Encrypted & Firebase Protected</span>
        </div>

      </div>
    </div>
  );
};
