/**
 * Whop Leaderboard Integration Service
 * 
 * This service integrates trading data with Whop's user system to create
 * a custom leaderboard that can be displayed within the Whop app ecosystem.
 */

import { WhopAPI } from '@whop-apps/sdk';

// Types for our leaderboard system
export interface WhopLeaderboardEntry {
  whop_user_id: string;
  whop_username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  total_pnl: number;
  daily_pnl: number;
  weekly_pnl: number;
  monthly_pnl: number;
  total_trades: number;
  win_rate: number;
  current_balance: number;
  rank: number;
  last_trade_at: string;
  created_at: string;
  updated_at: string;
}

export interface WhopLeaderboardConfig {
  experience_id: string;
  ranking_criteria: 'pnl' | 'win_rate' | 'total_trades' | 'balance';
  time_period: 'all_time' | 'monthly' | 'weekly' | 'daily';
  max_entries: number;
  min_trades?: number;
  active_only?: boolean;
}

export class WhopLeaderboardService {
  private apiKey: string;
  private experienceId: string;

  constructor(apiKey: string, experienceId: string) {
    this.apiKey = apiKey;
    this.experienceId = experienceId;
  }

  /**
   * Get users from a specific Whop experience
   */
  async getWhopUsers(): Promise<any[]> {
    try {
      const response = await WhopAPI.app().GET('/app/experiences/{id}/users', {
        params: { path: { id: this.experienceId } }
      });

      if (response.data && response.data.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching Whop users:', error);
      return [];
    }
  }

  /**
   * Get current user from Whop
   */
  async getCurrentWhopUser(): Promise<any | null> {
    try {
      const response = await WhopAPI.me().GET('/me');
      return response.data || null;
    } catch (error) {
      console.error('Error fetching current Whop user:', error);
      return null;
    }
  }

  /**
   * Sync trading data with Whop users to create leaderboard
   */
  async syncTradingDataWithWhop(tradingData: any[]): Promise<WhopLeaderboardEntry[]> {
    try {
      const whopUsers = await this.getWhopUsers();
      
      // Create a map of Whop users by their ID
      const whopUserMap = new Map(whopUsers.map(user => [user.id, user]));
      
      // Merge trading data with Whop user data
      const leaderboardEntries: WhopLeaderboardEntry[] = [];
      
      for (const tradeData of tradingData) {
        const whopUser = whopUserMap.get(tradeData.whop_user_id);
        if (whopUser) {
          leaderboardEntries.push({
            whop_user_id: whopUser.id,
            whop_username: whopUser.username || whopUser.email,
            email: whopUser.email,
            display_name: whopUser.username || `${whopUser.first_name} ${whopUser.last_name}` || whopUser.email,
            avatar_url: whopUser.profile_pic_url,
            total_pnl: tradeData.total_pnl || 0,
            daily_pnl: tradeData.daily_pnl || 0,
            weekly_pnl: tradeData.weekly_pnl || 0,
            monthly_pnl: tradeData.monthly_pnl || 0,
            total_trades: tradeData.total_trades || 0,
            win_rate: tradeData.win_rate || 0,
            current_balance: tradeData.current_balance || 0,
            rank: 0, // Will be calculated later
            last_trade_at: tradeData.last_trade_at || new Date().toISOString(),
            created_at: tradeData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      
      return leaderboardEntries;
    } catch (error) {
      console.error('Error syncing trading data with Whop:', error);
      return [];
    }
  }

  /**
   * Calculate leaderboard rankings based on configuration
   */
  calculateRankings(
    entries: WhopLeaderboardEntry[], 
    config: WhopLeaderboardConfig
  ): WhopLeaderboardEntry[] {
    // Filter entries based on config
    let filteredEntries = entries;
    
    if (config.min_trades) {
      filteredEntries = filteredEntries.filter(entry => entry.total_trades >= config.min_trades);
    }
    
    if (config.active_only) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Active in last 7 days
      filteredEntries = filteredEntries.filter(entry => 
        new Date(entry.last_trade_at) >= cutoffDate
      );
    }
    
    // Sort based on ranking criteria
    switch (config.ranking_criteria) {
      case 'pnl':
        const pnlField = config.time_period === 'daily' ? 'daily_pnl' :
                        config.time_period === 'weekly' ? 'weekly_pnl' :
                        config.time_period === 'monthly' ? 'monthly_pnl' : 'total_pnl';
        filteredEntries.sort((a, b) => b[pnlField] - a[pnlField]);
        break;
      case 'win_rate':
        filteredEntries.sort((a, b) => b.win_rate - a.win_rate);
        break;
      case 'total_trades':
        filteredEntries.sort((a, b) => b.total_trades - a.total_trades);
        break;
      case 'balance':
        filteredEntries.sort((a, b) => b.current_balance - a.current_balance);
        break;
    }
    
    // Assign ranks and limit entries
    const rankedEntries = filteredEntries
      .slice(0, config.max_entries)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
    
    return rankedEntries;
  }

  /**
   * Get leaderboard with full Whop integration
   */
  async getLeaderboard(config: WhopLeaderboardConfig): Promise<WhopLeaderboardEntry[]> {
    try {
      // In a real implementation, this would fetch from your database
      // For now, we'll return empty array as placeholder
      const tradingData: any[] = [];
      
      // Sync with Whop users
      const syncedData = await this.syncTradingDataWithWhop(tradingData);
      
      // Calculate rankings
      const rankedLeaderboard = this.calculateRankings(syncedData, config);
      
      return rankedLeaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Update trading stats for a specific Whop user
   */
  async updateUserTradingStats(
    whopUserId: string, 
    stats: {
      total_pnl: number;
      daily_pnl: number;
      weekly_pnl: number;
      monthly_pnl: number;
      total_trades: number;
      win_rate: number;
      current_balance: number;
    }
  ): Promise<boolean> {
    try {
      // In a real implementation, this would update your database
      // with the new trading stats for the user
      console.log(`Updating trading stats for Whop user ${whopUserId}:`, stats);
      
      // You would typically store this in your database
      // associated with the whop_user_id
      
      return true;
    } catch (error) {
      console.error('Error updating user trading stats:', error);
      return false;
    }
  }

  /**
   * Handle Whop webhook events for leaderboard updates
   */
  async handleWhopWebhook(event: any): Promise<void> {
    try {
      console.log('Received Whop webhook event:', event);
      
      // Handle different webhook events
      switch (event.type) {
        case 'user_joined':
          // Initialize leaderboard entry for new user
          await this.initializeUserLeaderboard(event.data.user.id);
          break;
        case 'user_left':
          // Remove user from leaderboard
          await this.removeUserFromLeaderboard(event.data.user.id);
          break;
        case 'membership_created':
          // User got access, initialize their leaderboard
          await this.initializeUserLeaderboard(event.data.user.id);
          break;
        case 'membership_deleted':
          // User lost access, remove from leaderboard
          await this.removeUserFromLeaderboard(event.data.user.id);
          break;
        default:
          console.log('Unhandled webhook event type:', event.type);
      }
    } catch (error) {
      console.error('Error handling Whop webhook:', error);
    }
  }

  /**
   * Initialize leaderboard entry for a new user
   */
  private async initializeUserLeaderboard(whopUserId: string): Promise<void> {
    const initialStats = {
      total_pnl: 0,
      daily_pnl: 0,
      weekly_pnl: 0,
      monthly_pnl: 0,
      total_trades: 0,
      win_rate: 0,
      current_balance: 100000 // Default starting balance
    };
    
    await this.updateUserTradingStats(whopUserId, initialStats);
  }

  /**
   * Remove user from leaderboard
   */
  private async removeUserFromLeaderboard(whopUserId: string): Promise<void> {
    // In a real implementation, this would remove the user from your database
    console.log(`Removing user ${whopUserId} from leaderboard`);
  }

  /**
   * Get user's current leaderboard position
   */
  async getUserLeaderboardPosition(whopUserId: string, config: WhopLeaderboardConfig): Promise<{
    rank: number;
    entry: WhopLeaderboardEntry | null;
    totalParticipants: number;
  }> {
    try {
      const leaderboard = await this.getLeaderboard(config);
      const userEntry = leaderboard.find(entry => entry.whop_user_id === whopUserId);
      
      return {
        rank: userEntry?.rank || 0,
        entry: userEntry || null,
        totalParticipants: leaderboard.length
      };
    } catch (error) {
      console.error('Error getting user leaderboard position:', error);
      return {
        rank: 0,
        entry: null,
        totalParticipants: 0
      };
    }
  }
}

// Export default configuration
export const DEFAULT_LEADERBOARD_CONFIG: WhopLeaderboardConfig = {
  experience_id: process.env.NEXT_PUBLIC_WHOP_EXPERIENCE_ID || '',
  ranking_criteria: 'pnl',
  time_period: 'all_time',
  max_entries: 100,
  min_trades: 1,
  active_only: true
};

// Export singleton instance
export const whopLeaderboard = new WhopLeaderboardService(
  process.env.WHOP_API_KEY || '',
  process.env.NEXT_PUBLIC_WHOP_EXPERIENCE_ID || ''
);