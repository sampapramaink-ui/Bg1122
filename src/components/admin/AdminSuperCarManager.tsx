import React, { useState, useEffect } from 'react';
import {
  Upload, Trash2, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, RefreshCw,
  Lock, DollarSign, Sparkles, TrendingUp, CheckCircle2, XCircle, Search,
  Filter, Grid, Table as TableIcon, Users, Clock, Award, ShieldAlert, ArrowUpRight, RotateCcw,
  Activity, PieChart as PieChartIcon, BarChart2, Trophy, Edit, Zap, Flame, Calendar,
  Percent, ShieldCheck, Gift, Wallet, PlayCircle, StopCircle, Sliders, ChevronRight, Info
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import {
  SuperCarConfig,
  SuperCarColor,
  PurchasedTicket,
  User,
  SuperCarDrawIssue
} from '../../types';
import {
  getSuperCarInfo,
  formatTicketExactTime,
  formatTicketExactDateTime,
  sortChronologicalNewestFirst,
  groupTicketsByBatch,
  GroupedTicketBatch,
  getSuperCarSlotTimeLabel,
  getCurrentSuperCarSchedule,
  getSuperCarSlotsPerDay,
  getSuperCarDailySlots,
  getLocalTodayDateStr,
  SuperCarSlotItem
} from '../../utils/supercar';
import { calculateSuperCarLiveBettingStats, SuperCarLiveBettingStats, SuperCarLivePoolData } from '../../utils/supercarBettingEngine';
import { soundFx } from '../../utils/audio';
import { PaginationBar } from '../PaginationBar';
import { getUserDisplayCode, generatePermanentUserCode } from '../../utils/databaseSync';

interface AdminSuperCarManagerProps {
  config: SuperCarConfig;
  onUpdateConfig: (updated: Partial<SuperCarConfig>) => Promise<void>;
}

export const AdminSuperCarManager: React.FC<AdminSuperCarManagerProps> = ({ config, onUpdateConfig }) => {
  // Top Navigation Sub-Tabs (Live Engine as Default Hero View)
  const [activeSubTab, setActiveSubTab] = useState<'live_engine' | 'monitor' | 'draws' | 'tickets' | 'images'>('live_engine');

  // House Edge & Live Engine State (0% to 99.5%)
  const [houseEdgeInput, setHouseEdgeInput] = useState<number>(config.houseEdgePercent ?? 15);
  const [isSavingHouseEdge, setIsSavingHouseEdge] = useState<boolean>(false);
  const [selectedLiveSlot, setSelectedLiveSlot] = useState<number | 'current'>('current');
  const [livePlayerSearchTerm, setLivePlayerSearchTerm] = useState<string>('');
  const [liveCarFilter, setLiveCarFilter] = useState<'all' | SuperCarColor>('all');

  // Real-time ticking schedule (every 1 sec)
  const [currentSched, setCurrentSched] = useState(() => getCurrentSuperCarSchedule(config));
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSched(getCurrentSuperCarSchedule(config));
    }, 1000);
    return () => clearInterval(timer);
  }, [config]);

  // Keep houseEdgeInput synced with config
  useEffect(() => {
    if (config.houseEdgePercent !== undefined) {
      setHouseEdgeInput(config.houseEdgePercent);
    }
  }, [config.houseEdgePercent]);

  // Handler to Save House Edge (0% to 99.5%)
  const handleSaveHouseEdge = async (newEdge?: number) => {
    const val = typeof newEdge === 'number' ? newEdge : Number(houseEdgeInput);
    if (isNaN(val) || val < 0 || val > 99.5) {
      setStatusMessage({ type: 'error', text: 'House Edge must be between 0% and 99.5%!' });
      return;
    }
    soundFx.playWinFanfare();
    setIsSavingHouseEdge(true);
    try {
      await onUpdateConfig({ houseEdgePercent: val });
      setHouseEdgeInput(val);
      setStatusMessage({
        type: 'success',
        text: `✅ House Edge updated to ${val.toFixed(1)}%! Auto-result engine will now calculate and optimize winners for this house edge.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to save House Edge: ${err.message}` });
    } finally {
      setIsSavingHouseEdge(false);
    }
  };

  // Handler to Toggle Bonus-Only Betting Mode
  const handleToggleBonusOnly = async () => {
    soundFx.playClick();
    const currentBonusOnly = config.bonusOnly !== false;
    const nextVal = !currentBonusOnly;
    try {
      await onUpdateConfig({ bonusOnly: nextVal });
      setStatusMessage({
        type: 'success',
        text: nextVal
          ? '🔒 Bonus Only mode ACTIVATED: Users can strictly buy Super Car tickets with Bonus Balance only!'
          : '🔓 Bonus Only mode DISABLED: Users can use both Main Cash and Bonus Balance.'
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update Bonus Only setting: ${err.message}` });
    }
  };

  // Handler to Force Slot Winner manually
  const handleForceSlotWinner = async (slotNumber: number, targetIssueId: string, carColor: SuperCarColor) => {
    soundFx.playWinFanfare();
    try {
      const timeLabel = getSlotTimeLabel(slotNumber);
      const newManualWinners = {
        ...(config.manualSlotWinners || {}),
        [targetIssueId]: carColor
      };
      await onUpdateConfig({
        manualSlotWinners: newManualWinners,
        resultMode: 'manual',
        manualWinner: carColor
      });

      await setDoc(doc(db, 'supercar_draws', targetIssueId), {
        id: targetIssueId,
        issueId: targetIssueId,
        drawIndex: slotNumber,
        drawTime: timeLabel,
        winningCar: carColor,
        status: 'completed',
        manualOverride: true,
        declaredAt: new Date().toISOString()
      }, { merge: true });

      setStatusMessage({
        type: 'success',
        text: `🎯 Slot #${slotNumber} (${targetIssueId}) manually overridden to ${carColor.toUpperCase()} CAR! Syncing instantly to all player screens.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to force winner: ${err.message}` });
    }
  };

  // Real-time Firestore State
  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [usersMap, setUsersMap] = useState<{ [uid: string]: User }>({});
  const [drawsMap, setDrawsMap] = useState<{ [issueId: string]: any }>({});
  const [livePools, setLivePools] = useState<Record<string, SuperCarLivePoolData>>({});

  // Filter tickets for Super Car
  const supercarTickets = React.useMemo(() => {
    return tickets.filter(
      (t) => t.category === 'Three Super Car Draw' || t.drawTitle?.includes('Super Car')
    );
  }, [tickets]);

  // Uploader & Action States
  const [uploadingCar, setUploadingCar] = useState<SuperCarColor | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [urlInputs, setUrlInputs] = useState<{ [key in SuperCarColor]?: string }>({});

  // Sub-Tab 1 (Sales Monitor) State
  const todayStr = getLocalTodayDateStr();
  const [monitorSelectedDateStr, setMonitorSelectedDateStr] = useState<string>(todayStr);
  const [selectedMonitorSlot, setSelectedMonitorSlot] = useState<number | 'all'>('all');

  // Sub-Tab 2 (Daily Draws Results) State
  const [adminSelectedDateStr, setAdminSelectedDateStr] = useState<string>(todayStr);
  const [drawsSearchTerm, setDrawsSearchTerm] = useState<string>('');
  const [drawsViewMode, setDrawsViewMode] = useState<'grid' | 'table'>('table');
  const [drawsFilterStatus, setDrawsFilterStatus] = useState<'all' | 'completed' | 'active' | 'upcoming'>('all');
  const [gameCategoryTab, setGameCategoryTab] = useState<'daily' | 'supercar'>('supercar');

  // Convert drawsMap to list of SuperCarDrawIssue
  const pastDrawsList: SuperCarDrawIssue[] = Object.values(drawsMap);

  // Compute 144 daily slots using the exact same standard engine as the user panel
  const [adminTargetY, adminTargetM, adminTargetD] = (adminSelectedDateStr || todayStr).split('-').map(Number);
  const adminTargetDateObj = new Date(adminTargetY, adminTargetM - 1, adminTargetD);

  const adminDailySlots: SuperCarSlotItem[] = getSuperCarDailySlots(adminTargetDateObj, pastDrawsList, config, supercarTickets);

  // Helper for admin target date string formatting
  const getAdminDateStr = () => {
    const [y, m, d] = (adminSelectedDateStr || todayStr).split('-').map(Number);
    return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  };

  // Edit Result Modal State
  const [editingSlotModal, setEditingSlotModal] = useState<number | null>(null);
  const [editWinningCar, setEditWinningCar] = useState<SuperCarColor>('red');
  const [editWinnerTicket, setEditWinnerTicket] = useState<string>('');
  const [editWinnerName, setEditWinnerName] = useState<string>('');
  const [editPrizeAmount, setEditPrizeAmount] = useState<string>('₹50,000');

  const openEditResultModal = (slotNum: number) => {
    soundFx.playClick();
    const timeLabel = getSlotTimeLabel(slotNum);
    const dateStr = getAdminDateStr();
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;
    const drawData = drawsMap[issueId];
    const slotItem = adminDailySlots.find((s) => s.slotNum === slotNum);
    const currentWinner = slotItem?.winningCar || drawData?.winningCar || config.manualSlotWinners?.[issueId] || config.manualSlotWinners?.[slotNum] || 'red';

    setEditingSlotModal(slotNum);
    setEditWinningCar(currentWinner);
    setEditWinnerTicket(drawData?.winnerTicket || `TCK-${Math.floor(100000 + Math.random() * 900000)}`);
    setEditWinnerName(drawData?.winnerName || `Winner (Slot #${slotNum})`);
    setEditPrizeAmount(drawData?.prizeText || (slotNum % 3 === 0 ? '₹1,00,00,000' : '₹50,000'));
  };

  const handleSaveEditResultModal = async () => {
    if (!editingSlotModal) return;
    soundFx.playWinFanfare();
    const slotNum = editingSlotModal;
    const timeLabel = getSlotTimeLabel(slotNum);
    const dateStr = getAdminDateStr();
    const [y, m, d] = (adminSelectedDateStr || todayStr).split('-').map(Number);
    const formattedDateLabel = new Date(y, m - 1, d).toLocaleDateString('en-IN');
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;

    const drawIssueDoc = {
      id: issueId,
      issueId,
      drawIndex: slotNum,
      drawTime: `${formattedDateLabel} ${timeLabel}`,
      winningCar: editWinningCar,
      status: 'completed',
      prizeMultiplier: config.carMultipliers?.[editWinningCar] || config.prizeMultiplier || 2.8,
      winnerTicket: editWinnerTicket.trim() || `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      winnerName: editWinnerName.trim() || `Winner (Slot #${slotNum})`,
      prizeText: editPrizeAmount.trim() || '₹50,000',
      createdAt: new Date().toISOString(),
      declaredAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'supercar_draws', issueId), drawIssueDoc, { merge: true });

      // Save to config.manualSlotWinners for instant real-time sync
      const newManualWinners = { ...(config.manualSlotWinners || {}), [slotNum]: editWinningCar, [issueId]: editWinningCar };
      await onUpdateConfig({ manualSlotWinners: newManualWinners });

      // Settle tickets for this slot automatically
      const slotTickets = supercarTickets.filter(
        (t) => t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(slotNum).padStart(2, '0')}`)
      );

      const multiplier = config.carMultipliers?.[editWinningCar] || config.prizeMultiplier || 2.8;
      for (const t of slotTickets) {
        if (t.status === 'active' || t.status === 'pending') {
          const userCarChoice = (t.selectedCar || t.selectedNumbers?.[0] as string || 'red').toLowerCase() as SuperCarColor;
          const isWin = userCarChoice === editWinningCar;
          const wonAmt = isWin ? Math.round((t.price || 0) * multiplier) : 0;
          await setDoc(doc(db, 'tickets', t.id), {
            status: isWin ? 'win' : 'loss',
            wonAmount: wonAmt,
            winAmount: wonAmt,
            settledAt: new Date().toISOString()
          }, { merge: true });

          if (isWin && wonAmt > 0 && t.userId) {
            const userDocRef = doc(db, 'users', t.userId);
            const uSnap = await getDoc(userDocRef);
            if (uSnap.exists()) {
              const uData = uSnap.data();
              const isBonus = t.walletType === 'bonus';
              const newBal = isBonus ? (uData.balance || 0) : ((uData.balance || 0) + wonAmt);
              const newBonus = isBonus ? ((uData.bonusBalance || 0) + wonAmt) : (uData.bonusBalance || 0);
              const newWon = (uData.totalWon || 0) + wonAmt;
              await setDoc(userDocRef, { balance: newBal, bonusBalance: newBonus, totalWon: newWon }, { merge: true });

              const txId = `TXN-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              await setDoc(doc(db, 'transactions', txId), {
                id: txId,
                userId: t.userId,
                type: 'win',
                amount: wonAmt,
                walletType: isBonus ? 'bonus' : 'main',
                description: `3 Super Car Draw Win: Slot #${slotNum} (${editWinningCar.toUpperCase()} CAR) - Net Prize ₹${wonAmt} Credited`,
                date: new Date().toLocaleString()
              }, { merge: true });
            }
          }
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Result saved for Slot #${slotNum} (${timeLabel}) -> ${editWinningCar.toUpperCase()} CAR! Syncing automatically to all user screens.`
      });
      setEditingSlotModal(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to save slot result: ${err.message}` });
    }
  };

  // Sub-Tab 3 (User Ticket Audit) State
  const [auditSelectedDateStr, setAuditSelectedDateStr] = useState<string>(todayStr);
  const [ticketSearchTerm, setTicketSearchTerm] = useState<string>('');
  const [ticketSlotFilter, setTicketSlotFilter] = useState<number | 'all'>('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'active' | 'win' | 'loss'>('all');
  const [ticketCarFilter, setTicketCarFilter] = useState<'all' | SuperCarColor>('all');
  const [ticketPage, setTicketPage] = useState<number>(1);
  const [ticketPageSize, setTicketPageSize] = useState<number>(10);
  const [settlingTicketId, setSettlingTicketId] = useState<string | null>(null);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Listen to all supercar tickets
    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snap) => {
      const fetched: PurchasedTicket[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as PurchasedTicket;
        if (data.category === 'Three Super Car Draw' || data.drawTitle?.includes('Super Car')) {
          fetched.push({ ...data, id: docSnap.id });
        }
      });
      setTickets(sortChronologicalNewestFirst(fetched));
    }, (err) => console.warn('Supercar tickets listener notice:', err.message));

    // 2. Listen to supercar draws history
    const unsubDraws = onSnapshot(collection(db, 'supercar_draws'), (snap) => {
      const map: { [issueId: string]: any } = {};
      snap.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data();
      });
      setDrawsMap(map);
    }, (err) => console.warn('Supercar draws listener notice:', err.message));

    // 2.5 Listen to live pool rounds for concurrent player sync
    const unsubLive = onSnapshot(collection(db, 'supercar_live_rounds'), (snap) => {
      const pools: Record<string, SuperCarLivePoolData> = {};
      snap.forEach((docSnap) => {
        pools[docSnap.id] = docSnap.data() as SuperCarLivePoolData;
      });
      setLivePools(pools);
    }, (err) => console.warn('Supercar live pools listener notice:', err.message));

    // 3. Listen to users directory
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: { [uid: string]: User } = {};
      snap.forEach((docSnap) => {
        map[docSnap.id] = { ...docSnap.data(), id: docSnap.id } as User;
      });
      setUsersMap(map);
    }, (err) => console.warn('Users listener notice:', err.message));

    return () => {
      unsubTickets();
      unsubDraws();
      unsubLive();
      unsubUsers();
    };
  }, []);

  // Automatically restore Auto Low-Risk mode when transitioning to the next slot
  const prevSlotRef = React.useRef(currentSched.drawIndex);
  useEffect(() => {
    if (prevSlotRef.current !== currentSched.drawIndex) {
      prevSlotRef.current = currentSched.drawIndex;
      if (config.resultMode === 'manual' || config.manualWinner) {
        onUpdateConfig({
          resultMode: 'auto',
          manualWinner: undefined
        });
      }
    }
  }, [currentSched.drawIndex, config.resultMode, config.manualWinner, onUpdateConfig]);

  // 24/7 Total Daily Slots (144 slots in 10-min intervals)
  const totalSlotsCount = getSuperCarSlotsPerDay(config);

  // Format slot time helper (1 to 144 slots: 24/7 continuous)
  const getSlotTimeLabel = (slotNum: number) => {
    return getSuperCarSlotTimeLabel(slotNum, config.drawIntervalMinutes || 10);
  };

  // Image Upload Handler
  const handleFileUpload = async (carKey: SuperCarColor, file: File) => {
    setStatusMessage(null);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setStatusMessage({ type: 'error', text: 'Invalid image format! Please upload JPG, PNG, or WebP.' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'File size exceeds 15MB! Please select a smaller image.' });
      return;
    }

    setUploadingCar(carKey);
    setUploadProgress(20);

    try {
      const compressedBlob = await compressImage(file, 800, 0.75);
      setUploadProgress(50);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(compressedBlob);
      });

      setUploadProgress(75);
      const updatedCarImages = { ...(config.carImages || {}), [carKey]: dataUrl };
      await onUpdateConfig({ carImages: updatedCarImages });

      setUploadProgress(100);
      try { soundFx.playWinFanfare(); } catch (_) {}
      setStatusMessage({
        type: 'success',
        text: `Successfully uploaded & updated ${carKey.toUpperCase()} supercar image! Syncing to user UI in real-time.`
      });

      // Background storage upload
      (async () => {
        try {
          const storagePath = `supercar_images/${carKey}_${Date.now()}.webp`;
          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, compressedBlob);

          const storageUrl = await Promise.race<string | null>([
            new Promise<string | null>((resolve) => {
              uploadTask.on(
                'state_changed',
                null,
                () => resolve(null),
                async () => {
                  try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                  } catch { resolve(null); }
                }
              );
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
          ]);

          if (storageUrl) {
            await onUpdateConfig({ carImages: { ...(config.carImages || {}), [carKey]: storageUrl } });
          }
        } catch (_) {}
      })();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Upload failed: ${err.message || 'Unknown error'}` });
    } finally {
      setUploadingCar(null);
      setUploadProgress(0);
    }
  };

  const compressImage = (file: File, maxWidth: number, quality: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/webp', quality);
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = async (carKey: SuperCarColor) => {
    soundFx.playClick();
    const newCarImages = { ...config.carImages };
    delete newCarImages[carKey];
    await onUpdateConfig({ carImages: newCarImages });
    setStatusMessage({ type: 'success', text: `Reset ${carKey.toUpperCase()} car image to default.` });
  };

  // Publish Winner for a Daily Slot
  const handlePublishSlotWinner = async (slotNum: number, winningCar: SuperCarColor) => {
    soundFx.playWinFanfare();
    const timeLabel = getSlotTimeLabel(slotNum);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;

    const drawIssueDoc = {
      id: issueId,
      issueId,
      drawIndex: slotNum,
      drawTime: `${now.toLocaleDateString('en-IN')} ${timeLabel}`,
      winningCar,
      status: 'completed',
      prizeMultiplier: config.carMultipliers?.[winningCar] || config.prizeMultiplier || 2.8,
      declaredAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'supercar_draws', issueId), drawIssueDoc, { merge: true });

      // Settle tickets for this slot automatically
      const multiplier = config.carMultipliers?.[winningCar] || config.prizeMultiplier || 2.8;
      const slotTickets = supercarTickets.filter((t) => {
        return t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(slotNum).padStart(2, '0')}`);
      });

      for (const t of slotTickets) {
        const choice = (t.selectedCar || t.selectedNumbers?.[0] as string || '').toLowerCase();
        const isWinner = choice === winningCar;
        const payout = isWinner ? Math.round((t.price || 100) * multiplier) : 0;

        await setDoc(doc(db, 'tickets', t.id), {
          status: isWinner ? 'win' : 'loss',
          wonAmount: payout,
          winAmount: payout,
          settledAt: new Date().toISOString()
        }, { merge: true });

        if (isWinner && payout > 0 && t.userId) {
          const userDocRef = doc(db, 'users', t.userId);
          const uSnap = await getDoc(userDocRef);
          if (uSnap.exists()) {
            const uData = uSnap.data();
            const isBonus = t.walletType === 'bonus';
            const newBal = isBonus ? (uData.balance || 0) : ((uData.balance || 0) + payout);
            const newBonus = isBonus ? ((uData.bonusBalance || 0) + payout) : (uData.bonusBalance || 0);
            const newWon = (uData.totalWon || 0) + payout;
            await setDoc(userDocRef, { balance: newBal, bonusBalance: newBonus, totalWon: newWon }, { merge: true });

            // Log Transaction
            const txId = `TXN-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await setDoc(doc(db, 'transactions', txId), {
              id: txId,
              userId: t.userId,
              type: 'win',
              amount: payout,
              walletType: isBonus ? 'bonus' : 'main',
              description: `3 Super Car Draw Win: Slot #${slotNum} (${winningCar.toUpperCase()} CAR) - Net Prize ₹${payout} Credited`,
              date: new Date().toLocaleString()
            }, { merge: true });
          }
        }
      }

      const updatedSlotWinners = { ...(config.manualSlotWinners || {}), [slotNum]: winningCar };
      await onUpdateConfig({ manualSlotWinners: updatedSlotWinners });

      setStatusMessage({
        type: 'success',
        text: `🏆 Slot #${String(slotNum).padStart(2, '0')} (${winningCar.toUpperCase()} CAR) published! Settled ${slotTickets.length} tickets with real-time wallet credits.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to publish result: ${err.message}` });
    }
  };

  // Manual Win/Loss Settlement Control for Individual Tickets
  const handleManualSettleTicket = async (ticket: PurchasedTicket, targetStatus: 'win' | 'loss' | 'active') => {
    setSettlingTicketId(ticket.id);
    try {
      const carChoice = (ticket.selectedCar || ticket.selectedNumbers?.[0] as string || 'red').toLowerCase() as SuperCarColor;
      const multiplier = config.carMultipliers?.[carChoice] || config.prizeMultiplier || 2.8;
      const payoutAmount = targetStatus === 'win' ? Math.round((ticket.price || 100) * multiplier) : 0;

      await setDoc(doc(db, 'tickets', ticket.id), {
        status: targetStatus,
        wonAmount: payoutAmount,
        updatedByAdminAt: new Date().toISOString()
      }, { merge: true });

      if (targetStatus === 'win' && payoutAmount > 0) {
        soundFx.playWinFanfare();
        const userRef = doc(db, 'users', ticket.userId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          const currentBal = uData.balance || 0;
          const currentWon = uData.totalWon || 0;
          await setDoc(userRef, {
            balance: currentBal + payoutAmount,
            totalWon: currentWon + payoutAmount
          }, { merge: true });

          const txId = `TXN-MANUAL-WIN-${Date.now()}`;
          await setDoc(doc(db, 'transactions', txId), {
            id: txId,
            userId: ticket.userId,
            type: 'win',
            amount: payoutAmount,
            description: `Admin Manual Win Payout: Ticket #${ticket.ticketNumber || ticket.id} (${carChoice.toUpperCase()} CAR)`,
            date: new Date().toLocaleString()
          }, { merge: true });
        }
        setStatusMessage({ type: 'success', text: `✓ Ticket #${ticket.ticketNumber || ticket.id} set to WIN! Credited ₹${payoutAmount.toLocaleString('en-IN')} to player balance.` });
      } else if (targetStatus === 'loss') {
        soundFx.playClick();
        const txId = `TXN-MANUAL-LOSS-${Date.now()}`;
        await setDoc(doc(db, 'transactions', txId), {
          id: txId,
          userId: ticket.userId,
          type: 'ticket_loss',
          amount: 0,
          description: `❌ Admin Marked Loss: Ticket #${ticket.ticketNumber || ticket.id} (${carChoice.toUpperCase()} CAR)`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        }, { merge: true });
        setStatusMessage({ type: 'success', text: `⊘ Ticket #${ticket.ticketNumber || ticket.id} set to LOSS & recorded in transactions ledger.` });
      } else {
        soundFx.playClick();
        setStatusMessage({ type: 'success', text: `↺ Ticket #${ticket.ticketNumber || ticket.id} reset to ACTIVE.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update ticket: ${err.message}` });
    } finally {
      setSettlingTicketId(null);
    }
  };

  // Manual Win/Loss Settlement Control for Batch of Tickets
  const handleManualSettleBatch = async (batch: GroupedTicketBatch, targetStatus: 'win' | 'loss' | 'active') => {
    setSettlingTicketId(batch.groupKey);
    try {
      const carChoice = (batch.selectedCar || 'red').toLowerCase() as SuperCarColor;
      const multiplier = config.carMultipliers?.[carChoice] || config.prizeMultiplier || 2.8;

      let totalPayoutForBatch = 0;

      for (const t of batch.tickets) {
        const payout = targetStatus === 'win' ? Math.round((t.price || 100) * multiplier) : 0;
        totalPayoutForBatch += payout;

        await setDoc(doc(db, 'tickets', t.id), {
          status: targetStatus,
          wonAmount: payout,
          updatedByAdminAt: new Date().toISOString()
        }, { merge: true });
      }

      if (targetStatus === 'win' && totalPayoutForBatch > 0) {
        soundFx.playWinFanfare();
        const userRef = doc(db, 'users', batch.userId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          const currentBal = uData.balance || 0;
          const currentWon = uData.totalWon || 0;
          await setDoc(userRef, {
            balance: currentBal + totalPayoutForBatch,
            totalWon: currentWon + totalPayoutForBatch
          }, { merge: true });

          const txId = `TXN-MANUAL-WIN-${Date.now()}`;
          await setDoc(doc(db, 'transactions', txId), {
            id: txId,
            userId: batch.userId,
            type: 'win',
            amount: totalPayoutForBatch,
            description: `Admin Manual Win Payout: ${batch.quantity}x Tickets (${carChoice.toUpperCase()} CAR)`,
            date: new Date().toLocaleString()
          }, { merge: true });
        }
        setStatusMessage({ type: 'success', text: `✓ Batch of ${batch.quantity} tickets set to WIN! Credited ₹${totalPayoutForBatch.toLocaleString('en-IN')} to player balance.` });
      } else if (targetStatus === 'loss') {
        soundFx.playClick();
        const txId = `TXN-MANUAL-LOSS-${Date.now()}`;
        await setDoc(doc(db, 'transactions', txId), {
          id: txId,
          userId: batch.userId,
          type: 'ticket_loss',
          amount: 0,
          description: `❌ Admin Marked Loss: ${batch.quantity}x Tickets (${carChoice.toUpperCase()} CAR)`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        }, { merge: true });
        setStatusMessage({ type: 'success', text: `⊘ Batch of ${batch.quantity} tickets set to LOSS.` });
      } else {
        soundFx.playClick();
        setStatusMessage({ type: 'success', text: `↺ Batch of ${batch.quantity} tickets reset to ACTIVE.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update ticket batch: ${err.message}` });
    } finally {
      setSettlingTicketId(null);
    }
  };

  // Helper to check if a ticket belongs to a specific calendar date
  const isTicketOnDate = (t: PurchasedTicket & Record<string, any>, targetDateStr: string) => {
    if (!t || !targetDateStr) return false;

    const [y, m, d] = targetDateStr.split('-').map(Number);
    if (!y || !m || !d) return false;

    const targetDash = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const targetCompact = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    const targetSlash1 = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const targetSlash2 = `${d}/${m}/${y}`;

    // 1. Direct equality on string fields
    if (t.purchaseDate === targetDash || t.drawDate === targetDash) return true;
    if (t.purchaseDate === targetSlash1 || t.drawDate === targetSlash1) return true;

    // 2. Check createdAt ISO timestamp or Date object
    const rawTimestamp = t.createdAt || t.purchaseDate || t.drawDate;
    if (rawTimestamp) {
      if (typeof rawTimestamp === 'string' && rawTimestamp.startsWith(targetDash)) return true;
      const parsedDate = new Date(rawTimestamp);
      if (!isNaN(parsedDate.getTime())) {
        const pY = parsedDate.getFullYear();
        const pM = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const pD = String(parsedDate.getDate()).padStart(2, '0');
        if (`${pY}-${pM}-${pD}` === targetDash) return true;
      }
    }

    // 3. Check drawId / ticketNumber / id for compact date string
    const idStr = String(t.drawId || t.ticketNumber || t.id || '');
    if (idStr.includes(targetCompact) || idStr.includes(targetDash)) return true;

    // 4. Check drawTime / purchaseDate text
    const timeStr = String(t.drawTime || t.purchaseDate || t.drawDate || '');
    if (timeStr.includes(targetDash) || timeStr.includes(targetSlash1) || timeStr.includes(targetSlash2) || timeStr.includes(targetCompact)) {
      return true;
    }

    return false;
  };

  // Filtered tickets for Monitor by Date & Slot
  const monitorDateFilteredTickets = supercarTickets.filter((t) => isTicketOnDate(t, monitorSelectedDateStr));

  const monitorFilteredTickets = monitorDateFilteredTickets.filter((t) => {
    if (selectedMonitorSlot === 'all') return true;
    const timeLabel = getSlotTimeLabel(selectedMonitorSlot as number);
    return t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(selectedMonitorSlot).padStart(2, '0')}`);
  });

  const monitorRedTickets = monitorFilteredTickets.filter((t) => (t.selectedCar || t.selectedNumbers?.[0]) === 'red');
  const monitorBlackTickets = monitorFilteredTickets.filter((t) => (t.selectedCar || t.selectedNumbers?.[0]) === 'black');
  const monitorYellowTickets = monitorFilteredTickets.filter((t) => (t.selectedCar || t.selectedNumbers?.[0]) === 'yellow');

  const monitorRedVol = monitorRedTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const monitorBlackVol = monitorBlackTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const monitorYellowVol = monitorYellowTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const monitorTotalRev = monitorRedVol + monitorBlackVol + monitorYellowVol;
  const monitorTotalCount = monitorFilteredTickets.length;

  // Determine Leader
  let leaderColor = 'RED CAR';
  let leadingShare = '0%';
  if (monitorTotalCount > 0) {
    if (monitorRedTickets.length >= monitorBlackTickets.length && monitorRedTickets.length >= monitorYellowTickets.length) {
      leaderColor = 'RED CAR';
      leadingShare = `${Math.round((monitorRedTickets.length / monitorTotalCount) * 100)}%`;
    } else if (monitorBlackTickets.length >= monitorRedTickets.length && monitorBlackTickets.length >= monitorYellowTickets.length) {
      leaderColor = 'BLACK CAR';
      leadingShare = `${Math.round((monitorBlackTickets.length / monitorTotalCount) * 100)}%`;
    } else {
      leaderColor = 'YELLOW CAR';
      leadingShare = `${Math.round((monitorYellowTickets.length / monitorTotalCount) * 100)}%`;
    }
  }

  // =========================================================================
  // LIVE BETTING & HOUSE EDGE RESULT PREDICTION ENGINE (0% to 99.5%)
  // =========================================================================
  const activeLiveSlotNum = selectedLiveSlot === 'current' ? currentSched.drawIndex : selectedLiveSlot;
  const activeLiveIssueId = selectedLiveSlot === 'current'
    ? currentSched.issueId
    : `CAR-${getAdminDateStr()}-${String(activeLiveSlotNum).padStart(2, '0')}`;

  // Calculate live betting statistics and optimal winning car
  const liveBettingStats: SuperCarLiveBettingStats = calculateSuperCarLiveBettingStats(
    activeLiveSlotNum,
    activeLiveIssueId,
    supercarTickets,
    config,
    livePools[activeLiveIssueId]
  );

  // Tickets for active live slot
  const activeLiveSlotTickets = supercarTickets.filter((t) => {
    if (!t) return false;
    if (t.drawId === activeLiveIssueId) return true;
    if (t.slotNum === activeLiveSlotNum) return true;
    const timeLabel = getSlotTimeLabel(activeLiveSlotNum);
    if (t.drawTime?.toString().includes(timeLabel)) return true;
    if (t.drawTitle?.includes(activeLiveIssueId) || t.drawTitle?.includes(`Slot #${String(activeLiveSlotNum).padStart(2, '0')}`)) return true;
    return false;
  });

  // Filtered players in active live slot
  const filteredLivePlayers = activeLiveSlotTickets.filter((t) => {
    if (liveCarFilter !== 'all') {
      const carChoice = (t.selectedCar || t.selectedNumbers?.[0] as string || 'red').toLowerCase();
      if (carChoice !== liveCarFilter) return false;
    }
    if (livePlayerSearchTerm.trim()) {
      const term = livePlayerSearchTerm.toLowerCase().trim();
      const uObj = usersMap[t.userId];
      const uCode = (getUserDisplayCode(uObj) || generatePermanentUserCode(uObj?.email, undefined, t.userId)).toLowerCase();
      const name = ((t as any).userName || uObj?.name || '').toLowerCase();
      const phone = (t as any).userPhone || uObj?.phone || '';
      const tNum = (t.ticketNumber || t.id).toLowerCase();
      return name.includes(term) || phone.includes(term) || tNum.includes(term) || uCode.includes(term) || t.userId.toLowerCase().includes(term);
    }
    return true;
  });

  // Recharts Data Format
  const rechartsData = [
    { name: 'RED CAR', tickets: monitorRedTickets.length, revenue: monitorRedVol, price: config.carPrices?.red || config.ticketPrice || 100, fill: '#f43f5e' },
    { name: 'BLACK CAR', tickets: monitorBlackTickets.length, revenue: monitorBlackVol, price: config.carPrices?.black || config.ticketPrice || 100, fill: '#f59e0b' },
    { name: 'YELLOW CAR', tickets: monitorYellowTickets.length, revenue: monitorYellowVol, price: config.carPrices?.yellow || config.ticketPrice || 100, fill: '#eab308' }
  ];

  // Audit Tab Filtered Tickets
  const auditFilteredTickets = supercarTickets
    .filter((t) => {
      // 1. Date Filter (Default: todayStr)
      if (auditSelectedDateStr && auditSelectedDateStr !== 'all') {
        if (!isTicketOnDate(t, auditSelectedDateStr)) return false;
      }

      // 2. Slot Filter
      if (ticketSlotFilter !== 'all') {
        const timeLabel = getSlotTimeLabel(ticketSlotFilter as number);
        const matchesSlot = t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(ticketSlotFilter).padStart(2, '0')}`);
        if (!matchesSlot) return false;
      }

      // 3. Status Filter
      if (ticketStatusFilter !== 'all') {
        if (ticketStatusFilter === 'active' && t.status !== 'active' && t.status !== 'pending') return false;
        if (ticketStatusFilter === 'win' && t.status !== 'win') return false;
        if (ticketStatusFilter === 'loss' && t.status !== 'loss') return false;
      }

      // 4. Car Filter
      if (ticketCarFilter !== 'all') {
        const carChoice = (t.selectedCar || t.selectedNumbers?.[0] as string || '').toLowerCase();
        if (carChoice !== ticketCarFilter) return false;
      }

      // 5. Search Bar (User Name, Phone, Ticket #, 5-Digit User ID, UID)
      if (ticketSearchTerm.trim()) {
        const term = ticketSearchTerm.toLowerCase().trim();
        const cleanNumericTerm = term.replace(/^[#\s]+/, '').trim();
        const uObj = usersMap[t.userId];
        const uCode = (getUserDisplayCode(uObj) || generatePermanentUserCode(uObj?.email, undefined, t.userId)).toLowerCase();
        const name = (t as any).userName?.toLowerCase() || uObj?.name?.toLowerCase() || '';
        const phone = (t as any).userPhone || uObj?.phone || '';
        const tNum = (t.ticketNumber || t.id).toLowerCase();
        const uId = t.userId.toLowerCase();
        return (
          name.includes(term) ||
          phone.includes(term) ||
          tNum.includes(term) ||
          uId.includes(term) ||
          (cleanNumericTerm && uId.includes(cleanNumericTerm)) ||
          uCode === cleanNumericTerm ||
          uCode.includes(cleanNumericTerm) ||
          (cleanNumericTerm && `#${uCode}`.includes(term))
        );
      }

      return true;
    })
    .sort((a, b) => {
      // RECENT TICKETS ALWAYS AT THE TOP (Descending by creation timestamp / ID)
      const getTime = (ticket: PurchasedTicket & Record<string, any>) => {
        if (ticket.createdAt) {
          const parsed = new Date(ticket.createdAt).getTime();
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (ticket.purchaseDate) {
          const parsed = new Date(ticket.purchaseDate).getTime();
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        const numMatch = ticket.id?.match(/\d+/g);
        if (numMatch && numMatch.length > 0) return parseInt(numMatch.join(''), 10);
        return 0;
      };
      return getTime(b) - getTime(a);
    });

  const totalAutoWonAmt = supercarTickets.filter((t) => t.status === 'win').reduce((sum, t) => sum + (t.wonAmount || 0), 0);
  const totalAutoWonCount = supercarTickets.filter((t) => t.status === 'win').length;
  const totalAutoLostCount = supercarTickets.filter((t) => t.status === 'loss').length;
  const totalPendingCount = supercarTickets.filter((t) => t.status === 'active' || t.status === 'pending').length;

  const carsList: SuperCarColor[] = ['red', 'black', 'yellow'];

  return (
    <div className="space-y-6 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-amber-950/60 to-slate-950 rounded-3xl border border-amber-500/30 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">3 Super Car Admin Control Hub</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                REALTIME FIREBASE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Sales Recharts Monitor • 84 Daily Slot Winner Reveals • User Ticket Payout Audit • HD Image Uploads
            </p>
          </div>
        </div>

        {/* Global Game Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFx.playClick();
              onUpdateConfig({ enabled: !config.enabled });
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg ${
              config.enabled
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:bg-emerald-400'
                : 'bg-rose-950 border border-rose-500/50 text-rose-300 hover:bg-rose-900'
            }`}
          >
            {config.enabled ? '🟢 GAME ACTIVE (PLAYERS CAN BET)' : '🔴 GAME DISABLED (LOCKED)'}
          </button>
        </div>
      </div>

      {/* Top Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'live_engine', label: '⚡ 24/7 Live Betting & House Edge', icon: Activity },
          { id: 'monitor', label: '📊 Sales Recharts Monitor', icon: TrendingUp },
          { id: 'draws', label: `🏆 Daily Draw Results (${totalSlotsCount} Slots)`, icon: Lock },
          { id: 'tickets', label: '👤 User Ticket Audit & Settlement', icon: Users },
          { id: 'images', label: '⚙️ HD Car Images & Pricing Config', icon: ImageIcon }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { soundFx.playClick(); setActiveSubTab(tab.id as any); }}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in duration-200 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
          <span className="font-bold">{statusMessage.text}</span>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 0: ⚡ 24/7 LIVE BETTING MONITOR & HOUSE EDGE (0% - 99.5%)
         ========================================================= */}
      {activeSubTab === 'live_engine' && (
        <div className="space-y-6 animate-in fade-in duration-200">

          {/* 1. HOUSE EDGE & BETTING POLICY CONTROL ROOM */}
          <div className="p-5 bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-950 rounded-3xl border border-purple-500/30 shadow-2xl space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">House Edge Control & Betting Policies</h3>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                      0.0% — 99.5%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure automated profit margin and restrict user payments strictly to Bonus Wallet
                  </p>
                </div>
              </div>

              {/* Bonus Only Toggle Button */}
              <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">সুপার কার শুধুমাত্র বোনাস ব্যালেন্স:</span>
                  <button
                    type="button"
                    onClick={handleToggleBonusOnly}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                      config.bonusOnly !== false
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/40'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    <Gift className="w-4 h-4" />
                    <span>{config.bonusOnly !== false ? '🔒 BONUS ONLY (ACTIVE)' : '🔓 ALL WALLETS'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Slider & Presets */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left: Input & Slider */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-purple-400" /> Target House Edge (কোম্পানির লাভের মার্জিন):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={99.5}
                      step={0.5}
                      value={houseEdgeInput}
                      onChange={(e) => setHouseEdgeInput(Math.min(99.5, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-24 px-2.5 py-1.5 bg-slate-950 border border-purple-500/50 rounded-xl text-purple-300 font-black text-right text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-sm font-black text-purple-400">%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={99.5}
                    step={0.5}
                    value={houseEdgeInput}
                    onChange={(e) => setHouseEdgeInput(parseFloat(e.target.value))}
                    className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>0% (Fair Odds)</span>
                    <span>15% (Recommended)</span>
                    <span>50%</span>
                    <span>99.5% (Max House)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Presets:</span>
                  {[0, 5, 10, 15, 20, 30, 50, 80, 99.5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setHouseEdgeInput(val);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        houseEdgeInput === val
                          ? 'bg-purple-500 text-white font-black shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Save & Explanatory Card */}
              <div className="lg:col-span-5 bg-slate-950/80 p-4 rounded-2xl border border-purple-500/20 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    <strong className="text-white block font-mono text-xs mb-0.5">স্বয়ংক্রিয় রেজাল্ট অ্যালগরিদম:</strong>
                    সিস্টেম লাইভ বেটিং পরিমাণের ওপর ভিত্তি করে রেড ও ব্ল্যাক এর মধ্যে সর্বনিম্ন লায়াবিলিটি কার বেছে নেয়। 
                    <span className="text-amber-300 font-bold block mt-1">
                      ⚠️ হলুদ কার্ড কখনোই স্বয়ংক্রিয়ভাবে রেজাল্ট হবে না যদি না আপনি ম্যানুয়ালি সেট করেন।
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSavingHouseEdge || houseEdgeInput === config.houseEdgePercent}
                    onClick={() => handleSaveHouseEdge()}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                      houseEdgeInput !== config.houseEdgePercent
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 text-white shadow-purple-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isSavingHouseEdge ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>
                      {houseEdgeInput === config.houseEdgePercent
                        ? `HOUSE EDGE IS SAVED (${config.houseEdgePercent}%)`
                        : `SAVE HOUSE EDGE TO ${houseEdgeInput}%`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 24/7 LIVE CURRENT ROUND & 30-SEC CUTOFF STATUS BAR */}
          {(() => {
            const liveRemainingSec = Math.ceil((currentSched.timeRemainingMs || 0) / 1000);
            const liveRemainingMins = Math.floor(liveRemainingSec / 60);
            const liveRemainingSecsMod = liveRemainingSec % 60;
            const isBettingLocked = currentSched.isBettingClosed || liveRemainingSec <= 30;

            return (
              <div className={`p-5 rounded-3xl border shadow-xl transition-all ${
                isBettingLocked
                  ? 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-950 border-rose-500/50 ring-1 ring-rose-500/30'
                  : 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/50'
              }`}>
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl border ${
                      isBettingLocked
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}>
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">
                          24/7 Live Round: Slot #{String(activeLiveSlotNum).padStart(2, '0')} of {totalSlotsCount}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                          isBettingLocked
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isBettingLocked ? '⛔ BETTING CLOSED (T-30s CUTOFF)' : '🟢 BETTING OPEN'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                        <span>Draw Time: <strong className="text-amber-400">{getSlotTimeLabel(activeLiveSlotNum)}</strong></span>
                        <span>•</span>
                        <span>Issue ID: <strong className="text-purple-300">{activeLiveIssueId}</strong></span>
                        <span>•</span>
                        <span className="text-[11px] text-slate-400 font-sans">
                          {isBettingLocked
                            ? '⚠️ ড্র সম্পন্ন হতে ৩০ সেকেন্ড বাকি থাকায় বেটিং বন্ধ এবং ফলাফল চূড়ান্ত হচ্ছে'
                            : `১০ মিনিট চক্র • ড্র এর ৩০ সেকেন্ড পূর্বে বেটিং বন্ধ হবে`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Slot Selector & Countdown */}
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-400">Target Slot:</label>
                      <select
                        value={selectedLiveSlot}
                        onChange={(e) => setSelectedLiveSlot(e.target.value === 'current' ? 'current' : Number(e.target.value))}
                        className="bg-slate-950 border border-slate-700 text-amber-300 font-black text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
                      >
                        <option value="current">🟢 Current Live Slot (#{currentSched.drawIndex} - {getSlotTimeLabel(currentSched.drawIndex)})</option>
                        {Array.from({ length: totalSlotsCount }, (_, i) => {
                          const sNum = i + 1;
                          return (
                            <option key={sNum} value={sNum}>
                              Slot #{String(sNum).padStart(2, '0')} ({getSlotTimeLabel(sNum)})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Countdown Badge */}
                    <div className={`px-4 py-2 rounded-2xl border text-center ${
                      isBettingLocked
                        ? 'bg-rose-950 border-rose-500/60 text-rose-300'
                        : 'bg-slate-950 border-emerald-500/50 text-emerald-300'
                    }`}>
                      <span className="text-[9px] block uppercase font-bold text-slate-400">
                        {isBettingLocked ? 'NEXT DRAW IN' : 'BETTING CLOSES IN'}
                      </span>
                      <span className="text-lg font-black tracking-wider">
                        {isBettingLocked
                          ? `${liveRemainingSec}s`
                          : `${String(liveRemainingMins).padStart(2, '0')}:${String(Math.max(0, liveRemainingSecsMod - 30)).padStart(2, '0')}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. LIVE BETTING METRICS (TOTAL VOLUME, PLAYERS, WALLET USAGE) */}
          {(() => {
            const bonusPct = liveBettingStats.totalPool > 0
              ? Math.round((liveBettingStats.bonusBalanceVolume / liveBettingStats.totalPool) * 100)
              : 0;
            const realPct = liveBettingStats.totalPool > 0
              ? Math.round((liveBettingStats.realBalanceVolume / liveBettingStats.totalPool) * 100)
              : 0;
            const redPct = liveBettingStats.totalPool > 0
              ? Math.round((liveBettingStats.red.totalBets / liveBettingStats.totalPool) * 100)
              : 0;
            const blackPct = liveBettingStats.totalPool > 0
              ? Math.round((liveBettingStats.black.totalBets / liveBettingStats.totalPool) * 100)
              : 0;
            const yellowPct = liveBettingStats.totalPool > 0
              ? Math.round((liveBettingStats.yellow.totalBets / liveBettingStats.totalPool) * 100)
              : 0;
            const winningOutcome = liveBettingStats[liveBettingStats.calculatedWinner];

            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Bets */}
                  <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black flex items-center justify-between">
                      <span>TOTAL BET VOLUME</span>
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    <div className="text-xl font-black text-white">
                      ₹{liveBettingStats.totalPool.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      {liveBettingStats.totalTickets} Ticket(s) issued in Slot #{activeLiveSlotNum}
                    </span>
                  </div>

                  {/* Total Players */}
                  <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black flex items-center justify-between">
                      <span>ACTIVE PLAYERS</span>
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                    </span>
                    <div className="text-xl font-black text-blue-300">
                      {liveBettingStats.totalPlayers} User(s)
                    </div>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      {filteredLivePlayers.length} Active ticket line items
                    </span>
                  </div>

                  {/* Bonus Wallet Usage */}
                  <div className="p-4 bg-slate-900 rounded-3xl border border-purple-500/30 space-y-1">
                    <span className="text-[10px] text-purple-400 uppercase font-black flex items-center justify-between">
                      <span>BONUS WALLET USAGE</span>
                      <Gift className="w-3.5 h-3.5 text-purple-400" />
                    </span>
                    <div className="text-xl font-black text-purple-300">
                      ₹{liveBettingStats.bonusBalanceVolume.toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-purple-400/90 font-sans">
                      <span>Share: {bonusPct}% of round</span>
                      <span className="font-bold text-purple-300">ELIGIBLE</span>
                    </div>
                  </div>

                  {/* Main Real Cash Usage */}
                  <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black flex items-center justify-between">
                      <span>MAIN CASH USAGE</span>
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    <div className="text-xl font-black text-slate-300">
                      ₹{liveBettingStats.realBalanceVolume.toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                      <span>Share: {realPct}%</span>
                      <span className={config.bonusOnly !== false ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                        {config.bonusOnly !== false ? 'LOCKED (Bonus Only)' : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. CAR-BY-CAR BETTING BREAKDOWN & LIABILITIES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* RED CAR */}
                  <div className="p-4 rounded-3xl border border-rose-500/40 bg-gradient-to-b from-rose-950/40 to-slate-900 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                        🏎️ RED CAR (2.0x)
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        AUTO ELIGIBLE
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Total Bet:</span>
                        <span className="font-black text-white">₹{liveBettingStats.red.totalBets.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Tickets:</span>
                        <span className="font-bold text-rose-300">{liveBettingStats.red.ticketCount} ({redPct}%)</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1.5 border-t border-slate-800">
                        <span className="text-slate-400">Payout Liability (2.0x):</span>
                        <span className="font-black text-rose-400">₹{liveBettingStats.red.potentialPayout.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Net House Profit if Red Wins:</span>
                        <span className={`font-black ${liveBettingStats.red.houseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{liveBettingStats.red.houseProfit.toLocaleString('en-IN')} ({liveBettingStats.red.houseProfitMarginPercent}%)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleForceSlotWinner(activeLiveSlotNum, activeLiveIssueId, 'red')}
                      className="w-full py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-md shadow-rose-950"
                    >
                      FORCE RED WINNER
                    </button>
                  </div>

                  {/* BLACK CAR */}
                  <div className="p-4 rounded-3xl border border-amber-500/40 bg-gradient-to-b from-amber-950/40 to-slate-900 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                        🏎️ BLACK CAR (2.8x)
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        AUTO ELIGIBLE
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Total Bet:</span>
                        <span className="font-black text-white">₹{liveBettingStats.black.totalBets.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Tickets:</span>
                        <span className="font-bold text-amber-300">{liveBettingStats.black.ticketCount} ({blackPct}%)</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1.5 border-t border-slate-800">
                        <span className="text-slate-400">Payout Liability (2.8x):</span>
                        <span className="font-black text-amber-400">₹{liveBettingStats.black.potentialPayout.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Net House Profit if Black Wins:</span>
                        <span className={`font-black ${liveBettingStats.black.houseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{liveBettingStats.black.houseProfit.toLocaleString('en-IN')} ({liveBettingStats.black.houseProfitMarginPercent}%)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleForceSlotWinner(activeLiveSlotNum, activeLiveIssueId, 'black')}
                      className="w-full py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-950"
                    >
                      FORCE BLACK WINNER
                    </button>
                  </div>

                  {/* YELLOW CAR */}
                  <div className="p-4 rounded-3xl border border-yellow-500/40 bg-gradient-to-b from-yellow-950/40 to-slate-900 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-yellow-400 flex items-center gap-1.5">
                        🏎️ YELLOW CAR (3.5x)
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🛡️ AUTO PROTECTED
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Total Bet:</span>
                        <span className="font-black text-white">₹{liveBettingStats.yellow.totalBets.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Tickets:</span>
                        <span className="font-bold text-yellow-300">{liveBettingStats.yellow.ticketCount} ({yellowPct}%)</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1.5 border-t border-slate-800">
                        <span className="text-slate-400">Payout Liability (3.5x):</span>
                        <span className="font-black text-yellow-400">₹{liveBettingStats.yellow.potentialPayout.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-sans pt-1">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>ইউজার ফাঁকা রাখলে বা কম বাজি ধরলে হাউস প্রফিট রক্ষার্থে এটিও অটো বিজয়ী হতে পারে।</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleForceSlotWinner(activeLiveSlotNum, activeLiveIssueId, 'yellow')}
                      className="w-full py-2 rounded-xl text-xs font-black bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-yellow-950"
                    >
                      MANUAL FORCE YELLOW WINNER
                    </button>
                  </div>
                </div>

                {/* 5. HOUSE EDGE RESULT PREDICTION CARD */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-purple-500/30 shadow-2xl space-y-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">
                          🎯 আসন্ন ফলাফল প্রেডিকশন (House Edge: {liveBettingStats.houseEdgeTargetPercent}%)
                        </h4>
                        <p className="text-xs text-slate-400 font-sans">
                          হাউস এজ নীতি অনুযায়ী অটোমেটিক ক্যালকুলেটেড বিজয়ী গাড়ি
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Manual Override:</span>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                        liveBettingStats.isManualOverride
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}>
                        {liveBettingStats.isManualOverride
                          ? `MANUAL: ${liveBettingStats.manualWinnerColor?.toUpperCase()} CAR`
                          : 'AUTO ALGORITHM'}
                      </span>
                      {liveBettingStats.isManualOverride && (
                        <button
                          type="button"
                          onClick={async () => {
                            soundFx.playClick();
                            const updatedManual = { ...(config.manualSlotWinners || {}) };
                            delete updatedManual[activeLiveSlotNum];
                            delete updatedManual[activeLiveIssueId];
                            await onUpdateConfig({ manualSlotWinners: updatedManual });
                            setStatusMessage({ type: 'success', text: `Slot #${activeLiveSlotNum} reset to Auto House Edge Algorithm.` });
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400"
                          title="Reset to Auto"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Predicted Car Visual */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/40 flex items-center gap-3">
                      <div className={`p-3 rounded-2xl text-2xl ${
                        liveBettingStats.calculatedWinner === 'red'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : liveBettingStats.calculatedWinner === 'black'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                      }`}>
                        🏎️
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-black block">PREDICTED AUTO WINNER</span>
                        <span className={`text-lg font-black block ${
                          liveBettingStats.calculatedWinner === 'red'
                            ? 'text-rose-400'
                            : liveBettingStats.calculatedWinner === 'black'
                            ? 'text-amber-400'
                            : 'text-yellow-400'
                        }`}>
                          {liveBettingStats.calculatedWinner.toUpperCase()} CAR
                        </span>
                        <span className="text-[10px] text-slate-500 block font-sans">
                          {liveBettingStats.isManualOverride
                            ? 'Admin Manual Override'
                            : 'ফাঁকা/কম বাজি ও জিরো-লস হাউস প্রটেকশন'}
                        </span>
                      </div>
                    </div>

                    {/* Financial Outcome */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">EXPECTED HOUSE PROFIT</span>
                      <div className="text-lg font-black text-emerald-400">
                        +₹{winningOutcome.houseProfit.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[11px] text-emerald-500 font-bold block">
                        {winningOutcome.houseProfitMarginPercent.toFixed(1)}% House Margin
                      </span>
                    </div>

                    {/* Payout Liability */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">EXPECTED PLAYER PAYOUT</span>
                      <div className="text-lg font-black text-slate-200">
                        ₹{winningOutcome.potentialPayout.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-500 block font-sans">
                        From total bet pool of ₹{liveBettingStats.totalPool.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-950/20 rounded-xl border border-purple-500/20 text-xs text-purple-300 font-sans flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                    <span>
                      <strong>ক্যালকুলেশন সারাংশ:</strong> {liveBettingStats.calculationReason} (ড্র সময় শেষ হলে ইউজার স্ক্রিনে এই ফলাফলটি লাইভ অ্যানিমেশন সহ প্রদর্শিত হবে)।
                    </span>
                  </div>
                </div>
              </>
            );
          })()}

          {/* 6. LIVE PLAYERS & BETS IN ACTIVE SLOT */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Slot #{activeLiveSlotNum} Live Player Bets ({filteredLivePlayers.length} Items)
                </h4>
                <p className="text-xs text-slate-400 font-sans">
                  কোন ইউজার কত টাকা কোন গাড়িতে ধরেছে এবং কোন ওয়ালেট ব্যবহার করেছে
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search Player / ID..."
                    value={livePlayerSearchTerm}
                    onChange={(e) => setLivePlayerSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['all', 'red', 'black', 'yellow'] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setLiveCarFilter(color)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                        liveCarFilter === color
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Players Table */}
            {filteredLivePlayers.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
                Slot #{activeLiveSlotNum} এ এখনও কোনো ইউজার বাজি ধরেনি।
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-black text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Player / User ID</th>
                      <th className="p-3">Selected Car</th>
                      <th className="p-3">Quantity & Amount</th>
                      <th className="p-3">Wallet Source</th>
                      <th className="p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {filteredLivePlayers.map((t) => {
                      const uObj = usersMap[t.userId];
                      const uCode = getUserDisplayCode(uObj) || generatePermanentUserCode(uObj?.email, undefined, t.userId);
                      const userName = (t as any).userName || uObj?.name || 'Player';
                      const carChoice = (t.selectedCar || t.selectedNumbers?.[0] as string || 'red').toLowerCase() as SuperCarColor;
                      const isBonus = t.walletType === 'bonus';

                      return (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-white">{userName}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                              <span className="font-mono text-purple-400">#{uCode}</span>
                              <span>•</span>
                              <span>{t.ticketNumber || t.id.slice(-6)}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1 ${
                              carChoice === 'red'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : carChoice === 'black'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            }`}>
                              🏎️ {carChoice} Car
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-black text-white">₹{t.price}</div>
                            <div className="text-[10px] text-slate-400">1x Ticket</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border ${
                              isBonus
                                ? 'bg-purple-950/80 text-purple-300 border-purple-500/30'
                                : 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                            }`}>
                              {isBonus ? <Gift className="w-3 h-3 text-purple-400" /> : <Wallet className="w-3 h-3 text-amber-400" />}
                              <span>{isBonus ? 'Bonus Wallet' : 'Main Cash'}</span>
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-slate-400">
                            {t.purchaseTime || formatTicketExactTime(t)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 1: 3 SUPER CAR LIVE SALES MONITOR (RECHARTS)
         ========================================================= */}
      {activeSubTab === 'monitor' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* CALENDAR DATE & SLOT FILTER CONTROL BAR */}
          <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-3xl space-y-3 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white block">Filter Ticket Sales by Date</span>
                    <span className="bg-rose-500/20 text-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-500/30 uppercase">
                      🔥 LEADER: {leaderColor}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400 font-bold">
                    Selected Date: {monitorSelectedDateStr} ({monitorDateFilteredTickets.length} Sales on this date)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setMonitorSelectedDateStr(todayStr);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    monitorSelectedDateStr === todayStr
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Today Only
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                    setMonitorSelectedDateStr(yStr);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    monitorSelectedDateStr !== todayStr && monitorSelectedDateStr === `${new Date(Date.now() - 86400000).getFullYear()}-${String(new Date(Date.now() - 86400000).getMonth() + 1).padStart(2, '0')}-${String(new Date(Date.now() - 86400000).getDate()).padStart(2, '0')}`
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Yesterday
                </button>

                <input
                  type="date"
                  value={monitorSelectedDateStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      soundFx.playClick();
                      setMonitorSelectedDateStr(e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-amber-500/40 text-amber-300 font-black text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
                />

                <select
                  value={selectedMonitorSlot}
                  onChange={(e) => setSelectedMonitorSlot(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-amber-300 font-black text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All {totalSlotsCount} Daily Slots (10-Min 24/7)</option>
                  {Array.from({ length: totalSlotsCount }, (_, i) => {
                    const sNum = i + 1;
                    return (
                      <option key={sNum} value={sNum}>
                        Slot #{String(sNum).padStart(2, '0')} ({getSlotTimeLabel(sNum)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* 4 Metric KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-black block">SLOT WINDOW</span>
              <span className="text-lg font-black text-white block mt-1">
                {selectedMonitorSlot === 'all' ? '24 Hours (Continuous)' : getSlotTimeLabel(selectedMonitorSlot as number)}
              </span>
              <span className="text-[10px] text-amber-400 block mt-0.5">
                {selectedMonitorSlot === 'all' ? `${totalSlotsCount} Daily Slots` : `Slot #${String(selectedMonitorSlot).padStart(2, '0')}`}
              </span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-black block">TOTAL TICKETS SOLD</span>
              <span className="text-xl font-black text-white block mt-1">{monitorTotalCount} Tickets</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Live Firestore Feed</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-emerald-900/40">
              <span className="text-[10px] text-emerald-400 uppercase font-black block">TOTAL REVENUE</span>
              <span className="text-xl font-black text-emerald-300 block mt-1">₹{monitorTotalRev.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Gross Sales Volume</span>
            </div>

            <div className="p-4 bg-gradient-to-br from-slate-900 to-amber-950/40 rounded-3xl border border-amber-500/40">
              <span className="text-[10px] text-amber-400 uppercase font-black block">LEADING SHARE</span>
              <span className="text-xl font-black text-amber-300 block mt-1">{leadingShare}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Held by {leaderColor}</span>
            </div>
          </div>

          {/* Recharts Bar Chart Container */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-400" />
                <span>REAL-TIME TICKET DISTRIBUTION BAR CHART (RECHARTS)</span>
              </h4>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded border border-amber-500/20 uppercase font-bold">
                {selectedMonitorSlot === 'all' ? 'ALL SLOTS ACTIVE' : `SLOT #${selectedMonitorSlot} ACTIVE`}
              </span>
            </div>

            {/* Recharts Component */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer key={`recharts-resp-${monitorFilteredTickets.length}-${monitorTotalRev}`} width="100%" height="100%">
                <BarChart data={rechartsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-amber-500/40 p-3 rounded-xl shadow-2xl font-mono text-xs">
                            <p className="font-black text-amber-400 uppercase">{data.name}</p>
                            <p className="text-white mt-1">Tickets Sold: <strong className="text-amber-300">{data.tickets}</strong> ({monitorTotalCount > 0 ? Math.round((data.tickets / monitorTotalCount) * 100) : 0}%)</p>
                            <p className="text-white">Revenue: <strong className="text-emerald-400">₹{data.revenue.toLocaleString('en-IN')}</strong></p>
                            <p className="text-slate-400 text-[10px]">Price per ticket: ₹{data.price}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="tickets" radius={[8, 8, 0, 0]}>
                    {rechartsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Color Breakdown Sub-Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-rose-500/30">
                <span className="text-xs font-black text-rose-400 uppercase">Red Supercar</span>
                <div className="text-lg font-black text-white mt-1">{monitorRedTickets.length} Tickets</div>
                <div className="text-xs text-emerald-400 font-bold">₹{monitorRedVol.toLocaleString('en-IN')}</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30">
                <span className="text-xs font-black text-amber-400 uppercase">Black Supercar</span>
                <div className="text-lg font-black text-white mt-1">{monitorBlackTickets.length} Tickets</div>
                <div className="text-xs text-emerald-400 font-bold">₹{monitorBlackVol.toLocaleString('en-IN')}</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-yellow-500/30">
                <span className="text-xs font-black text-yellow-400 uppercase">Yellow Supercar</span>
                <div className="text-lg font-black text-white mt-1">{monitorYellowTickets.length} Tickets</div>
                <div className="text-xs text-emerald-400 font-bold">₹{monitorYellowVol.toLocaleString('en-IN')}</div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================
          SUB-TAB 2: 🏆 3 SUPER CAR DAILY DRAW RESULTS (84 SLOTS)
         ========================================================= */}
      {activeSubTab === 'draws' && (
        <div className="space-y-5 animate-in fade-in duration-200 font-mono">
          
          {/* 1. DRAW EXECUTION MODE CARD (Matching Screenshot 1) */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-white">Draw Execution Mode:</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                    (config.resultMode || 'auto') === 'auto'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  }`}>
                    {(config.resultMode || 'auto') === 'auto' ? '⚡ AUTOMATIC TIMELY 10-MIN' : '✋ MANUAL DRAW'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mt-1">
                  Results automatically roll over and display on schedule every 10 minutes from 08:00 AM to 10:00 PM.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onUpdateConfig({ resultMode: 'auto' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    (config.resultMode || 'auto') === 'auto'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Automatic</span>
                </button>

                <button
                  onClick={() => {
                    soundFx.playClick();
                    onUpdateConfig({ resultMode: 'manual' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    config.resultMode === 'manual'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>✋ Manual</span>
                </button>
              </div>
            </div>
          </div>

          {/* 1.5 CALENDAR DATE SELECTOR CARD FOR ADMIN HISTORICAL LOOKUP & OVERRIDES */}
          <div className="p-3.5 bg-slate-900 border border-amber-500/30 rounded-3xl space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Find Results by Calendar Date</span>
                  <span className="text-[10px] text-amber-400 font-bold">
                    Selected Date: {adminSelectedDateStr}
                  </span>
                </div>
              </div>

              <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-500/20 font-bold hidden sm:inline-block">
                84 Slots (08:00 AM - 10:00 PM)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setAdminSelectedDateStr(todayStr);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  adminSelectedDateStr === todayStr
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setAdminSelectedDateStr(`${y}-${m}-${day}`);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
              >
                Yesterday
              </button>

              <div className="relative flex-1 min-w-[140px]">
                <input
                  type="date"
                  value={adminSelectedDateStr}
                  onChange={(e) => {
                    soundFx.playClick();
                    setAdminSelectedDateStr(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* 2. GAME CATEGORY SWITCHER TABS (Matching Screenshot 1) */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => {
                soundFx.playClick();
                setGameCategoryTab('daily');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                gameCategoryTab === 'daily'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔥 1. Daily Win (84 Slots)</span>
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                setGameCategoryTab('supercar');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                gameCategoryTab === 'supercar'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏎️ 2. 3 Super Car VIP</span>
            </button>
          </div>

          {/* 3. FILTER PILLS (Matching Screenshot 1) */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-center">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'completed', label: 'Completed' },
              { id: 'active', label: 'Active Draw' },
              { id: 'upcoming', label: 'Upcoming' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playClick();
                  setDrawsFilterStatus(tab.id as any);
                }}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  drawsFilterStatus === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 4. SEARCH BAR & VIEW SWITCHER */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search slot # or number..."
                value={drawsSearchTerm}
                onChange={(e) => setDrawsSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/50 font-mono placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <span className="text-[11px] text-slate-400 font-sans">View:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDrawsViewMode('table')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    drawsViewMode === 'table' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setDrawsViewMode('grid')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    drawsViewMode === 'grid' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. DRAW RESULTS TABLE / GRID VIEW (Matching User Panel 144 Slots) */}
          {(() => {
            const filteredAdminSlots = adminDailySlots.filter((slot) => {
              if (drawsFilterStatus === 'completed' && slot.status !== 'completed') return false;
              if (drawsFilterStatus === 'active' && slot.status !== 'active') return false;
              if (drawsFilterStatus === 'upcoming' && slot.status !== 'upcoming') return false;

              if (drawsSearchTerm.trim()) {
                const query = drawsSearchTerm.toLowerCase();
                const matchSlot = slot.slotLabel.toLowerCase().includes(query) || String(slot.slotNum).includes(query);
                const matchTime = slot.timeLabel.toLowerCase().includes(query);
                const matchCar = slot.winningCar ? slot.winningCar.toLowerCase().includes(query) : false;
                const matchTicket = slot.matchedDraw?.winnerTicket ? slot.matchedDraw.winnerTicket.toLowerCase().includes(query) : false;
                if (!matchSlot && !matchTime && !matchCar && !matchTicket) return false;
              }
              return true;
            });

            return drawsViewMode === 'table' ? (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl overflow-x-auto shadow-2xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="p-3">SLOT / DRAW #</th>
                      <th className="p-3">TIME / FREQUENCY</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3">WINNING SUPERCAR</th>
                      <th className="p-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAdminSlots.map((slot) => {
                      const isCompleted = slot.status === 'completed';
                      const carInfo = slot.winningCar ? getSuperCarInfo(slot.winningCar, config) : null;

                      return (
                        <tr key={slot.slotNum} className="hover:bg-slate-950/60 transition-colors">
                          {/* SLOT / DRAW # */}
                          <td className="p-3 font-black text-amber-400">
                            {slot.slotLabel}
                          </td>

                          {/* TIME / FREQUENCY */}
                          <td className="p-3 font-bold text-white">
                            {slot.timeLabel}
                          </td>

                          {/* STATUS */}
                          <td className="p-3">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                              isCompleted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : slot.status === 'active'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {isCompleted ? 'Completed' : slot.status === 'active' ? 'Active' : 'Upcoming'}
                            </span>
                          </td>

                          {/* WINNING SUPERCAR */}
                          <td className="p-3">
                            {slot.winningCar && carInfo ? (
                              <div className="flex items-center gap-2">
                                <img src={carInfo.image} alt={carInfo.name} className="w-10 h-7 object-cover rounded-lg border border-slate-700 shrink-0" />
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                  slot.winningCar === 'red'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : slot.winningCar === 'black'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                                }`}>
                                  {slot.winningCar === 'red' ? 'RED SUPERCAR LUXURY' : slot.winningCar === 'black' ? 'BLACK CARBON EDITION' : 'YELLOW LIGHTNING SUPERCAR'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Awaiting Draw</span>
                            )}
                          </td>

                          {/* ACTION -> EDIT RESULT BUTTON */}
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openEditResultModal(slot.slotNum)}
                              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md hover:scale-[1.02]"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit Result</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredAdminSlots.map((slot) => {
                  const isCompleted = slot.status === 'completed';
                  const carInfo = slot.winningCar ? getSuperCarInfo(slot.winningCar, config) : null;

                  return (
                    <div key={slot.slotNum} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl hover:border-amber-500/40 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-400">{slot.slotLabel}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isCompleted ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : slot.status === 'active' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {isCompleted ? 'COMPLETED' : slot.status === 'active' ? 'LIVE / OPEN' : 'UPCOMING'}
                          </span>
                        </div>

                        <div className="mt-2 space-y-0.5">
                          <span className="text-lg font-black text-white block">{slot.timeLabel}</span>
                        </div>

                        <div className="mt-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">WINNING RESULT</span>
                          {slot.winningCar && carInfo ? (
                            <div className="space-y-1">
                              <img src={carInfo.image} alt={carInfo.name} className="w-16 h-10 object-cover rounded-xl mx-auto border border-slate-700" />
                              <span className="text-xs font-black text-amber-300 block uppercase">{carInfo.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-500 block">PENDING DRAW</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => openEditResultModal(slot.slotNum)}
                        className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Result</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* EDIT RESULT MODAL */}
          {editingSlotModal !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono">
              <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                      <Edit className="w-5 h-5" />
                      <span>Edit Result • Slot #{String(editingSlotModal).padStart(2, '0')}</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Time Window: {getSlotTimeLabel(editingSlotModal)} (10-Min Draw)
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingSlotModal(null)}
                    className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* SELECT WINNING CAR */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Select Winning Super Car:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'red', label: 'RED LUXURY' },
                      { id: 'black', label: 'BLACK STEALTH' },
                      { id: 'yellow', label: 'YELLOW LIGHTNING' }
                    ].map((car) => {
                      const carInfo = getSuperCarInfo(car.id as SuperCarColor, config);
                      const isSelected = editWinningCar === car.id;
                      return (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => setEditWinningCar(car.id as SuperCarColor)}
                          className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]'
                              : 'bg-slate-950 border-slate-800 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={carInfo.image} alt={carInfo.name} className="w-12 h-9 object-cover rounded-xl" />
                          <span className="text-[9px] font-black uppercase text-white">{car.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* WINNER DETAILS */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Winner Ticket ID:</label>
                    <input
                      type="text"
                      value={editWinnerTicket}
                      onChange={(e) => setEditWinnerTicket(e.target.value)}
                      placeholder="e.g. TCK-100881"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono font-bold rounded-xl px-3 py-2 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Winner Display Name:</label>
                    <input
                      type="text"
                      value={editWinnerName}
                      onChange={(e) => setEditWinnerName(e.target.value)}
                      placeholder="e.g. Winner (Slot #1)"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white font-bold rounded-xl px-3 py-2 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Prize Amount / Display:</label>
                    <input
                      type="text"
                      value={editPrizeAmount}
                      onChange={(e) => setEditPrizeAmount(e.target.value)}
                      placeholder="e.g. ₹50,000"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-mono font-bold rounded-xl px-3 py-2 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* MODAL ACTION BUTTONS */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingSlotModal(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditResultModal}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Save & Publish Result
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================
          SUB-TAB 3: 👤 USER TICKET AUDIT & MANUAL WIN / LOSE
         ========================================================= */}
      {activeSubTab === 'tickets' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header & Title */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-3xl">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>User Ticket Purchase History & Manual Settlement</span>
                </h3>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase">
                  👤 USER TICKET AUDIT & MANUAL WIN / LOSE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">View all user ticket purchases, track winning auto-payouts, or manually force Win/Lose outcomes for individual user tickets.</p>
            </div>
          </div>

          {/* 4 Summary Badges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-black block">TOTAL TICKETS SOLD</span>
              <span className="text-xl font-black text-white block mt-1">{supercarTickets.length} Tickets</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-emerald-900/40">
              <span className="text-[10px] text-emerald-400 uppercase font-black block">🟢 AUTO-WON ({totalAutoWonCount})</span>
              <span className="text-xl font-black text-emerald-300 block mt-1">₹{totalAutoWonAmt.toLocaleString('en-IN')}</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-rose-900/40">
              <span className="text-[10px] text-rose-400 uppercase font-black block">🔴 AUTO-LOST ({totalAutoLostCount})</span>
              <span className="text-xl font-black text-rose-300 block mt-1">₹0 (No Refund)</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-amber-900/40">
              <span className="text-[10px] text-amber-400 uppercase font-black block">⌛ ACTIVE PENDING ({totalPendingCount})</span>
              <span className="text-xl font-black text-amber-300 block mt-1">
                ₹{supercarTickets.filter(t => t.status === 'active' || t.status === 'pending').reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Automatic Settlement Engine Rule Banner */}
          <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-xs text-amber-300">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>⚡ AUTOMATIC WIN/LOSS SETTLEMENT ENGINE ACTIVE:</strong> If result matches player car choice -&gt; Auto Wallet Credit | If result differs -&gt; Loss Logged (No Refund)
            </span>
          </div>

          {/* Multi-Filters Bar with Calendar Date Selection */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Date Filter:</span>
                <span className="text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  {auditSelectedDateStr === 'all' ? 'All Time History' : auditSelectedDateStr === todayStr ? `Today (${todayStr})` : auditSelectedDateStr}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ⚡ Recent Tickets First ({auditFilteredTickets.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    try { soundFx.playClick(); } catch (_) {}
                    setAuditSelectedDateStr(todayStr);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditSelectedDateStr === todayStr
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Today Only
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { soundFx.playClick(); } catch (_) {}
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                    setAuditSelectedDateStr(yStr);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditSelectedDateStr !== 'all' && auditSelectedDateStr !== todayStr
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Past Date
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { soundFx.playClick(); } catch (_) {}
                    setAuditSelectedDateStr('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditSelectedDateStr === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  All Dates
                </button>

                <input
                  type="date"
                  value={auditSelectedDateStr === 'all' ? '' : auditSelectedDateStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      try { soundFx.playClick(); } catch (_) {}
                      setAuditSelectedDateStr(e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
                  title="Pick a custom date"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name, phone, ticket # or UID..."
                  value={ticketSearchTerm}
                  onChange={(e) => setTicketSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={ticketSlotFilter}
                  onChange={(e) => setTicketSlotFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All Slots (1 to {totalSlotsCount})</option>
                  {Array.from({ length: totalSlotsCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Slot #{String(i + 1).padStart(2, '0')}</option>
                  ))}
                </select>

                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Pending</option>
                  <option value="win">Won Tickets</option>
                  <option value="loss">Lost Tickets</option>
                </select>

                <select
                  value={ticketCarFilter}
                  onChange={(e) => setTicketCarFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All Car Types</option>
                  <option value="red">Red Only</option>
                  <option value="black">Black Only</option>
                  <option value="yellow">Yellow Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Tickets Table */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            {(() => {
              const groupedBatches = groupTicketsByBatch(auditFilteredTickets);
              if (groupedBatches.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-500 text-xs font-bold">
                    No tickets match the selected filter criteria.
                  </div>
                );
              }

              const paginatedBatches = groupedBatches.slice((ticketPage - 1) * ticketPageSize, ticketPage * ticketPageSize);

              return (
                <>
                  <div className="space-y-3">
                    {paginatedBatches.map((batch) => {
                      const firstTicket = batch.firstTicket;
                      const uObj = usersMap[batch.userId];
                      const name = (firstTicket as any).userName || uObj?.name || 'BETGURU Player';
                      const phone = (firstTicket as any).userPhone || uObj?.phone || 'N/A';
                      const carChoice = (batch.selectedCar || 'red').toLowerCase() as SuperCarColor;
                      const carInfo = getSuperCarInfo(carChoice, config);
                      const isSettling = settlingTicketId === batch.groupKey;
                      const exactDateTimeStr = formatTicketExactDateTime(firstTicket);

                      return (
                        <div key={batch.groupKey} className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl transition-all font-mono">
                          
                          {/* Left Block: Car Photo + Ticket Info */}
                          <div className="flex items-start sm:items-center gap-3.5 flex-1 w-full">
                            
                            {/* Car Image Preview Thumbnail */}
                            <div className="relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden border-2 border-amber-500/40 shadow-md shrink-0 bg-slate-900 group">
                              <img
                                src={carInfo.image}
                                alt={carInfo.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                              <span className={`absolute bottom-0.5 left-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                carChoice === 'red' ? 'bg-rose-500 text-white' : carChoice === 'black' ? 'bg-amber-500 text-slate-950' : 'bg-yellow-400 text-slate-950'
                              }`}>
                                {carChoice} CAR
                              </span>
                            </div>

                            {/* Ticket Text Details */}
                            <div className="space-y-1 flex-1 min-w-0">
                              
                              {/* Glowing Animated Purchase Time Badge - PROMINENT AT TOP */}
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400/80 px-2.5 py-0.5 rounded-full text-amber-300 font-black text-[11px] shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-400 animate-spin [animation-duration:3s]" />
                                  <span>TIME: {exactDateTimeStr}</span>
                                </div>
                                <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                                  {batch.quantity}x {batch.quantity === 1 ? 'Ticket' : 'Tickets Bulk'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{batch.drawTitle || '3 Super Car Draw'}</span>
                              </div>

                              <p className="text-xs text-slate-300 truncate">
                                Player: <strong className="text-white">{name}</strong> ({phone})
                              </p>
                              
                              <p className="text-[10px] text-slate-400">
                                UID: <span className="text-amber-300 font-bold">{batch.userId}</span> • Total Price: <span className="text-emerald-400 font-extrabold text-xs">₹{batch.totalPrice.toLocaleString('en-IN')}</span> ({batch.quantity}x @ ₹{firstTicket.price || 100})
                              </p>
                            </div>
                          </div>

                          {/* Right Controls: Status & Win / Lose Buttons */}
                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 shrink-0">
                            <div className="text-left md:text-right">
                              <span className="text-[9px] text-slate-400 uppercase block font-bold">Status</span>
                              <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border block ${
                                batch.status === 'win'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : batch.status === 'loss'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              }`}>
                                {batch.status === 'win' ? `WON ₹${(batch.totalWonAmount || 0).toLocaleString('en-IN')}` : batch.status === 'loss' ? 'LOST (NO REFUND)' : 'ACTIVE PENDING'}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={isSettling}
                                onClick={() => handleManualSettleBatch(batch, 'win')}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>✓ WIN</span>
                              </button>

                              <button
                                disabled={isSettling}
                                onClick={() => handleManualSettleBatch(batch, 'loss')}
                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>⊘ LOSE</span>
                              </button>

                              <button
                                disabled={isSettling}
                                onClick={() => handleManualSettleBatch(batch, 'active')}
                                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                                title="Reset status to active"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                </div>

                <PaginationBar
                  currentPage={ticketPage}
                  totalPages={Math.ceil(groupedBatches.length / ticketPageSize) || 1}
                  pageSize={ticketPageSize}
                  totalItems={groupedBatches.length}
                  onPageChange={(page) => setTicketPage(page)}
                  onPageSizeChange={(size) => {
                    setTicketPageSize(size);
                    setTicketPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100]}
                  label="grouped ticket batches"
                />
              </>
            );
          })()}
        </div>

        </div>
      )}

      {/* =========================================================
          SUB-TAB 4: ⚙️ HD CAR IMAGES & PRICING CONFIG
         ========================================================= */}
      {activeSubTab === 'images' && (
        <div className="space-y-6 animate-in fade-in duration-200 font-mono">
          
          {/* SECTION 0: DUAL TICKET PRICING ENGINE (REAL CASH VS BONUS BALANCE) */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/40 border border-purple-500/30 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span>SUPER CAR DUAL TICKET PRICING & BONUS ENGINE</span>
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      LIVE SYNC
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    রিয়েল ক্যাশ ও বোনাস ব্যালেন্স দিয়ে টিকিট কেনার জন্য আলাদা আলাদা প্রাইস সেট করুন।
                  </p>
                </div>
              </div>

              {/* Allow Bonus Purchase Toggle */}
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-purple-500/30">
                <span className="text-[11px] font-bold text-purple-300">
                  {config.allowBonusPurchase !== false ? '🎁 BONUS PURCHASE: ACTIVE' : '🔒 BONUS PURCHASE: LOCKED'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    const newSetting = config.allowBonusPurchase === false ? true : false;
                    onUpdateConfig({ allowBonusPurchase: newSetting });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    config.allowBonusPurchase !== false ? 'bg-purple-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.allowBonusPurchase !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Global Pricing Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              {/* 1. Real Cash Ticket Price */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-1.5">
                <label className="text-[11px] font-bold text-amber-400 uppercase block">
                  💵 Real Cash Ticket Price (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.ticketPrice || 100}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 100);
                    onUpdateConfig({ ticketPrice: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-black outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  ইউজার যখন মেইন ওয়ালেট ব্যালেন্স দিয়ে টিকিট কিনবে
                </span>
              </div>

              {/* 2. Bonus Balance Ticket Price */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-purple-500/30 space-y-1.5">
                <label className="text-[11px] font-bold text-purple-300 uppercase block">
                  🎁 Bonus Balance Ticket Price (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.bonusTicketPrice || config.ticketPrice || 100}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 100);
                    onUpdateConfig({ bonusTicketPrice: val });
                  }}
                  className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-purple-200 font-black outline-none focus:border-purple-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  ইউজার যখন বোনাস ব্যালেন্স সিলেক্ট করে টিকিট কাটবে
                </span>
              </div>

              {/* 3. Global Multiplier */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-1.5">
                <label className="text-[11px] font-bold text-emerald-400 uppercase block">
                  🏆 Winning Prize Multiplier (x)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  value={config.prizeMultiplier || 2.8}
                  onChange={(e) => {
                    const val = Math.max(1.1, Number(e.target.value) || 2.8);
                    onUpdateConfig({ prizeMultiplier: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-300 font-black outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  জিতে গেলে টিকিটের মূল্যের কত গুণ ফেরত পাবে (যেমন 2.8x)
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: SUPER CAR IMAGE & PER-CAR PRICING MANAGER */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Super Car HD Image & Individual Pricing (Red, Black, Yellow)</span>
              </h4>
              <span className="text-[10px] text-slate-400">Max 15MB • Client WebP Compression</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {carsList.map((carKey) => {
                const carInfo = getSuperCarInfo(carKey, config);
                const isCustom = Boolean(config.carImages?.[carKey]);
                const isUploading = uploadingCar === carKey;
                const realPrice = config.carPrices?.[carKey] || config.ticketPrice || 100;
                const bonusPrice = config.bonusCarPrices?.[carKey] || config.bonusTicketPrice || realPrice;
                const multiplier = config.carMultipliers?.[carKey] || config.prizeMultiplier || 2.8;

                return (
                  <div key={carKey} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-white uppercase">{carInfo.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          carKey === 'red' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : carKey === 'black' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        }`}>
                          {carKey}
                        </span>
                      </div>

                      <div className="relative h-36 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group">
                        <img src={carInfo.image} alt={carInfo.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent"></div>

                        {isCustom && (
                          <span className="absolute top-2 left-2 text-[9px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                            CUSTOM IMAGE
                          </span>
                        )}

                        {isUploading && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 space-y-2">
                            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                            <span className="text-xs font-bold text-amber-300">Uploading {uploadProgress}%</span>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Real Price, Bonus Price & Multiplier */}
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-amber-400 font-bold block truncate">Real (₹)</label>
                          <input
                            type="number"
                            value={realPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 100;
                              onUpdateConfig({ carPrices: { ...config.carPrices, [carKey]: val } });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-300 font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-purple-300 font-bold block truncate">Bonus (₹)</label>
                          <input
                            type="number"
                            value={bonusPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 100;
                              onUpdateConfig({ bonusCarPrices: { ...config.bonusCarPrices, [carKey]: val } });
                            }}
                            className="w-full bg-slate-900 border border-purple-500/30 rounded-lg px-2 py-1 text-xs text-purple-200 font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-emerald-400 font-bold block truncate">Odds (x)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={multiplier}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 2.8;
                              onUpdateConfig({ carMultipliers: { ...config.carMultipliers, [carKey]: val } });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-400 font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-900">
                      <div className="flex gap-2">
                        <label className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isCustom ? 'Replace Image' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(carKey, file);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>

                        {isCustom && (
                          <button
                            onClick={() => handleRemoveImage(carKey)}
                            className="p-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 cursor-pointer transition-all"
                            title="Reset image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1.5 items-center pt-1">
                        <input
                          type="text"
                          value={
                            urlInputs[carKey] !== undefined
                              ? urlInputs[carKey]
                              : config.carImages?.[carKey]?.startsWith('data:')
                              ? ''
                              : config.carImages?.[carKey] || ''
                          }
                          placeholder={
                            config.carImages?.[carKey]?.startsWith('data:')
                              ? 'Uploaded File (Paste new image URL...)'
                              : 'Or paste HD Image URL...'
                          }
                          onChange={(e) => setUrlInputs({ ...urlInputs, [carKey]: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const val = urlInputs[carKey]?.trim();
                            if (val) {
                              await onUpdateConfig({ carImages: { ...(config.carImages || {}), [carKey]: val } });
                              setUrlInputs({ ...urlInputs, [carKey]: '' });
                              setStatusMessage({ type: 'success', text: `Updated ${carKey.toUpperCase()} image URL!` });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 rounded-xl text-[10px] font-bold font-mono transition-all shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: LOCK SLOTS OVERRIDE */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>{totalSlotsCount} Daily Slots Manual Slot Locking Engine</span>
              </h4>
              <span className="text-[10px] text-slate-400">Lock specific slots to prevent user bets</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Array.from({ length: totalSlotsCount }, (_, i) => {
                const slotNum = i + 1;
                const timeLabel = getSlotTimeLabel(slotNum);
                const lockedSlots = config.lockedSlots || [];
                const isLocked = lockedSlots.includes(slotNum);

                return (
                  <div key={slotNum} className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1 text-center">
                    <span className="text-[10px] font-bold text-amber-300 block">Slot #{String(slotNum).padStart(2, '0')}</span>
                    <span className="text-xs font-black text-white block">{timeLabel}</span>
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        const newLocked = isLocked ? lockedSlots.filter((s) => s !== slotNum) : [...lockedSlots, slotNum];
                        onUpdateConfig({ lockedSlots: newLocked });
                      }}
                      className={`w-full py-1 rounded text-[9px] font-black transition-all cursor-pointer ${
                        isLocked ? 'bg-rose-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isLocked ? 'LOCKED' : 'LOCK SLOT'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
