import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      );
    }
    
    const cookieStore = cookies();
    
    // Initialize Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );
    
    // Check if we can execute SQL
    let canExecuteSQL = false;
    try {
      const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', { 
        sql: 'SELECT version();' 
      });
      
      if (sqlError) {
        console.error('Cannot execute SQL:', sqlError);
      } else {
        canExecuteSQL = true;
      }
    } catch (error) {
      console.error('Error checking SQL execution:', error);
    }
    
    // Check auth.users table
    let authUsersExists = false;
    try {
      const { data: authResult, error: authError } = await supabase
        .from('auth.users')
        .select('count(*)')
        .limit(1);
      
      if (authError) {
        console.error('Cannot access auth.users:', authError);
      } else {
        authUsersExists = true;
      }
    } catch (error) {
      console.error('Error checking auth.users:', error);
    }
    
    // Check if public.users table exists
    let publicUsersExists = false;
    try {
      const { data: usersResult, error: usersError } = await supabase
        .from('users')
        .select('count(*)')
        .limit(1);
      
      if (usersError) {
        console.error('Cannot access public.users:', usersError);
      } else {
        publicUsersExists = true;
      }
    } catch (error) {
      console.error('Error checking public.users:', error);
    }
    
    // Check if virtual_trading_accounts table exists
    let vtaExists = false;
    try {
      const { data: vtaResult, error: vtaError } = await supabase
        .from('virtual_trading_accounts')
        .select('count(*)')
        .limit(1);
      
      if (vtaError) {
        console.error('Cannot access virtual_trading_accounts:', vtaError);
      } else {
        vtaExists = true;
      }
    } catch (error) {
      console.error('Error checking virtual_trading_accounts:', error);
    }
    
    // Create tables if they don't exist
    const fixes = [];
    
    if (!publicUsersExists && canExecuteSQL) {
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: `
            CREATE TABLE IF NOT EXISTS public.users (
              id UUID PRIMARY KEY,
              email TEXT NOT NULL,
              first_name TEXT,
              last_name TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
            );
          `
        });
        
        if (error) {
          fixes.push({ table: 'users', status: 'failed', error: error.message });
        } else {
          fixes.push({ table: 'users', status: 'created' });
          publicUsersExists = true;
        }
      } catch (error: any) {
        fixes.push({ table: 'users', status: 'failed', error: error.message });
      }
    }
    
    if (!vtaExists && canExecuteSQL) {
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: `
            CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id UUID NOT NULL,
              balance DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
              status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
              UNIQUE(user_id)
            );
          `
        });
        
        if (error) {
          fixes.push({ table: 'virtual_trading_accounts', status: 'failed', error: error.message });
        } else {
          fixes.push({ table: 'virtual_trading_accounts', status: 'created' });
          vtaExists = true;
        }
      } catch (error: any) {
        fixes.push({ table: 'virtual_trading_accounts', status: 'failed', error: error.message });
      }
    }
    
    return NextResponse.json({
      supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      canExecuteSQL,
      tables: {
        'auth.users': authUsersExists,
        'public.users': publicUsersExists,
        'virtual_trading_accounts': vtaExists
      },
      fixes
    });
    
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { 
        error: 'Debug endpoint error',
        message: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 