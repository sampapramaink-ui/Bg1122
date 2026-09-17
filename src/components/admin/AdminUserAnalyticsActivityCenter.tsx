import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Radio,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Trophy,
  Flame,
  Search,
  X,
  Eye,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  DollarSign,
  Activity,
  Layers,
  Dices,
  Smartphone,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  User,
  WalletTransaction,
  PurchasedTicket,
  DepositRequest,
  WithdrawalRequest,
  OnlineUserPresence,
  LiveUserActivityLog
} from '../../types';
import { soundFx } from '../../utils/audio';

interface AdminUserAnalyticsActivityCenterProps {
  allUsers: User[];
  allDeposits: DepositRequest[];
  allWithdrawals: WithdrawalRequest[];
  allTransactions: WalletTransaction[];
  allTickets: PurchasedTicket[];
  onOpenUserDossier: (user: User) => void;
  onNavigateTab?: (tabName: string) => void;
}

export type DateFilterMode = 'today' | 'yesterday' | 'calendar' | 'last7days' | 'this_month' | 'all_time';

export type DrilldownCategory =
  | 'registrations'
  | 'online_now'
  | 'recent_online'
  | 'deposits'
  | 'withdrawals'
  | 'bets'
  | 'wins'
  | 'losses'
  | null;

// Helper: Normalize date from various formats (Timestamp, ISO, DD/MM/YYYY, etc.) to 'YYYY-MM-DD'
export const normalizeToDateString = (val: any): string | null => {
  if (!val) return null;
  
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return null;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    // DD/MM/YYYY or D/M/YYYY
    const partsSlash = trimmed.split('/');
    if (partsSlash.length === 3) {
      const p0 = parseInt(partsSlash[0], 10);
      const p1 = parseInt(partsSlash[1], 10);
      const p2 = parseInt(partsSlash[2], 10);
      if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
        if (p0 > 12 && p1 <= 12) {
          // DD/MM/YYYY
          return `${p2}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        } else if (p1 > 12 && p0 <= 12) {
          // MM/DD/YYYY
          return `${p2}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        } else {
          // Default DD/MM/YYYY for India
          return `${p2}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        }
      }
    }
    // Try native Date parser
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  return null;
};

// Helper: Format YYYY-MM-DD into human readable Bengali/English
export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.toLocaleDateString('bn-BD', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) + ` (${d.toLocaleDateString('en-GB')})`;
};

export const AdminUserAnalyticsActivityCenter: React.FC<AdminUserAnalyticsActivityCenterProps> = ({
  allUsers,
  allDeposits,
  allWithdrawals,
  allTransactions,
  allTickets,
  onOpenUserDossier,
  onNavigateTab
}) => {
  // 1. Date Filter States
  const [filterMode, setFilterMode] = useState<DateFilterMode>('today');
  
  // Today and Yesterday Date Strings in 'YYYY-MM-DD'
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Selected Custom Date from Calendar (default to today)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);

  // 2. Real-Time Online Presence via Firestore (0-second latency)
  const [presenceUsers, setPresenceUsers] = useState<OnlineUserPresence[]>([]);
  const [liveActivities, setLiveActivities] = useState<LiveUserActivityLog[]>([]);

  useEffect(() => {
    // A. Presence snapshot (all online users with lastSeen heartbeats)
    const unsubPresence = onSnapshot(
      collection(db, 'user_presence'),
      (snap) => {
        const list: OnlineUserPresence[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as OnlineUserPresence);
        });
        setPresenceUsers(list);
      },
      (err) => console.warn('User presence listener error:', err)
    );

    // B. Live activities snapshot (recent logins, bets, actions)
    const q = query(collection(db, 'live_activities'), orderBy('timestamp', 'desc'), limit(100));
    const unsubActs = onSnapshot(
      q,
      (snap) => {
        const list: LiveUserActivityLog[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as LiveUserActivityLog);
        });
        setLiveActivities(list);
      },
      (err) => console.warn('Live activities listener error:', err)
    );

    return () => {
      unsubPresence();
      unsubActs();
    };
  }, []);

  // 3. Drilldown Modal State
  const [drilldownCategory, setDrilldownCategory] = useState<DrilldownCategory>(null);
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');

  // Target Date String determination based on filterMode
  const activeDateTarget = useMemo(() => {
    if (filterMode === 'today') return todayStr;
    if (filterMode === 'yesterday') return yesterdayStr;
    if (filterMode === 'calendar') return selectedCalendarDate;
    return null;
  }, [filterMode, todayStr, yesterdayStr, selectedCalendarDate]);

  // Quick Date Shift Helper for Calendar Mode (Previous Day / Next Day)
  const handleShiftDate = (days: number) => {
    soundFx.playClick();
    const cur = new Date(selectedCalendarDate);
    if (!isNaN(cur.getTime())) {
      cur.setDate(cur.getDate() + days);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      setSelectedCalendarDate(`${y}-${m}-${day}`);
      setFilterMode('calendar');
    }
  };

  // 4. Date Checker Function for Records
  const isRecordInSelectedPeriod = (recordDateOrTs: any): boolean => {
    if (filterMode === 'all_time') return true;

    const recordDateStr = normalizeToDateString(recordDateOrTs);
    if (!recordDateStr) return false;

    if (filterMode === 'today' || filterMode === 'yesterday' || filterMode === 'calendar') {
      return recordDateStr === activeDateTarget;
    }

    if (filterMode === 'last7days') {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      const recDate = new Date(recordDateStr);
      return recDate >= sevenDaysAgo && recDate <= now;
    }

    if (filterMode === 'this_month') {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return recordDateStr.startsWith(currentYearMonth);
    }

    return false;
  };

  // 5. Compute Real-Time Filtered Datasets & Metrics
  
  // A. Online Users Right Now (Active in last 3 minutes: 180,000 ms)
  const onlineNowUsersList = useMemo(() => {
    const now = Date.now();
    return presenceUsers
      .filter((p) => p.lastSeen && now - p.lastSeen < 180000)
      .map((p) => {
        const matchedUser = allUsers.find(
          (u) =>
            u.id === p.userId ||
            (u.linkedDocIds && u.linkedDocIds.includes(p.userId)) ||
            (p.userEmail && u.email && u.email.toLowerCase() === p.userEmail.toLowerCase())
        );
        return {
          ...p,
          userDoc: matchedUser || null,
          displayName: matchedUser?.name || p.userName || (p.userEmail ? p.userEmail.split('@')[0] : 'Player'),
          displayEmail: matchedUser?.email || p.userEmail || 'N/A',
          displayPhone: matchedUser?.phone || p.userPhone || 'N/A',
          displayBalance: matchedUser?.balance || p.balance || 0,
          displayBonus: matchedUser?.bonusBalance || 0,
          vipTier: matchedUser?.vipLevel || 'Bronze'
        };
      })
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }, [presenceUsers, allUsers]);

  // B. Recent Online Users (Active on the selected date / within the selected timeframe)
  const recentOnlineUsersList = useMemo(() => {
    const list: {
      userId: string;
      displayName: string;
      displayEmail: string;
      displayPhone: string;
      lastSeen: number;
      lastSeenDateStr: string;
      currentPage?: string;
      currentIp?: string;
      deviceInfo?: string;
      userDoc: User | null;
      displayBalance: number;
      vipTier: string;
    }[] = [];

    const userSeenMap = new Map<string, typeof list[0]>();

    // 1. From presenceUsers
    presenceUsers.forEach((p) => {
      if (p.lastSeen && isRecordInSelectedPeriod(p.lastSeen)) {
        const matchedUser = allUsers.find(
          (u) =>
            u.id === p.userId ||
            (u.linkedDocIds && u.linkedDocIds.includes(p.userId)) ||
            (p.userEmail && u.email && u.email.toLowerCase() === p.userEmail.toLowerCase())
        );
        const uId = matchedUser?.id || p.userId;
        const dStr = normalizeToDateString(p.lastSeen) || '';

        userSeenMap.set(uId, {
          userId: uId,
          displayName: matchedUser?.name || p.userName || 'Player',
          displayEmail: matchedUser?.email || p.userEmail || 'N/A',
          displayPhone: matchedUser?.phone || p.userPhone || 'N/A',
          lastSeen: p.lastSeen,
          lastSeenDateStr: dStr,
          currentPage: p.currentGame || 'Casino App',
          currentIp: 'Direct',
          deviceInfo: p.device || 'Mobile App',
          userDoc: matchedUser || null,
          displayBalance: matchedUser?.balance || p.balance || 0,
          vipTier: matchedUser?.vipLevel || 'Bronze'
        });
      }
    });

    // 2. From allUsers login history
    allUsers.forEach((u) => {
      if (u.locationHistory && Array.isArray(u.locationHistory)) {
        u.locationHistory.forEach((loc) => {
          const locTs = typeof loc.timestamp === 'number' ? loc.timestamp : new Date(loc.timestamp).getTime();
          if (locTs && isRecordInSelectedPeriod(locTs)) {
            const existing = userSeenMap.get(u.id);
            if (!existing || locTs > existing.lastSeen) {
              userSeenMap.set(u.id, {
                userId: u.id,
                displayName: u.name || 'Player',
                displayEmail: u.email || 'N/A',
                displayPhone: u.phone || 'N/A',
                lastSeen: locTs,
                lastSeenDateStr: normalizeToDateString(locTs) || '',
                currentPage: 'Casino App',
                currentIp: loc.ip || u.lastLoginLocation?.lastUpdated || 'Direct',
                deviceInfo: loc.deviceInfo || 'Mobile App',
                userDoc: u,
                displayBalance: u.balance || 0,
                vipTier: u.vipLevel || 'Bronze'
              });
            }
          }
        });
      }
    });

    return Array.from(userSeenMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [presenceUsers, allUsers, filterMode, activeDateTarget]);

  // C. New Registrations on Selected Date / Period
  const newRegistrationsList = useMemo(() => {
    return allUsers
      .filter((u) => {
        const regDateOrTs = u.regDate || (u as any).createdAt || (u as any).timestamp;
        return isRecordInSelectedPeriod(regDateOrTs);
      })
      .sort((a, b) => {
        const tsA = (a as any).createdAt || new Date(a.regDate || '').getTime() || 0;
        const tsB = (b as any).createdAt || new Date(b.regDate || '').getTime() || 0;
        return tsB - tsA;
      });
  }, [allUsers, filterMode, activeDateTarget]);

  // D. Deposits on Selected Date / Period
  const filteredDeposits = useMemo(() => {
    return allDeposits.filter((d) => isRecordInSelectedPeriod(d.createdAt || d.date));
  }, [allDeposits, filterMode, activeDateTarget]);

  const approvedDeposits = useMemo(() => filteredDeposits.filter((d) => d.status === 'approved'), [filteredDeposits]);
  const pendingDeposits = useMemo(() => filteredDeposits.filter((d) => d.status === 'pending'), [filteredDeposits]);
  const totalDepositAmount = useMemo(() => approvedDeposits.reduce((sum, d) => sum + (d.amount || 0), 0), [approvedDeposits]);

  // E. Withdrawals on Selected Date / Period
  const filteredWithdrawals = useMemo(() => {
    return allWithdrawals.filter((w) => isRecordInSelectedPeriod(w.createdAt || w.date));
  }, [allWithdrawals, filterMode, activeDateTarget]);

  const approvedWithdrawals = useMemo(() => filteredWithdrawals.filter((w) => w.status === 'approved'), [filteredWithdrawals]);
  const pendingWithdrawals = useMemo(() => filteredWithdrawals.filter((w) => w.status === 'pending'), [filteredWithdrawals]);
  const totalWithdrawalAmount = useMemo(() => approvedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0), [approvedWithdrawals]);

  // F. Betting & Casino Transactions on Selected Date / Period
  const filteredBetTransactions = useMemo(() => {
    const bets: {
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      userPhone: string;
      userDoc: User | null;
      gameType: 'roulette' | 'andar_bahar' | 'dragon_tiger' | 'crash' | 'supercar' | 'lottery';
      gameTitle: string;
      gameIcon: string;
      betAmount: number;
      wonAmount: number;
      outcome: 'win' | 'loss' | 'pending';
      timestamp: number | string;
      dateStr: string;
      description: string;
    }[] = [];

    // 1. From Wallet Transactions (Casino games)
    allTransactions.forEach((tx) => {
      if (isRecordInSelectedPeriod(tx.createdAt || tx.date)) {
        const matchedUser = allUsers.find(
          (u) =>
            u.id === tx.userId ||
            (u.linkedDocIds && u.linkedDocIds.includes(tx.userId)) ||
            (tx.userEmail && u.email && u.email.toLowerCase() === tx.userEmail.toLowerCase())
        );
        const uName = matchedUser?.name || tx.userName || 'Player';
        const uEmail = matchedUser?.email || tx.userEmail || tx.userId;
        const uPhone = matchedUser?.phone || 'N/A';
        const dStr = normalizeToDateString(tx.createdAt || tx.date) || '';

        if (tx.type === 'roulette_bet' || tx.type === 'roulette_win') {
          const isWin = tx.type === 'roulette_win';
          bets.push({
            id: tx.id,
            userId: tx.userId,
            userName: uName,
            userEmail: uEmail,
            userPhone: uPhone,
            userDoc: matchedUser || null,
            gameType: 'roulette',
            gameTitle: '⚡ European Roulette',
            gameIcon: '🎰',
            betAmount: isWin ? 0 : Math.abs(tx.amount || 0),
            wonAmount: isWin ? Math.abs(tx.amount || 0) : 0,
            outcome: isWin ? 'win' : 'loss',
            timestamp: tx.createdAt || tx.date || '',
            dateStr: dStr,
            description: tx.description || 'Roulette Live Bet'
          });
        } else if (tx.type === 'andar_bahar_bet' || tx.type === 'andar_bahar_win') {
          const isWin = tx.type === 'andar_bahar_win';
          bets.push({
            id: tx.id,
            userId: tx.userId,
            userName: uName,
            userEmail: uEmail,
            userPhone: uPhone,
            userDoc: matchedUser || null,
            gameType: 'andar_bahar',
            gameTitle: '🎴 Andar Bahar Casino',
            gameIcon: '🃏',
            betAmount: isWin ? 0 : Math.abs(tx.amount || 0),
            wonAmount: isWin ? Math.abs(tx.amount || 0) : 0,
            outcome: isWin ? 'win' : 'loss',
            timestamp: tx.createdAt || tx.date || '',
            dateStr: dStr,
            description: tx.description || 'Andar Bahar Bet'
          });
        } else if (tx.type === 'dragon_tiger_bet' || tx.type === 'dragon_tiger_win') {
          const isWin = tx.type === 'dragon_tiger_win';
          bets.push({
            id: tx.id,
            userId: tx.userId,
            userName: uName,
            userEmail: uEmail,
            userPhone: uPhone,
            userDoc: matchedUser || null,
            gameType: 'dragon_tiger',
            gameTitle: '🐉 Dragon Tiger Casino',
            gameIcon: '🐲',
            betAmount: isWin ? 0 : Math.abs(tx.amount || 0),
            wonAmount: isWin ? Math.abs(tx.amount || 0) : 0,
            outcome: isWin ? 'win' : 'loss',
            timestamp: tx.createdAt || tx.date || '',
            dateStr: dStr,
            description: tx.description || 'Dragon Tiger Bet'
          });
        } else if (tx.type === 'crash_bet' || tx.type === 'crash_win' || tx.type === 'aviator_bet' || tx.type === 'aviator_win') {
          const isWin = tx.type === 'crash_win' || tx.type === 'aviator_win';
          bets.push({
            id: tx.id,
            userId: tx.userId,
            userName: uName,
            userEmail: uEmail,
            userPhone: uPhone,
            userDoc: matchedUser || null,
            gameType: 'crash',
            gameTitle: '✈️ Aviator Crash Game',
            gameIcon: '🚀',
            betAmount: isWin ? 0 : Math.abs(tx.amount || 0),
            wonAmount: isWin ? Math.abs(tx.amount || 0) : 0,
            outcome: isWin ? 'win' : 'loss',
            timestamp: tx.createdAt || tx.date || '',
            dateStr: dStr,
            description: tx.description || 'Aviator Crash Bet'
          });
        }
      }
    });

    // 2. From Purchased Tickets (Lottery & SuperCar Draws)
    allTickets.forEach((t) => {
      if (isRecordInSelectedPeriod(t.createdAt || t.purchaseDate || (t as any).date)) {
        const matchedUser = allUsers.find(
          (u) =>
            u.id === t.userId ||
            (u.linkedDocIds && u.linkedDocIds.includes(t.userId)) ||
            ((t as any).userEmail && u.email && u.email.toLowerCase() === (t as any).userEmail.toLowerCase())
        );
        const uName = matchedUser?.name || (t as any).userName || 'Player';
        const uEmail = matchedUser?.email || (t as any).userEmail || t.userId;
        const uPhone = matchedUser?.phone || 'N/A';
        const isSuperCar = t.category === 'Three Super Car Draw';
        const dStr = normalizeToDateString(t.createdAt || t.purchaseDate || (t as any).date) || '';

        const betAmt = t.price || 100;
        const wonAmt = t.status === 'win' ? (t.wonAmount || (isSuperCar ? Math.round(betAmt * 2.8) : 100000)) : 0;
        const outcome = t.status === 'win' ? 'win' : t.status === 'loss' ? 'loss' : 'pending';

        bets.push({
          id: t.id,
          userId: t.userId,
          userName: uName,
          userEmail: uEmail,
          userPhone: uPhone,
          userDoc: matchedUser || null,
          gameType: isSuperCar ? 'supercar' : 'lottery',
          gameTitle: isSuperCar ? '🏎️ Super Car Draw' : `🎟️ ${t.drawTitle || 'Lottery Draw'}`,
          gameIcon: isSuperCar ? '🏎️' : '🎟️',
          betAmount: betAmt,
          wonAmount: wonAmt,
          outcome: outcome,
          timestamp: t.purchaseDate || t.createdAt || '',
          dateStr: dStr,
          description: `Ticket: ${(t.selectedNumbers || []).join(', ')}`
        });
      }
    });

    return bets.sort((a, b) => {
      const tsA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime() || 0;
      const tsB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime() || 0;
      return tsB - tsA;
    });
  }, [allTransactions, allTickets, allUsers, filterMode, activeDateTarget]);

  // Aggregate Bet Stats
  const totalBetAmount = useMemo(() => {
    return filteredBetTransactions.reduce((sum, b) => sum + b.betAmount, 0);
  }, [filteredBetTransactions]);

  const totalWonAmount = useMemo(() => {
    return filteredBetTransactions.reduce((sum, b) => sum + b.wonAmount, 0);
  }, [filteredBetTransactions]);

  const totalLostAmount = useMemo(() => {
    // Player Losses / House Gross Margin
    const lost = totalBetAmount - totalWonAmount;
    return lost;
  }, [totalBetAmount, totalWonAmount]);

  const netCashFlow = useMemo(() => {
    return totalDepositAmount - totalWithdrawalAmount;
  }, [totalDepositAmount, totalWithdrawalAmount]);

  // 6. Drilldown Items Resolution based on Category
  const drilldownData = useMemo(() => {
    if (!drilldownCategory) return [];

    const q = drilldownSearch.toLowerCase().trim();

    if (drilldownCategory === 'registrations') {
      return newRegistrationsList
        .filter((u) => {
          if (!q) return true;
          return (
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.phone && u.phone.includes(q)) ||
            u.id.toLowerCase().includes(q)
          );
        })
        .map((u) => ({
          id: u.id,
          title: u.name || 'Player',
          subtitle: `${u.email} • Phone: ${u.phone || 'N/A'}`,
          time: u.regDate || 'Today',
          badge: u.vipLevel || 'Bronze',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          amount: u.balance,
          amountLabel: 'Balance',
          amountColor: 'text-emerald-400',
          userDoc: u
        }));
    }

    if (drilldownCategory === 'online_now') {
      return onlineNowUsersList
        .filter((p) => {
          if (!q) return true;
          return (
            p.displayName.toLowerCase().includes(q) ||
            p.displayEmail.toLowerCase().includes(q) ||
            p.displayPhone.includes(q) ||
            p.userId.toLowerCase().includes(q)
          );
        })
        .map((p) => ({
          id: p.userId,
          title: p.displayName,
          subtitle: `${p.displayEmail} • App: ${p.currentGame || p.device || 'Live'} • Phone: ${p.displayPhone}`,
          time: p.lastSeen ? new Date(p.lastSeen).toLocaleTimeString('en-IN') : 'Now',
          badge: '🟢 ONLINE NOW',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
          amount: p.displayBalance,
          amountLabel: 'Balance',
          amountColor: 'text-emerald-400',
          userDoc: p.userDoc
        }));
    }

    if (drilldownCategory === 'recent_online') {
      return recentOnlineUsersList
        .filter((p) => {
          if (!q) return true;
          return (
            p.displayName.toLowerCase().includes(q) ||
            p.displayEmail.toLowerCase().includes(q) ||
            p.displayPhone.includes(q) ||
            p.userId.toLowerCase().includes(q)
          );
        })
        .map((p) => ({
          id: p.userId,
          title: p.displayName,
          subtitle: `${p.displayEmail} • ${p.deviceInfo || 'App'} • IP: ${p.currentIp || 'Direct'}`,
          time: p.lastSeen ? new Date(p.lastSeen).toLocaleString('en-IN') : 'Recent',
          badge: '🕒 ACTIVE',
          badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          amount: p.displayBalance,
          amountLabel: 'Balance',
          amountColor: 'text-emerald-400',
          userDoc: p.userDoc
        }));
    }

    if (drilldownCategory === 'deposits') {
      return filteredDeposits
        .filter((d) => {
          if (!q) return true;
          return (
            (d.userName && d.userName.toLowerCase().includes(q)) ||
            (d.userPhone && d.userPhone.includes(q)) ||
            (d.utr && d.utr.toLowerCase().includes(q)) ||
            d.userId.toLowerCase().includes(q)
          );
        })
        .map((d) => {
          const matchedUser = allUsers.find((u) => u.id === d.userId || (u.linkedDocIds && u.linkedDocIds.includes(d.userId)));
          return {
            id: d.id,
            title: d.userName || matchedUser?.name || 'Player',
            subtitle: `UTR: ${d.utr || 'N/A'} • Method: ${d.method?.toUpperCase() || 'UPI'} • Phone: ${d.userPhone || matchedUser?.phone || 'N/A'}`,
            time: d.date || 'Today',
            badge: d.status.toUpperCase(),
            badgeColor:
              d.status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : d.status === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40',
            amount: d.amount,
            amountLabel: 'Deposit Amount',
            amountColor: 'text-emerald-400',
            userDoc: matchedUser || null
          };
        });
    }

    if (drilldownCategory === 'withdrawals') {
      return filteredWithdrawals
        .filter((w) => {
          if (!q) return true;
          return (
            (w.userName && w.userName.toLowerCase().includes(q)) ||
            (w.fullName && w.fullName.toLowerCase().includes(q)) ||
            (w.userPhone && w.userPhone.includes(q)) ||
            (w.upiId && w.upiId.toLowerCase().includes(q)) ||
            w.userId.toLowerCase().includes(q)
          );
        })
        .map((w) => {
          const matchedUser = allUsers.find((u) => u.id === w.userId || (u.linkedDocIds && u.linkedDocIds.includes(w.userId)));
          return {
            id: w.id,
            title: w.userName || w.fullName || matchedUser?.name || 'Player',
            subtitle: `UPI/Acc: ${w.upiId || w.accountNumber || 'N/A'} • Bank: ${w.bankName || 'UPI'} • Phone: ${w.userPhone || matchedUser?.phone || 'N/A'}`,
            time: w.date || 'Today',
            badge: w.status.toUpperCase(),
            badgeColor:
              w.status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : w.status === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40',
            amount: w.amount,
            amountLabel: 'Withdrawal Amount',
            amountColor: 'text-rose-400',
            userDoc: matchedUser || null
          };
        });
    }

    if (drilldownCategory === 'bets' || drilldownCategory === 'wins' || drilldownCategory === 'losses') {
      const subset = filteredBetTransactions.filter((b) => {
        if (drilldownCategory === 'wins' && b.outcome !== 'win') return false;
        if (drilldownCategory === 'losses' && b.outcome !== 'loss') return false;
        if (!q) return true;
        return (
          b.userName.toLowerCase().includes(q) ||
          b.userEmail.toLowerCase().includes(q) ||
          b.gameTitle.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        );
      });

      return subset.map((b) => ({
        id: b.id,
        title: `${b.gameIcon} ${b.gameTitle}`,
        subtitle: `Player: ${b.userName} (${b.userEmail}) • ${b.description}`,
        time: typeof b.timestamp === 'number' ? new Date(b.timestamp).toLocaleTimeString('en-IN') : b.timestamp,
        badge: b.outcome.toUpperCase(),
        badgeColor:
          b.outcome === 'win'
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : b.outcome === 'loss'
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        amount: b.outcome === 'win' ? b.wonAmount : b.betAmount,
        amountLabel: b.outcome === 'win' ? 'Payout' : 'Wagered',
        amountColor: b.outcome === 'win' ? 'text-yellow-400' : 'text-slate-200',
        userDoc: b.userDoc
      }));
    }

    return [];
  }, [
    drilldownCategory,
    drilldownSearch,
    newRegistrationsList,
    onlineNowUsersList,
    recentOnlineUsersList,
    filteredDeposits,
    filteredWithdrawals,
    filteredBetTransactions,
    allUsers
  ]);

  const drilldownTitle = useMemo(() => {
    switch (drilldownCategory) {
      case 'registrations':
        return `🆕 নতুন রেজিস্ট্রেশন তালিকা (${drilldownData.length})`;
      case 'online_now':
        return `🟢 এখন লাইভ অনলাইন ইউজার (${drilldownData.length})`;
      case 'recent_online':
        return `🕒 রিসেন্ট অনলাইন ও অ্যাক্টিভ ইউজার (${drilldownData.length})`;
      case 'deposits':
        return `📥 ডিপোজিট ট্রানজেকশন তালিকা (${drilldownData.length})`;
      case 'withdrawals':
        return `📤 উইথড্রয়াল পেআউট তালিকা (${drilldownData.length})`;
      case 'bets':
        return `🎰 মোট বেটিং ইতিহাস ও টিকিট (${drilldownData.length})`;
      case 'wins':
        return `🏆 ইউজারদের মোট জয়ের পেআউট (${drilldownData.length})`;
      case 'losses':
        return `📉 ইউজারদের লস্ট ও কোম্পানির মার্জিন (${drilldownData.length})`;
      default:
        return '';
    }
  }, [drilldownCategory, drilldownData.length]);

  return (
    <div className="space-y-6 font-mono animate-in fade-in duration-200">
      
      {/* HEADER: Filter Bar with Today, Yesterday, and Calendar Picker */}
      <div className="bg-slate-900/90 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-amber-500/40 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl text-slate-950 shadow-lg shadow-amber-500/20 font-black">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  REAL-TIME USER & FINANCIAL ACTIVITY INTELLIGENCE
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>0s ZERO LAG LIVE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                লাইভ অনলাইন ইউজার, নতুন রেজিস্ট্রেশন, ডিপোজিট, উইথড্রয়াল এবং রিয়েলটাইম বেটিং পরিসংখ্যান (Today / Yesterday / Calendar)
              </p>
            </div>
          </div>

          {/* Quick Date Indicator */}
          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-xs">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Selected Date:</span>
            <span className="font-black text-amber-300 font-mono">
              {filterMode === 'all_time' ? 'ALL TIME (সব সময়)' : formatDisplayDate(activeDateTarget || todayStr)}
            </span>
          </div>
        </div>

        {/* TIME RANGE FILTER TABS & CALENDAR PICKER ROW */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: 'today', label: '⚡ TODAY (আজকে)', desc: todayStr },
              { id: 'yesterday', label: '⏮️ YESTERDAY (গতকাল)', desc: yesterdayStr },
              { id: 'last7days', label: '📅 LAST 7 DAYS (৭ দিন)' },
              { id: 'this_month', label: '🗓️ THIS MONTH (এই মাস)' },
              { id: 'all_time', label: '♾️ ALL TIME (সব সময়)' }
            ].map((p) => {
              const isActive = filterMode === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    soundFx.playClick();
                    setFilterMode(p.id as DateFilterMode);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-amber-500/20 scale-[1.02]'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* INTERACTIVE CALENDAR DATE PICKER */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-amber-500/30">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Previous Day (আগের দিন)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <input
                type="date"
                value={selectedCalendarDate}
                onChange={(e) => {
                  soundFx.playClick();
                  setSelectedCalendarDate(e.target.value);
                  setFilterMode('calendar');
                }}
                className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Next Day (পরের দিন)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {filterMode === 'calendar' && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/40 font-black">
                CUSTOM
              </span>
            )}
          </div>

        </div>
      </div>

      {/* 8 INTERACTIVE METRIC CARDS (TAP ANY TO DRILLDOWN) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: NEW REGISTRATIONS */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('registrations');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 hover:border-blue-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold">
              TAP TO VIEW →
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            {filterMode === 'today' ? 'Today Registrations (আজকে)' : filterMode === 'yesterday' ? 'Yesterday Registrations' : 'New Registrations'}
          </span>
          <p className="text-2xl sm:text-3xl font-black text-blue-400 mt-1 font-mono">
            {newRegistrationsList.length} <span className="text-xs font-normal text-slate-400">Players</span>
          </p>
          <span className="text-[10px] text-slate-500 mt-2 block">
            মোট নিবন্ধিত অ্যাকাউন্ট: {allUsers.length}
          </span>
        </button>

        {/* CARD 2: LIVE ONLINE NOW (0s DELAY) */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('online_now');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/40 hover:border-emerald-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              LIVE NOW
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Live Online Now (এখন অনলাইনে)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono">
            {onlineNowUsersList.length} <span className="text-xs font-normal text-slate-400">Active</span>
          </p>
          <span className="text-[10px] text-slate-500 mt-2 block">
            বিগত ৩ মিনিটে সক্রিয় ইউজার
          </span>
        </button>

        {/* CARD 3: RECENT ONLINE / ACTIVE USERS */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('recent_online');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 hover:border-cyan-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
              TAP TO VIEW →
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Recent Online (রিসেন্ট অ্যাক্টিভ)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-cyan-300 mt-1 font-mono">
            {recentOnlineUsersList.length} <span className="text-xs font-normal text-slate-400">Players</span>
          </p>
          <span className="text-[10px] text-slate-500 mt-2 block">
            নির্বাচিত তারিখে লগইন/অ্যাক্টিভ ইউজার
          </span>
        </button>

        {/* CARD 4: TOTAL DEPOSITS */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('deposits');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
              {approvedDeposits.length} APPROVED
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Total Deposits (মোট ডিপোজিট)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono">
            ₹{totalDepositAmount.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-amber-400/90 mt-2 block">
            {pendingDeposits.length} Requests Pending Approval
          </span>
        </button>

        {/* CARD 5: TOTAL WITHDRAWALS */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('withdrawals');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 hover:border-rose-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
              {approvedWithdrawals.length} APPROVED
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Total Withdrawals (মোট উইথড্রয়াল)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 font-mono">
            ₹{totalWithdrawalAmount.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-rose-300/80 mt-2 block">
            {pendingWithdrawals.length} Pending Bank Payouts
          </span>
        </button>

        {/* CARD 6: TOTAL BETTING AMOUNT */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('bets');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 hover:border-amber-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <Dices className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
              {filteredBetTransactions.length} BETS PLACED
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Total Bet Amount (মোট বেটিং)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono">
            ₹{totalBetAmount.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-500 mt-2 block">
            ক্যাসিনো, সুপারকার ও লটারি বেটস
          </span>
        </button>

        {/* CARD 7: TOTAL WON AMOUNT */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('wins');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-yellow-950/40 via-slate-900 to-slate-900 border border-yellow-500/30 hover:border-yellow-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-yellow-500/20 text-yellow-400 group-hover:bg-yellow-500 group-hover:text-slate-950 transition-colors">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-2 py-0.5 rounded-full font-bold">
              PAYOUTS
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Total Won Amount (মোট জয়/উইন)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-yellow-400 mt-1 font-mono">
            ₹{totalWonAmount.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-500 mt-2 block">
            ইউজারদের দেওয়া উইনিং পেআউট
          </span>
        </button>

        {/* CARD 8: TOTAL LOST / PLATFORM PROFIT */}
        <button
          onClick={() => {
            soundFx.playClick();
            setDrilldownCategory('losses');
          }}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 hover:border-purple-400 hover:scale-[1.02] transition-all text-left group shadow-xl cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              totalLostAmount >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {totalLostAmount >= 0 ? 'HOUSE PROFIT' : 'PLAYER PROFIT'}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-sans font-medium block">
            Total Lost / Profit (মোট লস্ট / লাভ)
          </span>
          <p className={`text-2xl sm:text-3xl font-black mt-1 font-mono ${
            totalLostAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            ₹{Math.abs(totalLostAmount).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-500 mt-2 block">
            {totalLostAmount >= 0 ? 'কোম্পানির গ্রস লাভ (বেট - পেআউট)' : 'কোম্পানির নেট ঘাটতি'}
          </span>
        </button>

      </div>

      {/* SUMMARY BAR: CASH FLOW & REAL-TIME ACTIVITY SUMMARY */}
      <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px]">NET CASH FLOW (DEP - WTH):</span>
            <span className={`text-base font-black ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{netCashFlow.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-slate-500 block text-[10px]">TOTAL BETTING TURNOVER:</span>
            <span className="text-base font-black text-amber-400">
              ₹{totalBetAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-slate-500 block text-[10px]">PLATFORM GROSS MARGIN (RTP):</span>
            <span className="text-base font-black text-purple-400">
              {totalBetAmount > 0 ? `${((totalWonAmount / totalBetAmount) * 100).toFixed(1)}% RTP` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFx.playCoin();
              setDrilldownCategory('online_now');
            }}
            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-slate-950 font-bold text-xs rounded-xl border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>লাইভ অনলাইন ({onlineNowUsersList.length})</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setDrilldownCategory('registrations');
            }}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-xs rounded-xl border border-blue-500/40 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>নতুন রেজিস্ট্রেশন ({newRegistrationsList.length})</span>
          </button>
        </div>
      </div>

      {/* DRILLDOWN MODAL: DETAILED LIST OF USERS / TRANSACTIONS / BETS */}
      {drilldownCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/40 w-full max-w-5xl rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>{drilldownTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    যে কোনো ইউজারের কার্ডে ক্লিক করলে তার সমস্ত ট্রানজেকশন, বেটিং ও প্রোফাইল ডসিয়ার ওপেন হবে।
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  soundFx.playClick();
                  setDrilldownCategory(null);
                  setDrilldownSearch('');
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  placeholder="ইউজার নাম, ইমেইল, ফোন, গেম বা UTR দিয়ে খুঁজুন..."
                  className="w-full bg-slate-900 text-white pl-9 pr-8 py-2 rounded-xl text-xs border border-slate-700 focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-500"
                />
                {drilldownSearch && (
                  <button
                    onClick={() => setDrilldownSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400 shrink-0">
                দেখাচ্ছে: <strong className="text-amber-400 font-mono">{drilldownData.length}</strong> টি রেকর্ড
              </div>
            </div>

            {/* Modal Table / List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {drilldownData.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">কোনো রেকর্ড পাওয়া যায়নি</p>
                  <p className="text-xs text-slate-600">
                    নির্বাচিত তারিখে এই ক্যাটাগরির কোনো ডেটা নেই অথবা সার্চ ফিল্টারে মিলছে না।
                  </p>
                </div>
              ) : (
                drilldownData.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-sm flex items-center justify-center shrink-0">
                        {item.title.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                            {item.title}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Time/Date: {item.time}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                      {item.amount !== undefined && (
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-500 block">{item.amountLabel}</span>
                          <span className={`text-sm font-black font-mono ${item.amountColor}`}>
                            ₹{item.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {item.userDoc ? (
                        <button
                          onClick={() => {
                            soundFx.playCoin();
                            onOpenUserDossier(item.userDoc!);
                          }}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title="View Full User Betting & Financial Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ডিটেইলস ডসিয়ার</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">User Record</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">
                💡 যে কোনো ইউজারের উপর ক্লিক করে তাদের সম্পূর্ণ ট্রানজেকশন ও বেটিং ইতিহাস দেখা যাবে।
              </span>
              <button
                onClick={() => {
                  soundFx.playClick();
                  setDrilldownCategory(null);
                }}
                className="px-4 py-1.5 bg-slate-850 hover:bg-slate-750 text-white rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
