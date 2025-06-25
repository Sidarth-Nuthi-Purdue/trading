// Alpaca API integration for live market data

const ALPACA_API_KEY = process.env.NEXT_PUBLIC_ALPACA_API_KEY || 'PKYCK71DJORXHZU80WB0';
const ALPACA_API_SECRET = process.env.NEXT_PUBLIC_ALPACA_API_SECRET || 'jRc2urANJhLpfqbYYnk6zo86sO1rmHMRpkyKBxCP';
const ALPACA_BASE_URL = process.env.ALPACA_BASE_URL || process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets';
const ALPACA_DATA_URL = process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets';

// Types for Alpaca API responses
export type AlpacaBar = {
  t: string;       // Timestamp
  o: number;       // Open
  h: number;       // High
  l: number;       // Low
  c: number;       // Close
  v: number;       // Volume
}

export type AlpacaBarsResponse = {
  bars: AlpacaBar[];
  symbol?: string;
  next_page_token?: string;
}

export interface AlpacaQuote {
  symbol: string;
  latestTrade: {
    p: number;     // Price
    s: number;     // Size
    t: string;     // Timestamp
    x: string;     // Exchange
    c: string[];   // Conditions
    i: number;     // Trade ID
    z: string;     // Tape
  };
  latestQuote: {
    ap: number;    // Ask Price
    as: number;    // Ask Size
    bp: number;    // Bid Price
    bs: number;    // Bid Size
    t: string;     // Timestamp
  };
}

export type TimeframeType = '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '1Day' | '1Week' | '1Month';

/**
 * Get headers for Alpaca API calls
 */
const getHeaders = () => {
  return {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    'Content-Type': 'application/json'
  };
};

/**
 * Fetch real-time bars for a given symbol and timeframe
 * @param symbol Stock symbol to fetch
 * @param timeframe Timeframe for the bars
 * @param limit Number of bars to return
 * @param feed Data feed to use (default is 'iex')
 */
export async function fetchBars(
  symbol: string, 
  timeframe: string = '1Day', 
  limit: number = 100,
  feed: string = 'iex'
): Promise<AlpacaBarsResponse> {
  try {
    // Calculate start date based on timeframe to ensure we get data even if market is closed
    let lookbackDays = 1;
    switch(timeframe) {
      case '1Min': 
      case '5Min': 
      case '15Min': 
      case '30Min': lookbackDays = 3; break;
      case '1Hour': lookbackDays = 7; break;
      case '1Day': lookbackDays = 30; break;
      case '1Week': lookbackDays = 180; break;
      case '1Month': lookbackDays = 730; break; // ~2 years
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const start = startDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    // Construct URL with query parameters
    const queryParams = new URLSearchParams({
      symbol: symbol,
      timeframe: timeframe,
      limit: limit.toString(),
      feed: feed,
      start: start
    });
    
    // Use local API proxy instead of direct Alpaca API call to avoid CORS issues
    const response = await fetch(`/api/alpaca/market-data/bars?${queryParams.toString()}`, {
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bars: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // If we didn't get any data, try with a longer lookback period
    if (!data.bars || data.bars.length === 0) {
      console.warn('No bars returned. Trying with a longer lookback period...');
      const extendedStartDate = new Date();
      extendedStartDate.setDate(extendedStartDate.getDate() - lookbackDays * 2);
      const extendedStart = extendedStartDate.toISOString().split('T')[0];
      
      const extendedQueryParams = new URLSearchParams({
        symbol: symbol,
        timeframe: timeframe,
        limit: (limit * 2).toString(),
        feed: feed,
        start: extendedStart
      });
      
      const extendedResponse = await fetch(`/api/alpaca/market-data/bars?${extendedQueryParams.toString()}`, {
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 0 }
      });
      
      if (!extendedResponse.ok) {
        throw new Error(`Failed to fetch extended bars: ${extendedResponse.status} ${extendedResponse.statusText}`);
      }
      
      return await extendedResponse.json();
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching bars:', error);
    throw error;
  }
}

/**
 * Fetch historical bars for a given symbol and date range
 * @param symbol Stock symbol to fetch
 * @param startDate Start date for the historical data
 * @param endDate End date for the historical data
 * @param timeframe Timeframe for the bars
 * @param limit Maximum number of bars to return
 */
export async function fetchHistoricalBars(
  symbol: string,
  startDate: Date,
  endDate: Date,
  timeframe: TimeframeType = '1Min',
  limit: number = 10000
): Promise<AlpacaBar[]> {
  try {
    // Format dates for API
    const start = startDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const end = endDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    // Construct URL with query parameters
    const queryParams = new URLSearchParams({
      symbol: symbol,
      timeframe: timeframe,
      start: start,
      end: end,
      limit: limit.toString()
    });
    
    // Use our API endpoint for historical data
    const response = await fetch(`/api/alpaca/market-data/historical?${queryParams.toString()}`, {
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch historical bars: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the data to AlpacaBar format if needed
    if (Array.isArray(data)) {
      return data.map(bar => ({
        t: bar.timestamp,
        o: bar.open,
        h: bar.high,
        l: bar.low,
        c: bar.close,
        v: bar.volume
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching historical bars:', error);
    return [];
  }
}

/**
 * Fetch real-time quote for a given symbol
 */
export const fetchQuote = async (symbol: string) => {
  try {
    const url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/quotes/latest`;
    
    const response = await fetch(url, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.quote;
  } catch (error) {
    console.error('Error fetching quote:', error);
    return null;
  }
};

/**
 * Fetch account information
 */
export const fetchAccount = async () => {
  try {
    const url = `${ALPACA_BASE_URL}/v2/account`;
    
    const response = await fetch(url, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching account:', error);
    return null;
  }
};

/**
 * Convert time frame to milliseconds for polling interval
 */
export const timeframeToMilliseconds = (timeframe: TimeframeType): number => {
  switch (timeframe) {
    case '1Min': return 60 * 1000;
    case '5Min': return 5 * 60 * 1000;
    case '15Min': return 15 * 60 * 1000;
    case '30Min': return 30 * 60 * 1000;
    case '1Hour': return 60 * 60 * 1000;
    case '1Day': return 24 * 60 * 60 * 1000;
    case '1Week': return 7 * 24 * 60 * 60 * 1000;
    case '1Month': return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}; 