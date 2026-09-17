export interface IndianBank {
  id: string;
  name: string;
  code: string;
  isPopular?: boolean;
}

export const POPULAR_INDIAN_BANKS: IndianBank[] = [
  { id: 'sbi', name: 'State Bank of India (SBI)', code: 'SBIN', isPopular: true },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC', isPopular: true },
  { id: 'icici', name: 'ICICI Bank', code: 'ICIC', isPopular: true },
  { id: 'pnb', name: 'Punjab National Bank (PNB)', code: 'PUNB', isPopular: true },
  { id: 'axis', name: 'Axis Bank', code: 'UTIB', isPopular: true },
  { id: 'bob', name: 'Bank of Baroda (BOB)', code: 'BARB', isPopular: true },
  { id: 'kotak', name: 'Kotak Mahindra Bank', code: 'KKBK', isPopular: true },
  { id: 'canara', name: 'Canara Bank', code: 'CNRB', isPopular: true },
  { id: 'union', name: 'Union Bank of India', code: 'UBIN', isPopular: true },
  { id: 'paytm', name: 'Paytm Payments Bank', code: 'PYTM', isPopular: true }
];

export const ALL_INDIAN_BANKS: IndianBank[] = [
  ...POPULAR_INDIAN_BANKS,
  { id: 'indusind', name: 'IndusInd Bank', code: 'INDB' },
  { id: 'boi', name: 'Bank of India', code: 'BKID' },
  { id: 'cbi', name: 'Central Bank of India', code: 'CBIN' },
  { id: 'indian_bank', name: 'Indian Bank', code: 'IDIB' },
  { id: 'iob', name: 'Indian Overseas Bank', code: 'IOBA' },
  { id: 'uco', name: 'UCO Bank', code: 'UCBA' },
  { id: 'bom', name: 'Bank of Maharashtra', code: 'MAHB' },
  { id: 'psb', name: 'Punjab & Sind Bank', code: 'PSIB' },
  { id: 'federal', name: 'Federal Bank', code: 'FDRL' },
  { id: 'idbi', name: 'IDBI Bank', code: 'IBKL' },
  { id: 'yes', name: 'Yes Bank', code: 'YESB' },
  { id: 'rbl', name: 'RBL Bank', code: 'RATN' },
  { id: 'bandhan', name: 'Bandhan Bank', code: 'BDBL' },
  { id: 'idfc', name: 'IDFC FIRST Bank', code: 'IDFB' },
  { id: 'south_indian', name: 'South Indian Bank', code: 'SIBL' },
  { id: 'karur', name: 'Karur Vysya Bank', code: 'KVBL' },
  { id: 'city_union', name: 'City Union Bank', code: 'CIUB' },
  { id: 'karnataka', name: 'Karnataka Bank', code: 'KARB' },
  { id: 'tmb', name: 'Tamilnad Mercantile Bank', code: 'TMBL' },
  { id: 'jk', name: 'Jammu & Kashmir Bank', code: 'JAKA' },
  { id: 'au_small', name: 'AU Small Finance Bank', code: 'AUBL' },
  { id: 'equitas', name: 'Equitas Small Finance Bank', code: 'ESFB' },
  { id: 'ujjivan', name: 'Ujjivan Small Finance Bank', code: 'UJVN' },
  { id: 'jana', name: 'Jana Small Finance Bank', code: 'JSFB' },
  { id: 'suryoday', name: 'Suryoday Small Finance Bank', code: 'SURY' },
  { id: 'esaf', name: 'ESAF Small Finance Bank', code: 'ESAF' },
  { id: 'utkarsh', name: 'Utkarsh Small Finance Bank', code: 'UTKS' },
  { id: 'airtel', name: 'Airtel Payments Bank', code: 'AIRP' },
  { id: 'ippb', name: 'India Post Payments Bank (IPPB)', code: 'IPOS' },
  { id: 'fino', name: 'Fino Payments Bank', code: 'FINO' },
  { id: 'jio', name: 'Jio Payments Bank', code: 'JIOP' },
  { id: 'dbs', name: 'DBS Bank India', code: 'DBSS' },
  { id: 'sc', name: 'Standard Chartered Bank', code: 'SCBL' },
  { id: 'hsbc', name: 'HSBC India', code: 'HSBC' },
  { id: 'citi', name: 'Citibank India', code: 'CITI' }
];

export interface CryptoNetworkOption {
  id: string;
  name: string;
  network: string;
  symbol: string;
  icon: string;
  minUsdt: number;
  rateInr: number; // e.g. 1 USDT = ~90 INR
  placeholder: string;
  tag?: string;
}

export const CRYPTO_NETWORKS: CryptoNetworkOption[] = [
  {
    id: 'usdt_trc20',
    name: 'Tether USD (TRC20)',
    network: 'TRON TRC-20 (Lowest Network Gas Fee & Fast)',
    symbol: 'USDT',
    icon: '₮',
    minUsdt: 10,
    rateInr: 92,
    placeholder: 'T... (Starts with uppercase T, 34 characters)',
    tag: 'RECOMMENDED'
  },
  {
    id: 'usdt_bep20',
    name: 'Tether USD (BEP20)',
    network: 'BNB Smart Chain BEP-20',
    symbol: 'USDT',
    icon: '₮',
    minUsdt: 10,
    rateInr: 92,
    placeholder: '0x... (42 characters hex address)',
    tag: 'FAST & CHEAP'
  },
  {
    id: 'usdt_erc20',
    name: 'Tether USD (ERC20)',
    network: 'Ethereum ERC-20 Network',
    symbol: 'USDT',
    icon: '₮',
    minUsdt: 25,
    rateInr: 92,
    placeholder: '0x... (42 characters Ethereum address)'
  },
  {
    id: 'btc',
    name: 'Bitcoin (BTC)',
    network: 'Bitcoin Native Blockchain',
    symbol: 'BTC',
    icon: '₿',
    minUsdt: 30,
    rateInr: 8800000,
    placeholder: '1... / 3... / bc1... (BTC address)'
  },
  {
    id: 'eth',
    name: 'Ethereum (ETH)',
    network: 'Ethereum Mainnet',
    symbol: 'ETH',
    icon: 'Ξ',
    minUsdt: 25,
    rateInr: 285000,
    placeholder: '0x... (ERC20 address)'
  },
  {
    id: 'trx',
    name: 'TRON (TRX)',
    network: 'TRON Network',
    symbol: 'TRX',
    icon: '⚡',
    minUsdt: 10,
    rateInr: 21,
    placeholder: 'T... (TRON address)'
  }
];
