'use client';

// Alpaca Trading API Integration
// This file provides utilities for interacting with a single Alpaca paper trading account

import axios from 'axios';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// Interface definitions for Alpaca API responses
interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  regt_buying_power: string;
  daytrading_buying_power: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  last_maintenance_margin: string;
  sma: string;
  status_timestamp: string;
}

interface Position {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  asset_marginable: boolean;
  qty: string;
  avg_entry_price: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

interface Order {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional: string | null;
  qty: string | null;
  filled_qty: string;
  filled_avg_price: string | null;
  order_class: string;
  order_type: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: Order[] | null;
  trail_percent: string | null;
  trail_price: string | null;
  hwm: string | null;
}

interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: any[] | null;
}

// API configuration
// Use the correct environment variable names as defined in .env.local
const ALPACA_API_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET || '';
const ALPACA_API_BASE_URL = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets/v2';
const ALPACA_DATA_BASE_URL = process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets';

// Implement a request queue and throttling to prevent rate limiting
let requestQueue: (() => Promise<any>)[] = [];
let processingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 250; // Minimum time between requests (ms)

// Process the request queue with throttling
async function processQueue() {
  if (processingQueue || requestQueue.length === 0) {
    return;
  }
  
  processingQueue = true;
  
  try {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      // Wait before processing next request
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      lastRequestTime = Date.now();
      await nextRequest();
    }
  } finally {
    processingQueue = false;
    
    // Process next request if any
    if (requestQueue.length > 0) {
      processQueue();
    }
  }
}

// Add a request to the queue
function enqueueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    // Start processing the queue if not already
    if (!processingQueue) {
      processQueue();
    }
  });
}

// Create Alpaca API client
const createAlpacaClient = () => {
  // Create axios instance with default config
  const client = axios.create({
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      'Content-Type': 'application/json'
    }
  });
  
  // Add response interceptor for error handling
  client.interceptors.response.use(
    response => response,
    error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Alpaca API error:', error.response.status, error.response.data);
        return Promise.reject(new Error(
          error.response.data.message || 
          `Alpaca API error: ${error.response.status}`
        ));
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Alpaca API no response:', error.request);
        return Promise.reject(new Error('No response from Alpaca API. Please check your network connection.'));
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Alpaca API request error:', error.message);
        return Promise.reject(new Error(`Error setting up request: ${error.message}`));
      }
    }
  );
  
  return client;
};

// Alpaca API methods
export const alpacaApi = {
  // Get account information
  getAccount: async (): Promise<AlpacaAccount> => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_API_BASE_URL}/account`);
      return response.data;
    });
  },
  
  // Get open positions
  getPositions: async () => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_API_BASE_URL}/positions`);
      return response.data;
    });
  },
  
  // Get position for a specific symbol
  getPosition: async (symbol: string) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_API_BASE_URL}/positions/${symbol}`);
      return response.data;
    });
  },
  
  // Get orders
  getOrders: async (status = 'open', limit = 100, after?: string, until?: string) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      let url = `${ALPACA_API_BASE_URL}/orders?status=${status}&limit=${limit}`;
      
      if (after) url += `&after=${after}`;
      if (until) url += `&until=${until}`;
      
      const response = await client.get(url);
      return response.data;
    });
  },
  
  // Place order
  placeOrder: async (
    symbol: string,
    qty: number,
    side: 'buy' | 'sell',
    type: 'market' | 'limit' | 'stop' | 'stop_limit',
    limitPrice?: number,
    stopPrice?: number,
    timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok' = 'day'
  ): Promise<AlpacaOrder> => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      
      // Create order payload
      const orderData: Record<string, any> = {
        symbol,
        qty: qty.toString(),
        side,
        type,
        time_in_force: timeInForce
      };
      
      // Add limit price if provided
      if (type === 'limit' || type === 'stop_limit') {
        if (!limitPrice) {
          throw new Error('Limit price is required for limit orders');
        }
        orderData.limit_price = limitPrice.toString();
      }
      
      // Add stop price if provided
      if (type === 'stop' || type === 'stop_limit') {
        if (!stopPrice) {
          throw new Error('Stop price is required for stop orders');
        }
        orderData.stop_price = stopPrice.toString();
      }
      
      const response = await client.post(`${ALPACA_API_BASE_URL}/orders`, orderData);
      return response.data;
    });
  },
  
  // Cancel order
  cancelOrder: async (orderId: string): Promise<void> => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      await client.delete(`${ALPACA_API_BASE_URL}/orders/${orderId}`);
    });
  },
  
  // Get market data
  getBars: async (
    symbol: string,
    timeframe = '1Day',
    limit = 100,
    start?: string,
    end?: string
  ) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      let url = `${ALPACA_DATA_BASE_URL}/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}`;
      
      if (start) url += `&start=${start}`;
      if (end) url += `&end=${end}`;
      
      const response = await client.get(url);
      return response.data;
    });
  },
  
  // Get latest quote
  getLatestQuote: async (symbol: string) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_DATA_BASE_URL}/v2/stocks/${symbol}/quotes/latest`);
      return response.data;
    });
  },
  
  // Get latest trade
  getLatestTrade: async (symbol: string) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_DATA_BASE_URL}/v2/stocks/${symbol}/trades/latest`);
      return response.data;
    });
  },
  
  // Get recent trades
  getTrades: async (symbol: string, limit = 10) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_DATA_BASE_URL}/v2/stocks/${symbol}/trades?limit=${limit}`);
      return response.data;
    });
  },
  
  // Get market clock (market hours)
  getClock: async () => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      const response = await client.get(`${ALPACA_API_BASE_URL}/clock`);
      return response.data;
    });
  },
  
  // Get market calendar (trading days)
  getCalendar: async (start?: string, end?: string) => {
    return enqueueRequest(async () => {
      const client = createAlpacaClient();
      let url = `${ALPACA_API_BASE_URL}/calendar`;
      
      if (start && end) {
        url += `?start=${start}&end=${end}`;
      } else if (start) {
        url += `?start=${start}`;
      } else if (end) {
        url += `?end=${end}`;
      }
      
      const response = await client.get(url);
      return response.data;
    });
  }
};

export default alpacaApi; 