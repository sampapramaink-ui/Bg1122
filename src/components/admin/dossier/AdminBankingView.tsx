import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, Trash2, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { DepositRequest, WithdrawalRequest } from '../../../types';

interface AdminBankingViewProps {
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  deletedRecordIds: Set<string>;
  isUserMatch: (uid?: string, email?: string, phone?: string) => boolean;
  isWithinDateFilter: (dateVal?: string | number) => boolean;
  onDeleteRecord: (item: { id: string; collection: string; title: string }) => void;
  isDeletingRecord: string | null;
  formatExactDateTime: (dateVal?: string | number) => string;
}

export const AdminBankingView: React.FC<AdminBankingViewProps> = ({
  deposits,
  withdrawals,
  deletedRecordIds,
  isUserMatch,
  isWithinDateFilter,
  onDeleteRecord,
  isDeletingRecord,
  formatExactDateTime
}) => {
  const userDeposits = deposits.filter(
    (d) => !deletedRecordIds.has(d.id) && isUserMatch(d.userId, undefined, d.userPhone) && isWithinDateFilter(d.date)
  );

  const userWithdrawals = withdrawals.filter(
    (w) => !deletedRecordIds.has(w.id) && isUserMatch(w.userId, undefined, (w as any).userPhone) && isWithinDateFilter(w.date)
  );

  const totalDepositAmount = userDeposits.filter((d) => d.status === 'approved').reduce((acc, d) => acc + d.amount, 0);
  const totalWithdrawalAmount = userWithdrawals.filter((w) => w.status === 'approved').reduce((acc, w) => acc + w.amount, 0);

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deposits Column */}
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-900 rounded-2xl border border-emerald-900/50 flex items-center justify-between shadow-md">
            <span className="font-black text-emerald-400 flex items-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4" /> APPROVED DEPOSITS ({userDeposits.length})
            </span>
            <span className="font-black text-white text-sm">₹{totalDepositAmount.toLocaleString('en-IN')}</span>
          </div>

          {userDeposits.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-500">
              No deposit records found for this player.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {userDeposits.map((dep) => (
                <div key={dep.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase">{dep.method || 'UPI'} Deposit</span>
                    <span className="font-black text-emerald-400">+₹{dep.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-amber-300">UTR / Ref: <strong className="font-mono">{dep.utr || dep.transactionId || 'N/A'}</strong></p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {formatExactDateTime(dep.date)}
                    </span>
                    <button
                      onClick={() => onDeleteRecord({ id: dep.id, collection: 'deposits', title: 'Deposit' })}
                      disabled={isDeletingRecord === dep.id}
                      className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Withdrawals Column */}
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-900 rounded-2xl border border-rose-900/50 flex items-center justify-between shadow-md">
            <span className="font-black text-rose-400 flex items-center gap-1.5">
              <ArrowUpCircle className="w-4 h-4" /> APPROVED PAYOUTS ({userWithdrawals.length})
            </span>
            <span className="font-black text-white text-sm">₹{totalWithdrawalAmount.toLocaleString('en-IN')}</span>
          </div>

          {userWithdrawals.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-500">
              No withdrawal records found for this player.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {userWithdrawals.map((wth) => (
                <div key={wth.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:border-rose-500/40 transition space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase">Payout to {wth.method || 'BANK'}</span>
                    <span className="font-black text-rose-400">-₹{wth.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    A/C: <strong className="font-mono text-white">{wth.accountNumber || wth.upiId}</strong> {wth.ifscCode ? `| IFSC: ${wth.ifscCode}` : ''}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {formatExactDateTime(wth.date)}
                    </span>
                    <button
                      onClick={() => onDeleteRecord({ id: wth.id, collection: 'withdrawals', title: 'Withdrawal' })}
                      disabled={isDeletingRecord === wth.id}
                      className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
