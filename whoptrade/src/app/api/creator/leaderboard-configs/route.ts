import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Leaderboard configuration interface
interface LeaderboardConfig {
  id?: string;
  name: string;
  description: string;
  type: 'global' | 'competition' | 'custom';
  ranking_criteria: 'pnl' | 'roi' | 'win_rate' | 'total_trades' | 'volume' | 'sharpe_ratio';
  time_period: 'all_time' | 'yearly' | 'monthly' | 'weekly' | 'daily' | 'custom';
  custom_period_days?: number;
  max_entries: number;
  auto_refresh: boolean;
  refresh_interval: number;
  display_settings: {
    show_rank_icons: boolean;
    show_user_avatar: boolean;
    show_join_date: boolean;
    show_balance: boolean;
    show_percentage_change: boolean;
    show_trade_count: boolean;
    color_scheme: 'default' | 'green_red' | 'blue_orange' | 'purple_gold' | 'custom';
    custom_colors?: {
      positive: string;
      negative: string;
      neutral: string;
      background: string;
      text: string;
    };
    animation_enabled: boolean;
    compact_mode: boolean;
  };
  filters: {
    min_balance?: number;
    min_trades?: number;
    min_days_active?: number;
    exclude_inactive: boolean;
    verified_only: boolean;
  };
  rewards: {
    enabled: boolean;
    positions: Array<{
      rank: number;
      reward_type: 'cash' | 'points' | 'badge' | 'custom';
      reward_value: number;
      reward_description?: string;
    }>;
  };
  visibility: {
    public: boolean;
    featured: boolean;
    embed_enabled: boolean;
    api_access: boolean;
  };
}

/**
 * GET - Fetch leaderboard configurations
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const cookieStore = await cookies();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    // Development bypass for testing - remove in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    let userId = 'dev-user-id'; // Default for development
    
    if (!isDevelopment) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is a creator
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'creator') {
        return NextResponse.json(
          { error: 'Creator access required' },
          { status: 403 }
        );
      }
      
      userId = user.id;
    }

    // Get search parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    // Build query
    let query = supabase
      .from('leaderboard_configs')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: configs, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard configs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch configurations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      configs: configs || []
    });

  } catch (error) {
    console.error('Error in leaderboard configs GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update leaderboard configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const cookieStore = await cookies();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    // Development bypass for testing - remove in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    let userId = 'dev-user-id'; // Default for development
    
    if (!isDevelopment) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is a creator
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'creator') {
        return NextResponse.json(
          { error: 'Creator access required' },
          { status: 403 }
        );
      }
      
      userId = user.id;
    }

    const config: LeaderboardConfig = await request.json();

    // Validate required fields
    if (!config.name || !config.type || !config.ranking_criteria) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, ranking_criteria' },
        { status: 400 }
      );
    }

    // Validate max_entries range
    if (config.max_entries < 10 || config.max_entries > 1000) {
      return NextResponse.json(
        { error: 'max_entries must be between 10 and 1000' },
        { status: 400 }
      );
    }

    // Validate refresh_interval
    if (config.auto_refresh && (config.refresh_interval < 1 || config.refresh_interval > 60)) {
      return NextResponse.json(
        { error: 'refresh_interval must be between 1 and 60 minutes' },
        { status: 400 }
      );
    }

    const configData = {
      creator_id: userId,
      name: config.name,
      description: config.description,
      type: config.type,
      ranking_criteria: config.ranking_criteria,
      time_period: config.time_period,
      custom_period_days: config.custom_period_days,
      max_entries: config.max_entries,
      auto_refresh: config.auto_refresh,
      refresh_interval: config.refresh_interval,
      display_settings: config.display_settings,
      filters: config.filters,
      rewards: config.rewards,
      visibility: config.visibility,
      status: 'active'
    };

    let result;
    if (config.id) {
      // Update existing configuration
      const { data, error } = await supabase
        .from('leaderboard_configs')
        .update(configData)
        .eq('id', config.id)
        .eq('creator_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating leaderboard config:', error);
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new configuration
      const { data, error } = await supabase
        .from('leaderboard_configs')
        .insert(configData)
        .select()
        .single();

      if (error) {
        console.error('Error creating leaderboard config:', error);
        return NextResponse.json(
          { error: 'Failed to create configuration' },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({
      success: true,
      config: result
    }, { status: config.id ? 200 : 201 });

  } catch (error) {
    console.error('Error in leaderboard configs POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete leaderboard configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get user session
    const cookieStore = await cookies();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    // Development bypass for testing - remove in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    let userId = 'dev-user-id'; // Default for development
    
    if (!isDevelopment) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is a creator
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'creator') {
        return NextResponse.json(
          { error: 'Creator access required' },
          { status: 403 }
        );
      }
      
      userId = user.id;
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    // Delete the configuration
    const { error } = await supabase
      .from('leaderboard_configs')
      .delete()
      .eq('id', configId)
      .eq('creator_id', userId);

    if (error) {
      console.error('Error deleting leaderboard config:', error);
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });

  } catch (error) {
    console.error('Error in leaderboard configs DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}