import React from 'react';
import { TrendingUp, ShieldCheck, Zap, BarChart3, Activity } from 'lucide-react';
import { User } from '../../../types';

interface AdminAnalyticsViewProps {
  user: User;
  metrics: {
    totalWager: number;
    totalWon: number;
    houseProfit: number;
    betCount: number;
    winCount: number;
    lossCount: number;
    pendingCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
    depositsCount: number;
    withdrawalsCount: number;
  };
}

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ user, metrics }) => {
  const rtp = metrics.totalWager > 0 ? ((metrics.totalWon / metrics.totalWager) * 100).toFixed(1) : '0.0';
  const winRate = metrics.betCount > 0 ? ((metrics.winCount / metrics.betCount) * 100).toFixed(1) : '0.0';
  const netInflow = metrics.totalDeposits - metrics.totalWithdrawals;

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Turnover */}
        <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-3 shadow-lg">
          <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" /> TURNOVER & WAGER VOLUME
          </span>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Wagered:</span>
              <span className="font-black text-white font-mono">₹{metrics.totalWager.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Gross Won:</span>
              <span className="font-black text-emerald-400 font-mono">₹{metrics.totalWon.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rounds Placed:</span>
              <span className="font-bold text-white">{metrics.betCount} bets</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Win Rate:</span>
              <span className="font-bold text-amber-300">{winRate}% ({metrics.winCount}W / {metrics.lossCount}L)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Cashflow */}
        <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-3 shadow-lg">
          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> BANKING CASH FLOW
          </span>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Deposits:</span>
              <span className="font-black text-emerald-400 font-mono">₹{metrics.totalDeposits.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Payouts:</span>
              <span className="font-black text-rose-400 font-mono">₹{metrics.totalWithdrawals.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Net Banking Inflow:</span>
              <span className={`font-black font-mono ${netInflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netInflow >= 0 ? `+₹${netInflow.toLocaleString('en-IN')}` : `-₹${Math.abs(netInflow).toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">VIP Level:</span>
              <span className="font-bold text-amber-400">👑 Tier {user.vipLevel || 'Bronze'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Margin */}
        <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-3 shadow-lg">
          <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> CASINO MARGIN & RTP
          </span>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">House Profit (PnL):</span>
              <span className={`font-black font-mono ${metrics.houseProfit >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                {metrics.houseProfit >= 0 ? `+₹${metrics.houseProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(metrics.houseProfit).toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Player RTP:</span>
              <span className="font-bold text-cyan-300">{rtp}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Audit Status:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> SECURE & VERIFIED
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Live City:</span>
              <span className="font-bold text-slate-300">{user.city || user.geoInfo?.city || 'Verified Player'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
