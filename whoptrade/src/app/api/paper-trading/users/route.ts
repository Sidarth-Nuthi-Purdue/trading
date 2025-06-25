import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch all users with their trading data (Creator only)
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query to get users with their balance and trading stats
    let query = supabase
      .from('user_profiles')
      .select(`
        *,
        user_balances(
          balance,
          available_balance,
          total_pnl,
          daily_pnl,
          weekly_pnl,
          monthly_pnl,
          last_reset_date,
          created_at,
          updated_at
        )
      `)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get additional trading statistics for each user
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        // Get total number of trades
        const { count: totalTrades } = await supabase
          .from('trade_orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id);

        // Get number of winning trades
        const { count: winningTrades } = await supabase
          .from('trade_orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id)
          .eq('status', 'filled')
          .gt('realized_pnl', 0);

        // Get recent trades (last 5)
        const { data: recentTrades } = await supabase
          .from('trade_orders')
          .select('*')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false })
          .limit(5);

        // Calculate win rate
        const winRate = totalTrades && totalTrades > 0 ? ((winningTrades || 0) / totalTrades) * 100 : 0;

        return {
          ...user,
          trading_stats: {
            total_trades: totalTrades || 0,
            winning_trades: winningTrades || 0,
            win_rate: parseFloat(winRate.toFixed(2)),
            recent_trades: recentTrades || []
          },
          balance_info: user.user_balances?.[0] || {
            balance: 0,
            available_balance: 0,
            total_pnl: 0,
            daily_pnl: 0,
            weekly_pnl: 0,
            monthly_pnl: 0
          }
        };
      })
    );

    return NextResponse.json({ users: usersWithStats });
  } catch (error) {
    console.error('Error in users GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}