import Alpaca from '@alpacahq/alpaca-trade-api';
import { ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_PAPER, ALPACA_API_BASE_URL } from './env';

// Check if we have the required credentials
if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
  console.error('Missing Alpaca API credentials in environment variables');
}

// Create Alpaca client
export const alpaca = new Alpaca({
  keyId: ALPACA_API_KEY,
  secretKey: ALPACA_API_SECRET,
  paper: ALPACA_PAPER, // Use paper trading by default
  baseUrl: ALPACA_PAPER ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets',
  feed: 'iex' // Use IEX as the data source
});

// Helper function to get Alpaca API headers
export function getAlpacaHeaders() {
  return {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    'Content-Type': 'application/json'
  };
}

// Function to fetch latest quote for a symbol
export async function fetchLatestQuote(symbol: string) {
  try {
    const baseUrl = ALPACA_PAPER ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const response = await fetch(
      `${baseUrl}/v2/stocks/${symbol}/quotes/latest`,
      {
        headers: getAlpacaHeaders(),
        cache: 'no-store'
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch quote: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    throw error;
  }
}

// Function to fetch latest quotes for multiple symbols
export async function fetchLatestQuotes(symbols: string[]) {
  try {
    const baseUrl = ALPACA_PAPER ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const response = await fetch(
      `${baseUrl}/v2/stocks/quotes/latest?symbols=${symbols.join(',')}`,
      {
        headers: getAlpacaHeaders(),
        cache: 'no-store'
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch quotes: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching quotes for ${symbols.join(',')}:`, error);
    throw error;
  }
} 