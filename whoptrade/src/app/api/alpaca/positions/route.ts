import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getMockPositions } from '@/lib/mock-market-data';

/**
 * GET handler for fetching all positions for the user's account
 */
export async function GET(req: NextRequest) {
  try {
    // Get the user's account ID
    const supabase = createServerSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.warn('User authentication failed, using mock data');
      return NextResponse.json(getMockPositions(5));
    }
    
    // Get trading account info from database
    const { data: accountData, error: accountError } = await supabase
      .from('trading_accounts')
      .select('id, alpaca_account_id')
      .eq('user_id', userData.user.id)
      .single();
    
    if (accountError || !accountData?.alpaca_account_id) {
      console.warn('No Alpaca account found for user, using mock data');
      return NextResponse.json(getMockPositions(5));
    }
    
    // Try to get positions from Alpaca API
    try {
      if (process.env.ALPACA_BROKER_API_KEY && process.env.ALPACA_BROKER_API_SECRET) {
        const response = await axios.get(
          `${process.env.ALPACA_BROKER_BASE_URL || 'https://broker-api.sandbox.alpaca.markets'}/v1/trading/accounts/${accountData.alpaca_account_id}/positions`,
          {
            headers: {
              'APCA-API-KEY-ID': process.env.ALPACA_BROKER_API_KEY,
              'APCA-API-SECRET-KEY': process.env.ALPACA_BROKER_API_SECRET
            },
            timeout: 5000
          }
        );
        
        if (response.status === 200 && Array.isArray(response.data)) {
          return NextResponse.json(response.data);
        }
      }
    } catch (alpacaError) {
      console.warn('Error fetching positions from Alpaca API, falling back to mock data:', alpacaError);
    }
    
    // Fall back to mock data
    return NextResponse.json(getMockPositions(5));
  } catch (error) {
    console.error('Error fetching positions:', error);
    // Always return mock data rather than an error
    return NextResponse.json(getMockPositions(5));
  }
}

// DELETE endpoint to close a position
export async function DELETE(req: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const symbol = url.searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }
    
    // Mock closing a position - just return success
    return NextResponse.json({ 
      success: true, 
      result: {
        symbol,
        qty: '0',
        side: 'closed',
        exit_price: getSymbolPrice(symbol),
        exit_time: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error closing position:', error);
    return NextResponse.json(
      { error: 'Failed to close position', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get price for a symbol (mock data)
 */
function getSymbolPrice(symbol: string): string {
  const prices: Record<string, string> = {
    AAPL: '175.50',
    MSFT: '335.15',
    TSLA: '245.75',
    AMZN: '130.25',
    GOOGL: '140.80',
    META: '290.35',
  };
  
  return prices[symbol] || '100.00';
}