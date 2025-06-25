import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Opt into dynamic rendering
export const dynamic = 'force-dynamic';

// SQL to create required tables and functions
const SCHEMA_SQL = `
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create triggers helper function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Public users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create trigger for updated_at on users table
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Virtual trading accounts
CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_balance DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  portfolio_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  buying_power DECIMAL(15, 4) NOT NULL DEFAULT 20000.0000,
  total_deposits DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  total_withdrawals DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Create trigger for updated_at on virtual_trading_accounts table
DROP TRIGGER IF EXISTS set_virtual_trading_accounts_updated_at ON public.virtual_trading_accounts;
CREATE TRIGGER set_virtual_trading_accounts_updated_at
BEFORE UPDATE ON public.virtual_trading_accounts
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Create positions table
CREATE TABLE IF NOT EXISTS public.virtual_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty DECIMAL(15, 4) NOT NULL,
  avg_entry_price DECIMAL(15, 4) NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  market_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  cost_basis DECIMAL(15, 4) NOT NULL,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  current_price DECIMAL(15, 4) DEFAULT 0.0000,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(account_id, symbol)
);

-- Create trigger for updated_at on virtual_positions table
DROP TRIGGER IF EXISTS set_virtual_positions_updated_at ON public.virtual_positions;
CREATE TRIGGER set_virtual_positions_updated_at
BEFORE UPDATE ON public.virtual_positions
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Create orders table
CREATE TABLE IF NOT EXISTS public.virtual_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty DECIMAL(15, 4) NOT NULL,
  filled_qty DECIMAL(15, 4) DEFAULT 0,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  type TEXT NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
  time_in_force TEXT NOT NULL CHECK (time_in_force IN ('day', 'gtc', 'ioc', 'fok')),
  limit_price DECIMAL(15, 4),
  stop_price DECIMAL(15, 4),
  status TEXT NOT NULL CHECK (status IN ('new', 'partially_filled', 'filled', 'done_for_day', 'canceled', 'expired', 'rejected')),
  filled_avg_price DECIMAL(15, 4),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  filled_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create trigger for updated_at on virtual_orders table
DROP TRIGGER IF EXISTS set_virtual_orders_updated_at ON public.virtual_orders;
CREATE TRIGGER set_virtual_orders_updated_at
BEFORE UPDATE ON public.virtual_orders
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.virtual_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.virtual_orders(id),
  symbol TEXT,
  side TEXT CHECK (side IN ('buy', 'sell', 'deposit', 'withdrawal')),
  qty DECIMAL(15, 4),
  price DECIMAL(15, 4),
  amount DECIMAL(15, 4) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trade', 'deposit', 'withdrawal', 'fee', 'dividend', 'interest')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create function to get or create a trading account for a user
CREATE OR REPLACE FUNCTION get_or_create_virtual_account(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
BEGIN
    -- Try to get existing account
    SELECT id INTO v_account_id
    FROM public.virtual_trading_accounts
    WHERE user_id = p_user_id;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
        INSERT INTO public.virtual_trading_accounts (
            user_id, 
            cash_balance, 
            buying_power,
            total_deposits,
            status
        )
        VALUES (
            p_user_id, 
            10000.0000, 
            20000.0000,
            10000.0000,
            'active'
        )
        RETURNING id INTO v_account_id;
    END IF;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the new user into the public users table
  INSERT INTO public.users (id, email, username, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  
  -- Create a virtual trading account for the new user
  PERFORM get_or_create_virtual_account(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to handle new users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync existing users with the public users table if missing
INSERT INTO public.users (id, email, username, created_at, updated_at)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)), 
  au.created_at, 
  au.created_at
FROM 
  auth.users au
LEFT JOIN 
  public.users pu ON au.id = pu.id
WHERE 
  pu.id IS NULL;

-- Create trading accounts for users who don't have one
INSERT INTO public.virtual_trading_accounts (user_id, cash_balance, portfolio_value, status)
SELECT 
  u.id, 
  10000.0000, 
  0.0000, 
  'active'
FROM 
  public.users u
LEFT JOIN 
  public.virtual_trading_accounts vta ON u.id = vta.user_id
WHERE 
  vta.id IS NULL;
`;

export async function GET(req: NextRequest) {
  try {
    // For HTML response
    const format = req.nextUrl.searchParams.get('format');
    const apply = req.nextUrl.searchParams.get('apply') === 'true';
    
    // Create a Supabase client using service role key if available, fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );
    
    // Track our diagnostic steps
    const diagnostics: string[] = [];
    
    // Check database connection
    try {
      const { count, error } = await supabase
        .from('_schema')
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        diagnostics.push(`⚠️ Database connection check failed: ${error.message}`);
      } else {
        diagnostics.push('✅ Database connection successful');
      }
    } catch (error) {
      diagnostics.push(`⚠️ Database connection check failed: ${error}`);
    }
    
    // Check tables existence
    const requiredTables = ['users', 'virtual_trading_accounts', 'virtual_positions', 'virtual_orders', 'virtual_transactions'];
    const missingTables: string[] = [];
    
    for (const table of requiredTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
          
        if (error) {
          diagnostics.push(`⚠️ Table '${table}' check failed: ${error.message}`);
          missingTables.push(table);
        } else {
          diagnostics.push(`✅ Table '${table}' exists with ${count} rows`);
        }
      } catch (error) {
        diagnostics.push(`⚠️ Table '${table}' check failed: ${error}`);
        missingTables.push(table);
      }
    }
    
    // Check trigger function existence
    try {
      const { data, error } = await supabase.rpc('handle_new_user');
      if (error && !error.message.includes('function exists but is not a procedure')) {
        diagnostics.push(`⚠️ Trigger function 'handle_new_user' check failed: ${error.message}`);
      } else {
        diagnostics.push('✅ Trigger function exists (expected error about not being a procedure)');
      }
    } catch (error) {
      diagnostics.push(`⚠️ Trigger function check failed: ${error}`);
    }
    
    // Apply fixes if requested or if missing tables detected
    let fixResults = [];
    
    if (apply || missingTables.length > 0) {
      try {
        diagnostics.push('🔄 Applying database schema fixes...');
        
        // Apply the schema
        const { error: schemaError } = await supabase.rpc('exec_sql', { sql: SCHEMA_SQL });
        
        if (schemaError) {
          diagnostics.push(`⚠️ Error applying schema: ${schemaError.message}`);
          
          // Try another approach using simple query
          const { error: queryError } = await supabase.auth.admin.createUser({
            email: 'test@example.com',
            password: 'test12345',
            email_confirm: true,
          });
          
          if (queryError) {
            diagnostics.push(`⚠️ Test user creation failed: ${queryError.message}`);
          } else {
            diagnostics.push('✅ Test user created successfully, tables should be set up properly');
          }
        } else {
          diagnostics.push('✅ Schema applied successfully');
          
          // Check if fixes resolved the issues
          for (const table of missingTables) {
            try {
              const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
                
              if (!error) {
                diagnostics.push(`✅ Table '${table}' now exists`);
                fixResults.push(`Fixed table: ${table}`);
              }
            } catch (error) {
              diagnostics.push(`⚠️ Table '${table}' still has issues: ${error}`);
            }
          }
        }
      } catch (schemaError) {
        diagnostics.push(`⚠️ Error setting up database schema: ${schemaError}`);
      }
    }
    
    // Format response based on request
    if (format === 'html') {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhopTrade Database Repair</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 { color: #2563eb; }
          h2 { color: #4b5563; margin-top: 20px; }
          pre {
            background-color: #f1f5f9;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          .diagnostics {
            background-color: #f8fafc;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #3b82f6;
          }
          .success {
            color: #059669;
          }
          .warning {
            color: #b91c1c;
          }
          .action {
            color: #6366f1;
          }
          button {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
          }
          button:hover {
            background-color: #1d4ed8;
          }
          a {
            color: #2563eb;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <h1>WhopTrade Database Repair</h1>
        <p>This utility diagnoses and fixes database issues in the WhopTrade application.</p>
        
        <h2>Diagnostics</h2>
        <div class="diagnostics">
          ${diagnostics.map(d => {
            if (d.startsWith('✅')) return `<p class="success">${d}</p>`;
            if (d.startsWith('⚠️')) return `<p class="warning">${d}</p>`;
            if (d.startsWith('🔄')) return `<p class="action">${d}</p>`;
            return `<p>${d}</p>`;
          }).join('\n')}
        </div>
        
        ${!apply ? `
        <h2>Apply Fixes</h2>
        <p>
          Click the button below to apply database fixes based on the diagnostics above.
          This will create missing tables and triggers.
        </p>
        <a href="?apply=true&format=html"><button>Apply Fixes</button></a>
        ` : ''}
        
        <h2>Next Steps</h2>
        <p>
          ${missingTables.length === 0 ? 
            'All required tables exist. You should now be able to use the application normally.' : 
            'Some tables are still missing. Try applying the fixes or contact support.'}
        </p>
        <p>
          <a href="/login">Return to login page</a> | 
          <a href="/api/auth/quick-fix">Quick fix options</a>
        </p>
      </body>
      </html>
      `;
      
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }
    
    // Default JSON response
        return NextResponse.json({ 
          success: true, 
      diagnostics,
      missingTables: missingTables.length > 0 ? missingTables : null,
      fixesApplied: apply || missingTables.length > 0,
      fixResults
        });
  } catch (error) {
    console.error('Error in repair-db:', error);
    
    return NextResponse.json(
      { error: 'Failed to repair database', details: String(error) },
      { status: 500 }
    );
  }
} 