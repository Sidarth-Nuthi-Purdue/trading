import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken } from '@whop/api';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('Creating Whop session...');
    
    // Verify Whop authentication
    const { userId: whopUserId } = await verifyUserToken(request.headers);
    
    if (!whopUserId) {
      return NextResponse.json({ 
        error: 'No Whop authentication found' 
      }, { status: 401 });
    }

    console.log('Whop user verified:', whopUserId);

    // Create a virtual Supabase user representation
    const virtualUser = {
      id: `whop-${whopUserId}`,
      email: `whop-${whopUserId}@whoptrade.internal`,
      whop_user_id: whopUserId,
      app_metadata: {
        provider: 'whop',
        providers: ['whop']
      },
      user_metadata: {
        whop_user_id: whopUserId,
        source: 'whop'
      },
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString()
    };

    // Create virtual session token
    const sessionData = {
      access_token: `whop-${whopUserId}-${Date.now()}`,
      refresh_token: `whop-refresh-${whopUserId}-${Date.now()}`,
      expires_at: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      expires_in: 60 * 60 * 24,
      token_type: 'bearer',
      user: virtualUser
    };

    // Initialize user data if needed
    await ensureUserExists(whopUserId);

    console.log('Whop session created successfully');

    return NextResponse.json({
      success: true,
      user: virtualUser,
      session: sessionData
    });

  } catch (error) {
    console.error('Whop session creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Ensure user data exists in our database
 */
async function ensureUserExists(whopUserId: string) {
  try {
    // Create regular Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const userId = `whop-${whopUserId}`;
    
    // Check if user balance exists
    const { data: existingBalance } = await supabase
      .from('user_balances')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (!existingBalance) {
      console.log('Creating user balance for Whop user:', whopUserId);
      
      // Create user balance record
      const { error: balanceError } = await supabase
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
        console.log('User balance created successfully');
      }
    }

  } catch (error) {
    console.error('Error ensuring user exists:', error);
  }
}