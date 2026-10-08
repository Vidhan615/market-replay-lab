export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Fundamentals = {
  revenue: number;
  profit: number;
  equity: number;
  debt: number;
  shares: number;
  growth: number;
  dividend: number;
  sectorPE: number;
};
export type Asset = {
  symbol: string;
  name: string;
  sector: string;
  color: string;
  bars: Bar[];
  fundamentals: Fundamentals | null;
};
export type Scenario = "balanced" | "momentum" | "volatile";
export type Side = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop-limit";
export type OrderStatus =
  "pending" | "triggered" | "filled" | "cancelled" | "rejected" | "expired";
export type OrderInput = {
  symbol: string;
  side: Side;
  type: OrderType;
  quantity: number;
  limit?: number;
  stop?: number;
  stopLoss?: number;
  takeProfit?: number;
  tif: "GTC" | "DAY";
};
export type Order = OrderInput & {
  id: string;
  created: number;
  status: OrderStatus;
  triggeredAt?: number;
  filledAt?: number;
  fillPrice?: number;
  message?: string;
  group?: string;
  parent?: string;
};
export type Position = { quantity: number; averageCost: number };
export type Fill = {
  id: string;
  orderId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  fee: number;
  date: string;
  cursor: number;
  realised: number | null;
};
export type EquityPoint = { cursor: number; equity: number };
export type Account = {
  cursor: number;
  cash: number;
  positions: Record<string, Position>;
  orders: Order[];
  fills: Fill[];
  realisedPnl: number;
  totalFees: number;
  equityHistory: EquityPoint[];
  sequence: number;
};
export type JournalEntry = {
  id: string;
  date: string;
  symbol: string;
  thesis: string;
  lesson: string;
  mood: string;
  tags: string;
};
export type Settings = {
  feeBps: number;
  slippageBps: number;
  riskPercent: number;
};
export type Session = {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  seed: number;
  scenario: Scenario;
  initialCapital: number;
  startCursor: number;
  assets: Asset[];
  account: Account;
  history: Account[];
  selected: string;
  settings: Settings;
  journal: JournalEntry[];
  completedLessons: string[];
  quizAnswers: Record<string, number>;
  watchlist: string[];
};
