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
  calculatedWinner: SuperCarColor; // Selected winner based on House Edge, lowest liability, and empty spot algorithm
  calculationReason: string;
  isManualOverride: boolean;
  manualWinnerColor?: SuperCarColor;
}

export interface SuperCarLivePoolData {
  redBets?: number;
  blackBets?: number;
  yellowBets?: number;
  redTickets?: number;
  blackTickets?: number;
  yellowTickets?: number;
  totalPool?: number;
}

/**
 * Calculates live betting statistics and automatically determines the winning car
 * based on the configured House Edge (0.0% to 99.5%) and Empty Spot / Least Bet protection.
 * 
 * STRICT HOUSE INTEGRITY & USER REQUEST RULES:
 * 1. If any car has ZERO bets (ফাঁকা / empty), declaring it the winner results in ₹0 payout
 *    and guarantees 100% House Profit (House never loses).
 * 2. If bets are placed, select the car that minimizes payout liability and user wager volume,
 *    maximizing House Profit margin.
 * 3. Works in 0 seconds with or without the Admin logged in (offline admin proof).
 */
export function calculateSuperCarLiveBettingStats(
  slotNum: number,
  issueId: string,
  allTickets: PurchasedTicket[],
  config: SuperCarConfig,
  livePoolData?: SuperCarLivePoolData
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

  // If external live pool data exists from real-time database, merge it to account for all concurrent players
  if (livePoolData) {
    if (typeof livePoolData.redBets === 'number') redBets = Math.max(redBets, livePoolData.redBets);
    if (typeof livePoolData.blackBets === 'number') blackBets = Math.max(blackBets, livePoolData.blackBets);
    if (typeof livePoolData.yellowBets === 'number') yellowBets = Math.max(yellowBets, livePoolData.yellowBets);
    if (typeof livePoolData.redTickets === 'number') redTicketCount = Math.max(redTicketCount, livePoolData.redTickets);
    if (typeof livePoolData.blackTickets === 'number') blackTicketCount = Math.max(blackTicketCount, livePoolData.blackTickets);
    if (typeof livePoolData.yellowTickets === 'number') yellowTicketCount = Math.max(yellowTicketCount, livePoolData.yellowTickets);
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

  // Check for Manual Override strictly scoped to unique issueId
  let isManualOverride = false;
  let manualWinnerColor: SuperCarColor | undefined = undefined;

  if (config.resultMode === 'manual' && config.manualWinner && (!(config as any).manualTargetIssueId || (config as any).manualTargetIssueId === issueId)) {
    isManualOverride = true;
    manualWinnerColor = config.manualWinner;
  } else if (config.manualSlotWinners?.[issueId]) {
    isManualOverride = true;
    manualWinnerColor = config.manualSlotWinners[issueId];
  }

  let calculatedWinner: SuperCarColor = 'red';
  let calculationReason = '';

  if (isManualOverride && manualWinnerColor) {
    calculatedWinner = manualWinnerColor;
    calculationReason = `Admin Manual Override: ${manualWinnerColor.toUpperCase()} CAR explicitly set by Administrator.`;
  } else {
    // =========================================================================
    // AUTOMATIC WINNER CALCULATION (ZERO-SECOND HOUSE EDGE & EMPTY SPOT ALGORITHM)
    // =========================================================================
    // Core Rules requested by Management:
    // 1. If any car is EMPTY (zero bets / ফাঁকা), declaring it winner results in
    //    ₹0 payout liability and secures 100% of the pool for the House.
    // 2. Where bets are placed, select the car with the LOWEST payout liability
    //    and LEAST betting volume, maximizing House Profit and preventing any loss.
    // 3. If no bets are placed anywhere (totalPool === 0), use deterministic fair rotation.

    const dateNum = Number(issueId.replace(/\D/g, '')) || 20260913;

    if (totalPool === 0) {
      // Empty round: deterministic fair alternation across all 3 cars
      const colors: SuperCarColor[] = ['red', 'black', 'yellow'];
      calculatedWinner = colors[(slotNum * 7 + dateNum) % 3];
      calculationReason = `No bets placed in this round: Deterministic rotation selected ${calculatedWinner.toUpperCase()} Car. House liability is ₹0.`;
    } else {
      // Check for completely EMPTY cars (0 bets / ফাঁকা)
      const emptyCars: { color: SuperCarColor; multiplier: number }[] = [];
      if (redBets === 0) emptyCars.push({ color: 'red', multiplier: redMultiplier });
      if (blackBets === 0) emptyCars.push({ color: 'black', multiplier: blackMultiplier });
      if (yellowBets === 0) emptyCars.push({ color: 'yellow', multiplier: yellowMultiplier });

      if (emptyCars.length > 0) {
        // At least one car has 0 bets: declaring it winner gives ₹0 payout and 100% house profit!
        const chosen = emptyCars[(slotNum + dateNum) % emptyCars.length];
        calculatedWinner = chosen.color;
        calculationReason = `ফাঁকা বাজি প্রটেকশন (Empty Bet Spot): No user bets placed on ${calculatedWinner.toUpperCase()} Car (₹0 bets). Declaring it winner secures ₹0 payout liability and 100% House Profit (₹${totalPool.toLocaleString('en-IN')}).`;
      } else {
        // All cars have bets placed: select the car with MAXIMUM house profit (LOWEST payout liability)
        const candidates = [
          { color: 'red' as SuperCarColor, bets: redBets, payout: redPayout, profit: houseProfitRed, margin: redMargin },
          { color: 'black' as SuperCarColor, bets: blackBets, payout: blackPayout, profit: houseProfitBlack, margin: blackMargin },
          { color: 'yellow' as SuperCarColor, bets: yellowBets, payout: yellowPayout, profit: houseProfitYellow, margin: yellowMargin }
        ];

        // Sort primarily by highest house profit (lowest liability), then by lowest bet volume
        candidates.sort((a, b) => {
          if (b.profit !== a.profit) return b.profit - a.profit; // Highest profit first
          return a.bets - b.bets; // Lowest bets first
        });

        const best = candidates[0];
        calculatedWinner = best.color;
        calculationReason = `কম বেটিং ও হাউস প্রফিট সুরক্ষা (Least Bet & House Profit Protection): ${best.color.toUpperCase()} Car selected with lowest payout liability (₹${best.payout.toLocaleString('en-IN')}) and least bet volume (₹${best.bets.toLocaleString('en-IN')}). Yields maximum House Profit of ₹${best.profit.toLocaleString('en-IN')} (${best.margin.toFixed(1)}% margin). House is 100% protected against losses.`;
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
