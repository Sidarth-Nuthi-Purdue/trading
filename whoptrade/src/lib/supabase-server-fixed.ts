import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// Standardize cookie name to avoid issues
const AUTH_COOKIE_NAME = 'sb-auth-token';

/**
 * Creates a Supabase client for server-side usage with proper cookie handling
 */
export function createServerSupabaseClientFixed() {
  // Get cookies store once to avoid multiple calls
  const cookieStore = cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            // Always use our standardized cookie name
            const cookieName = name.includes('sb-') ? AUTH_COOKIE_NAME : name;
            const cookie = cookieStore.get(cookieName);
            return cookie?.value;
          } catch (error) {
            console.error(`Error getting cookie ${name}:`, error);
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Always use our standardized cookie name
            const cookieName = name.includes('sb-') ? AUTH_COOKIE_NAME : name;
            
            cookieStore.set({
              name: cookieName,
              value,
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/'
            });
          } catch (error) {
            console.error(`Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Always use our standardized cookie name
            const cookieName = name.includes('sb-') ? AUTH_COOKIE_NAME : name;
            
            cookieStore.set({
              name: cookieName,
              value: '',
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              maxAge: 0
            });
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error);
          }
        },
      },
      cookieOptions: {
        name: AUTH_COOKIE_NAME,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      },
    }
  );
} 