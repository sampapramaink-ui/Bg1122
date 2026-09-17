import React, { useState, useMemo } from 'react';
import { 
  Receipt, Search, Filter, Clock, Copy, Check, Trash2, ArrowUpRight, 
  ArrowDownLeft, Gift, ShieldAlert, Sparkles, Eye, Download, ShieldCheck, Tag
} from 'lucide-react';
import { WalletTransaction } from '../../../types';
import { soundFx } from '../../../utils/audio';
import { PaginationBar } from '../../PaginationBar';

interface AdminWalletLedgerViewProps {
  transactions: WalletTransaction[];
  deletedRecordIds: Set<string>;
  isUserMatch: (uid?: string, email?: string, phone?: string) => boolean;
  isWithinDateFilter: (dateVal?: string | number) => boolean;
  onDeleteRecord: (item: { id: string; collection: string; title: string }) => void;
  isDeletingRecord: string | null;
}

export const AdminWalletLedgerView: React.FC<AdminWalletLedgerViewProps> = ({
  transactions,
  deletedRecordIds,
  isUserMatch,
  isWithinDateFilter,
  onDeleteRecord,
  isDeletingRecord
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundFx.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter and process user transactions
  const processedTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (deletedRecordIds.has(tx.id)) return false;
      if (!isUserMatch(tx.userId, tx.userEmail)) return false;
      if (!isWithinDateFilter(tx.createdAt || tx.date)) return false;

      const type = (tx.type || '').toLowerCase();

      // Category filter
      if (categoryFilter === 'deposits' && !type.includes('deposit')) return false;
      if (categoryFilter === 'withdrawals' && !type.includes('withdrawal') && !type.includes('payout')) return false;
      if (categoryFilter === 'bets' && !type.includes('bet') && !type.includes('roulette') && !type.includes('andar') && !type.includes('dragon') && !type.includes('crash')) return false;
      if (categoryFilter === 'wins' && !type.includes('win')) return false;
      if (categoryFilter === 'tickets' && !type.includes('ticket') && !type.includes('supercar') && !type.includes('lottery')) return false;
      if (categoryFilter === 'bonuses' && !type.includes('bonus') && !type.includes('wheel') && !type.includes('checkin') && !type.includes('admin') && !type.includes('promo')) return false;

      // Status/Outcome filter
      const isCredit = (tx.amount || 0) > 0;
      if (outcomeFilter === 'credit' && !isCredit) return false;
      if (outcomeFilter === 'debit' && isCredit) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchType = (tx.type || '').toLowerCase().includes(q);
        const matchId = (tx.id || '').toLowerCase().includes(q);
        const matchPromo = tx.promoCode ? tx.promoCode.toLowerCase().includes(q) : false;
        const matchPromoTitle = tx.promoCodeTitle ? tx.promoCodeTitle.toLowerCase().includes(q) : false;
        if (!matchDesc && !matchType && !matchId && !matchPromo && !matchPromoTitle) return false;
      }

      return true;
    });
  }, [transactions, deletedRecordIds, isUserMatch, isWithinDateFilter, categoryFilter, outcomeFilter, searchQuery]);

  const totalPages = Math.ceil(processedTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedTransactions.slice(start, start + pageSize);
  }, [processedTransactions, currentPage, pageSize]);

  return (
    <div className="space-y-4 font-mono">
      {/* Category Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'deposits', label: '📥 Deposits' },
            { id: 'withdrawals', label: '📤 Withdrawals' },
            { id: 'bets', label: '🎰 Casino Bets' },
            { id: 'wins', label: '🏆 Casino Wins' },
            { id: 'tickets', label: '🎟️ Tickets' },
            { id: 'bonuses', label: '🎁 Bonuses' },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => {
                soundFx.playClick();
                setCategoryFilter(c.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === c.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-900 text-white text-[11px] font-mono px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
          >
            <option value="all">All Flow Types</option>
            <option value="credit">🟢 Money In (Credit)</option>
            <option value="debit">🔴 Money Out (Debit)</option>
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
              placeholder="Search description, ID..."
              className="w-full bg-slate-900 text-white pl-8 pr-3 py-1.5 rounded-xl text-[11px] border border-slate-700 outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table / List */}
      {processedTransactions.length === 0 ? (
        <div className="p-16 text-center bg-slate-950 rounded-3xl border border-slate-800 text-slate-500 space-y-3">
          <Receipt className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
          <p className="text-sm font-bold text-slate-400">কোন ওয়ালেট ট্রানজেকশন পাওয়া যায়নি</p>
          <p className="text-xs text-slate-500">No wallet transactions match the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedTransactions.map((tx) => {
            const isCredit = (tx.amount || 0) > 0;
            const type = (tx.type || '').toLowerCase();

            return (
              <div
                key={tx.id}
                className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-md group"
              >
                {/* Left: Type Icon & Details */}
                <div className="flex items-start sm:items-center gap-3 max-w-full sm:max-w-[70%]">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isCredit ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' : 'bg-rose-950/60 border-rose-800 text-rose-400'
                  }`}>
                    {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white uppercase text-xs">{tx.type?.replace(/_/g, ' ')}</span>
                      {/* Wallet Balance Type Badge */}
                      <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold border ${
                        tx.walletType === 'bonus'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {tx.walletType === 'bonus' ? '🎁 Bonus Wallet' : '💰 Real Wallet'}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-300 font-bold break-words">{tx.description}</p>

                    {/* Promo Code Origin Info for Admin */}
                    {tx.promoCode && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-[10px] font-black">
                          <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Promo: <strong>{tx.promoCode}</strong></span>
                        </span>
                        {tx.sourceOrigin && (
                          <span className="text-[9px] text-cyan-300 font-mono bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                            Origin: {tx.sourceOrigin}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2">
                      <span>ID: <strong className="text-slate-400 font-mono">{tx.id}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {tx.date || new Date(tx.createdAt || Date.now()).toLocaleString('en-IN')}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-850">
                  <div className="text-left sm:text-right">
                    <span className={`text-sm sm:text-base font-black font-mono block ${
                      isCredit ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isCredit ? `+₹${Math.abs(tx.amount || 0).toLocaleString('en-IN')}` : `-₹${Math.abs(tx.amount || 0).toLocaleString('en-IN')}`}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase">{tx.status || 'COMPLETED'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setSelectedTx(tx);
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="View digital slip"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Slip</span>
                    </button>

                    <button
                      onClick={() => onDeleteRecord({ id: tx.id, collection: 'transactions', title: `${tx.type} Transaction` })}
                      disabled={isDeletingRecord === tx.id}
                      className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 rounded-xl transition cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${isDeletingRecord === tx.id ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}

          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={processedTransactions.length}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            label="transactions"
          />
        </div>
      )}

      {/* DIGITAL TRANSACTION SLIP / VOUCHER MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-[10010] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Official Transaction Slip</h3>
              </div>
              <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                AUDIT VERIFIED
              </span>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Transaction Amount</span>
              <span className={`text-2xl font-black font-mono block ${
                (selectedTx.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {(selectedTx.amount || 0) >= 0 ? `+₹${Math.abs(selectedTx.amount || 0).toLocaleString('en-IN')}` : `-₹${Math.abs(selectedTx.amount || 0).toLocaleString('en-IN')}`}
              </span>
              <span className="text-xs text-slate-400">{selectedTx.type?.replace(/_/g, ' ').toUpperCase()}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-white truncate max-w-[180px]">{selectedTx.id}</span>
                  <button
                    onClick={() => handleCopy(selectedTx.id, 'tx_slip_copy')}
                    className="text-amber-400 hover:text-amber-300 p-0.5"
                  >
                    {copiedId === 'tx_slip_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Wallet Account:</span>
                <span className="font-bold text-amber-300">
                  {selectedTx.walletType === 'bonus' ? '🎁 Bonus Balance Wallet' : '💰 Real Cash Balance Wallet'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">{selectedTx.date || new Date(selectedTx.createdAt || Date.now()).toLocaleString('en-IN')}</span>
              </div>

              {selectedTx.promoCode && (
                <div className="p-2.5 bg-amber-950/30 rounded-xl border border-amber-500/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Promo Code:</span>
                    </span>
                    <span className="font-mono font-black text-white">{selectedTx.promoCode}</span>
                  </div>
                  {selectedTx.promoCodeTitle && (
                    <div className="text-[11px] text-amber-300">
                      Title: {selectedTx.promoCodeTitle}
                    </div>
                  )}
                  {selectedTx.sourceOrigin && (
                    <div className="text-[11px] text-cyan-300">
                      Origin: {selectedTx.sourceOrigin}
                    </div>
                  )}
                </div>
              )}

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Transaction Narrative:</span>
                <p className="text-slate-200 break-words">{selectedTx.description}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const details = `BETGURU TRANSACTION SLIP\n• ID: ${selectedTx.id}\n• Type: ${selectedTx.type}\n• Amount: ₹${selectedTx.amount}\n• Wallet: ${selectedTx.walletType || 'main'}\n• Time: ${selectedTx.date || new Date(selectedTx.createdAt || Date.now()).toLocaleString('en-IN')}\n• Note: ${selectedTx.description}`;
                  handleCopy(details, 'slip_full_copy');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedId === 'slip_full_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'slip_full_copy' ? 'Copied!' : 'Copy Slip'}</span>
              </button>

              <button
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer"
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
