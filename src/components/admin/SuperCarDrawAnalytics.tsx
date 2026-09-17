import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Filter, DollarSign, Users, Award, TrendingUp, Sparkles, PieChart as PieChartIcon, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { PurchasedTicket, SuperCarColor } from '../../types';
import { PaginationBar } from '../PaginationBar';
import { getSuperCarSlotTimeLabel, getSuperCarSlotsPerDay } from '../../utils/supercar';

interface SuperCarDrawAnalyticsProps {
  tickets?: PurchasedTicket[];
}

export const SuperCarDrawAnalytics: React.FC<SuperCarDrawAnalyticsProps> = ({ tickets: propTickets }) => {
  const [tickets, setTickets] = useState<PurchasedTicket[]>(propTickets || []);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | 'all'>('all');
  const [selectedColorFilter, setSelectedColorFilter] = useState<'all' | SuperCarColor>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSlotIndex, selectedColorFilter]);

  // Real-time listener for tickets if prop not passed or needs live sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tickets'), (snap) => {
      const fetched: PurchasedTicket[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as PurchasedTicket;
        if (data.category === 'Three Super Car Draw' || data.drawTitle?.includes('Super Car')) {
          fetched.push({ ...data, id: docSnap.id });
        }
      });
      if (fetched.length > 0) {
        setTickets(fetched);
      }
    }, (err) => console.warn('Tickets analytics listener notice:', err.message));

    return () => unsub();
  }, []);

  // Filter tickets by selected slot or color
  const supercarTickets = (tickets || []).filter(t => 
    t.category === 'Three Super Car Draw' || t.drawTitle?.includes('Super Car')
  );

  const totalSlotsCount = getSuperCarSlotsPerDay();

  const filteredTickets = supercarTickets.filter((t) => {
    if (selectedSlotIndex !== 'all') {
      const timeLabel = getSuperCarSlotTimeLabel(selectedSlotIndex as number);
      const matchesTime = t.drawTitle?.includes(timeLabel) || t.drawTime?.toString().includes(timeLabel);
      if (!matchesTime) return false;
    }

    if (selectedColorFilter !== 'all') {
      const cardColor = t.selectedCar || (t.selectedNumbers?.[0] as string);
      if (cardColor !== selectedColorFilter) return false;
    }

    return true;
  });

  // Calculate Metrics
  const totalTicketsSold = filteredTickets.length;
  const totalSalesAmount = filteredTickets.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // Color breakdown
  const redTickets = filteredTickets.filter(t => (t.selectedCar || t.selectedNumbers?.[0]) === 'red');
  const redAmount = redTickets.reduce((acc, curr) => acc + (curr.price || 0), 0);

  const blackTickets = filteredTickets.filter(t => (t.selectedCar || t.selectedNumbers?.[0]) === 'black');
  const blackAmount = blackTickets.reduce((acc, curr) => acc + (curr.price || 0), 0);

  const yellowTickets = filteredTickets.filter(t => (t.selectedCar || t.selectedNumbers?.[0]) === 'yellow');
  const yellowAmount = yellowTickets.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // Winners & Losers
  const winningTickets = filteredTickets.filter(t => t.status === 'win');
  const totalPrizePaid = winningTickets.reduce((acc, curr) => acc + (curr.wonAmount || 0), 0);
  const winnersCount = winningTickets.length;

  const losingTickets = filteredTickets.filter(t => t.status === 'loss');
  const losersCount = losingTickets.length;
  const pendingTickets = filteredTickets.filter(t => t.status === 'active' || (t.status as string) === 'pending');

  // Profit Summary
  const netProfit = totalSalesAmount - totalPrizePaid;
  const profitMargin = totalSalesAmount > 0 ? ((netProfit / totalSalesAmount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 font-mono">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-amber-950/50 to-slate-950 rounded-3xl border border-amber-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Super Car Draw Analytics</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full uppercase">
                REALTIME FIREBASE
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Filter by time slot & inspect total sales, color bets, prize payouts, and net house profit.
            </p>
          </div>
        </div>

        {/* Time Filter Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-2xl border border-slate-800 shrink-0">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-slate-400 font-bold">Time Slot:</span>
            <select
              value={selectedSlotIndex}
              onChange={(e) => setSelectedSlotIndex(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs rounded-xl px-2 py-1 outline-none cursor-pointer"
            >
              <option value="all">All {totalSlotsCount} Daily Slots (10-Min 24/7)</option>
              {Array.from({ length: totalSlotsCount }, (_, i) => {
                const slotNum = i + 1;
                const timeLabel = getSuperCarSlotTimeLabel(slotNum);
                return (
                  <option key={slotNum} value={slotNum}>
                    Slot #{String(slotNum).padStart(2, '0')} ({timeLabel})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Tickets Sold</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{totalTicketsSold}</span>
            <span className="text-xs font-bold text-amber-400">₹{totalSalesAmount.toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Ticket Volume Revenue</span>
        </div>

        {/* Total Prize Paid */}
        <div className="p-4 bg-slate-900 rounded-3xl border border-rose-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-400 block">Total Prize Paid Out</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-300">₹{totalPrizePaid.toLocaleString('en-IN')}</span>
            <span className="text-xs font-bold text-slate-400">{winnersCount} Winners</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Credited to player wallets</span>
        </div>

        {/* Losers Count */}
        <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Unselected Tickets (Lost)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-300">{losersCount}</span>
            <span className="text-xs font-bold text-amber-400/80">{pendingTickets.length} Pending</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Non-winning ticket history</span>
        </div>

        {/* Net Profit Summary */}
        <div className="p-4 bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-950 rounded-3xl border border-amber-500/40 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-400 block">House Net Profit</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{netProfit.toLocaleString('en-IN')}
            </span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
              {profitMargin}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block">Sales minus payouts</span>
        </div>
      </div>

      {/* CARD COLOR BREAKDOWN (Red, Black, Yellow) */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-amber-400" />
            <span>Card Color Bets Distribution</span>
          </span>
          <span className="text-xs text-amber-400">Red vs Black vs Yellow</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Red Card */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-400 uppercase">Red Supercar</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                {redTickets.length} Tickets
              </span>
            </div>
            <div className="text-xl font-black text-white">₹{redAmount.toLocaleString('en-IN')}</div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{ width: `${totalSalesAmount > 0 ? (redAmount / totalSalesAmount) * 100 : 0}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {totalSalesAmount > 0 ? ((redAmount / totalSalesAmount) * 100).toFixed(1) : 0}% of Total Volume
            </span>
          </div>

          {/* Black Card */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 uppercase">Black Supercar</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                {blackTickets.length} Tickets
              </span>
            </div>
            <div className="text-xl font-black text-white">₹{blackAmount.toLocaleString('en-IN')}</div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${totalSalesAmount > 0 ? (blackAmount / totalSalesAmount) * 100 : 0}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {totalSalesAmount > 0 ? ((blackAmount / totalSalesAmount) * 100).toFixed(1) : 0}% of Total Volume
            </span>
          </div>

          {/* Yellow Card */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-yellow-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-yellow-400 uppercase">Yellow Supercar</span>
              <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold">
                {yellowTickets.length} Tickets
              </span>
            </div>
            <div className="text-xl font-black text-white">₹{yellowAmount.toLocaleString('en-IN')}</div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400"
                style={{ width: `${totalSalesAmount > 0 ? (yellowAmount / totalSalesAmount) * 100 : 0}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {totalSalesAmount > 0 ? ((yellowAmount / totalSalesAmount) * 100).toFixed(1) : 0}% of Total Volume
            </span>
          </div>
        </div>
      </div>

      {/* FILTERABLE TICKETS AUDIT TABLE */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Participating Tickets Log ({filteredTickets.length})</span>
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter Color:</span>
            <select
              value={selectedColorFilter}
              onChange={(e) => setSelectedColorFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2 py-1 outline-none"
            >
              <option value="all">All Colors</option>
              <option value="red">Red Only</option>
              <option value="black">Black Only</option>
              <option value="yellow">Yellow Only</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredTickets.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No tickets match the selected filter criteria.</p>
            ) : (
              filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((ticket) => {
                const cardColor = ticket.selectedCar || (ticket.selectedNumbers?.[0] as string) || 'red';
                return (
                  <div key={ticket.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{ticket.ticketNumber}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          cardColor === 'red' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : cardColor === 'black' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        }`}>
                          {cardColor}
                        </span>
                        <span className="text-[10px] text-slate-400">{ticket.drawTitle}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">User UID: {ticket.userId} • Purchased: {ticket.purchaseDate}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-amber-400 font-bold block">₹{ticket.price}</span>
                      <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full border ${
                        ticket.status === 'win'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : ticket.status === 'loss'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {ticket.status === 'win' ? `WON ₹${ticket.wonAmount || 0}` : ticket.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <PaginationBar
            currentPage={currentPage}
            totalPages={Math.ceil(filteredTickets.length / pageSize) || 1}
            pageSize={pageSize}
            totalItems={filteredTickets.length}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            label="participating tickets"
          />
        </div>
      </div>

    </div>
  );
};
