import { SuperCarColor, SuperCarConfig, PurchasedTicket, SuperCarDrawIssue } from '../types';

export interface SuperCarLiveBettingStats {
  issueId: string;
  slotNum: number;
  totalPool: number;
  totalTickets: number;
  totalPlayers: number;
  realBalanceVolume: number;
  bonusBalanceVolume: number;
  red: {
    totalBets: number;
    ticketCount: number;
    playerCount: number;
    realVolume: number;
    bonusVolume: number;
    multiplier: number;
    potentialPayout: number;
    houseProfit: number;
    houseProfitMarginPercent: number;
  };
  black: {
    totalBets: number;
    ticketCount: number;
    playerCount: number;
    realVolume: number;
    bonusVolume: number;
    multiplier: number;
    potentialPayout: number;
    houseProfit: number;
    houseProfitMarginPercent: number;
  };
  yellow: {
    totalBets: number;
    ticketCount: number;
    playerCount: number;
    realVolume: number;
    bonusVolume: number;
    multiplier: number;
    potentialPayout: number;
    houseProfit: number;
    houseProfitMarginPercent: number;
  };
  houseEdgeTargetPercent: number; // 0% to 99.5%
  calculatedWinner: SuperCarColor; // Strictly 'red' or 'black' (yellow ONLY if manual)
  calculationReason: string;
  isManualOverride: boolean;
  manualWinnerColor?: SuperCarColor;
}

/**
 * Calculates live betting statistics and automatically determines the winning car
 * based on the configured House Edge (0.0% to 99.5%).
 * 
 * STRICT ARCHITECTURAL RULES:
 * 1. YELLOW CAR NEVER WINS AUTOMATICALLY. Yellow can only win if manually set by Admin.
 * 2. The automatic engine compares Red vs Black liabilities:
 *    Whichever car yields higher House Profit (lower payout liability) is selected,
 *    guaranteeing maximum profitability and zero risk for the house.
 * 3. In the event of equal payouts or zero bets, a deterministic alternation between
 *    Red and Black is used.
 */
export function calculateSuperCarLiveBettingStats(
  slotNum: number,
  issueId: string,
  allTickets: PurchasedTicket[],
  config: SuperCarConfig
): SuperCarLiveBettingStats {
  const houseEdgeTargetPercent = Math.min(
    99.5,
    Math.max(0, config.houseEdgePercent ?? config.houseEdge ?? 5.0)
  );

  // Multipliers for each car
  const redMultiplier = config.carMultipliers?.red || 2.0;
  const blackMultiplier = config.carMultipliers?.black || config.prizeMultiplier || 2.8;
  const yellowMultiplier = config.carMultipliers?.yellow || 3.5;

  // Filter tickets for this specific slot or issueId
  const slotTickets = allTickets.filter((t) => {
    if (!t) return false;
    if (t.category !== 'Three Super Car Draw' && !t.drawTitle?.includes('Super Car')) return false;

    // Match by explicit issueId or slot number
    if (t.drawId === issueId) return true;
    if (t.slotNum === slotNum) return true;
    if (t.drawTitle && (t.drawTitle.includes(issueId) || t.drawTitle.includes(`Slot #${String(slotNum).padStart(2, '0')}`))) return true;

    return false;
  });

  const uniquePlayers = new Set<string>();
  let realBalanceVolume = 0;
  let bonusBalanceVolume = 0;

  // Red car stats
  let redBets = 0;
  let redTicketCount = 0;
  let redRealVolume = 0;
  let redBonusVolume = 0;
  const redPlayerSet = new Set<string>();

  // Black car stats
  let blackBets = 0;
  let blackTicketCount = 0;
  let blackRealVolume = 0;
  let blackBonusVolume = 0;
  const blackPlayerSet = new Set<string>();

  // Yellow car stats
  let yellowBets = 0;
  let yellowTicketCount = 0;
  let yellowRealVolume = 0;
  let yellowBonusVolume = 0;
  const yellowPlayerSet = new Set<string>();

  for (const t of slotTickets) {
    const cost = Number(t.price) || 0;
    const isBonus = t.walletType === 'bonus';
    const uid = t.userId || 'anon';

    uniquePlayers.add(uid);
    if (isBonus) {
      bonusBalanceVolume += cost;
    } else {
      realBalanceVolume += cost;
    }

    const rawColor = (t.selectedCar || t.selectedNumbers?.[0] || 'red').toString().toLowerCase();

    if (rawColor === 'red') {
      redBets += cost;
      redTicketCount += 1;
      redPlayerSet.add(uid);
      if (isBonus) redBonusVolume += cost;
      else redRealVolume += cost;
    } else if (rawColor === 'black') {
      blackBets += cost;
      blackTicketCount += 1;
      blackPlayerSet.add(uid);
      if (isBonus) blackBonusVolume += cost;
      else blackRealVolume += cost;
    } else if (rawColor === 'yellow') {
      yellowBets += cost;
      yellowTicketCount += 1;
      yellowPlayerSet.add(uid);
      if (isBonus) yellowBonusVolume += cost;
      else yellowRealVolume += cost;
    }
  }

  const totalPool = redBets + blackBets + yellowBets;

  // Potential payout liabilities
  const redPayout = Math.round(redBets * redMultiplier);
  const blackPayout = Math.round(blackBets * blackMultiplier);
  const yellowPayout = Math.round(yellowBets * yellowMultiplier);

  // House profit if that car wins
  const houseProfitRed = totalPool - redPayout;
  const houseProfitBlack = totalPool - blackPayout;
  const houseProfitYellow = totalPool - yellowPayout;

  const redMargin = totalPool > 0 ? ((houseProfitRed / totalPool) * 100) : 0;
  const blackMargin = totalPool > 0 ? ((houseProfitBlack / totalPool) * 100) : 0;
  const yellowMargin = totalPool > 0 ? ((houseProfitYellow / totalPool) * 100) : 0;

  // Check for Manual Override first
  let isManualOverride = false;
  let manualWinnerColor: SuperCarColor | undefined = undefined;

  if (config.resultMode === 'manual' && config.manualWinner) {
    isManualOverride = true;
    manualWinnerColor = config.manualWinner;
  } else if (config.manualSlotWinners?.[issueId]) {
    isManualOverride = true;
    manualWinnerColor = config.manualSlotWinners[issueId];
  } else if (config.manualSlotWinners?.[slotNum]) {
    isManualOverride = true;
    manualWinnerColor = config.manualSlotWinners[slotNum];
  }

  let calculatedWinner: SuperCarColor = 'red';
  let calculationReason = '';

  if (isManualOverride && manualWinnerColor) {
    calculatedWinner = manualWinnerColor;
    calculationReason = `Admin Manual Override: ${manualWinnerColor.toUpperCase()} CAR explicitly set by Administrator.`;
  } else {
    // AUTOMATIC CALCULATION:
    // YELLOW CAR NEVER WINS AUTOMATICALLY (only Red and Black).
    // Pick the car between Red and Black that provides HIGHER house profit (lower liability).

    if (totalPool === 0 || (redBets === 0 && blackBets === 0)) {
      // Both zero bets or empty round: Deterministic fair alternation between Red and Black
      const dateNum = Number(issueId.replace(/\D/g, '')) || 20260913;
      calculatedWinner = (slotNum + dateNum) % 2 === 0 ? 'red' : 'black';
      calculationReason = `No bets placed on Red/Black: Smooth deterministic rotation selected ${calculatedWinner.toUpperCase()} Car (Yellow car strictly excluded in auto mode).`;
    } else if (houseProfitRed > houseProfitBlack) {
      calculatedWinner = 'red';
      calculationReason = `Red Car selected: Lower house payout liability (₹${redPayout.toLocaleString('en-IN')} vs ₹${blackPayout.toLocaleString('en-IN')}). Maximizes House Profit to ₹${houseProfitRed.toLocaleString('en-IN')} (${redMargin.toFixed(1)}% margin).`;
    } else if (houseProfitBlack > houseProfitRed) {
      calculatedWinner = 'black';
      calculationReason = `Black Car selected: Lower house payout liability (₹${blackPayout.toLocaleString('en-IN')} vs ₹${redPayout.toLocaleString('en-IN')}). Maximizes House Profit to ₹${houseProfitBlack.toLocaleString('en-IN')} (${blackMargin.toFixed(1)}% margin).`;
    } else {
      // Exactly equal profit: pick the car with lower bets
      if (redBets <= blackBets) {
        calculatedWinner = 'red';
        calculationReason = `Equal profit liability: Red Car chosen due to lower or equal wager volume (₹${redBets} vs ₹${blackBets}).`;
      } else {
        calculatedWinner = 'black';
        calculationReason = `Equal profit liability: Black Car chosen due to lower wager volume (₹${blackBets} vs ₹${redBets}).`;
      }
    }
  }

  return {
    issueId,
    slotNum,
    totalPool,
    totalTickets: slotTickets.length,
    totalPlayers: uniquePlayers.size,
    realBalanceVolume,
    bonusBalanceVolume,
    red: {
      totalBets: redBets,
      ticketCount: redTicketCount,
      playerCount: redPlayerSet.size,
      realVolume: redRealVolume,
      bonusVolume: redBonusVolume,
      multiplier: redMultiplier,
      potentialPayout: redPayout,
      houseProfit: houseProfitRed,
      houseProfitMarginPercent: redMargin
    },
    black: {
      totalBets: blackBets,
      ticketCount: blackTicketCount,
      playerCount: blackPlayerSet.size,
      realVolume: blackRealVolume,
      bonusVolume: blackBonusVolume,
      multiplier: blackMultiplier,
      potentialPayout: blackPayout,
      houseProfit: houseProfitBlack,
      houseProfitMarginPercent: blackMargin
    },
    yellow: {
      totalBets: yellowBets,
      ticketCount: yellowTicketCount,
      playerCount: yellowPlayerSet.size,
      realVolume: yellowRealVolume,
      bonusVolume: yellowBonusVolume,
      multiplier: yellowMultiplier,
      potentialPayout: yellowPayout,
      houseProfit: houseProfitYellow,
      houseProfitMarginPercent: yellowMargin
    },
    houseEdgeTargetPercent,
    calculatedWinner,
    calculationReason,
    isManualOverride,
    manualWinnerColor
  };
}
