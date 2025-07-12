import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { whopLeaderboard, DEFAULT_LEADERBOARD_CONFIG } from '@/lib/whop-leaderboard';

export const dynamic = 'force-dynamic';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET - Fetch Whop-integrated leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ranking_criteria = searchParams.get('ranking_criteria') || 'pnl';
    const time_period = searchParams.get('time_period') || 'all_time';
    const max_entries = parseInt(searchParams.get('max_entries') || '50');
    const min_trades = parseInt(searchParams.get('min_trades') || '1');
    const active_only = searchParams.get('active_only') === 'true';
    
    // Get trading data from our database
    const tradingData = await getTradingDataFromDatabase();
    
    // Configure leaderboard settings
    const config = {
      ...DEFAULT_LEADERBOARD_CONFIG,
      ranking_criteria: ranking_criteria as any,
      time_period: time_period as any,
      max_entries,
      min_trades,
      active_only
    };
    
    // Get leaderboard with Whop integration
    const leaderboard = await generateWhopLeaderboard(tradingData, config);
    
    return NextResponse.json({
      success: true,
      leaderboard,
      config: {
        ranking_criteria,
        time_period,
        max_entries,
        total_entries: leaderboard.length
      }
    });
  } catch (error) {
    console.error('Error fetching Whop leaderboard:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch leaderboard',
      leaderboard: [],
      config: null
    }, { status: 500 });
  }
}

/**
 * POST - Update leaderboard with new trading data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, whop_user_id, trading_stats } = body;
    
    if (!user_id || !whop_user_id || !trading_stats) {
      return NextResponse.json({ 
        error: 'Missing required fields: user_id, whop_user_id, trading_stats' 
      }, { status: 400 });
    }
    
    // Update trading stats in database
    const { error: updateError } = await supabase
      .from('user_balances')
      .upsert({
        user_id,
        ...trading_stats,
        updated_at: new Date().toISOString()
      });
    
    if (updateError) {
      console.error('Error updating trading stats:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update trading stats' 
      }, { status: 500 });
    }
    
    // Update Whop leaderboard
    await whopLeaderboard.updateUserTradingStats(whop_user_id, trading_stats);
    
    return NextResponse.json({ 
      success: true,
      message: 'Trading stats updated successfully'
    });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    return NextResponse.json({ 
      error: 'Failed to update leaderboard' 
    }, { status: 500 });
  }
}

/**
 * Get trading data from database
 */
async function getTradingDataFromDatabase() {
  try {
    const { data: balances, error } = await supabase
      .from('user_balances')
      .select(`
        *,
        user_profiles!inner(
          whop_user_id,
          username,
          first_name,
          last_name,
          email,
          is_active,
          created_at
        )
      `)
      .eq('user_profiles.is_active', true);
    
    if (error) {
      console.error('Error fetching trading data:', error);
      return [];
    }
    
    // Transform data for leaderboard
    return balances?.map(balance => ({
      user_id: balance.user_id,
      whop_user_id: balance.user_profiles.whop_user_id,
      username: balance.user_profiles.username,
      first_name: balance.user_profiles.first_name,
      last_name: balance.user_profiles.last_name,
      email: balance.user_profiles.email,
      total_pnl: balance.total_pnl,
      daily_pnl: balance.daily_pnl,
      weekly_pnl: balance.weekly_pnl,
      monthly_pnl: balance.monthly_pnl,
      current_balance: balance.balance,
      total_trades: await getTotalTrades(balance.user_id),
      win_rate: await getWinRate(balance.user_id),
      last_trade_at: await getLastTradeDate(balance.user_id),
      created_at: balance.user_profiles.created_at
    })) || [];
  } catch (error) {
    console.error('Error in getTradingDataFromDatabase:', error);
    return [];
  }
}

/**
 * Get total trades for a user
 */
async function getTotalTrades(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('trade_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'filled');
    
    if (error) {
      console.error('Error getting total trades:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error in getTotalTrades:', error);
    return 0;
  }
}

/**
 * Get win rate for a user
 */
async function getWinRate(userId: string): Promise<number> {
  try {
    const { data: trades, error } = await supabase
      .from('trade_orders')
      .select('realized_pnl')
      .eq('user_id', userId)
      .eq('status', 'filled')
      .not('realized_pnl', 'is', null);
    
    if (error || !trades || trades.length === 0) {
      return 0;
    }
    
    const winningTrades = trades.filter(trade => trade.realized_pnl > 0);
    return (winningTrades.length / trades.length) * 100;
  } catch (error) {
    console.error('Error in getWinRate:', error);
    return 0;
  }
}

/**
 * Get last trade date for a user
 */
async function getLastTradeDate(userId: string): Promise<string> {
  try {
    const { data: lastTrade, error } = await supabase
      .from('trade_orders')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !lastTrade) {
      return new Date().toISOString();
    }
    
    return lastTrade.created_at;
  } catch (error) {
    console.error('Error in getLastTradeDate:', error);
    return new Date().toISOString();
  }
}

/**
 * Generate Whop-integrated leaderboard
 */
async function generateWhopLeaderboard(tradingData: any[], config: any) {
  try {
    // Sync with Whop users
    const syncedData = await whopLeaderboard.syncTradingDataWithWhop(tradingData);
    
    // Calculate rankings
    const rankedLeaderboard = whopLeaderboard.calculateRankings(syncedData, config);
    
    return rankedLeaderboard;
  } catch (error) {
    console.error('Error generating Whop leaderboard:', error);
    return [];
  }
}