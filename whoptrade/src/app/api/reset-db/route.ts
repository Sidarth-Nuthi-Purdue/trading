import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Load SQL scripts
const getSQL = (filename: string) => {
  try {
    const filePath = path.join(process.cwd(), 'src/app/api/reset-db/sql', filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error loading SQL file ${filename}:`, error);
    return '';
  }
};

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apply paper trading schema
    // This schema is embedded in the code to ensure it's always available
    const schema = `
    -- Enable UUID extension if not already enabled
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Trading Accounts Table
    CREATE TABLE IF NOT EXISTS trading_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        balance DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create index on user_id
    CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);

    -- Trading Orders Table
    CREATE TABLE IF NOT EXISTS trading_orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
        quantity DECIMAL(15, 6) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
        status VARCHAR(10) NOT NULL CHECK (status IN ('placing', 'working', 'filled', 'canceled', 'rejected', 'inactive')),
        limit_price DECIMAL(15, 6),
        stop_price DECIMAL(15, 6),
        filled_price DECIMAL(15, 6),
        filled_quantity DECIMAL(15, 6),
        filled_at TIMESTAMP WITH TIME ZONE,
        parent_order_id UUID REFERENCES trading_orders(id),
        is_take_profit BOOLEAN DEFAULT FALSE,
        is_stop_loss BOOLEAN DEFAULT FALSE,
        take_profit DECIMAL(15, 6),
        stop_loss DECIMAL(15, 6),
        is_close BOOLEAN DEFAULT FALSE,
        client_order_id VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create indices for orders
    CREATE INDEX IF NOT EXISTS idx_trading_orders_account_id ON trading_orders(account_id);
    CREATE INDEX IF NOT EXISTS idx_trading_orders_symbol ON trading_orders(symbol);
    CREATE INDEX IF NOT EXISTS idx_trading_orders_status ON trading_orders(status);

    -- Trading Positions Table
    CREATE TABLE IF NOT EXISTS trading_positions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
        quantity DECIMAL(15, 6) NOT NULL DEFAULT 0,
        avg_price DECIMAL(15, 6) NOT NULL,
        take_profit DECIMAL(15, 6),
        stop_loss DECIMAL(15, 6),
        closed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create indices for positions
    CREATE INDEX IF NOT EXISTS idx_trading_positions_account_id ON trading_positions(account_id);
    CREATE INDEX IF NOT EXISTS idx_trading_positions_symbol ON trading_positions(symbol);

    -- Trading Executions Table
    CREATE TABLE IF NOT EXISTS trading_executions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES trading_orders(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
        price DECIMAL(15, 6) NOT NULL,
        quantity DECIMAL(15, 6) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create indices for executions
    CREATE INDEX IF NOT EXISTS idx_trading_executions_account_id ON trading_executions(account_id);
    CREATE INDEX IF NOT EXISTS idx_trading_executions_order_id ON trading_executions(order_id);
    CREATE INDEX IF NOT EXISTS idx_trading_executions_symbol ON trading_executions(symbol);

    -- Trading History Table for completed trades
    CREATE TABLE IF NOT EXISTS trading_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
        quantity DECIMAL(15, 6) NOT NULL,
        entry_price DECIMAL(15, 6) NOT NULL,
        exit_price DECIMAL(15, 6) NOT NULL,
        realized_pl DECIMAL(15, 6) NOT NULL,
        entry_at TIMESTAMP WITH TIME ZONE NOT NULL,
        exit_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Create indices for history
    CREATE INDEX IF NOT EXISTS idx_trading_history_account_id ON trading_history(account_id);
    CREATE INDEX IF NOT EXISTS idx_trading_history_symbol ON trading_history(symbol);
    `;

    // Execute the schema
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('Error applying schema:', error);
      return NextResponse.json(
        { error: `Failed to apply schema: ${error.message}` },
        { status: 500 }
      );
    }

    // Create a trading account for the current user if one doesn't exist
    const { data: existingAccount, error: accountError } = await supabase
      .from('trading_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingAccount && !accountError) {
      const { error: createError } = await supabase
        .from('trading_accounts')
        .insert([
          { user_id: user.id, balance: 10000.00 }
        ]);

      if (createError) {
        console.error('Error creating trading account:', createError);
        return NextResponse.json(
          { error: `Failed to create trading account: ${createError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error initializing database' },
      { status: 500 }
    );
  }
} 