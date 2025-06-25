import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

/**
 * Endpoint to fetch current/live quote for a symbol
 * Uses Yahoo Finance API for real-time quotes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching current quote for ${symbol}...`);

    // Try Alpaca first if we have credentials
    const alpacaApiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY || process.env.ALPACA_API_KEY;
    const alpacaApiSecret = process.env.NEXT_PUBLIC_ALPACA_API_SECRET || process.env.ALPACA_API_SECRET;

    if (alpacaApiKey && alpacaApiSecret) {
      try {
        const alpacaDataUrl = process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets';
        const alpacaUrl = `${alpacaDataUrl}/v2/stocks/${symbol}/quotes/latest`;
        
        console.log(`Trying Alpaca quote API: ${alpacaUrl}`);
        
        const alpacaResponse = await axios.get(alpacaUrl, {
          headers: {
            'APCA-API-KEY-ID': alpacaApiKey,
            'APCA-API-SECRET-KEY': alpacaApiSecret
          },
          timeout: 5000
        });
        
        if (alpacaResponse.status === 200 && alpacaResponse.data.quote) {
          const quote = alpacaResponse.data.quote;
          const price = (quote.bp + quote.ap) / 2; // Average of bid and ask
          
          console.log(`Successfully fetched current quote from Alpaca for ${symbol}: $${price}`);
          
          return NextResponse.json({
            symbol,
            price,
            bid: quote.bp,
            ask: quote.ap,
            timestamp: new Date(quote.t).getTime() / 1000,
            source: 'alpaca'
          });
        }
      } catch (alpacaError) {
        console.warn('Alpaca quote API failed, falling back to Yahoo Finance:', alpacaError);
      }
    }

    try {
      // Temporarily disable Yahoo Finance API to use consistent mock prices
      throw new Error('Using mock prices for consistency');
      
      // Fallback to Yahoo Finance quote API (disabled for price consistency)
      const yahooQuoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;
      
      console.log(`Trying Yahoo Finance quote: ${yahooQuoteUrl}`);
      
      const response = await fetch(yahooQuoteUrl, {
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
        throw new Error(`No quote data available for ${symbol}`);
      }

      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice || meta.previousClose;
      
      if (!currentPrice || currentPrice <= 0) {
        throw new Error(`Invalid price data for ${symbol}`);
      }

      console.log(`Successfully fetched current quote from Yahoo for ${symbol}: $${currentPrice}`);
      
      return NextResponse.json({
        symbol,
        price: currentPrice,
        previousClose: meta.previousClose,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
        timestamp: Math.floor(Date.now() / 1000),
        source: 'yahoo'
      });
      
    } catch (error) {
      console.error('Error fetching from Yahoo Finance quote (using mock for consistency):', error);
      
      // Fall back to mock price
      const mockPrice = getMockPrice(symbol);
      console.log(`Falling back to mock quote for ${symbol}: $${mockPrice}`);
      
      return NextResponse.json({
        symbol,
        price: mockPrice,
        timestamp: Math.floor(Date.now() / 1000),
        source: 'mock'
      });
    }
    
  } catch (error) {
    console.error('Error in quote API:', error);
    
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'UNKNOWN';
    const mockPrice = getMockPrice(symbol);
    
    return NextResponse.json({
      symbol,
      price: mockPrice,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'mock'
    });
  }
}

/**
 * Generate consistent mock price for a symbol with market hours consideration
 */
function getMockPrice(symbol: string): number {
  const mockPrices: Record<string, number> = {
    'AAPL': 201.00, // Updated to match current trading price
    'MSFT': 335.15,
    'AMZN': 130.25,
    'GOOGL': 140.80,
    'META': 290.35,
    'TSLA': 245.75,
    'NVDA': 425.65,
    'AMD': 155.20,
    'INTC': 45.80,
    'NFLX': 410.30,
    'SPY': 445.20,
    'QQQ': 375.80,
    'IWM': 195.45,
    'GLD': 180.30,
    'TLT': 95.75
  };

  // Check if markets are open (9:30 AM - 4:00 PM ET, Monday-Friday)
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  const day = easternTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  const isWeekday = day >= 1 && day <= 5;
  const isMarketHours = isWeekday && 
    ((hour > 9) || (hour === 9 && minute >= 30)) && 
    (hour < 16);

  const basePrice = mockPrices[symbol] || 100;
  
  if (isMarketHours) {
    // During market hours, add small random variation (±0.3%)
    const variation = (Math.random() - 0.5) * 0.006;
    return parseFloat((basePrice * (1 + variation)).toFixed(2));
  } else {
    // After hours, use consistent price
    return basePrice;
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