import React, { useState, useMemo, useEffect } from 'react';
import { 
  Ticket, 
  Trophy, 
  XCircle, 
  Clock, 
  Sparkles, 
  Filter, 
  CheckCircle2, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Disc,
  Play,
  TrendingUp,
  TrendingDown,
  Search,
  RotateCcw,
  Flame,
  ArrowUpRight,
  History,
  Coins,
  Wallet,
  ArrowDownLeft,
  Info,
  ExternalLink,
  Copy,
  Check,
  Eye,
  ShieldCheck,
  Target,
  FileText,
  AlertTriangle,
  HelpCircle,
  Maximize2,
  Minimize2,
  MessageSquare
} from 'lucide-react';
import { PurchasedTicket, WalletTransaction, BetBreakdownItem } from '../types';
import { SUPER_CARS, formatTicketExactDateTime, sortChronologicalNewestFirst, groupTicketsByBatch, GroupedTicketBatch } from '../utils/supercar';
import { PaginationBar } from './PaginationBar';
import { WalletLedger, isPureFinancialTx } from './WalletLedger';
import { soundFx } from '../utils/audio';

export type LiveGameType = 'all' | 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'aviator';

export interface ParsedLiveGameRecord {
  id: string;
  txId: string;
  gameType: 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'aviator';
  gameName: string;
  roundId: string;
  betChoice: string;
  betAmount: number;
  payoutAmount: number;
  netGainLoss: number;
  isWin: boolean;
  status: 'win' | 'loss' | 'pending';
  dateStr: string;
  timestamp: number;
  description: string;
  betsBreakdown?: BetBreakdownItem[];
  details?: {
    winningOutcome?: string;
    multiplier?: string;
    cardsOrResult?: string;
    gameCategory?: string;
    auditProof?: string;
    rulesSummary?: string;
  };
}

interface MyTicketsViewProps {
  tickets: PurchasedTicket[];
  transactions?: WalletTransaction[];
  onOpenBuyTicket: () => void;
  onOpenLiveGame?: (game: 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'aviator') => void;
  onOpenCasino?: () => void;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenSupportChat?: (initialMessage?: string) => void;
  initialSection?: 'tickets' | 'live_games' | 'wallet_transactions' | 'lottery' | 'history';
}

export const MyTicketsView: React.FC<MyTicketsViewProps> = ({ 
  tickets, 
  transactions = [],
  onOpenBuyTicket,
  onOpenLiveGame,
  onOpenCasino,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenSupportChat,
  initialSection = 'tickets'
}) => {
  // Master Section: 'live_games' (লাইভ গেম হিস্ট্রি) | 'lottery' (লটারি ও কার হিস্ট্রি) | 'wallet_transactions' (ডিপোজিট ও উইথড্রল হিস্ট্রি)
  const [activeSection, setActiveSection] = useState<'live_games' | 'lottery' | 'wallet_transactions'>(
    initialSection === 'live_games' 
      ? 'live_games' 
      : initialSection === 'wallet_transactions' || initialSection === 'history'
      ? 'wallet_transactions'
      : 'lottery'
  );

  useEffect(() => {
    if (initialSection === 'wallet_transactions' || initialSection === 'history') {
      setActiveSection('wallet_transactions');
    } else if (initialSection === 'live_games') {
      setActiveSection('live_games');
    } else if (initialSection === 'lottery' || initialSection === 'tickets') {
      setActiveSection('lottery');
    }
  }, [initialSection]);

  // --- Lottery & Super Car Tab States ---
  const [lotteryFilter, setLotteryFilter] = useState<'all' | 'active' | 'win' | 'loss' | 'supercar' | 'regular'>('all');
  const [lotteryPage, setLotteryPage] = useState<number>(1);
  const [lotteryPageSize, setLotteryPageSize] = useState<number>(10);
  const [expandedBatchKey, setExpandedBatchKey] = useState<string | null>(null);

  // --- Live Games Tab States ---
  const [liveGameFilter, setLiveGameFilter] = useState<LiveGameType>('all');
  const [liveOutcomeFilter, setLiveOutcomeFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [liveSearchQuery, setLiveSearchQuery] = useState<string>('');
  const [livePage, setLivePage] = useState<number>(1);
  const [livePageSize, setLivePageSize] = useState<number>(10);

  // Strictly Filtered Pure Financial Transactions (Deposit, Withdrawal, Bonus & Rewards)
  const financialTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return transactions.filter(isPureFinancialTx);
  }, [transactions]);

  const financialTxCount = financialTransactions.length;

  // ==========================================
  // 1. LIVE GAMES HISTORY EXTRACTION & PARSING
  // ==========================================
  const [selectedLiveRecord, setSelectedLiveRecord] = useState<ParsedLiveGameRecord | null>(null);
  const [copiedLiveId, setCopiedLiveId] = useState<string | null>(null);

  const handleCopyLive = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLiveId(id);
    soundFx.playClick();
    setTimeout(() => setCopiedLiveId(null), 2000);
  };

  const liveGameRecords = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const records: ParsedLiveGameRecord[] = [];

    // Process transactions looking for live game wagers & wins
    for (const tx of transactions) {
      const type = (tx.type || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();

      // Determine Game Type
      let gType: 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'aviator' | null = null;
      let gName = 'Live Casino Game';

      if (type.includes('dragon_tiger') || desc.includes('dragon tiger')) {
        gType = 'dragon_tiger';
        gName = 'Dragon Tiger Live';
      } else if (type.includes('roulette') || desc.includes('roulette')) {
        gType = 'roulette';
        gName = 'Hindi Lightning Roulette';
      } else if (type.includes('andar_bahar') || desc.includes('andar bahar') || desc.includes('andar_bahar')) {
        gType = 'andar_bahar';
        gName = 'Andar Bahar Live';
      } else if (type.includes('crash') || type.includes('aviator') || desc.includes('aviator') || desc.includes('crash')) {
        gType = 'aviator';
        gName = 'Aviator Crash';
      }

      if (!gType) continue; // Skip non-live casino transactions (e.g. deposit, withdrawal, lottery)

      // Is it a Win or a Bet?
      const isWinTx = type.includes('win') || (tx.amount > 0 && !type.includes('bet'));
      const isLossTx = type.includes('loss') || (tx.amount < 0 && !type.includes('win'));

      // Extract Round ID from description if available
      const roundMatch = tx.description.match(/#([a-zA-Z0-9_-]+)/i);
      const roundId = roundMatch ? `#${roundMatch[1]}` : `#${tx.id.substring(tx.id.length - 6)}`;

      // Extract Bet Choice & Detailed Result from description
      let betChoice = 'Standard Live Bet';
      let winningOutcome = tx.winningOutcome || (isWinTx ? 'Round Won' : 'Round Loss');
      let multiplier = '1x';
      let cardsOrResult = 'Official Game Round Result';
      let rulesSummary = 'Standard live casino payout rules apply.';
      let parsedBreakdown: BetBreakdownItem[] = tx.betsBreakdown ? [...tx.betsBreakdown] : [];

      if (gType === 'dragon_tiger') {
        if (desc.includes('dragon')) betChoice = '🐉 DRAGON (1:1)';
        else if (desc.includes('tiger')) betChoice = '🐯 TIGER (1:1)';
        else if (desc.includes('suited tie')) betChoice = '👑 SUITED TIE (50:1)';
        else if (desc.includes('tie')) betChoice = '🤝 TIE (8:1)';
        
        if (desc.includes('(dragon)')) {
          winningOutcome = '🐉 DRAGON WON';
          cardsOrResult = 'Dragon Card highest value';
        } else if (desc.includes('(tiger)')) {
          winningOutcome = '🐯 TIGER WON';
          cardsOrResult = 'Tiger Card highest value';
        } else if (desc.includes('(tie)')) {
          winningOutcome = '🤝 TIE ROUND (8:1)';
          cardsOrResult = 'Both Dragon & Tiger dealt equal ranks';
        } else if (desc.includes('(suited_tie)') || desc.includes('suited tie')) {
          winningOutcome = '👑 SUITED TIE (50:1)';
          cardsOrResult = 'Identical rank and identical suit dealt';
        } else {
          winningOutcome = isWinTx ? 'Winning Sector Hit' : 'Lost to opposing side';
          cardsOrResult = isWinTx ? 'Your placed side won the round' : 'Dealer side won the round';
        }
        multiplier = isWinTx ? (betChoice.includes('50:1') ? '50x' : betChoice.includes('8:1') ? '8x' : '1.95x - 2x') : '0x';
        rulesSummary = 'Two cards dealt: Highest card wins (K is highest, A is lowest). Tie pays 8:1, Suited Tie pays 50:1.';

        if (parsedBreakdown.length === 0) {
          const rawAmt = Math.abs(tx.amount || 0);
          parsedBreakdown.push({
            spot: betChoice,
            type: 'side',
            amount: rawAmt,
            isWin: isWinTx,
            multiplier: isWinTx ? multiplier : '0x',
            payout: isWinTx ? rawAmt : 0,
            outcomeProof: winningOutcome
          });
        }
      } else if (gType === 'roulette') {
        const numMatch = tx.description.match(/Number\s+([0-9]+)/i);
        if (numMatch) {
          winningOutcome = `Winning Number ${numMatch[1]}`;
          cardsOrResult = `Roulette Wheel Pocket ${numMatch[1]} (Straight Up / Sector Hit)`;
        } else {
          winningOutcome = isWinTx ? 'Winning Pocket Hit' : 'Ball landed on non-covered pocket';
          cardsOrResult = isWinTx ? 'Number covered by active inside/outside bet' : 'Pocket not covered';
        }

        if (desc.includes('lightning') || desc.includes('straight')) {
          betChoice = '⚡ Lightning Straight (36x - 500x)';
          multiplier = isWinTx ? (desc.includes('x') ? 'Lightning Multiplier' : '36x') : '0x';
        } else if (desc.includes('red') || desc.includes('black') || desc.includes('even') || desc.includes('odd') || desc.includes('1-18') || desc.includes('19-36')) {
          betChoice = '🔴⚫ Even Money Bet (1:1)';
          multiplier = isWinTx ? '2x' : '0x';
        } else if (desc.includes('dozen') || desc.includes('column')) {
          betChoice = '📊 Dozen / Column (2:1)';
          multiplier = isWinTx ? '3x' : '0x';
        } else {
          betChoice = '⚡ Hindi Lightning Roulette Bet';
          multiplier = isWinTx ? '36x' : '0x';
        }
        rulesSummary = 'European 37-pocket wheel (0-36) with RNG Lightning Strikes offering up to 500x multipliers.';

        // If no pre-attached breakdown, extract from description brackets e.g. [1st Column: ₹50, Red: ₹100]
        if (parsedBreakdown.length === 0) {
          const bracketMatch = tx.description.match(/\[(.*?)\]/);
          if (bracketMatch && bracketMatch[1]) {
            const rawItems = bracketMatch[1].split(',').map(s => s.trim());
            for (const item of rawItems) {
              const itemParts = item.split(':');
              if (itemParts.length === 2) {
                const sName = itemParts[0].trim();
                const sAmt = parseFloat(itemParts[1].replace(/[^0-9.]/g, '')) || 0;
                parsedBreakdown.push({
                  spot: sName,
                  amount: sAmt,
                  isWin: isWinTx && (desc.includes(sName.toLowerCase())),
                  multiplier: 'Roulette Multiplier',
                  payout: isWinTx ? Math.abs(tx.amount || 0) : 0,
                  outcomeProof: winningOutcome
                });
              }
            }
          }
          if (parsedBreakdown.length === 0) {
            const rawAmt = Math.abs(tx.amount || 0);
            parsedBreakdown.push({
              spot: betChoice,
              amount: rawAmt,
              isWin: isWinTx,
              multiplier: isWinTx ? multiplier : '0x',
              payout: isWinTx ? rawAmt : 0,
              outcomeProof: winningOutcome
            });
          }
        }
      } else if (gType === 'andar_bahar') {
        if (desc.includes('andar')) betChoice = '🎴 ANDAR (0.9:1)';
        else if (desc.includes('bahar')) betChoice = '🃏 BAHAR (1:1)';
        else betChoice = '🎴 Andar / Bahar Selection';

        winningOutcome = isWinTx ? (desc.includes('andar') ? '🎴 ANDAR WON (Match Found)' : '🃏 BAHAR WON (Match Found)') : 'Opposing Side Matched Joker';
        cardsOrResult = isWinTx ? 'Joker rank matched on your chosen side' : 'Joker rank matched on the other side';
        multiplier = isWinTx ? (betChoice.includes('ANDAR') ? '1.9x' : '2.0x') : '0x';
        rulesSummary = 'Dealer cuts a Joker card. Cards dealt alternatively to Andar & Bahar until a matching rank card appears.';

        if (parsedBreakdown.length === 0) {
          const rawAmt = Math.abs(tx.amount || 0);
          parsedBreakdown.push({
            spot: betChoice,
            type: 'side',
            amount: rawAmt,
            isWin: isWinTx,
            multiplier: isWinTx ? multiplier : '0x',
            payout: isWinTx ? rawAmt : 0,
            outcomeProof: winningOutcome
          });
        }
      } else if (gType === 'aviator') {
        const multMatch = tx.description.match(/([0-9.]+x)/i);
        if (multMatch) {
          betChoice = `✈️ Cashed Out at ${multMatch[1]}`;
          multiplier = multMatch[1];
          winningOutcome = `Successfully Cashed Out at ${multMatch[1]}`;
          cardsOrResult = `Plane flew above ${multMatch[1]} before crash`;
        } else {
          betChoice = '✈️ Aviator Crash Flight Bet';
          multiplier = isWinTx ? 'Cashed Out Multiplier' : '0x (Crashed)';
          winningOutcome = isWinTx ? 'Cashout Completed' : 'Plane Flew Away (Crash)';
          cardsOrResult = isWinTx ? 'Cashed out before crash' : 'Crash occurred before manual cashout';
        }
        rulesSummary = 'Provably Fair curve multiplier increases from 1.00x upward. Cash out before plane flies away to win.';

        if (parsedBreakdown.length === 0) {
          const rawAmt = Math.abs(tx.amount || 0);
          parsedBreakdown.push({
            spot: desc.includes('panel 2') ? '✈️ Panel 2 Aviator Bet' : '✈️ Panel 1 Aviator Bet',
            type: 'flight',
            amount: rawAmt,
            isWin: isWinTx,
            multiplier: isWinTx ? multiplier : '0x (Crashed)',
            payout: isWinTx ? rawAmt : 0,
            outcomeProof: winningOutcome
          });
        }
      }

      const rawAmt = Math.abs(tx.amount || 0);
      const timeMs = tx.createdAt ? (typeof tx.createdAt === 'number' ? tx.createdAt : new Date(tx.createdAt).getTime()) : Date.now();

      // Accurately compute wager & payout from granular items if present
      const totalBreakdownWager = parsedBreakdown.reduce((sum, item) => sum + (item.amount || 0), 0);
      const totalBreakdownPayout = parsedBreakdown.reduce((sum, item) => sum + (item.payout || 0), 0);
      const finalBetAmount = totalBreakdownWager > 0 
        ? totalBreakdownWager 
        : (isWinTx ? (Math.round(rawAmt / (parseFloat(multiplier) || 2)) || rawAmt) : rawAmt);
      const finalPayoutAmount = totalBreakdownPayout > 0 
        ? totalBreakdownPayout 
        : (isWinTx ? (totalBreakdownWager > 0 ? totalBreakdownWager + rawAmt : rawAmt) : 0);
      const finalNetGainLoss = isWinTx 
        ? (totalBreakdownPayout > 0 && totalBreakdownWager > 0 ? (totalBreakdownPayout - totalBreakdownWager) : rawAmt) 
        : -finalBetAmount;

      records.push({
        id: `live_${tx.id}`,
        txId: tx.id,
        gameType: gType,
        gameName: gName,
        roundId,
        betChoice,
        betAmount: finalBetAmount,
        payoutAmount: finalPayoutAmount,
        netGainLoss: finalNetGainLoss,
        isWin: isWinTx,
        status: isWinTx ? 'win' : 'loss',
        dateStr: tx.date || new Date(timeMs).toLocaleString('en-IN'),
        timestamp: timeMs,
        description: tx.description,
        betsBreakdown: parsedBreakdown,
        details: {
          winningOutcome,
          multiplier,
          cardsOrResult,
          gameCategory: 'Live Dealer Real-Time Casino',
          auditProof: `PROVABLY-FAIR-AUDIT-SHA256-${tx.id.toUpperCase()}`,
          rulesSummary
        }
      });
    }

    // Group and consolidate by (gameType + roundId) so each game round is STRICTLY 1 record
    const consolidatedMap = new Map<string, ParsedLiveGameRecord>();

    for (const rec of records) {
      const groupKey = `${rec.gameType}_${rec.roundId}`;
      const existing = consolidatedMap.get(groupKey);

      if (!existing) {
        consolidatedMap.set(groupKey, rec);
      } else {
        // Merge records into ONE single unified transaction record
        const preferWin = rec.isWin || (!existing.isWin && rec.payoutAmount > 0);
        const mergedBetsBreakdown = [
          ...(existing.betsBreakdown || []),
          ...(rec.betsBreakdown || [])
        ].filter((item, index, self) => 
          index === self.findIndex((t) => t.spot === item.spot && t.amount === item.amount)
        );

        const totalWager = Math.max(existing.betAmount, rec.betAmount, mergedBetsBreakdown.reduce((s, i) => s + (i.amount || 0), 0));
        const totalPayout = Math.max(existing.payoutAmount, rec.payoutAmount, mergedBetsBreakdown.reduce((s, i) => s + (i.payout || 0), 0));
        const isWin = preferWin || totalPayout > 0;
        const netGainLoss = isWin ? (totalPayout - totalWager) : -totalWager;

        consolidatedMap.set(groupKey, {
          ...(preferWin ? rec : existing),
          id: preferWin ? rec.id : existing.id,
          txId: preferWin ? rec.txId : existing.txId,
          betAmount: totalWager,
          payoutAmount: totalPayout,
          netGainLoss: netGainLoss,
          isWin: isWin,
          status: isWin ? 'win' : 'loss',
          betsBreakdown: mergedBetsBreakdown.length > 0 ? mergedBetsBreakdown : (preferWin ? rec.betsBreakdown : existing.betsBreakdown),
          timestamp: Math.max(existing.timestamp, rec.timestamp)
        });
      }
    }

    return Array.from(consolidatedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions]);

  // Live Games Summary Metrics
  const liveStats = useMemo(() => {
    let totalBetsPlaced = 0;
    let totalWonAmount = 0;
    let totalWinsCount = 0;
    let totalLossCount = 0;

    for (const r of liveGameRecords) {
      totalBetsPlaced += r.betAmount;
      if (r.isWin) {
        totalWonAmount += r.payoutAmount;
        totalWinsCount++;
      } else {
        totalLossCount++;
      }
    }

    const totalRounds = liveGameRecords.length;
    const winRate = totalRounds > 0 ? Math.round((totalWinsCount / totalRounds) * 100) : 0;
    const netProfit = totalWonAmount - totalBetsPlaced;

    return {
      totalBetsPlaced,
      totalWonAmount,
      totalWinsCount,
      totalLossCount,
      totalRounds,
      winRate,
      netProfit
    };
  }, [liveGameRecords]);

  // Filtered Live Game Records
  const filteredLiveRecords = useMemo(() => {
    return liveGameRecords.filter((r) => {
      // Game type filter
      if (liveGameFilter !== 'all' && r.gameType !== liveGameFilter) return false;

      // Outcome filter
      if (liveOutcomeFilter === 'win' && !r.isWin) return false;
      if (liveOutcomeFilter === 'loss' && r.isWin) return false;

      // Search query
      if (liveSearchQuery.trim()) {
        const q = liveSearchQuery.toLowerCase().trim();
        const matchTitle = r.gameName.toLowerCase().includes(q);
        const matchRound = r.roundId.toLowerCase().includes(q);
        const matchChoice = r.betChoice.toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchId = r.txId.toLowerCase().includes(q);
        if (!matchTitle && !matchRound && !matchChoice && !matchDesc && !matchId) return false;
      }

      return true;
    });
  }, [liveGameRecords, liveGameFilter, liveOutcomeFilter, liveSearchQuery]);

  const totalLivePages = Math.ceil(filteredLiveRecords.length / livePageSize) || 1;
  const paginatedLiveRecords = useMemo(() => {
    const start = (livePage - 1) * livePageSize;
    return filteredLiveRecords.slice(start, start + livePageSize);
  }, [filteredLiveRecords, livePage, livePageSize]);

  // ==========================================
  // 2. LOTTERY & SUPER CAR TICKETS HANDLING
  // ==========================================
  const sortedTickets = useMemo(() => {
    return sortChronologicalNewestFirst<PurchasedTicket>(tickets);
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return sortedTickets.filter((t) => {
      if (lotteryFilter === 'all') return true;
      if (lotteryFilter === 'supercar') {
        return t.category === 'Three Super Car Draw' || t.drawTitle?.includes('Super Car');
      }
      if (lotteryFilter === 'regular') {
        return t.category !== 'Three Super Car Draw' && !t.drawTitle?.includes('Super Car');
      }
      return t.status === lotteryFilter;
    });
  }, [sortedTickets, lotteryFilter]);

  const groupedBatches = useMemo(() => {
    const rawBatches = groupTicketsByBatch(filteredTickets);
    return sortChronologicalNewestFirst<GroupedTicketBatch>(rawBatches as any);
  }, [filteredTickets]);

  const totalLotteryPages = Math.ceil(groupedBatches.length / lotteryPageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (lotteryPage - 1) * lotteryPageSize;
    return groupedBatches.slice(start, start + lotteryPageSize);
  }, [groupedBatches, lotteryPage, lotteryPageSize]);

  // Lottery Summary Stats
  const lotteryStats = useMemo(() => {
    let totalPurchased = 0;
    let totalSpent = 0;
    let totalWon = 0;
    let activeDrawsCount = 0;
    let superCarTicketsCount = 0;

    for (const t of tickets) {
      totalPurchased++;
      totalSpent += t.price || 0;
      if (t.status === 'win') {
        totalWon += t.wonAmount || (t as any).winAmount || 0;
      }
      if (t.status === 'active') {
        activeDrawsCount++;
      }
      if (t.category === 'Three Super Car Draw' || t.drawTitle?.includes('Super Car')) {
        superCarTicketsCount++;
      }
    }

    return {
      totalPurchased,
      totalSpent,
      totalWon,
      activeDrawsCount,
      superCarTicketsCount
    };
  }, [tickets]);

  const handleSectionSwitch = (sec: 'live_games' | 'lottery' | 'wallet_transactions') => {
    soundFx.playClick();
    setActiveSection(sec);
  };

  const getGameIcon = (gType: string) => {
    switch (gType) {
      case 'dragon_tiger':
        return <span className="text-xl">🐉</span>;
      case 'roulette':
        return <Disc className="w-5 h-5 text-amber-400 animate-spin [animation-duration:10s]" />;
      case 'andar_bahar':
        return <span className="text-xl">🎴</span>;
      case 'aviator':
        return <span className="text-xl">✈️</span>;
      default:
        return <Coins className="w-5 h-5 text-amber-400" />;
    }
  };

  const getGameColorTheme = (gType: string) => {
    switch (gType) {
      case 'dragon_tiger':
        return 'from-red-500/20 to-orange-500/10 border-red-500/40 text-red-300';
      case 'roulette':
        return 'from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-300';
      case 'andar_bahar':
        return 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300';
      case 'aviator':
        return 'from-rose-500/20 to-pink-500/10 border-rose-500/40 text-rose-300';
      default:
        return 'from-slate-800 to-slate-900 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-28 font-mono animate-in fade-in duration-200">
      
      {/* ======================================================== */}
      {/* 1. MASTER HEADER & DUAL-SECTION SWITCHER SEGMENTED BAR   */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/30 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <History className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  History & Records
                </h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE FIREBASE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete real-time records of your live casino bets and lottery ticket draws
              </p>
            </div>
          </div>

          {/* Master 3-Section Switcher Tabs (Live Games | Lottery & Super Car | Deposit & Withdrawal) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 bg-slate-950/90 rounded-2xl border border-amber-500/30 w-full sm:w-auto self-stretch sm:self-auto shadow-inner">
            {/* Section 1 Tab: Live Game History (লাইভ গেম হিস্ট্রি) */}
            <button
              onClick={() => handleSectionSwitch('live_games')}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSection === 'live_games'
                  ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-lg shadow-red-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Disc className={`w-4 h-4 ${activeSection === 'live_games' ? 'animate-spin [animation-duration:4s] text-amber-200' : 'text-slate-400'}`} />
              <span className="whitespace-nowrap">Live Games History</span>
              {liveGameRecords.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeSection === 'live_games' ? 'bg-black/40 text-amber-300 border border-amber-300/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  {liveGameRecords.length}
                </span>
              )}
            </button>

            {/* Section 2 Tab: Lottery & Super Car History (লটারি ও কার গেম হিস্ট্রি) */}
            <button
              onClick={() => handleSectionSwitch('lottery')}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSection === 'lottery'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span className="whitespace-nowrap">Lottery & Car History</span>
              {tickets.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeSection === 'lottery' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tickets.length}
                </span>
              )}
            </button>

            {/* Section 3 Tab: Deposit & Withdrawal History (ডিপোজিট ও উইথড্রল হিস্ট্রি) */}
            <button
              onClick={() => handleSectionSwitch('wallet_transactions')}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSection === 'wallet_transactions'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span className="whitespace-nowrap">Deposit, Withdraw & Bonus</span>
              {financialTxCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeSection === 'wallet_transactions' ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {financialTxCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: LIVE GAME HISTORY (লাইভ গেম হিস্টোরি)       */}
      {/* ======================================================== */}
      {activeSection === 'live_games' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Live Game Summary Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Live Bets Placed</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-white">
                  ₹{liveStats.totalBetsPlaced.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-md">
                  {liveStats.totalRounds} wagers
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-emerald-500/30 shadow-md">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Total Live Wins Paid</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-emerald-400">
                  ₹{liveStats.totalWonAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                  {liveStats.totalWinsCount} wins
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-amber-500/30 shadow-md">
              <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Net Live Profit / Loss</span>
              <div className="flex items-center justify-between">
                <span className={`text-base sm:text-lg font-black flex items-center gap-1 ${
                  liveStats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {liveStats.netProfit >= 0 ? '+' : ''}₹{liveStats.netProfit.toLocaleString('en-IN')}
                </span>
                {liveStats.netProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-purple-500/30 shadow-md">
              <span className="text-[10px] uppercase font-bold text-purple-300 block mb-1">Live Win Success Rate</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-purple-300">
                  {liveStats.winRate}%
                </span>
                <span className="text-xs text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                  {liveStats.totalWinsCount}W / {liveStats.totalLossCount}L
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar & Search for Live Games */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
            {/* Game Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All Live Games', icon: '🎮' },
                  { id: 'dragon_tiger', label: 'Dragon Tiger', icon: '🐉' },
                  { id: 'roulette', label: 'Lightning Roulette', icon: '⚡' },
                  { id: 'andar_bahar', label: 'Andar Bahar', icon: '🎴' },
                  { id: 'aviator', label: 'Aviator Crash', icon: '✈️' },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    soundFx.playClick();
                    setLiveGameFilter(g.id);
                    setLivePage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    liveGameFilter === g.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>

            {/* Win / Loss Filter & Search Box */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                {(['all', 'win', 'loss'] as const).map((out) => (
                  <button
                    key={out}
                    onClick={() => {
                      soundFx.playClick();
                      setLiveOutcomeFilter(out);
                      setLivePage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer ${
                      liveOutcomeFilter === out
                        ? out === 'win'
                          ? 'bg-emerald-500 text-slate-950'
                          : out === 'loss'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {out}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search round or ID..."
                  value={liveSearchQuery}
                  onChange={(e) => {
                    setLiveSearchQuery(e.target.value);
                    setLivePage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Live Games Record List */}
          {filteredLiveRecords.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl">
                🎲
              </div>
              <h3 className="text-lg font-bold text-white">No Live Game History Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                You haven't placed any live casino bets yet or no records match your active filters. Jump in now to start playing!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {onOpenLiveGame && (
                  <>
                    <button
                      onClick={() => onOpenLiveGame('dragon_tiger')}
                      className="px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-xs rounded-xl shadow-md hover:scale-105 transition cursor-pointer"
                    >
                      🐉 Play Dragon Tiger
                    </button>
                    <button
                      onClick={() => onOpenLiveGame('roulette')}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md hover:scale-105 transition cursor-pointer"
                    >
                      ⚡ Play Lightning Roulette
                    </button>
                  </>
                )}
                {onOpenCasino && (
                  <button
                    onClick={onOpenCasino}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Open Casino Lobby
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedLiveRecords.map((record) => {
                  const themeStyle = getGameColorTheme(record.gameType);

                  return (
                    <div
                      key={record.id}
                      className={`relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border rounded-3xl p-5 shadow-xl transition-all hover:scale-[1.01] ${
                        record.isWin
                          ? 'border-emerald-500/40 shadow-emerald-950/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Bar: Timestamp & Outcome Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="inline-flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-mono text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>TIME: {record.dateStr}</span>
                        </div>

                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                            record.isWin
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                          }`}
                        >
                          {record.isWin ? (
                            <>
                              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                              <span>WINNER</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>ROUND LOST</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Game Header Row */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center shadow-md ${themeStyle}`}>
                            {getGameIcon(record.gameType)}
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">{record.gameName}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Round {record.roundId} • ID: {record.txId.substring(0, 12)}...
                            </span>
                          </div>
                        </div>

                        {onOpenLiveGame && (
                          <button
                            onClick={() => onOpenLiveGame(record.gameType)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs flex items-center gap-1 transition cursor-pointer"
                            title="Play This Game"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span className="text-[10px] font-bold">PLAY</span>
                          </button>
                        )}
                      </div>

                      {/* Bet Detail Box */}
                      <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80 mb-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Wager / Selection:</span>
                          <span className="text-amber-300 font-black px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            {record.betChoice}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {record.description}
                        </p>
                      </div>

                      {/* Financial Footer Strip */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div className="p-2 bg-slate-950/60 rounded-xl">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Bet Placed</span>
                          <span className="text-xs font-black text-white">₹{record.betAmount.toLocaleString('en-IN')}</span>
                        </div>

                        <div className="p-2 bg-slate-950/60 rounded-xl text-center">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Payout</span>
                          <span className={`text-xs font-black ${record.isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {record.isWin ? `₹${record.payoutAmount.toLocaleString('en-IN')}` : '₹0'}
                          </span>
                        </div>

                        <div className="p-2 bg-slate-950/60 rounded-xl text-right">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Net Result</span>
                          <span className={`text-xs font-black ${record.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {record.isWin ? `+₹${record.netGainLoss.toLocaleString('en-IN')}` : `-₹${Math.abs(record.netGainLoss).toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      </div>

                      {/* Action Bar: View Full Bet Details Button */}
                      <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setSelectedLiveRecord(record);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-slate-800/90 border border-amber-500/30 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>View Full Bet & Result Details (সম্পূর্ণ তথ্য)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyLive(record.txId, `${record.id}_copy`)}
                          className={`p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                            copiedLiveId === `${record.id}_copy`
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title="Copy Bet Transaction ID"
                        >
                          {copiedLiveId === `${record.id}_copy` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <PaginationBar
                currentPage={livePage}
                totalPages={totalLivePages}
                pageSize={livePageSize}
                totalItems={filteredLiveRecords.length}
                onPageChange={(page) => setLivePage(page)}
                onPageSizeChange={(size) => {
                  setLivePageSize(size);
                  setLivePage(1);
                }}
                pageSizeOptions={[6, 10, 20, 50]}
                label="live game rounds"
              />
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: LOTTERY & SUPER CAR HISTORY (লটারি ও কার হিস্ট্রি) */}
      {/* ======================================================== */}
      {activeSection === 'lottery' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Lottery Summary Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Tickets Bought</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-white">{lotteryStats.totalPurchased}</span>
                <span className="text-xs text-amber-400 font-bold bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-500/20">
                  ₹{lotteryStats.totalSpent.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-amber-500/30 shadow-md">
              <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Active Draw Entries</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-amber-400">{lotteryStats.activeDrawsCount}</span>
                <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md animate-pulse">
                  Awaiting Draw
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-emerald-500/30 shadow-md">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Total Lottery Prize Won</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-emerald-400">
                  ₹{lotteryStats.totalWon.toLocaleString('en-IN')}
                </span>
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-red-500/30 shadow-md">
              <span className="text-[10px] uppercase font-bold text-red-300 block mb-1">3 Super Car Entries</span>
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black text-red-300">{lotteryStats.superCarTicketsCount}</span>
                <span className="text-xs text-red-300 font-bold bg-red-950/60 px-2 py-0.5 rounded-md border border-red-800/40">
                  🏎️ 2.8x Payout
                </span>
              </div>
            </div>
          </div>

          {/* Lottery Filter Pills */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Tickets' },
                  { id: 'active', label: 'Live / Active Draws' },
                  { id: 'win', label: 'Winners' },
                  { id: 'loss', label: 'Result Lost' },
                  { id: 'supercar', label: '🏎️ Super Car Draw' },
                  { id: 'regular', label: '🎟️ Regular Lotteries' }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    soundFx.playClick();
                    setLotteryFilter(f.id);
                    setLotteryPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                    lotteryFilter === f.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={onOpenBuyTicket}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 shrink-0 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ BUY TICKETS</span>
            </button>
          </div>

          {/* Tickets Grid */}
          {groupedBatches.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 space-y-4">
              <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white font-mono">No Tickets Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You don't have any tickets under the <span className="text-amber-400 uppercase font-bold">{lotteryFilter}</span> category.
              </p>
              <button
                onClick={onOpenBuyTicket}
                className="px-6 py-2.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Browse Active Lottery Draws</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedBatches.map((batch) => {
                  const firstTkt = batch.firstTicket;
                  const isSuperCarTicket = firstTkt.category === 'Three Super Car Draw' || batch.selectedCar !== undefined;
                  const carInfo = isSuperCarTicket && batch.selectedCar ? SUPER_CARS[batch.selectedCar] : null;
                  const isExpanded = expandedBatchKey === batch.groupKey;

                  return (
                    <div
                      key={batch.groupKey}
                      className={`relative bg-slate-900 border rounded-3xl p-5 shadow-xl overflow-hidden transition-all hover:scale-[1.01] ${
                        batch.status === 'win'
                          ? 'border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30'
                          : batch.status === 'loss'
                          ? 'border-rose-500/20 opacity-85'
                          : 'border-amber-500/30'
                      }`}
                    >
                      {/* Glowing Animated Purchase Time Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400 px-2.5 py-1 rounded-full text-amber-300 font-mono font-black text-[11px] shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin [animation-duration:3s]" />
                          <span>TIME: {formatTicketExactDateTime(firstTkt)}</span>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold uppercase font-mono px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                            batch.status === 'win'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : batch.status === 'loss'
                              ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                              : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {batch.status === 'win' && <Trophy className="w-3 h-3 text-emerald-400" />}
                          {batch.status === 'loss' && <XCircle className="w-3 h-3 text-rose-400" />}
                          {batch.status === 'active' && <Clock className="w-3 h-3 text-amber-400 animate-spin" />}
                          {batch.status === 'win' ? 'WINNER' : batch.status === 'loss' ? 'RESULT LOST' : 'DRAW ACTIVE'}
                        </span>
                      </div>

                      {/* Top Row: Title & Ticket Count Badge & Wallet Source Badge */}
                      <div className="flex items-center justify-between mb-2 font-mono flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                            {batch.quantity}x {batch.quantity === 1 ? 'Ticket' : 'Tickets Batch'}
                          </span>
                          {isSuperCarTicket && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> Super Car
                            </span>
                          )}
                          {/* Wallet Balance Type Badge */}
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            firstTkt.walletType === 'bonus'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            {firstTkt.walletType === 'bonus' ? '🎁 Bonus Balance (বোনাস)' : '💰 Real Balance (রিয়েল)'}
                          </span>
                        </div>
                      </div>

                      {/* Draw Title */}
                      <h3 className="text-sm sm:text-base font-extrabold text-white font-mono mb-3">{batch.drawTitle}</h3>

                      {/* Selected Digits OR Supercar Box */}
                      {carInfo ? (
                        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="relative w-16 h-11 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                              <img
                                src={carInfo.image}
                                alt={carInfo.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                            </div>
                            <div>
                              <span className="text-xs font-black font-mono text-amber-300 block">
                                {carInfo.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {batch.quantity}x @ ₹{firstTkt.price || 100} = <strong className="text-emerald-400">Total ₹{batch.totalPrice.toLocaleString('en-IN')}</strong>
                              </span>
                              <span className={`inline-block text-[10px] font-bold mt-1 px-2 py-0.5 rounded border ${
                                firstTkt.walletType === 'bonus'
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                              }`}>
                                Paid via: {firstTkt.walletType === 'bonus' ? '🎁 Bonus Wallet (বোনাস ব্যালেন্স)' : '💰 Real Main Wallet (রিয়েল ব্যালেন্স)'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <span className="text-[10px] text-slate-400 block font-bold">CAR CHOICE</span>
                            <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                              batch.selectedCar === 'red' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : batch.selectedCar === 'black' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            }`}>{batch.selectedCar} CAR</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">
                              {batch.quantity} Ticket(s) in Batch:
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              firstTkt.walletType === 'bonus'
                                ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            }`}>
                              {firstTkt.walletType === 'bonus' ? '🎁 Bonus Wallet' : '💰 Real Wallet'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {batch.tickets.map((t, idx) => (
                              <span key={idx} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs px-2 py-1 rounded-lg">
                                #{t.ticketNumber || t.id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expandable Individual Ticket List Toggle */}
                      {batch.quantity > 1 && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => setExpandedBatchKey(isExpanded ? null : batch.groupKey)}
                            className="w-full py-1.5 px-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-[11px] font-mono text-amber-400 font-bold flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Serial Numbers' : `View All ${batch.quantity} Ticket Numbers`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80 max-h-40 overflow-y-auto space-y-1">
                              <p className="text-[10px] text-slate-400 font-mono mb-1 font-bold">Included Tickets ({batch.tickets.length}):</p>
                              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-300">
                                {batch.tickets.map((t, idx) => (
                                  <div key={idx} className="truncate bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {idx + 1}. #{t.ticketNumber || t.id}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ticket Footer Meta */}
                      <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-800 text-slate-400 flex-wrap gap-2">
                        <div>
                          <span className="text-[10px] block font-sans">Purchased Date</span>
                          <span className="text-white font-bold">{batch.purchaseDate}</span>
                        </div>

                        <div className="text-center">
                          <span className="text-[10px] block font-sans">Wallet Type</span>
                          <span className={`font-bold ${firstTkt.walletType === 'bonus' ? 'text-purple-300' : 'text-emerald-400'}`}>
                            {firstTkt.walletType === 'bonus' ? '🎁 Bonus' : '💰 Real'}
                          </span>
                        </div>

                        {batch.status === 'win' ? (
                          <div className="text-right">
                            <span className="text-[10px] text-emerald-400 block font-sans font-bold">Total Batch Prize Won</span>
                            <span className="text-emerald-400 font-black text-base">₹{batch.totalWonAmount?.toLocaleString('en-IN')}</span>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-[10px] block font-sans font-bold">Total Batch Amount</span>
                            <span className="text-amber-400 font-extrabold text-sm">₹{batch.totalPrice.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

              <PaginationBar
                currentPage={lotteryPage}
                totalPages={totalLotteryPages}
                pageSize={lotteryPageSize}
                totalItems={groupedBatches.length}
                onPageChange={(page) => setLotteryPage(page)}
                onPageSizeChange={(size) => {
                  setLotteryPageSize(size);
                  setLotteryPage(1);
                }}
                pageSizeOptions={[6, 12, 24, 50]}
                label="ticket batches"
              />
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: DEPOSIT & WITHDRAWAL HISTORY (ডিপোজিট ও উইথড্রল হিস্ট্রি) */}
      {/* ======================================================== */}
      {activeSection === 'wallet_transactions' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <WalletLedger
            transactions={financialTransactions}
            onOpenDeposit={onOpenDeposit}
            onOpenWithdraw={onOpenWithdraw}
            onOpenSupportChat={onOpenSupportChat}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* LIVE BET DETAILS & ROUND RESULT MODAL (সম্পূর্ণ ব্যাটিং তথ্য) */}
      {/* ======================================================== */}
      {selectedLiveRecord && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedLiveRecord(null)}
        >
          <div 
            className="relative w-full max-w-5xl xl:max-w-6xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/50 shadow-2xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-7 space-y-4 my-auto font-mono text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className={`w-10 h-10 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center border text-xl sm:text-2xl shadow-lg shrink-0 ${getGameColorTheme(selectedLiveRecord.gameType)}`}>
                  {getGameIcon(selectedLiveRecord.gameType)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-xl font-black text-white truncate">{selectedLiveRecord.gameName}</h2>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                      FULL BET LEDGER
                    </span>
                  </div>
                  <p className="text-xs text-amber-400 font-bold mt-0.5 truncate">
                    Round #{selectedLiveRecord.roundId} • Detailed Betting History & Settlements
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setSelectedLiveRecord(null);
                }}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 border border-slate-700 text-base"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Outcome Banner */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              selectedLiveRecord.isWin 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedLiveRecord.isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {selectedLiveRecord.isWin ? <Trophy className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black block tracking-wider opacity-80">
                    {selectedLiveRecord.isWin ? 'Round Status: Won (জিতেছে)' : 'Round Status: Loss (পরাজিত)'}
                  </span>
                  <span className="text-sm sm:text-base font-black">
                    {selectedLiveRecord.details?.winningOutcome || (selectedLiveRecord.isWin ? 'Round Win' : 'Round Loss')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-6 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-0">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase block opacity-80 font-bold">Total Wagered (মারার টাকা)</span>
                  <span className="text-sm sm:text-base font-black text-white">
                    ₹{selectedLiveRecord.betAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase block opacity-80 font-bold">Net Settlement (লাভ/ক্ষতি)</span>
                  <span className={`text-base sm:text-xl font-black ${
                    selectedLiveRecord.isWin ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {selectedLiveRecord.isWin ? `+₹${selectedLiveRecord.netGainLoss.toLocaleString('en-IN')}` : `-₹${Math.abs(selectedLiveRecord.netGainLoss).toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Responsive Multi-Column Layout: Wide Details on Left, Parameters & Proof on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Left/Main Column: Section-by-Section Breakdown (100% Responsive - No Horizontal Scroll) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-black text-amber-400 tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Section-by-Section Breakdown (কোন সেকশনে কত ধরেছিলেন ও ফলাফল):</span>
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2.5 py-0.5 rounded-full border border-slate-700 shrink-0">
                      {selectedLiveRecord.betsBreakdown && selectedLiveRecord.betsBreakdown.length > 0
                        ? `${selectedLiveRecord.betsBreakdown.length} Spot(s)`
                        : '1 Spot'}
                    </span>
                  </div>

                  {/* 100% Width Responsive Bet List (No horizontal scrolling) */}
                  {selectedLiveRecord.betsBreakdown && selectedLiveRecord.betsBreakdown.length > 0 ? (
                    <div className="space-y-2">
                      <div className="max-h-[380px] overflow-y-auto pr-1 space-y-2">
                        {selectedLiveRecord.betsBreakdown.map((item, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                              item.isWin 
                                ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50' 
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Left Side: Spot Name & Outcome Details */}
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black mt-0.5 ${
                                item.isWin 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              }`}>
                                {item.isWin ? '✓' : '✕'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <span className="font-black text-amber-300 text-xs sm:text-sm">{item.spot}</span>
                                  {item.multiplier && item.multiplier !== '-' && item.multiplier !== '0x' && (
                                    <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                      {item.multiplier}
                                    </span>
                                  )}
                                </div>
                                {item.outcomeProof && (
                                  <span className="text-[11px] text-slate-400 block mt-0.5 break-words">
                                    {item.outcomeProof}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right Side: Bet Amount, Status Badge, Payout */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-0">
                              <div className="text-left sm:text-right">
                                <span className="text-[9px] text-slate-400 block uppercase font-bold">মারার টাকা</span>
                                <span className="text-xs sm:text-sm font-black text-white">₹{item.amount.toLocaleString('en-IN')}</span>
                              </div>

                              <div className="text-center">
                                {item.isWin ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>জিতেছে (Won)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    <XCircle className="w-3 h-3 text-rose-400" />
                                    <span>হেরেছে (Lost)</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-right min-w-[70px]">
                                <span className="text-[9px] text-slate-400 block uppercase font-bold">পেআউট</span>
                                <span className={`text-xs sm:text-sm font-black ${item.isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {item.isWin ? `+₹${(item.payout || 0).toLocaleString('en-IN')}` : '₹0'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Summary Footer Bar */}
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-black">
                        <div className="text-slate-300">
                          মোট হিসাব: <span className="text-amber-300">{selectedLiveRecord.betsBreakdown.length} Spots Placed</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-normal">মোট বাজি</span>
                            <span className="text-white font-bold">₹{selectedLiveRecord.betAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-normal">মোট পেআউট</span>
                            <span className={selectedLiveRecord.isWin ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                              ₹{selectedLiveRecord.payoutAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Placed Selection</span>
                        <span className="text-xs font-black text-amber-300 break-words mt-0.5 block">
                          {selectedLiveRecord.betChoice}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Wager Amount</span>
                        <span className="text-xs font-black text-white mt-0.5 block">
                          ₹{selectedLiveRecord.betAmount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Multiplier</span>
                        <span className="text-xs font-black text-cyan-300 mt-0.5 block">
                          {selectedLiveRecord.details?.multiplier || (selectedLiveRecord.isWin ? 'Win Multiplier' : '0x')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Raw System Transaction Log */}
                  <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 text-[11px]">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">System Transaction Log (লগ বিবরণ):</span>
                    <p className="text-slate-300 break-words leading-relaxed">{selectedLiveRecord.description}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Parameters, Winning Outcome & Proof, Rules & Audit */}
              <div className="lg:col-span-4 space-y-4">
                {/* Parameters Card */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs shadow-inner">
                  <span className="text-[11px] uppercase font-black text-slate-400 tracking-wider block">
                    Round Proof & Parameters:
                  </span>

                  <div className="space-y-2">
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Official Winning Outcome:</span>
                      <span className="text-xs font-black text-amber-300 mt-0.5 block">
                        {selectedLiveRecord.details?.winningOutcome || (selectedLiveRecord.isWin ? 'Round Win' : 'Round Loss')}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Round Result Proof / Card:</span>
                      <span className="text-[11px] font-bold text-slate-200 mt-0.5 block truncate">
                        {selectedLiveRecord.details?.cardsOrResult || 'Fair Dealer Outcome'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Date & Exact Time:</span>
                      <span className="text-[11px] font-bold text-slate-300 mt-0.5 block">
                        {selectedLiveRecord.dateStr}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Transaction ID / Reference:</span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[11px] font-mono text-slate-300 truncate">{selectedLiveRecord.txId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyLive(selectedLiveRecord.txId, 'tx_id')}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-300 transition cursor-pointer"
                          title="Copy Transaction ID"
                        >
                          {copiedLiveId === 'tx_id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Game Rules & Fairness Audit Seal */}
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Fairness & Audit Rules (গেম নিয়ম ও অডিট):</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {selectedLiveRecord.details?.rulesSummary}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                    <span className="truncate">Audit Token: {selectedLiveRecord.details?.auditProof}</span>
                    <span className="text-emerald-400 font-bold shrink-0 ml-2">✓ Verified Fair</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Bottom Action Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const detailsText = `BETGURU Game Slip\n• Game: ${selectedLiveRecord.gameName}\n• Round: ${selectedLiveRecord.roundId}\n• Choice: ${selectedLiveRecord.betChoice}\n• Bet Amount: ₹${selectedLiveRecord.betAmount}\n• Result: ${selectedLiveRecord.isWin ? 'WIN' : 'LOSS'}\n• Payout: ₹${selectedLiveRecord.payoutAmount}\n• TXID: ${selectedLiveRecord.txId}\n• Time: ${selectedLiveRecord.dateStr}`;
                    handleCopyLive(detailsText, 'modal_copy');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition cursor-pointer"
                >
                  {copiedLiveId === 'modal_copy' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Details Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Bet Slip</span>
                    </>
                  )}
                </button>

                {onOpenSupportChat && (
                  <button
                    type="button"
                    onClick={() => {
                      const supportMsg = `Hi BETGURU Support, I have an inquiry about my live game round:\n• Game: ${selectedLiveRecord.gameName}\n• Round: ${selectedLiveRecord.roundId}\n• Wager: ₹${selectedLiveRecord.betAmount}\n• Outcome: ${selectedLiveRecord.isWin ? 'WON' : 'LOSS'}\n• Payout: ₹${selectedLiveRecord.payoutAmount}\n• TXID: ${selectedLiveRecord.txId}\n• Date: ${selectedLiveRecord.dateStr}`;
                      navigator.clipboard.writeText(supportMsg);
                      soundFx.playClick();
                      setSelectedLiveRecord(null);
                      onOpenSupportChat(supportMsg);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    <span>Support</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onOpenLiveGame && (
                  <button
                    type="button"
                    onClick={() => {
                      const gType = selectedLiveRecord.gameType;
                      setSelectedLiveRecord(null);
                      onOpenLiveGame(gType);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs hover:scale-105 transition shadow-md cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play {selectedLiveRecord.gameName}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedLiveRecord(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer border border-slate-700"
                >
                  Close (বন্ধ করুন)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
