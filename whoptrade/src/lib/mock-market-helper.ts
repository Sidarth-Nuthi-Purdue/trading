/**
 * Mock Market Helper
 * Provides utility functions for handling API fallbacks to mock data
 */

import { getMockPositions, getMockOrders, getMockBars, getMockTrades, getMockQuote } from './mock-market-data';

/**
 * Creates a hybrid handler for API requests that attempts to use real data first,
 * then falls back to mock data if there's an error
 */
export async function withMockFallback<T>(
  realDataFn: () => Promise<T>,
  mockDataFn: () => T,
  logPrefix: string = 'API'
): Promise<T> {
  try {
    // Try to get real data first
    const realData = await realDataFn();
    return realData;
  } catch (error) {
    // Log the error and fall back to mock data
    console.warn(`${logPrefix} error, falling back to mock data:`, error);
    return mockDataFn();
  }
}

/**
 * Generates mock positions with a consistent set of assets
 */
export function getMockPositionsWithConsistentAssets(count: number = 5) {
  // Always include these major stocks in positions
  const requiredSymbols = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA'];
  const positions = getMockPositions(Math.max(count, requiredSymbols.length));
  
  // Ensure required symbols are included
  for (let i = 0; i < Math.min(requiredSymbols.length, positions.length); i++) {
    positions[i].symbol = requiredSymbols[i];
  }
  
  return positions;
}

/**
 * Generates mock orders with specific symbols
 */
export function getMockOrdersWithSymbols(symbols: string[] = ['AAPL', 'MSFT', 'AMZN']) {
  const orders = getMockOrders(symbols.length);
  
  // Assign specific symbols to orders
  for (let i = 0; i < Math.min(symbols.length, orders.length); i++) {
    orders[i].symbol = symbols[i];
  }
  
  return orders;
}