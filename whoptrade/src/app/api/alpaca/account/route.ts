import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getAccount } from '@/lib/alpaca-broker-api';

export async function GET(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'User not authenticated' },
        { status: 401 }
      );
    }
    
    try {
      // Get the user's trading account from Supabase
      const { data: tradingAccount, error: tradingAccountError } = await supabase
        .from('trading_accounts')
        .select('alpaca_account_id')
        .eq('user_id', user.id)
        .single();
      
      if (tradingAccountError) {
        if (tradingAccountError.code === '42P01') {
          // The table doesn't exist, return a specific error message
          return NextResponse.json(
            { 
              error: 'Database setup required', 
              details: 'The trading_accounts table does not exist. Please run the SQL setup script.',
              setupRequired: true 
            },
            { status: 500 }
          );
        } else if (tradingAccountError.code === 'PGRST116') {
          // No trading account found for this user
          return NextResponse.json(
            { error: 'No trading account found for this user' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { error: 'Failed to fetch trading account', details: tradingAccountError.message },
          { status: 500 }
        );
      }
      
      // Get detailed account information from Alpaca
      const alpacaAccount = await getAccount(tradingAccount.alpaca_account_id);
      
      // Return formatted account information
      return NextResponse.json({
        id: tradingAccount.alpaca_account_id,
        accountNumber: alpacaAccount.account_number,
        status: alpacaAccount.status,
        buyingPower: alpacaAccount.buying_power,
        cash: alpacaAccount.cash,
        currency: alpacaAccount.currency,
        equity: alpacaAccount.equity,
        lastEquity: alpacaAccount.last_equity,
        portfolioValue: alpacaAccount.portfolio_value,
        daytradeCount: alpacaAccount.daytrade_count,
        tradingBlocked: alpacaAccount.trading_blocked,
        transfersBlocked: alpacaAccount.transfers_blocked,
        accountBlocked: alpacaAccount.account_blocked,
        shortingEnabled: alpacaAccount.shorting_enabled,
        longMarketValue: alpacaAccount.long_market_value,
        shortMarketValue: alpacaAccount.short_market_value,
        patternDayTrader: alpacaAccount.pattern_day_trader,
        createdAt: alpacaAccount.created_at
      });
    } catch (error) {
      console.error('Error fetching account from Alpaca:', error);
      
      // Return error response
      return NextResponse.json(
        { error: 'Failed to fetch account from Alpaca API', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in account route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update account settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Only allow specific fields to be updated
    const updateableFields = ['dtbp_check', 'trade_confirm_email', 'suspend_trade'];
    const updateData: any = {};
    
    updateableFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    
    // Update account
    const result = await alpaca.patchAccount(updateData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 