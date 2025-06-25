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
      last_name
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
          role: 'user'
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
        email,
        username,
        first_name,
        last_name,
        role: 'user',
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

    // Create initial balance for the user
    const { error: balanceError } = await supabase
      .from('user_balances')
      .insert({
        user_id: authData.user.id,
        balance: 100000.00, // Default starting balance
        available_balance: 100000.00,
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0
      });

    if (balanceError) {
      console.error('Balance creation error:', balanceError);
      // Continue without failing - balance can be created later by creator
    }

    return NextResponse.json({
      message: 'User account created successfully',
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
    console.error('Error in /api/user/register:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}