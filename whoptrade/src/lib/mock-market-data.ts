/**
 * Mock Market Data Provider
 * This file provides realistic mock market data when the Alpaca API is unavailable
 * or rate-limited. It simulates real stock prices with random fluctuations.
 */

// Base prices for common stocks
const BASE_PRICES: Record<string, number> = {
  AAPL: 175.50,
  MSFT: 335.15,
  AMZN: 130.25,
  GOOGL: 140.80,
  META: 290.35,
  TSLA: 245.75,
  NVDA: 425.65,
  AMD: 155.20,
  INTC: 45.80,
  NFLX: 410.30,
  DIS: 110.45,
  BA: 210.30,
  JPM: 155.75,
  V: 245.65,
  WMT: 65.85,
  PG: 155.25,
  JNJ: 175.40,
  KO: 60.15,
  PEP: 170.25,
  MCD: 265.40,
  SBUX: 95.30,
  NKE: 110.60,
  ADBE: 510.75,
  CRM: 240.50,
  PYPL: 125.65,
  XOM: 95.45,
  CVX: 170.35,
  COST: 550.80,
  HD: 340.25,
  UNH: 490.55,
};

// Default price for stocks not in the BASE_PRICES list
const DEFAULT_PRICE = 100.00;

// Keep track of current mock prices
let currentPrices: Record<string, number> = { ...BASE_PRICES };

// Last update timestamp for each symbol
const lastUpdateTime: Record<string, string> = {};

// Mock quote data
export interface MockQuote {
  t: string;        // Timestamp
  ap: number;       // Ask price
  as: number;       // Ask size
  bp: number;       // Bid price
  bs: number;       // Bid size
}

// Mock bar data
export interface MockBar {
  t: string;        // Timestamp
  o: number;        // Open price
  h: number;        // High price
  l: number;        // Low price
  c: number;        // Close price
  v: number;        // Volume
}

// Mock trade data
export interface MockTrade {
  t: string;        // Timestamp
  p: number;        // Price
  s: number;        // Size
  c: string[];      // Conditions
  i: number;        // Trade ID
  x: string;        // Exchange
}

/**
 * Generate a realistic price movement for a symbol
 */
function generatePriceMovement(basePrice: number): number {
  // Simulate a small random price movement (±0.5% from current price)
  const volatility = 0.005;
  const randomFactor = (Math.random() - 0.5) * 2 * volatility;
  return basePrice * (1 + randomFactor);
}

/**
 * Get the current mock price for a symbol
 */
export function getMockPrice(symbol: string): number {
  // Update the price with a small random movement
  if (!currentPrices[symbol]) {
    currentPrices[symbol] = BASE_PRICES[symbol] || DEFAULT_PRICE;
  }
  
  // Generate a new price
  currentPrices[symbol] = generatePriceMovement(currentPrices[symbol]);
  
  // Update the last update time
  lastUpdateTime[symbol] = new Date().toISOString();
  
  return currentPrices[symbol];
}

/**
 * Get a mock quote for a symbol
 */
export function getMockQuote(symbol: string): MockQuote {
  const price = getMockPrice(symbol);
  
  // Create a small spread around the price
  const spreadSize = price * 0.0005; // 0.05% spread
  const bidPrice = price - spreadSize / 2;
  const askPrice = price + spreadSize / 2;
  
  return {
    t: new Date().toISOString(),
    bp: bidPrice,
    bs: Math.floor(Math.random() * 1000) + 100, // Random bid size between 100-1100
    ap: askPrice,
    as: Math.floor(Math.random() * 1000) + 100, // Random ask size between 100-1100
  };
}

/**
 * Get mock quotes for multiple symbols
 */
export function getMockQuotes(symbols: string[]): Record<string, MockQuote> {
  const quotes: Record<string, MockQuote> = {};
  
  for (const symbol of symbols) {
    quotes[symbol] = getMockQuote(symbol);
  }
  
  return quotes;
}

/**
 * Generate mock bars for a symbol
 */
export function getMockBars(
  symbol: string, 
  timeframe: string = '1D',
  start?: string,
  end?: string,
  limit: number = 100
): MockBar[] {
  const bars: MockBar[] = [];
  const basePrice = BASE_PRICES[symbol] || DEFAULT_PRICE;
  
  // Generate realistic end date (now) and start date based on timeframe and limit
  const endDate = end ? new Date(end) : new Date();
  let startDate = start ? new Date(start) : new Date();
  
  // If no start date provided, calculate it based on timeframe and limit
  if (!start) {
    let millisecondsToSubtract = 0;
    
    switch (timeframe) {
      case '1m':
        millisecondsToSubtract = limit * 60 * 1000;
        break;
      case '5m':
        millisecondsToSubtract = limit * 5 * 60 * 1000;
        break;
      case '15m':
        millisecondsToSubtract = limit * 15 * 60 * 1000;
        break;
      case '1h':
        millisecondsToSubtract = limit * 60 * 60 * 1000;
        break;
      case '1D':
        millisecondsToSubtract = limit * 24 * 60 * 60 * 1000;
        break;
      case '1W':
        millisecondsToSubtract = limit * 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        millisecondsToSubtract = limit * 24 * 60 * 60 * 1000; // Default to daily
    }
    
    startDate = new Date(endDate.getTime() - millisecondsToSubtract);
  }
  
  // Generate bars from start to end
  let currentDate = new Date(startDate);
  let currentPrice = basePrice;
  
  // Use a volatility factor based on the symbol's price (higher priced stocks tend to move more)
  const baseVolatility = 0.01; // 1% base volatility
  const volatilityFactor = basePrice > 300 ? 1.2 : basePrice > 100 ? 1.0 : 0.8;
  const volatility = baseVolatility * volatilityFactor;
  
  // Simulate a random walk with a slight upward bias
  const upwardBias = 0.001; // 0.1% upward bias
  
  while (currentDate <= endDate && bars.length < limit) {
    // Generate a random price movement
    const randomFactor = ((Math.random() - 0.5) * 2 * volatility) + upwardBias;
    const nextPrice = currentPrice * (1 + randomFactor);
    
    // Calculate high and low around the open and close
    const open = currentPrice;
    const close = nextPrice;
    const highLowRange = Math.max(Math.abs(close - open) * 1.5, basePrice * 0.005);
    
    // Create bar data
    const bar: MockBar = {
      t: currentDate.toISOString(),
      o: open,
      c: close,
      h: Math.max(open, close) + (Math.random() * highLowRange),
      l: Math.min(open, close) - (Math.random() * highLowRange),
      v: Math.floor(Math.random() * 1000000) + 100000, // Random volume between 100k-1.1m
    };
    
    bars.push(bar);
    
    // Update current price for next iteration
    currentPrice = close;
    
    // Increment date based on timeframe
    switch (timeframe) {
      case '1m':
        currentDate = new Date(currentDate.getTime() + 60 * 1000);
        break;
      case '5m':
        currentDate = new Date(currentDate.getTime() + 5 * 60 * 1000);
        break;
      case '15m':
        currentDate = new Date(currentDate.getTime() + 15 * 60 * 1000);
        break;
      case '1h':
        currentDate = new Date(currentDate.getTime() + 60 * 60 * 1000);
        break;
      case '1D':
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '1W':
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  
  return bars;
}

/**
 * Generate mock trades for a symbol
 */
export function getMockTrades(symbol: string, limit: number = 10): MockTrade[] {
  const trades: MockTrade[] = [];
  const basePrice = currentPrices[symbol] || BASE_PRICES[symbol] || DEFAULT_PRICE;
  
  for (let i = 0; i < limit; i++) {
    // Small random variation around the current price
    const priceVariation = basePrice * 0.001 * (Math.random() - 0.5) * 2;
    const price = basePrice + priceVariation;
    
    const trade: MockTrade = {
      t: new Date(Date.now() - i * 1000).toISOString(), // Each trade 1 second apart
      p: price,
      s: Math.floor(Math.random() * 1000) + 100, // Random size between 100-1100
      c: ['@', 'T'], // Regular trade conditions
      i: 1000000 + i, // Random trade ID
      x: Math.random() > 0.5 ? 'NSDQ' : 'NYSE', // Random exchange
    };
    
    trades.push(trade);
  }
  
  return trades;
}

/**
 * Generate mock positions for a user
 */
export function getMockPositions(numPositions: number = 5) {
  const positions = [];
  const symbols = Object.keys(BASE_PRICES);
  
  // Shuffle and pick random symbols
  const selectedSymbols = symbols
    .sort(() => Math.random() - 0.5)
    .slice(0, numPositions);
  
  for (const symbol of selectedSymbols) {
    const entryPrice = BASE_PRICES[symbol] * (0.95 + Math.random() * 0.1); // Random entry price ±5% of current price
    const currentPrice = getMockPrice(symbol);
    const quantity = Math.floor(Math.random() * 100) + 10; // Random quantity between 10-110
    const marketValue = quantity * currentPrice;
    const costBasis = quantity * entryPrice;
    const unrealizedPL = marketValue - costBasis;
    
    positions.push({
      asset_id: `asset-${symbol}`,
      symbol,
      exchange: Math.random() > 0.3 ? 'NASDAQ' : 'NYSE',
      asset_class: 'us_equity',
      asset_marginable: true,
      qty: quantity.toString(),
      avg_entry_price: entryPrice.toFixed(2),
      side: 'long',
      market_value: marketValue.toFixed(2),
      cost_basis: costBasis.toFixed(2),
      unrealized_pl: unrealizedPL.toFixed(2),
      unrealized_plpc: (unrealizedPL / costBasis * 100).toFixed(2),
      unrealized_intraday_pl: (unrealizedPL * (0.3 + Math.random() * 0.7)).toFixed(2), // Random portion of total PL for intraday
      unrealized_intraday_plpc: (unrealizedPL / costBasis * 100 * (0.3 + Math.random() * 0.7)).toFixed(2),
      current_price: currentPrice.toFixed(2),
      lastday_price: (currentPrice * (0.98 + Math.random() * 0.04)).toFixed(2), // Random previous day price ±2%
      change_today: (Math.random() * 2 - 1).toFixed(2) // Random change between -1% and +1%
    });
  }
  
  return positions;
}

/**
 * Generate mock orders
 */
export function getMockOrders(numOrders: number = 5) {
  const orders = [];
  const symbols = Object.keys(BASE_PRICES);
  const orderTypes = ['market', 'limit', 'stop', 'stop_limit'];
  const sides = ['buy', 'sell'];
  const statuses = ['filled', 'new', 'partially_filled', 'canceled'];
  const timeInForce = ['day', 'gtc', 'ioc'];
  
  for (let i = 0; i < numOrders; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const price = getMockPrice(symbol);
    const side = sides[Math.floor(Math.random() * sides.length)];
    const type = orderTypes[Math.floor(Math.random() * orderTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const tif = timeInForce[Math.floor(Math.random() * timeInForce.length)];
    const qty = Math.floor(Math.random() * 100) + 10; // Random quantity between 10-110
    const filledQty = status === 'filled' ? qty : status === 'partially_filled' ? Math.floor(qty * Math.random()) : 0;
    const limitPrice = type.includes('limit') ? (price * (side === 'buy' ? 0.99 : 1.01)).toFixed(2) : null;
    const stopPrice = type.includes('stop') ? (price * (side === 'buy' ? 1.01 : 0.99)).toFixed(2) : null;
    
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(); // Within last 7 days
    const updatedAt = new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString(); // Within last day
    
    orders.push({
      id: `order-${i}-${Date.now()}`,
      client_order_id: `client-order-${i}-${Date.now()}`,
      created_at: createdAt,
      updated_at: updatedAt,
      submitted_at: createdAt,
      filled_at: status === 'filled' ? updatedAt : null,
      expired_at: null,
      canceled_at: status === 'canceled' ? updatedAt : null,
      failed_at: null,
      replaced_at: null,
      replaced_by: null,
      replaces: null,
      asset_id: `asset-${symbol}`,
      symbol,
      asset_class: 'us_equity',
      notional: null,
      qty: qty.toString(),
      filled_qty: filledQty.toString(),
      filled_avg_price: status === 'filled' || status === 'partially_filled' ? price.toFixed(2) : null,
      order_class: 'simple',
      order_type: type,
      type,
      side,
      time_in_force: tif,
      limit_price: limitPrice,
      stop_price: stopPrice,
      status,
      extended_hours: false,
      legs: null,
      trail_percent: null,
      trail_price: null,
      hwm: null
    });
  }
  
  return orders;
} 