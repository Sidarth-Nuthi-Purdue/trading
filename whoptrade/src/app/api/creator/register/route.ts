import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const {
      email,
      password,
      username,
      first_name,
      last_name,
      whop_user_id
    } = await request.json();

    // Validate required fields
    if (!email || !password || !username) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, password, username' 
      }, { status: 400 });
    }

    // Check if username is already taken
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        error: 'Username already taken' 
      }, { status: 400 });
    }

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          first_name,
          last_name,
          role: 'creator'
        }
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ 
        error: authError.message || 'Failed to create user account' 
      }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ 
        error: 'Failed to create user' 
      }, { status: 400 });
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        whop_user_id,
        email,
        username,
        first_name,
        last_name,
        role: 'creator',
        is_active: true
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      
      // Try to clean up the auth user if profile creation failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json({ 
        error: 'Failed to create user profile' 
      }, { status: 500 });
    }

    // Initialize creator settings with defaults
    const defaultSettings = [
      {
        creator_id: authData.user.id,
        setting_name: 'default_starting_balance',
        setting_value: { amount: 100000 }
      },
      {
        creator_id: authData.user.id,
        setting_name: 'max_trade_amount',
        setting_value: { amount: 10000 }
      },
      {
        creator_id: authData.user.id,
        setting_name: 'min_trade_amount',
        setting_value: { amount: 1 }
      },
      {
        creator_id: authData.user.id,
        setting_name: 'trading_hours',
        setting_value: { 
          start: '09:30', 
          end: '16:00', 
          timezone: 'America/New_York' 
        }
      },
      {
        creator_id: authData.user.id,
        setting_name: 'allowed_assets',
        setting_value: { 
          stocks: true, 
          options: false, 
          futures: false 
        }
      },
      {
        creator_id: authData.user.id,
        setting_name: 'risk_management',
        setting_value: {
          max_daily_loss: 5000,
          max_position_size: 25000,
          allow_short_selling: true,
          allow_leverage: false,
          max_leverage: 2
        }
      },
      {
        creator_id: authData.user.id,
        setting_name: 'competition_settings',
        setting_value: {
          max_duration_days: 90,
          min_prize_amount: 100,
          platform_fee_percentage: 0,
          auto_close_expired: true
        }
      }
    ];

    const { error: settingsError } = await supabase
      .from('global_settings')
      .insert(defaultSettings);

    if (settingsError) {
      console.error('Settings creation error:', settingsError);
      // Continue without failing - settings can be created later
    }

    return NextResponse.json({
      message: 'Creator account created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role
      },
      session: authData.session
    });

  } catch (error) {
    console.error('Error in /api/creator/register:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}