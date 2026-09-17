import React, { useState, useMemo } from 'react';
import { 
  Ticket, Trophy, XCircle, Clock, Zap, ChevronDown, ChevronUp, 
  Trash2, Sparkles, Filter, Check, Copy, AlertCircle
} from 'lucide-react';
import { PurchasedTicket } from '../../../types';
import { SUPER_CARS, formatTicketExactDateTime, groupTicketsByBatch, GroupedTicketBatch } from '../../../utils/supercar';
import { soundFx } from '../../../utils/audio';
import { PaginationBar } from '../../PaginationBar';

interface AdminTicketsViewProps {
  tickets: PurchasedTicket[];
  deletedRecordIds: Set<string>;
  isUserMatch: (uid?: string, email?: string, phone?: string) => boolean;
  isWithinDateFilter: (dateVal?: string | number) => boolean;
  onDeleteRecord: (item: { id: string; collection: string; title: string }) => void;
  isDeletingRecord: string | null;
}

export const AdminTicketsView: React.FC<AdminTicketsViewProps> = ({
  tickets,
  deletedRecordIds,
  isUserMatch,
  isWithinDateFilter,
  onDeleteRecord,
  isDeletingRecord
}) => {
  const [filter, setFilter] = useState<'all' | 'supercar' | 'regular' | 'win' | 'loss' | 'active'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [expandedBatchKey, setExpandedBatchKey] = useState<string | null>(null);

  // Filter user tickets
  const userTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (deletedRecordIds.has(t.id)) return false;
      if (!isUserMatch(t.userId)) return false;
      if (!isWithinDateFilter(t.purchaseDate || (t as any).date || (t as any).createdAt)) return false;
      return true;
    });
  }, [tickets, deletedRecordIds, isUserMatch, isWithinDateFilter]);

  // Group tickets into batches like user panel
  const groupedBatches = useMemo(() => {
    const batches = groupTicketsByBatch(userTickets);

    return batches.filter((b) => {
      const isSuperCar = b.firstTicket.category === 'Three Super Car Draw' || b.selectedCar !== undefined;
      if (filter === 'supercar' && !isSuperCar) return false;
      if (filter === 'regular' && isSuperCar) return false;
      if (filter === 'win' && b.status !== 'win') return false;
      if (filter === 'loss' && b.status !== 'loss') return false;
      if (filter === 'active' && b.status !== 'active' && b.status !== 'pending') return false;
      return true;
    });
  }, [userTickets, filter]);

  const totalPages = Math.ceil(groupedBatches.length / pageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedBatches.slice(start, start + pageSize);
  }, [groupedBatches, currentPage, pageSize]);

  return (
    <div className="space-y-4 font-mono">
      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'all', label: 'All Tickets' },
            { id: 'supercar', label: '🏎️ 3 Super Car Draws' },
            { id: 'regular', label: '🎟️ Regular Lotteries' },
            { id: 'win', label: '🏆 Winners Only' },
            { id: 'loss', label: '❌ Losses Only' },
            { id: 'active', label: '⏳ Active / Pending' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                soundFx.playClick();
                setFilter(f.id as any);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-bold">
          Total: <strong className="text-amber-400">{groupedBatches.length}</strong> batches ({userTickets.length} tickets)
        </span>
      </div>

      {/* Tickets List */}
      {groupedBatches.length === 0 ? (
        <div className="p-16 text-center bg-slate-950 rounded-3xl border border-slate-800 text-slate-500 space-y-3">
          <Ticket className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
          <p className="text-sm font-bold text-slate-400">কোন লটারি বা সুপার কার টিকিট খুঁজে পাওয়া যায়নি</p>
          <p className="text-xs text-slate-500">No lottery wagers placed under the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedBatches.map((batch) => {
              const firstTkt = batch.firstTicket;
              const isSuperCar = firstTkt.category === 'Three Super Car Draw' || batch.selectedCar !== undefined;
              const carInfo = isSuperCar && batch.selectedCar ? SUPER_CARS[batch.selectedCar] : null;
              const isExpanded = expandedBatchKey === batch.groupKey;
              const isWin = batch.status === 'win';
              const isLoss = batch.status === 'loss';

              return (
                <div
                  key={batch.groupKey}
                  className={`p-4 bg-slate-950 rounded-3xl border transition-all shadow-xl space-y-3 relative overflow-hidden ${
                    isWin 
                      ? 'border-emerald-700/80 bg-gradient-to-br from-slate-950 via-slate-950 to-emerald-950/20' 
                      : isLoss 
                      ? 'border-rose-900/60 bg-gradient-to-br from-slate-950 via-slate-950 to-rose-950/10' 
                      : 'border-amber-500/40 bg-slate-950'
                  }`}
                >
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full text-amber-300 font-bold text-[11px]">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{formatTicketExactDateTime(firstTkt)}</span>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                      isWin 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                        : isLoss 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {isWin && <Trophy className="w-3 h-3 text-emerald-400" />}
                      {isLoss && <XCircle className="w-3 h-3 text-rose-400" />}
                      <span>{isWin ? 'WINNER' : isLoss ? 'LOST' : 'ACTIVE'}</span>
                    </span>
                  </div>

                  {/* Draw Title & Quantity & Wallet Type Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-white">{batch.drawTitle}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        {batch.quantity}x {batch.quantity === 1 ? 'Ticket' : 'Tickets'}
                      </span>
                      {/* Wallet Balance Type Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        firstTkt.walletType === 'bonus'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {firstTkt.walletType === 'bonus' ? '🎁 Bonus Wallet' : '💰 Real Wallet'}
                      </span>
                    </div>
                  </div>

                  {/* Super Car Card OR Regular Number Box */}
                  {carInfo ? (
                    <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-12 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                          <img
                            src={carInfo.image}
                            alt={carInfo.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-black text-amber-300 block">{carInfo.name}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {batch.quantity}x @ ₹{firstTkt.price || 100} = <strong className="text-emerald-400">Total ₹{batch.totalPrice.toLocaleString('en-IN')}</strong>
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            Car Multiplier: <strong>2.8x Payout</strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">CAR CHOICE</span>
                        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                          batch.selectedCar === 'red' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : batch.selectedCar === 'black' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        }`}>
                          {batch.selectedCar} CAR
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1.5">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">Selected Ticket Numbers:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {batch.tickets.map((t, idx) => (
                          <span key={idx} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs px-2 py-0.5 rounded-lg">
                            #{t.ticketNumber || t.id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing and Won Amount Strip */}
                  <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Total Cost</span>
                      <span className="font-black text-white">₹{batch.totalPrice.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block uppercase">Won Prize</span>
                      <span className={`font-black ${isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {isWin ? `+₹${(batch.totalWonAmount || 0).toLocaleString('en-IN')}` : '₹0'}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Serial Numbers List Toggle */}
                  {batch.quantity > 1 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedBatchKey(isExpanded ? null : batch.groupKey)}
                        className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-mono text-amber-400 font-bold flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Ticket Serial Numbers' : `View All ${batch.quantity} Serial Numbers`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 bg-slate-900 rounded-xl border border-slate-800 max-h-40 overflow-y-auto space-y-1 text-xs">
                          {batch.tickets.map((t, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
                              <span className="text-slate-300">Ticket #{t.ticketNumber || t.id}</span>
                              <span className="text-amber-400 font-bold">₹{t.price}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Bar (Delete) */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500">ID: {firstTkt.id}</span>
                    <button
                      onClick={() => onDeleteRecord({ id: firstTkt.id, collection: 'tickets', title: `${batch.drawTitle} Ticket` })}
                      disabled={isDeletingRecord === firstTkt.id}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-slate-800 hover:border-rose-800 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${isDeletingRecord === firstTkt.id ? 'animate-spin' : ''}`} />
                      <span>Delete Ticket</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={groupedBatches.length}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
            label="ticket batches"
          />
        </div>
      )}
    </div>
  );
};
