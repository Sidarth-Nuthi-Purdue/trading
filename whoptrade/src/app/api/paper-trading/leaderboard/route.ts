import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch leaderboard data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all_time'; // all_time, weekly, monthly, active_competitions
    const competition_id = searchParams.get('competition_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (competition_id) {
      // Get competition-specific leaderboard
      const { data: leaderboard, error } = await supabase
        .from('competition_leaderboard')
        .select('*')
        .eq('competition_id', competition_id)
        .order('rank', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching competition leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
      }

      return NextResponse.json({ leaderboard, type: 'competition' });
    }

    // Get global leaderboard based on period
    let query = supabase
      .from('user_balances')
      .select(`
        *,
        user_profiles!inner(
          username,
          first_name,
          last_name
        )
      `);

    // Filter based on period
    if (period === 'weekly') {
      query = query.order('weekly_pnl', { ascending: false });
    } else if (period === 'monthly') {
      query = query.order('monthly_pnl', { ascending: false });
    } else if (period === 'daily') {
      query = query.order('daily_pnl', { ascending: false });
    } else {
      // all_time
      query = query.order('total_pnl', { ascending: false });
    }

    const { data: balances, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching global leaderboard:', error);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    // Format leaderboard data
    const leaderboard = balances?.map((balance, index) => ({
      rank: index + 1,
      user_id: balance.user_id,
      username: balance.user_profiles.username,
      first_name: balance.user_profiles.first_name,
      last_name: balance.user_profiles.last_name,
      total_pnl: balance.total_pnl,
      daily_pnl: balance.daily_pnl,
      weekly_pnl: balance.weekly_pnl,
      monthly_pnl: balance.monthly_pnl,
      balance: balance.balance,
      pnl_value: period === 'weekly' ? balance.weekly_pnl 
                : period === 'monthly' ? balance.monthly_pnl
                : period === 'daily' ? balance.daily_pnl
                : balance.total_pnl
    }));

    // Get active competitions for the current user
    let activeCompetitions = [];
    if (period === 'active_competitions') {
      const { data: competitions } = await supabase
        .from('competition_participants')
        .select(`
          competition_id,
          total_pnl,
          rank,
          competitions!inner(
            name,
            status,
            start_date,
            end_date
          )
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .eq('competitions.status', 'active');

      activeCompetitions = competitions || [];
    }

    return NextResponse.json({ 
      leaderboard, 
      type: 'global',
      period,
      active_competitions: activeCompetitions
    });
  } catch (error) {
    console.error('Error in leaderboard GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}