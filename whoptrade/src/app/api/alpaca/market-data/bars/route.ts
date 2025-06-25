import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_DATA_BASE_URL } from '@/utils/env';

export const dynamic = 'force-dynamic'; // Disable caching for this route

/**
 * GET handler for fetching chart bars/candles data
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || '';
    const timeframe = searchParams.get('timeframe') || '1Day';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const start = searchParams.get('start') || '';
    const end = searchParams.get('end') || '';

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }
    
    // Map UI timeframes to Alpaca API timeframes
    let alpacaTimeframe: string;
    switch (timeframe) {
      case '1D':
        alpacaTimeframe = '1Day';
        break;
      case '1W':
        alpacaTimeframe = '1Week';
        break;
      case '1M':
        alpacaTimeframe = '1Month';
        break;
      case '3M':
        // For 3M, we'll use 1Day timeframe with an adjusted start date
        alpacaTimeframe = '1Day';
        break;
      case '1Y':
        alpacaTimeframe = '1Day';
        break;
      default:
        // Handle smaller timeframes for zooming
        if (timeframe === '1Min' || timeframe === '5Min' || timeframe === '15Min' || timeframe === '1Hour') {
          alpacaTimeframe = timeframe;
        } else {
          alpacaTimeframe = '1Day'; // Default to 1Day
        }
    }

    // Try to fetch from Alpaca
    try {
      if (ALPACA_API_KEY && ALPACA_API_SECRET) {
        // Construct the API URL
        const baseUrl = ALPACA_DATA_BASE_URL;
        
        // Format the parameters
        const params = new URLSearchParams();
        params.append('timeframe', alpacaTimeframe);
        params.append('limit', limit.toString());
        
        // Adjust start date for 3M or 1Y timeframes
        if (timeframe === '3M' && !start) {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          params.append('start', threeMonthsAgo.toISOString());
        } else if (timeframe === '1Y' && !start) {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          params.append('start', oneYearAgo.toISOString());
        } else if (start) {
          params.append('start', start);
        }
        
        if (end) {
          params.append('end', end);
        }
        
        // Construct the full URL with parameters
        const apiUrl = `${baseUrl}/v2/stocks/${symbol}/bars?${params.toString()}`;
        
        console.log(`Fetching bars from: ${apiUrl}`);
        
        const response = await axios.get(apiUrl, {
          headers: {
            'APCA-API-KEY-ID': ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': ALPACA_API_SECRET
          },
          timeout: 10000 // 10 second timeout
        });
        
        // Check if response contains data
        if (response.status === 200) {
          // Return the bars data directly
          return NextResponse.json({ bars: response.data.bars || [] });
        }
      } else {
        console.error('Missing Alpaca API credentials');
        return NextResponse.json({ error: 'Alpaca API credentials not configured' }, { status: 500 });
      }
    } catch (alpacaError) {
      console.error(`Error fetching bars from Alpaca API for ${symbol}:`, alpacaError);
      
      // Generate mock data if Alpaca request fails
      // This is a fallback only if the API request fails
      const bars = generateMockData(symbol, timeframe, limit);
      return NextResponse.json({ bars, isMock: true });
    }

    // If we reach here, return an error
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });

  } catch (error) {
    console.error('Error in bars API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Generate mock data as a fallback
 */
function generateMockData(symbol: string, timeframe: string, limit: number): Array<{
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}> {
  const bars = [];
  const now = new Date();
  let currentTime = new Date();
  let timeIncrement = 0;

  // Set time increment based on timeframe
  switch (timeframe) {
    case '1Min':
      timeIncrement = 60 * 1000; // 1 minute
      break;
    case '5Min':
      timeIncrement = 5 * 60 * 1000; // 5 minutes
      break;
    case '15Min':
      timeIncrement = 15 * 60 * 1000; // 15 minutes
      break;
    case '1Hour':
      timeIncrement = 60 * 60 * 1000; // 1 hour
      break;
    case '1D':
      timeIncrement = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '1W':
      timeIncrement = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
    case '1M':
      timeIncrement = 30 * 24 * 60 * 60 * 1000; // 1 month (approximation)
      break;
    case '3M':
      timeIncrement = 24 * 60 * 60 * 1000; // 1 day, but we'll generate more data points
      break;
    case '1Y':
      timeIncrement = 24 * 60 * 60 * 1000; // 1 day, but for a year
      break;
    default:
      timeIncrement = 24 * 60 * 60 * 1000; // Default to 1 day
  }

  // Get base price - different for each symbol
  const basePrice = getBasePrice(symbol);
  let currentPrice = basePrice;
  
  // Generate bars
  for (let i = 0; i < limit; i++) {
    // Subtract time increment for historical data
    currentTime = new Date(now.getTime() - (limit - i) * timeIncrement);
    
    // Generate random price movements
    const priceMovement = (Math.random() - 0.48) * 0.05 * currentPrice; // Slight upward bias
    const nextPrice = currentPrice + priceMovement;
    
    // Calculate OHLC values
    const open = currentPrice;
    const close = nextPrice;
    const high = Math.max(open, close) + (Math.random() * Math.abs(close - open) * 0.5);
    const low = Math.min(open, close) - (Math.random() * Math.abs(close - open) * 0.5);
    
    // Add the bar
    bars.push({
      t: currentTime.toISOString(),
      o: parseFloat(open.toFixed(2)),
      h: parseFloat(high.toFixed(2)),
      l: parseFloat(low.toFixed(2)),
      c: parseFloat(close.toFixed(2)),
      v: Math.floor(Math.random() * 1000000) + 10000 // Random volume
    });
    
    // Update current price for next bar
    currentPrice = nextPrice;
  }
  
  return bars;
}

/**
 * Get a base price for a symbol
 */
function getBasePrice(symbol: string): number {
  // Common stock base prices
  const prices: Record<string, number> = {
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
  };
  
  return prices[symbol] || 100.00; // Default to $100 if symbol not found
} 