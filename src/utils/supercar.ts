import { SuperCarInfo, SuperCarColor, SuperCarDrawIssue, SuperCarConfig, PurchasedTicket } from '../types';
import redCarImg from '../assets/images/red_ferrari_v12_supercar_1786381249141.jpg';
import blackCarImg from '../assets/images/black_supercar_showroom_1786334137173.jpg';
import yellowCarImg from '../assets/images/yellow_supercar_showroom_1786334154910.jpg';

export const SUPER_CARS: Record<SuperCarColor, SuperCarInfo> = {
  red: {
    id: 'red',
    name: 'Red Super Car',
    tagline: 'Ferrari V12 Turbo • Speed King',
    image: redCarImg,
    accentColor: 'from-rose-600 to-red-600',
    glowColor: 'rgba(239, 68, 68, 0.5)',
    badge: 'RED V12',
    topSpeed: '340 km/h',
    acceleration: '2.8s'
  },
  black: {
    id: 'black',
    name: 'Black Super Car',
    tagline: 'Lamborghini Stealth • Shadow Beast',
    image: blackCarImg,
    accentColor: 'from-slate-700 via-zinc-800 to-stone-900',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    badge: 'STEALTH V10',
    topSpeed: '355 km/h',
    acceleration: '2.6s'
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow Super Car',
    tagline: 'McLaren GT • Lightning Fast',
    image: yellowCarImg,
    accentColor: 'from-amber-400 to-yellow-500',
    glowColor: 'rgba(234, 179, 8, 0.5)',
    badge: 'YELLOW TURBO',
    topSpeed: '348 km/h',
    acceleration: '2.7s'
  }
};

/**
 * Returns supercar info with dynamic custom overrides if configured in admin
 */
export function getSuperCarInfo(carKey: SuperCarColor, config?: SuperCarConfig): SuperCarInfo {
  const base = SUPER_CARS[carKey];
  if (!config) return base;

  const customImage = config.carImages?.[carKey];
  return {
    ...base,
    image: customImage && customImage.trim() !== '' ? customImage : base.image
  };
}

export const DEFAULT_SUPERCAR_CONFIG: SuperCarConfig = {
  enabled: true,
  ticketPrice: 100,
  bonusTicketPrice: 100,
  allowBonusPurchase: true,
  bonusOnly: true,
  houseEdgePercent: 5.0,
  prizeMultiplier: 2.8,
  carMultipliers: {
    red: 2.0,
    black: 2.8,
    yellow: 3.5
  },
  resultMode: 'auto',
  operatingStartHour: 0,  // 24/7 Continuous (00:00 AM)
  operatingEndHour: 24,   // 24/7 Continuous (12:00 AM)
  is24x7: true,
  drawIntervalMinutes: 10, // 10 minutes per draw slot (144 Draws Daily)
  bettingCloseSeconds: 30  // Close betting 30 seconds before draw
};

export interface DrawScheduleInfo {
  isOpen: boolean;
  issueId: string;
  drawIndex: number;
  startTime: number;
  endTime: number;
  timeRemainingMs: number;
  isShuffling: boolean; // final 30 seconds
  isBettingClosed: boolean; // closed when timeRemainingMs <= 30000
  nextOpenTime?: number;
}

export interface SuperCarSlotItem {
  slotNum: number;
  slotLabel: string;
  timeLabel: string;
  startTime: number;
  endTime: number;
  issueId: string;
  status: 'completed' | 'active' | 'upcoming';
  timeRemainingMs: number;
  winningCar?: SuperCarColor;
  matchedDraw?: SuperCarDrawIssue;
}

/**
 * Calculates current 24/7 10-minute draw schedule state (144 draws per day).
 * Operates 24 hours x 7 days non-stop with betting closing 30 seconds before draw.
 */
export function getCurrentSuperCarSchedule(config: SuperCarConfig = DEFAULT_SUPERCAR_CONFIG): DrawScheduleInfo {
  const intervalMinutes = config.drawIntervalMinutes || 10;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const intervalMs = intervalMinutes * 60 * 1000;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const currentTime = now.getTime();

  // Elapsed time from midnight
  const elapsedMsSinceStart = Math.max(0, currentTime - dayStart);
  const totalSlotsCount = Math.floor((24 * 60) / intervalMinutes); // 144 slots per day
  const rawDrawIndex = Math.floor(elapsedMsSinceStart / intervalMs) + 1;
  const drawIndex = Math.min(totalSlotsCount, Math.max(1, rawDrawIndex));

  const currentDrawStart = dayStart + (drawIndex - 1) * intervalMs;
  const currentDrawEnd = currentDrawStart + intervalMs;
  const timeRemainingMs = Math.max(0, currentDrawEnd - currentTime);

  const issueId = `CAR-${dateStr}-${String(drawIndex).padStart(2, '0')}`;
  const isShuffling = timeRemainingMs <= 30000 && timeRemainingMs > 0;
  const isBettingClosed = timeRemainingMs <= 30000;

  return {
    isOpen: true,
    issueId,
    drawIndex,
    startTime: currentDrawStart,
    endTime: currentDrawEnd,
    timeRemainingMs,
    isShuffling,
    isBettingClosed
  };
}

/**
 * Returns YYYY-MM-DD string in local user timezone to avoid UTC offset issues
 */
export function getLocalTodayDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns total slots count per day for 24/7 continuous operation (144 slots for 10-min interval)
 */
export function getSuperCarSlotsPerDay(config?: SuperCarConfig): number {
  const intervalMinutes = config?.drawIntervalMinutes || 10;
  return Math.floor((24 * 60) / intervalMinutes);
}

/**
 * Returns all daily 10-minute slots (24/7 non-stop, 144 slots total) for UI rendering.
 * Fully synchronized between User Panel and Admin Panel with offline deterministic fallback.
 */
export function getSuperCarDailySlots(
  targetDate: Date = new Date(),
  pastDraws: SuperCarDrawIssue[] = [],
  config: SuperCarConfig = DEFAULT_SUPERCAR_CONFIG
): SuperCarSlotItem[] {
  const intervalMinutes = config.drawIntervalMinutes || 10;

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const dayStart = new Date(year, targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const totalSlotsCount = Math.floor((24 * 60) / intervalMinutes); // 144 slots for 24 hours at 10 mins each

  const currentTime = Date.now();
  const nowDate = new Date();
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).getTime();

  const isPastDay = dayStart < todayStart;
  const isFutureDay = dayStart > todayStart;

  const slots: SuperCarSlotItem[] = [];

  for (let i = 0; i < totalSlotsCount; i++) {
    const slotNum = i + 1;
    const startTime = dayStart + i * intervalMinutes * 60 * 1000;
    const endTime = startTime + intervalMinutes * 60 * 1000;
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;

    // Format time label using target draw time (endTime) (e.g. 12:10 AM, 01:00 AM, 12:00 PM, 12:30 PM)
    const slotDate = new Date(endTime);
    const h = slotDate.getHours();
    const m = slotDate.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    const timeLabel = `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

    let status: 'completed' | 'active' | 'upcoming' = 'upcoming';
    let timeRemainingMs = 0;

    if (isPastDay) {
      status = 'completed';
    } else if (isFutureDay) {
      status = 'upcoming';
      timeRemainingMs = Math.max(0, startTime - currentTime);
    } else {
      // It's today: accurately check against current clock time
      if (currentTime >= endTime) {
        status = 'completed';
      } else if (currentTime >= startTime && currentTime < endTime) {
        status = 'active';
        timeRemainingMs = Math.max(0, endTime - currentTime);
      } else {
        status = 'upcoming';
        timeRemainingMs = Math.max(0, startTime - currentTime);
      }
    }

    // Match past draw or manual override winner specifically for THIS issueId / dateStr
    const matchedDraw = pastDraws.find((d) => {
      if (!d) return false;
      if (d.issueId === issueId || d.id === issueId) return true;
      if (d.issueId && d.issueId.includes(dateStr) && (d.drawIndex === slotNum || d.issueId.endsWith(`-${String(slotNum).padStart(2, '0')}`))) return true;
      return false;
    });

    // Check manual override slot winner if set in config for issueId or slotNum
    const manualSlotWinner = config.manualSlotWinners?.[issueId] || config.manualSlotWinners?.[slotNum];
    
    // Auto deterministic color if not manually set in auto mode:
    // IMPORTANT: Yellow car is STRICTLY EXCLUDED from auto results! Only 'red' and 'black'.
    const autoColors: SuperCarColor[] = ['red', 'black'];
    const autoColor = autoColors[(slotNum * 7 + Number(dateStr)) % 2];

    // Guarantee winningCar for all completed slots: matched draw > manual override > auto deterministic color
    const winningCar = matchedDraw?.winningCar || manualSlotWinner || (status === 'completed' ? (config.resultMode === 'manual' && config.manualWinner ? config.manualWinner : autoColor) : undefined);

    slots.push({
      slotNum,
      slotLabel: `SLOT #${String(slotNum).padStart(2, '0')}`,
      timeLabel,
      startTime,
      endTime,
      issueId,
      status,
      timeRemainingMs,
      winningCar,
      matchedDraw
    });
  }

  return slots;
}

/**
 * Returns the most recent completed draws in reverse chronological order.
 * Works 100% offline ("কোন নেট ছাড়াই") and with continuous 10-minute cadence.
 */
export function getRecentCompletedSuperCarDraws(
  pastDraws: SuperCarDrawIssue[] = [],
  config: SuperCarConfig = DEFAULT_SUPERCAR_CONFIG,
  count: number = 10
): SuperCarDrawIssue[] {
  const now = new Date();
  const todaySlots = getSuperCarDailySlots(now, pastDraws, config);
  const completedToday = todaySlots
    .filter((s) => s.status === 'completed' && s.winningCar)
    .sort((a, b) => b.slotNum - a.slotNum);

  const results: SuperCarDrawIssue[] = [];

  for (const slot of completedToday) {
    if (results.length >= count) break;
    results.push({
      id: slot.issueId,
      issueId: slot.issueId,
      drawIndex: slot.slotNum,
      drawTime: slot.timeLabel,
      winningCar: slot.winningCar!,
      status: 'completed',
      createdAt: slot.endTime
    });
  }

  // If fewer than count (e.g. early morning 12:20 AM), seamlessly append completed slots from yesterday
  if (results.length < count) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdaySlots = getSuperCarDailySlots(yesterday, pastDraws, config);
    const completedYesterday = yesterdaySlots
      .filter((s) => s.status === 'completed' && s.winningCar)
      .sort((a, b) => b.slotNum - a.slotNum);

    for (const slot of completedYesterday) {
      if (results.length >= count) break;
      results.push({
        id: slot.issueId,
        issueId: slot.issueId,
        drawIndex: slot.slotNum,
        drawTime: `${slot.timeLabel} (Yesterday)`,
        winningCar: slot.winningCar!,
        status: 'completed',
        createdAt: slot.endTime
      });
    }
  }

  return results;
}

/**
 * Format milliseconds into MM:SS display
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getSuperCarSlotTimeLabel(slotNum: number, slotDurationMinutes: number = 10): string {
  const totalMins = slotNum * slotDurationMinutes;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 === 0 ? 12 : h % 12;
  return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Smart sorts slots for optimal UI rendering:
 * 1. Active live draw first at top
 * 2. Completed draws next, newest completed first (descending slotNum)
 * 3. Upcoming draws last (ascending slotNum)
 */
export function sortSuperCarSlotsSmart(slots: SuperCarSlotItem[]): SuperCarSlotItem[] {
  const active = slots.filter((s) => s.status === 'active');
  const completed = slots.filter((s) => s.status === 'completed').sort((a, b) => b.slotNum - a.slotNum);
  const upcoming = slots.filter((s) => s.status === 'upcoming').sort((a, b) => a.slotNum - b.slotNum);

  return [...active, ...completed, ...upcoming];
}

/**
 * Returns winning car for a specific slot and issue ID.
 * IMPORTANT: Yellow car is STRICTLY EXCLUDED from auto mode!
 * Yellow car can ONLY win if manually set by Admin.
 */
export function getWinningCarForSlot(
  slotNum: number,
  issueId: string,
  pastDraws: SuperCarDrawIssue[] = [],
  config?: SuperCarConfig
): SuperCarColor {
  if (config?.resultMode === 'manual' && config?.manualWinner) {
    return config.manualWinner;
  }
  const manualSlotWinner = config?.manualSlotWinners?.[issueId] || config?.manualSlotWinners?.[slotNum];
  if (manualSlotWinner) {
    return manualSlotWinner;
  }
  const matchedDraw = pastDraws.find((d) => {
    if (!d) return false;
    if (d.issueId === issueId || d.id === issueId) return true;
    if (d.issueId && (d.drawIndex === slotNum || d.issueId.endsWith(`-${String(slotNum).padStart(2, '0')}`))) return true;
    return false;
  });
  if (matchedDraw?.winningCar) {
    return matchedDraw.winningCar;
  }
  // Auto mode fallback: ONLY Red and Black (Yellow never wins automatically)
  const autoColors: SuperCarColor[] = ['red', 'black'];
  const dateMatch = issueId.match(/CAR-(\d{8})/);
  const dateNum = dateMatch && dateMatch[1] ? Number(dateMatch[1]) : 20260913;
  return autoColors[(slotNum * 7 + dateNum) % 2];
}

/**
 * Calculates accurate slot number, issueId, and draw expiration time for any ticket in 24/7 mode
 */
export function getSlotFromTicket(
  ticket: PurchasedTicket,
  config?: SuperCarConfig
): { slotNum: number; issueId: string; drawEndTimeMs: number; slotTimeLabel: string } {
  const createdDate = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
  const year = createdDate.getFullYear();
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const day = String(createdDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const startHour = config?.operatingStartHour ?? 0;
  const intervalMins = config?.drawIntervalMinutes ?? 10;

  // If ticket explicitly has valid slotNum > 0 or matching drawId
  if (ticket.slotNum && ticket.slotNum > 0 && ticket.drawId && ticket.drawId.includes(`-${String(ticket.slotNum).padStart(2, '0')}`)) {
    const dayStart = new Date(year, createdDate.getMonth(), createdDate.getDate(), startHour, 0, 0, 0).getTime();
    const drawEndTimeMs = dayStart + ticket.slotNum * intervalMins * 60 * 1000;
    return {
      slotNum: ticket.slotNum,
      issueId: ticket.drawId,
      drawEndTimeMs,
      slotTimeLabel: String(ticket.drawTime || '10M Draw')
    };
  }

  const dayStart = new Date(year, createdDate.getMonth(), createdDate.getDate(), startHour, 0, 0, 0).getTime();
  const timeMs = createdDate.getTime();
  
  let minsFromStart = Math.floor((timeMs - dayStart) / (1000 * 60));
  if (minsFromStart < 0) minsFromStart = 0;

  const totalSlotsCount = Math.floor((24 * 60) / intervalMins); // 144
  const rawSlotNum = Math.floor(minsFromStart / intervalMins) + 1;
  const slotNum = Math.min(totalSlotsCount, Math.max(1, rawSlotNum));
  const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;
  const drawEndTimeMs = dayStart + slotNum * intervalMins * 60 * 1000;

  const slotDate = new Date(drawEndTimeMs);
  const h = slotDate.getHours();
  const m = slotDate.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 === 0 ? 12 : h % 12;
  const slotTimeLabel = `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

  return {
    slotNum,
    issueId,
    drawEndTimeMs,
    slotTimeLabel
  };
}

/**
 * Format ticket exact purchase time (hh:mm:ss AM/PM)
 */
export function formatTicketExactTime(ticket: { createdAt?: string; purchaseTime?: string; purchaseDate?: string; id?: string }): string {
  if (ticket.purchaseTime && ticket.purchaseTime.trim()) return ticket.purchaseTime;
  if (ticket.createdAt) {
    const d = new Date(ticket.createdAt);
    if (!isNaN(d.getTime()) && d.getTime() > 0) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
  }
  if (ticket.id) {
    const match = ticket.id.match(/TKT-SC-(\d+)/) || ticket.id.match(/(\d{13})/);
    if (match && match[1]) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 1000000000000) {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    }
  }
  return 'N/A';
}

/**
 * Format ticket exact purchase full date & time (YYYY-MM-DD hh:mm:ss AM/PM)
 */
export function formatTicketExactDateTime(ticket: { createdAt?: string; purchaseDate?: string; purchaseTime?: string; id?: string }): string {
  const timeStr = formatTicketExactTime(ticket);
  let dateStr = ticket.purchaseDate || '';
  if (!dateStr && ticket.createdAt) {
    const d = new Date(ticket.createdAt);
    if (!isNaN(d.getTime())) {
      dateStr = d.toISOString().split('T')[0];
    }
  }
  if (!dateStr && ticket.id) {
    const match = ticket.id.match(/TKT-SC-(\d+)/) || ticket.id.match(/(\d{13})/);
    if (match && match[1]) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 1000000000000) {
        const d = new Date(ts);
        dateStr = d.toISOString().split('T')[0];
      }
    }
  }

  if (dateStr && timeStr && timeStr !== 'N/A') {
    return `${dateStr} ${timeStr}`;
  }
  return dateStr || timeStr || 'N/A';
}

/**
 * Extracts numeric millisecond timestamp from any transaction, ticket, or log item
 */
export function getExactTimestampMs(item: any): number {
  if (!item) return 0;

  // 1. Direct millisecond numbers
  if (typeof item === 'number' && !isNaN(item) && item > 0) return item;
  if (typeof item.timestamp === 'number' && !isNaN(item.timestamp) && item.timestamp > 0) return item.timestamp;
  if (typeof item.createdAt === 'number' && !isNaN(item.createdAt) && item.createdAt > 0) return item.createdAt;
  if (typeof item.updatedAt === 'number' && !isNaN(item.updatedAt) && item.updatedAt > 0) return item.updatedAt;

  // 2. Firestore Timestamp objects: { seconds, nanoseconds } or { toDate() }
  if (item.seconds && typeof item.seconds === 'number') {
    return item.seconds * 1000 + (item.nanoseconds ? Math.floor(item.nanoseconds / 1000000) : 0);
  }
  if (item.timestamp && typeof item.timestamp.seconds === 'number') {
    return item.timestamp.seconds * 1000 + (item.timestamp.nanoseconds ? Math.floor(item.timestamp.nanoseconds / 1000000) : 0);
  }
  if (item.createdAt && typeof item.createdAt.seconds === 'number') {
    return item.createdAt.seconds * 1000;
  }
  if (item.toDate && typeof item.toDate === 'function') {
    try {
      const d = item.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
    } catch (_) {}
  }
  if (item.timestamp && typeof item.timestamp.toDate === 'function') {
    try {
      const d = item.timestamp.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
    } catch (_) {}
  }

  // 3. String parser for dates and timestamps
  const rawDateStr = item.createdAt || 
    (item.dateKey && item.timestamp ? `${item.dateKey} ${item.timestamp}` : item.dateKey) ||
    item.date || 
    item.purchaseDate || 
    item.timestamp || 
    item.purchaseTime || 
    item.drawDate || 
    item.drawTime || 
    (typeof item === 'string' ? item : '');
  
  if (rawDateStr && typeof rawDateStr === 'string') {
    const trimmed = rawDateStr.trim();

    // 3a. Relative time strings like "Just now", "2 mins ago", "1 hour ago"
    if (trimmed.toLowerCase() === 'just now' || trimmed.toLowerCase() === 'now') {
      return Date.now();
    }
    const relMatch = trimmed.match(/^(\d+)\s*(sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days)\s*ago$/i);
    if (relMatch) {
      const val = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      if (unit.startsWith('sec')) return Date.now() - val * 1000;
      if (unit.startsWith('min')) return Date.now() - val * 60 * 1000;
      if (unit.startsWith('hr') || unit.startsWith('hour')) return Date.now() - val * 3600 * 1000;
      if (unit.startsWith('day')) return Date.now() - val * 86400 * 1000;
    }

    // 3b. Indian / UK format "DD/MM/YYYY, HH:MM:SS am/pm" or "DD-MM-YYYY HH:MM:SS"
    // e.g. "14/08/2026, 2:30:15 pm", "14/8/2026", "20/08/2026, 03:00:00 pm", "12/08/2026, 11:20:00 am"
    // CRITICAL: We parse DMY before standard Date.parse() so DD/MM/YYYY (12/08/2026) is NOT misinterpreted as Dec 8
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?)?/i);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
      const year = parseInt(dmyMatch[3], 10);
      let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
      const ampm = dmyMatch[7]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    // 3c. ISO 8601 format: "2026-08-20T10:12:34.567Z" or "2026-08-20 10:12:34" or "2026-08-20"
    const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/i);
    if (isoMatch) {
      const parsedIso = Date.parse(trimmed);
      if (!isNaN(parsedIso) && parsedIso > 0) {
        return parsedIso;
      }
    }

    // 3d. Named Month format: "20 Aug 2026, 04:30 PM", "12 Aug, 02:45 PM", "20 August 2026", "17-Aug-2026 14:30"
    const monthMap: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11
    };

    const namedMonthMatch = trimmed.match(/^(?:[A-Za-z]+,?\s+)?(\d{1,2})[\s\-]+([A-Za-z]+)(?:[\s\-]+(\d{4}))?(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?)?/i);
    if (namedMonthMatch) {
      const day = parseInt(namedMonthMatch[1], 10);
      const monthKey = namedMonthMatch[2].toLowerCase();
      if (monthKey in monthMap) {
        const month = monthMap[monthKey];
        const currentYear = new Date().getFullYear();
        const year = namedMonthMatch[3] ? parseInt(namedMonthMatch[3], 10) : currentYear;
        let hours = namedMonthMatch[4] ? parseInt(namedMonthMatch[4], 10) : 0;
        const minutes = namedMonthMatch[5] ? parseInt(namedMonthMatch[5], 10) : 0;
        const seconds = namedMonthMatch[6] ? parseInt(namedMonthMatch[6], 10) : 0;
        const ampm = namedMonthMatch[7]?.toLowerCase();

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        const d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }

    // 3e. Standard fallback Date.parse
    const fallbackParsed = Date.parse(trimmed);
    if (!isNaN(fallbackParsed) && fallbackParsed > 0) {
      return fallbackParsed;
    }
  }

  // 4. Check if item has purchaseDate + purchaseTime combination
  if (item.purchaseDate && item.purchaseTime && typeof item.purchaseDate === 'string' && typeof item.purchaseTime === 'string') {
    const combined = `${item.purchaseDate} ${item.purchaseTime}`;
    const dmyMatch = combined.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?)?/i);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
      const ampm = dmyMatch[7]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  // 5. Embedded timestamp in ID (e.g. TXN-1786381249141, TKT-1786381249141, DEP-1786381249141, WTH-1786381249141)
  if (item.id) {
    const matches = String(item.id).match(/\d{10,15}/);
    if (matches && matches[0]) {
      const extractedNum = Number(matches[0]);
      if (!isNaN(extractedNum) && extractedNum > 1000000000000) {
        return extractedNum;
      }
    }
  }

  return 0;
}

export interface GroupedTicketBatch {
  groupKey: string;
  batchId?: string;
  userId: string;
  drawId: string;
  drawTitle: string;
  category?: string;
  selectedCar?: SuperCarColor;
  status: 'active' | 'win' | 'loss' | 'pending';
  tickets: PurchasedTicket[];
  quantity: number;
  totalPrice: number;
  totalWonAmount: number;
  purchaseDate: string;
  purchaseTime?: string;
  createdAt?: string;
  firstTicket: PurchasedTicket;
  slotNum?: number;
}

/**
 * Universal Ticket Batching Utility: Groups multiple tickets bought together in a single transaction
 * so that they display as 1 single entry (e.g. "80x BLACK CAR Tickets - Total ₹8,000") in User and Admin lists.
 */
export function groupTicketsByBatch(tickets: PurchasedTicket[]): GroupedTicketBatch[] {
  if (!tickets || !Array.isArray(tickets)) return [];

  const groupsMap = new Map<string, GroupedTicketBatch>();

  tickets.forEach((t) => {
    const carStr = t.selectedCar || (t.selectedNumbers && t.selectedNumbers.length > 0 ? t.selectedNumbers.join('-') : '');
    const dateStr = t.purchaseDate || '';
    const timeStr = t.purchaseTime || '';
    const createdMinuteStr = t.createdAt ? t.createdAt.slice(0, 16) : ''; // Group by same minute

    const key = t.batchId || `${t.userId}_${t.drawId}_${carStr}_${dateStr}_${timeStr || createdMinuteStr}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        groupKey: key,
        batchId: t.batchId,
        userId: t.userId,
        drawId: t.drawId,
        drawTitle: t.drawTitle,
        category: t.category,
        selectedCar: t.selectedCar,
        status: (t.status || 'active') as any,
        tickets: [t],
        quantity: 1,
        totalPrice: t.price || 0,
        totalWonAmount: t.wonAmount || 0,
        purchaseDate: t.purchaseDate,
        purchaseTime: t.purchaseTime,
        createdAt: t.createdAt,
        firstTicket: t,
        slotNum: t.slotNum
      });
    } else {
      const existing = groupsMap.get(key)!;
      existing.tickets.push(t);
      existing.quantity += 1;
      existing.totalPrice += (t.price || 0);
      existing.totalWonAmount += (t.wonAmount || 0);

      if (t.status === 'win') existing.status = 'win';
      else if (existing.status !== 'win' && t.status === 'loss') existing.status = 'loss';
    }
  });

  return Array.from(groupsMap.values());
}

/**
 * Universal Chronological Sort Utility: Newest (latest) items FIRST at the top
 */
export function sortChronologicalNewestFirst<T = any>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];
  const list: T[] = Array.from(items);
  return list.sort((a: T, b: T) => {
    const timeA = getExactTimestampMs(a);
    const timeB = getExactTimestampMs(b);
    if (timeA !== timeB) {
      return timeB - timeA; // Higher time (newer) comes first at the top
    }
    const idA = String((a as any)?.id || (a as any)?.batchId || (a as any)?.groupKey || '');
    const idB = String((b as any)?.id || (b as any)?.batchId || (b as any)?.groupKey || '');
    return idB.localeCompare(idA);
  });
}


