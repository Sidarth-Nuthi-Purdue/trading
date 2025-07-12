import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken } from '@whop/api';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key for user creation
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for Whop authentication bridge');
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('Starting Whop to Supabase bridge authentication...');
    
    // Verify Whop authentication
    const { userId: whopUserId } = await verifyUserToken(request.headers);
    
    if (!whopUserId) {
      return NextResponse.json({ 
        error: 'No Whop authentication found' 
      }, { status: 401 });
    }

    console.log('Whop user verified:', whopUserId);

    // Create a unique email for the Whop user
    const email = `whop-${whopUserId}@whoptrade.internal`;
    const password = `whop-${whopUserId}-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)}`;

    // Check if user already exists in Supabase
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    let supabaseUser;

    if (existingUser.user) {
      console.log('Existing Supabase user found:', existingUser.user.id);
      supabaseUser = existingUser.user;
    } else {
      console.log('Creating new Supabase user for Whop user:', whopUserId);
      
      // Create new Supabase user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          whop_user_id: whopUserId,
          source: 'whop',
          created_via: 'whop-bridge'
        }
      });

      if (createError) {
        console.error('Error creating Supabase user:', createError);
        return NextResponse.json({ 
          error: 'Failed to create user account' 
        }, { status: 500 });
      }

      supabaseUser = newUser.user;
      console.log('New Supabase user created:', supabaseUser?.id);

      // Initialize user balance and portfolio
      await initializeUserData(supabaseUser!.id);
    }

    // Generate session tokens for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
      }
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      return NextResponse.json({ 
        error: 'Failed to create session' 
      }, { status: 500 });
    }

    // Create a session token manually
    const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.createSession({
      user_id: supabaseUser!.id
    });

    if (tokenError) {
      console.error('Error creating session token:', tokenError);
      return NextResponse.json({ 
        error: 'Failed to create session token' 
      }, { status: 500 });
    }

    console.log('Session created successfully for user:', supabaseUser?.id);

    return NextResponse.json({
      success: true,
      user: {
        id: supabaseUser!.id,
        email,
        whop_user_id: whopUserId
      },
      session: {
        access_token: tokenData.session.access_token,
        refresh_token: tokenData.session.refresh_token,
        expires_at: tokenData.session.expires_at
      }
    });

  } catch (error) {
    console.error('Whop bridge authentication error:', error);
    return NextResponse.json({ 
      error: 'Authentication bridge failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Initialize user data after creating a new Supabase user
 */
async function initializeUserData(userId: string) {
  try {
    console.log('Initializing user data for:', userId);
    
    // Create user balance record
    const { error: balanceError } = await supabaseAdmin
      .from('user_balances')
      .insert({
        user_id: userId,
        balance: 100000, // Starting balance
        available_balance: 100000,
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0
      });

    if (balanceError) {
      console.error('Error creating user balance:', balanceError);
    } else {
      console.log('User balance initialized successfully');
    }

    // Create user settings record (if table exists)
    const { error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .insert({
        user_id: userId,
        timezone: 'America/New_York',
        notifications_enabled: true,
        theme: 'dark'
      });

    if (settingsError && !settingsError.message?.includes('relation "user_settings" does not exist')) {
      console.error('Error creating user settings:', settingsError);
    }

  } catch (error) {
    console.error('Error initializing user data:', error);
  }
}