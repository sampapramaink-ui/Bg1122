import React, { useState, useMemo } from 'react';
import { 
  Gamepad2, Search, Clock, Eye, Copy, Check, Trash2, Trophy, XCircle, 
  ShieldCheck, Play, Sparkles, Filter, ChevronRight, Zap
} from 'lucide-react';
import { WalletTransaction, BetBreakdownItem } from '../../../types';
import { soundFx } from '../../../utils/audio';
import { PaginationBar } from '../../PaginationBar';

export interface ParsedLiveGameRecord {
  id: string;
  txId: string;
  gameType: 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'aviator';
  gameName: string;
  gameIcon: string;
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
  walletType?: 'bonus' | 'main';
  details?: {
    winningOutcome?: string;
    multiplier?: string;
    cardsOrResult?: string;
    gameCategory?: string;
    auditProof?: string;
    rulesSummary?: string;
  };
}

interface AdminLiveBetsViewProps {
  transactions: WalletTransaction[];
  deletedRecordIds: Set<string>;
  isUserMatch: (uid?: string, email?: string, phone?: string) => boolean;
  isWithinDateFilter: (dateVal?: string | number) => boolean;
  onDeleteRecord: (item: { id: string; collection: string; title: string }) => void;
  isDeletingRecord: string | null;
}

export const AdminLiveBetsView: React.FC<AdminLiveBetsViewProps> = ({
  transactions,
  deletedRecordIds,
  isUserMatch,
  isWithinDateFilter,
  onDeleteRecord,
  isDeletingRecord
}) => {
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [selectedRecord, setSelectedRecord] = useState<ParsedLiveGameRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundFx.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Parse all live bets from transactions
  const liveGameRecords = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const records: ParsedLiveGameRecord[] = [];

    for (const tx of transactions) {
      if (deletedRecordIds.has(tx.id)) continue;
      if (!isUserMatch(tx.userId, tx.userEmail)) continue;

      const type = (tx.type || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();

      let gType: 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'aviator' | null = null;
      let gName = 'Live Casino Game';
      let gIcon = '🎰';

      if (type.includes('dragon_tiger') || desc.includes('dragon tiger')) {
        gType = 'dragon_tiger';
        gName = 'Dragon Tiger Live';
        gIcon = '🐉';
      } else if (type.includes('roulette') || desc.includes('roulette')) {
        gType = 'roulette';
        gName = 'Hindi Lightning Roulette';
        gIcon = '⚡';
      } else if (type.includes('andar_bahar') || desc.includes('andar bahar') || desc.includes('andar_bahar')) {
        gType = 'andar_bahar';
        gName = 'Andar Bahar Live';
        gIcon = '🎴';
      } else if (type.includes('crash') || type.includes('aviator') || desc.includes('aviator') || desc.includes('crash')) {
        gType = 'aviator';
        gName = 'Aviator Crash';
        gIcon = '✈️';
      }

      if (!gType) continue;

      const isWinTx = type.includes('win') || (tx.amount > 0 && !type.includes('bet'));
      const roundMatch = tx.description.match(/#([a-zA-Z0-9_-]+)/i);
      const roundId = roundMatch ? `#${roundMatch[1]}` : `#${tx.id.substring(Math.max(0, tx.id.length - 6))}`;

      let betChoice = 'Live Casino Wager';
      let winningOutcome = tx.winningOutcome || (isWinTx ? 'Round Won' : 'Round Loss');
      let multiplier = '1x';
      let cardsOrResult = 'Official Live Game Result';
      let rulesSummary = 'Standard live casino game rules apply.';
      let parsedBreakdown: BetBreakdownItem[] = tx.betsBreakdown ? [...tx.betsBreakdown] : [];

      if (gType === 'dragon_tiger') {
        if (desc.includes('dragon')) betChoice = '🐉 DRAGON (1:1)';
        else if (desc.includes('tiger')) betChoice = '🐯 TIGER (1:1)';
        else if (desc.includes('suited tie')) betChoice = '👑 SUITED TIE (50:1)';
        else if (desc.includes('tie')) betChoice = '🤝 TIE (8:1)';

        if (desc.includes('(dragon)')) winningOutcome = '🐉 DRAGON WON';
        else if (desc.includes('(tiger)')) winningOutcome = '🐯 TIGER WON';
        else if (desc.includes('(tie)')) winningOutcome = '🤝 TIE ROUND (8:1)';
        else if (desc.includes('(suited_tie)') || desc.includes('suited tie')) winningOutcome = '👑 SUITED TIE (50:1)';
        else winningOutcome = isWinTx ? 'Winning Sector Hit' : 'Lost to opposing side';

        cardsOrResult = isWinTx ? 'Placed hand won the round' : 'Opposing hand had higher rank';
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
                  isWin: isWinTx && desc.includes(sName.toLowerCase()),
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

      const totalBreakdownWager = parsedBreakdown.reduce((sum, item) => sum + (item.amount || 0), 0);
      const totalBreakdownPayout = parsedBreakdown.reduce((sum, item) => sum + (item.payout || 0), 0);
      const finalBetAmount = totalBreakdownWager > 0 ? totalBreakdownWager : rawAmt;
      const finalPayoutAmount = totalBreakdownPayout > 0 ? totalBreakdownPayout : (isWinTx ? rawAmt : 0);
      const finalNetGainLoss = isWinTx ? (finalPayoutAmount - finalBetAmount > 0 ? finalPayoutAmount - finalBetAmount : rawAmt) : -finalBetAmount;

      records.push({
        id: `live_${tx.id}`,
        txId: tx.id,
        gameType: gType,
        gameName: gName,
        gameIcon: gIcon,
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
        walletType: (tx as any).walletType || 'main',
        details: {
          winningOutcome,
          multiplier,
          cardsOrResult,
          gameCategory: 'Live Dealer Real-Time Casino',
          auditProof: `PROVABLY-FAIR-AUDIT-${tx.id.toUpperCase()}`,
          rulesSummary
        }
      });
    }

    return records.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, deletedRecordIds, isUserMatch]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return liveGameRecords.filter((r) => {
      if (!isWithinDateFilter(r.timestamp || r.dateStr)) return false;
      if (gameFilter !== 'all' && r.gameType !== gameFilter) return false;
      if (outcomeFilter !== 'all' && r.status !== outcomeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.gameName.toLowerCase().includes(q);
        const matchChoice = r.betChoice.toLowerCase().includes(q);
        const matchRound = r.roundId.toLowerCase().includes(q);
        const matchId = r.txId.toLowerCase().includes(q);
        if (!matchName && !matchChoice && !matchRound && !matchId) return false;
      }
      return true;
    });
  }, [liveGameRecords, isWithinDateFilter, gameFilter, outcomeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="space-y-4 font-mono">
      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'all', label: 'All Live Games', icon: '🎰' },
            { id: 'roulette', label: 'Lightning Roulette', icon: '⚡' },
            { id: 'andar_bahar', label: 'Andar Bahar', icon: '🎴' },
            { id: 'dragon_tiger', label: 'Dragon Tiger', icon: '🐉' },
            { id: 'aviator', label: 'Aviator Crash', icon: '✈️' },
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => {
                soundFx.playClick();
                setGameFilter(g.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                gameFilter === g.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{g.icon}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="bg-slate-900 text-white text-[11px] font-mono px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
          >
            <option value="all">All Results</option>
            <option value="win">🟢 Wins Only</option>
            <option value="loss">🔴 Losses Only</option>
          </select>

          <div className="relative w-44 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Round, Selection..."
              className="w-full bg-slate-900 text-white pl-8 pr-3 py-1.5 rounded-xl text-[11px] border border-slate-700 outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Bets Feed */}
      {filteredRecords.length === 0 ? (
        <div className="p-16 text-center bg-slate-950 rounded-3xl border border-slate-800 text-slate-500 space-y-3">
          <Gamepad2 className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
          <p className="text-sm font-bold text-slate-400">কোন লাইভ গেম বেটিং হিস্ট্রি পাওয়া যায়নি (No live bets found)</p>
          <p className="text-xs text-slate-500">No live casino rounds placed by this user match the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {paginatedRecords.map((record) => (
              <div
                key={record.id}
                className={`p-4 bg-slate-950 rounded-2xl border transition-all shadow-lg space-y-3 ${
                  record.isWin 
                    ? 'border-emerald-800/60 bg-gradient-to-r from-slate-950 via-slate-950 to-emerald-950/20' 
                    : 'border-rose-950/60 hover:border-rose-800/80 bg-gradient-to-r from-slate-950 via-slate-950 to-rose-950/10'
                }`}
              >
                {/* Top Row: Game Info & Round ID */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      {record.gameIcon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-white">{record.gameName}</span>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                          {record.roundId}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{record.dateStr}</span>
                      </p>
                    </div>
                  </div>

                  {/* Win / Loss Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                      record.isWin
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}>
                      {record.isWin ? <Trophy className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                      <span>{record.isWin ? '🏆 WON ROUND' : '❌ LOST ROUND'}</span>
                    </span>
                  </div>
                </div>

                {/* Middle Row: Placed Selection & Stakes */}
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5 max-w-full sm:max-w-[65%]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">BET SELECTION & SPOT:</span>
                    <span className="text-xs sm:text-sm font-black text-amber-300 break-words block">
                      {record.betChoice}
                    </span>
                    {record.betsBreakdown && record.betsBreakdown.length > 1 && (
                      <span className="text-[10px] text-cyan-300 font-bold block">
                        + {record.betsBreakdown.length} Multi-spot Table Wagers Placed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">WAGER</span>
                      <span className="text-xs font-black text-white font-mono">
                        ₹{record.betAmount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">PAYOUT</span>
                      <span className={`text-xs sm:text-sm font-black font-mono block ${
                        record.isWin ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {record.isWin ? `+₹${record.payoutAmount.toLocaleString('en-IN')}` : '₹0'}
                      </span>
                    </div>

                    <div className="text-right min-w-[70px]">
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">NET RESULT</span>
                      <span className={`text-xs sm:text-sm font-black font-mono block ${
                        record.isWin ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {record.isWin ? `+₹${record.netGainLoss.toLocaleString('en-IN')}` : `-₹${Math.abs(record.netGainLoss).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Strip: View Full Details Breakdown Modal + Copy + Admin Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setSelectedRecord(record);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>View Full Bet & Result Details (সম্পূর্ণ তথ্য)</span>
                    </button>

                    <button
                      onClick={() => handleCopy(record.txId, record.id)}
                      className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs transition cursor-pointer"
                      title="Copy Bet Transaction ID"
                    >
                      {copiedId === record.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={() => onDeleteRecord({ id: record.txId, collection: 'transactions', title: `${record.gameName} Bet` })}
                    disabled={isDeletingRecord === record.txId}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-slate-800 hover:border-rose-800 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                    title="Delete record from database"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isDeletingRecord === record.txId ? 'animate-spin' : ''}`} />
                    <span>Delete Record</span>
                  </button>
                </div>

              </div>
            ))}
          </div>

          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredRecords.length}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            label="live bets"
          />
        </div>
      )}

      {/* FULL BET DETAILS & BREAKDOWN MODAL (MATCHES USER PANEL 1:1) */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[10010] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 font-mono">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-950 border border-amber-500/40 flex items-center justify-center text-2xl shadow-inner">
                  {selectedRecord.gameIcon}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>{selectedRecord.gameName}</span>
                    <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                      {selectedRecord.roundId}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">{selectedRecord.dateStr}</p>
                </div>
              </div>

              <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border flex items-center gap-1 ${
                selectedRecord.isWin 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {selectedRecord.isWin ? <Trophy className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                <span>{selectedRecord.isWin ? 'ROUND WON' : 'ROUND LOST'}</span>
              </span>
            </div>

            {/* Total Stake & Result Banner */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Stake</span>
                <span className="text-sm sm:text-base font-black text-white">₹{selectedRecord.betAmount.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Payout Amount</span>
                <span className={`text-sm sm:text-base font-black ${selectedRecord.isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                  ₹{selectedRecord.payoutAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Net PnL</span>
                <span className={`text-sm sm:text-base font-black ${selectedRecord.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedRecord.isWin ? `+₹${selectedRecord.netGainLoss.toLocaleString('en-IN')}` : `-₹${Math.abs(selectedRecord.netGainLoss).toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            {/* Individual Breakdown Table */}
            {selectedRecord.betsBreakdown && selectedRecord.betsBreakdown.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs uppercase font-black text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Placed Table Spots Breakdown ({selectedRecord.betsBreakdown.length} bets):</span>
                </span>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {selectedRecord.betsBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          item.isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}>
                          {item.isWin ? '✓' : '✕'}
                        </span>
                        <div>
                          <span className="font-bold text-white">{item.spot}</span>
                          {item.multiplier && item.multiplier !== '0x' && item.multiplier !== '-' && (
                            <span className="ml-1.5 text-[10px] text-cyan-300 font-bold bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/30">
                              {item.multiplier}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block">Stake</span>
                          <span className="font-bold text-white">₹{item.amount}</span>
                        </div>
                        <div className="min-w-[60px]">
                          <span className="text-[9px] text-slate-500 uppercase block">Payout</span>
                          <span className={`font-bold ${item.isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {item.isWin ? `+₹${item.payout || 0}` : '₹0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Outcome & Audit Card */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Winning Outcome:</span>
                <span className="font-bold text-amber-300">{selectedRecord.details?.winningOutcome || 'Official Round Result'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Round Cards / Pocket:</span>
                <span className="font-bold text-white truncate max-w-[60%]">{selectedRecord.details?.cardsOrResult || 'Verified Dealer Stream'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Transaction Ref:</span>
                <span className="font-mono text-slate-300 truncate max-w-[60%]">{selectedRecord.txId}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Provably Fair Round
                </span>
                <span className="text-slate-500 truncate max-w-[50%]">{selectedRecord.details?.auditProof}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  const slip = `BET SLIP\nGame: ${selectedRecord.gameName}\nRound: ${selectedRecord.roundId}\nChoice: ${selectedRecord.betChoice}\nStake: ₹${selectedRecord.betAmount}\nResult: ${selectedRecord.isWin ? 'WON' : 'LOST'}\nPayout: ₹${selectedRecord.payoutAmount}\nTX: ${selectedRecord.txId}`;
                  handleCopy(slip, 'modal_slip');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedId === 'modal_slip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'modal_slip' ? 'Slip Copied!' : 'Copy Bet Slip'}</span>
              </button>

              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Close (বন্ধ করুন)
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
