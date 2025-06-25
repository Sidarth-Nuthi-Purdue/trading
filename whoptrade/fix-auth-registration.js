// Script to fix authentication registration issues
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixAuthRegistration() {
  // Create Supabase client with admin privileges
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    console.log('Fixing authentication registration issues...');
    
    // 1. Check if auth.users table has proper permissions
    const authCheckSql = `
      SELECT 
        has_table_privilege('auth.users', 'INSERT') as can_insert,
        has_table_privilege('auth.users', 'SELECT') as can_select,
        has_table_privilege('auth.users', 'UPDATE') as can_update;
    `;
    
    const { data: authPerms, error: authError } = await supabase.rpc('exec_sql', { sql: authCheckSql });
    
    if (authError) {
      console.error('Error checking auth permissions:', authError.message);
    } else {
      console.log('Auth permissions:', authPerms);
    }
    
    // 2. Recreate the users table to fix any potential issues
    const fixUsersSql = `
      -- Drop existing table if it's causing issues
      DROP TABLE IF EXISTS public.users CASCADE;
      
      -- Create the users table without foreign key constraint
      CREATE TABLE public.users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
    `;
    
    const { error: usersError } = await supabase.rpc('exec_sql', { sql: fixUsersSql });
    
    if (usersError) {
      console.error('Error fixing users table:', usersError.message);
    } else {
      console.log('Users table recreated successfully');
    }
    
    // 3. Fix auth.users settings
    const fixAuthSql = `
      -- Grant usage on auth schema
      GRANT USAGE ON SCHEMA auth TO service_role, authenticated, anon;
      
      -- Grant permissions on auth.users for authentication to work
      GRANT SELECT ON auth.users TO service_role, authenticated, anon;
      
      -- Enable Row Level Security for auth.users
      ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
      
      -- Create Row Level Security policies
      DROP POLICY IF EXISTS "Users can view their own user data." ON auth.users;
      CREATE POLICY "Users can view their own user data."
        ON auth.users
        FOR SELECT
        USING (auth.uid() = id);
    `;
    
    const { error: authFixError } = await supabase.rpc('exec_sql', { sql: fixAuthSql });
    
    if (authFixError) {
      console.error('Error fixing auth settings:', authFixError.message);
    } else {
      console.log('Auth settings updated successfully');
    }
    
    // 4. Copy existing users from auth.users to public.users if needed
    const syncUsersSql = `
      INSERT INTO public.users (id, email, first_name, last_name, created_at, updated_at)
      SELECT 
        id,
        email,
        raw_user_meta_data->>'first_name' as first_name,
        raw_user_meta_data->>'last_name' as last_name,
        created_at,
        updated_at
      FROM 
        auth.users
      ON CONFLICT (id) DO NOTHING;
    `;
    
    const { error: syncError } = await supabase.rpc('exec_sql', { sql: syncUsersSql });
    
    if (syncError) {
      console.error('Error syncing users:', syncError.message);
    } else {
      console.log('Existing users synced successfully');
    }
    
    console.log('Auth registration fixes applied successfully');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

fixAuthRegistration(); 