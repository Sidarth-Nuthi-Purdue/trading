import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get the authenticated user
    const authHeader = request.headers.get('authorization');
    let userSupabase;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      userSupabase = createClient(
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
    } else {
      userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create user_balances table if it doesn't exist
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_balances (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          balance DECIMAL(15,2) DEFAULT 100000.00,
          available_balance DECIMAL(15,2) DEFAULT 100000.00,
          total_pnl DECIMAL(15,2) DEFAULT 0.00,
          daily_pnl DECIMAL(15,2) DEFAULT 0.00,
          weekly_pnl DECIMAL(15,2) DEFAULT 0.00,
          monthly_pnl DECIMAL(15,2) DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
      `
    });

    // Create trade_orders table if it doesn't exist
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS trade_orders (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          symbol VARCHAR(10) NOT NULL,
          asset_type VARCHAR(20) DEFAULT 'stock',
          side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
          order_type VARCHAR(20) NOT NULL,
          quantity DECIMAL(15,8) NOT NULL,
          price DECIMAL(15,2),
          stop_price DECIMAL(15,2),
          filled_quantity DECIMAL(15,8) DEFAULT 0,
          filled_price DECIMAL(15,2),
          status VARCHAR(20) DEFAULT 'pending',
          time_in_force VARCHAR(10) DEFAULT 'day',
          realized_pnl DECIMAL(15,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          filled_at TIMESTAMP WITH TIME ZONE,
          cancelled_at TIMESTAMP WITH TIME ZONE
        );
      `
    });

    // Create user_portfolios table if it doesn't exist
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_portfolios (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          symbol VARCHAR(10) NOT NULL,
          asset_type VARCHAR(20) DEFAULT 'stock',
          quantity DECIMAL(15,8) NOT NULL,
          average_cost DECIMAL(15,2) NOT NULL,
          total_cost DECIMAL(15,2) NOT NULL,
          current_price DECIMAL(15,2),
          current_value DECIMAL(15,2),
          unrealized_pnl DECIMAL(15,2),
          unrealized_pnl_percentage DECIMAL(8,4),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, symbol, asset_type)
        );
      `
    });

    // Initialize user balance if it doesn't exist
    const { data: existingBalance } = await supabase
      .from('user_balances')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingBalance) {
      await supabase
        .from('user_balances')
        .insert({
          user_id: user.id,
          balance: 100000,
          available_balance: 100000
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      user_id: user.id
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize database', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}