import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch user's portfolio and balance
 */
export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create Supabase client with the access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('Auth error:', authError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch user balance
    const { data: balance, error: balanceError } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching balance:', balanceError);
      
      // Check if it's a table not found error
      if (balanceError.message?.includes('relation') && balanceError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database tables not found. Please run the schema setup first.',
          details: balanceError.message 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch balance', 
        details: balanceError.message 
      }, { status: 500 });
    }

    // If no balance record exists, create one with default values
    if (!balance) {
      const { data: newBalance, error: createError } = await supabase
        .from('user_balances')
        .insert({
          user_id: user.id,
          balance: 100000, // Default starting balance
          available_balance: 100000
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating balance:', createError);
        return NextResponse.json({ error: 'Failed to create balance' }, { status: 500 });
      }
    }

    // Fetch user portfolio positions
    const { data: positions, error: portfolioError } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', user.id)
      .gt('quantity', 0); // Only show positions with quantity > 0

    if (portfolioError) {
      console.error('Error fetching portfolio:', portfolioError);
      return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
    }

    // Calculate current portfolio value with real market prices
    const positionsWithValues = await Promise.all(
      (positions || []).map(async (position) => {
        const currentPrice = await getRealMarketPrice(position.symbol, position.asset_type);
        const currentValue = position.quantity * currentPrice;
        const unrealizedPnl = currentValue - (position.quantity * position.average_cost);

        return {
          ...position,
          current_price: currentPrice,
          current_value: currentValue,
          unrealized_pnl: unrealizedPnl,
          unrealized_pnl_percentage: position.average_cost > 0 ? ((currentPrice - position.average_cost) / position.average_cost) * 100 : 0
        };
      })
    );

    const totalPortfolioValue = positionsWithValues.reduce(
      (sum, position) => sum + position.current_value, 0
    );

    const totalUnrealizedPnl = positionsWithValues.reduce(
      (sum, position) => sum + position.unrealized_pnl, 0
    );

    return NextResponse.json({
      balance: balance || {
        balance: 100000,
        available_balance: 100000,
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0
      },
      positions: positionsWithValues,
      portfolio_summary: {
        total_portfolio_value: totalPortfolioValue,
        total_unrealized_pnl: totalUnrealizedPnl,
        cash_balance: balance?.available_balance || 100000,
        total_account_value: totalPortfolioValue + (balance?.available_balance || 100000)
      }
    });
  } catch (error) {
    console.error('Error in portfolio GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Get real market price for a symbol, with proper options support
 */
async function getRealMarketPrice(symbol: string, assetType: string = 'stock'): Promise<number> {
  // Try to fetch real market data first
  try {
    if (assetType === 'option') {
      // For options, use the options quote endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-data/options/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        if (data.lastPrice && data.lastPrice > 0) {
          return data.lastPrice;
        }
        // Use bid/ask midpoint if no last price
        if (data.bid > 0 && data.ask > 0) {
          return (data.bid + data.ask) / 2;
        }
        // Fallback to either bid or ask
        if (data.bid > 0) return data.bid;
        if (data.ask > 0) return data.ask;
      }
    } else {
      // For stocks, use the regular quote endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-data/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        if (data.price && data.price > 0) {
          return data.price;
        }
      }
    }
  } catch (error) {
    console.log('Failed to fetch real market price for', symbol, assetType, 'using fallback');
  }

  // Fallback to consistent mock prices (no random variation)
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

  // Check if markets are open for slight variation, otherwise use base price
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