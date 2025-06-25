import { NextResponse } from 'next/server';
import { getSession } from '@/lib/alpaca-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/utils/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check authentication status using our utility
    const session = await getSession();
    
    if (!session || !session.user) {
      console.error('No authenticated user found');
      return NextResponse.json({ error: 'You must be logged in to access account information' }, { status: 401 });
    }
    
    const user = session.user;
    console.log('User authenticated:', user.id);
    
    // Create a Supabase client with the session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Get or create a virtual trading account for the user
    const { data: virtualAccount, error: accountError } = await supabase
      .from('virtual_trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (accountError && accountError.code !== 'PGRST116') { // PGRST116 is 'no rows returned'
      console.error('Error fetching account:', accountError.message);
      throw accountError;
    }
    
    let accountData = virtualAccount;

    // Create a new account if none exists
    if (!virtualAccount) {
      console.log('Creating new virtual trading account');
      const { data: newAccount, error: createError } = await supabase
        .from('virtual_trading_accounts')
        .insert({ 
          user_id: user.id,
          cash_balance: 100000, // Start with $100k
          portfolio_value: 0,
          total_value: 100000,
          status: 'ACTIVE'
        })
        .select()
        .single();
        
      if (createError) {
        console.error('Account creation error:', createError.message);
        throw createError;
      }
      
      accountData = newAccount;
    }
    
    if (!accountData) {
      throw new Error("Failed to create or find user account.");
    }
    
    // Map to the structure expected by the frontend
    const account = {
      id: accountData.id,
      account_number: `VT-${user.id.substring(0, 8)}`,
      status: accountData.status || 'ACTIVE',
      currency: 'USD',
      buying_power: ((accountData.cash_balance || 0) * 2).toString(), // Simulate 2x margin
      cash: (accountData.cash_balance || 0).toString(),
      portfolio_value: (accountData.portfolio_value || 0).toString(),
      total_value: (accountData.total_value || accountData.cash_balance || 0).toString(),
      created_at: accountData.created_at || new Date().toISOString(),
      pattern_day_trader: false,
      trading_blocked: false,
      multiplier: '2',
      equity: (accountData.total_value || accountData.cash_balance || 0).toString(),
      last_equity: (accountData.total_value || accountData.cash_balance || 0).toString(),
    };

    return NextResponse.json({ account });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching trading account:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch account', details: errorMessage },
      { status: 500 }
    );
  }
} 