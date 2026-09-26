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

  // Filter tickets specifically for this slot or issueId (ignoring tickets from other dates or already settled draws)
  const slotTickets = allTickets.filter((t) => {
    if (!t) return false;
    const cat = (t.category || '').toLowerCase();
    const title = ((t as any).lotteryTitle || t.drawTitle || '').toLowerCase();
    const isSuperCar = cat.includes('super car') || title.includes('super car') || cat.includes('supercar');
    if (!isSuperCar) return false;

    // Direct match by issueId
    if (t.drawId === issueId || (t as any).issueId === issueId) return true;
    if ((t as any).lotteryTitle && (t as any).lotteryTitle.includes(issueId)) return true;
    if (t.drawTitle && t.drawTitle.includes(issueId)) return true;

    // Match by slotNum on the same day
    const issueDateStr = issueId.split('-')[1] || '';
    const ticketDateStr = (t.purchaseDate || t.drawDate || (t.createdAt ? t.createdAt.substring(0, 10) : '')).replace(/\D/g, '');
    const isSameDay = !issueDateStr || !ticketDateStr || ticketDateStr.includes(issueDateStr) || issueDateStr.includes(ticketDateStr);

    if (isSameDay) {
      if (t.slotNum === slotNum || (t as any).slotNumber === slotNum) return true;
      if ((t as any).lotteryId && (t as any).lotteryId.includes(`slot-${slotNum}`)) return true;
      if (title.includes(`slot #${String(slotNum).padStart(2, '0')}`) || title.includes(`slot-${slotNum}`)) return true;
    }

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

    let rawColor = (t.selectedCar || (t as any).carColor || (t as any).car || t.selectedNumbers?.[0] || '').toString().toLowerCase();
    if (!rawColor) {
      const fullText = `${(t as any).lotteryTitle || ''} ${t.drawTitle || ''}`.toLowerCase();
      if (fullText.includes('red')) rawColor = 'red';
      else if (fullText.includes('black')) rawColor = 'black';
      else if (fullText.includes('yellow')) rawColor = 'yellow';
      else rawColor = 'red';
    }

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

    // Check actual player bets to guarantee House Edge (players never win unless admin forces)
    const realPlayerBetColors = new Set<SuperCarColor>();
    if (redPlayerSet.size > 0 || redTicketCount > 0 || redBets > 0) realPlayerBetColors.add('red');
    if (blackPlayerSet.size > 0 || blackTicketCount > 0 || blackBets > 0) realPlayerBetColors.add('black');
    if (yellowPlayerSet.size > 0 || yellowTicketCount > 0 || yellowBets > 0) realPlayerBetColors.add('yellow');

    if (realPlayerBetColors.size > 0) {
      // Find cars that active human players did NOT bet on
      const unbetByPlayers = (['red', 'black', 'yellow'] as SuperCarColor[]).filter(c => !realPlayerBetColors.has(c));
      
      if (unbetByPlayers.length > 0) {
        // Player bet on 1 or 2 cars: choose an unbet car so player payout is ₹0 and House retains 100%!
        const chosen = unbetByPlayers[(slotNum + dateNum) % unbetByPlayers.length];
        calculatedWinner = chosen;
        calculationReason = `🛡️ হাউস সুরক্ষা (House Edge Protection): প্লেয়ার ${Array.from(realPlayerBetColors).join(', ').toUpperCase()} গাড়িতে বাজি ধরেছে। হাউস সুরক্ষা বজায় রেখে ${chosen.toUpperCase()} কারকে বিজয়ী ঘোষণা করা হয়েছে যাতে প্লেয়ার পে-আউট ₹০ হয় এবং হাউস ১০০% লাভ পায়।`;
      } else {
        // Player bet on all 3 cars: select the car that minimizes payout liability and maximizes House Profit
        const candidates = [
          { color: 'red' as SuperCarColor, bets: redBets, payout: redPayout, profit: houseProfitRed, margin: redMargin },
          { color: 'black' as SuperCarColor, bets: blackBets, payout: blackPayout, profit: houseProfitBlack, margin: blackMargin },
          { color: 'yellow' as SuperCarColor, bets: yellowBets, payout: yellowPayout, profit: houseProfitYellow, margin: yellowMargin }
        ];
        candidates.sort((a, b) => {
          if (b.profit !== a.profit) return b.profit - a.profit;
          return a.bets - b.bets;
        });
        calculatedWinner = candidates[0].color;
        calculationReason = `🛡️ হাউস সুরক্ষা (মাল্টি-বেট): প্লেয়ার সমস্ত গাড়িতে বাজি ধরেছে। সর্বনিম্ন পে-আউট দায়বদ্ধতা সম্পন্ন ${calculatedWinner.toUpperCase()} কার বিজয়ী করা হয়েছে।`;
      }
    } else if (totalPool === 0) {
      // Empty round: deterministic fair alternation across all 3 cars
      const colors: SuperCarColor[] = ['red', 'black', 'yellow'];
      calculatedWinner = colors[(slotNum * 7 + dateNum) % 3];
      calculationReason = `No bets placed in this round: Deterministic rotation selected ${calculatedWinner.toUpperCase()} Car. House liability is ₹0.`;
    } else {
      // Simulated pool with no direct user tickets: choose car with zero bets or lowest liability
      const emptyCars: { color: SuperCarColor; multiplier: number }[] = [];
      if (redBets === 0) emptyCars.push({ color: 'red', multiplier: redMultiplier });
      if (blackBets === 0) emptyCars.push({ color: 'black', multiplier: blackMultiplier });
      if (yellowBets === 0) emptyCars.push({ color: 'yellow', multiplier: yellowMultiplier });

      if (emptyCars.length > 0) {
        const chosen = emptyCars[(slotNum + dateNum) % emptyCars.length];
        calculatedWinner = chosen.color;
        calculationReason = `ফাঁকা বাজি প্রটেকশন (Empty Bet Spot): No bets placed on ${calculatedWinner.toUpperCase()} Car. Declaring it winner secures ₹0 payout liability.`;
      } else {
        const candidates = [
          { color: 'red' as SuperCarColor, bets: redBets, payout: redPayout, profit: houseProfitRed, margin: redMargin },
          { color: 'black' as SuperCarColor, bets: blackBets, payout: blackPayout, profit: houseProfitBlack, margin: blackMargin },
          { color: 'yellow' as SuperCarColor, bets: yellowBets, payout: yellowPayout, profit: houseProfitYellow, margin: yellowMargin }
        ];
        candidates.sort((a, b) => {
          if (b.profit !== a.profit) return b.profit - a.profit;
          return a.bets - b.bets;
        });
        calculatedWinner = candidates[0].color;
        calculationReason = `হাউস প্রফিট সুরক্ষা: ${candidates[0].color.toUpperCase()} Car selected with maximum House Profit.`;
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
