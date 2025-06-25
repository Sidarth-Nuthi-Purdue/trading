import { NextRequest, NextResponse } from 'next/server';
import { getSession, fetchLatestQuote, fetchLatestQuotes } from '@/lib/alpaca-server';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Check authentication status
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const symbols = searchParams.get('symbols');
    const symbol = searchParams.get('symbol');
    
    // Check if we have either a symbol or symbols parameter
    if (!symbols && !symbol) {
      return NextResponse.json(
        { error: 'No symbol(s) provided. Use "symbol" for a single stock or "symbols" for multiple.' },
        { status: 400 }
      );
    }
    
    // Fetch data from Alpaca based on the provided parameters
    let data;
    
    try {
      if (symbols) {
        // For multiple symbols
        data = await fetchLatestQuotes(symbols.split(','));
      } else if (symbol) {
        // For a single symbol
        data = await fetchLatestQuote(symbol);
      }
      
      // For a single symbol, format the response to be consistent
      if (symbol) {
        return NextResponse.json({
          quote: data
        });
      }
      
      // For multiple symbols, return the data as is
      return NextResponse.json(data);
    } catch (error: any) {
      console.error('Error from Alpaca API:', error.message);
      
      return NextResponse.json(
        { error: `Failed to fetch quote(s): ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/alpaca/market-data/quotes/latest:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 