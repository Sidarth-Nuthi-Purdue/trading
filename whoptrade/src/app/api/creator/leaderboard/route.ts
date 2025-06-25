import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch leaderboard data (Creator only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator and get company info
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, company_id, company_name')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const creatorCompanyId = userProfile.company_id;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'global'; // global, competition
    const competitionId = searchParams.get('competition_id');
    const timeframe = searchParams.get('timeframe') || 'all_time'; // all_time, monthly, weekly, daily
    const limit = parseInt(searchParams.get('limit') || '50');

    if (type === 'competition' && competitionId) {
      // First verify the competition belongs to creator's company
      const { data: competition } = await supabase
        .from('competitions')
        .select('creator_id, rules')
        .eq('id', competitionId)
        .single();

      if (!competition) {
        return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
      }

      // Check if competition belongs to same company or creator
      const competitionCompanyId = competition.rules?.company_id;
      if (creatorCompanyId && competitionCompanyId && competitionCompanyId !== creatorCompanyId) {
        return NextResponse.json({ error: 'Access denied to this competition' }, { status: 403 });
      }

      // Competition-specific leaderboard
      const { data: leaderboard, error } = await supabase
        .from('competition_participants')
        .select(`
          id,
          user_id,
          total_pnl,
          rank,
          user_profiles!inner(username, first_name, last_name, company_id),
          competitions!inner(name, status)
        `)
        .eq('competition_id', competitionId)
        .eq('status', 'active')
        .order('rank', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching competition leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
      }

      return NextResponse.json({ leaderboard, type: 'competition' });
    } else {
      // Global leaderboard based on user balances
      let pnlColumn = 'total_pnl';
      switch (timeframe) {
        case 'daily':
          pnlColumn = 'daily_pnl';
          break;
        case 'weekly':
          pnlColumn = 'weekly_pnl';
          break;
        case 'monthly':
          pnlColumn = 'monthly_pnl';
          break;
        default:
          pnlColumn = 'total_pnl';
      }

      let query = supabase
        .from('user_balances')
        .select(`
          user_id,
          balance,
          ${pnlColumn},
          user_profiles!inner(username, first_name, last_name, created_at, company_id)
        `)
        .eq('user_profiles.role', 'user')
        .order(pnlColumn, { ascending: false })
        .limit(limit);

      // Filter by company if creator has a company
      if (creatorCompanyId) {
        query = query.eq('user_profiles.company_id', creatorCompanyId);
      }

      const { data: leaderboard, error } = await query;

      if (error) {
        console.error('Error fetching global leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
      }

      // Add rank to leaderboard
      const rankedLeaderboard = leaderboard?.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        pnl: entry[pnlColumn as keyof typeof entry] as number
      }));

      return NextResponse.json({ 
        leaderboard: rankedLeaderboard, 
        type: 'global',
        timeframe 
      });
    }
  } catch (error) {
    console.error('Error in leaderboard GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}