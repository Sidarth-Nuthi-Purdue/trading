// Asset types
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  class: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easy_to_borrow: boolean;
  price?: number;
  change?: number;
}

// Order types
export interface Order {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  asset_id: string;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
  limit_price?: string;
  stop_price?: string;
  status: 'new' | 'filled' | 'partially_filled' | 'canceled' | 'expired' | 'rejected' | 'pending';
}

// Position types
export interface Position {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: string;
  qty: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

// Account types
export interface Account {
  id: string;
  cash: number;
  portfolio_value: number;
  buying_power: number;
  equity: number;
  pnl: number;
  pnl_percentage: number;
  currency: string;
  status: string;
  created_at: string;
  trading_blocked: boolean;
  pattern_day_trader: boolean;
}

// Bar/Candle types for charts
export interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Trade types (extended from Order with additional fields for our app)
export interface Trade extends Omit<Order, 'id'> {
  id: string;
  pnl?: number;
  close_price?: number;
  user_id?: string;
  competition_id?: string | null;
}

// Competition types
export interface Competition {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  prize_amount: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  created_by: string;
  participants: Participant[];
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  user_id: string;
  user_name: string;
  starting_balance: number;
  current_balance: number;
  pnl: number;
  pnl_percentage: number;
  rank: number;
  status: 'active' | 'disqualified';
}

// User settings
export interface UserSettings {
  id: string;
  user_id: string;
  starting_balance: number;
  max_trade_amount: number;
  min_trade_amount: number;
  allow_short_selling: boolean;
  allow_leverage: boolean;
  theme: 'light' | 'dark';
  created_at: string;
  updated_at: string;
}

// User profile
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  balance: number;
  total_pnl: number;
  total_pnl_percentage: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  created_at: string;
  updated_at: string;
  is_creator: boolean;
} 