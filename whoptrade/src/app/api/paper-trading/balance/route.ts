import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch user's balance
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: balance, error } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
      return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
    }

    // If no balance exists, create default
    if (!balance) {
      const { data: newBalance, error: createError } = await supabase
        .from('user_balances')
        .insert({
          user_id: session.user.id,
          balance: 100000,
          available_balance: 100000
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating balance:', createError);
        return NextResponse.json({ error: 'Failed to create balance' }, { status: 500 });
      }

      return NextResponse.json({ balance: newBalance });
    }

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Error in balance GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Add or remove balance (Creator only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, action, amount } = body; // action: 'add' or 'remove'

    if (!user_id || !action || !amount || amount <= 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: user_id, action, amount' 
      }, { status: 400 });
    }

    // Get current balance
    const { data: currentBalance, error: fetchError } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch user balance' }, { status: 500 });
    }

    let newBalance: number;
    let newAvailableBalance: number;

    if (!currentBalance) {
      // Create new balance if doesn't exist
      newBalance = action === 'add' ? amount : 0;
      newAvailableBalance = newBalance;
    } else {
      // Update existing balance
      if (action === 'add') {
        newBalance = currentBalance.balance + amount;
        newAvailableBalance = currentBalance.available_balance + amount;
      } else if (action === 'remove') {
        newBalance = Math.max(0, currentBalance.balance - amount);
        newAvailableBalance = Math.max(0, currentBalance.available_balance - amount);
      } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    }

    // Update or insert balance
    const { data: updatedBalance, error: updateError } = await supabase
      .from('user_balances')
      .upsert({
        user_id,
        balance: newBalance,
        available_balance: newAvailableBalance,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
    }

    return NextResponse.json({ 
      balance: updatedBalance,
      message: `Successfully ${action}ed $${amount} ${action === 'add' ? 'to' : 'from'} user balance`
    });
  } catch (error) {
    console.error('Error in balance POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}