/**
 * Whop Sync Service
 * 
 * This service handles automatic synchronization of trading data with 
 * the Whop leaderboard system whenever trades are executed.
 */

import { whopLeaderboard } from './whop-leaderboard';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class WhopSyncService {
  
  /**
   * Sync user's trading stats with Whop leaderboard after a trade
   */
  static async syncUserStatsAfterTrade(userId: string): Promise<void> {
    try {
      // Get user's current stats
      const stats = await this.calculateUserStats(userId);
      
      // Get user's Whop ID
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('whop_user_id')
        .eq('user_id', userId)
        .single();
      
      if (!userProfile?.whop_user_id) {
        console.log('User does not have Whop ID, skipping sync');
        return;
      }
      
      // Update Whop leaderboard
      await whopLeaderboard.updateUserTradingStats(userProfile.whop_user_id, stats);
      
      // Update our API endpoint as well
      await fetch('/api/whop/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          whop_user_id: userProfile.whop_user_id,
          trading_stats: stats
        })
      });
      
      console.log(`Synced trading stats for user ${userId} with Whop leaderboard`);
    } catch (error) {
      console.error('Error syncing user stats with Whop:', error);
    }
  }
  
  /**
   * Calculate user's current trading statistics
   */
  private static async calculateUserStats(userId: string): Promise<any> {
    try {
      // Get user balance
      const { data: balance } = await supabase
        .from('user_balances')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      // Get user trades
      const { data: trades } = await supabase
        .from('trade_orders')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'filled');
      
      // Calculate win rate
      const winningTrades = trades?.filter(trade => trade.realized_pnl > 0) || [];
      const winRate = trades?.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
      
      return {
        total_pnl: balance?.total_pnl || 0,
        daily_pnl: balance?.daily_pnl || 0,
        weekly_pnl: balance?.weekly_pnl || 0,
        monthly_pnl: balance?.monthly_pnl || 0,
        total_trades: trades?.length || 0,
        win_rate: winRate,
        current_balance: balance?.balance || 0
      };
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0,
        total_trades: 0,
        win_rate: 0,
        current_balance: 0
      };
    }
  }
  
  /**
   * Sync all users' stats with Whop leaderboard (for batch updates)
   */
  static async syncAllUsersWithWhop(): Promise<void> {
    try {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('user_id, whop_user_id')
        .eq('is_active', true)
        .not('whop_user_id', 'is', null);
      
      if (!users) return;
      
      // Sync each user
      for (const user of users) {
        await this.syncUserStatsAfterTrade(user.user_id);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Synced ${users.length} users with Whop leaderboard`);
    } catch (error) {
      console.error('Error syncing all users with Whop:', error);
    }
  }
  
  /**
   * Initialize Whop user when they first join
   */
  static async initializeWhopUser(userId: string, whopUserId: string): Promise<void> {
    try {
      // Initialize with default stats
      const initialStats = {
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0,
        total_trades: 0,
        win_rate: 0,
        current_balance: 100000 // Default starting balance
      };
      
      // Update Whop leaderboard
      await whopLeaderboard.updateUserTradingStats(whopUserId, initialStats);
      
      console.log(`Initialized Whop user ${whopUserId} in leaderboard`);
    } catch (error) {
      console.error('Error initializing Whop user:', error);
    }
  }
}

// Export for use in other parts of the application
export const whopSync = WhopSyncService;