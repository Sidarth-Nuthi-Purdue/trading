import { NextRequest, NextResponse } from 'next/server';
import { getAlpacaHeaders } from '@/utils/alpaca';
import { ALPACA_API_BASE_URL } from '@/utils/env';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get the symbol from the query parameters
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const symbols = searchParams.get('symbols');
    
    if (!symbol && !symbols) {
      return NextResponse.json(
        { error: 'No symbol or symbols provided' },
        { status: 400 }
      );
    }
    
    // Construct the API URL based on the provided parameters
    let url;
    if (symbol) {
      // Single symbol quote
      url = `${ALPACA_API_BASE_URL}/stocks/${symbol}/quotes/latest`;
    } else {
      // Multiple symbols quote
      url = `${ALPACA_API_BASE_URL}/stocks/quotes/latest?symbols=${symbols}`;
    }
    
    // Forward the request to Alpaca with our API keys
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAlpacaHeaders(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    // Handle any errors from the Alpaca API
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Alpaca API error (${response.status}):`, errorText);
      
      return NextResponse.json(
        { error: `Failed to fetch quote: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Get the JSON response from Alpaca
    const data = await response.json();
    
    // Return the data with no-cache headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error in quote proxy:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 