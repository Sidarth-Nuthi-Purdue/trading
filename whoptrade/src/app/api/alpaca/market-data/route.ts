import { NextRequest, NextResponse } from 'next/server';
import { alpacaConfig } from '../config';
import Alpaca from '@alpacahq/alpaca-trade-api';

// Initialize Alpaca client
const alpaca = new Alpaca({
  keyId: alpacaConfig.apiKey,
  secretKey: alpacaConfig.apiSecret,
  paper: alpacaConfig.isPaperTrading,
  baseUrl: alpacaConfig.getBaseUrl(),
  dataBaseUrl: alpacaConfig.dataBaseUrl
});

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol');
    const timeframe = url.searchParams.get('timeframe') || '1Day';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const start = url.searchParams.get('start') || undefined;
    const end = url.searchParams.get('end') || undefined;
    
    // Validate required parameters
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }
    
    // Get bars (candlestick data)
    const bars = await alpaca.getBarsV2(
      symbol,
      {
        timeframe: timeframe as any,
        start: start,
        end: end,
        limit: limit,
        adjustment: 'all'
      }
    );
    
    // Convert iterator to array
    const barsArray = [];
    for await (const bar of bars) {
      barsArray.push({
        timestamp: bar.Timestamp,
        open: bar.OpenPrice,
        high: bar.HighPrice,
        low: bar.LowPrice,
        close: bar.ClosePrice,
        volume: bar.Volume
      });
    }
    
    return NextResponse.json(barsArray);
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 