export type PaymentMethodType = 
  | 'phonepe' 
  | 'gpay' 
  | 'paytm' 
  | 'upi' 
  | 'usdt_trc20' 
  | 'usdt_bep20' 
  | 'usdt_erc20' 
  | 'btc' 
  | 'eth' 
  | 'crypto';

export type DepositCategory = 'fiat' | 'crypto';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'failed';
export type TicketStatus = 'active' | 'win' | 'loss' | 'pending' | 'rejected' | 'cancelled';

export interface UserSettings {
  bgMusicEnabled?: boolean;
  soundEffectsEnabled?: boolean;
  hapticEnabled?: boolean;
  fireFxEnabled?: boolean;
  fontSize?: 'compact' | 'normal' | 'large';
  chatNewMessageSound?: boolean;
  chatAgentNotificationSound?: boolean;
  transactionPin?: string;
  hasTransactionPin?: boolean;
  pinUpdatedAt?: string;
  passcode?: string;
  hasPasscode?: boolean;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
}

export interface LocationAnomalyInfo {
  hasAnomaly: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  distanceKm: number;
  registeredLocation: string;
  currentLocation: string;
  isDifferentState: boolean;
  isDifferentCountry: boolean;
  isVpnActive: boolean;
}

export interface GeoTrackingInfo {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postal?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  isp?: string;
  org?: string;
  asNumber?: string;
  timezone?: string;
  isVpnOrProxy?: boolean;
  vpnThreatScore?: number;
  vpnReason?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
  hasGps?: boolean;
  lastUpdated?: string;
  formattedAddress?: string;
  houseNumber?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
  sourceType?: 'gps_precise' | 'ip_network' | 'registered_profile' | 'hybrid';
  deviceInfo?: string;
  browserInfo?: string;
  osInfo?: string;
}

export interface LocationAuditEntry {
  id: string;
  timestamp: string;
  eventType: 'registration' | 'login' | 'area_change' | 'bet' | 'deposit' | 'withdrawal' | 'heartbeat';
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  isVpnOrProxy?: boolean;
  vpnReason?: string;
  deviceInfo?: string;
}

export interface User {
  id: string;
  userCode?: string;
  canonicalUid?: string;
  linkedDocIds?: string[];
  name: string;
  email: string;
  phone: string;
  balance: number;
  bonusBalance?: number;
  avatarUrl: string;
  regDate: string;
  createdAt?: string | number;
  lastLogin?: string;
  vipLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'VIP Platinum' | 'Diamond';
  vipTier?: string;
  vipPoints?: number;
  isVip?: boolean;
  vipExpiryDate?: string;
  referralCode: string;
  totalWon: number;
  totalSpent: number;
  status: 'active' | 'suspended' | 'blocked';
  isBlocked?: boolean;
  blockReason?: string;
  blockedAt?: string;
  lastSpinTime?: number; // timestamp of last lucky wheel spin
  spinCredits?: number; // available lucky wheel spin credits earned from deposits or gifted by admin
  spinTargetWallet?: 'bonus' | 'main'; // Target wallet destination for user's lucky wheel wins ('bonus' = Bonus Wallet [Default], 'main' = Main Wallet)
  totalReferrals?: number;
  referredByCode?: string;
  referredById?: string;
  totalReferralBonusEarned?: number;
  qualifiedReferralsCount?: number;
  role?: 'user' | 'admin';
  passcode?: string;
  hasPasscode?: boolean;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  settings?: UserSettings;
  address?: string;
  age?: number | string;
  documentId?: string;
  documentType?: string;
  gender?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  suspiciousDate?: string;
  transactionPin?: string;
  hasTransactionPin?: boolean;
  pinUpdatedAt?: string;
  creditedDepositIds?: string[];
  refundedWithdrawalIds?: string[];
  geoInfo?: GeoTrackingInfo;
  lastLoginLocation?: GeoTrackingInfo;
  locationHistory?: LocationAuditEntry[];
  vpnBlocked?: boolean;
  isVpnDetected?: boolean;
  fcmToken?: string;
  isNativeApp?: boolean;
  fcmUpdatedAt?: string;
  platform?: string;
  appPackage?: string;
  // Withdrawal Wagering (Turnover) fields
  mainWagerRequired?: number; // Target wager requirement for main balance (in ₹)
  mainWagerCompleted?: number; // Total wager/turnover completed on main balance (in ₹)
  bonusWagerRequired?: number; // Target wager requirement for bonus balance (in ₹)
  bonusWagerCompleted?: number; // Total wager/turnover completed on bonus balance (in ₹)
  wagerExempt?: boolean; // Admin bypass/exemption for this user (can withdraw without wager)
  wagerUpdatedAt?: string;
}

export interface WithdrawalWagerSettings {
  enabled: boolean; // Enforce wagering requirement prior to payout
  mainWagerMultiplier: number; // e.g. 1.0 = 1x deposit / main balance wager
  bonusWagerMultiplier: number; // e.g. 5.0 = 5x bonus balance wager
  minWagerBeforeWithdrawal: number; // Minimum total wager required (default: 0)
  allowPartialWithdrawalIfMainMet: boolean; // If true, allows withdrawal if main balance wager is met even if bonus wager is incomplete
  lockWithdrawalOnPendingWager: boolean; // Block submission and display warning banner/modal
  noticeBangla?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ArchivedDeletedUser {
  id: string;
  originalId: string;
  name: string;
  email: string;
  phone: string;
  balance?: number;
  bonusBalance?: number;
  isBanned?: boolean;
  isPermanentlyBanned?: boolean;
  deletionReason?: string;
  deletedAt: string;
  deletedBy?: string;
  originalUserDoc?: Partial<User>;
}

export interface BannedUserRecord {
  id: string;
  email: string;
  phone?: string;
  userId?: string;
  name: string;
  reason: string;
  bannedAt: string;
  bannedBy?: string;
  type: 'block' | 'block_and_delete';
  active: boolean;
  archivedData?: {
    balance?: number;
    bonusBalance?: number;
    regDate?: string;
    vipLevel?: string;
  };
}

export interface WheelSector {
  id: string;
  label: string;
  amount: number;
  color: string;
}

export interface WheelConfig {
  minDepositAmount: number;
  sectors: WheelSector[];
  defaultTargetWallet?: 'bonus' | 'main'; // Global default target wallet for lucky wheel reward payouts (default: 'bonus')
  updatedAt?: string;
}

export interface RegistrationConfig {
  bonusAmount: number;
  isBonusEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  updatedAt?: string;
}

export interface NotificationConfig {
  chimeSoundUrl?: string;
  chimeType?: 'bell' | 'chime' | 'fanfare';
}

export interface AppUpdateConfig {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  changelog: string;
  forceUpdate: boolean;
  minSupportedVersion?: string;
  releaseDate?: string;
  enabled?: boolean;
  updatedAt?: string;
}

export interface BonusBalanceRules {
  allowSuperCar: boolean;          // Default: true (Three Super Car Draw allowed)
  allowRegularLottery: boolean;   // Default: false (Regular Lottery draws locked by default)
  allowLiveRoulette: boolean;     // Default: false (Live Roulette locked by default)
  allowLuckyWheel: boolean;       // Default: false (Lucky Wheel locked by default)
  defaultBonusAmount: number;     // e.g. 100 on registration
  isBonusSystemActive: boolean;  // Master toggle for bonus balance system
  superCarRealTicketPrice?: number; // Configurable real ticket price
  superCarBonusTicketPrice?: number; // Configurable bonus ticket price
  bonusNotice?: string;          // Optional notice/banner text for bonus rules
  updatedAt?: string;
}

export interface BetBreakdownItem {
  spot: string;          // e.g. "🔴 Red (লাল)", "⚡ Number 17", "📊 1st Column", "🐉 DRAGON", "🎴 ANDAR"
  type?: string;          // e.g. 'number' | 'color' | 'parity' | 'dozen' | 'column' | 'range' | 'side' | 'flight'
  detail?: string;        // e.g. "17", "red", "col1", "dragon"
  amount: number;         // Bet amount on this individual section
  isWin?: boolean;        // Whether this individual section won or lost
  multiplier?: string;    // Multiplier e.g. "⚡ 50x Lightning", "36x", "2x (1:1)", "3x (2:1)"
  payout?: number;        // Total payout returned on this section
  outcomeProof?: string;  // Detailed explanation e.g. "Won ₹1,000" or "Lost (Landed on Black 20)"
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  depositId?: string;
  withdrawalId?: string;
  type: 'deposit' | 'withdrawal' | 'ticket_buy' | 'win_payout' | 'wheel_bonus' | 'admin_bonus' | 'admin_deduction' | 'roulette_bet' | 'roulette_win' | 'andar_bahar_bet' | 'andar_bahar_win' | 'dragon_tiger_bet' | 'dragon_tiger_win' | 'crash_bet' | 'crash_win' | 'vip_bonus' | 'loss' | 'win' | 'ticket_win' | 'ticket_loss' | 'aviator_bet' | 'aviator_win' | 'bet' | 'referral_bonus' | 'registration_bonus' | 'promo_code_claim' | 'promo_deposit_bonus';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'rejected';
  date: string;
  createdAt?: string | number;
  utr?: string;
  promoCode?: string;
  promoCodeTitle?: string;
  promoRewardAmount?: number;
  promoOrigin?: string;
  sourceOrigin?: string;
  walletType?: 'main' | 'bonus';
  // Betting Details Breakdown (কোন কোন সেকশনে কত মেরেছিল এবং ফলাফল)
  roundId?: string;
  gameType?: string;
  winningOutcome?: string;
  betsBreakdown?: BetBreakdownItem[];
  extraDetails?: Record<string, any>;
}

export type BannerCategory = 'lottery' | 'supercar' | 'deposit' | 'offers';

export interface BannerSlide {
  id: string;
  category: BannerCategory;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionType: 'deposit' | 'supercar' | 'lottery' | 'wheel' | 'roulette' | 'andar_bahar' | 'dragon_tiger' | 'crash' | 'custom_url';
  targetUrl?: string;
  badgeText?: string;
  bgGradient?: string;
  active: boolean;
  order: number;
  orderIndex?: number;
  createdAt?: string;
}

export interface PromotionalOffer {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  imageUrl: string;
  badgeText?: string;
  tagColor?: string;
  bonusCode?: string;
  bonusPercentage?: number;
  bonusAmount?: number;
  minDeposit?: number;
  actionType: 'deposit' | 'supercar' | 'lottery' | 'wheel' | 'casino' | 'dragon_tiger' | 'roulette' | 'andar_bahar' | 'crash' | 'custom_url';
  actionButtonText?: string;
  targetUrl?: string;
  expiresAt: string; // ISO String
  durationHours?: number;
  active: boolean;
  isFeatured?: boolean;
  bgGradient?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  userEmail?: string;
  userCode?: string;
  userName: string;
  fullName?: string;
  transactionId?: string;
  userPhone: string;
  amount: number; // in INR
  cryptoAmount?: number; // e.g. 10 USDT
  cryptoCurrency?: string; // e.g. "USDT (TRC20)", "BTC", "ETH"
  category?: DepositCategory; // 'fiat' | 'crypto'
  method: PaymentMethodType;
  utr: string; // UTR or TxHash
  screenshotUrl: string;
  screenshotHash?: string; // fingerprint for duplicate image prevention
  date: string;
  createdAt?: string | number;
  status: TransactionStatus;
  rejectReason?: string;
  promoCode?: string;
  promoBonusAmount?: number;
  promoTargetWallet?: 'main' | 'bonus';
  promoPercentage?: number;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail?: string;
  userCode?: string;
  userName: string;
  userPhone: string;
  amount: number;
  fullName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  method?: 'IMPS' | 'CRYPTO' | string;
  bankName?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
  cryptoAmount?: number;
  date: string;
  createdAt?: string | number;
  status: TransactionStatus;
  rejectReason?: string;
}

export interface LotteryScheduleSlot {
  id: string; // e.g. "SCH-4D-20260811-01"
  lotteryId: string; // e.g. "4d-express", "bumper-jackpot", "speed-1m", "supercar", "daily-mega"
  lotteryTitle: string;
  category: string; // '4D Express' | 'Bumper' | 'Speed 1m' | 'Daily Mega' | 'Three Super Card' | custom
  slotName: string;
  drawTimeLabel: string;
  scheduledTimestamp: number; // Unix timestamp in ms
  resultGridsCount: number; // Number of result grids/winning numbers (1 to 10)
  winningResult?: (number | string)[]; // Pre-selected winning result by admin
  prizePool: number;
  ticketPrice: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  publishedAt?: string;
  createdAt: string;
  createdByAdmin: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  timestamp: string;
  createdAt: number;
}

export interface LotteryDraw {
  id: string;
  title: string;
  subtitle: string;
  category: 'Bumper' | 'Speed 1m' | 'Daily Mega' | '4D Express';
  ticketPrice: number;
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  endTime: number; // Unix timestamp in ms
  drawDurationMs: number; // duration for auto-reset
  winningNumbers?: number[]; // array of winning digits/numbers
  status: 'upcoming' | 'live' | 'completed';
  totalTicketsSold: number;
  bannerGradient: string;
  badgeText: string;
}

export interface LotteryDrawResult {
  id: string;
  drawId: string;
  title: string;
  category: string;
  winningNumbers: number[];
  firstPrize: number;
  secondPrize?: number;
  thirdPrize?: number;
  date: string;
  createdAt?: string | number;
  totalWinners?: number;
  totalPayout?: number;
  declaredBy?: string;
}

export interface PurchasedTicket {
  id: string;
  batchId?: string;
  userId: string;
  drawId: string;
  drawTitle: string;
  ticketNumber: string; // e.g. "482910" or [4,8,2,9,1,0] or "CAR-RED-8932"
  selectedNumbers: (number | string)[];
  price: number;
  purchaseDate: string;
  purchaseTime?: string;
  drawTime?: number | string;
  drawDate?: string;
  status: TicketStatus;
  wonAmount?: number;
  matchCount?: number;
  selectedCar?: 'red' | 'black' | 'yellow';
  category?: string;
  createdAt?: string;
  slotNum?: number;
  slotNumber?: number;
  issueId?: string;
  walletType?: 'main' | 'bonus';
}

export type SuperCarColor = 'red' | 'black' | 'yellow';

export interface SuperCarInfo {
  id: SuperCarColor;
  name: string;
  tagline: string;
  image: string;
  accentColor: string;
  glowColor: string;
  badge: string;
  topSpeed: string;
  acceleration: string;
}

export interface SuperCarDrawIssue {
  id: string; // e.g. "CAR-20260809-14"
  issueId: string;
  drawIndex?: number; // 1 to 28
  startTime?: number;
  endTime?: number;
  drawTime?: string;
  status: 'active' | 'shuffling' | 'completed' | 'closed';
  winningCar?: SuperCarColor;
  winnerTicket?: string;
  winnerName?: string;
  prizeText?: string;
  ticketPrice?: number;
  prizeMultiplier?: number;
  totalTicketsSold?: number;
  totalBets?: {
    red: number;
    black: number;
    yellow: number;
  };
  createdAt?: number;
}

export interface SuperCarConfig {
  enabled: boolean;
  ticketPrice: number;
  bonusTicketPrice?: number;
  allowBonusPurchase?: boolean;
  bonusOnly?: boolean; // Strictly allow only bonus balance for purchases
  houseEdgePercent?: number; // House Edge (0.0% to 99.5%)
  houseEdge?: number; // Alias for houseEdgePercent
  prizeMultiplier: number;
  resultMode: 'auto' | 'manual';
  manualWinner?: SuperCarColor;
  operatingStartHour: number; // 0 for 24/7
  operatingEndHour: number;   // 24 for 24/7
  is24x7?: boolean;           // 24x7 operation flag
  drawIntervalMinutes: number; // 10 minutes
  bettingCloseSeconds?: number; // 30 seconds before draw
  carImages?: {
    red?: string;
    black?: string;
    yellow?: string;
  };
  carPrices?: {
    red?: number;
    black?: number;
    yellow?: number;
  };
  bonusCarPrices?: {
    red?: number;
    black?: number;
    yellow?: number;
  };
  carMultipliers?: {
    red?: number;
    black?: number;
    yellow?: number;
  };
  lockedSlots?: number[]; // array of slot indices locked by admin
  manualSlotWinners?: Record<number | string, SuperCarColor>; // manual winner per slot index 1..144 or issueId
}

export interface NotificationItem {
  id: string;
  userId: string;
  targetUserId?: string;
  canonicalUid?: string;
  targetUserName?: string;
  title: string;
  message: string;
  type: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'system' | 'app_update' | 'bonus';
  date: string;
  read: boolean;
  createdAt?: number | string;
  expiresAt?: number;
  isCritical?: boolean;
  isGlobal?: boolean;
  priority?: string;
  channels?: string[];
  userEmail?: string;
  deletedForUserIds?: string[];
  actionType?: 
    | 'deposit'
    | 'withdrawal'
    | 'lottery'
    | 'supercar'
    | 'crash'
    | 'roulette'
    | 'dragon_tiger'
    | 'andar_bahar'
    | 'lucky_wheel'
    | 'offers'
    | 'tickets'
    | 'results'
    | 'history'
    | 'profile'
    | 'support'
    | 'settings'
    | 'app_update';
  actionTargetId?: string;
  actionUrl?: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingDepositsCount: number;
  pendingWithdrawalsCount: number;
  totalRevenue: number;
  totalPayouts: number;
}

export interface PaymentConfig {
  upiId: string;
  qrCodeUrl: string;
  accountName: string;
  minDeposit: number;
  maxDeposit: number;
  instructions: string;
  // Crypto Configuration
  cryptoEnabled?: boolean;
  minCryptoDeposit?: number; // e.g. 10 USDT
  maxCryptoDeposit?: number; // e.g. 10000 USDT
  usdtToInrRate?: number; // e.g. 92 (1 USDT = ₹92)
  usdtTrc20Address?: string;
  usdtTrc20QrUrl?: string;
  usdtBep20Address?: string;
  usdtBep20QrUrl?: string;
  usdtErc20Address?: string;
  usdtErc20QrUrl?: string;
  btcAddress?: string;
  btcQrUrl?: string;
  ethAddress?: string;
  ethQrUrl?: string;
  cryptoInstructions?: string;
  updatedAt?: string;
}

export type RouletteRtpMode = 
  | 'european_standard' 
  | 'dynamic_rtp' 
  | 'house_protect' 
  | 'house_protection'
  | 'high_rtp_promo'
  | 'fair_rng'
  | 'manual_next_number';

export interface RouletteConfig {
  rtpPercentage: number; // e.g. 97.3, 90, 85, 80, 70
  houseEdgePercentage: number; // e.g. 2.7, 10, 15, 20, 30
  rtpMode: RouletteRtpMode;
  manualNextNumber?: number | null; // 0 to 36
  manualNextNumberActive?: boolean;
  manualLightningNumbers?: { number: number; multiplier: number }[] | null;
  isManualLightningOverride?: boolean;
  minBet: number;
  maxBet: number;
  maxTotalPayoutLimit?: number;
  isRouletteEnabled: boolean;
  preventOppositeBets?: boolean;
  lastUpdated?: string;
  updatedBy?: string;
}

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: CardRank;
  value: number; // 1 to 13 (A=1, 2=2, ..., K=13)
  color: 'red' | 'black';
}

export type AndarBaharSide = 'andar' | 'bahar';
export type SuperAndarBaharRange = 
  | '1-5' 
  | '6-10' 
  | '11-15' 
  | '16-20' 
  | '21-25' 
  | '26-30' 
  | '31-35' 
  | '36-40' 
  | '41-45' 
  | '46-49';

export type AndarBaharBetTarget = AndarBaharSide | SuperAndarBaharRange;

export interface AndarBaharRound {
  id: string; // e.g. "AB-20260814-1001"
  roundNumber: number;
  jokerCard: PlayingCard;
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide?: AndarBaharSide;
  winningCard?: PlayingCard;
  totalCardsDealt: number;
  status: 'betting' | 'dealing' | 'completed' | 'cancelled';
  startTime: number;
  endTime?: number;
  totalBetsAndar: number;
  totalBetsBahar: number;
  totalPayout: number;
  createdAt: string;
}

export interface AndarBaharBet {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  side: AndarBaharSide;
  amount: number;
  payoutMultiplier: number;
  wonAmount?: number;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
  timestamp: number;
}

export type AndarBaharRtpMode = 'fair_rng' | 'house_protect' | 'manual_force_winner';

export interface AndarBaharConfig {
  isEnabled: boolean;
  minBet: number;
  maxBet: number;
  bettingDurationSeconds: number; // e.g. 15 to 30
  dealingSpeedMs: number; // e.g. 400 to 1000
  andarMultiplier: number; // e.g. 1.95 (0.95:1)
  baharMultiplier: number; // e.g. 1.95 or 2.0
  chipValues?: number[];
  liveBetsAndar?: number;
  liveBetsBahar?: number;
  rtpPercentage?: number;
  houseEdgePercentage?: number;
  rtpMode: AndarBaharRtpMode;
  manualForceWinner?: AndarBaharSide | 'random';
  manualJokerRank?: CardRank | 'random';
  preventBothAndarBaharBet?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export type DragonTigerSide = 'dragon' | 'tiger' | 'tie' | 'suited_tie';

export interface DragonTigerRound {
  id: string; // e.g. "DT-20260814-1001"
  roundNumber: number;
  dragonCard?: PlayingCard;
  tigerCard?: PlayingCard;
  winningSide?: DragonTigerSide;
  isSuitedTie?: boolean;
  status: 'betting' | 'dealing' | 'completed' | 'cancelled';
  startTime: number;
  endTime?: number;
  totalBetsDragon: number;
  totalBetsTiger: number;
  totalBetsTie: number;
  totalBetsSuitedTie?: number;
  totalPayout: number;
  createdAt: string;
}

export interface DragonTigerBet {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  side: DragonTigerSide;
  amount: number;
  payoutMultiplier: number;
  wonAmount?: number;
  status: 'pending' | 'won' | 'lost' | 'tie_push';
  createdAt: string;
  timestamp: number;
}

export type DragonTigerRtpMode = 'fair_rng' | 'house_protect' | 'manual_force_winner';

export interface DragonTigerConfig {
  isEnabled: boolean;
  minBet: number;
  maxBet: number;
  bettingDurationSeconds: number; // e.g. 12 to 30
  dragonMultiplier: number; // e.g. 2.0 (1:1)
  tigerMultiplier: number; // e.g. 2.0 (1:1)
  tieMultiplier: number; // e.g. 11.0 or 12.0 (11:1)
  suitedTieMultiplier?: number; // e.g. 50.0 or 51.0 (50:1)
  rtpPercentage?: number;
  houseEdgePercentage?: number;
  rtpMode: DragonTigerRtpMode;
  manualForceWinner?: DragonTigerSide | 'random';
  manualDragonRank?: CardRank | 'random';
  manualTigerRank?: CardRank | 'random';
  dealerVoiceEnabled?: boolean;
  simulatedPoolScale?: number;
  preventBothDragonTigerBet?: boolean; // Restricts placing bets on both Dragon and Tiger in the same round
  allowOppositeBetting?: boolean;
  chipValues?: number[]; // Customizable chips array, e.g. [10, 50, 100, 500, 1000, 5000, 25000]
  realUserBets?: {
    dragon: number;
    tiger: number;
    tie: number;
    suitedTie: number;
  };
  liveBetsDragon?: number;
  liveBetsTiger?: number;
  liveBetsTie?: number;
  liveBetsSuitedTie?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface LiveGameRtpSettings {
  id: 'roulette' | 'andar_bahar' | 'dragon_tiger' | 'crash' | 'global';
  gameName: string;
  rtpPercentage: number; // e.g. 97.3, 96.5, 96.8, 95.0
  houseEdgePercentage: number; // 100 - rtpPercentage or custom set
  rtpMode: 'fair_rng' | 'house_protect' | 'high_house_edge' | 'custom_rtp' | 'manual_force';
  manualForceTarget?: string;
  manualForceActive?: boolean;
  minBet: number;
  maxBet: number;
  isEnabled: boolean;
  targetProfitMargin?: number;
  multiplierPrimary?: number;
  multiplierSecondary?: number;
  multiplierSpecial?: number;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CrashGameConfig {
  isEnabled: boolean;
  minBet: number; // e.g. 10
  maxBet: number; // e.g. 50000
  rtpPercentage: number; // 0 to 99 (Manual Admin RTP slider/input)
  houseEdgePercentage: number; // 100 - rtpPercentage
  maxMultiplierCap: number; // e.g. 1000 or 5000
  minCrashMultiplier: number; // e.g. 1.00
  roundCooldownSeconds: number; // e.g. 5
  manualForceNextMultiplier?: number | null; // Admin forced multiplier for next round
  simulatedBotsEnabled: boolean; // Toggle fake live players betting
  speedMultiplier: number; // 1.0 standard flight speed
  updatedAt?: string;
  updatedBy?: string;
}

export interface CrashRound {
  id: string; // e.g. "CRASH-20260819-012"
  roundNumber: number;
  crashMultiplier: number; // The multiplier at which the plane flies away
  status: 'waiting' | 'flying' | 'crashed';
  startTime: number;
  crashedAt?: number;
  totalBetsCount: number;
  totalBetsAmount: number;
  totalPayoutAmount: number;
  createdAt: string;
}

export interface CrashBet {
  id: string;
  roundId: string;
  panel: 1 | 2;
  userId: string;
  userName: string;
  userPhone?: string;
  avatarUrl?: string;
  amount: number;
  autoCashOutAt?: number | null; // e.g. 2.00x
  cashedOutMultiplier?: number;
  wonAmount?: number;
  status: 'active' | 'cashed_out' | 'crashed';
  createdAt: string;
  timestamp: number;
}

export interface CrashCommunityBet {
  id: string;
  userName: string;
  avatarUrl: string;
  betAmount: number;
  cashOutMultiplier?: number;
  winAmount?: number;
  status: 'betting' | 'cashed_out' | 'crashed';
  autoCashOutAt?: number;
}

export interface CrashChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  text: string;
  timestamp: number;
  isWinHighlight?: boolean;
  winMultiplier?: number;
  winAmount?: number;
}

export interface GameControlItem {
  id: string;
  name: string;
  category: 'live_casino' | 'special_draw' | 'lottery';
  icon: string;
  badge: string;
  isEnabled: boolean; // true = visible & playable on user UI, false = in maintenance / hidden
  maintenanceMessage?: string;
  lastUpdated?: string;
  updatedBy?: string;
}

export type AllGameStatuses = Record<string, GameControlItem>;

export const DEFAULT_GAME_STATUSES: AllGameStatuses = {
  crash: {
    id: 'crash',
    name: 'Aviator Crash',
    category: 'live_casino',
    icon: '✈️',
    badge: 'UP TO 500X',
    isEnabled: true,
    maintenanceMessage: 'Aviator Crash is temporarily under scheduled maintenance. Will be back shortly!',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  dragon_tiger: {
    id: 'dragon_tiger',
    name: 'Dragon Tiger Live',
    category: 'live_casino',
    icon: '🐉',
    badge: 'LIVE HD',
    isEnabled: true,
    maintenanceMessage: 'Dragon Tiger Live Casino is under maintenance. Please try other live tables.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  andar_bahar: {
    id: 'andar_bahar',
    name: 'Andar Bahar Live',
    category: 'live_casino',
    icon: '🎴',
    badge: 'FAIR RNG',
    isEnabled: true,
    maintenanceMessage: 'Andar Bahar is under scheduled maintenance.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  roulette: {
    id: 'roulette',
    name: 'Hindi Lightning Roulette',
    category: 'live_casino',
    icon: '⚡',
    badge: '500X MULTIPLIER',
    isEnabled: true,
    maintenanceMessage: 'Lightning Roulette is undergoing server maintenance.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  supercar: {
    id: 'supercar',
    name: 'Three Super Car Draw',
    category: 'special_draw',
    icon: '🏎️',
    badge: '3.0X RETURN',
    isEnabled: true,
    maintenanceMessage: 'Three Super Car Draw is currently in maintenance mode.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  lucky_wheel: {
    id: 'lucky_wheel',
    name: 'Daily Lucky Spin Wheel',
    category: 'special_draw',
    icon: '🎡',
    badge: 'DAILY BONUS',
    isEnabled: true,
    maintenanceMessage: 'Lucky Spin Wheel is currently updating prize segments.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  lottery_bumper: {
    id: 'lottery_bumper',
    name: 'Bumper Lakhpati Draw',
    category: 'lottery',
    icon: '🔥',
    badge: '₹1,00,000 PRIZE',
    isEnabled: true,
    maintenanceMessage: 'Bumper Lakhpati is preparing for the next seasonal draw.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  lottery_speed: {
    id: 'lottery_speed',
    name: '777 Speed Express',
    category: 'lottery',
    icon: '⚡',
    badge: '3-MIN SPEED',
    isEnabled: true,
    maintenanceMessage: '777 Speed Express is currently paused for maintenance.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  lottery_mega: {
    id: 'lottery_mega',
    name: 'Mega Crorepati Jackpot',
    category: 'lottery',
    icon: '👑',
    badge: '₹10,00,000 GRAND',
    isEnabled: true,
    maintenanceMessage: 'Mega Crorepati Jackpot is under scheduled maintenance.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  },
  lottery_4d: {
    id: 'lottery_4d',
    name: '3D/4D Lucky Digit Pick',
    category: 'lottery',
    icon: '🎯',
    badge: '500X WIN',
    isEnabled: true,
    maintenanceMessage: '3D/4D Lucky Digit Pick is under maintenance.',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  }
};

export interface LiveUserActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  type: 'login' | 'bet' | 'win' | 'deposit' | 'withdraw';
  gameName?: string;
  betAmount?: number;
  winAmount?: number;
  details: string;
  timestamp: number;
  dateStr: string;
  metadata?: Record<string, any>;
}

export interface OnlineUserPresence {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  balance?: number;
  lastSeen: number;
  status: 'online' | 'betting' | 'idle';
  currentGame?: string;
  device?: string;
}

export interface SupportAgentConfig {
  name: string;
  avatarUrl: string;
  title: string;
  isOnline: boolean;
  welcomeMessage?: string;
  responseSpeedText?: string;
  statusNote?: string;
  updatedAt?: number;
}

export interface SupportChatMessage {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  senderRole: 'user' | 'admin';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderTitle?: string;
  text: string;
  read: boolean;
  timestamp: string;
  createdAt: number;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'file';
  attachmentSize?: string;
}

export interface SupportChatThread {
  id: string; // matches userId
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  lastMessage: string;
  lastSenderRole: 'user' | 'admin';
  lastMessageTime: string;
  lastMessageTimestamp: number;
  unreadAdminCount: number;
  unreadUserCount: number;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  updatedAt: number;
  adminTyping?: boolean;
  adminTypingTimestamp?: number;
  userTyping?: boolean;
  userTypingTimestamp?: number;
}

export interface SystemErrorLog {
  id: string;
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  source: 'client_runtime' | 'react_boundary' | 'promise_rejection' | 'admin_panel' | 'network' | 'firestore' | 'manual';
  severity: 'critical' | 'error' | 'warning' | 'info';
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  createdAt: number;
  resolved: boolean;
  resolvedAt?: string;
  adminNotes?: string;
}

export type SmtpChannelPurpose = 'all' | 'otp' | 'deposit' | 'withdrawal' | 'security';

export interface SmtpAccount {
  id: string;
  email: string;
  senderName: string;
  appPasswordEncrypted: string;
  host: string;
  port: number;
  isPrimaryOtpSender: boolean;
  isDepositSender?: boolean;
  isWithdrawalSender?: boolean;
  isSecuritySender?: boolean;
  channelPurpose?: SmtpChannelPurpose;
  createdAt: string;
  lastTestedAt?: string;
  status: 'Active' | 'Inactive' | 'Testing';
  description?: string;
}

export interface SecurityNoticeLog {
  id: string;
  userId?: string;
  userEmail: string;
  userName?: string;
  subject: string;
  message: string;
  noticeType: 'security_alert' | 'kyc_required' | 'suspicious_login' | 'fair_play' | 'account_suspended' | 'general_notice';
  urgency: 'normal' | 'high' | 'critical';
  senderEmail: string;
  senderName: string;
  sentAt: string;
  timestamp: number;
  status: 'sent' | 'failed';
  adminId?: string;
  adminName?: string;
}

export type EmailTemplateCategory = 'deposit' | 'withdrawal' | 'otp' | 'security' | 'bonus';

export interface EmailTemplateOption {
  id: string;
  name: string;
  description: string;
  category: EmailTemplateCategory;
  themeName: string;
  accentColor: string;
  previewGradient: string;
  features: string[];
}

export interface EmailActivityLog {
  id: string;
  recipientEmail: string;
  recipientName?: string;
  category: EmailTemplateCategory;
  templateId?: string;
  subject: string;
  status: 'sent' | 'delivered' | 'failed' | 'resent';
  timestamp: number;
  dateStr: string;
  amount?: number;
  method?: string;
  utr?: string;
  accountEnding?: string;
  reason?: string;
  bonusTitle?: string;
  isResend?: boolean;
  errorMessage?: string;
  htmlBody?: string;
  fromSender?: string;
  resendCount?: number;
}

export interface SmtpTemplateSettings {
  activeDepositTemplate: string;
  activeWithdrawalTemplate: string;
  activeOtpTemplate: string;
  activeBonusTemplate: string;
  activeSecurityTemplate: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerCode: string;
  referrerName: string;
  referrerEmail?: string;
  refereeId: string;
  refereeName: string;
  refereeEmail: string;
  refereePhone?: string;
  createdAt: string;
  timestamp: number;
  status: 'pending_deposit' | 'completed' | 'cancelled';
  minDepositRequired: number;
  bonusAmount: number;
  totalDepositedByReferee: number;
  qualifiedDepositId?: string;
  creditedAt?: string;
}

export interface ReferralSettings {
  enabled: boolean;
  bonusAmount: number; // default 100
  minDepositAmount: number; // default 1000
  refereeWelcomeBonus: number; // default 0
  updatedAt?: string;
  updatedBy?: string;
}

export type PromoCodeType = 'instant_reward' | 'deposit_bonus';
export type PromoTargetWallet = 'main' | 'bonus';

export interface PromoCode {
  id: string;
  code: string; // Uppercase unique code, e.g. "BONUS500", "DEPOSIT50"
  title: string; // e.g. "VIP Welcome Cash", "50% Extra Deposit"
  description?: string;
  type: PromoCodeType; // 'instant_reward' | 'deposit_bonus'
  
  // Instant reward fields (direct wallet credit)
  rewardAmount?: number; // Exact amount (e.g. ₹100, ₹500)
  
  // Deposit bonus fields (credited on deposit)
  bonusPercentage?: number; // e.g. 10%, 25%, 50%, 100%
  flatBonusAmount?: number; // Flat extra on deposit
  minDepositAmount?: number; // Minimum deposit required (e.g. ₹200, ₹500)
  maxBonusLimit?: number; // Max bonus cap (e.g. ₹5,000)
  
  // Target Wallet
  targetWallet: PromoTargetWallet; // 'main' (Main Balance) | 'bonus' (Bonus Balance)
  
  // Usage Control
  maxUsesPerUser: number; // How many times a single user can use it (default: 1)
  maxTotalUses?: number; // Total global uses allowed (0 or undefined = unlimited)
  usedCount: number; // How many times it has been redeemed
  
  // Status & Expiry
  isActive: boolean;
  expiresAt?: string; // ISO date string or YYYY-MM-DD
  createdAt: string | number;
  updatedAt?: string | number;
  createdBy?: string;
}

export interface PromoRedemption {
  id: string;
  codeId: string;
  code: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userCode?: string;
  type: PromoCodeType;
  amountCredited: number;
  targetWallet: PromoTargetWallet;
  redeemedAt: string | number;
  depositId?: string;
  depositAmount?: number;
}




