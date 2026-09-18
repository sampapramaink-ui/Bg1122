/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Wallet, Dices, Plus, ArrowUpRight, ShieldCheck, ShieldAlert, Flame, Star, CheckCircle2, Disc, Play, Radio, X, Megaphone, Bell, MessageSquare, LogOut, Users, Share2, Gift } from 'lucide-react';
import { User, LotteryDraw, LotteryDrawResult, DepositRequest, WithdrawalRequest, PurchasedTicket, TicketStatus, WalletTransaction, NotificationItem, PaymentMethodType, DepositCategory, UserSettings, BannerSlide, AllGameStatuses, DEFAULT_GAME_STATUSES } from './types';
import { generateImageFingerprint } from './utils/depositSecurity';
import { loadState, saveState } from './utils/storage';
import { INITIAL_DRAWS, INITIAL_DRAW_RESULTS } from './data/mockData';
import { soundFx } from './utils/audio';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { LotteryCard } from './components/LotteryCard';
import { DepositModal } from './components/DepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { TicketBuyModal } from './components/TicketBuyModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { LuckyWheelModal } from './components/LuckyWheelModal';
import { LiveSupportChatModal } from './components/LiveSupportChatModal';
import { LiveWinnersTicker } from './components/LiveWinnersTicker';
import { MyTicketsView } from './components/MyTicketsView';
import { ResultsView } from './components/ResultsView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { OffersView } from './components/OffersView';
import { UserSideMenu } from './components/UserSideMenu';
import { PWANotificationModal } from './components/PWANotificationModal';
import { GoogleMapOutletLocator } from './components/GoogleMapOutletLocator';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { LiveRoulette } from './components/LiveRoulette';
import { AndarBaharGame } from './components/AndarBaharGame';
import { AviatorCrashGame } from './components/AviatorCrashGame';
import { DragonTigerGame } from './components/DragonTigerGame';
import { LiveOnlinePlayerCounter } from './components/LiveOnlinePlayerCounter';
import { LotterySection } from './components/LotterySection';
import { WithdrawalSection } from './components/WithdrawalSection';
import { SuperCarDrawSection } from './components/SuperCarDrawSection';
import { SuperCarArenaGame } from './components/SuperCarArenaGame';
import { SuperCarTicketModal } from './components/SuperCarTicketModal';
import { CompactUserDashboardCard } from './components/CompactUserDashboardCard';
import { PromotionalSlider } from './components/PromotionalSlider';
import { SuperCarWinToast, SuperCarWinToastData } from './components/SuperCarWinToast';
import { ReferralModal } from './components/ReferralModal';
import { PromoCodeModal } from './components/PromoCodeModal';
import { recordDepositPromoRedemption } from './utils/promoCodeService';
import { processReferralOnDepositApproval } from './utils/referralEngine';
import { BigWinModal, BigWinData } from './components/BigWinModal';
import { SuperCarConfig, SuperCarDrawIssue, SuperCarColor, BonusBalanceRules, PromotionalOffer } from './types';
import { DEFAULT_PROMOTIONAL_OFFERS } from './data/defaultOffers';
import { DEFAULT_SUPERCAR_CONFIG, getSuperCarInfo, getCurrentSuperCarSchedule, getSlotFromTicket, getWinningCarForSlot, sortChronologicalNewestFirst } from './utils/supercar';
import { resolveNotificationDestination } from './utils/notificationRouting';
import { LuxuryEntryGate } from './components/LuxuryEntryGate';
import { AppUpdateModal } from './components/AppUpdateModal';
import { AppUpdateConfig } from './types';
import { 
  DEFAULT_APP_UPDATE_CONFIG, 
  isVersionNewer, 
  getNativeAppVersion, 
  triggerAppUpdate, 
  clearNativeAppCache 
} from './utils/appUpdateService';
import { 
  bannerAviatorCrashImg, 
  andarBaharBannerImg, 
  rouletteBannerImg, 
  dragonTigerBannerImg 
} from './assets/casinoBanners';
import { auth, db, testConnection, OperationType, handleFirestoreError, cleanFirestoreData } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, deleteDoc, arrayUnion, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { logAnalyticsEvent } from './utils/analytics';
import { triggerConfetti } from './utils/confetti';
import { 
  notifyDepositSubmitted, 
  notifyDepositApproved, 
  notifyDepositRejected, 
  notifyWithdrawalSubmitted, 
  notifyWithdrawalApproved, 
  notifyWithdrawalRejected,
  notifyBonusCredited
} from './utils/emailNotifier';
import { 
  autoCheckAndSeedFirestore, 
  resolveCanonicalUserData, 
  checkIsAdminEmail, 
  getUserDisplayCode, 
  findAndCreditUserInFirestore,
  syncUserWalletAuthoritative,
  getFreshDoc
} from './utils/databaseSync';
import { sendAdminNotification } from './utils/adminNotificationService';
import { safeApiPost } from './utils/apiConfig';
import { captureAndSyncUserLocation } from './utils/geolocation';
import { trackUserPresence, logLiveActivity } from './utils/activityTracker';
import { setErrorUserContext } from './utils/errorDiagnostics';
import { 
  setupAndroidBridge, 
  saveTokenToUserDatabase, 
  getStoredFcmToken, 
  isAndroidNativeApp 
} from './utils/androidBridge';
import { initPWANotifications } from './utils/pwaNotifications';
import { recordUserWager, calculateUserWagerStatus } from './utils/wagerEngine';

export default function App() {
  const [initialState] = useState(() => loadState());

  const [user, setUser] = useState<User>(initialState.user);
  const [draws, setDraws] = useState<LotteryDraw[]>(initialState.draws);
  const [lotteryResults, setLotteryResults] = useState<LotteryDrawResult[]>(INITIAL_DRAW_RESULTS);
  const [deposits, setDeposits] = useState<DepositRequest[]>(initialState.deposits);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(initialState.withdrawals);
  const [tickets, setTickets] = useState<PurchasedTicket[]>(initialState.tickets);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(initialState.transactions);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialState.notifications);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>(() => {
    try {
      const cached = localStorage.getItem('bg_banner_slides_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [bonusRules, setBonusRules] = useState<BonusBalanceRules>({
    allowSuperCar: true,
    allowRegularLottery: false,
    allowLiveRoulette: false,
    allowLuckyWheel: false,
    defaultBonusAmount: 100,
    isBonusSystemActive: true,
    bonusNotice: 'বোনাস ব্যালেন্স দিয়ে শুধুমাত্র থ্রী সুপার কার টিকিট কেনা যাবে।'
  });

  // Navigation & Modals UI state
  const [activeTab, setActiveTab] = useState<NavTab | 'settings'>('home');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [promotionalOffers, setPromotionalOffers] = useState<PromotionalOffer[]>(DEFAULT_PROMOTIONAL_OFFERS);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [isPromoCodeOpen, setIsPromoCodeOpen] = useState<boolean>(false);
  const [depositInitialPromo, setDepositInitialPromo] = useState<string>('');
  const [isWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState<boolean>(false);
  const [isPwaNotificationOpen, setIsPwaNotificationOpen] = useState<boolean>(false);
  const [isOutletMapOpen, setIsOutletMapOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isLuckyWheelOpen, setIsLuckyWheelOpen] = useState<boolean>(false);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState<boolean>(false);
  const [supportChatPrefill, setSupportChatPrefill] = useState<string>('');
  const [isLiveRouletteOpen, setIsLiveRouletteOpen] = useState<boolean>(false);
  const [isAndarBaharOpen, setIsAndarBaharOpen] = useState<boolean>(false);
  const [isCrashGameOpen, setIsCrashGameOpen] = useState<boolean>(false);
  const [isDragonTigerOpen, setIsDragonTigerOpen] = useState<boolean>(false);
  const [isSuperCarOpen, setIsSuperCarOpen] = useState<boolean>(false);
  const [superCarSelectedColor, setSuperCarSelectedColor] = useState<SuperCarColor>('red');
  const [superCarBuyPageCar, setSuperCarBuyPageCar] = useState<SuperCarColor | null>(null);
  const [buyTicketDraw, setBuyTicketDraw] = useState<LotteryDraw | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const isAnyLiveGameOpen = isDragonTigerOpen || isCrashGameOpen || isLiveRouletteOpen || isAndarBaharOpen || isSuperCarOpen || !!superCarBuyPageCar;

  // SuperCar States
  const [supercarConfig, setSupercarConfig] = useState<SuperCarConfig>(DEFAULT_SUPERCAR_CONFIG);
  const [supercarCurrentIssue, setSupercarCurrentIssue] = useState<SuperCarDrawIssue | null>(null);
  const [supercarPastDraws, setSupercarPastDraws] = useState<SuperCarDrawIssue[]>(() => {
    try {
      const cached = localStorage.getItem('betguru_supercar_draws');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [superCarWinToast, setSuperCarWinToast] = useState<SuperCarWinToastData | null>(null);
  const [bigWinData, setBigWinData] = useState<BigWinData | null>(null);
  const notifiedWinTicketIdsRef = React.useRef<Set<string>>(new Set());
  const spokenNotificationIdsRef = React.useRef<Set<string>>(new Set());
  const seenToastNotificationIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialNtfLoadRef = React.useRef<boolean>(true);
  const prevDepositStatusesRef = React.useRef<Map<string, string>>(new Map());
  const isInitialDepositsLoadRef = React.useRef<boolean>(true);
  const prevWithdrawalStatusesRef = React.useRef<Map<string, string>>(new Map());
  const isInitialWithdrawalsLoadRef = React.useRef<boolean>(true);

  // Auto-request browser push notification permissions on user interaction
  useEffect(() => {
    const handleUnlockNotification = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission().catch(() => {});
        } catch (_) {}
      }
    };
    window.addEventListener('click', handleUnlockNotification, { once: true });
    window.addEventListener('touchstart', handleUnlockNotification, { once: true });
    return () => {
      window.removeEventListener('click', handleUnlockNotification);
      window.removeEventListener('touchstart', handleUnlockNotification);
    };
  }, []);

  // Entry Gateway Verification State
  const [isEntryGateVerified, setIsEntryGateVerified] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('betguru_session_entered') === 'true';
    } catch (_) {
      return false;
    }
  });

  // Global Broadcast & Push Notification States
  const [activeBroadcastBanner, setActiveBroadcastBanner] = useState<{ id: string; title: string; message: string; priority: string } | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<{ title: string; message: string; priority?: string } | null>(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [supportPopupToast, setSupportPopupToast] = useState<{
    agentName: string;
    agentAvatar?: string;
    agentTitle?: string;
    text: string;
    time: string;
  } | null>(null);

  // In-App Android Update & Version Control State
  const [appUpdateConfig, setAppUpdateConfig] = useState<AppUpdateConfig>(DEFAULT_APP_UPDATE_CONFIG);
  const [isAppUpdateOpen, setIsAppUpdateOpen] = useState<boolean>(false);

  useEffect(() => {
    setErrorUserContext(user);
  }, [user]);

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userHasAdminClaim, setUserHasAdminClaim] = useState<boolean>(false);

  const isVerifiedAdmin = Boolean(
    userHasAdminClaim ||
    (user && (user.role === 'admin' || checkIsAdminEmail(user.email)))
  );

  // Discreet URL query param (?admin=1 or #admin) and keyboard shortcut (Ctrl+Shift+A) for admin access in user panel mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkAdminTrigger = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        if (
          searchParams.get('admin') === '1' ||
          searchParams.get('admin') === 'true' ||
          searchParams.get('mode') === 'admin' ||
          hash === '#admin'
        ) {
          if (isVerifiedAdmin) {
            setIsAdminMode(true);
          }
        }
      } catch (_) {}
    };

    checkAdminTrigger();
    window.addEventListener('hashchange', checkAdminTrigger);

    const handleAdminKeyboardShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        if (isVerifiedAdmin) {
          e.preventDefault();
          setIsAdminMode(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleAdminKeyboardShortcut);

    return () => {
      window.removeEventListener('hashchange', checkAdminTrigger);
      window.removeEventListener('keydown', handleAdminKeyboardShortcut);
    };
  }, [isVerifiedAdmin]);

  // Firestore Persistence Helpers (Strict Single User Document Architecture)
  const persistUserBalance = async (userId: string, newBalance: number, newBonusBalance?: number, _userEmail?: string) => {
    try {
      if (!userId || userId === 'anonymous') return;
      const cleanBal = Math.max(0, Math.round(newBalance));
      const updateData: any = { 
        balance: cleanBal,
        updatedAt: new Date().toISOString()
      };
      if (typeof newBonusBalance === 'number') {
        updateData.bonusBalance = Math.max(0, Math.round(newBonusBalance));
      }

      // Update localStorage cached user immediately
      try {
        const storedUser = localStorage.getItem('betguru_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.balance = cleanBal;
          if (typeof updateData.bonusBalance === 'number') parsed.bonusBalance = updateData.bonusBalance;
          localStorage.setItem('betguru_user', JSON.stringify(parsed));
        }
      } catch (_) {}

      // Strictly update the single primary canonical user document in Firestore
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, cleanFirestoreData(updateData), { merge: true });

      // Clean up legacy alias document if one was previously created to ensure 0 duplicates
      const targetEmail = (_userEmail || user?.email || '').toLowerCase().trim();
      if (targetEmail) {
        const aliasUid = `user_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (aliasUid !== userId) {
          deleteDoc(doc(db, 'users', aliasUid)).catch(() => {});
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const persistTransaction = async (tx: WalletTransaction) => {
    try {
      const activeUid = tx.userId || user?.canonicalUid || user?.id || '';
      const cleanEmail = (tx.userEmail || user?.email || '').toLowerCase().trim();
      const uName = (tx as any).userName || user?.name || 'Player';
      const txRef = doc(db, 'transactions', tx.id);
      const sanitizedTx = cleanFirestoreData({
        ...tx,
        userId: activeUid || 'anonymous',
        userEmail: cleanEmail,
        userName: uName,
        createdAt: tx.createdAt || new Date().toISOString()
      });

      if (activeUid && activeUid !== 'anonymous') {
        try {
          const userKey = `betguru_transactions_${activeUid}`;
          const stored = localStorage.getItem(userKey);
          const list: WalletTransaction[] = stored ? JSON.parse(stored) : [];
          const updated = sortChronologicalNewestFirst([sanitizedTx as WalletTransaction, ...list.filter(t => t.id !== sanitizedTx.id)]);
          localStorage.setItem(userKey, JSON.stringify(updated.slice(0, 200)));
        } catch (_) {}
      }

      // ⚡ INSTANT 0-SEC ADMIN NOTIFICATION: Compute and dispatch push alert concurrently!
      const txType = (tx.type || '').toLowerCase();
      const txDesc = (tx.description || '').toLowerCase();
      const amt = Math.abs(tx.amount || 0);
      let notifType: 'deposit' | 'withdrawal' | 'ticket' | 'bet' | 'general' = 'general';
      let notifTitle = `💳 Player Transaction: ${tx.type || 'Activity'}`;

      if (txType.includes('dep') || txDesc.includes('deposit')) {
        notifType = 'deposit';
        notifTitle = '📥 Wallet Deposit';
      } else if (txType.includes('with') || txDesc.includes('withdraw')) {
        notifType = 'withdrawal';
        notifTitle = '📤 Wallet Withdrawal';
      } else if (txType.includes('ticket') || txDesc.includes('ticket') || txDesc.includes('draw')) {
        notifType = 'ticket';
        notifTitle = '🎟️ Ticket Purchased';
      } else if (txType.includes('bet') || txType.includes('roulette') || txType.includes('andar') || txType.includes('dragon') || txType.includes('crash') || txType.includes('aviator') || txDesc.includes('bet') || txDesc.includes('wager')) {
        notifType = 'bet';
        notifTitle = '🎲 Live Casino Wager';
      } else if (txType.includes('win') || txDesc.includes('win')) {
        notifType = 'bet';
        notifTitle = '🏆 Game Win Payout';
      } else if (txType.includes('bonus') || txDesc.includes('bonus') || txType.includes('wheel')) {
        notifType = 'general';
        notifTitle = '🎁 Reward / Bonus Claimed';
      }

      sendAdminNotification({
        type: notifType,
        title: notifTitle,
        description: `${uName}: ${tx.description || 'Transaction'} - ₹${amt.toLocaleString('en-IN')}`,
        amount: amt,
        userName: uName,
        userId: activeUid,
        status: tx.status || 'completed',
        customId: `notif_tx_${tx.id}`
      }).catch(() => {});

      await setDoc(txRef, sanitizedTx, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
    }
  };

  const persistDeposit = async (dep: DepositRequest) => {
    try {
      const depRef = doc(db, 'deposits', dep.id);
      // Ensure screenshotUrl base64 doesn't exceed Firestore document size limit (1MB)
      const screenshotFingerprint = dep.screenshotHash || (dep.screenshotUrl ? generateImageFingerprint(dep.screenshotUrl) : '');
      const uName = dep.userName || user?.name || 'Player';
      const activeUid = dep.userId || user?.canonicalUid || user?.id || '';
      const cleanEmail = ((dep as any).userEmail || user?.email || '').toLowerCase().trim();
      let sanitizedDep = cleanFirestoreData({ 
        ...dep,
        userId: activeUid || 'anonymous',
        userEmail: cleanEmail,
        userName: uName,
        screenshotHash: screenshotFingerprint,
        createdAt: dep.createdAt || new Date().toISOString()
      });
      if (sanitizedDep.screenshotUrl && sanitizedDep.screenshotUrl.length > 300000) {
        sanitizedDep.screenshotUrl = 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80';
      }

      // ⚡ INSTANT 0-SEC ADMIN NOTIFICATION: Dispatches push immediately!
      sendAdminNotification({
        type: 'deposit',
        title: dep.status === 'approved' ? '✅ Deposit Approved' : dep.status === 'rejected' ? '❌ Deposit Rejected' : '📥 New Deposit Request',
        description: `${uName} deposited ₹${(dep.amount || 0).toLocaleString('en-IN')} via ${dep.method || 'UPI'} (${dep.status || 'pending'})`,
        amount: dep.amount,
        userName: uName,
        userId: activeUid,
        status: dep.status || 'pending',
        customId: `notif_dep_${dep.id}`
      }).catch(() => {});

      await setDoc(depRef, sanitizedDep, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `deposits/${dep.id}`);
    }
  };

  const persistWithdrawal = async (wth: WithdrawalRequest) => {
    try {
      const wthRef = doc(db, 'withdrawals', wth.id);
      const uName = wth.fullName || (wth as any).userName || user?.name || 'Player';
      const activeUid = wth.userId || user?.canonicalUid || user?.id || '';
      const cleanEmail = ((wth as any).userEmail || user?.email || '').toLowerCase().trim();
      const sanitizedWth = cleanFirestoreData({
        ...wth,
        userId: activeUid || 'anonymous',
        userEmail: cleanEmail,
        fullName: uName,
        userName: uName,
        createdAt: wth.createdAt || new Date().toISOString()
      });

      // ⚡ INSTANT 0-SEC ADMIN NOTIFICATION: Dispatches push immediately!
      sendAdminNotification({
        type: 'withdrawal',
        title: wth.status === 'approved' ? '✅ Withdrawal Approved' : wth.status === 'rejected' ? '❌ Withdrawal Rejected' : '📤 New Withdrawal Request',
        description: `${uName} requested ₹${(wth.amount || 0).toLocaleString('en-IN')} withdrawal (${wth.status || 'pending'})`,
        amount: wth.amount,
        userName: uName,
        userId: activeUid,
        status: wth.status || 'pending',
        customId: `notif_wth_${wth.id}`
      }).catch(() => {});

      await setDoc(wthRef, sanitizedWth, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `withdrawals/${wth.id}`);
    }
  };

  const persistTicket = async (ticket: PurchasedTicket) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      const uName = (ticket as any).userName || user?.name || 'Player';
      const sanitizedTicket = cleanFirestoreData({
        ...ticket,
        userId: ticket.userId || user?.id || 'anonymous',
        userName: uName,
        createdAt: ticket.createdAt || new Date().toISOString()
      });
      // ⚡ INSTANT 0-SEC ADMIN NOTIFICATION: Dispatches push immediately!
      const isSuperCar = ticket.category === 'Three Super Car Draw';
      sendAdminNotification({
        type: 'ticket',
        title: isSuperCar ? '🏎️ SuperCar Ticket Purchased' : '🎟️ Lottery Ticket Purchased',
        description: `${uName} bought ticket #${ticket.ticketNumber || ticket.id.substring(0, 6)} for ₹${(ticket.price || 100).toLocaleString('en-IN')}`,
        amount: ticket.price,
        userName: uName,
        userId: ticket.userId || user?.id,
        status: ticket.status || 'active',
        customId: `notif_ticket_${ticket.id}`
      }).catch(() => {});

      await setDoc(ticketRef, sanitizedTicket, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tickets/${ticket.id}`);
    }
  };

  const persistNotification = async (ntf: NotificationItem) => {
    try {
      const activeUid = ntf.userId || user?.id || 'anonymous';
      const cleanEmail = (ntf.userEmail || user?.email || '').toLowerCase().trim();
      const ntfRef = doc(db, 'notifications', ntf.id);
      
      const nowMs = Date.now();
      const createdAtVal = ntf.createdAt ? (typeof ntf.createdAt === 'number' ? ntf.createdAt : new Date(ntf.createdAt).getTime()) : nowMs;
      const expiresAtVal = ntf.expiresAt || (createdAtVal + 24 * 60 * 60 * 1000); // 24 hours auto-expiry

      const sanitizedNtf = cleanFirestoreData({
        ...ntf,
        userId: activeUid,
        userEmail: cleanEmail,
        createdAt: createdAtVal,
        expiresAt: expiresAtVal
      });
      await setDoc(ntfRef, sanitizedNtf, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${ntf.id}`);
    }
  };

  // Helper to reset user history states to prevent cross-user cached data leakage
  const resetUserDataState = () => {
    setTransactions([]);
    setDeposits([]);
    setWithdrawals([]);
    setTickets([]);
    setNotifications([]);
  };

  // Initialize Firebase connection test & auth listener
  useEffect(() => {
    testConnection();
    autoCheckAndSeedFirestore();

    let unsubUser: (() => void) | null = null;
    let unsubAliasUser: (() => void) | null = null;
    let unsubTx: (() => void) | null = null;
    let unsubDeposits: (() => void) | null = null;
    let unsubWithdrawals: (() => void) | null = null;
    let unsubTickets: (() => void) | null = null;
    let unsubRoulette: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;
    let unsubBanner: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubUser) { try { unsubUser(); } catch (_) {} unsubUser = null; }
      if (unsubAliasUser) { try { unsubAliasUser(); } catch (_) {} unsubAliasUser = null; }
      if (unsubTx) { try { unsubTx(); } catch (_) {} unsubTx = null; }
      if (unsubDeposits) { try { unsubDeposits(); } catch (_) {} unsubDeposits = null; }
      if (unsubWithdrawals) { try { unsubWithdrawals(); } catch (_) {} unsubWithdrawals = null; }
      if (unsubTickets) { try { unsubTickets(); } catch (_) {} unsubTickets = null; }
      if (unsubRoulette) { try { unsubRoulette(); } catch (_) {} unsubRoulette = null; }
      if (unsubNotifications) { try { unsubNotifications(); } catch (_) {} unsubNotifications = null; }
      if (unsubBanner) { try { unsubBanner(); } catch (_) {} unsubBanner = null; }
    };

    const attachRealtimeUserListeners = (targetUser: User, isAdmin: boolean) => {
      cleanupListeners();
      resetUserDataState();

      const activeUid = targetUser.id || targetUser.canonicalUid || '';
      const cleanEmail = (targetUser.email || '').toLowerCase().trim();
      const fallbackUid = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const linkedDocIds = Array.isArray(targetUser.linkedDocIds) && targetUser.linkedDocIds.length > 0 
        ? targetUser.linkedDocIds 
        : [activeUid];

      // 1. Real-time user profile & balance listener directly on the single canonical user doc
      const userRef = doc(db, 'users', activeUid);

      unsubUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data() as User;
          const isAdminUser = Boolean(isAdmin && (checkIsAdminEmail(uData.email) || uData.role === 'admin'));
          if (!isAdminUser && (uData.status === 'suspended' || uData.status === 'blocked' || uData.isBlocked === true)) {
            // Instant real-time eviction if suspended by admin
            signOut(auth).catch(() => {});
            localStorage.removeItem('betguru_direct_user_session');
            setUser(null);
            setActiveTab('home');
            alert(`🚫 আপনার একাউন্টটি অ্যাডমিন দ্বারা ব্লক করা হয়েছে (${uData.blockReason || 'Account Suspended'})। কাস্টমার কেয়ারের সাথে যোগাযোগ করুন।`);
            return;
          }
          setUser((prev) => {
            if (!prev) return uData;
            // Never overwrite a custom avatar or legitimate real name with placeholders
            const isCustomImg = (url?: string) => {
              if (!url || typeof url !== 'string') return false;
              const trimmed = url.trim();
              return trimmed.length > 10 && !trimmed.includes('photo-1534528741775-53994a69daeb');
            };
            const safeAvatar = isCustomImg(uData.avatarUrl) ? uData.avatarUrl : (isCustomImg(prev.avatarUrl) ? prev.avatarUrl : (uData.avatarUrl || prev.avatarUrl));
            const safeName = (uData.name && uData.name !== 'BETGURU Player' && uData.name !== 'User') ? uData.name : (prev.name || uData.name);

            return {
              ...prev,
              ...uData,
              name: safeName,
              avatarUrl: safeAvatar,
              balance: typeof uData.balance === 'number' ? uData.balance : (prev?.balance ?? 0),
              bonusBalance: typeof uData.bonusBalance === 'number' ? uData.bonusBalance : (prev?.bonusBalance ?? 0)
            };
          });
        }
      }, (err) => console.warn('Real-time user snapshot notice:', err.message));

      // 2. Real-time User Personal Records query - strictly filtered for the active user's personal state
      const isCurrentUserAdmin = Boolean(isAdmin && (checkIsAdminEmail(cleanEmail) || targetUser.role === 'admin'));
      
      const isRecordForUser = (record: any) => {
        if (!record || !activeUid) return false;
        const recUserId = (record.userId || record.uid || record.user_id || record.userDocId || '').trim();
        const recEmail = (((record.userEmail || record.email || record.user_email || '') as string) || '').toLowerCase().trim();

        // 1. Strict Match on User Canonical UID / active UID / Linked Doc IDs / fallback UID
        if (recUserId && (
          recUserId === activeUid ||
          (targetUser.canonicalUid && recUserId === targetUser.canonicalUid) ||
          (Array.isArray(linkedDocIds) && linkedDocIds.includes(recUserId)) ||
          (fallbackUid && recUserId === fallbackUid)
        )) {
          return true;
        }

        // 2. Strict Match on Verified User Email (must have @ and match exactly)
        if (cleanEmail && cleanEmail.includes('@')) {
          if (recEmail && recEmail === cleanEmail) return true;
          if (recUserId && (recUserId === cleanEmail || recUserId === `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`)) return true;
        }

        // 3. User display code match
        const uCode = getUserDisplayCode(targetUser);
        if (uCode && (recUserId === uCode || (record.userCode && record.userCode === uCode))) {
          return true;
        }

        // 4. Linked Deposit / Withdrawal correlation
        if (record.depositId && deposits.some(d => d.id === record.depositId)) {
          return true;
        }
        if (record.withdrawalId && withdrawals.some(w => w.id === record.withdrawalId)) {
          return true;
        }
        if (record.id && record.id.startsWith('TXN-')) {
          const rawId = record.id.replace('TXN-', '');
          if (deposits.some(d => d.id === rawId) || withdrawals.some(w => w.id === rawId)) {
            return true;
          }
        }

        return false;
      };

      const qTx = query(collection(db, 'transactions'), limit(500));
      unsubTx = onSnapshot(qTx, (txSnap) => {
        if (!txSnap.empty) {
          const allTxs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WalletTransaction));
          const userFiltered = isCurrentUserAdmin ? allTxs : allTxs.filter(isRecordForUser);
          setTransactions(sortChronologicalNewestFirst(userFiltered));
        } else {
          setTransactions([]);
        }
      }, (err) => {
        console.warn('Real-time transactions snapshot notice:', err.message);
      });

      // 3. Real-time Deposit Requests query
      const qDeposits = query(collection(db, 'deposits'), limit(500));
      unsubDeposits = onSnapshot(qDeposits, (snap) => {
        if (!snap.empty) {
          const allDeps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest));
          const userFiltered = isCurrentUserAdmin ? allDeps : allDeps.filter(isRecordForUser);
          setDeposits(sortChronologicalNewestFirst(userFiltered));

          // Real-time status transition detection for regular logged-in users
          if (isInitialDepositsLoadRef.current) {
            isInitialDepositsLoadRef.current = false;
            userFiltered.forEach(dep => prevDepositStatusesRef.current.set(dep.id, dep.status));
          } else {
            userFiltered.forEach(dep => {
              const prevStatus = prevDepositStatusesRef.current.get(dep.id);
              if (prevStatus && prevStatus !== dep.status) {
                const activeUserName = targetUser?.name || user?.name || dep.userName || 'ইউজার';
                if (dep.status === 'approved') {
                  soundFx.speakUserTransactionVoice({
                    type: 'deposit_approved',
                    userName: activeUserName,
                    amount: dep.amount
                  });
                } else if (dep.status === 'rejected') {
                  soundFx.speakUserTransactionVoice({
                    type: 'deposit_rejected',
                    userName: activeUserName,
                    amount: dep.amount,
                    reason: dep.rejectReason
                  });
                }
              }
              prevDepositStatusesRef.current.set(dep.id, dep.status);
            });
          }
        } else {
          setDeposits([]);
        }
      }, (err) => {
        console.warn('Real-time deposits snapshot notice:', err.message);
      });

      // 4. Real-time Withdrawal Requests query
      const qWithdrawals = query(collection(db, 'withdrawals'), limit(500));
      unsubWithdrawals = onSnapshot(qWithdrawals, (snap) => {
        if (!snap.empty) {
          const allWths = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest));
          const userFiltered = isCurrentUserAdmin ? allWths : allWths.filter(isRecordForUser);
          setWithdrawals(sortChronologicalNewestFirst(userFiltered));

          // Real-time status transition detection for regular logged-in users
          if (isInitialWithdrawalsLoadRef.current) {
            isInitialWithdrawalsLoadRef.current = false;
            userFiltered.forEach(wth => prevWithdrawalStatusesRef.current.set(wth.id, wth.status));
          } else {
            userFiltered.forEach(wth => {
              const prevStatus = prevWithdrawalStatusesRef.current.get(wth.id);
              if (prevStatus && prevStatus !== wth.status) {
                const activeUserName = targetUser?.name || user?.name || wth.fullName || wth.userName || 'ইউজার';
                if (wth.status === 'approved') {
                  soundFx.speakUserTransactionVoice({
                    type: 'withdrawal_approved',
                    userName: activeUserName,
                    amount: wth.amount
                  });
                } else if (wth.status === 'rejected') {
                  soundFx.speakUserTransactionVoice({
                    type: 'withdrawal_rejected',
                    userName: activeUserName,
                    amount: wth.amount,
                    reason: wth.rejectReason
                  });
                }
              }
              prevWithdrawalStatusesRef.current.set(wth.id, wth.status);
            });
          }
        } else {
          setWithdrawals([]);
        }
      }, (err) => {
        console.warn('Real-time withdrawals snapshot notice:', err.message);
      });

      // 5. Real-time Lottery Tickets query - strictly personal for the active user
      const qTickets = query(collection(db, 'tickets'), limit(500));
      unsubTickets = onSnapshot(qTickets, (ticketSnap) => {
        if (!ticketSnap.empty) {
          const allTickets = ticketSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchasedTicket));
          const userFiltered = allTickets.filter(isRecordForUser);
          setTickets(sortChronologicalNewestFirst(userFiltered));
        } else {
          setTickets([]);
        }
      }, (err) => {
        console.warn('Real-time tickets snapshot notice:', err.message);
      });

      // 6. Real-time Notifications query (Strictly personal & authentic Admin global broadcasts)
      const qNotifications = query(collection(db, 'notifications'));
      unsubNotifications = onSnapshot(qNotifications, (ntfSnap) => {
        if (!ntfSnap.empty) {
          const allNtfs = ntfSnap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem));
          const nowMs = Date.now();
          const twentyFourHoursAgo = nowMs - 24 * 60 * 60 * 1000;

          // Retrieve user's permanently dismissed notification ID blacklist
          let deletedIds: string[] = [];
          if (activeUid) {
            try {
              const raw = localStorage.getItem(`betguru_deleted_ntfs_${activeUid}`);
              if (raw) deletedIds = JSON.parse(raw);
            } catch (_) {}
          }
          
          // User account registration timestamp (or 0 if not available)
          const userCreatedAt = targetUser.createdAt 
            ? (typeof targetUser.createdAt === 'number' ? targetUser.createdAt : new Date(targetUser.createdAt).getTime())
            : 0;

          const userCode = getUserDisplayCode(targetUser);

          // Strict User Isolation for all users (including admin account's personal bell drawer)
          const relevantNtfs = allNtfs.filter((n) => {
            // 1. Never show if permanently deleted/dismissed by active user
            if (deletedIds.includes(n.id)) return false;
            if (Array.isArray(n.deletedForUserIds) && activeUid && n.deletedForUserIds.includes(activeUid)) return false;

            // 2. Filter out stale notifications older than 48 hours
            const timeVal = n.createdAt ? (typeof n.createdAt === 'number' ? n.createdAt : new Date(n.createdAt).getTime()) : nowMs;
            const expVal = n.expiresAt || (timeVal + 48 * 60 * 60 * 1000);
            if (nowMs > expVal || timeVal < (nowMs - 48 * 60 * 60 * 1000)) return false;

            // 3. Never show admin backend internal queues in regular user-facing bell drawer
            const nUserId = (n.userId || (n as any).targetUserId || '').trim();
            const nTargetUserId = ((n as any).targetUserId || (n as any).canonicalUid || '').trim();
            const nEmail = ((n as any).userEmail || '').toLowerCase().trim();
            if ((nUserId === 'admin' || nUserId === 'anonymous' || (n as any).forAdmin === true) && !isCurrentUserAdmin) {
              return false;
            }

            // 4. Strict Personal Direct Match
            const isMatchPersonal = Boolean(
              (activeUid && (nUserId === activeUid || nTargetUserId === activeUid || (targetUser.canonicalUid && (nUserId === targetUser.canonicalUid || nTargetUserId === targetUser.canonicalUid)))) ||
              (targetUser.id && (nUserId === targetUser.id || nTargetUserId === targetUser.id)) ||
              (targetUser.linkedDocIds && Array.isArray(targetUser.linkedDocIds) && (targetUser.linkedDocIds.includes(nUserId) || targetUser.linkedDocIds.includes(nTargetUserId))) ||
              (cleanEmail && cleanEmail.includes('@') && (nEmail === cleanEmail || nUserId === cleanEmail || nTargetUserId === cleanEmail)) ||
              (userCode && (nUserId === userCode || nUserId === `#${userCode}` || nUserId.toLowerCase() === `#${userCode.toLowerCase()}` || nTargetUserId === userCode))
            );

            if (isMatchPersonal) {
              return true;
            }

            // If the notification has a specific user ID that is NOT for this user, strictly reject it!
            if (nUserId && nUserId !== 'ALL' && nUserId !== 'broadcast' && (n as any).isGlobal !== true) {
              return false;
            }

            // If explicitly marked as not global (isGlobal === false), reject if not personal match
            if ((n as any).isGlobal === false) {
              return false;
            }

            // 5. Global Broadcast Announcements (ONLY if explicitly global or addressed to 'ALL')
            const isGlobalBroadcast = nUserId === 'ALL' || nUserId === 'broadcast' || (n as any).isGlobal === true;
            if (isGlobalBroadcast) {
              // Allow broadcasts created within recent 24h for active users
              return true;
            }

            // Default: reject
            return false;
          });

          const sortedNtfs = sortChronologicalNewestFirst(relevantNtfs);
          setNotifications(sortedNtfs);

          // Real-time Push & Toast Alert Engine
          if (isInitialNtfLoadRef.current) {
            isInitialNtfLoadRef.current = false;
            relevantNtfs.forEach((n) => {
              seenToastNotificationIdsRef.current.add(n.id);
              spokenNotificationIdsRef.current.add(n.id);
            });

            // Show latest unread notification from last 10 minutes if available
            const freshUnread = sortedNtfs.find((n) => {
              const timeVal = n.createdAt ? (typeof n.createdAt === 'number' ? n.createdAt : new Date(n.createdAt).getTime()) : 0;
              return !n.read && (nowMs - timeVal < 10 * 60 * 1000);
            });
            if (freshUnread) {
              setRealtimeToast({
                title: freshUnread.title,
                message: freshUnread.message,
                priority: (freshUnread as any).priority || 'Announcement'
              });
            }
          } else {
            // Live updates: Detect ANY newly pushed notification
            relevantNtfs.forEach((n) => {
              if (!seenToastNotificationIdsRef.current.has(n.id)) {
                seenToastNotificationIdsRef.current.add(n.id);
                spokenNotificationIdsRef.current.add(n.id);

                // 1. Trigger animated on-screen Pop-up Toast
                setRealtimeToast({
                  title: n.title,
                  message: n.message,
                  priority: (n as any).priority || 'Announcement'
                });

                // 2. Play audible chime/fanfare
                try {
                  soundFx.playWinFanfare();
                } catch (_) {}

                // 3. Trigger device haptic vibration
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  try {
                    navigator.vibrate([250, 100, 250]);
                  } catch (_) {}
                }

                // 4. Trigger Web / System Tray Push Notification
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(n.title, {
                      body: n.message,
                      icon: '/favicon.ico',
                      tag: n.id
                    });
                  } catch (_) {}
                }

                // 5. Android Native Bridge integration
                if (typeof window !== 'undefined' && (window as any).AndroidBridge && (window as any).AndroidBridge.showToast) {
                  try {
                    (window as any).AndroidBridge.showToast(`${n.title}: ${n.message}`);
                  } catch (_) {}
                }

                // 6. Bengali TTS Voice for Transaction Alerts
                if (!isCurrentUserAdmin) {
                  const titleLower = (n.title || '').toLowerCase();
                  const msgLower = (n.message || '').toLowerCase();
                  const amtMatch = (n.title + ' ' + n.message).match(/₹([\d,]+)/);
                  const parsedAmt = amtMatch ? parseInt(amtMatch[1].replace(/,/g, ''), 10) : undefined;
                  const activeUserName = targetUser?.name || user?.name || 'ইউজার';

                  const isDepApproved = titleLower.includes('deposit approved') || (titleLower.includes('approved') && n.type === 'deposit') || titleLower.includes('ডিপোজিট সফল') || msgLower.includes('ডিপোজিট সফল') || titleLower.includes('ডিপোজিট অনুমোদিত');
                  const isDepRejected = titleLower.includes('deposit rejected') || (titleLower.includes('rejected') && n.type === 'deposit') || titleLower.includes('ডিপোজিট রিজেক্ট') || msgLower.includes('ডিপোজিট রিজেক্ট');
                  const isWthApproved = titleLower.includes('withdrawal approved') || (titleLower.includes('approved') && n.type === 'withdrawal') || titleLower.includes('উইথড্র সফল') || msgLower.includes('উইথড্র সফল') || titleLower.includes('উইথড্র অনুমোদিত') || titleLower.includes('উইথড্রয়াল সফল');
                  const isWthRejected = titleLower.includes('withdrawal rejected') || (titleLower.includes('rejected') && n.type === 'withdrawal') || titleLower.includes('উইথড্র রিজেক্ট') || msgLower.includes('উইথড্র রিজেক্ট');

                  if (isDepApproved) {
                    soundFx.speakUserTransactionVoice({
                      type: 'deposit_approved',
                      userName: activeUserName,
                      amount: parsedAmt
                    });
                  } else if (isDepRejected) {
                    soundFx.speakUserTransactionVoice({
                      type: 'deposit_rejected',
                      userName: activeUserName,
                      amount: parsedAmt,
                      reason: n.message
                    });
                  } else if (isWthApproved) {
                    soundFx.speakUserTransactionVoice({
                      type: 'withdrawal_approved',
                      userName: activeUserName,
                      amount: parsedAmt
                    });
                  } else if (isWthRejected) {
                    soundFx.speakUserTransactionVoice({
                      type: 'withdrawal_rejected',
                      userName: activeUserName,
                      amount: parsedAmt,
                      reason: n.message
                    });
                  }
                }
              }
            });
          }
        } else {
          setNotifications([]);
        }
      }, (err) => {
        console.warn('Real-time notifications snapshot notice:', err.message);
      });

      // 7. Real-time Active Broadcast Site Banner listener
      unsubBanner = onSnapshot(doc(db, 'system_settings', 'active_broadcast_banner'), (bSnap) => {
        if (bSnap.exists()) {
          const bData = bSnap.data();
          if (bData && bData.active) {
            setActiveBroadcastBanner({
              id: bData.id || bSnap.id,
              title: bData.title || 'Platform Announcement',
              message: bData.message || '',
              priority: bData.priority || 'Urgent'
            });
          } else {
            setActiveBroadcastBanner(null);
          }
        } else {
          setActiveBroadcastBanner(null);
        }
      }, (err) => console.warn('Active banner snapshot notice:', err.message));
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      cleanupListeners();

      if (fbUser) {
        setCurrentUser(fbUser);
        resetUserDataState();

        try {
          const cleanEmail = (fbUser.email || '').toLowerCase().trim();
          const isAdminEmail = checkIsAdminEmail(cleanEmail);
          
          let claimsAdmin = false;
          try {
            const tokenResult = await fbUser.getIdTokenResult();
            const claims = tokenResult.claims;
            const roleClaim = claims.role || (claims.admin ? 'admin' : claims.super_admin ? 'super_admin' : undefined);
            claimsAdmin = roleClaim === 'admin' || roleClaim === 'super_admin' || claims.admin === true || claims.super_admin === true || isAdminEmail;
          } catch (tokenErr) {
            console.warn('Error reading ID token custom claims:', tokenErr);
            claimsAdmin = isAdminEmail;
          }
          setUserHasAdminClaim(claimsAdmin);

          // Find & Resolve Canonical User document in Firestore by Email and UID with guaranteed balance preservation
          const { canonicalUid, userData: canonicalUserDoc } = await resolveCanonicalUserData(cleanEmail, fbUser.uid);

          const effectiveRole = claimsAdmin ? 'admin' : (canonicalUserDoc.role === 'admin' ? 'admin' : (isAdminEmail ? 'admin' : canonicalUserDoc.role));
          canonicalUserDoc.role = effectiveRole;
          if (effectiveRole === 'admin') {
            setUserHasAdminClaim(true);
          }

          if (fbUser.displayName && (!canonicalUserDoc.name || canonicalUserDoc.name === 'BETGURU Player')) {
            canonicalUserDoc.name = fbUser.displayName;
          }
          if (fbUser.photoURL && (!canonicalUserDoc.avatarUrl || canonicalUserDoc.avatarUrl.includes('photo-1534528741775'))) {
            canonicalUserDoc.avatarUrl = fbUser.photoURL;
          }

          setUser(canonicalUserDoc);

          // Sync Android Native FCM Token to user profile if available
          const cachedFcmToken = getStoredFcmToken();
          if (cachedFcmToken && canonicalUid) {
            saveTokenToUserDatabase(cachedFcmToken, canonicalUserDoc).catch(() => {});
          }

          // Track presence and trigger real-time admin login notification with loud chime
          trackUserPresence(canonicalUserDoc, 'Lobby', 'online').catch(() => {});
          if (canonicalUserDoc.role !== 'admin') {
            logLiveActivity({
              userId: canonicalUid,
              userName: canonicalUserDoc.name || 'Player',
              userEmail: canonicalUserDoc.email,
              userPhone: canonicalUserDoc.phone,
              type: 'login',
              details: `Player logged into user dashboard from ${window.innerWidth < 768 ? 'Mobile' : 'Desktop'}`
            }).catch(() => {});
          }

          // Background capture & sync real-time GPS / IP location audit
          captureAndSyncUserLocation(canonicalUserDoc, 'login').catch(() => {});

          if ((canonicalUserDoc as any).settings) {
            soundFx.setBgMusicEnabled((canonicalUserDoc as any).settings.bgMusicEnabled ?? true);
            soundFx.setSoundEffectsEnabled((canonicalUserDoc as any).settings.soundEffectsEnabled ?? true);
            soundFx.setHapticEnabled((canonicalUserDoc as any).settings.hapticEnabled ?? true);
          }

          const isAdmin = Boolean(claimsAdmin || effectiveRole === 'admin' || isAdminEmail);
          attachRealtimeUserListeners(canonicalUserDoc, isAdmin);
        } catch (e) {
          console.error('Error syncing user with Firestore:', e);
        }
      } else {
        const directSession = localStorage.getItem('betguru_direct_user_session');
        if (directSession) {
          try {
            const parsed = JSON.parse(directSession);
            if (parsed && (parsed.uid || parsed.email)) {
              resetUserDataState();
              const cleanEmail = (parsed.email || '').toLowerCase().trim();
              const { canonicalUid, userData: canonicalUserDoc } = await resolveCanonicalUserData(cleanEmail, parsed.uid);
              const isAdminEmail = checkIsAdminEmail(cleanEmail) || canonicalUserDoc.role === 'admin';
              
              if (isAdminEmail) canonicalUserDoc.role = 'admin';
              setUser(canonicalUserDoc);
              trackUserPresence(canonicalUserDoc, 'Lobby', 'online').catch(() => {});
              if (!isAdminEmail) {
                logLiveActivity({
                  userId: canonicalUid,
                  userName: canonicalUserDoc.name || 'Player',
                  userEmail: canonicalUserDoc.email,
                  userPhone: canonicalUserDoc.phone,
                  type: 'login',
                  details: `Player logged into user dashboard from direct session`
                }).catch(() => {});
              }
              captureAndSyncUserLocation(canonicalUserDoc, 'login').catch(() => {});
              setCurrentUser({ uid: canonicalUid, email: canonicalUserDoc.email, displayName: canonicalUserDoc.name } as any);
              setUserHasAdminClaim(isAdminEmail);

              attachRealtimeUserListeners(canonicalUserDoc, isAdminEmail);
            }
          } catch (e) {
            console.warn('Error reading direct user session:', e);
          }
        } else {
          setCurrentUser(null);
          setUser(null as any);
          resetUserDataState();
        }
      }
      setAuthLoading(false);
    });

    const handleDirectAuthChanged = async () => {
      if (!auth.currentUser) {
        const directSession = localStorage.getItem('betguru_direct_user_session');
        if (directSession) {
          try {
            const parsed = JSON.parse(directSession);
            if (parsed && (parsed.uid || parsed.email)) {
              resetUserDataState();
              const cleanEmail = (parsed.email || '').toLowerCase().trim();
              const { canonicalUid, userData: canonicalUserDoc } = await resolveCanonicalUserData(cleanEmail, parsed.uid);
              const isAdminEmail = checkIsAdminEmail(cleanEmail) || canonicalUserDoc.role === 'admin';
              
              if (isAdminEmail) canonicalUserDoc.role = 'admin';
              setUser(canonicalUserDoc);
              trackUserPresence(canonicalUserDoc, 'Lobby', 'online').catch(() => {});
              if (!isAdminEmail) {
                logLiveActivity({
                  userId: canonicalUid,
                  userName: canonicalUserDoc.name || 'Player',
                  userEmail: canonicalUserDoc.email,
                  userPhone: canonicalUserDoc.phone,
                  type: 'login',
                  details: `Player logged into user dashboard from direct session`
                }).catch(() => {});
              }
              captureAndSyncUserLocation(canonicalUserDoc, 'login').catch(() => {});
              setCurrentUser({ uid: canonicalUid, email: canonicalUserDoc.email, displayName: canonicalUserDoc.name } as any);
              setUserHasAdminClaim(isAdminEmail);
              attachRealtimeUserListeners(canonicalUserDoc, isAdminEmail);
            }
          } catch (e) {
            console.warn('Direct auth changed listener notice:', e);
          }
        } else {
          setCurrentUser(null);
          setUser(null as any);
          resetUserDataState();
        }
      }
    };

    window.addEventListener('betguru_direct_auth_changed', handleDirectAuthChanged);

    // Zero-second instant transaction ingestion handler (optimistic & instant promo code redemptions)
    const handleNewTransactionEvent = (e: Event) => {
      const customEvt = e as CustomEvent<WalletTransaction>;
      if (customEvt.detail && customEvt.detail.id) {
        const newTx = customEvt.detail;
        setTransactions((prev) => {
          if (prev.some((t) => t.id === newTx.id)) return prev;
          return [newTx, ...prev];
        });
      }
    };
    window.addEventListener('betguru:new_transaction', handleNewTransactionEvent);

    return () => {
      cleanupListeners();
      unsubscribeAuth();
      window.removeEventListener('betguru_direct_auth_changed', handleDirectAuthChanged);
      window.removeEventListener('betguru:new_transaction', handleNewTransactionEvent);
    };
  }, []);

  // Initialize Android Native Bridge & FCM Token Handlers
  useEffect(() => {
    const cleanupBridge = setupAndroidBridge({
      getCurrentUser: () => user,
      onTokenReceived: (fcmToken) => {
        console.log('📱 Android Native FCM Token Connected:', fcmToken);
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            fcmToken,
            isNativeApp: true,
            fcmUpdatedAt: new Date().toISOString(),
            platform: 'android'
          };
        });
      },
      onNotificationReceived: (ntf) => {
        if (ntf.title || ntf.body) {
          setRealtimeToast({
            title: ntf.title || '🔔 BETGURU Alert',
            message: ntf.body || '',
            priority: 'high'
          });
        }
      },
      onRouteRequested: (actionType) => {
        soundFx.playClick();
        setIsNotificationsOpen(false);
        setRealtimeToast(null);

        switch (actionType) {
          case 'deposit':
            setIsDepositOpen(true);
            break;
          case 'withdrawal':
            setActiveTab('withdrawal');
            break;
          case 'supercar':
            if (isSuperCarEnabled) {
              setIsSuperCarOpen(true);
            } else {
              setActiveTab('home');
            }
            break;
          case 'crash':
            setIsCrashGameOpen(true);
            break;
          case 'roulette':
            setIsLiveRouletteOpen(true);
            break;
          case 'dragon_tiger':
            setIsDragonTigerOpen(true);
            break;
          case 'andar_bahar':
            setIsAndarBaharOpen(true);
            break;
          case 'lucky_wheel':
            setIsLuckyWheelOpen(true);
            break;
          case 'lottery':
            setActiveTab('lottery');
            break;
          case 'tickets':
            setActiveTab('tickets');
            break;
          case 'results':
            setActiveTab('results');
            break;
          case 'offers':
            setActiveTab('offers');
            break;
          case 'support':
            setIsSupportChatOpen(true);
            break;
          case 'history':
            setActiveTab('history');
            break;
          case 'profile':
            setActiveTab('profile');
            break;
          case 'settings':
            setActiveTab('settings');
            break;
          default:
            setActiveTab('home');
            break;
        }
      }
    });

    return () => {
      cleanupBridge();
    };
  }, [user?.id]);

  // Initialize PWA Background Push Notifications & Service Worker (0-second latency alerts)
  useEffect(() => {
    const isUserAdmin = Boolean(
      userHasAdminClaim ||
      (user && (user.role === 'admin' || checkIsAdminEmail(user.email)))
    );
    const activeUid = user?.canonicalUid || user?.id || (isUserAdmin ? 'admin' : undefined);

    initPWANotifications(activeUid, isUserAdmin).catch((err) => {
      console.info('PWA push background init notice:', err);
    });
  }, [user?.id, user?.canonicalUid, user?.role, user?.email, userHasAdminClaim]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem('betguru_direct_user_session');
      localStorage.removeItem('betguru_user');
      localStorage.removeItem('betguru_deposits');
      localStorage.removeItem('betguru_withdrawals');
      localStorage.removeItem('betguru_tickets');
      localStorage.removeItem('betguru_transactions');
      localStorage.removeItem('betguru_notifications');
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('SignOut non-blocking error:', err);
      }
      setCurrentUser(null);
      setUser(null as any);
      setUserHasAdminClaim(false);
      setIsAdminMode(false);
      setIsDepositOpen(false);
      setIsWithdrawOpen(false);
      setIsNotificationsOpen(false);
      setActiveTab('lottery');
      setAuthLoading(false);
      resetUserDataState();
      window.dispatchEvent(new Event('betguru_direct_auth_changed'));
    } catch (e) {
      console.error('Error signing out:', e);
      setCurrentUser(null);
      setUser(null as any);
      setAuthLoading(false);
    }
  };

  // Banner Sliders Listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'banner_sliders'), (snap) => {
      const list: BannerSlide[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as BannerSlide);
      });
      list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      setBannerSlides(list);
      try {
        localStorage.setItem('bg_banner_slides_cache', JSON.stringify(list));
      } catch (_) {}
    }, (err) => console.warn('Banner sliders snapshot notice:', err.message));
    return () => unsub();
  }, []);

  // Promotional Offers Listener (Real-time synced from Admin AI Offers Manager)
  useEffect(() => {
    const unsubOffers = onSnapshot(collection(db, 'promotional_offers'), (snap) => {
      if (!snap.empty) {
        const list: PromotionalOffer[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as PromotionalOffer);
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPromotionalOffers(list);
      } else {
        setPromotionalOffers(DEFAULT_PROMOTIONAL_OFFERS);
      }
    }, (err) => console.warn('Promotional offers snapshot notice:', err.message));
    return () => unsubOffers();
  }, []);

  // Game Maintenance & Switchboard Real-time State
  const [gameStatuses, setGameStatuses] = useState<AllGameStatuses>(() => {
    try {
      const cached = localStorage.getItem('bg_game_controls_cache');
      if (cached) {
        return { ...DEFAULT_GAME_STATUSES, ...JSON.parse(cached) };
      }
    } catch (_) {}
    return DEFAULT_GAME_STATUSES;
  });

  // Listen to game_controls configuration in Firestore
  useEffect(() => {
    const unsubGameControls = onSnapshot(doc(db, 'system_config', 'game_controls'), (snap) => {
      if (snap.exists()) {
        const remoteControls = snap.data() as Partial<AllGameStatuses>;
        setGameStatuses((prev) => {
          const merged: AllGameStatuses = { ...DEFAULT_GAME_STATUSES, ...prev };
          Object.keys(DEFAULT_GAME_STATUSES).forEach((k) => {
            if (remoteControls[k]) {
              merged[k] = { ...DEFAULT_GAME_STATUSES[k], ...remoteControls[k] };
            }
          });
          try {
            localStorage.setItem('bg_game_controls_cache', JSON.stringify(merged));
          } catch (_) {}
          return merged;
        });
      }
    }, (err) => console.warn('Game controls snapshot notice:', err.message));

    return () => unsubGameControls();
  }, []);

  const isCrashEnabled = gameStatuses?.crash?.isEnabled !== false;
  const isAndarBaharEnabled = gameStatuses?.andar_bahar?.isEnabled !== false;
  const isRouletteEnabled = gameStatuses?.roulette?.isEnabled !== false;
  const isDragonTigerEnabled = gameStatuses?.dragon_tiger?.isEnabled !== false;
  const isSuperCarEnabled = (supercarConfig?.enabled === undefined || supercarConfig.enabled === true || String(supercarConfig.enabled).toLowerCase() === 'true') && (gameStatuses?.supercar?.isEnabled !== false);
  const isLuckyWheelEnabled = gameStatuses?.lucky_wheel?.isEnabled !== false;
  const isLotteryBumperEnabled = gameStatuses?.lottery_bumper?.isEnabled !== false;
  const isLotterySpeedEnabled = gameStatuses?.lottery_speed?.isEnabled !== false;
  const isLotteryMegaEnabled = gameStatuses?.lottery_mega?.isEnabled !== false;
  const isLottery4dEnabled = gameStatuses?.lottery_4d?.isEnabled !== false;

  const anyLiveCasinoEnabled = isCrashEnabled || isAndarBaharEnabled || isRouletteEnabled || isDragonTigerEnabled;

  // Auto-close active modals if disabled by admin while open
  useEffect(() => {
    if (isCrashGameOpen && !isCrashEnabled) {
      setIsCrashGameOpen(false);
      alert(gameStatuses.crash?.maintenanceMessage || 'Aviator Crash is temporarily under maintenance.');
    }
  }, [isCrashGameOpen, isCrashEnabled, gameStatuses.crash?.maintenanceMessage]);

  useEffect(() => {
    if (isAndarBaharOpen && !isAndarBaharEnabled) {
      setIsAndarBaharOpen(false);
      alert(gameStatuses.andar_bahar?.maintenanceMessage || 'Andar Bahar is currently under maintenance.');
    }
  }, [isAndarBaharOpen, isAndarBaharEnabled, gameStatuses.andar_bahar?.maintenanceMessage]);

  useEffect(() => {
    if (isLiveRouletteOpen && !isRouletteEnabled) {
      setIsLiveRouletteOpen(false);
      alert(gameStatuses.roulette?.maintenanceMessage || 'Lightning Roulette is currently under maintenance.');
    }
  }, [isLiveRouletteOpen, isRouletteEnabled, gameStatuses.roulette?.maintenanceMessage]);

  useEffect(() => {
    if (isDragonTigerOpen && !isDragonTigerEnabled) {
      setIsDragonTigerOpen(false);
      alert(gameStatuses.dragon_tiger?.maintenanceMessage || 'Dragon Tiger Live is currently under maintenance.');
    }
  }, [isDragonTigerOpen, isDragonTigerEnabled, gameStatuses.dragon_tiger?.maintenanceMessage]);

  useEffect(() => {
    if (isLuckyWheelOpen && !isLuckyWheelEnabled) {
      setIsLuckyWheelOpen(false);
      alert(gameStatuses.lucky_wheel?.maintenanceMessage || 'Lucky Wheel is currently under maintenance.');
    }
  }, [isLuckyWheelOpen, isLuckyWheelEnabled, gameStatuses.lucky_wheel?.maintenanceMessage]);

  const handleBannerSliderAction = (actionType: string, targetUrl?: string) => {
    if (actionType === 'deposit') {
      setIsDepositOpen(true);
    } else if (actionType === 'supercar') {
      if (isSuperCarEnabled) {
        setIsSuperCarOpen(true);
      } else {
        alert(gameStatuses.supercar?.maintenanceMessage || 'Three Super Car is currently under maintenance.');
      }
    } else if (actionType === 'lottery') {
      setActiveTab('lottery');
    } else if (actionType === 'wheel') {
      if (isLuckyWheelEnabled) {
        setIsLuckyWheelOpen(true);
      } else {
        alert(gameStatuses.lucky_wheel?.maintenanceMessage || 'Lucky Wheel is currently under maintenance.');
      }
    } else if (actionType === 'roulette') {
      if (isRouletteEnabled) {
        setIsLiveRouletteOpen(true);
      } else {
        alert(gameStatuses.roulette?.maintenanceMessage || 'Live Roulette is currently under maintenance.');
      }
    } else if (actionType === 'andar_bahar') {
      if (isAndarBaharEnabled) {
        setIsAndarBaharOpen(true);
      } else {
        alert(gameStatuses.andar_bahar?.maintenanceMessage || 'Andar Bahar is currently under maintenance.');
      }
    } else if (actionType === 'dragon_tiger' || actionType === 'dragontiger') {
      if (isDragonTigerEnabled) {
        setIsDragonTigerOpen(true);
      } else {
        alert(gameStatuses.dragon_tiger?.maintenanceMessage || 'Dragon Tiger Live is currently under maintenance.');
      }
    } else if (actionType === 'crash' || actionType === 'aviator') {
      if (isCrashEnabled) {
        setIsCrashGameOpen(true);
      } else {
        alert(gameStatuses.crash?.maintenanceMessage || 'Aviator Crash is currently under maintenance.');
      }
    } else if (actionType === 'withdrawal') {
      setActiveTab('withdrawal');
    } else if (actionType === 'custom_url' && targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    saveState({ user, draws, deposits, withdrawals, tickets, transactions, notifications });
  }, [user, draws, deposits, withdrawals, tickets, transactions, notifications]);

  // Real-time Active User Presence Heartbeat (Zero latency tracking for Admin Radar & Analytics)
  useEffect(() => {
    if (!user || !user.id || user.id === 'anonymous') return;

    const determineCurrentContext = (): string => {
      if (isCrashGameOpen) return 'Spribe Aviator Crash';
      if (isAndarBaharOpen) return 'Super Andar Bahar';
      if (isLiveRouletteOpen) return 'Lightning Roulette';
      if (isDragonTigerOpen) return 'Dragon Tiger Live';
      if (isSuperCarOpen) return '3 Super Car Live Arena';
      if (isLuckyWheelOpen) return 'Lucky Spin Wheel';
      if (activeTab === 'lottery') return 'Lottery Draws';
      if (activeTab === 'tickets') return 'My Tickets';
      if (activeTab === 'results') return 'Draw Results';
      if (activeTab === 'profile') return 'User Profile';
      if (activeTab === 'withdrawal') return 'Withdrawal';
      if (activeTab === 'offers') return 'Promotions & Offers';
      return 'Lobby / SuperCar';
    };

    const currentContext = determineCurrentContext();
    trackUserPresence(user, currentContext, 'online').catch(() => {});

    const heartbeatInterval = setInterval(() => {
      trackUserPresence(user, determineCurrentContext(), 'online').catch(() => {});
    }, 25000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        trackUserPresence(user, determineCurrentContext(), 'online').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    user?.id,
    user?.balance,
    activeTab,
    isCrashGameOpen,
    isAndarBaharOpen,
    isLiveRouletteOpen,
    isDragonTigerOpen,
    isLuckyWheelOpen
  ]);

  // Scroll to top when switching navigation tabs to ensure clean transition
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // SuperCar Config, Draws & Bonus Rules Real-time Listeners
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'supercar_config', 'main'), (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data();
        console.log('[App.tsx] Real-time supercar_config updated from Firestore:', remoteData);
        setSupercarConfig((prev) => ({ ...prev, ...remoteData }));
      }
    }, (err) => console.warn('Supercar config listener notice:', err.message));

    const unsubBonusRules = onSnapshot(doc(db, 'system_settings', 'bonus_rules'), (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as Partial<BonusBalanceRules>;
        console.log('[App.tsx] Real-time bonus_rules updated from Firestore:', remoteData);
        setBonusRules((prev) => ({
          ...prev,
          ...remoteData,
          allowSuperCar: remoteData.allowSuperCar !== undefined ? remoteData.allowSuperCar : true
        }));
      }
    }, (err) => console.warn('Bonus rules listener notice:', err.message));

    // App Update Remote Configuration Listener
    const unsubAppUpdate = onSnapshot(doc(db, 'system_settings', 'app_update'), (snap) => {
      if (snap.exists()) {
        const updateData = snap.data() as AppUpdateConfig;
        setAppUpdateConfig((prev) => ({ ...prev, ...updateData }));

        // Check if an update is required
        if (updateData && updateData.enabled !== false && updateData.versionName) {
          const currentClientVer = getNativeAppVersion();
          if (isVersionNewer(updateData.versionName, currentClientVer)) {
            // Check if dismissed in this session (unless force update)
            const dismissedKey = `dismissed_update_${updateData.versionName}`;
            const isDismissed = sessionStorage.getItem(dismissedKey) === 'true';
            if (!isDismissed || updateData.forceUpdate) {
              setIsAppUpdateOpen(true);
            }
          }
        }
      }
    }, (err) => console.warn('App update listener notice:', err.message));

    // Custom Event Listener for dynamic app update triggers (Bridge, Push, or Console)
    const handleTriggerUpdateEvent = (e: any) => {
      const detail = e.detail || {};
      if (detail.apkUrl || detail.versionName) {
        setAppUpdateConfig((prev) => ({
          ...prev,
          apkUrl: detail.apkUrl || prev.apkUrl,
          versionName: detail.versionName || prev.versionName,
          changelog: detail.changelog || prev.changelog,
          forceUpdate: detail.forceUpdate !== undefined ? Boolean(detail.forceUpdate) : prev.forceUpdate
        }));
      }
      setIsAppUpdateOpen(true);
    };

    window.addEventListener('betguru_trigger_app_update', handleTriggerUpdateEvent);

    const qSuperCar = query(collection(db, 'supercar_draws'), limit(1000));
    const unsubDraws = onSnapshot(qSuperCar, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => d.data() as SuperCarDrawIssue);
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) return timeB - timeA;
          return (b.issueId || '').localeCompare(a.issueId || '');
        });
        setSupercarPastDraws(list);
        try {
          localStorage.setItem('betguru_supercar_draws', JSON.stringify(list));
        } catch (_) {}
      } else {
        setSupercarPastDraws([]);
      }
    }, (err) => console.warn('Supercar draws listener notice:', err.message));

    const qLotteryDraws = query(collection(db, 'draws'), limit(50));
    const unsubLotteryDraws = onSnapshot(qLotteryDraws, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDraw));
        // If any of the 4 default draws is missing, auto-seed it to ensure all 4 are always present
        const existingIds = new Set(list.map(d => d.id));
        const missing = INITIAL_DRAWS.filter(d => !existingIds.has(d.id));
        if (missing.length > 0) {
          missing.forEach(mDraw => {
            setDoc(doc(db, 'draws', mDraw.id), mDraw, { merge: true }).catch(() => {});
          });
        }
        setDraws(list.length >= 4 ? list : [...list, ...missing]);
      } else {
        INITIAL_DRAWS.forEach((initDraw) => {
          setDoc(doc(db, 'draws', initDraw.id), initDraw, { merge: true }).catch(() => {});
        });
        setDraws(INITIAL_DRAWS);
      }
    }, (err) => console.warn('Lottery draws listener notice:', err.message));

    const qResults = query(collection(db, 'draw_results'), limit(100));
    const unsubResults = onSnapshot(qResults, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDrawResult));
        list.sort((a, b) => {
          const tA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.date || 0).getTime();
          const tB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.date || 0).getTime();
          return tB - tA;
        });
        setLotteryResults(list);
      } else {
        INITIAL_DRAW_RESULTS.forEach(r => {
          setDoc(doc(db, 'draw_results', r.id), r, { merge: true }).catch(() => {});
        });
        setLotteryResults(INITIAL_DRAW_RESULTS);
      }
    }, (err) => console.warn('Lottery results listener notice:', err.message));

    return () => {
      unsubConfig();
      unsubBonusRules();
      unsubAppUpdate();
      window.removeEventListener('betguru_trigger_app_update', handleTriggerUpdateEvent);
      unsubDraws();
      unsubLotteryDraws();
      unsubResults();
    };
  }, []);

  // ⚡ Authoritative App Lifecycle & Background Resume Wallet Synchronization Engine
  // Automatically reconciles balance, deposits, and withdrawals whenever the app:
  // 1. First loads / authenticates
  // 2. Returns from background / sleep mode (document.visibilitychange === 'visible')
  // 3. Receives window focus / pageshow / network online event
  // 4. Receives native Android bridge resume event or push notification click
  // 5. Receives service worker background push message (BETGURU_SYNC_WALLET)
  const isSyncingWalletRef = useRef(false);
  const lastWalletSyncTimeRef = useRef<number>(0);

  const triggerAuthoritativeWalletSync = useCallback(async (reason: string = 'manual') => {
    if (!user || !user.id || isVerifiedAdmin) return;
    const now = Date.now();
    if (isSyncingWalletRef.current) return;
    if (now - lastWalletSyncTimeRef.current < 2000 && reason !== 'push' && reason !== 'app_resume' && reason !== 'visibility_visible') return;

    isSyncingWalletRef.current = true;
    lastWalletSyncTimeRef.current = now;

    try {
      const activeUid = user.canonicalUid || user.id;
      const syncResult = await syncUserWalletAuthoritative({
        userId: activeUid,
        userEmail: user.email,
        userCode: user.userCode
      });

      if (syncResult && syncResult.success) {
        setUser((prev) => {
          if (!prev) return prev;
          // Protect user balance from ever decreasing automatically during background sync
          // Balances only decrease when the user wagers in a game or an admin alters it directly in Firestore
          const resolvedBalance = typeof syncResult.balance === 'number' 
            ? Math.max(prev.balance, syncResult.balance)
            : prev.balance;
          const resolvedBonus = typeof syncResult.bonusBalance === 'number'
            ? Math.max(prev.bonusBalance ?? 0, syncResult.bonusBalance)
            : prev.bonusBalance;
          const resolvedSpin = typeof syncResult.spinCredits === 'number'
            ? Math.max(prev.spinCredits ?? 0, syncResult.spinCredits)
            : prev.spinCredits;

          const balanceChanged = resolvedBalance !== prev.balance;
          const spinChanged = resolvedSpin !== prev.spinCredits;
          const bonusChanged = resolvedBonus !== prev.bonusBalance;

          if (balanceChanged || spinChanged || bonusChanged || (syncResult.creditedDepositIds && syncResult.creditedDepositIds.length > (prev.creditedDepositIds?.length || 0))) {
            return {
              ...prev,
              balance: resolvedBalance,
              bonusBalance: resolvedBonus,
              spinCredits: resolvedSpin,
              creditedDepositIds: syncResult.creditedDepositIds || prev.creditedDepositIds,
              refundedWithdrawalIds: syncResult.refundedWithdrawalIds || prev.refundedWithdrawalIds,
            };
          }
          return prev;
        });

        // Voice announcement and audio celebration if new deposits were approved while app was asleep/closed
        if ((syncResult.newlyCreditedCount && syncResult.newlyCreditedCount > 0) || (syncResult.newlyCreditedAmount && syncResult.newlyCreditedAmount > 0)) {
          soundFx.speakUserTransactionVoice({
            type: 'deposit_approved',
            userName: user.name || 'Player',
            amount: syncResult.newlyCreditedAmount || 0
          });
          soundFx.playCoin();
        } else if (syncResult.newlyRefundedCount && syncResult.newlyRefundedCount > 0) {
          soundFx.speakUserTransactionVoice({
            type: 'withdrawal_rejected',
            userName: user.name || 'Player',
            amount: syncResult.newlyRefundedAmount || 0,
            reason: 'Refunded to wallet balance'
          });
        }
      }
    } catch (err) {
      console.warn('⚠️ triggerAuthoritativeWalletSync notice:', err);
    } finally {
      isSyncingWalletRef.current = false;
    }
  }, [user?.id, user?.canonicalUid, user?.email, user?.userCode, user?.name, isVerifiedAdmin]);

  useEffect(() => {
    if (!user || !user.id || isVerifiedAdmin) return;

    // 1. Initial wallet sync on mount / user login
    triggerAuthoritativeWalletSync('initial_mount');

    // 2. Browser Visibility & Window Focus handlers (wakes up from phone screen off / app switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerAuthoritativeWalletSync('visibility_visible');
      }
    };

    const handleWindowFocus = () => {
      triggerAuthoritativeWalletSync('window_focus');
    };

    const handlePageShow = () => {
      triggerAuthoritativeWalletSync('pageshow');
    };

    const handleOnline = () => {
      triggerAuthoritativeWalletSync('network_online');
    };

    // 3. Custom Android bridge / Push event handlers
    const handleSyncRequest = (event: any) => {
      const reason = event?.detail?.reason || 'push_or_bridge';
      triggerAuthoritativeWalletSync(reason);
    };

    const handleAppResumed = () => {
      triggerAuthoritativeWalletSync('app_resume');
    };

    // 4. Service Worker background notification message
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'BETGURU_SYNC_WALLET' || event.data.action === 'sync_wallet')) {
        triggerAuthoritativeWalletSync('sw_message');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);
    window.addEventListener('betguru_sync_wallet_request', handleSyncRequest);
    window.addEventListener('betguru_app_resumed', handleAppResumed);

    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Periodic background sync interval (every 30 seconds as safeguard)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerAuthoritativeWalletSync('periodic_interval');
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('betguru_sync_wallet_request', handleSyncRequest);
      window.removeEventListener('betguru_app_resumed', handleAppResumed);
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      clearInterval(intervalId);
    };
  }, [user?.id, user?.canonicalUid, triggerAuthoritativeWalletSync, isVerifiedAdmin]);

  // Filter visible lottery draws based on admin game control statuses
  const visibleDraws = React.useMemo(() => {
    return draws.filter((d) => {
      if (d.id === 'draw-bumper-101' && !isLotteryBumperEnabled) return false;
      if (d.id === 'draw-speed-777' && !isLotterySpeedEnabled) return false;
      if (d.id === 'draw-mega-crore' && !isLotteryMegaEnabled) return false;
      if (d.id === 'draw-4d-pick' && !isLottery4dEnabled) return false;
      return true;
    });
  }, [draws, isLotteryBumperEnabled, isLotterySpeedEnabled, isLotteryMegaEnabled, isLottery4dEnabled]);

  // Forced debug log of supercarConfig upon mount/update to verify Red car image URL
  useEffect(() => {
    const redCarInfo = getSuperCarInfo('red', supercarConfig);
    console.log('[App.tsx] Mount/Update supercarConfig state:', supercarConfig);
    console.log('[App.tsx] supercarConfig.enabled raw:', supercarConfig?.enabled, 'parsed isSuperCarEnabled:', isSuperCarEnabled);
    console.log('[App.tsx] Red Car Image URL:', redCarInfo.image);
    console.log('[App.tsx] Red Car Full Details:', redCarInfo);
  }, [supercarConfig, isSuperCarEnabled]);

  // SuperCar Ticket Purchase Handler (Supports Main Wallet and Bonus Wallet)
  const handleConfirmSuperCarTicketBuy = async (
    carColor: SuperCarColor,
    quantity: number,
    totalCost: number,
    issueId?: string,
    slotNum?: number,
    walletType: 'main' | 'bonus' = 'main'
  ) => {
    const currentUserId = user?.id || 'anonymous';
    const currentBalance = user?.balance || 0;
    const currentBonusBalance = user?.bonusBalance || 0;

    // 30-Second Cutoff Check
    const currentSched = getCurrentSuperCarSchedule(supercarConfig);
    if (currentSched.isBettingClosed && (!slotNum || slotNum === currentSched.drawIndex)) {
      alert('বেটিং সময় সমাপ্ত! ড্র সম্পন্ন হওয়ার ৩০ সেকেন্ড পূর্বে বেটিং বন্ধ থাকে। অনুগ্রহ করে পরবর্তী রাউন্ডের জন্য অপেক্ষা করুন।');
      return;
    }

    // Determine target slot and issue for opposite betting validation
    const targetSlot = slotNum || currentSched.drawIndex;
    const targetIssueId = issueId || currentSched.issueId;

    // Opposite bet restriction check for Three Super Car (Red vs Black prohibited, Yellow allowed with either)
    const existingSlotTickets = tickets.filter(t => 
      t.category === 'Three Super Car Draw' &&
      t.userId === currentUserId &&
      (
        (targetIssueId && (t.drawId === targetIssueId || t.issueId === targetIssueId)) ||
        (targetSlot && (t.slotNumber === targetSlot || t.slotNum === targetSlot || (t as any).slot === targetSlot))
      )
    );

    const hasBoughtRed = existingSlotTickets.some(t => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'red';
    });

    const hasBoughtBlack = existingSlotTickets.some(t => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'black';
    });

    if (carColor === 'black' && hasBoughtRed) {
      alert('⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে লাল (Red) গাড়িতে টিকিট কেটেছেন। একই রাউন্ডে লাল ও কালো একসাথে কেনা যাবে না (হলুদের সাথে কেনা যাবে)।');
      return;
    }

    if (carColor === 'red' && hasBoughtBlack) {
      alert('⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে কালো (Black) গাড়িতে টিকিট কেটেছেন। একই রাউন্ডে কালো ও লাল একসাথে কেনা যাবে না (হলুদের সাথে কেনা যাবে)।');
      return;
    }

    // User can strictly only buy Super Car tickets using Bonus Balance
    const effectiveWalletType: 'main' | 'bonus' = (supercarConfig.bonusOnly !== false) ? 'bonus' : walletType;

    logAnalyticsEvent('ticket_buy', { category: 'Three Super Car Draw', carColor, quantity, totalCost, walletType: effectiveWalletType }, currentUserId, user?.email);

    // Validate Bonus Balance Permissions
    if (effectiveWalletType === 'bonus') {
      if (currentBonusBalance < totalCost) {
        alert(`অপর্যাপ্ত বোনাস ব্যালেন্স! সুপার কার ড্র টিকিট শুধুমাত্র বোনাস ব্যালেন্স দিয়ে কেনা যাবে। আপনার বোনাস ব্যালেন্স: ₹${currentBonusBalance.toFixed(2)}, প্রয়োজন: ₹${totalCost}।`);
        return;
      }
    } else {
      if (currentBalance < totalCost) {
        alert(`Insufficient Wallet Balance! Required ₹${totalCost}, Available ₹${currentBalance.toFixed(2)}. Please deposit funds.`);
        setIsDepositOpen(true);
        return;
      }
    }

    const earnedVipPts = Math.floor(totalCost / 10);
    const updatedVipPts = (user?.vipPoints || 0) + earnedVipPts;

    let newBal = currentBalance;
    let newBonusBal = currentBonusBalance;

    if (effectiveWalletType === 'bonus') {
      newBonusBal = Math.max(0, currentBonusBalance - totalCost);
      setUser((prev) => ({
        ...prev,
        bonusBalance: newBonusBal,
        vipPoints: updatedVipPts
      }));
      if (user?.id) {
        persistUserBalance(user.id, currentBalance, newBonusBal, user.email);
        recordUserWager(user.id, totalCost, 'bonus').then((res) => {
          if (res.success) {
            setUser((prev) => prev ? ({ ...prev, bonusWagerCompleted: res.newBonusCompleted }) : prev);
          }
        }).catch((e) => console.warn('Wager recording error in SuperCar bonus ticket buy:', e));
      }
    } else {
      newBal = Math.max(0, currentBalance - totalCost);
      setUser((prev) => ({
        ...prev,
        balance: newBal,
        vipPoints: updatedVipPts
      }));
      if (user?.id) {
        persistUserBalance(user.id, newBal, currentBonusBalance, user.email);
        recordUserWager(user.id, totalCost, 'main').then((res) => {
          if (res.success) {
            setUser((prev) => prev ? ({ ...prev, mainWagerCompleted: res.newMainCompleted }) : prev);
          }
        }).catch((e) => console.warn('Wager recording error in SuperCar main ticket buy:', e));
      }
    }

    const now = new Date();
    const isoDateStr = now.toISOString();
    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const todayDashDate = `${year}-${monthStr}-${dayStr}`;

    let activeSlot = slotNum;
    let activeIssueId = issueId;

    if (!activeSlot || !activeIssueId) {
      const sched = getCurrentSuperCarSchedule(supercarConfig);
      activeSlot = sched.drawIndex;
      activeIssueId = sched.issueId;
    }

    // Calculate slot time label (08:00 AM + (activeSlot - 1)*10 mins)
    const startMins = 8 * 60 + (activeSlot - 1) * 10;
    const h = Math.floor(startMins / 60);
    const m = startMins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    const slotTimeLabel = `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

    const exactTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const batchId = `BATCH-SC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTickets: PurchasedTicket[] = [];
    const pricePerTicket = quantity > 0 ? Math.round(totalCost / quantity) : (supercarConfig.ticketPrice || 100);

    for (let i = 0; i < quantity; i++) {
      const ticketNum = `CAR-${carColor.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const newTicket: PurchasedTicket = {
        id: `TKT-SC-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        batchId: batchId,
        userId: currentUserId,
        drawId: activeIssueId,
        drawTitle: `3 Super Car Draw - ${carColor.toUpperCase()} CAR (Slot #${String(activeSlot).padStart(2, '0')} - ${slotTimeLabel})`,
        category: 'Three Super Car Draw',
        selectedNumbers: [carColor.toUpperCase()],
        ticketNumber: ticketNum,
        price: pricePerTicket,
        purchaseDate: todayDashDate,
        purchaseTime: exactTimeStr,
        drawTime: slotTimeLabel,
        drawDate: todayDashDate,
        createdAt: isoDateStr,
        status: 'active',
        selectedCar: carColor.toLowerCase() as SuperCarColor,
        slotNum: activeSlot,
        walletType: effectiveWalletType
      };
      newTickets.push(newTicket);
    }

    setTickets((prev) => sortChronologicalNewestFirst([...newTickets, ...prev]));
    newTickets.forEach((t) => persistTicket(t));

    const tx: WalletTransaction = {
      id: `TXN-SUPERCAR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: currentUserId,
      type: 'ticket_buy',
      amount: -totalCost,
      walletType: effectiveWalletType,
      description: `Purchased ${quantity}x ${carColor.toUpperCase()} Super Car Ticket(s) (from ${effectiveWalletType === 'bonus' ? 'Bonus' : 'Main'} Wallet) (+${earnedVipPts} VIP Pts)`,
      status: 'completed',
      date: isoDateStr,
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([tx, ...prev]));
    persistTransaction(tx);

    // Dispatch real-time persistent Admin Notification for Bell Icon
    sendAdminNotification({
      type: 'ticket',
      title: '🏎️ 3 Super Car Ticket Purchased',
      description: `${user?.name || 'Player'} bought ${quantity}x ${carColor.toUpperCase()} Super Car Ticket(s) for ₹${totalCost.toLocaleString('en-IN')}`,
      amount: totalCost,
      userName: user?.name || 'Player',
      userId: currentUserId,
      status: 'completed',
      customId: `notif_${batchId}`
    }).catch(() => {});

    triggerConfetti();
  };

  // SuperCar Draw Resolved Handler
  const handleSuperCarDrawResolved = async (issueId: string, winningCar: SuperCarColor) => {
    soundFx.playWinFanfare();
    triggerConfetti();

    let totalWonMainAmount = 0;
    let totalWonBonusAmount = 0;
    const multiplier = supercarConfig.prizeMultiplier || 2.8;

    const updatedTickets = tickets.map((t) => {
      if (t.category === 'Three Super Car Draw' && t.status === 'active') {
        const slotInfo = getSlotFromTicket(t, supercarConfig);
        const matchesDraw =
          t.drawId === issueId ||
          slotInfo.issueId === issueId ||
          (t.drawTitle && t.drawTitle.includes(issueId));

        if (matchesDraw) {
          const tCar = (t.selectedCar || t.selectedNumbers?.[0] as string || 'red').toLowerCase();
          if (tCar === winningCar.toLowerCase()) {
            const winAmt = Math.round(t.price * multiplier);
            if (t.walletType === 'bonus') {
              totalWonBonusAmount += winAmt;
            } else {
              totalWonMainAmount += winAmt;
            }
            const updatedT = { ...t, status: 'win' as const, winAmount: winAmt, drawId: issueId };
            persistTicket(updatedT);
            return updatedT;
          } else {
            const updatedT = { ...t, status: 'loss' as const, drawId: issueId };
            persistTicket(updatedT);
            return updatedT;
          }
        }
      }
      return t;
    });

    setTickets(sortChronologicalNewestFirst(updatedTickets));

    if (totalWonMainAmount > 0 || totalWonBonusAmount > 0) {
      setUser((prev) => {
        if (!prev) return prev;
        const newBal = (prev.balance || 0) + totalWonMainAmount;
        const newBonusBal = (prev.bonusBalance || 0) + totalWonBonusAmount;
        if (prev.id) persistUserBalance(prev.id, newBal, newBonusBal, prev.email);
        return {
          ...prev,
          balance: newBal,
          bonusBalance: newBonusBal,
          totalWon: (prev.totalWon || 0) + totalWonMainAmount + totalWonBonusAmount
        };
      });

      if (totalWonMainAmount > 0) {
        const winMainTx: WalletTransaction = {
          id: `TXN-SC-WIN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: user?.id || 'anonymous',
          type: 'ticket_win',
          amount: totalWonMainAmount,
          walletType: 'main',
          description: `🏆 WON Super Car Draw Jackpot (${winningCar.toUpperCase()} Car Winner!) - Added to Main Wallet`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        };
        setTransactions((prev) => sortChronologicalNewestFirst([winMainTx, ...prev]));
        persistTransaction(winMainTx);
      }

      if (totalWonBonusAmount > 0) {
        const winBonusTx: WalletTransaction = {
          id: `TXN-SC-BONUS-WIN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: user?.id || 'anonymous',
          type: 'ticket_win',
          amount: totalWonBonusAmount,
          walletType: 'bonus',
          description: `🏆 WON Super Car Draw (${winningCar.toUpperCase()} Car Winner!) - Added to Bonus Wallet`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        };
        setTransactions((prev) => sortChronologicalNewestFirst([winBonusTx, ...prev]));
        persistTransaction(winBonusTx);
      }

      // Trigger Grand 8K Big Win Celebration Modal
      const totalWon = totalWonMainAmount + totalWonBonusAmount;
      const carInfo = getSuperCarInfo(winningCar, supercarConfig);
      setBigWinData({
        id: `supercar-win-${Date.now()}-${issueId}`,
        category: 'supercar',
        title: 'সুপার কার গ্র্যান্ড চ্যাম্পিয়ন!',
        subtitle: `SUPER CAR DRAW (#${issueId}) WINNER`,
        amount: totalWon,
        multiplier: `${multiplier}x`,
        drawOrRoundId: issueId,
        carColor: winningCar,
        carName: carInfo.name,
        carImage: carInfo.image,
        walletType: totalWonBonusAmount > 0 && totalWonMainAmount === 0 ? 'bonus' : 'main'
      });
    }

    const drawIssueDoc: SuperCarDrawIssue = {
      id: issueId,
      issueId,
      drawTime: new Date().toLocaleString('en-IN'),
      createdAt: Date.now(),
      winningCar,
      status: 'completed'
    };

    // Optimistically update local past draws immediately
    setSupercarPastDraws((prev) => {
      const filtered = prev.filter((d) => d.issueId !== issueId);
      const nextList = [drawIssueDoc, ...filtered];
      try {
        localStorage.setItem('betguru_supercar_draws', JSON.stringify(nextList));
      } catch (_) {}
      return nextList;
    });

    try {
      await setDoc(doc(db, 'supercar_draws', issueId), cleanFirestoreData(drawIssueDoc), { merge: true });
    } catch (err) {
      console.warn('Supercar draw result cloud sync notice:', err);
      handleFirestoreError(err, OperationType.WRITE, `supercar_draws/${issueId}`);
    }
  };

  // Continuous Auto-Settlement Engine for Expired Super Car Tickets
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;

    const interval = setInterval(() => {
      const activeSuperCarTickets = tickets.filter(
        (t) => t.category === 'Three Super Car Draw' && t.status === 'active'
      );

      if (activeSuperCarTickets.length === 0) return;

      const nowMs = Date.now();
      let totalNewWonMainAmount = 0;
      let totalNewWonBonusAmount = 0;
      let lastWonCar: SuperCarColor = 'black';
      let hasSettled = false;

      const updated = tickets.map((t) => {
        if (t.category === 'Three Super Car Draw' && t.status === 'active') {
          const slotInfo = getSlotFromTicket(t, supercarConfig);
          // Has draw timer expired for this slot?
          if (nowMs >= slotInfo.drawEndTimeMs) {
            hasSettled = true;
            const winningCar = getWinningCarForSlot(
              slotInfo.slotNum,
              slotInfo.issueId,
              supercarPastDraws,
              supercarConfig
            );

            const playerCar = (t.selectedCar || t.selectedNumbers?.[0] || 'red')
              .toString()
              .toLowerCase() as SuperCarColor;

            const isWinner = playerCar === winningCar.toLowerCase();

            if (isWinner) {
              const multiplier = supercarConfig.prizeMultiplier || 2.8;
              const winAmt = Math.round(t.price * multiplier);
              if (t.walletType === 'bonus') {
                totalNewWonBonusAmount += winAmt;
              } else {
                totalNewWonMainAmount += winAmt;
              }
              lastWonCar = winningCar;

              const updatedT: PurchasedTicket = {
                ...t,
                status: 'win' as const,
                wonAmount: winAmt,
                slotNum: slotInfo.slotNum,
                drawId: slotInfo.issueId
              };
              persistTicket(updatedT);
              return updatedT;
            } else {
              const updatedT: PurchasedTicket = {
                ...t,
                status: 'loss' as const,
                slotNum: slotInfo.slotNum,
                drawId: slotInfo.issueId
              };
              persistTicket(updatedT);
              return updatedT;
            }
          }
        }
        return t;
      });

      if (hasSettled) {
        setTickets(sortChronologicalNewestFirst(updated));

        if (totalNewWonMainAmount > 0 || totalNewWonBonusAmount > 0) {
          setUser((prev) => {
            if (!prev) return prev;
            const newBal = (prev.balance || 0) + totalNewWonMainAmount;
            const newBonusBal = (prev.bonusBalance || 0) + totalNewWonBonusAmount;
            if (prev.id) persistUserBalance(prev.id, newBal, newBonusBal, prev.email);
            return {
              ...prev,
              balance: newBal,
              bonusBalance: newBonusBal,
              totalWon: (prev.totalWon || 0) + totalNewWonMainAmount + totalNewWonBonusAmount
            };
          });

          if (totalNewWonMainAmount > 0) {
            const winTx: WalletTransaction = {
              id: `TXN-SC-WIN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              userId: user?.id || 'anonymous',
              type: 'ticket_win',
              amount: totalNewWonMainAmount,
              walletType: 'main',
              description: `🏆 Auto Payout: WON Super Car Draw (${lastWonCar.toUpperCase()} Winner!) - Credited to Main Wallet`,
              status: 'completed',
              date: new Date().toLocaleString('en-IN'),
              createdAt: new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([winTx, ...prev]));
            persistTransaction(winTx);
          }

          if (totalNewWonBonusAmount > 0) {
            const bonusWinTx: WalletTransaction = {
              id: `TXN-SC-BONUS-WIN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              userId: user?.id || 'anonymous',
              type: 'ticket_win',
              amount: totalNewWonBonusAmount,
              walletType: 'bonus',
              description: `🏆 Auto Payout: WON Super Car Draw (${lastWonCar.toUpperCase()} Winner!) - Credited to Bonus Wallet`,
              status: 'completed',
              date: new Date().toLocaleString('en-IN'),
              createdAt: new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([bonusWinTx, ...prev]));
            persistTransaction(bonusWinTx);
          }

          // Trigger Grand 8K Big Win Celebration Modal
          const totalWon = totalNewWonMainAmount + totalNewWonBonusAmount;
          const carInfo = getSuperCarInfo(lastWonCar, supercarConfig);
          setBigWinData({
            id: `supercar-auto-win-${Date.now()}`,
            category: 'supercar',
            title: 'সুপার কার গ্র্যান্ড চ্যাম্পিয়ন!',
            subtitle: `SUPER CAR DRAW WINNER`,
            amount: totalWon,
            multiplier: `${supercarConfig.prizeMultiplier || 2.8}x`,
            carColor: lastWonCar,
            carName: carInfo.name,
            carImage: carInfo.image,
            walletType: totalNewWonBonusAmount > 0 && totalNewWonMainAmount === 0 ? 'bonus' : 'main'
          });

          try {
            soundFx.playWinFanfare();
            triggerConfetti();
          } catch (_) {}
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [tickets, supercarPastDraws, supercarConfig, user?.id]);

  // Audio mute toggle
  const handleToggleMute = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
  };

  // Automated Draw Resolution Timer Check (Runs every 10 sec)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let hasUpdates = false;

      const updatedDraws = draws.map((draw) => {
        if (draw.endTime <= now) {
          hasUpdates = true;
          // Generate winning numbers if not already set
          const digitLen = draw.category === '4D Express' ? 4 : 6;
          const winningDigits = draw.winningNumbers || Array.from({ length: digitLen }, () => Math.floor(Math.random() * 10));

          // Evaluate player tickets for this draw
          tickets.forEach((t) => {
            if (t.drawId === draw.id && t.status === 'active') {
              const selectedStr = (t.selectedNumbers || (t as any).numbers || []).join('');
              const winStr = (winningDigits || []).join('');
              const isWin = selectedStr === winStr;
              const status = isWin ? 'win' : 'loss';
              const wonAmount = isWin ? draw.firstPrize : 0;

              t.status = status;
              t.wonAmount = wonAmount;

              if (isWin) {
                const isBonusWallet = t.walletType === 'bonus';
                // Auto add funds to user wallet (Main vs Bonus according to purchase source)
                setUser((prev) => {
                  if (!prev) return prev;
                  const currentBal = prev.balance || 0;
                  const currentBonus = prev.bonusBalance || 0;
                  const newBal = isBonusWallet ? currentBal : currentBal + wonAmount;
                  const newBonus = isBonusWallet ? currentBonus + wonAmount : currentBonus;
                  if (prev.id) persistUserBalance(prev.id, newBal, newBonus, prev.email);
                  return {
                    ...prev,
                    balance: newBal,
                    bonusBalance: newBonus,
                    totalWon: (prev.totalWon || 0) + wonAmount
                  };
                });

                const currentUserId = user?.id || 'anonymous';

                // Add win transaction
                const winTx: WalletTransaction = {
                  id: `TXN-WIN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                  userId: currentUserId,
                  type: 'win_payout',
                  amount: wonAmount,
                  walletType: isBonusWallet ? 'bonus' : 'main',
                  description: `Jackpot Win! ${draw.title} (${isBonusWallet ? 'Credited to Bonus Wallet' : 'Credited to Main Wallet'})`,
                  status: 'completed',
                  date: new Date().toLocaleString('en-IN'),
                  createdAt: new Date().toISOString()
                };
                setTransactions((prev) => [winTx, ...prev]);
                persistTransaction(winTx);

                // Add notification
                const winNtf: NotificationItem = {
                  id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                  userId: currentUserId,
                  title: `🎉 JACKPOT WINNER! You Won ₹${wonAmount.toLocaleString('en-IN')}`,
                  message: `Your ticket for ${draw.title} matched all numbers (${winningDigits.join(' ')})! Credited to ${isBonusWallet ? 'Bonus' : 'Main'} Wallet.`,
                  type: 'win',
                  date: 'Just now',
                  read: false
                };
                setNotifications((prev) => [winNtf, ...prev]);
                triggerConfetti();

                // Trigger Grand 8K Big Win Celebration Modal
                setBigWinData({
                  id: `lottery-win-${Date.now()}-${t.id}`,
                  category: 'lottery',
                  title: 'লটারি জ্যাকপট বিজয়ী!',
                  subtitle: `${draw.title.toUpperCase()} JACKPOT`,
                  amount: wonAmount,
                  drawOrRoundId: draw.id,
                  ticketNumber: t.ticketNumber,
                  winningNumbers: winningDigits,
                  walletType: isBonusWallet ? 'bonus' : 'main'
                });
              }
            }
          });

          // Reset draw countdown for next round
          return {
            ...draw,
            endTime: now + draw.drawDurationMs,
            winningNumbers: winningDigits,
            totalTicketsSold: Math.floor(Math.random() * 200) + 100
          };
        }
        return draw;
      });

      if (hasUpdates) {
        setDraws(updatedDraws);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [draws, tickets, user?.id]);

  // Auto-dismiss floating toast alert after 7 seconds
  useEffect(() => {
    if (!realtimeToast) return;
    const toastTimer = setTimeout(() => {
      setRealtimeToast(null);
    }, 7000);
    return () => clearTimeout(toastTimer);
  }, [realtimeToast]);

  // Handle Deposit Submission (Supporting Fiat UPI & Crypto & Promo Codes)
  const handleDepositSubmit = (
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
  ) => {
    if (user) {
      logAnalyticsEvent('deposit_attempt', { amount, method, utr, cryptoAmount, cryptoCurrency, category, promoCode, promoBonusAmount }, user.id, user.email);
    }

    const screenshotFingerprint = screenshotUrl ? generateImageFingerprint(screenshotUrl) : '';

    const userCanonicalUid = user?.canonicalUid || user?.id || '';
    const userCleanEmail = (user?.email || '').toLowerCase().trim();

    const newDep: DepositRequest = {
      id: `DEP-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: userCanonicalUid || user?.id || 'anonymous',
      userEmail: userCleanEmail,
      userCode: user?.userCode || '',
      userName: user?.name || 'User',
      userPhone: user?.phone || '',
      amount,
      cryptoAmount,
      cryptoCurrency,
      category: category || (cryptoAmount ? 'crypto' : 'fiat'),
      method,
      utr,
      screenshotUrl,
      screenshotHash: screenshotFingerprint,
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString(),
      status: 'pending',
      promoCode: promoCode ? promoCode.trim().toUpperCase() : undefined,
      promoBonusAmount: promoBonusAmount && promoBonusAmount > 0 ? promoBonusAmount : undefined,
      promoTargetWallet: promoTargetWallet,
      promoPercentage: promoPercentage
    };

    setDeposits((prev) => sortChronologicalNewestFirst([newDep, ...prev]));
    persistDeposit(newDep);

    // Create & persist pending deposit transaction for Wallet Ledger
    const depTx: WalletTransaction = {
      id: `TXN-${newDep.id}`,
      userId: userCanonicalUid || user?.id || 'anonymous',
      userEmail: userCleanEmail,
      userName: user?.name || 'Player',
      userPhone: user?.phone || '',
      type: 'deposit',
      amount,
      utr,
      depositId: newDep.id,
      status: 'pending',
      description: cryptoAmount
        ? `Crypto Deposit (${cryptoAmount} ${cryptoCurrency || 'USDT'}) via ${(method || 'CRYPTO').toString().toUpperCase()} (TXID: ${utr})`
        : `Deposit Request via ${(method || 'UPI').toString().toUpperCase()} (UTR: ${utr})`,
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([depTx, ...prev.filter(t => t.id !== depTx.id)]));
    persistTransaction(depTx);

    // Send real-time persistent Admin Notification for Bell Icon
    sendAdminNotification({
      type: 'deposit',
      title: '📥 New Deposit Request',
      description: `${user?.name || 'Player'} deposited ₹${amount.toLocaleString('en-IN')} via ${(method || 'UPI').toString().toUpperCase()} (UTR: ${utr})`,
      amount,
      userName: user?.name || 'Player',
      userId: user?.id,
      status: 'pending',
      customId: `notif_${newDep.id}`
    }).catch(() => {});

    // Send real-time SMTP Email notification
    if (user?.email) {
      notifyDepositSubmitted(user.email, user.name || 'User', amount, method, utr).catch((err) =>
        console.warn('Deposit submission email error:', err)
      );
    }

    // Add user notification
    const depNtf: NotificationItem = {
      id: `NTF-${Date.now()}`,
      userId: userCanonicalUid || user?.id || 'anonymous',
      userEmail: userCleanEmail,
      title: '⏳ Deposit Submitted under Verification',
      message: cryptoAmount
        ? `Your crypto deposit of ${cryptoAmount} ${cryptoCurrency || 'USDT'} (₹${amount}) via ${(method || 'CRYPTO').toString().toUpperCase()} (TXID: ${utr}) is under verification.`
        : `Your deposit request of ₹${amount} via ${(method || 'UPI').toString().toUpperCase()} (UTR: ${utr}) is under verification.`,
      type: 'deposit',
      date: 'Just now',
      read: false
    };
    spokenNotificationIdsRef.current.add(depNtf.id);
    setNotifications((prev) => [depNtf, ...prev]);
    persistNotification(depNtf);

    // Loud Personalized Bengali Voice: "Rahul, your deposit is pending verification."
    soundFx.speakUserTransactionVoice({
      type: 'deposit_pending',
      userName: user?.name,
      amount
    });
  };

  // Handle Admin Approve Deposit
  const handleAdminApproveDeposit = async (depositId: string) => {
    let dep = deposits.find((d) => d.id === depositId);
    if (!dep) {
      try {
        const snap = await getDoc(doc(db, 'deposits', depositId));
        if (snap.exists()) {
          dep = { id: snap.id, ...snap.data() } as DepositRequest;
        }
      } catch (e) {
        console.warn('Direct deposit lookup error:', e);
      }
    }
    if (!dep || dep.status !== 'pending') return;

    const updatedDep: DepositRequest = { ...dep, status: 'approved' };
    setDeposits((prev) =>
      prev.map((d) => (d.id === depositId ? updatedDep : d))
    );
    await persistDeposit(updatedDep);

    const spinsEarned = dep.amount >= 1000 ? Math.floor(dep.amount / 1000) : 0;

    // Promo bonus calculations from deposit request
    const promoBonusAmount = (dep as any).promoBonusAmount || 0;
    const promoTargetWallet: 'main' | 'bonus' = (dep as any).promoTargetWallet === 'main' ? 'main' : 'bonus';
    const promoCode = (dep as any).promoCode;

    // Amount to credit to main balance vs bonus balance
    const mainCreditAmount = promoTargetWallet === 'main' ? (dep.amount + promoBonusAmount) : dep.amount;
    const bonusCreditAmount = promoTargetWallet === 'bonus' ? promoBonusAmount : 0;

    // Credit the target user's real balance in Firestore (updates ALL candidate user documents)
    const creditRes = await findAndCreditUserInFirestore({
      userId: dep.userId,
      userEmail: (dep as any).userEmail,
      userCode: (dep as any).userCode,
      userName: dep.userName,
      amount: mainCreditAmount,
      bonusAmount: bonusCreditAmount,
      spinCreditBonus: spinsEarned,
      depositId: dep.id
    });

    const targetUid = creditRes.canonicalUid || dep.userId;
    const targetEmail = creditRes.targetEmail || (dep as any).userEmail || '';
    const targetName = creditRes.targetName || dep.userName || 'Player';

    // Record promo code redemption in Firestore if promo was applied
    if (promoCode && promoBonusAmount > 0) {
      recordDepositPromoRedemption({
        promoCode,
        depositId: dep.id,
        depositAmount: dep.amount,
        bonusAmount: promoBonusAmount,
        targetWallet: promoTargetWallet,
        userId: targetUid,
        userEmail: targetEmail,
        userName: targetName
      }).catch((err) => console.warn('Record deposit promo redemption error:', err));
    }

    // Dispatch real-time email notification
    if (targetEmail) {
      notifyDepositApproved(targetEmail, targetName, dep.amount).catch((err) =>
        console.warn('Deposit approved email error:', err)
      );
    }

    // Only update local `user` state if the admin is approving their own deposit
    if (user?.id === targetUid || (user?.email && targetEmail && user.email.toLowerCase().trim() === targetEmail.toLowerCase().trim())) {
      setUser((prev) => prev ? ({
        ...prev,
        balance: creditRes.newBalance,
        bonusBalance: creditRes.newBonusBalance !== undefined ? creditRes.newBonusBalance : prev.bonusBalance,
        spinCredits: creditRes.newSpinCredits
      }) : prev);
    }

    // Add/Update approved transaction & persist to Firestore with target user's credentials (NOT admin credentials)
    const depTx: WalletTransaction = {
      id: `TXN-${dep.id}`,
      userId: targetUid,
      userEmail: targetEmail,
      userName: targetName,
      depositId: dep.id,
      utr: dep.utr,
      type: 'deposit',
      amount: dep.amount,
      description: promoCode && promoBonusAmount > 0
        ? `Approved Deposit via ${(dep.method || 'UPI').toString().toUpperCase()} (UTR: ${dep.utr}) + Promo [${promoCode}: +₹${promoBonusAmount} ${promoTargetWallet === 'main' ? 'Main' : 'Bonus'}]`
        : `Approved Deposit via ${(dep.method || 'UPI').toString().toUpperCase()} (UTR: ${dep.utr})`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: dep.createdAt || new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([depTx, ...prev.filter(t => t.id !== depTx.id)]));
    persistTransaction(depTx);

    // Send Notification to target user
    const approveNtf: NotificationItem = {
      id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: targetUid,
      userEmail: targetEmail,
      title: promoCode && promoBonusAmount > 0 
        ? `✅ Deposit Approved (₹${dep.amount}) + ₹${promoBonusAmount} Promo Bonus!`
        : `✅ Deposit Approved (₹${dep.amount})`,
      message: promoCode && promoBonusAmount > 0
        ? `Your deposit of ₹${dep.amount} has been verified and added to your wallet, along with +₹${promoBonusAmount} promo bonus [${promoCode}] credited to your ${promoTargetWallet === 'main' ? 'Main' : 'Bonus'} balance!`
        : `Your deposit of ₹${dep.amount} has been verified and added to your wallet!`,
      type: 'deposit',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [approveNtf, ...prev]);
    persistNotification(approveNtf);

    // Dispatch real-time Android push notification to target user via resilient safeApiPost
    safeApiPost('/api/send-user-push', {
      userId: targetUid,
      userEmail: targetEmail,
      title: `✅ Deposit Approved: ₹${dep.amount.toLocaleString('en-IN')}`,
      message: `আপনার ₹${dep.amount.toLocaleString('en-IN')} ডিপোজিট সফলভাবে ভেরিফাই হয়েছে এবং ওয়ালেটে যুক্ত করা হয়েছে।`,
      body: `আপনার ₹${dep.amount.toLocaleString('en-IN')} ডিপোজিট সফলভাবে ভেরিফাই হয়েছে এবং ওয়ালেটে যুক্ত করা হয়েছে।`,
      type: 'deposit',
      targetUrl: '/'
    }).catch((err) => console.warn('Deposit approval FCM push notice:', err));

    // Process referral program bonus: if referee met qualifying deposit amount, reward referrer!
    processReferralOnDepositApproval(updatedDep).catch((refErr) => {
      console.warn('Referral bonus processing on deposit approval error:', refErr);
    });

    triggerConfetti();
  };

  // Handle Admin Reject Deposit
  const handleAdminRejectDeposit = async (depositId: string, reason: string) => {
    let dep = deposits.find((d) => d.id === depositId);
    if (!dep) {
      try {
        const snap = await getDoc(doc(db, 'deposits', depositId));
        if (snap.exists()) {
          dep = { id: snap.id, ...snap.data() } as DepositRequest;
        }
      } catch (e) {
        console.warn('Direct deposit lookup error:', e);
      }
    }
    if (dep) {
      const updatedDep: DepositRequest = { ...dep, status: 'rejected', rejectReason: reason };
      setDeposits((prev) =>
        prev.map((d) => (d.id === depositId ? updatedDep : d))
      );
      await persistDeposit(updatedDep);

      const targetRes = await findAndCreditUserInFirestore({
        userId: dep.userId,
        userEmail: (dep as any).userEmail,
        userCode: (dep as any).userCode,
        userName: dep.userName,
        amount: 0
      });
      const targetUid = targetRes.canonicalUid || dep.userId;
      const targetEmail = targetRes.targetEmail || (dep as any).userEmail || '';
      const targetName = targetRes.targetName || dep.userName || 'Player';

      if (targetEmail) {
        notifyDepositRejected(targetEmail, targetName, dep.amount, reason).catch((err) =>
          console.warn('Deposit rejected email error:', err)
        );
      }

      const rejTx: WalletTransaction = {
        id: `TXN-${dep.id}`,
        userId: targetUid,
        userEmail: targetEmail,
        userName: targetName,
        depositId: dep.id,
        utr: dep.utr,
        type: 'deposit',
        amount: dep.amount,
        description: `Deposit Rejected: ${reason}`,
        status: 'rejected',
        date: new Date().toLocaleString('en-IN'),
        createdAt: dep.createdAt || new Date().toISOString()
      };
      setTransactions((prev) => sortChronologicalNewestFirst([rejTx, ...prev.filter(t => t.id !== rejTx.id)]));
      persistTransaction(rejTx);

      const rejectNtf: NotificationItem = {
        id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: targetUid,
        userEmail: targetEmail,
        title: `❌ Deposit Rejected (₹${dep.amount})`,
        message: `Reason: ${reason}. Please re-upload valid UTR / screenshot.`,
        type: 'deposit',
        date: 'Just now',
        read: false
      };
      setNotifications((prev) => [rejectNtf, ...prev]);
      persistNotification(rejectNtf);

      // Dispatch real-time Android push notification to target user via resilient safeApiPost
      safeApiPost('/api/send-user-push', {
        userId: targetUid,
        userEmail: targetEmail,
        title: `❌ Deposit Rejected: ₹${dep.amount.toLocaleString('en-IN')}`,
        message: `ডিপোজিট বাতিল হয়েছে। কারণ: ${reason}`,
        body: `ডিপোজিট বাতিল হয়েছে। কারণ: ${reason}`,
        type: 'deposit',
        targetUrl: '/'
      }).catch((err) => console.warn('Deposit rejection FCM push notice:', err));
    }
  };

  // Handle Withdrawal Submission
  const handleWithdrawSubmit = (
    amount: number,
    fullName: string,
    accountNumber: string,
    ifscCode: string,
    upiId: string,
    method?: string,
    bankName?: string,
    cryptoNetwork?: string,
    cryptoAddress?: string
  ) => {
    const isCrypto = method === 'CRYPTO';

    // Enforce Wagering Requirements (Turnover)
    if (user) {
      const wagerStatus = calculateUserWagerStatus(user);
      if (!wagerStatus.isCompleted) {
        soundFx.playError();
        alert(`উইথড্রয়াল স্থগিত: আপনার প্রয়োজনীয় উয়েজার সম্পন্ন হয়নি। বাকি উয়েজার: ₹${wagerStatus.totalRemaining.toLocaleString('en-IN')}`);
        return;
      }
    }

    if (user) {
      logAnalyticsEvent(
        'withdrawal_submission',
        {
          amount,
          fullName,
          method: method || 'IMPS',
          bankName,
          cryptoNetwork,
          accountNumber: isCrypto ? (cryptoAddress ? cryptoAddress.slice(0, 8) + '...' : 'crypto') : `••••${accountNumber.slice(-4)}`,
          upiId
        },
        user.id,
        user.email
      );
    }

    const currentBal = user?.balance || 0;
    const newBal = Math.max(0, currentBal - amount);
    setUser((prev) => prev ? ({
      ...prev,
      balance: newBal
    }) : prev);
    if (user?.id) {
      persistUserBalance(user.id, newBal);
    }

    const userCanonicalUid = user?.canonicalUid || user?.id || '';
    const userCleanEmail = (user?.email || '').toLowerCase().trim();

    const newWth: WithdrawalRequest = {
      id: `WTH-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: userCanonicalUid || user?.id || 'anonymous',
      userEmail: userCleanEmail,
      userCode: user?.userCode || '',
      userName: user?.name || fullName || 'User',
      userPhone: user?.phone || '',
      amount,
      fullName,
      accountNumber,
      ifscCode,
      upiId,
      method: (method as any) || 'IMPS',
      bankName: bankName || '',
      cryptoNetwork: cryptoNetwork || '',
      cryptoAddress: cryptoAddress || '',
      cryptoAmount: isCrypto ? Number((amount / 92).toFixed(4)) : undefined,
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    setWithdrawals((prev) => sortChronologicalNewestFirst([newWth, ...prev]));
    persistWithdrawal(newWth);

    // Send real-time persistent Admin Notification for Bell Icon
    const payoutTargetText = isCrypto
      ? `Crypto (${cryptoNetwork || 'USDT'}) to ${cryptoAddress ? cryptoAddress.slice(0, 6) + '...' + cryptoAddress.slice(-4) : 'Wallet'}`
      : `${bankName ? bankName + ' ' : ''}A/C ••••${accountNumber.slice(-4)}`;

    sendAdminNotification({
      type: 'withdrawal',
      title: isCrypto ? '🪙 New Crypto Withdrawal Request' : '📤 New IMPS Withdrawal Request',
      description: `${fullName || user?.name || 'Player'} requested withdrawal of ₹${amount.toLocaleString('en-IN')} via ${payoutTargetText}`,
      amount,
      userName: fullName || user?.name || 'Player',
      userId: user?.id,
      status: 'pending',
      customId: `notif_${newWth.id}`
    }).catch(() => {});

    // Send real-time withdrawal submission email
    if (user?.email) {
      notifyWithdrawalSubmitted(user.email, user.name || fullName || 'User', amount, isCrypto ? (cryptoNetwork || 'Crypto') : accountNumber.slice(-4)).catch((err) =>
        console.warn('Withdrawal submission email error:', err)
      );
    }

    // Add wallet ledger tx & persist to Firestore
    const wthTx: WalletTransaction = {
      id: `TXN-${newWth.id}`,
      userId: userCanonicalUid || user?.id || 'anonymous',
      userEmail: userCleanEmail,
      userName: fullName || user?.name || 'Player',
      userPhone: user?.phone || '',
      withdrawalId: newWth.id,
      type: 'withdrawal',
      amount: -amount,
      description: isCrypto
        ? `Crypto Withdrawal (${cryptoNetwork || 'USDT'}) to ${cryptoAddress ? cryptoAddress.slice(0, 6) + '...' + cryptoAddress.slice(-4) : 'Wallet'}`
        : `IMPS Withdrawal Request (${bankName || 'Bank'}) to A/C ending ${accountNumber.slice(-4)}`,
      status: 'pending',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([wthTx, ...prev.filter(t => t.id !== wthTx.id)]));
    persistTransaction(wthTx);

    // Loud Personalized Bengali Voice: "Rahul, your withdrawal request is pending."
    soundFx.speakUserTransactionVoice({
      type: 'withdrawal_pending',
      userName: fullName || user?.name,
      amount
    });
  };

  // Handle Admin Approve Withdrawal
  const handleAdminApproveWithdrawal = async (withdrawalId: string) => {
    let wth = withdrawals.find((w) => w.id === withdrawalId);
    if (!wth) {
      try {
        const snap = await getDoc(doc(db, 'withdrawals', withdrawalId));
        if (snap.exists()) {
          wth = { id: snap.id, ...snap.data() } as WithdrawalRequest;
        }
      } catch (e) {
        console.warn('Direct withdrawal lookup error:', e);
      }
    }
    if (wth) {
      const updatedWth: WithdrawalRequest = { ...wth, status: 'approved' };
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === withdrawalId ? updatedWth : w))
      );
      await persistWithdrawal(updatedWth);

      // Resolve true canonical user info
      const targetRes = await findAndCreditUserInFirestore({
        userId: wth.userId,
        userEmail: (wth as any).userEmail,
        userCode: (wth as any).userCode,
        userName: wth.fullName || wth.userName,
        amount: 0
      });
      const targetUid = targetRes.canonicalUid || wth.userId;
      const targetEmail = targetRes.targetEmail || (wth as any).userEmail || '';
      const targetName = targetRes.targetName || wth.fullName || wth.userName || 'Player';

      // Dispatch real-time withdrawal approval email
      if (targetEmail) {
        notifyWithdrawalApproved(targetEmail, targetName, wth.amount, wth.accountNumber).catch((err) =>
          console.warn('Withdrawal approved email error:', err)
        );
      }

      const approvedWthTx: WalletTransaction = {
        id: `TXN-${wth.id}`,
        userId: targetUid,
        userEmail: targetEmail,
        userName: targetName,
        withdrawalId: wth.id,
        type: 'withdrawal',
        amount: -wth.amount,
        description: `Approved Withdrawal (${wth.method || 'IMPS'}) to A/C ending ${(wth.accountNumber || '').slice(-4)}`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: wth.createdAt || new Date().toISOString()
      };
      setTransactions((prev) =>
        sortChronologicalNewestFirst([
          approvedWthTx,
          ...prev.filter((tx) => tx.id !== approvedWthTx.id && !(tx.type === 'withdrawal' && ((tx as any).withdrawalId === wth!.id || tx.id.includes(wth!.id))))
        ])
      );
      persistTransaction(approvedWthTx);

      const approveNtf: NotificationItem = {
        id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: targetUid,
        userEmail: targetEmail,
        title: `✅ Withdrawal Approved (₹${wth.amount})`,
        message: `Your withdrawal of ₹${wth.amount} has been processed to A/C ${wth.accountNumber}.`,
        type: 'withdrawal',
        date: 'Just now',
        read: false
      };
      setNotifications((prev) => [approveNtf, ...prev]);
      persistNotification(approveNtf);

      // Dispatch real-time Android push notification to target user via resilient safeApiPost
      safeApiPost('/api/send-user-push', {
        userId: targetUid,
        userEmail: targetEmail,
        title: `✅ Withdrawal Approved: ₹${wth.amount.toLocaleString('en-IN')}`,
        message: `আপনার ₹${wth.amount.toLocaleString('en-IN')} উইথড্রয়াল সফল হয়েছে এবং অ্যাকাউন্টে পাঠিয়ে দেওয়া হয়েছে।`,
        body: `আপনার ₹${wth.amount.toLocaleString('en-IN')} উইথড্রয়াল সফল হয়েছে এবং অ্যাকাউন্টে পাঠিয়ে দেওয়া হয়েছে।`,
        type: 'withdrawal',
        targetUrl: '/'
      }).catch((err) => console.warn('Withdrawal approval FCM push notice:', err));
    }
  };

  // Handle Admin Reject Withdrawal
  const handleAdminRejectWithdrawal = async (withdrawalId: string, reason: string) => {
    let wth = withdrawals.find((w) => w.id === withdrawalId);
    if (!wth) {
      try {
        const snap = await getDoc(doc(db, 'withdrawals', withdrawalId));
        if (snap.exists()) {
          wth = { id: snap.id, ...snap.data() } as WithdrawalRequest;
        }
      } catch (e) {
        console.warn('Direct withdrawal lookup error:', e);
      }
    }
    if (wth) {
      const updatedWth: WithdrawalRequest = { ...wth, status: 'rejected', rejectReason: reason };
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === withdrawalId ? updatedWth : w))
      );
      await persistWithdrawal(updatedWth);

      // Safely refund the target user across ALL candidate user docs in Firestore!
      const targetRes = await findAndCreditUserInFirestore({
        userId: wth.userId,
        userEmail: (wth as any).userEmail,
        userCode: (wth as any).userCode,
        userName: wth.fullName || wth.userName,
        amount: wth.amount,
        withdrawalId: wth.id
      });
      const targetUid = targetRes.canonicalUid || wth.userId;
      const targetEmail = targetRes.targetEmail || (wth as any).userEmail || '';
      const targetName = targetRes.targetName || wth.fullName || wth.userName || 'Player';

      if (user?.id === targetUid || (user?.email && targetEmail && user.email.toLowerCase().trim() === targetEmail.toLowerCase().trim())) {
        setUser((prev) => prev ? ({
          ...prev,
          balance: targetRes.newBalance
        }) : prev);
      }

      // Dispatch real-time withdrawal rejection email
      if (targetEmail) {
        notifyWithdrawalRejected(targetEmail, targetName, wth.amount, reason).catch((err) =>
          console.warn('Withdrawal rejected email error:', err)
        );
      }

      const rejectedWthTx: WalletTransaction = {
        id: `TXN-${wth.id}`,
        userId: targetUid,
        userEmail: targetEmail,
        userName: targetName,
        withdrawalId: wth.id,
        type: 'withdrawal',
        amount: -wth.amount,
        description: `Withdrawal Rejected: ${reason} (₹${wth.amount} refunded to wallet)`,
        status: 'rejected',
        date: new Date().toLocaleString('en-IN'),
        createdAt: wth.createdAt || new Date().toISOString()
      };
      setTransactions((prev) =>
        sortChronologicalNewestFirst([
          rejectedWthTx,
          ...prev.filter((tx) => tx.id !== rejectedWthTx.id && !(tx.type === 'withdrawal' && ((tx as any).withdrawalId === wth!.id || tx.id.includes(wth!.id))))
        ])
      );
      persistTransaction(rejectedWthTx);

      const rejectNtf: NotificationItem = {
        id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: targetUid,
        userEmail: targetEmail,
        title: `❌ Withdrawal Rejected (₹${wth.amount})`,
        message: `Your withdrawal of ₹${wth.amount} was rejected. Reason: ${reason}. ₹${wth.amount} has been refunded to your wallet.`,
        type: 'withdrawal',
        date: 'Just now',
        read: false
      };
      setNotifications((prev) => [rejectNtf, ...prev]);
      persistNotification(rejectNtf);

      // Dispatch real-time Android push notification to target user via resilient safeApiPost
      safeApiPost('/api/send-user-push', {
        userId: targetUid,
        userEmail: targetEmail,
        title: `❌ Withdrawal Rejected: ₹${wth.amount.toLocaleString('en-IN')}`,
        message: `উইথড্রয়াল বাতিল হয়েছে। কারণ: ${reason}। টাকা ওয়ালেটে রিফান্ড করা হয়েছে।`,
        body: `উইথড্রয়াল বাতিল হয়েছে। কারণ: ${reason}। টাকা ওয়ালেটে রিফান্ড করা হয়েছে।`,
        type: 'withdrawal',
        targetUrl: '/'
      }).catch((err) => console.warn('Withdrawal rejection FCM push notice:', err));
    }
  };

  const handleDrawTriggered = (drawId: string, winningNumbers: number[]) => {
    setDraws((prev) =>
      prev.map((draw) => {
        if (draw.id === drawId) {
          return {
            ...draw,
            winningNumbers,
            endTime: Date.now() + draw.drawDurationMs,
            totalTicketsSold: (draw.totalTicketsSold || 0) + 50
          };
        }
        return draw;
      })
    );
  };

  const handleUpdateUserBalance = (newBalance: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const cleanBal = Math.max(0, Math.round(newBalance));
      if (prev.id) {
        persistUserBalance(prev.id, cleanBal, prev.bonusBalance, prev.email);
      }
      return {
        ...prev,
        balance: cleanBal
      };
    });
  };

  const handleUpdateUserBonusBalance = (newBonusBalance: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const cleanBonus = Math.max(0, Math.round(newBonusBalance));
      if (prev.id) {
        persistUserBalance(prev.id, prev.balance || 0, cleanBonus, prev.email);
      }
      return {
        ...prev,
        bonusBalance: cleanBonus
      };
    });
  };

  const handleToggleUserStatus = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const newStatus = prev.status === 'active' ? 'suspended' : 'active';
      if (prev.id) {
        setDoc(doc(db, 'users', prev.id), { status: newStatus, isBlocked: newStatus === 'suspended' }, { merge: true }).catch(() => {});
      }
      return {
        ...prev,
        status: newStatus as any,
        isBlocked: newStatus === 'suspended'
      };
    });
  };

  const handleAdminAddTransaction = (tx: WalletTransaction) => {
    setTransactions((prev) => [tx, ...prev]);
    persistTransaction(tx);
  };

  const fetchBannerSlides = async () => {
    try {
      const snap = await getDocs(collection(db, 'banner_sliders'));
      const list: BannerSlide[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as BannerSlide);
      });
      list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      setBannerSlides(list);
    } catch (e) {
      console.warn('Error refreshing banner slides:', e);
    }
  };

  // Handle Ticket Purchase Confirmation (Supports Main Wallet and Bonus Wallet)
  const handleConfirmTicketBuy = (
    draw: LotteryDraw,
    ticketDigitsArray: number[][],
    totalPrice: number,
    walletType: 'main' | 'bonus' = 'main'
  ) => {
    if (user) {
      logAnalyticsEvent('ticket_buy', { gameType: 'lottery', drawId: draw.id, drawTitle: draw.title, ticketCount: ticketDigitsArray.length, totalPrice, walletType }, user.id, user.email);
    }

    if (walletType === 'bonus' && (!bonusRules?.isBonusSystemActive || !bonusRules?.allowRegularLottery)) {
      alert('বোনাস ব্যালেন্স দিয়ে শুধুমাত্র থ্রী সুপার কার টিকিট কেনা যাবে। এই লটারির জন্য মূল ব্যালেন্স ব্যবহার করুন।');
      return;
    }

    // Award VIP Points (1 Point per ₹10 spent)
    const earnedVipPts = Math.floor(totalPrice / 10);

    const currentBal = user?.balance || 0;
    const currentBonus = user?.bonusBalance || 0;

    let newBal = currentBal;
    let newBonus = currentBonus;

    if (walletType === 'bonus') {
      if (currentBonus < totalPrice) {
        alert(`অপর্যাপ্ত বোনাস ব্যালেন্স! প্রয়োজন ₹${totalPrice}, আছে ₹${currentBonus.toFixed(2)}।`);
        return;
      }
      newBonus = Math.max(0, currentBonus - totalPrice);
    } else {
      if (currentBal < totalPrice) {
        alert(`Insufficient Wallet Balance! Required ₹${totalPrice}, Available ₹${currentBal.toFixed(2)}.`);
        setIsDepositOpen(true);
        return;
      }
      newBal = Math.max(0, currentBal - totalPrice);
    }

    setUser((prev) => {
      if (!prev) return prev;
      const newPts = (prev.vipPoints || 120) + earnedVipPts;
      let newLevel = prev.vipLevel;
      if (newPts >= 10000) newLevel = 'VIP Platinum';
      else if (newPts >= 2000) newLevel = 'Gold';
      else if (newPts >= 500) newLevel = 'Silver';

      return {
        ...prev,
        balance: newBal,
        bonusBalance: newBonus,
        totalSpent: (prev.totalSpent || 0) + totalPrice,
        vipPoints: newPts,
        vipLevel: newLevel
      };
    });
    if (user?.id) {
      persistUserBalance(user.id, newBal, newBonus, user.email);
      recordUserWager(user.id, totalPrice, walletType).then((res) => {
        if (res.success) {
          setUser((prev) => prev ? ({
            ...prev,
            mainWagerCompleted: walletType === 'main' ? res.newMainCompleted : prev.mainWagerCompleted,
            bonusWagerCompleted: walletType === 'bonus' ? res.newBonusCompleted : prev.bonusWagerCompleted
          }) : prev);
        }
      }).catch((e) => console.warn('Wager recording error on ticket purchase:', e));
    }

    // Create tickets
    const batchId = `BATCH-LOTTERY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTickets: PurchasedTicket[] = ticketDigitsArray.map((digits) => ({
      id: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      batchId: batchId,
      userId: user?.id || 'anonymous',
      drawId: draw.id,
      drawTitle: draw.title,
      ticketNumber: digits.join(' '),
      selectedNumbers: digits,
      price: draw.ticketPrice,
      purchaseDate: new Date().toLocaleString('en-IN'),
      drawTime: draw.endTime,
      status: 'active',
      walletType: walletType
    }));

    setTickets((prev) => sortChronologicalNewestFirst([...newTickets, ...prev]));
    newTickets.forEach((t) => persistTicket(t));

    // Send real-time persistent Admin Notification for Bell Icon
    sendAdminNotification({
      type: 'ticket',
      title: '🎟️ Lottery Tickets Purchased',
      description: `${user?.name || 'Player'} bought ${ticketDigitsArray.length} ticket(s) for ${draw.title} (₹${totalPrice.toLocaleString('en-IN')})`,
      amount: totalPrice,
      userName: user?.name || 'Player',
      userId: user?.id,
      status: 'completed',
      customId: `notif_${batchId}`
    }).catch(() => {});

    // Log transaction
    const tx: WalletTransaction = {
      id: `TXN-BUY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      type: 'ticket_buy',
      amount: -totalPrice,
      walletType: walletType,
      description: `Purchased ${ticketDigitsArray.length} Ticket(s) - ${draw.title} (from ${walletType === 'bonus' ? 'Bonus' : 'Main'} Wallet) (+${earnedVipPts} VIP Pts)`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([tx, ...prev]));
    persistTransaction(tx);

    // Update tickets sold count
    setDraws((prev) =>
      prev.map((d) => (d.id === draw.id ? { ...d, totalTicketsSold: d.totalTicketsSold + ticketDigitsArray.length } : d))
    );

    // Live Activity Log for Admin Monitor & Loud Alert
    if (user) {
      trackUserPresence(user, draw.title, 'betting').catch(() => {});
      logLiveActivity({
        userId: user.id,
        userName: user.name || 'Player',
        userEmail: user.email,
        userPhone: user.phone,
        type: 'bet',
        gameName: `Lottery - ${draw.title}`,
        betAmount: totalPrice,
        details: `Purchased ${ticketDigitsArray.length} lottery tickets (${ticketDigitsArray.map(d => d.join('')).join(', ')}) using ${walletType} balance`
      }).catch(() => {});
    }

    triggerConfetti();
  };

  // Handle Weekly VIP Bonus Claim
  const handleClaimVipBonus = (bonusAmount: number) => {
    const currentBal = user?.balance || 0;
    const newBal = currentBal + bonusAmount;
    setUser((prev) => prev ? ({
      ...prev,
      balance: newBal
    }) : prev);
    if (user?.id) persistUserBalance(user.id, newBal);

    if (user?.email) {
      notifyBonusCredited(user.email, user.name || 'VIP Member', bonusAmount, `Weekly VIP Club Bonus (${user.vipLevel || 'Member'})`).catch((err) =>
        console.warn('VIP bonus email error:', err)
      );
    }

    const vipTx: WalletTransaction = {
      id: `TXN-VIP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      type: 'vip_bonus',
      amount: bonusAmount,
      description: `Weekly VIP Club Cash Bonus (${user?.vipLevel || 'VIP'})`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([vipTx, ...prev]));
    persistTransaction(vipTx);

    const ntf: NotificationItem = {
      id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      userEmail: (user?.email || '').toLowerCase().trim(),
      title: `👑 Weekly VIP Bonus (₹${bonusAmount})`,
      message: `You claimed your weekly VIP bonus payout of ₹${bonusAmount}!`,
      type: 'win',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [ntf, ...prev]);
    persistNotification(ntf);
    triggerConfetti();
  };

  // Handle Claim Spin Reward
  const handleClaimWheelReward = (rewardAmount: number, targetWallet: 'bonus' | 'main' = 'bonus') => {
    const isBonus = targetWallet === 'bonus';
    const currentMainBal = user?.balance || 0;
    const currentBonusBal = user?.bonusBalance || 0;

    const newMainBal = isBonus ? currentMainBal : currentMainBal + rewardAmount;
    const newBonusBal = isBonus ? currentBonusBal + rewardAmount : currentBonusBal;
    const currentCredits = user?.spinCredits ?? 0;
    const newCredits = Math.max(0, currentCredits - 1);

    setUser((prev) => prev ? ({
      ...prev,
      balance: newMainBal,
      bonusBalance: newBonusBal,
      spinCredits: newCredits,
      lastSpinTime: Date.now()
    }) : prev);

    if (user?.id) {
      setDoc(doc(db, 'users', user.id), {
        balance: newMainBal,
        bonusBalance: newBonusBal,
        spinCredits: newCredits,
        lastSpinTime: Date.now()
      }, { merge: true }).catch((err) => console.warn('Persist spin credit error:', err));
    }

    if (user?.email) {
      notifyBonusCredited(
        user.email,
        user.name || 'Player',
        rewardAmount,
        isBonus ? 'Daily Lucky Spin Bonus (Bonus Wallet)' : 'Daily Lucky Spin Cash (Main Wallet)'
      ).catch((err) =>
        console.warn('Wheel bonus email error:', err)
      );
    }

    const wheelTx: WalletTransaction = {
      id: `TXN-WHEEL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      type: isBonus ? 'wheel_bonus' : 'win',
      amount: rewardAmount,
      description: isBonus ? `Lucky Wheel Bonus (Bonus Wallet)` : `Lucky Wheel Prize (Main Wallet)`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([wheelTx, ...prev]));
    persistTransaction(wheelTx);

    // Live Activity Log for Admin Voice Alert
    logLiveActivity({
      userId: user?.id || 'anonymous',
      userName: user?.name || 'Player',
      userEmail: user?.email,
      userPhone: user?.phone,
      type: 'bet',
      gameName: 'Wheel of Fortune',
      betAmount: 0,
      winAmount: rewardAmount,
      details: `Spun Lucky Wheel and won ₹${rewardAmount.toLocaleString('en-IN')} (${isBonus ? 'Bonus Wallet' : 'Main Wallet'})`
    });

    const ntf: NotificationItem = {
      id: `NTF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      userEmail: (user?.email || '').toLowerCase().trim(),
      title: isBonus ? `🎁 Lucky Wheel Bonus (₹${rewardAmount})` : `💰 Lucky Wheel Cash Prize (₹${rewardAmount})`,
      message: `You won ₹${rewardAmount} from the Lucky Wheel! (Credited to your ${isBonus ? 'Bonus Wallet' : 'Main Wallet'})`,
      type: isBonus ? 'system' : 'win',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [ntf, ...prev]);
    persistNotification(ntf);
    triggerConfetti();

    if (rewardAmount >= 100) {
      setBigWinData({
        id: `wheel-win-${Date.now()}`,
        category: 'wheel',
        title: 'লাকি হুইল ফরচুন রিওয়ার্ড!',
        subtitle: isBonus ? 'LUCKY WHEEL BONUS' : 'LUCKY WHEEL REAL CASH',
        amount: rewardAmount,
        drawOrRoundId: `SPIN-${Date.now()}`
      });
    }
  };

  const handleUpdateUserSettings = async (newSettings: UserSettings) => {
    setUser((prev) => ({
      ...prev,
      settings: newSettings
    }));

    soundFx.setBgMusicEnabled(newSettings.bgMusicEnabled ?? true);
    soundFx.setSoundEffectsEnabled(newSettings.soundEffectsEnabled ?? true);
    soundFx.setHapticEnabled(newSettings.hapticEnabled ?? true);

    if (user?.id) {
      try {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, { settings: newSettings }, { merge: true });
      } catch (err) {
        console.error('Error persisting user settings to Firestore:', err);
      }
    }
  };

  // Handle Notification Direct Click & Smart Navigation
  const handleNotificationClick = (ntf: NotificationItem) => {
    soundFx.playClick();
    
    // 1. Mark as read locally in state
    setNotifications((prev) =>
      prev.map((n) => (n.id === ntf.id ? { ...n, read: true } : n))
    );

    // 2. Persist read state to Firestore if ID exists
    if (ntf.id) {
      const activeUid = user?.id || (currentUser ? currentUser.uid : null);
      if (activeUid) {
        setDoc(doc(db, 'notifications', ntf.id), { read: true }, { merge: true }).catch(() => {});
      }
    }

    // 3. Close the drawer & dismiss realtime notification popups
    setIsNotificationsOpen(false);
    setRealtimeToast(null);
    if (activeBroadcastBanner?.id === ntf.id) {
      setActiveBroadcastBanner(null);
    }

    // 4. Resolve destination and navigate smoothly
    const destinationInfo = resolveNotificationDestination(ntf);
    const action = destinationInfo.actionType;

    switch (action) {
      case 'deposit':
        setIsDepositOpen(true);
        break;
      case 'withdrawal':
        setActiveTab('withdrawal');
        break;
      case 'supercar':
        if (isSuperCarEnabled) {
          setIsSuperCarOpen(true);
        } else {
          setActiveTab('home');
        }
        break;
      case 'crash':
        setIsCrashGameOpen(true);
        break;
      case 'roulette':
        setIsLiveRouletteOpen(true);
        break;
      case 'dragon_tiger':
        setIsDragonTigerOpen(true);
        break;
      case 'andar_bahar':
        setIsAndarBaharOpen(true);
        break;
      case 'lucky_wheel':
        setIsLuckyWheelOpen(true);
        break;
      case 'lottery':
        setActiveTab('lottery');
        break;
      case 'tickets':
        setActiveTab('tickets');
        break;
      case 'results':
        setActiveTab('results');
        break;
      case 'offers':
        setActiveTab('offers');
        break;
      case 'support':
        setIsSupportChatOpen(true);
        break;
      case 'history':
        setActiveTab('history');
        break;
      case 'profile':
        setActiveTab('profile');
        break;
      case 'settings':
        setActiveTab('settings');
        break;
      case 'app_update':
        if (ntf.actionUrl) {
          setAppUpdateConfig((prev) => ({
            ...prev,
            apkUrl: ntf.actionUrl || prev.apkUrl,
            versionName: ntf.title?.match(/v?(\d+(\.\d+)*)/i)?.[1] || prev.versionName,
            changelog: ntf.message || prev.changelog,
            forceUpdate: Boolean(ntf.isCritical)
          }));
        }
        setIsAppUpdateOpen(true);
        break;
      default:
        setActiveTab('home');
        break;
    }
  };

  // Unified Transactions Synthesis: strictly isolates and ensures 100% personal data visibility for user deposit & withdrawal requests
  const unifiedTransactions = useMemo(() => {
    const txMap = new Map<string, WalletTransaction>();

    const currentUid = user?.canonicalUid || user?.id || '';
    const currentEmail = (user?.email || '').toLowerCase().trim();
    const userCode = user ? getUserDisplayCode(user) : '';

    const isMatch = (recUid?: string, recEmail?: string, recCode?: string) => {
      const cleanUid = (recUid || '').trim();
      const cleanRecEmail = (((recEmail || '') as string) || '').toLowerCase().trim();

      if (!cleanUid && !cleanRecEmail) return false;
      if (cleanUid === 'anonymous' || cleanUid === 'admin' || cleanUid === 'ALL') {
        return Boolean(currentEmail && currentEmail.includes('@') && cleanRecEmail && cleanRecEmail === currentEmail);
      }
      if (currentUid && cleanUid && (
        cleanUid === currentUid ||
        (user?.canonicalUid && cleanUid === user.canonicalUid) ||
        (Array.isArray(user?.linkedDocIds) && user.linkedDocIds.includes(cleanUid))
      )) {
        return true;
      }
      if (currentEmail && currentEmail.includes('@') && cleanRecEmail && cleanRecEmail === currentEmail) {
        return true;
      }
      if (userCode && (cleanUid === userCode || (recCode && recCode === userCode))) {
        return true;
      }
      return false;
    };

    // 1. Direct transactions
    transactions.forEach((tx) => {
      if (!tx || !tx.id) return;
      const txUid = (tx.userId || (tx as any).uid || '').trim();
      const txEmail = ((tx.userEmail || (tx as any).email || '') as string).toLowerCase().trim();
      if (!isMatch(txUid, txEmail, (tx as any).userCode)) return;
      txMap.set(tx.id, tx);
    });

    // 2. Synthesize/merge any deposits that might not have a standalone transaction document or update existing status
    deposits.forEach((dep) => {
      if (!dep || !dep.id) return;
      const depUid = (dep.userId || '').trim();
      const depEmail = (((dep as any).userEmail || '') as string).toLowerCase().trim();
      if (!isMatch(depUid, depEmail, (dep as any).userCode)) return;

      const txKey = `TXN-${dep.id}`;
      const targetStatus: 'completed' | 'rejected' | 'pending' =
        dep.status === 'approved' ? 'completed' : dep.status === 'rejected' ? 'rejected' : 'pending';

      const targetDescription = dep.cryptoAmount
        ? `Crypto Deposit (${dep.cryptoAmount} ${dep.cryptoCurrency || 'USDT'}) via ${(dep.method || 'CRYPTO').toString().toUpperCase()} (TXID: ${dep.utr})`
        : `${dep.status === 'approved' ? 'Approved Deposit' : dep.status === 'rejected' ? 'Deposit Rejected' : 'Deposit Request'} via ${(dep.method || 'UPI').toString().toUpperCase()} (UTR: ${dep.utr})`;

      const existingTx = txMap.get(txKey) || Array.from(txMap.values()).find(
        (t) => t.type === 'deposit' && ((t as any).depositId === dep.id || t.id.includes(dep.id) || (dep.utr && t.description?.includes(dep.utr)))
      );

      if (existingTx) {
        // ALWAYS update status and description so approved deposits immediately reflect as completed
        existingTx.status = targetStatus;
        if (dep.status === 'approved' && !existingTx.description?.toLowerCase().includes('approved')) {
          existingTx.description = targetDescription;
        } else if (dep.status === 'rejected' && !existingTx.description?.toLowerCase().includes('rejected')) {
          existingTx.description = targetDescription;
        }
      } else {
        txMap.set(txKey, {
          id: txKey,
          userId: dep.userId,
          userEmail: (dep as any).userEmail || '',
          userName: dep.userName || 'Player',
          userPhone: dep.userPhone || '',
          depositId: dep.id,
          utr: dep.utr,
          type: 'deposit',
          amount: dep.amount,
          description: targetDescription,
          status: targetStatus,
          date: dep.date || new Date().toLocaleString('en-IN'),
          createdAt: dep.createdAt || new Date().toISOString()
        });
      }
    });

    // 3. Synthesize/merge any withdrawals that might not have a standalone transaction document or update existing status
    withdrawals.forEach((wth) => {
      if (!wth || !wth.id) return;
      const wthUid = (wth.userId || '').trim();
      const wthEmail = (((wth as any).userEmail || '') as string).toLowerCase().trim();
      if (!isMatch(wthUid, wthEmail, (wth as any).userCode)) return;

      const txKey = `TXN-${wth.id}`;
      const targetStatus: 'completed' | 'rejected' | 'pending' =
        wth.status === 'approved' ? 'completed' : wth.status === 'rejected' ? 'rejected' : 'pending';

      const isCrypto = wth.method === 'CRYPTO';
      const targetDescription = isCrypto
        ? `Crypto Withdrawal (${wth.cryptoNetwork || 'USDT'}) to ${wth.cryptoAddress ? wth.cryptoAddress.slice(0, 6) + '...' + wth.cryptoAddress.slice(-4) : 'Wallet'}`
        : `${wth.status === 'approved' ? 'Approved Withdrawal' : wth.status === 'rejected' ? 'Withdrawal Rejected' : 'IMPS Withdrawal Request'} (${wth.bankName || 'Bank'}) to A/C ending ${(wth.accountNumber || '').slice(-4)}`;

      const existingTx = txMap.get(txKey) || Array.from(txMap.values()).find(
        (t) => t.type === 'withdrawal' && ((t as any).withdrawalId === wth.id || t.id.includes(wth.id))
      );

      if (existingTx) {
        // ALWAYS update status and description so approved/rejected withdrawals immediately reflect
        existingTx.status = targetStatus;
        if (wth.status === 'approved' && !existingTx.description?.toLowerCase().includes('approved')) {
          existingTx.description = targetDescription;
        } else if (wth.status === 'rejected' && !existingTx.description?.toLowerCase().includes('rejected')) {
          existingTx.description = targetDescription;
        }
      } else {
        txMap.set(txKey, {
          id: txKey,
          userId: wth.userId,
          userEmail: (wth as any).userEmail || '',
          userName: wth.fullName || wth.userName || 'Player',
          userPhone: wth.userPhone || '',
          withdrawalId: wth.id,
          type: 'withdrawal',
          amount: -wth.amount,
          description: targetDescription,
          status: targetStatus,
          date: wth.date || new Date().toLocaleString('en-IN'),
          createdAt: wth.createdAt || new Date().toISOString()
        });
      }
    });

    const all = Array.from(txMap.values());
    return sortChronologicalNewestFirst(all);
  }, [transactions, deposits, withdrawals, user?.id, user?.canonicalUid, user?.email, user?.name, user?.linkedDocIds]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const activeTicketsCount = tickets.filter((t) => t.status === 'active').length;

  // Auto-Reconciliation Engine: Reconciles admin-approved deposits and rejected withdrawals
  // even if the user's app was closed or offline when the approval occurred.
  const isAutoReconcilingRef = useRef(false);
  useEffect(() => {
    if (!user || !user.id || isVerifiedAdmin || isAutoReconcilingRef.current) return;
    if (deposits.length === 0 && withdrawals.length === 0) return;

    const runOfflineReconciliation = async () => {
      isAutoReconcilingRef.current = true;
      try {
        const activeUid = user.canonicalUid || user.id;
        const localCreditedKey = `betguru_credited_deposits_${activeUid}`;
        const localRefundedKey = `betguru_refunded_withdrawals_${activeUid}`;

        let cachedCredited: string[] = [];
        let cachedRefunded: string[] = [];
        try {
          cachedCredited = JSON.parse(localStorage.getItem(localCreditedKey) || '[]');
          cachedRefunded = JSON.parse(localStorage.getItem(localRefundedKey) || '[]');
        } catch (_) {}

        const creditedSet = new Set<string>([...(user.creditedDepositIds || []), ...cachedCredited]);
        const refundedSet = new Set<string>([...(user.refundedWithdrawalIds || []), ...cachedRefunded]);

        // Check for approved deposits belonging to this user that have not been marked credited locally
        const uncreditedApprovedDeposits = deposits.filter((dep) => {
          return dep.status === 'approved' && !creditedSet.has(dep.id);
        });

        // Check for rejected withdrawals belonging to this user that have not been marked refunded locally
        const unrefundedRejectedWithdrawals = withdrawals.filter((wth) => {
          return wth.status === 'rejected' && !refundedSet.has(wth.id);
        });

        if (uncreditedApprovedDeposits.length === 0 && unrefundedRejectedWithdrawals.length === 0) {
          return;
        }

        // Fetch fresh Firestore user document to verify server-side state
        let currentDocBalance = typeof user.balance === 'number' ? user.balance : 0;
        let currentDocSpinCredits = typeof user.spinCredits === 'number' ? user.spinCredits : 0;
        const remoteCredited = new Set<string>(user.creditedDepositIds || []);
        const remoteRefunded = new Set<string>(user.refundedWithdrawalIds || []);

        try {
          const uSnap = await getFreshDoc(doc(db, 'users', activeUid));
          if (uSnap.exists() && uSnap.data()) {
            const uData = uSnap.data() as any;
            if (typeof uData.balance === 'number') currentDocBalance = uData.balance;
            if (typeof uData.spinCredits === 'number') currentDocSpinCredits = uData.spinCredits;
            if (Array.isArray(uData.creditedDepositIds)) {
              uData.creditedDepositIds.forEach((id: string) => id && remoteCredited.add(id));
            }
            if (Array.isArray(uData.refundedWithdrawalIds)) {
              uData.refundedWithdrawalIds.forEach((id: string) => id && remoteRefunded.add(id));
            }
          }
        } catch (e) {
          console.warn('Could not fetch latest user doc during reconciliation:', e);
        }

        let balanceDelta = 0;
        let spinDelta = 0;
        let newlyCreditedCount = 0;

        uncreditedApprovedDeposits.forEach((dep) => {
          creditedSet.add(dep.id);
          // If the server document didn't already have it credited, add to balance
          if (!remoteCredited.has(dep.id)) {
            balanceDelta += dep.amount;
            if (dep.amount >= 1000) spinDelta += Math.floor(dep.amount / 1000);
            newlyCreditedCount++;
          }
        });

        unrefundedRejectedWithdrawals.forEach((wth) => {
          refundedSet.add(wth.id);
          // If the server document didn't already have it refunded, add to balance
          if (!remoteRefunded.has(wth.id)) {
            balanceDelta += wth.amount;
          }
        });

        const updatedCreditedList = Array.from(creditedSet);
        const updatedRefundedList = Array.from(refundedSet);

        // Update local storage caches
        try {
          localStorage.setItem(localCreditedKey, JSON.stringify(updatedCreditedList));
          localStorage.setItem(localRefundedKey, JSON.stringify(updatedRefundedList));
        } catch (_) {}

        const newFinalBalance = Math.max(0, currentDocBalance + balanceDelta);
        const newFinalSpinCredits = Math.max(0, currentDocSpinCredits + spinDelta);

        // Update Firestore canonical user document
        const updatePayload: Record<string, any> = {
          creditedDepositIds: updatedCreditedList,
          refundedWithdrawalIds: updatedRefundedList,
          updatedAt: new Date().toISOString()
        };
        if (balanceDelta !== 0) {
          updatePayload.balance = newFinalBalance;
        }
        if (spinDelta !== 0) {
          updatePayload.spinCredits = newFinalSpinCredits;
        }

        await setDoc(doc(db, 'users', activeUid), updatePayload, { merge: true });

        // Update local state
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            balance: newFinalBalance,
            spinCredits: newFinalSpinCredits,
            creditedDepositIds: updatedCreditedList,
            refundedWithdrawalIds: updatedRefundedList
          };
        });

        // Audio and voice announcement feedback if deposit was approved while app was closed
        if (newlyCreditedCount > 0) {
          const sampleDep = uncreditedApprovedDeposits[0];
          soundFx.speakUserTransactionVoice({
            type: 'deposit_approved',
            userName: user.name || 'Player',
            amount: sampleDep.amount
          });
          soundFx.playCoin();
        }
      } catch (err) {
        console.warn('Offline reconciliation completed with notice:', err);
      } finally {
        isAutoReconcilingRef.current = false;
      }
    };

    runOfflineReconciliation();
  }, [deposits, withdrawals, user?.id, user?.canonicalUid, isVerifiedAdmin]);

  // 0. Luxury Animated Entry Gateway Verification Guard
  if (!isEntryGateVerified) {
    return (
      <LuxuryEntryGate 
        user={user} 
        onEnterSuccess={() => setIsEntryGateVerified(true)} 
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-0.5 animate-bounce shadow-2xl shadow-amber-500/30">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
        </div>
        <p className="mt-4 text-xs font-mono font-bold text-amber-400 tracking-widest uppercase animate-pulse">
          AUTHENTICATING WITH BETGURU...
        </p>
      </div>
    );
  }

  if (!currentUser || !user) {
    return <AuthScreen />;
  }

  // Blocked / Suspended User Access Gate
  if (user && (user.status === 'suspended' || user.status === 'blocked' || user.isBlocked === true) && user.role !== 'admin' && !checkIsAdminEmail(user.email)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-mono text-slate-100 selection:bg-rose-500 selection:text-white">
        <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500 mx-auto animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              YOUR ACCOUNT WAS BLOCKED
            </h1>
            <p className="text-sm font-bold text-rose-400">
              You are blocked, please contact customer care.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed pt-2">
              আপনার অ্যাকাউন্টটি অ্যাডমিন দ্বারা ব্লক করা হয়েছে। আপনার একাউন্ট ও ব্যালেন্স রিএক্টিভেট করতে অনুগ্রহ করে কাস্টমার কেয়ারের সাথে যোগাযোগ করুন।
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-left text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Account Name:</span>
              <span className="text-white font-bold">{user.name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Account Email:</span>
              <span className="text-amber-300 font-bold">{user.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Status:</span>
              <span className="text-rose-400 font-black uppercase">PERMANENTLY BLOCKED / SUSPENDED</span>
            </div>
            {user.blockReason && (
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Reason:</span>
                <span className="text-amber-300 font-bold text-right truncate max-w-[200px]">{user.blockReason}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={`https://wa.me/919876543210?text=Hello%20BETGURU%20Support,%20my%20account%20has%20been%20suspended.%20Email:%20${encodeURIComponent(user.email || user.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>CONTACT CUSTOMER CARE ON WHATSAPP</span>
            </a>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>LOGOUT / SWITCH ACCOUNT</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dedicated Admin Dashboard View for Verified Admins
  if (isAdminMode && isVerifiedAdmin) {
    return (
      <AdminDashboard
        deposits={deposits}
        withdrawals={withdrawals}
        draws={draws}
        tickets={tickets}
        user={user}
        transactions={transactions}
        bannerSlides={bannerSlides}
        hasAdminClaim={isVerifiedAdmin}
        onCloseAdmin={() => setIsAdminMode(false)}
        onApproveDeposit={handleAdminApproveDeposit}
        onRejectDeposit={handleAdminRejectDeposit}
        onApproveWithdrawal={handleAdminApproveWithdrawal}
        onRejectWithdrawal={handleAdminRejectWithdrawal}
        onTriggerDrawResult={handleDrawTriggered}
        onUpdateUserBalance={handleUpdateUserBalance}
        onUpdateUserBonusBalance={handleUpdateUserBonusBalance}
        onToggleUserStatus={handleToggleUserStatus}
        onAddTransaction={handleAdminAddTransaction}
        onBannerSlidesUpdated={fetchBannerSlides}
      />
    );
  }

  return (
    <div className="min-h-screen gold-bg-hd text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col antialiased relative overflow-x-hidden">
      
      {/* Premium HD Gold Ambient Background Lighting - GPU Accelerated Dedicated Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 gpu-accelerate">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/15 via-yellow-500/10 to-transparent rounded-full blur-3xl opacity-80"></div>
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-3xl opacity-80"></div>
        <div className="absolute bottom-10 -right-32 w-[450px] h-[450px] bg-yellow-500/10 rounded-full blur-3xl opacity-80"></div>
      </div>
      
      {/* Top Header */}
      {!isAnyLiveGameOpen && (
        <Header
          balance={user.balance}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenDeposit={() => setIsDepositOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenProfile={() => setActiveTab('profile')}
          muted={isMuted}
          onToggleMute={handleToggleMute}
          user={user}
          onOpenAdmin={isVerifiedAdmin ? () => setIsAdminMode(true) : undefined}
          onOpenReferral={() => setIsReferralModalOpen(true)}
        />
      )}

      {/* Live Winners Horizontal Marquee */}
      {!isAnyLiveGameOpen && <LiveWinnersTicker />}

      {/* Main View Router */}
      <main className={`flex-1 ${isAnyLiveGameOpen ? 'hidden' : 'smooth-scroll-contain'}`}>
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5 pb-28"
            >
              
              {/* PROMOTIONAL BANNER SLIDER (Replaces old compact dashboard card) */}
              <PromotionalSlider
                slides={bannerSlides}
                onAction={handleBannerSliderAction}
              />

                {/* LIVE CASINO SHOWCASE HUB (HD Graphic Banners) */}
                {anyLiveCasinoEnabled ? (
                  <div className="p-3 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-950 to-amber-950/30 border border-amber-500/30 shadow-2xl space-y-3.5 font-mono relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <span>LIVE CASINO ARENA</span>
                            <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                              REAL-TIME
                            </span>
                          </h3>
                          <p className="text-[10px] text-amber-300/80">Play HD Live Dealer Games with Instant Real-Time Payouts</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-0.5">
                      {/* Aviator Crash HD Visual Banner Card */}
                      {isCrashEnabled && (
                        <div 
                          onClick={() => {
                            soundFx.playClick();
                            setIsCrashGameOpen(true);
                          }}
                          className="rainbow-spin-border-wrap group shadow-2xl"
                        >
                          <div className="rainbow-spin-border-inner relative flex flex-col justify-between">
                            {/* HD Background Image - 100% Bright and Crystal Clear */}
                            <img 
                              src={bannerAviatorCrashImg} 
                              alt="Aviator Crash Live Casino" 
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 group-hover:brightness-105 transition-all duration-700 ease-out"
                            />
                            {/* Soft Top & Bottom Vignettes to guarantee text readability without darkening image center */}
                            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                            {/* Top Badges & Live Online Player Counter */}
                            <div className="relative z-10 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-rose-500/50 shadow-md">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                  <span className="text-[10px] font-black text-white uppercase tracking-wider">CRASH ✈️</span>
                                </div>
                                <span className="px-2 py-0.5 bg-rose-600 text-white backdrop-blur-md border border-rose-400/50 rounded-lg text-[9px] font-black shadow-md flex items-center gap-1">
                                  UP TO 500X
                                </span>
                              </div>
                              {/* Real-time Synchronized Live Online Counter */}
                              <div className="flex items-center">
                                <LiveOnlinePlayerCounter gameKey="aviator" />
                              </div>
                            </div>

                            {/* Bottom Banner Info & CTA */}
                            <div className="relative z-10 p-3">
                              <div className="flex items-end justify-between">
                                <div>
                                  <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] flex items-center gap-1.5">
                                    <span>✈️</span> Aviator Crash
                                  </h4>
                                  <p className="text-[10px] text-rose-300 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Cash Out Before Crash • Min ₹10</p>
                                </div>
                                <div className="casino-btn-vibe-rose px-3.5 py-1.5 bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 text-white text-[11px] font-black rounded-xl border border-rose-300/80 shadow-lg flex items-center gap-1.5 group-hover:scale-110 transition-all select-none">
                                  <span className="tracking-wide">FLY</span>
                                  <span className="font-bold text-xs transition-transform group-hover:translate-x-1">→</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Andar Bahar HD Visual Banner Card */}
                      {isAndarBaharEnabled && (
                        <div 
                          onClick={() => {
                            soundFx.playClick();
                            setIsAndarBaharOpen(true);
                          }}
                          className="rainbow-spin-border-wrap group shadow-2xl"
                        >
                          <div className="rainbow-spin-border-inner relative flex flex-col justify-between">
                            {/* HD Background Image - 100% Bright and Crystal Clear */}
                            <img 
                              src={andarBaharBannerImg} 
                              alt="Andar Bahar Live Casino" 
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 group-hover:brightness-105 transition-all duration-700 ease-out"
                            />
                            {/* Soft Top & Bottom Vignettes */}
                            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                            {/* Top Badges & Live Online Player Counter */}
                            <div className="relative z-10 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-emerald-500/50 shadow-md">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                  <span className="text-[10px] font-black text-white uppercase tracking-wider">FAIR RNG</span>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-600 text-white backdrop-blur-md border border-emerald-400/50 rounded-lg text-[9px] font-black shadow-md">
                                  2.0X PAYOUT
                                </span>
                              </div>
                              {/* Real-time Synchronized Live Online Counter */}
                              <div className="flex items-center">
                                <LiveOnlinePlayerCounter gameKey="andar_bahar" />
                              </div>
                            </div>

                            {/* Bottom Banner Info & CTA */}
                            <div className="relative z-10 p-3">
                              <div className="flex items-end justify-between">
                                <div>
                                  <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                                    Andar Bahar
                                  </h4>
                                  <p className="text-[10px] text-emerald-300 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Min Bet: ₹10 • Joker Match</p>
                                </div>
                                <div className="casino-btn-vibe-emerald px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white text-[11px] font-black rounded-xl border border-emerald-300/80 shadow-lg flex items-center gap-1.5 group-hover:scale-110 transition-all select-none">
                                  <span className="tracking-wide">PLAY</span>
                                  <span className="font-bold text-xs transition-transform group-hover:translate-x-1">→</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Hindi Lightning Roulette HD Visual Banner Card */}
                      {isRouletteEnabled && (
                        <div 
                          onClick={() => {
                            soundFx.playClick();
                            setIsLiveRouletteOpen(true);
                          }}
                          className="rainbow-spin-border-wrap group shadow-2xl"
                        >
                          <div className="rainbow-spin-border-inner relative flex flex-col justify-between">
                            {/* HD Background Image - 100% Bright and Crystal Clear */}
                            <img 
                              src={rouletteBannerImg} 
                              alt="Hindi Lightning Roulette Live Casino" 
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 group-hover:brightness-105 transition-all duration-700 ease-out"
                            />
                            {/* Soft Top & Bottom Vignettes */}
                            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                            {/* Top Badges & Live Online Player Counter */}
                            <div className="relative z-10 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-amber-500/50 shadow-md">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                  <span className="text-[10px] font-black text-white uppercase tracking-wider">HINDI LIVE</span>
                                </div>
                                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 backdrop-blur-md border border-amber-400 rounded-lg text-[9px] font-black shadow-md flex items-center gap-1">
                                  <span>⚡</span> 500X MULTIPLIERS
                                </span>
                              </div>
                              {/* Real-time Synchronized Live Online Counter */}
                              <div className="flex items-center">
                                <LiveOnlinePlayerCounter gameKey="roulette" />
                              </div>
                            </div>

                            {/* Bottom Banner Info & CTA */}
                            <div className="relative z-10 p-3">
                              <div className="flex items-end justify-between">
                                <div>
                                  <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] flex items-center gap-1.5">
                                    <span>⚡</span> Hindi Lightning Roulette
                                  </h4>
                                  <p className="text-[10px] text-amber-300 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Live Hindi Dealer • Min Bet: ₹10 • 500x Win</p>
                                </div>
                                <div className="casino-btn-vibe-amber px-3.5 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-[11px] font-black rounded-xl border border-amber-200/90 shadow-lg flex items-center gap-1.5 group-hover:scale-110 transition-all select-none">
                                  <span className="tracking-wide">PLAY</span>
                                  <span className="font-bold text-xs transition-transform group-hover:translate-x-1">→</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dragon Tiger Live HD Visual Banner Card */}
                      {isDragonTigerEnabled && (
                        <div 
                          onClick={() => {
                            soundFx.playClick();
                            setIsDragonTigerOpen(true);
                          }}
                          className="rainbow-spin-border-wrap group shadow-2xl"
                        >
                          <div className="rainbow-spin-border-inner relative flex flex-col justify-between">
                            {/* HD Background Image - 100% Bright and Crystal Clear */}
                            <img 
                              src={dragonTigerBannerImg} 
                              alt="Dragon Tiger Live Casino" 
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 group-hover:brightness-105 transition-all duration-700 ease-out"
                            />
                            {/* Soft Top & Bottom Vignettes */}
                            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                            {/* Top Badges & Live Online Player Counter */}
                            <div className="relative z-10 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-red-500/50 shadow-md">
                                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                  <span className="text-[10px] font-black text-white uppercase tracking-wider">EVOLUTION LIVE</span>
                                </div>
                                <span className="px-2 py-0.5 bg-red-600 text-white backdrop-blur-md border border-red-400/50 rounded-lg text-[9px] font-black shadow-md flex items-center gap-1">
                                  50:1 SUITED TIE
                                </span>
                              </div>
                              {/* Real-time Synchronized Live Online Counter */}
                              <div className="flex items-center">
                                <LiveOnlinePlayerCounter gameKey="dragon_tiger" />
                              </div>
                            </div>

                            {/* Bottom Banner Info & CTA */}
                            <div className="relative z-10 p-3">
                              <div className="flex items-end justify-between">
                                <div>
                                  <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] flex items-center gap-1.5">
                                    <span>🐉</span> Dragon Tiger Live
                                  </h4>
                                  <p className="text-[10px] text-red-300 font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Evolution Studio Dealer • 50:1 Suited Tie</p>
                                </div>
                                <div className="casino-btn-vibe-red px-3.5 py-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white text-[11px] font-black rounded-xl border border-red-300/80 shadow-lg flex items-center gap-1.5 group-hover:scale-110 transition-all select-none">
                                  <span className="tracking-wide">PLAY</span>
                                  <span className="font-bold text-xs transition-transform group-hover:translate-x-1">→</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-amber-500/20 text-center font-mono space-y-1">
                    <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
                      <Sparkles className="w-4 h-4" />
                      <span>LIVE CASINO UNDER SCHEDULED MAINTENANCE</span>
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      All live casino tables are temporarily offline for optimization. Please check back shortly or explore our active lottery draws!
                    </p>
                  </div>
                )}

                {/* Three Super Car Draw Live Section */}
                {isSuperCarEnabled && (
                  <SuperCarDrawSection
                    userBalance={user.balance}
                    userBonusBalance={user.bonusBalance || 0}
                    bonusRules={bonusRules}
                    config={supercarConfig}
                    currentIssue={supercarCurrentIssue}
                    userTickets={tickets.filter((t) => t.category === 'Three Super Car Draw')}
                    pastDraws={supercarPastDraws}
                    onConfirmBuyTicket={handleConfirmSuperCarTicketBuy}
                    onDrawResolved={handleSuperCarDrawResolved}
                    onOpenFullArena={(carColor) => {
                      if (carColor) setSuperCarSelectedColor(carColor);
                      setIsSuperCarOpen(true);
                    }}
                    onOpenBuyTicket={(carColor) => {
                      setSuperCarBuyPageCar(carColor || 'red');
                    }}
                  />
                )}

                {/* Single Combined Compact Lottery Section */}
                <LotterySection
                  draws={visibleDraws}
                  results={lotteryResults}
                  onViewResults={() => setActiveTab('results')}
                  onBuyTicket={(selectedDraw) => setBuyTicketDraw(selectedDraw)}
                />

              </motion.div>
            )}

            {activeTab === 'lottery' && (
              <motion.div
                key="lottery"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-6 pb-28"
              >
                <PromotionalSlider slides={bannerSlides} category="lottery" onAction={handleBannerSliderAction} />
                {isSuperCarEnabled && (
                  <SuperCarDrawSection
                    userBalance={user.balance}
                    userBonusBalance={user.bonusBalance || 0}
                    bonusRules={bonusRules}
                    config={supercarConfig}
                    currentIssue={supercarCurrentIssue}
                    userTickets={tickets.filter((t) => t.category === 'Three Super Car Draw')}
                    pastDraws={supercarPastDraws}
                    onConfirmBuyTicket={handleConfirmSuperCarTicketBuy}
                    onDrawResolved={handleSuperCarDrawResolved}
                    onOpenFullArena={(carColor) => {
                      if (carColor) setSuperCarSelectedColor(carColor);
                      setIsSuperCarOpen(true);
                    }}
                    onOpenBuyTicket={(carColor) => {
                      setSuperCarBuyPageCar(carColor || 'red');
                    }}
                  />
                )}
                <LotterySection
                  draws={visibleDraws}
                  results={lotteryResults}
                  onViewResults={() => setActiveTab('results')}
                  onBuyTicket={(selectedDraw) => setBuyTicketDraw(selectedDraw)}
                />
              </motion.div>
            )}

            {activeTab === 'withdrawal' && (
              <motion.div
                key="withdrawal"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <WithdrawalSection
                  user={user}
                  draws={draws}
                  withdrawals={withdrawals}
                  onBack={() => setActiveTab('profile')}
                  onSubmitWithdrawal={handleWithdrawSubmit}
                />
              </motion.div>
            )}

            {activeTab === 'tickets' && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <MyTicketsView
                  tickets={tickets}
                  transactions={unifiedTransactions}
                  initialSection="tickets"
                  onOpenBuyTicket={() => {
                    setActiveTab('home');
                    setBuyTicketDraw(draws[0]);
                  }}
                  onOpenLiveGame={(game) => {
                    if (game === 'dragon_tiger') setIsDragonTigerOpen(true);
                    else if (game === 'roulette') setIsLiveRouletteOpen(true);
                    else if (game === 'andar_bahar') setIsAndarBaharOpen(true);
                    else if (game === 'aviator') setIsCrashGameOpen(true);
                  }}
                  onOpenCasino={() => {
                    setIsDragonTigerOpen(true);
                  }}
                  onOpenDeposit={() => setIsDepositOpen(true)}
                  onOpenWithdraw={() => setActiveTab('withdrawal')}
                  onOpenSupportChat={(msg) => {
                    if (msg) setSupportChatPrefill(msg);
                    setIsSupportChatOpen(true);
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <MyTicketsView
                  tickets={tickets}
                  transactions={unifiedTransactions}
                  initialSection="wallet_transactions"
                  onOpenBuyTicket={() => {
                    setActiveTab('home');
                    setBuyTicketDraw(draws[0]);
                  }}
                  onOpenLiveGame={(game) => {
                    if (game === 'dragon_tiger') setIsDragonTigerOpen(true);
                    else if (game === 'roulette') setIsLiveRouletteOpen(true);
                    else if (game === 'andar_bahar') setIsAndarBaharOpen(true);
                    else if (game === 'aviator') setIsCrashGameOpen(true);
                  }}
                  onOpenCasino={() => {
                    setIsDragonTigerOpen(true);
                  }}
                  onOpenDeposit={() => setIsDepositOpen(true)}
                  onOpenWithdraw={() => setActiveTab('withdrawal')}
                  onOpenSupportChat={(msg) => {
                    if (msg) setSupportChatPrefill(msg);
                    setIsSupportChatOpen(true);
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <ResultsView
                  draws={draws}
                  lotteryResults={lotteryResults}
                  supercarPastDraws={supercarPastDraws}
                  supercarConfig={supercarConfig}
                  onOpenBuyTicket={(d) => setBuyTicketDraw(d)}
                />
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <ProfileView
                  user={user}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  tickets={tickets}
                  transactions={unifiedTransactions}
                  onOpenDeposit={() => setIsDepositOpen(true)}
                  onOpenWithdraw={() => setActiveTab('withdrawal')}
                  onLogout={handleLogout}
                  onClaimVipBonus={handleClaimVipBonus}
                  onUpdateSettings={handleUpdateUserSettings}
                  onOpenSettings={() => setActiveTab('settings')}
                  onOpenSupportChat={() => setIsSupportChatOpen(true)}
                  onUpdateUser={(updated) => setUser(updated)}
                  onOpenAdmin={isVerifiedAdmin ? () => setIsAdminMode(true) : undefined}
                  onOpenReferral={() => setIsReferralModalOpen(true)}
                />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <SettingsView
                  user={user}
                  onUpdateSettings={handleUpdateUserSettings}
                  onBack={() => setActiveTab('profile')}
                  onUpdateUser={(updated) => setUser(updated)}
                  onOpenWithdraw={() => setActiveTab('withdrawal')}
                  onOpenSupportChat={() => setIsSupportChatOpen(true)}
                  onOpenPwaNotifications={() => setIsPwaNotificationOpen(true)}
                  onLogout={handleLogout}
                />
              </motion.div>
            )}

            {activeTab === 'offers' && (
              <motion.div
                key="offers"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <OffersView
                  offers={promotionalOffers}
                  onClaimOffer={(offer) => {
                    soundFx.playClick();
                  }}
                  onOpenDeposit={() => setIsDepositOpen(true)}
                  onOpenCasino={() => {
                    if (isDragonTigerEnabled) setIsDragonTigerOpen(true);
                    else if (isRouletteEnabled) setIsLiveRouletteOpen(true);
                    else if (isAndarBaharEnabled) setIsAndarBaharOpen(true);
                    else if (isCrashGameOpen) setIsCrashGameOpen(true);
                    else setActiveTab('home');
                  }}
                  onOpenSuperCar={() => {
                    if (isSuperCarEnabled) setIsSuperCarOpen(true);
                    else setActiveTab('home');
                  }}
                  onOpenLottery={() => {
                    setActiveTab('lottery');
                  }}
                  onOpenWheel={() => {
                    if (isLuckyWheelEnabled) setIsLuckyWheelOpen(true);
                  }}
                  onBack={() => setActiveTab('home')}
                />
              </motion.div>
            )}
        </AnimatePresence>
      </main>

      {/* Fixed Responsive Bottom Navigation */}
      {!isAnyLiveGameOpen && (
        <BottomNav
          activeTab={activeTab === 'settings' ? 'profile' : activeTab}
          onSelectTab={(tab) => {
            if (tab === 'lucky_wheel') {
              if (isLuckyWheelEnabled) {
                setIsLuckyWheelOpen(true);
              } else {
                alert(gameStatuses.lucky_wheel?.maintenanceMessage || 'Lucky Wheel is currently under maintenance.');
              }
            } else {
              setActiveTab(tab);
            }
          }}
          onOpenMenu={() => setIsUserMenuOpen(true)}
          activeTicketsCount={activeTicketsCount}
          onOpenRoulette={isRouletteEnabled ? () => setIsLiveRouletteOpen(true) : undefined}
          onOpenAndarBahar={isAndarBaharEnabled ? () => setIsAndarBaharOpen(true) : undefined}
          onOpenCrash={isCrashEnabled ? () => setIsCrashGameOpen(true) : undefined}
          onOpenDragonTiger={isDragonTigerEnabled ? () => setIsDragonTigerOpen(true) : undefined}
        />
      )}

      {/* Responsive User Navigation Drawer / Side Menu */}
      <UserSideMenu
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        user={user}
        activeTicketsCount={activeTicketsCount}
        onSelectTab={(tab) => {
          if (tab === 'lucky_wheel') {
            if (isLuckyWheelEnabled) setIsLuckyWheelOpen(true);
          } else {
            setActiveTab(tab as any);
          }
        }}
        onOpenCasino={() => {
          if (isDragonTigerEnabled) setIsDragonTigerOpen(true);
          else if (isRouletteEnabled) setIsLiveRouletteOpen(true);
          else if (isAndarBaharEnabled) setIsAndarBaharOpen(true);
          else if (isCrashEnabled) setIsCrashGameOpen(true);
          else setActiveTab('home');
        }}
        onOpenSuperCar={isSuperCarEnabled ? () => setIsSuperCarOpen(true) : undefined}
        onOpenOffers={() => {
          setActiveTab('offers');
        }}
        onOpenPromoCode={() => setIsPromoCodeOpen(true)}
        onOpenDeposit={() => setIsDepositOpen(true)}
        onOpenSupportChat={() => setIsSupportChatOpen(true)}
        onOpenLuckyWheel={isLuckyWheelEnabled ? () => setIsLuckyWheelOpen(true) : undefined}
        onOpenAdmin={isVerifiedAdmin ? () => setIsAdminMode(true) : undefined}
        onOpenPwaNotifications={() => setIsPwaNotificationOpen(true)}
        onOpenMapLocator={() => setIsOutletMapOpen(true)}
        onOpenReferral={() => setIsReferralModalOpen(true)}
        onLogout={handleLogout}
        onBalanceUpdated={(newBal, newBonusBal) => {
          setUser((prev) => prev ? ({
            ...prev,
            balance: newBal,
            bonusBalance: newBonusBal !== undefined ? newBonusBal : prev.bonusBalance
          }) : prev);
        }}
        onOpenDepositWithPromo={(promoCode) => {
          setIsUserMenuOpen(false);
          setDepositInitialPromo(promoCode);
          setIsDepositOpen(true);
        }}
      />

      {/* FULLSCREEN IMMERSIVE LIVE DRAGON TIGER CASINO MODULE */}
      {isDragonTigerOpen && (
        <DragonTigerGame
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            const enrichedTx: WalletTransaction = {
              ...tx,
              userId: tx.userId || user?.id || 'anonymous',
              userEmail: (tx.userEmail || user?.email || '').toLowerCase().trim(),
              userName: tx.userName || user?.name || 'Player',
              createdAt: tx.createdAt || new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([enrichedTx, ...prev.filter((t) => t.id !== enrichedTx.id)]));
            persistTransaction(enrichedTx);
            if (tx.type === 'bet' && user?.id) {
              recordUserWager(user.id, Math.abs(tx.amount), 'main').then((res) => {
                if (res.success) {
                  setUser((prev) => prev ? ({ ...prev, mainWagerCompleted: res.newMainCompleted }) : prev);
                }
              }).catch((e) => console.warn('Wager recording error in Dragon Tiger:', e));
            }
          }}
          onBigWin={(data) => setBigWinData(data)}
          onClose={() => setIsDragonTigerOpen(false)}
          onOpenDeposit={() => {
            setIsDragonTigerOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* FULLSCREEN IMMERSIVE LIVE AVIATOR CRASH GAME MODULE */}
      {isCrashGameOpen && (
        <AviatorCrashGame
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            const enrichedTx: WalletTransaction = {
              ...tx,
              userId: tx.userId || user?.id || 'anonymous',
              userEmail: (tx.userEmail || user?.email || '').toLowerCase().trim(),
              userName: tx.userName || user?.name || 'Player',
              createdAt: tx.createdAt || new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([enrichedTx, ...prev.filter((t) => t.id !== enrichedTx.id)]));
            persistTransaction(enrichedTx);
            if (tx.type === 'bet' && user?.id) {
              recordUserWager(user.id, Math.abs(tx.amount), 'main').then((res) => {
                if (res.success) {
                  setUser((prev) => prev ? ({ ...prev, mainWagerCompleted: res.newMainCompleted }) : prev);
                }
              }).catch((e) => console.warn('Wager recording error in Aviator Crash:', e));
            }
          }}
          onBigWin={(data) => setBigWinData(data)}
          onClose={() => setIsCrashGameOpen(false)}
          onOpenDeposit={() => {
            setIsCrashGameOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* FULLSCREEN IMMERSIVE LIVE ROULETTE CASINO MODULE */}
      {isLiveRouletteOpen && (
        <LiveRoulette
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            const enrichedTx: WalletTransaction = {
              ...tx,
              userId: tx.userId || user?.id || 'anonymous',
              userEmail: (tx.userEmail || user?.email || '').toLowerCase().trim(),
              userName: tx.userName || user?.name || 'Player',
              createdAt: tx.createdAt || new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([enrichedTx, ...prev.filter((t) => t.id !== enrichedTx.id)]));
            persistTransaction(enrichedTx);
            if (tx.type === 'bet' && user?.id) {
              recordUserWager(user.id, Math.abs(tx.amount), 'main').then((res) => {
                if (res.success) {
                  setUser((prev) => prev ? ({ ...prev, mainWagerCompleted: res.newMainCompleted }) : prev);
                }
              }).catch((e) => console.warn('Wager recording error in Roulette:', e));
            }
          }}
          onBigWin={(data) => setBigWinData(data)}
          onClose={() => setIsLiveRouletteOpen(false)}
          onOpenDeposit={() => {
            setIsLiveRouletteOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* FULLSCREEN IMMERSIVE LIVE ANDAR BAHAR CASINO MODULE */}
      {isAndarBaharOpen && (
        <AndarBaharGame
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            const enrichedTx: WalletTransaction = {
              ...tx,
              userId: tx.userId || user?.id || 'anonymous',
              userEmail: (tx.userEmail || user?.email || '').toLowerCase().trim(),
              userName: tx.userName || user?.name || 'Player',
              createdAt: tx.createdAt || new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([enrichedTx, ...prev.filter((t) => t.id !== enrichedTx.id)]));
            persistTransaction(enrichedTx);
            if (tx.type === 'bet' && user?.id) {
              recordUserWager(user.id, Math.abs(tx.amount), 'main').then((res) => {
                if (res.success) {
                  setUser((prev) => prev ? ({ ...prev, mainWagerCompleted: res.newMainCompleted }) : prev);
                }
              }).catch((e) => console.warn('Wager recording error in Andar Bahar:', e));
            }
          }}
          onBigWin={(data) => setBigWinData(data)}
          onClose={() => setIsAndarBaharOpen(false)}
          onOpenDeposit={() => {
            setIsAndarBaharOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* FULLSCREEN IMMERSIVE 3 SUPER CAR VIP ARENA MODULE */}
      {isSuperCarOpen && (
        <SuperCarArenaGame
          user={user}
          userBonusBalance={user.bonusBalance || 0}
          bonusRules={bonusRules}
          config={supercarConfig}
          currentIssue={supercarCurrentIssue}
          userTickets={tickets.filter((t) => t.category === 'Three Super Car Draw')}
          pastDraws={supercarPastDraws}
          initialSelectedCar={superCarSelectedColor}
          onConfirmBuyTicket={handleConfirmSuperCarTicketBuy}
          onDrawResolved={handleSuperCarDrawResolved}
          onClose={() => setIsSuperCarOpen(false)}
          onOpenDeposit={() => {
            setIsSuperCarOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* 100% FULL-SCREEN SEPARATE DEDICATED 3 SUPER CAR TICKET PURCHASE PAGE */}
      {superCarBuyPageCar && (
        <SuperCarTicketModal
          isOpen={!!superCarBuyPageCar}
          onClose={() => setSuperCarBuyPageCar(null)}
          selectedCarColor={superCarBuyPageCar}
          currentIssue={supercarCurrentIssue}
          userBalance={user.balance}
          userBonusBalance={user.bonusBalance || 0}
          bonusRules={bonusRules}
          ticketPrice={supercarConfig.ticketPrice || 100}
          bonusTicketPrice={supercarConfig.bonusTicketPrice}
          carPrices={supercarConfig.carPrices}
          bonusCarPrices={supercarConfig.bonusCarPrices}
          carMultipliers={supercarConfig.carMultipliers}
          allowBonusPurchase={supercarConfig.allowBonusPurchase !== false}
          prizeMultiplier={supercarConfig.prizeMultiplier || 2.8}
          slotDurationMinutes={supercarConfig.drawIntervalMinutes || 10}
          userTickets={tickets.filter((t) => t.category === 'Three Super Car Draw')}
          onConfirmBuy={(carColor, quantity, totalCost, walletType) => {
            const schedule = getCurrentSuperCarSchedule(supercarConfig);
            handleConfirmSuperCarTicketBuy(
              carColor,
              quantity,
              totalCost,
              schedule.issueId || supercarCurrentIssue?.issueId,
              schedule.drawIndex,
              walletType
            );
            setSuperCarBuyPageCar(null);
          }}
        />
      )}

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => {
          setIsDepositOpen(false);
          setDepositInitialPromo('');
        }}
        initialPromoCode={depositInitialPromo}
        onSubmitDeposit={handleDepositSubmit}
        existingDeposits={deposits}
        user={user}
        onOpenSupportChat={(msg) => {
          if (msg) setSupportChatPrefill(msg);
          setIsSupportChatOpen(true);
        }}
      />

      {/* Standalone Promo Code Redemption Modal (প্রোমো কোড রিডিম মডাল) */}
      <PromoCodeModal
        isOpen={isPromoCodeOpen}
        onClose={() => setIsPromoCodeOpen(false)}
        user={user}
        onBalanceUpdated={(newBal, newBonusBal) => {
          setUser((prev) => prev ? ({
            ...prev,
            balance: newBal,
            bonusBalance: newBonusBal !== undefined ? newBonusBal : prev.bonusBalance
          }) : prev);
        }}
        onOpenDepositWithPromo={(promoCode) => {
          setIsPromoCodeOpen(false);
          setDepositInitialPromo(promoCode);
          setIsDepositOpen(true);
        }}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        userBalance={user.balance}
        user={user}
        userVipLevel={user.vipLevel}
        onSubmitWithdrawal={handleWithdrawSubmit}
      />

      {/* Ticket Purchasing Drawer */}
      <TicketBuyModal
        draw={buyTicketDraw}
        userBalance={user.balance}
        userBonusBalance={user.bonusBalance || 0}
        bonusRules={bonusRules}
        onClose={() => setBuyTicketDraw(null)}
        onConfirmPurchase={handleConfirmTicketBuy}
      />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onClearAll={() => {
          const currentIds = notifications.map((n) => n.id);
          const activeUid = user?.id || (currentUser ? currentUser.uid : null);
          
          if (activeUid) {
            try {
              const storageKey = `betguru_deleted_ntfs_${activeUid}`;
              const raw = localStorage.getItem(storageKey);
              const prevDeleted: string[] = raw ? JSON.parse(raw) : [];
              const combined = Array.from(new Set([...prevDeleted, ...currentIds]));
              localStorage.setItem(storageKey, JSON.stringify(combined));
            } catch (_) {}
          }

          // Delete personal notifications or update global notification documents in Firestore
          currentIds.forEach((id) => {
            const target = notifications.find((n) => n.id === id);
            if (target) {
              if (target.userId === activeUid && !target.isGlobal) {
                deleteDoc(doc(db, 'notifications', id)).catch(() => {});
              } else if (activeUid) {
                setDoc(doc(db, 'notifications', id), {
                  deletedForUserIds: arrayUnion(activeUid)
                }, { merge: true }).catch(() => {});
              }
            }
          });

          setNotifications([]);
        }}
        onRemoveNotification={(id) => {
          const activeUid = user?.id || (currentUser ? currentUser.uid : null);
          
          if (activeUid) {
            try {
              const storageKey = `betguru_deleted_ntfs_${activeUid}`;
              const raw = localStorage.getItem(storageKey);
              const prevDeleted: string[] = raw ? JSON.parse(raw) : [];
              if (!prevDeleted.includes(id)) {
                prevDeleted.push(id);
                localStorage.setItem(storageKey, JSON.stringify(prevDeleted));
              }
            } catch (_) {}
          }

          const target = notifications.find((n) => n.id === id);
          if (target) {
            if (target.userId === activeUid && !target.isGlobal) {
              deleteDoc(doc(db, 'notifications', id)).catch(() => {});
            } else if (activeUid) {
              setDoc(doc(db, 'notifications', id), {
                deletedForUserIds: arrayUnion(activeUid)
              }, { merge: true }).catch(() => {});
            }
          }

          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }}
      />

      {/* Daily Lucky Wheel Modal */}
      <LuckyWheelModal
        isOpen={isLuckyWheelOpen && isLuckyWheelEnabled}
        onClose={() => setIsLuckyWheelOpen(false)}
        onClaimReward={handleClaimWheelReward}
        userSpinCredits={user.spinCredits || 0}
        userSpinTargetWallet={user.spinTargetWallet}
        onOpenDeposit={() => setIsDepositOpen(true)}
      />

      {/* User Referral Program & Invite Tracker Modal */}
      {isReferralModalOpen && (
        <ReferralModal
          user={user}
          onClose={() => setIsReferralModalOpen(false)}
          onOpenDeposit={() => {
            setIsReferralModalOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* Floating 24/7 Live Support Chat Modal & Trigger */}
      {user && !isAdminMode && (
        <LiveSupportChatModal
          user={user}
          isOpen={isSupportChatOpen}
          onOpen={() => setIsSupportChatOpen(true)}
          onClose={() => setIsSupportChatOpen(false)}
          onOpenDeposit={() => setIsDepositOpen(true)}
          onOpenWithdrawal={() => setActiveTab('withdrawal')}
          initialPrefilledText={supportChatPrefill}
          deposits={deposits}
          withdrawals={withdrawals}
          tickets={tickets}
        />
      )}

      {/* Real-time Global / Personal Notification Pop-up Toast */}
      {realtimeToast && (
        <div 
          onClick={() => handleNotificationClick(realtimeToast as any)}
          className="fixed top-20 right-4 z-50 max-w-sm w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400 rounded-2xl p-4 shadow-2xl shadow-amber-500/25 animate-slideIn cursor-pointer hover:border-amber-300 hover:scale-[1.02] active:scale-[0.99] transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center flex-shrink-0 text-amber-300 shadow-inner">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-black uppercase text-amber-400 tracking-wider">
                  {realtimeToast.priority || 'NEW ALERT'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRealtimeToast(null);
                  }}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-sm font-bold text-white truncate mt-0.5">{realtimeToast.title}</h4>
              <p className="text-xs text-slate-300 line-clamp-2 mt-1">{realtimeToast.message}</p>
              
              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-mono font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1">
                  <span>👉 সরাসরি খুলুন (Click to Open)</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRealtimeToast(null);
                    setIsNotificationsOpen(true);
                  }}
                  className="text-[10px] font-mono font-bold text-slate-400 hover:text-white underline underline-offset-2"
                >
                  Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VPN / PROXY SECURITY LOCKDOWN OVERLAY */}
      {user && user.vpnBlocked && user.role !== 'admin' && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-500/30 text-center space-y-5 font-mono animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide">
                VPN / Proxy Access Blocked
              </h3>
              <p className="text-xs text-rose-300 font-bold">
                ভিপিএন বা প্রক্সি ব্যবহার করে গেমিং বা লগইন সাময়িকভাবে নিষিদ্ধ
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our automated compliance security engine detected active VPN/Proxy routing or an administrator has restricted access for this account under fair-play guidelines.
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-900/50 text-[11px] text-slate-300 text-left space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Player UID:</span>
                <span className="text-white font-bold">{user.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Detected IP:</span>
                <span className="text-amber-400">{user.geoInfo?.ip || 'Protected'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Location:</span>
                <span className="text-white">{user.geoInfo?.city || 'Unknown'}, {user.geoInfo?.country || 'IN'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:from-amber-400 hover:to-yellow-400 transition-all cursor-pointer"
              >
                🔄 Turn Off VPN & Re-verify Connection
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8K ULTRA HD CELEBRATION BIG WIN MODAL */}
      <BigWinModal
        data={bigWinData}
        onClose={() => setBigWinData(null)}
        onViewDetails={() => {
          if (bigWinData?.category === 'lottery' || bigWinData?.category === 'supercar') {
            setActiveTab('tickets');
          } else if (bigWinData?.category === 'roulette') {
            setIsLiveRouletteOpen(true);
          } else if (bigWinData?.category === 'crash') {
            setIsCrashGameOpen(true);
          } else if (bigWinData?.category === 'dragon_tiger') {
            setIsDragonTigerOpen(true);
          } else if (bigWinData?.category === 'andar_bahar') {
            setIsAndarBaharOpen(true);
          }
        }}
      />

      {/* ANDROID NATIVE IN-APP UPDATE MODAL */}
      <AppUpdateModal
        isOpen={isAppUpdateOpen}
        config={appUpdateConfig}
        onClose={() => setIsAppUpdateOpen(false)}
      />

      {/* PWA HIGH-PRIORITY BACKGROUND PUSH NOTIFICATION MODAL */}
      <PWANotificationModal
        isOpen={isPwaNotificationOpen}
        onClose={() => setIsPwaNotificationOpen(false)}
        user={user}
        isAdmin={false}
      />

      {/* GOOGLE MAPS OUTLET & AGENT LOCATOR */}
      <GoogleMapOutletLocator
        isOpen={isOutletMapOpen}
        onClose={() => setIsOutletMapOpen(false)}
      />

    </div>
  );
}
