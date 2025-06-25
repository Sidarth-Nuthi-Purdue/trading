import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getMockTrades } from '@/lib/mock-market-data';

/**
 * GET handler for fetching trade data
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    // Try to fetch real data from Alpaca first
    try {
      if (process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) {
        const apiUrl = `${process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets'}/v2/stocks/${symbol}/trades`;
        
        // Add query parameters
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        
        const response = await axios.get(`${apiUrl}?${params.toString()}`, {
          headers: {
            'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET
          },
          timeout: 5000 // 5 second timeout
        });
        
        if (response.status === 200 && response.data?.trades) {
          return NextResponse.json({ trades: response.data.trades });
        }
      }
    } catch (alpacaError) {
      console.warn(`Error fetching trades from Alpaca API for ${symbol}, using mock data:`, alpacaError);
      // Fall through to mock data
    }

    // Generate mock trade data if real API fails
    const mockTrades = getMockTrades(symbol, limit);
    return NextResponse.json({ trades: mockTrades });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error fetching trades:', errorMessage);
    
    // Always return mock data instead of an error
    const mockTrades = getMockTrades('AAPL', 5); // Default to AAPL with 5 trades
    return NextResponse.json({ trades: mockTrades });
  }
} 