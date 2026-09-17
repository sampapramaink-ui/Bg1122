import React, { useState, useEffect } from 'react';
import {
  Clock, Calendar, Sparkles, Trophy, Plus, Trash2, Edit3, CheckCircle2,
  AlertCircle, Grid, Play, RotateCcw, ShieldCheck, Search, Filter,
  FileText, Activity, Lock, RefreshCw, Zap, Award
} from 'lucide-react';
import { doc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { LotteryScheduleSlot, AdminAuditLog, User } from '../../types';
import { soundFx } from '../../utils/audio';
import { logAdminAuditAction, processScheduledLotteryDraws } from '../../utils/schedulerEngine';

interface AdminSchedulerManagerProps {
  currentUser?: User;
}

export const AdminSchedulerManager: React.FC<AdminSchedulerManagerProps> = ({ currentUser }) => {
  const [schedules, setSchedules] = useState<LotteryScheduleSlot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');

  // Form State for New Slot Creation
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newLotteryTitle, setNewLotteryTitle] = useState<string>('4D Express');
  const [newCategory, setNewCategory] = useState<string>('4D Express');
  const [newSlotName, setNewSlotName] = useState<string>('Slot #' + Math.floor(100 + Math.random() * 900));
  const [newDrawTimeLabel, setNewDrawTimeLabel] = useState<string>('03:30 PM');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [resultGridsCount, setResultGridsCount] = useState<number>(4);
  const [ticketPrice, setTicketPrice] = useState<number>(100);
  const [prizePool, setPrizePool] = useState<number>(100000);
  const [preSelectedResult, setPreSelectedResult] = useState<string>('');

  // Editing Result Grids / Pre-selected Result for existing slot
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editGridCount, setEditGridCount] = useState<number>(4);
  const [editPreSelectedResult, setEditPreSelectedResult] = useState<string>('');

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Listen to all lottery_schedules
    const qSchedules = query(collection(db, 'lottery_schedules'), orderBy('scheduledTimestamp', 'desc'), limit(100));
    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      const list: LotteryScheduleSlot[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as LotteryScheduleSlot);
      });
      setSchedules(list);
      setLoading(false);
    }, (err) => console.warn('Lottery schedules listener notice:', err.message));

    // 2. Listen to admin_audit_logs
    const qAudit = query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(50));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      const list: AdminAuditLog[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as AdminAuditLog);
      });
      setAuditLogs(list);
    }, (err) => console.warn('Audit logs listener notice:', err.message));

    return () => {
      unsubSchedules();
      unsubAudit();
    };
  }, []);

  // Countdown Ticker for UI
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      // Trigger background scheduler check
      processScheduledLotteryDraws().catch((err) => console.warn('Scheduler check notice:', err));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format countdown
  const formatCountdown = (targetMs: number) => {
    const diff = Math.max(0, targetMs - now);
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Preset predefined categories helper
  const lotteryPresetTemplates = [
    { title: '4D Express Daily', category: '4D Express', grids: 4, price: 50, pool: 50000 },
    { title: 'Three Super Card', category: 'Three Super Card', grids: 1, price: 100, pool: 280000 },
    { title: 'GOLDEN 777 Speed Express', category: 'Speed 1m', grids: 3, price: 20, pool: 10000 },
    { title: '6D Bumper Lakhpati Jackpot', category: 'Bumper', grids: 6, price: 200, pool: 1000000 },
    { title: 'Daily Mega Crorepati Draw', category: 'Daily Mega', grids: 6, price: 500, pool: 5000000 }
  ];

  // Select Template Helper
  const handleSelectTemplate = (template: typeof lotteryPresetTemplates[0]) => {
    soundFx.playClick();
    setNewLotteryTitle(template.title);
    setNewCategory(template.category);
    setResultGridsCount(template.grids);
    setTicketPrice(template.price);
    setPrizePool(template.pool);
  };

  // Create New Schedule Slot
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playWinFanfare();

    try {
      const slotId = `SCH-${newCategory.replace(/\s+/g, '').toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const targetTimestamp = Date.now() + durationMinutes * 60 * 1000;

      let winningResultArr: (number | string)[] = [];
      if (preSelectedResult.trim()) {
        winningResultArr = preSelectedResult.trim().split(/[\s,]+/).map((s) => s.trim());
      }

      const slotData: LotteryScheduleSlot = {
        id: slotId,
        lotteryId: newCategory.toLowerCase().replace(/\s+/g, '-'),
        lotteryTitle: newLotteryTitle,
        category: newCategory,
        slotName: newSlotName,
        drawTimeLabel: newDrawTimeLabel,
        scheduledTimestamp: targetTimestamp,
        resultGridsCount,
        winningResult: winningResultArr,
        prizePool,
        ticketPrice,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        createdByAdmin: currentUser?.name || currentUser?.email || 'Admin'
      };

      await setDoc(doc(db, 'lottery_schedules', slotId), slotData);

      // Also ensure main draw record is updated in Firestore
      await setDoc(doc(db, 'draws', slotData.lotteryId), {
        id: slotData.lotteryId,
        title: slotData.lotteryTitle,
        category: slotData.category,
        ticketPrice: slotData.ticketPrice,
        prizePool: slotData.prizePool,
        firstPrize: slotData.prizePool,
        endTime: targetTimestamp,
        status: 'live'
      }, { merge: true });

      await logAdminAuditAction(
        'Created Lottery Schedule Slot',
        `Created schedule slot "${newSlotName}" for ${newLotteryTitle}. Countdown set to ${durationMinutes} mins (${newDrawTimeLabel}).`,
        currentUser
      );

      setStatusMsg({
        type: 'success',
        text: `✓ Schedule slot created successfully! Real-time countdown started for ${newLotteryTitle}.`
      });

      setShowCreateModal(false);
      setPreSelectedResult('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to create schedule slot: ${err.message}` });
    }
  };

  // Dispatch Result Immediately (Manual Trigger Ahead of Countdown)
  const handleDispatchNow = async (slot: LotteryScheduleSlot) => {
    soundFx.playWinFanfare();
    try {
      await setDoc(doc(db, 'lottery_schedules', slot.id), {
        scheduledTimestamp: Date.now() - 1000
      }, { merge: true });

      const res = await processScheduledLotteryDraws();

      await logAdminAuditAction(
        'Manual Result Dispatch Triggered',
        `Dispatched immediate result publication for slot ${slot.id} (${slot.lotteryTitle}).`,
        currentUser
      );

      setStatusMsg({
        type: 'success',
        text: `🚀 Immediate result publication triggered for ${slot.lotteryTitle}! Settled matching player tickets.`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to dispatch result: ${err.message}` });
    }
  };

  // Save Edits to Slot (Grid count & pre-selected result)
  const handleSaveSlotEdits = async (slotId: string) => {
    soundFx.playClick();
    try {
      let winningResultArr: (number | string)[] = [];
      if (editPreSelectedResult.trim()) {
        winningResultArr = editPreSelectedResult.trim().split(/[\s,]+/).map((s) => s.trim());
      }

      await setDoc(doc(db, 'lottery_schedules', slotId), {
        resultGridsCount: editGridCount,
        winningResult: winningResultArr
      }, { merge: true });

      await logAdminAuditAction(
        'Updated Schedule Slot Parameters',
        `Adjusted result grids to ${editGridCount} and updated pre-selected result for slot ${slotId}.`,
        currentUser
      );

      setStatusMsg({
        type: 'success',
        text: `Updated schedule slot #${slotId}! Adjusted result grids to ${editGridCount}.`
      });

      setEditingSlotId(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to update slot: ${err.message}` });
    }
  };

  // Cancel / Delete Schedule Slot
  const handleDeleteSlot = async (slotId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete/cancel schedule slot #${slotId}?`)) return;
    soundFx.playClick();

    try {
      await deleteDoc(doc(db, 'lottery_schedules', slotId));
      await logAdminAuditAction('Deleted Lottery Schedule Slot', `Deleted schedule slot #${slotId} (${title}).`, currentUser);
      setStatusMsg({ type: 'success', text: `Schedule slot #${slotId} cancelled.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to delete slot: ${err.message}` });
    }
  };

  // Filtered Schedules List
  const filteredSchedules = schedules.filter((s) => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        s.id.toLowerCase().includes(term) ||
        s.lotteryTitle.toLowerCase().includes(term) ||
        s.slotName.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const activeScheduledCount = schedules.filter((s) => s.status === 'scheduled').length;
  const completedCount = schedules.filter((s) => s.status === 'completed').length;

  return (
    <div className="space-y-6 font-mono">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-amber-950/60 to-slate-950 rounded-3xl border border-amber-500/30 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Clock className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Universal Lottery Result Scheduler</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                REALTIME FIREBASE SYNC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated Draw Countdown • Pre-set Winning Results • Multi-Grid Config • Auto Win/Loss Wallet Credit
            </p>
          </div>
        </div>

        <button
          onClick={() => { soundFx.playClick(); setShowCreateModal(true); }}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>CREATE RESULT SCHEDULE SLOT</span>
        </button>
      </div>

      {/* Status Notification Banner */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-lg ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span className="font-bold">{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-[10px] text-slate-400 uppercase font-black block">ACTIVE SCHEDULED SLOTS</span>
          <span className="text-2xl font-black text-amber-400 block mt-1">{activeScheduledCount} Slots</span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">Counting Down Live</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-[10px] text-slate-400 uppercase font-black block">COMPLETED DRAWS</span>
          <span className="text-2xl font-black text-white block mt-1">{completedCount} Draws</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Auto-Published & Credited</span>
        </div>

        <div className="p-4 bg-slate-900 border border-emerald-900/40 rounded-3xl">
          <span className="text-[10px] text-emerald-400 uppercase font-black block">AUTOMATIC SYNC ENGINE</span>
          <span className="text-lg font-black text-emerald-300 block mt-1">ACTIVE (1s TICK)</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Zero-Lag Execution</span>
        </div>

        <div className="p-4 bg-gradient-to-br from-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl">
          <span className="text-[10px] text-amber-400 uppercase font-black block">ADMIN AUDIT LOGS</span>
          <span className="text-2xl font-black text-amber-300 block mt-1">{auditLogs.length} Entries</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Immutable Actions History</span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Slot #, Title, Category, ID..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 text-white font-mono text-xs rounded-xl pl-9 pr-3 py-2 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="4D Express">4D Express</option>
            <option value="Three Super Card">Three Super Card</option>
            <option value="Speed 1m">Speed 1m</option>
            <option value="Bumper">Bumper Jackpot</option>
            <option value="Daily Mega">Daily Mega</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled / Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="p-8 bg-slate-900/80 border border-slate-800 rounded-3xl text-center text-slate-500 text-xs font-bold space-y-2">
            <Clock className="w-8 h-8 text-amber-500/50 mx-auto" />
            <p>No lottery result schedule slots found.</p>
            <p className="text-[10px] text-slate-400">Click "CREATE RESULT SCHEDULE SLOT" to schedule a draw countdown.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSchedules.map((slot) => {
              const isExpired = slot.scheduledTimestamp <= now;
              const isCompleted = slot.status === 'completed';
              const isEditing = editingSlotId === slot.id;

              return (
                <div key={slot.id} className="p-5 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl space-y-4 shadow-xl transition-all">
                  
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
                          {slot.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">#{slot.id}</span>
                      </div>
                      <h3 className="text-base font-black text-white mt-1">{slot.lotteryTitle}</h3>
                      <p className="text-xs text-amber-300 font-bold">{slot.slotName} ({slot.drawTimeLabel})</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border block ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : isExpired
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      }`}>
                        {isCompleted ? 'COMPLETED' : isExpired ? 'PUBLISHING...' : 'COUNTDOWN ACTIVE'}
                      </span>
                    </div>
                  </div>

                  {/* Countdown Timer Box */}
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block">REAL-TIME COUNTDOWN</span>
                      <span className="text-xl font-black text-amber-400 font-mono tracking-wider mt-0.5 block">
                        {isCompleted ? '00:00:00' : formatCountdown(slot.scheduledTimestamp)}
                      </span>
                    </div>

                    <div className="text-right space-y-0.5">
                      <span className="text-[9px] text-slate-400 uppercase font-black block">RESULT GRIDS</span>
                      <span className="text-sm font-black text-white">{slot.resultGridsCount} Grids</span>
                    </div>
                  </div>

                  {/* Winning Result Display / Pre-set Result */}
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">
                      {isCompleted ? '🏆 PUBLISHED WINNING RESULT:' : '🎯 PRE-SET WINNING RESULT:'}
                    </span>

                    {slot.winningResult && slot.winningResult.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {slot.winningResult.map((resItem, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black text-xs rounded-lg shadow uppercase"
                          >
                            {resItem}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-bold block pt-0.5">
                        [Auto-Generate Random Result on Countdown End]
                      </span>
                    )}
                  </div>

                  {/* Inline Parameter Editing Tool */}
                  {isEditing ? (
                    <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/40 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1">Result Grids Count (1-10):</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={editGridCount}
                            onChange={(e) => setEditGridCount(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1">Pre-set Winning Result:</label>
                          <input
                            type="text"
                            placeholder="e.g. 7, 7, 2, 9 or red"
                            value={editPreSelectedResult}
                            onChange={(e) => setEditPreSelectedResult(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingSlotId(null)}
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveSlotEdits(slot.id)}
                          className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-black rounded-xl"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="text-[10px] text-slate-400">
                      Prize: <strong className="text-emerald-400">₹{slot.prizePool.toLocaleString('en-IN')}</strong> | Ticket: ₹{slot.ticketPrice}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isCompleted && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSlotId(slot.id);
                              setEditGridCount(slot.resultGridsCount || 4);
                              setEditPreSelectedResult((slot.winningResult || []).join(', '));
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl transition-all"
                            title="Adjust Grids / Pre-set Result"
                          >
                            <Grid className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDispatchNow(slot)}
                            className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[10px] rounded-xl hover:brightness-110 flex items-center gap-1 cursor-pointer"
                          >
                            <Zap className="w-3 h-3 fill-slate-950" />
                            <span>DISPATCH NOW</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteSlot(slot.id, slot.lotteryTitle)}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl transition-all cursor-pointer"
                        title="Delete Schedule Slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Audit Log Stream */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Admin Scheduler Audit Stream</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
            Timestamps Logged
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2 text-center">No system actions logged yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-400">{log.action}</span>
                    <span className="text-[10px] text-slate-400">• By {log.adminName}</span>
                  </div>
                  <p className="text-[10px] text-slate-300">{log.details}</p>
                </div>
                <span className="text-[9px] text-slate-500 shrink-0 font-mono pl-2">{log.timestamp}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 p-6 rounded-3xl max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>Create Result Schedule Slot</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Quick Preset Templates:</span>
              <div className="flex flex-wrap gap-1.5">
                {lotteryPresetTemplates.map((tmpl) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-800 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Lottery Title:</label>
                  <input
                    type="text"
                    value={newLotteryTitle}
                    onChange={(e) => setNewLotteryTitle(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Category:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  >
                    <option value="4D Express">4D Express</option>
                    <option value="Three Super Card">Three Super Card</option>
                    <option value="Speed 1m">Speed 1m</option>
                    <option value="Bumper">Bumper Jackpot</option>
                    <option value="Daily Mega">Daily Mega</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Slot Name / Period:</label>
                  <input
                    type="text"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Time Label (e.g. 03:30 PM):</label>
                  <input
                    type="text"
                    value={newDrawTimeLabel}
                    onChange={(e) => setNewDrawTimeLabel(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Countdown (Mins):</label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Result Grids (1-10):</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={resultGridsCount}
                    onChange={(e) => setResultGridsCount(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Ticket Price (₹):</label>
                  <input
                    type="number"
                    min={10}
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">
                  Pre-Select Winning Result (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7, 7, 2, 9 or red or leave blank for auto"
                  value={preSelectedResult}
                  onChange={(e) => setPreSelectedResult(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-amber-300 font-bold p-2.5 rounded-xl text-xs outline-none placeholder-slate-600"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Leave empty to let the system generate random winning numbers automatically when time expires.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md hover:brightness-110 cursor-pointer"
                >
                  Create Schedule Slot
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
