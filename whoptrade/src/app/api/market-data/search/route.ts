import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Ensure the route is always fresh and not cached
export const dynamic = 'force-dynamic';

/**
 * Endpoint to search for symbols
 * Uses Yahoo Finance API as a free alternative to Alpaca
 */
export async function GET(request: NextRequest) {
  try {
    // Get the query from the query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Use Yahoo Finance API to search for symbols
    const yahooApiUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0&enableFuzzyQuery=false&enableEnhancedTrivialQuery=true`;
    
    const response = await fetch(yahooApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract the search results
    const quotes = data.quotes || [];
    
    // Format the response
    const symbols = quotes
      .filter((quote: any) => quote.symbol && quote.shortname)
      .map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        exchange: quote.exchange || '',
        type: quote.quoteType?.toLowerCase() || 'stock'
      }));

    // Set CORS headers
    const headersList = headers();
    const origin = headersList.get('origin');
    
    return NextResponse.json(
      { symbols },
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
    console.error('Error searching symbols:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Map Yahoo Finance quote types to our format
 */
function mapQuoteType(quoteType: string): string {
  switch (quoteType?.toLowerCase()) {
    case 'equity':
      return 'stock';
    case 'etf':
      return 'etf';
    case 'index':
      return 'index';
    case 'cryptocurrency':
      return 'crypto';
    case 'currency':
      return 'forex';
    case 'futures':
      return 'futures';
    default:
      return 'stock';
  }
} 