const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function cleanupDatabase() {
  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please check your .env.local file.');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('Starting database cleanup...');
    
    // 1. Check for foreign key constraints that might be causing issues
    const { data: constraintData, error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE
          tc.constraint_type = 'FOREIGN KEY'
          AND (tc.table_name LIKE 'auth%' OR ccu.table_name LIKE 'auth%');
      `
    });
    
    if (constraintError) {
      console.error('Error checking constraints:', constraintError);
    } else {
      console.log('Foreign key constraints affecting auth tables:');
      console.log(constraintData);
    }
    
    // 2. Create any missing tables or functions needed for virtual trading
    const virtualTradingSQL = `
      -- Virtual Trading Accounts
      CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          balance DECIMAL(15, 2) NOT NULL DEFAULT 10000.00, -- Starting with $10,000
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
          UNIQUE(user_id)
      );

      -- Function to get or create a virtual trading account for a user
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
              INSERT INTO public.virtual_trading_accounts (user_id, balance, status)
              VALUES (p_user_id, 10000.00, 'active')
              RETURNING id INTO v_account_id;
          END IF;
          
          RETURN v_account_id;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: virtualTradingSQL });
    
    if (schemaError) {
      console.error('Error creating virtual trading schema:', schemaError);
    } else {
      console.log('Virtual trading schema created successfully');
    }
    
    // 3. Fix any missing users table (this shouldn't be needed but just in case)
    const fixUsersTableSQL = `
      CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
      
      -- Create trigger to automatically create a user record when a new auth.user is created
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO public.users (id, email, first_name, last_name)
          VALUES (
              NEW.id,
              NEW.email,
              NEW.raw_user_meta_data->>'first_name',
              NEW.raw_user_meta_data->>'last_name'
          );
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Drop the trigger if it exists
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      
      -- Create the trigger
      CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `;
    
    const { error: usersTableError } = await supabase.rpc('exec_sql', { sql: fixUsersTableSQL });
    
    if (usersTableError) {
      console.error('Error fixing users table:', usersTableError);
    } else {
      console.log('Users table setup completed successfully');
    }
    
    console.log('Database cleanup completed!');
    
  } catch (err) {
    console.error('Unexpected error during cleanup:', err);
    process.exit(1);
  }
}

cleanupDatabase(); 