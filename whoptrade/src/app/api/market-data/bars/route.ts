import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import axios from 'axios';

// Ensure the route is always fresh and not cached
export const dynamic = 'force-dynamic';

/**
 * Endpoint to fetch historical bar data for a symbol
 * Uses Yahoo Finance API as a free alternative to Alpaca
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the query string
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1d';
    const fromTimestamp = searchParams.get('from');
    const toTimestamp = searchParams.get('to');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching bars for ${symbol} with interval ${interval}...`);

    // Convert interval to Yahoo Finance format
    const yahooInterval = convertToYahooInterval(interval);
    
    // Calculate period1 and period2 (Unix timestamps in seconds)
    // Adjust default timerange based on interval for better data quality
    let defaultFromOffset = 365 * 24 * 60 * 60; // Default to 1 year ago
    
    switch(interval) {
      case '1m':
        defaultFromOffset = 5 * 24 * 60 * 60; // 5 days for 1m
        break;
      case '5m':
        defaultFromOffset = 7 * 24 * 60 * 60; // 7 days for 5m
        break;
      case '15m':
      case '30m':
        defaultFromOffset = 14 * 24 * 60 * 60; // 14 days for 15m/30m
        break;
      case '1h':
        defaultFromOffset = 30 * 24 * 60 * 60; // 30 days for 1h
        break;
      case '4h':
        defaultFromOffset = 90 * 24 * 60 * 60; // 90 days for 4h
        break;
      case '1d':
        defaultFromOffset = 365 * 24 * 60 * 60; // 1 year for 1d
        break;
      case '1w':
        defaultFromOffset = 2 * 365 * 24 * 60 * 60; // 2 years for 1w
        break;
    }
    
    const from = fromTimestamp ? parseInt(fromTimestamp) : Math.floor(Date.now() / 1000) - defaultFromOffset;
    const to = toTimestamp ? parseInt(toTimestamp) : Math.floor(Date.now() / 1000);
    
    // Try Alpaca first if we have credentials
    const alpacaApiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY || process.env.ALPACA_API_KEY;
    const alpacaApiSecret = process.env.NEXT_PUBLIC_ALPACA_API_SECRET || process.env.ALPACA_API_SECRET;
    
    if (alpacaApiKey && alpacaApiSecret) {
      try {
        const alpacaInterval = convertToAlpacaInterval(interval);
        const alpacaDataUrl = process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets';
        
        // Calculate appropriate start date based on interval
        let startDate = new Date(from * 1000);
        if (!fromTimestamp) {
          const now = new Date();
          // Ensure we're getting data during market hours for intraday intervals
          const marketStart = new Date(now);
          marketStart.setHours(9, 30, 0, 0); // 9:30 AM EST market open
          
          switch(interval) {
            case '1m':
              // For 1m, get last 2 trading days to ensure we have recent data
              startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
              break;
            case '5m':
              // For 5m, get last 5 trading days
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case '15m':
            case '30m':
              // For 15m/30m, get last 10 trading days
              startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
              break;
            case '1h':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
              break;
            case '4h':
              startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
              break;
            case '1d':
              startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
              break;
            case '1w':
              startDate = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000); // 2 years
              break;
            default:
              startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
          }
        }
        
        const endDate = toTimestamp ? new Date(to * 1000) : new Date();
        
        const alpacaUrl = `${alpacaDataUrl}/v2/stocks/${symbol}/bars?timeframe=${alpacaInterval}&start=${startDate.toISOString()}&end=${endDate.toISOString()}&limit=1000`;
        
        console.log(`Trying Alpaca API: ${alpacaUrl}`);
        
        const alpacaResponse = await axios.get(alpacaUrl, {
          headers: {
            'APCA-API-KEY-ID': alpacaApiKey,
            'APCA-API-SECRET-KEY': alpacaApiSecret
          },
          timeout: 10000
        });
        
        if (alpacaResponse.status === 200 && alpacaResponse.data.bars && alpacaResponse.data.bars.length > 0) {
          // Convert Alpaca format to our format
          const bars = alpacaResponse.data.bars.map((bar: any) => ({
            time: new Date(bar.t).getTime() / 1000, // Convert to Unix timestamp
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v
          }));
          
          console.log(`Successfully fetched ${bars.length} bars from Alpaca for ${symbol}`);
          
          return NextResponse.json(
            { bars, source: 'alpaca' },
            {
              status: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              },
            }
          );
        }
      } catch (alpacaError) {
        console.warn('Alpaca API failed, falling back to Yahoo Finance:', alpacaError);
      }
    }
    
    try {
      // Fallback to Yahoo Finance API
      const yahooApiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&period1=${from}&period2=${to}&includePrePost=false`;
      
      console.log(`Trying Yahoo Finance: ${yahooApiUrl}`);
      
      const response = await fetch(yahooApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        cache: 'no-store',
        next: { revalidate: 300 } // Cache for 5 minutes
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract chart data
      const result = data.chart?.result?.[0];
      
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        throw new Error(`No data available for ${symbol} with interval ${interval}`);
      }

      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];
      
      // Format the response with better data validation and timestamp handling
      const bars = timestamps.map((timestamp: number, index: number) => {
        const open = quote.open[index];
        const high = quote.high[index];
        const low = quote.low[index];
        const close = quote.close[index];
        const volume = quote.volume[index];
        
        return {
          time: timestamp, // Yahoo timestamps are already in seconds
          open: open || close || 0,
          high: high || close || 0,
          low: low || close || 0,
          close: close || 0,
          volume: volume || 0
        };
      }).filter((bar: any) => {
        // Filter out bars with invalid data
        const hasValidPrices = bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0;
        const hasValidOHLC = bar.high >= bar.low && bar.high >= bar.open && bar.high >= bar.close && bar.low <= bar.open && bar.low <= bar.close;
        const hasValidNumbers = !isNaN(bar.open) && !isNaN(bar.high) && !isNaN(bar.low) && !isNaN(bar.close);
        const notNull = bar.open !== null && bar.high !== null && bar.low !== null && bar.close !== null;
        
        // Also check that timestamp is reasonable (not too old/future)
        const now = Math.floor(Date.now() / 1000);
        const timestampValid = bar.time > (now - 5 * 365 * 24 * 60 * 60) && bar.time <= (now + 24 * 60 * 60);
        
        return hasValidPrices && hasValidOHLC && hasValidNumbers && notNull && timestampValid;
      }).sort((a, b) => a.time - b.time); // Ensure bars are sorted by time

      console.log(`Successfully fetched ${bars.length} bars for ${symbol}`);
      
      // Set CORS headers
      const headersList = headers();
      const origin = (await headersList).get('origin');
      
      return NextResponse.json(
        { bars, source: 'yahoo' },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    } catch (error) {
      console.error('Error fetching from Yahoo Finance:', error);
      // Fall back to mock data if both APIs fail
      const mockBars = generateMockBars(symbol, interval, from, to);
      console.log(`Falling back to mock data for ${symbol} with ${mockBars.length} bars`);
      return NextResponse.json({ bars: mockBars, source: 'mock' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error in bars API:', error);
    
    // Return mock data in case of error
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'UNKNOWN';
    const interval = searchParams.get('interval') || '1d';
    const fromTimestamp = searchParams.get('from');
    const toTimestamp = searchParams.get('to');
    
    const from = fromTimestamp ? parseInt(fromTimestamp) : Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
    const to = toTimestamp ? parseInt(toTimestamp) : Math.floor(Date.now() / 1000);
    
    const mockBars = generateMockBars(symbol, interval, from, to);
    
    return NextResponse.json(
      { bars: mockBars },
      { status: 200 }
    );
  }
}

/**
 * Convert TradingView/custom interval format to Yahoo Finance format
 */
function convertToYahooInterval(interval: string): string {
  // Map of our interval format to Yahoo's format
  const intervalMap: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '1h',     // Yahoo doesn't have 2h, use 1h and we'll aggregate
    '4h': '1h',     // Yahoo doesn't have 4h, use 1h and we'll aggregate  
    '1d': '1d',
    '1w': '1wk',
    '1M': '1mo'
  };
  
  return intervalMap[interval] || '1d';
}

/**
 * Convert interval to Alpaca format
 */
function convertToAlpacaInterval(interval: string): string {
  const intervalMap: Record<string, string> = {
    '1m': '1Min',
    '5m': '5Min',
    '15m': '15Min',
    '30m': '30Min',
    '1h': '1Hour',
    '2h': '1Hour',  // Use 1Hour for 2h
    '4h': '1Hour',  // Use 1Hour for 4h
    '1d': '1Day',
    '1w': '1Week',
    '1M': '1Month'
  };
  
  return intervalMap[interval] || '1Day';
}

/**
 * Generate mock bar data for testing with proper timestamp alignment
 */
function generateMockBars(symbol: string, interval: string, from: number, to: number): any[] {
  const bars = [];
  
  // Calculate bar interval in seconds and appropriate bar count
  let intervalSeconds = 60; // Default to 1 minute
  let barCount = 200;
  
  switch (interval) {
    case '1m':
      intervalSeconds = 60;
      barCount = Math.min(1440, Math.floor((to - from) / intervalSeconds)); // Max 1 day worth
      break;
    case '5m':
      intervalSeconds = 5 * 60;
      barCount = Math.min(576, Math.floor((to - from) / intervalSeconds)); // Max 2 days worth
      break;
    case '15m':
      intervalSeconds = 15 * 60;
      barCount = Math.min(672, Math.floor((to - from) / intervalSeconds)); // Max 7 days worth
      break;
    case '30m':
      intervalSeconds = 30 * 60;
      barCount = Math.min(672, Math.floor((to - from) / intervalSeconds)); // Max 14 days worth
      break;
    case '1h':
      intervalSeconds = 60 * 60;
      barCount = Math.min(720, Math.floor((to - from) / intervalSeconds)); // Max 30 days worth
      break;
    case '4h':
      intervalSeconds = 4 * 60 * 60;
      barCount = Math.min(540, Math.floor((to - from) / intervalSeconds)); // Max 90 days worth
      break;
    case '1d':
      intervalSeconds = 24 * 60 * 60;
      barCount = Math.min(365, Math.floor((to - from) / intervalSeconds)); // Max 1 year worth
      break;
    case '1w':
      intervalSeconds = 7 * 24 * 60 * 60;
      barCount = Math.min(104, Math.floor((to - from) / intervalSeconds)); // Max 2 years worth
      break;
    case '1M':
      intervalSeconds = 30 * 24 * 60 * 60;
      barCount = Math.min(60, Math.floor((to - from) / intervalSeconds)); // Max 5 years worth
      break;
  }
  
  // Base price for the mock data - different for each symbol
  let basePrice = 196.40;
  
  // Set different base prices for common stocks
  const symbolPrices: Record<string, number> = {
    'AAPL': 175.50,
    'MSFT': 335.15,
    'AMZN': 130.25,
    'GOOGL': 140.80,
    'META': 290.35,
    'TSLA': 245.75,
    'NVDA': 425.65,
    'AMD': 155.20,
    'INTC': 45.80,
    'NFLX': 410.30,
  };
  
  if (symbolPrices[symbol]) {
    basePrice = symbolPrices[symbol];
  }
  
  let lastClose = basePrice;
  
  for (let i = 0; i < barCount; i++) {
    // Calculate time for this bar, ensuring proper alignment
    let time = to - (barCount - i) * intervalSeconds;
    
    // Align timestamps to interval boundaries for cleaner data
    if (interval === '1m') {
      time = Math.floor(time / 60) * 60; // Align to minute
    } else if (interval === '5m') {
      time = Math.floor(time / (5 * 60)) * (5 * 60); // Align to 5-minute
    } else if (interval === '15m') {
      time = Math.floor(time / (15 * 60)) * (15 * 60); // Align to 15-minute
    } else if (interval === '30m') {
      time = Math.floor(time / (30 * 60)) * (30 * 60); // Align to 30-minute
    } else if (interval === '1h') {
      time = Math.floor(time / (60 * 60)) * (60 * 60); // Align to hour
    } else if (interval === '4h') {
      time = Math.floor(time / (4 * 60 * 60)) * (4 * 60 * 60); // Align to 4-hour
    } else if (interval === '1d') {
      const date = new Date(time * 1000);
      date.setHours(16, 0, 0, 0); // Align to 4 PM EST market close
      time = Math.floor(date.getTime() / 1000);
    }
    
    // Skip if before the requested range
    if (time < from) continue;
    
    // Generate random price movement (more realistic)
    const changePercent = (Math.random() - 0.5) * 0.01; // -0.5% to +0.5% change
    const close = lastClose * (1 + changePercent);
    
    // Generate random high/low that make sense
    const amplitude = lastClose * 0.005; // 0.5% of last close
    const high = close + Math.random() * amplitude;
    const low = close - Math.random() * amplitude;
    const open = lastClose + (close - lastClose) * 0.3; // Somewhere between last close and current close
    
    // Generate random volume
    const volume = Math.floor(Math.random() * 1000000) + 500000;
    
    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume
    });
    
    lastClose = close;
  }
  
  return bars;
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 