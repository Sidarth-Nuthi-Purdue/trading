import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

/**
 * GET - Test Whop authentication
 */
export async function GET(request: NextRequest) {
  try {
    // First, create a test user
    const whopUserId = 'lpRuDNk8Npniv';
    const supabase = createDatabaseClient();
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('whop_user_id', whopUserId)
      .single();
    
    if (!existingUser) {
      // Create user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          whop_user_id: whopUserId,
          email: `whop-${whopUserId}@whoptrade.internal`,
          username: whopUserId,
          role: 'user',
          is_active: true
        })
        .select('*')
        .single();
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
        return NextResponse.json({ 
          error: 'Failed to create test user profile',
          details: profileError 
        }, { status: 500 });
      }
      
      // Create user balance
      const { data: balance, error: balanceError } = await supabase
        .from('user_balances')
        .insert({
          user_id: profile.user_id,
          balance: 100000,
          available_balance: 100000,
          total_pnl: 0,
          daily_pnl: 0,
          weekly_pnl: 0,
          monthly_pnl: 0
        })
        .select('*')
        .single();
      
      if (balanceError) {
        console.error('Error creating balance:', balanceError);
        return NextResponse.json({ 
          error: 'Failed to create test user balance',
          details: balanceError 
        }, { status: 500 });
      }
      
      console.log('Created test user:', profile.user_id);
    }
    
    // Test with a mock Whop token
    const mockToken = 'whop-lpRuDNk8Npniv-1234567890';
    const authHeader = `Bearer ${mockToken}`;
    
    console.log('Testing Whop auth with token:', mockToken);
    
    // Test authentication
    const { user, error } = await authenticateUser(authHeader);
    
    if (error || !user) {
      return NextResponse.json({ 
        error: error || 'Authentication failed',
        success: false 
      }, { status: 401 });
    }
    
    // Check if user exists in database
    const supabase = createDatabaseClient();
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // Check if balance exists
    const { data: balance, error: balanceError } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    return NextResponse.json({
      success: true,
      user,
      profile,
      balance,
      profileError,
      balanceError
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      success: false,
      details: error 
    }, { status: 500 });
  }
}

/**
 * POST - Create test Whop user
 */
export async function POST(request: NextRequest) {
  try {
    const { whop_user_id } = await request.json();
    
    if (!whop_user_id) {
      return NextResponse.json({ 
        error: 'whop_user_id is required' 
      }, { status: 400 });
    }
    
    const supabase = createDatabaseClient();
    
    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        whop_user_id,
        email: `whop-${whop_user_id}@whoptrade.internal`,
        username: whop_user_id,
        role: 'user',
        is_active: true
      })
      .select('*')
      .single();
    
    if (profileError) {
      return NextResponse.json({ 
        error: 'Failed to create profile',
        details: profileError 
      }, { status: 500 });
    }
    
    // Create user balance
    const { data: balance, error: balanceError } = await supabase
      .from('user_balances')
      .insert({
        user_id: profile.user_id,
        balance: 100000,
        available_balance: 100000,
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0
      })
      .select('*')
      .single();
    
    if (balanceError) {
      return NextResponse.json({ 
        error: 'Failed to create balance',
        details: balanceError 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      profile,
      balance
    });
    
  } catch (error) {
    console.error('Create test user error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error 
    }, { status: 500 });
  }
}