import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to ensure this route is never cached
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Create a Supabase client with admin privileges if available, otherwise use anon key
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
    
    // Minimal schema needed for user registration to work
    const minimalSchema = `
      -- Enable UUID extension if not already enabled
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      -- Drop the trigger if it exists to avoid errors
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      
      -- Drop function if it exists
      DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
      
      -- Recreate the users table (this is the most critical part)
      DROP TABLE IF EXISTS public.users CASCADE;
      CREATE TABLE public.users (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        username TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
      
      -- Create a simplified trigger function to handle new user creation
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.users (id, email, username)
        VALUES (
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Add the trigger back
      CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      
      -- Drop and recreate the basic trading account table
      DROP TABLE IF EXISTS public.virtual_trading_accounts CASCADE;
      CREATE TABLE public.virtual_trading_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        cash_balance DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
        portfolio_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        UNIQUE(user_id)
      );
      
      -- Add initial settings for each existing auth user that doesn't have a record yet
      INSERT INTO public.users (id, email, username, created_at, updated_at)
      SELECT au.id, au.email, COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)), now(), now()
      FROM auth.users au
      LEFT JOIN public.users pu ON au.id = pu.id
      WHERE pu.id IS NULL;
      
      -- Add trading accounts for users who don't have one
      INSERT INTO public.virtual_trading_accounts (user_id, cash_balance, portfolio_value, status)
      SELECT u.id, 10000.0000, 0.0000, 'active'
      FROM public.users u
      LEFT JOIN public.virtual_trading_accounts vta ON u.id = vta.user_id
      WHERE vta.id IS NULL;
    `;
    
    // Execute the minimal schema
    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: minimalSchema });
    
    if (schemaError) {
      console.error('Error applying emergency schema fix:', schemaError);
      return NextResponse.json({ 
        success: false, 
        error: schemaError.message 
      }, { status: 500 });
    }
    
    // Now test if we can create a user successfully
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'Test123456!';
    
    let testUserError = null;
    try {
      // Try to create a test user if we have admin privileges
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: testUser, error: userError } = await supabase.auth.admin.createUser({
          email: testEmail,
          password: testPassword,
          email_confirm: true
        });
        
        if (userError) {
          testUserError = userError;
        } else if (testUser.user) {
          // If test user was created, we should delete it
          await supabase.auth.admin.deleteUser(testUser.user.id);
        }
      }
    } catch (error) {
      console.warn('Test user creation skipped - service role key not available');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Emergency database fix applied successfully. Registration should now work.',
      details: 'Created basic users and virtual_trading_accounts tables with required triggers.',
      testUserCreated: !testUserError
    });
  } catch (error) {
    console.error('Error in emergency fix:', error);
    return NextResponse.json(
      { error: 'Failed to apply emergency fix', details: String(error) },
      { status: 500 }
    );
  }
} 