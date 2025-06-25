import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch quote for a specific options contract
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractSymbol = searchParams.get('contract');

    if (!contractSymbol) {
      return NextResponse.json(
        { error: 'Contract symbol parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching options quote for ${contractSymbol}...`);

    // Use Yahoo Finance chart API for options contract
    const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(contractSymbol)}?interval=1m&range=1d&includePrePost=false`;

    console.log(`Options quote URL: ${quoteUrl}`);

    const response = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance quote API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result || !result.meta) {
      throw new Error(`No quote data available for ${contractSymbol}`);
    }

    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
    
    // Parse contract symbol to get details
    const contractDetails = parseOptionSymbol(contractSymbol);

    const formattedData = {
      contractSymbol,
      price: currentPrice,
      previousClose: meta.previousClose,
      change: meta.regularMarketPrice - meta.previousClose,
      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      bid: meta.bid || 0,
      ask: meta.ask || 0,
      volume: meta.regularMarketVolume || 0,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'yahoo',
      contractDetails
    };

    console.log(`Successfully fetched options quote for ${contractSymbol}: $${currentPrice}`);

    return NextResponse.json(formattedData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
      },
    });

  } catch (error) {
    console.error('Error fetching options quote:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch options quote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Parse option symbol to extract details
 * Format: AAPL240119C00150000 = AAPL Jan 19 2024 $150 Call
 */
function parseOptionSymbol(symbol: string) {
  try {
    // Match pattern: TICKER + YYMMDD + C/P + STRIKE
    const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
    
    if (!match) {
      return { valid: false };
    }

    const [, ticker, dateStr, type, strikeStr] = match;
    
    // Parse date (YYMMDD)
    const year = 2000 + parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    const expirationDate = new Date(year, month - 1, day);
    
    // Parse strike price (divide by 1000)
    const strike = parseInt(strikeStr) / 1000;
    
    // Calculate days to expiry
    const daysToExpiry = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    return {
      valid: true,
      underlying: ticker,
      expiration: expirationDate.toISOString().split('T')[0],
      type: type === 'C' ? 'call' : 'put',
      strike,
      daysToExpiry
    };
  } catch (error) {
    console.error('Error parsing option symbol:', error);
    return { valid: false };
  }
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