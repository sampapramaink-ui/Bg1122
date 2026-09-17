import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Search, 
  Eye, 
  Flame, 
  ShieldCheck, 
  Coins, 
  ArrowRight,
  Shuffle,
  AlertCircle
} from 'lucide-react';
import { LotteryDraw, LotteryDrawResult, PurchasedTicket, User, WalletTransaction } from '../../types';
import { soundFx } from '../../utils/audio';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  limit, 
  where 
} from 'firebase/firestore';
import { INITIAL_DRAWS, INITIAL_DRAW_RESULTS } from '../../data/mockData';

interface AdminLotteryManagerProps {
  onTriggerDrawResult: (drawId: string, winningNumbers: number[]) => void;
  currentUser?: User;
}

export const AdminLotteryManager: React.FC<AdminLotteryManagerProps> = ({
  onTriggerDrawResult,
  currentUser
}) => {
  const [drawsList, setDrawsList] = useState<LotteryDraw[]>(INITIAL_DRAWS);
  const [resultsList, setResultsList] = useState<LotteryDrawResult[]>(INITIAL_DRAW_RESULTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Winner declaration state
  const [manualDigits, setManualDigits] = useState<{ [drawId: string]: string }>({});
  const [declaringDrawId, setDeclaringDrawId] = useState<string | null>(null);
  const [declarationStatus, setDeclarationStatus] = useState<string | null>(null);

  // Edit / Create Draw Modal
  const [isDrawModalOpen, setIsDrawModalOpen] = useState<boolean>(false);
  const [editingDraw, setEditingDraw] = useState<LotteryDraw | null>(null);
  const [drawFormData, setDrawFormData] = useState<Partial<LotteryDraw>>({
    title: '',
    subtitle: '',
    category: 'Bumper',
    ticketPrice: 50,
    prizePool: 1000000,
    firstPrize: 500000,
    secondPrize: 100000,
    thirdPrize: 25000,
    drawDurationMs: 60 * 60 * 1000,
    status: 'live',
    bannerGradient: 'from-amber-600 via-yellow-600 to-amber-800',
    badgeText: '🏆 500X WIN'
  });

  // Edit Result Modal
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);
  const [editingResult, setEditingResult] = useState<LotteryDrawResult | null>(null);
  const [resultDigitsInput, setResultDigitsInput] = useState<string>('');

  // Real-time Firestore Listeners for Draws and Results
  useEffect(() => {
    setLoading(true);

    const unsubDraws = onSnapshot(query(collection(db, 'draws'), limit(50)), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDraw));
        setDrawsList(list);
      } else {
        // Automatically seed initial draws if empty
        INITIAL_DRAWS.forEach((d) => {
          setDoc(doc(db, 'draws', d.id), d, { merge: true }).catch(() => {});
        });
        setDrawsList(INITIAL_DRAWS);
      }
    }, (err) => console.warn('AdminLotteryManager draws notice:', err));

    const unsubResults = onSnapshot(query(collection(db, 'draw_results'), limit(100)), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDrawResult));
        list.sort((a, b) => {
          const tA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.date || 0).getTime();
          const tB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.date || 0).getTime();
          return tB - tA;
        });
        setResultsList(list);
      } else {
        // Seed initial results if empty
        INITIAL_DRAW_RESULTS.forEach((r) => {
          setDoc(doc(db, 'draw_results', r.id), r, { merge: true }).catch(() => {});
        });
        setResultsList(INITIAL_DRAW_RESULTS);
      }
      setLoading(false);
    }, (err) => {
      console.warn('AdminLotteryManager results notice:', err);
      setLoading(false);
    });

    return () => {
      unsubDraws();
      unsubResults();
    };
  }, []);

  // Restore 4 Standard Official Lotteries in 1 click
  const handleRestoreOfficialDraws = async () => {
    soundFx.playClick();
    if (!window.confirm('Are you sure you want to seed & restore the 4 Standard Official Lotteries to Firestore?')) {
      return;
    }

    try {
      for (const d of INITIAL_DRAWS) {
        await setDoc(doc(db, 'draws', d.id), {
          ...d,
          endTime: Date.now() + d.drawDurationMs,
          status: 'live',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      soundFx.playWinFanfare();
      alert('All 4 Official Lotteries restored and synced with Firestore successfully!');
    } catch (err: any) {
      console.error('Error restoring draws:', err);
      alert('Failed to restore draws: ' + err.message);
    }
  };

  // Open Create Draw Modal
  const handleOpenCreateDraw = () => {
    soundFx.playClick();
    setEditingDraw(null);
    setDrawFormData({
      id: `draw-${Date.now()}`,
      title: 'SUPER BUMPER DHAMAKA',
      subtitle: 'Instant Cash Jackpot • Daily Live',
      category: 'Bumper',
      ticketPrice: 100,
      prizePool: 2000000,
      firstPrize: 1000000,
      secondPrize: 250000,
      thirdPrize: 50000,
      drawDurationMs: 60 * 60 * 1000,
      status: 'live',
      bannerGradient: 'from-amber-600 via-yellow-600 to-amber-800',
      badgeText: '🌟 1000X WIN'
    });
    setIsDrawModalOpen(true);
  };

  // Open Edit Draw Modal
  const handleOpenEditDraw = (draw: LotteryDraw) => {
    soundFx.playClick();
    setEditingDraw(draw);
    setDrawFormData({ ...draw });
    setIsDrawModalOpen(true);
  };

  // Save Draw (Create or Update)
  const handleSaveDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();

    const drawId = editingDraw ? editingDraw.id : (drawFormData.id || `draw-${Date.now()}`);
    const finalDraw: LotteryDraw = {
      id: drawId,
      title: drawFormData.title || 'Official Lottery Draw',
      subtitle: drawFormData.subtitle || 'Instant Win Jackpot',
      category: (drawFormData.category as any) || 'Bumper',
      ticketPrice: Number(drawFormData.ticketPrice) || 50,
      prizePool: Number(drawFormData.prizePool) || 1000000,
      firstPrize: Number(drawFormData.firstPrize) || 500000,
      secondPrize: Number(drawFormData.secondPrize) || 100000,
      thirdPrize: Number(drawFormData.thirdPrize) || 25000,
      endTime: editingDraw ? (editingDraw.endTime || Date.now() + 3600000) : (Date.now() + (Number(drawFormData.drawDurationMs) || 3600000)),
      drawDurationMs: Number(drawFormData.drawDurationMs) || 3600000,
      status: (drawFormData.status as any) || 'live',
      totalTicketsSold: editingDraw ? editingDraw.totalTicketsSold : 0,
      bannerGradient: drawFormData.bannerGradient || 'from-amber-600 via-yellow-600 to-amber-800',
      badgeText: drawFormData.badgeText || '🎯 JACKPOT',
      winningNumbers: editingDraw?.winningNumbers || []
    };

    try {
      await setDoc(doc(db, 'draws', drawId), finalDraw, { merge: true });
      soundFx.playCoin();
      setIsDrawModalOpen(false);
      alert(`Lottery Draw "${finalDraw.title}" saved successfully to Firestore!`);
    } catch (err: any) {
      console.error('Error saving draw:', err);
      alert('Failed to save draw: ' + err.message);
    }
  };

  // Delete Draw
  const handleDeleteDraw = async (drawId: string, title: string) => {
    soundFx.playClick();
    if (!window.confirm(`Are you sure you want to delete lottery draw "${title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'draws', drawId));
      soundFx.playCoin();
      alert('Draw deleted from Firestore.');
    } catch (err: any) {
      console.error('Error deleting draw:', err);
      alert('Failed to delete draw: ' + err.message);
    }
  };

  // Quick Random Digits Generator for Draw
  const handleGenerateRandomDigits = (draw: LotteryDraw) => {
    soundFx.playClick();
    const len = draw.category === '4D Express' ? 4 : 6;
    const digits = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
    setManualDigits(prev => ({ ...prev, [draw.id]: digits }));
  };

  // Declare Draw Result & Automatically Process Winnings & Payouts in Firestore
  const handleDeclareDrawWinner = async (draw: LotteryDraw) => {
    const digitString = manualDigits[draw.id]?.trim();
    const len = draw.category === '4D Express' ? 4 : 6;

    if (!digitString || digitString.length < (draw.category === '4D Express' ? 3 : 4)) {
      alert(`Please enter winning digits (e.g. ${len} numbers like ${len === 4 ? '7729' : '482910'})`);
      return;
    }

    const digits = digitString.split('').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));
    if (digits.length === 0) return;

    if (!window.confirm(`Declare winning digits [${digits.join(' ')}] for "${draw.title}" and process all ticket payouts?`)) {
      return;
    }

    setDeclaringDrawId(draw.id);
    setDeclarationStatus('Processing draw result and evaluating player tickets in Firestore...');
    soundFx.playWinFanfare();

    try {
      const resultDocId = `res-${draw.id}-${Date.now()}`;
      const winString = digits.join('');

      // 1. Fetch tickets for this draw
      const ticketsQuery = query(collection(db, 'tickets'), where('drawId', '==', draw.id));
      const ticketSnap = await getDocs(ticketsQuery);

      let winnerCount = 0;
      let totalPayoutAmount = 0;

      for (const tDoc of ticketSnap.docs) {
        const ticket = tDoc.data() as PurchasedTicket;
        if (ticket.status === 'active') {
          const tSelected = (ticket.selectedNumbers || (ticket as any).numbers || []).join('');
          const isWin = tSelected === winString || ticket.ticketNumber === winString;
          const wonAmount = isWin ? draw.firstPrize : 0;
          const newStatus = isWin ? 'win' : 'loss';

          // Update ticket doc
          await setDoc(doc(db, 'tickets', tDoc.id), {
            status: newStatus,
            wonAmount,
            resolvedAt: new Date().toISOString()
          }, { merge: true });

          if (isWin && wonAmount > 0) {
            winnerCount++;
            totalPayoutAmount += wonAmount;

            // Credit winner's wallet
            const userDocRef = doc(db, 'users', ticket.userId);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              const currBal = typeof uData.balance === 'number' ? uData.balance : 0;
              const currWon = typeof uData.totalWon === 'number' ? uData.totalWon : 0;

              await setDoc(userDocRef, {
                balance: currBal + wonAmount,
                totalWon: currWon + wonAmount
              }, { merge: true });

              // Log winning wallet transaction
              const txId = `TX-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              await setDoc(doc(db, 'transactions', txId), {
                id: txId,
                userId: ticket.userId,
                type: 'win_payout',
                amount: wonAmount,
                description: `Lottery 1st Prize Win: ${draw.title} (Ticket: ${ticket.ticketNumber || winString})`,
                status: 'completed',
                date: new Date().toLocaleString('en-IN')
              });

              // Send winning notification
              const notifId = `NOTIF-WIN-${Date.now()}`;
              await setDoc(doc(db, 'notifications', notifId), {
                id: notifId,
                userId: ticket.userId,
                targetUserId: ticket.userId,
                title: '🎉 CONGRATULATIONS! LOTTERY JACKPOT WON!',
                message: `You won ₹${wonAmount.toLocaleString('en-IN')} in ${draw.title} with lucky ticket ${ticket.ticketNumber || winString}! Funds added to your wallet.`,
                type: 'win',
                read: false,
                isGlobal: false,
                createdAt: Date.now(),
                date: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              });
            }
          }
        }
      }

      // 2. Save result in draw_results collection
      const resultData: LotteryDrawResult = {
        id: resultDocId,
        drawId: draw.id,
        title: `${draw.title} #${Date.now().toString().slice(-4)}`,
        category: draw.category,
        winningNumbers: digits,
        firstPrize: draw.firstPrize,
        secondPrize: draw.secondPrize,
        thirdPrize: draw.thirdPrize,
        date: new Date().toLocaleString('en-IN'),
        createdAt: Date.now(),
        totalWinners: winnerCount,
        totalPayout: totalPayoutAmount,
        declaredBy: currentUser?.email || 'Admin Master Portal'
      };

      await setDoc(doc(db, 'draw_results', resultDocId), resultData);

      // 3. Update draw document with latest winning numbers & reset countdown for next round
      await setDoc(doc(db, 'draws', draw.id), {
        winningNumbers: digits,
        endTime: Date.now() + draw.drawDurationMs,
        status: 'live',
        totalTicketsSold: 0,
        lastDrawTime: new Date().toISOString()
      }, { merge: true });

      // Trigger callback
      onTriggerDrawResult(draw.id, digits);

      setDeclarationStatus(`✅ Winner declared! [${digits.join(' ')}]. ${winnerCount} winners paid ₹${totalPayoutAmount.toLocaleString('en-IN')}.`);
      setTimeout(() => {
        setDeclaringDrawId(null);
        setDeclarationStatus(null);
      }, 4000);

    } catch (err: any) {
      console.error('Error declaring winner:', err);
      alert('Failed to declare winner: ' + err.message);
      setDeclaringDrawId(null);
      setDeclarationStatus(null);
    }
  };

  // Open Edit Past Result Modal
  const handleOpenEditResult = (res: LotteryDrawResult) => {
    soundFx.playClick();
    setEditingResult(res);
    setResultDigitsInput((res.winningNumbers || []).join(''));
    setIsResultModalOpen(true);
  };

  // Save Edited Past Result
  const handleSaveResultEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResult) return;
    soundFx.playClick();

    const digits = resultDigitsInput.split('').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));
    if (digits.length === 0) {
      alert('Please enter valid numeric digits.');
      return;
    }

    try {
      await setDoc(doc(db, 'draw_results', editingResult.id), {
        ...editingResult,
        winningNumbers: digits,
        updatedAt: new Date().toISOString(),
        declaredBy: `${currentUser?.email || 'Admin'} (Manual Override)`
      }, { merge: true });

      soundFx.playCoin();
      setIsResultModalOpen(false);
      alert('Lottery result updated successfully!');
    } catch (err: any) {
      console.error('Error updating result:', err);
      alert('Failed to update result: ' + err.message);
    }
  };

  // Delete Past Result
  const handleDeleteResult = async (resultId: string, title: string) => {
    soundFx.playClick();
    if (!window.confirm(`Are you sure you want to delete result record "${title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'draw_results', resultId));
      soundFx.playCoin();
      alert('Result deleted from Firestore.');
    } catch (err: any) {
      console.error('Error deleting result:', err);
      alert('Failed to delete result: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      
      {/* Top Header Row with Actions */}
      <div className="bg-slate-900 border border-amber-500/30 p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
              Real-time Firestore Control
            </span>
            <span className="text-xs text-slate-400 font-bold">• {drawsList.length} Active Draws</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">4 Lotteries & Draw Results Control Center</h2>
          <p className="text-xs text-slate-400">
            Manage official lottery draws, edit prize structures, declare winners manually, and edit past result archives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRestoreOfficialDraws}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Restore and seed the 4 default official lotteries to Firestore"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>⚡ RESTORE 4 STANDARD DRAWS</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateDraw}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ CREATE NEW DRAW</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ACTIVE 4 LOTTERIES CARDS & RESULT SELECTOR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Live Lottery Draws ({drawsList.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            Tip: Type winning digits and click Declare Winner to instantly distribute winnings to player wallets!
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drawsList.map((draw) => (
            <div
              key={draw.id}
              className="bg-slate-900 border border-amber-500/30 hover:border-amber-400/60 rounded-3xl p-5 shadow-2xl transition-all space-y-4 relative overflow-hidden"
            >
              {/* Top Accent Stripe */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${draw.bannerGradient || 'from-amber-500 to-yellow-500'}`} />

              {/* Draw Header */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase">
                      {draw.category}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">#{draw.id}</span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-white mt-1">{draw.title}</h4>
                  <p className="text-xs text-slate-400">{draw.subtitle}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditDraw(draw)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                    title="Edit Draw Settings"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraw(draw.id, draw.title)}
                    className="p-2 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                    title="Delete Draw"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Draw Parameters Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">Ticket Price</span>
                  <span className="font-black text-amber-300">₹{draw.ticketPrice}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">1st Prize</span>
                  <span className="font-black text-emerald-400">₹{draw.firstPrize.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">Prize Pool</span>
                  <span className="font-black text-white">₹{draw.prizePool.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* MANUAL WINNER DECLARATION & PAYOUT TOOL */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Declare Winning Numbers:</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleGenerateRandomDigits(draw)}
                    className="text-[10px] text-amber-300 hover:text-white flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 cursor-pointer"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Random</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={draw.category === '4D Express' ? 'e.g. 7729 (4 digits)' : 'e.g. 482910 (6 digits)'}
                    value={manualDigits[draw.id] || ''}
                    onChange={(e) => setManualDigits({ ...manualDigits, [draw.id]: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white font-mono text-sm font-black px-3 py-2 rounded-xl outline-none focus:border-amber-400 transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeclareDrawWinner(draw)}
                    disabled={declaringDrawId === draw.id}
                    className={`px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      declaringDrawId === draw.id ? 'opacity-50 cursor-wait' : ''
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{declaringDrawId === draw.id ? 'PROCESSING...' : 'DECLARE & PAYOUT'}</span>
                  </button>
                </div>

                {declaringDrawId === draw.id && declarationStatus && (
                  <p className="text-[11px] font-bold text-amber-300 animate-pulse bg-amber-950/40 p-2 rounded-xl border border-amber-500/30">
                    {declarationStatus}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Matches all active tickets in Firestore & automatically deposits winnings</span>
                  {draw.winningNumbers && draw.winningNumbers.length > 0 && (
                    <span className="text-amber-400 font-bold">
                      Last: [{draw.winningNumbers.join(' ')}]
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: HISTORICAL DRAW RESULTS ARCHIVE & LIVE EDITOR */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Historical Results Archive ({resultsList.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time Firestore results collection. You can edit winning digits or remove past results anytime.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search draw result..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-amber-400 outline-none"
            />
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Result ID & Draw</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Winning Digits</th>
                  <th className="p-3.5">1st Prize</th>
                  <th className="p-3.5">Winners</th>
                  <th className="p-3.5">Date Declared</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {resultsList
                  .filter(r => 
                    !searchTerm || 
                    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (r.winningNumbers || []).join('').includes(searchTerm)
                  )
                  .map((res) => (
                    <tr key={res.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-black text-white">{res.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {res.id}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">
                          {res.category || 'Standard'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1">
                          {(res.winningNumbers || []).map((digit, idx) => (
                            <span
                              key={idx}
                              className="w-6 h-7 bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black font-mono text-xs rounded flex items-center justify-center shadow"
                            >
                              {digit}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 font-black text-emerald-400">
                        ₹{(res.firstPrize || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-amber-300 font-bold">
                        {res.totalWinners || 0} Players
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {res.date}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEditResult(res)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-[11px] font-bold border border-slate-700 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteResult(res.id, res.title)}
                          className="px-2 py-1 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg text-[11px] font-bold border border-slate-700 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: CREATE / EDIT LOTTERY DRAW */}
      {isDrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 my-auto animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white mb-1">
              {editingDraw ? 'Edit Lottery Draw' : 'Create New Lottery Draw'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Configure lottery rules, ticket price, prize structure, and schedule.
            </p>

            <form onSubmit={handleSaveDraw} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Draw Title</label>
                  <input
                    type="text"
                    required
                    value={drawFormData.title || ''}
                    onChange={(e) => setDrawFormData({ ...drawFormData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Category</label>
                  <select
                    value={drawFormData.category || 'Bumper'}
                    onChange={(e) => setDrawFormData({ ...drawFormData, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                  >
                    <option value="Bumper">Bumper (6 Digits)</option>
                    <option value="Speed 1m">Speed 1m (4 Digits)</option>
                    <option value="Daily Mega">Daily Mega (6 Digits)</option>
                    <option value="4D Express">4D Express (4 Digits)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Subtitle / Marketing Text</label>
                <input
                  type="text"
                  value={drawFormData.subtitle || ''}
                  onChange={(e) => setDrawFormData({ ...drawFormData, subtitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Ticket Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={drawFormData.ticketPrice || 50}
                    onChange={(e) => setDrawFormData({ ...drawFormData, ticketPrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-black outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">1st Prize (₹)</label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={drawFormData.firstPrize || 500000}
                    onChange={(e) => setDrawFormData({ ...drawFormData, firstPrize: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-black outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Total Pool (₹)</label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={drawFormData.prizePool || 1000000}
                    onChange={(e) => setDrawFormData({ ...drawFormData, prizePool: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-black outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">2nd Prize (₹)</label>
                  <input
                    type="number"
                    value={drawFormData.secondPrize || 100000}
                    onChange={(e) => setDrawFormData({ ...drawFormData, secondPrize: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">3rd Prize (₹)</label>
                  <input
                    type="number"
                    value={drawFormData.thirdPrize || 25000}
                    onChange={(e) => setDrawFormData({ ...drawFormData, thirdPrize: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={Math.floor((drawFormData.drawDurationMs || 3600000) / 60000)}
                    onChange={(e) => setDrawFormData({ ...drawFormData, drawDurationMs: Number(e.target.value) * 60000 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Status</label>
                  <select
                    value={drawFormData.status || 'live'}
                    onChange={(e) => setDrawFormData({ ...drawFormData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-400"
                  >
                    <option value="live">Live / Open</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed / Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDrawModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                >
                  Save Draw
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PAST RESULT */}
      {isResultModalOpen && editingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 my-auto animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white mb-1">Edit Past Draw Result</h3>
            <p className="text-xs text-slate-400 mb-4">{editingResult.title}</p>

            <form onSubmit={handleSaveResultEdit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Winning Digits</label>
                <input
                  type="text"
                  required
                  value={resultDigitsInput}
                  onChange={(e) => setResultDigitsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2.5 text-amber-300 font-mono font-black text-lg text-center outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-500 mt-1 text-center">
                  Enter digits without spaces (e.g. 482910 or 7729)
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResultModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                >
                  Save Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
