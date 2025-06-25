import { createClient } from '@supabase/supabase-js';

// Types
export type Database = {
  public: {
    tables: {
      users: {
        Row: {
          id: string;
          email: string;
          alpaca_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          alpaca_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          alpaca_account_id?: string | null;
          updated_at?: string;
        };
      };
      trading_accounts: {
        Row: {
          id: string;
          user_id: string;
          alpaca_account_id: string;
          account_number: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          alpaca_account_id: string;
          account_number: string;
          status: string;
          created_at?: string;
        };
        Update: {
          alpaca_account_id?: string;
          account_number?: string;
          status?: string;
        };
      };
    };
  };
};

/**
 * Create a Supabase client configured for use in the browser
 */
export const createBrowserSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://emscntnnljbgjrxeeolm.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2NudG5ubGpiZ2pyeGVlb2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcwMDU5ODEsImV4cCI6MjAzMjU4MTk4MX0.O1-_LX5VvwXPiXGcq-yslNhPXZBDTAQGkLrJIOXm0jc';
  
  return createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true
      }
    }
  );
};

// Export a singleton instance for browser usage
export const supabase = createBrowserSupabaseClient();

// Helper functions for authentication
export const auth = {
  // Sign up with email and password
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },
  
  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },
  
  // Sign out the current user
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  // Get the current user
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },
  
  // Get the current session
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
  
  // Check if user is authenticated
  isAuthenticated: async () => {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  }
}; 