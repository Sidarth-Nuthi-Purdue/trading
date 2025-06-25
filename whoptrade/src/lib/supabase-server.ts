import { createClient } from '@supabase/supabase-js';

// Create a basic Database type if it doesn't exist
export type Database = {
  public: {
    Tables: {
      virtual_trading_accounts: {
        Row: {
          id: string;
          user_id: string;
          cash_balance: number;
          portfolio_value: number;
          total_value: number;
          total_deposits: number;
          total_withdrawals: number;
          realized_pl: number;
          unrealized_pl: number;
          realized_pl_percent: number;
          unrealized_pl_percent: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
      };
      virtual_positions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          symbol: string;
          quantity: number;
          average_entry_price: number;
          current_price: number;
          market_value: number;
          cost_basis: number;
          unrealized_pl: number;
          unrealized_pl_percent: number;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};

/**
 * Creates a Supabase client for server-side usage with direct token support
 * @param accessToken Optional access token for authenticated requests
 */
export function createServerSupabaseClient(accessToken?: string) {
  const options = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Force cookies to not be secure in development to avoid issues with local http
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/'
      }
    },
    global: accessToken ? {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    } : undefined
  };

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  );
}

/**
 * Fixes authentication cookies for Supabase
 * This can be called to ensure cookies are set correctly after login/logout
 */
export async function fixAuthCookies() {
  const supabase = createServerSupabaseClient();
  
  // Force a session refresh which recreates cookies properly
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error fixing auth cookies:', error);
  }
  
  return data;
}