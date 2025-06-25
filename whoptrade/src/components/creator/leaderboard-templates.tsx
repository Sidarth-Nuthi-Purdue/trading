'use client';

import React from 'react';
import { 
  Trophy, Medal, Crown, Award, TrendingUp, Target, 
  BarChart3, Zap, Gamepad2, Star, Users, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TradingSettings {
  default_starting_balance: number;
  max_trade_amount: number;
  min_trade_amount: number;
  trading_hours: {
    start: string;
    end: string;
    timezone: string;
  };
  allowed_assets: {
    stocks: boolean;
    options: boolean;
    futures: boolean;
  };
  risk_management: {
    max_daily_loss: number;
    max_position_size: number;
    allow_short_selling: boolean;
    allow_leverage: boolean;
    max_leverage: number;
  };
}

interface LeaderboardTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'trading' | 'competition' | 'engagement' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  config: any;
  trading_settings: TradingSettings;
  popular?: boolean;
  new?: boolean;
}

const defaultTradingSettings: TradingSettings = {
  default_starting_balance: 100000,
  max_trade_amount: 10000,
  min_trade_amount: 1,
  trading_hours: {
    start: "09:30",
    end: "16:00",
    timezone: "America/New_York"
  },
  allowed_assets: {
    stocks: true,
    options: false,
    futures: false
  },
  risk_management: {
    max_daily_loss: 5000,
    max_position_size: 25000,
    allow_short_selling: true,
    allow_leverage: false,
    max_leverage: 2
  }
};

const conservativeTradingSettings: TradingSettings = {
  default_starting_balance: 50000,
  max_trade_amount: 5000,
  min_trade_amount: 1,
  trading_hours: {
    start: "09:30",
    end: "16:00",
    timezone: "America/New_York"
  },
  allowed_assets: {
    stocks: true,
    options: false,
    futures: false
  },
  risk_management: {
    max_daily_loss: 2500,
    max_position_size: 12500,
    allow_short_selling: false,
    allow_leverage: false,
    max_leverage: 1
  }
};

const aggressiveTradingSettings: TradingSettings = {
  default_starting_balance: 200000,
  max_trade_amount: 50000,
  min_trade_amount: 1,
  trading_hours: {
    start: "09:30",
    end: "16:00",
    timezone: "America/New_York"
  },
  allowed_assets: {
    stocks: true,
    options: true,
    futures: false
  },
  risk_management: {
    max_daily_loss: 20000,
    max_position_size: 100000,
    allow_short_selling: true,
    allow_leverage: true,
    max_leverage: 4
  }
};

const templates: LeaderboardTemplate[] = [
  {
    id: 'top-traders-monthly',
    name: 'Top Traders Monthly',
    description: 'Monthly ranking of traders by profit & loss performance',
    icon: Trophy,
    category: 'trading',
    difficulty: 'beginner',
    popular: true,
    trading_settings: defaultTradingSettings,
    config: {
      name: 'Top Traders Monthly',
      description: 'Monthly ranking of the best performing traders by P&L',
      type: 'global',
      ranking_criteria: 'pnl',
      time_period: 'monthly',
      max_entries: 50,
      auto_refresh: true,
      refresh_interval: 5,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: true,
        show_join_date: false,
        show_balance: true,
        show_percentage_change: true,
        show_trade_count: true,
        color_scheme: 'green_red',
        animation_enabled: true,
        compact_mode: false,
      },
      filters: {
        min_trades: 5,
        exclude_inactive: true,
        verified_only: false,
      },
      rewards: {
        enabled: true,
        positions: [
          { rank: 1, reward_type: 'cash', reward_value: 1000 },
          { rank: 2, reward_type: 'cash', reward_value: 500 },
          { rank: 3, reward_type: 'cash', reward_value: 250 },
        ],
      },
      visibility: {
        public: true,
        featured: true,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
  {
    id: 'roi-champions',
    name: 'ROI Champions',
    description: 'Traders with the highest return on investment percentages',
    icon: TrendingUp,
    category: 'trading',
    difficulty: 'intermediate',
    trading_settings: defaultTradingSettings,
    config: {
      name: 'ROI Champions',
      description: 'Ranking traders by return on investment percentage',
      type: 'global',
      ranking_criteria: 'roi',
      time_period: 'weekly',
      max_entries: 25,
      auto_refresh: true,
      refresh_interval: 10,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: true,
        show_join_date: false,
        show_balance: false,
        show_percentage_change: true,
        show_trade_count: true,
        color_scheme: 'blue_orange',
        animation_enabled: true,
        compact_mode: false,
      },
      filters: {
        min_balance: 1000,
        min_trades: 10,
        exclude_inactive: true,
        verified_only: false,
      },
      rewards: {
        enabled: false,
        positions: [],
      },
      visibility: {
        public: true,
        featured: false,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
  {
    id: 'daily-warriors',
    name: 'Daily Warriors',
    description: 'Fast-paced daily leaderboard for active day traders',
    icon: Zap,
    category: 'trading',
    difficulty: 'advanced',
    new: true,
    trading_settings: aggressiveTradingSettings,
    config: {
      name: 'Daily Warriors',
      description: 'Daily leaderboard for the most active and profitable day traders',
      type: 'global',
      ranking_criteria: 'pnl',
      time_period: 'daily',
      max_entries: 20,
      auto_refresh: true,
      refresh_interval: 1,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: false,
        show_join_date: false,
        show_balance: false,
        show_percentage_change: true,
        show_trade_count: true,
        color_scheme: 'purple_gold',
        animation_enabled: true,
        compact_mode: true,
      },
      filters: {
        min_trades: 3,
        exclude_inactive: true,
        verified_only: false,
      },
      rewards: {
        enabled: true,
        positions: [
          { rank: 1, reward_type: 'points', reward_value: 100 },
          { rank: 2, reward_type: 'points', reward_value: 75 },
          { rank: 3, reward_type: 'points', reward_value: 50 },
        ],
      },
      visibility: {
        public: true,
        featured: false,
        embed_enabled: false,
        api_access: false,
      },
    },
  },
  {
    id: 'consistent-performers',
    name: 'Consistent Performers',
    description: 'Traders ranked by win rate and consistency',
    icon: Target,
    category: 'trading',
    difficulty: 'intermediate',
    trading_settings: conservativeTradingSettings,
    config: {
      name: 'Consistent Performers',
      description: 'Highlighting traders with the best win rates and consistent performance',
      type: 'global',
      ranking_criteria: 'win_rate',
      time_period: 'monthly',
      max_entries: 30,
      auto_refresh: true,
      refresh_interval: 15,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: true,
        show_join_date: true,
        show_balance: true,
        show_percentage_change: false,
        show_trade_count: true,
        color_scheme: 'default',
        animation_enabled: false,
        compact_mode: false,
      },
      filters: {
        min_trades: 20,
        exclude_inactive: true,
        verified_only: true,
      },
      rewards: {
        enabled: true,
        positions: [
          { rank: 1, reward_type: 'badge', reward_value: 1, reward_description: 'Consistency Master' },
          { rank: 2, reward_type: 'badge', reward_value: 1, reward_description: 'Steady Trader' },
          { rank: 3, reward_type: 'badge', reward_value: 1, reward_description: 'Reliable Performer' },
        ],
      },
      visibility: {
        public: true,
        featured: false,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
  {
    id: 'volume-leaders',
    name: 'Volume Leaders',
    description: 'Most active traders by total trading volume',
    icon: BarChart3,
    category: 'trading',
    difficulty: 'beginner',
    trading_settings: defaultTradingSettings,
    config: {
      name: 'Volume Leaders',
      description: 'Ranking the most active traders by total trading volume',
      type: 'global',
      ranking_criteria: 'volume',
      time_period: 'weekly',
      max_entries: 40,
      auto_refresh: true,
      refresh_interval: 10,
      display_settings: {
        show_rank_icons: false,
        show_user_avatar: true,
        show_join_date: false,
        show_balance: false,
        show_percentage_change: false,
        show_trade_count: true,
        color_scheme: 'blue_orange',
        animation_enabled: true,
        compact_mode: false,
      },
      filters: {
        min_trades: 1,
        exclude_inactive: false,
        verified_only: false,
      },
      rewards: {
        enabled: false,
        positions: [],
      },
      visibility: {
        public: true,
        featured: false,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
  {
    id: 'competition-challenge',
    name: 'Monthly Competition',
    description: 'Template for monthly trading competitions with prizes',
    icon: Gamepad2,
    category: 'competition',
    difficulty: 'intermediate',
    popular: true,
    trading_settings: defaultTradingSettings,
    config: {
      name: 'Monthly Trading Challenge',
      description: 'Monthly competition with cash prizes for top performers',
      type: 'competition',
      ranking_criteria: 'pnl',
      time_period: 'monthly',
      max_entries: 100,
      auto_refresh: true,
      refresh_interval: 5,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: true,
        show_join_date: true,
        show_balance: true,
        show_percentage_change: true,
        show_trade_count: true,
        color_scheme: 'purple_gold',
        animation_enabled: true,
        compact_mode: false,
      },
      filters: {
        min_trades: 10,
        exclude_inactive: true,
        verified_only: true,
      },
      rewards: {
        enabled: true,
        positions: [
          { rank: 1, reward_type: 'cash', reward_value: 5000 },
          { rank: 2, reward_type: 'cash', reward_value: 2500 },
          { rank: 3, reward_type: 'cash', reward_value: 1000 },
          { rank: 4, reward_type: 'cash', reward_value: 500 },
          { rank: 5, reward_type: 'cash', reward_value: 250 },
        ],
      },
      visibility: {
        public: true,
        featured: true,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
  {
    id: 'newcomer-spotlight',
    name: 'Newcomer Spotlight',
    description: 'Highlighting new traders and their early performance',
    icon: Star,
    category: 'engagement',
    difficulty: 'beginner',
    new: true,
    trading_settings: conservativeTradingSettings,
    config: {
      name: 'Newcomer Spotlight',
      description: 'Showcasing promising new traders in their first month',
      type: 'global',
      ranking_criteria: 'pnl',
      time_period: 'monthly',
      max_entries: 15,
      auto_refresh: true,
      refresh_interval: 30,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: true,
        show_join_date: true,
        show_balance: true,
        show_percentage_change: true,
        show_trade_count: true,
        color_scheme: 'green_red',
        animation_enabled: true,
        compact_mode: false,
      },
      filters: {
        min_days_active: 30,
        min_trades: 5,
        exclude_inactive: true,
        verified_only: false,
      },
      rewards: {
        enabled: true,
        positions: [
          { rank: 1, reward_type: 'cash', reward_value: 500, reward_description: 'Rookie of the Month' },
          { rank: 2, reward_type: 'cash', reward_value: 250, reward_description: 'Rising Star' },
          { rank: 3, reward_type: 'cash', reward_value: 100, reward_description: 'Promising Newcomer' },
        ],
      },
      visibility: {
        public: true,
        featured: false,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
  {
    id: 'all-time-legends',
    name: 'All-Time Legends',
    description: 'Hall of fame for the best performers of all time',
    icon: Crown,
    category: 'trading',
    difficulty: 'advanced',
    trading_settings: aggressiveTradingSettings,
    config: {
      name: 'All-Time Legends',
      description: 'Hall of fame showcasing the greatest traders of all time',
      type: 'global',
      ranking_criteria: 'pnl',
      time_period: 'all_time',
      max_entries: 10,
      auto_refresh: false,
      refresh_interval: 60,
      display_settings: {
        show_rank_icons: true,
        show_user_avatar: true,
        show_join_date: true,
        show_balance: true,
        show_percentage_change: true,
        show_trade_count: true,
        color_scheme: 'purple_gold',
        animation_enabled: true,
        compact_mode: false,
      },
      filters: {
        min_trades: 100,
        min_days_active: 365,
        exclude_inactive: false,
        verified_only: true,
      },
      rewards: {
        enabled: true,
        positions: [
          { rank: 1, reward_type: 'badge', reward_value: 1, reward_description: 'Trading Legend' },
          { rank: 2, reward_type: 'badge', reward_value: 1, reward_description: 'Master Trader' },
          { rank: 3, reward_type: 'badge', reward_value: 1, reward_description: 'Elite Performer' },
        ],
      },
      visibility: {
        public: true,
        featured: true,
        embed_enabled: true,
        api_access: true,
      },
    },
  },
];

const categoryColors = {
  trading: 'bg-blue-600',
  competition: 'bg-purple-600',
  engagement: 'bg-green-600',
  custom: 'bg-gray-600',
};

const difficultyColors = {
  beginner: 'bg-green-500',
  intermediate: 'bg-yellow-500',
  advanced: 'bg-red-500',
};

interface LeaderboardTemplatesProps {
  onTemplateSelect: (template: LeaderboardTemplate) => void;
  selectedCategory?: string;
}

export default function LeaderboardTemplates({ 
  onTemplateSelect, 
  selectedCategory = 'all' 
}: LeaderboardTemplatesProps) {
  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Leaderboard Templates</h3>
        <p className="text-gray-400">Choose from pre-configured templates to get started quickly</p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          const IconComponent = template.icon;
          
          return (
            <Card 
              key={template.id} 
              className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => onTemplateSelect(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${categoryColors[template.category]}`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-sm font-medium flex items-center">
                        {template.name}
                        {template.popular && (
                          <Badge className="ml-2 bg-orange-600 text-white text-xs">Popular</Badge>
                        )}
                        {template.new && (
                          <Badge className="ml-2 bg-blue-600 text-white text-xs">New</Badge>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {template.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={`${categoryColors[template.category]} text-white text-xs`}
                    >
                      {template.category}
                    </Badge>
                    <Badge 
                      className={`${difficultyColors[template.difficulty]} text-white text-xs`}
                    >
                      {template.difficulty}
                    </Badge>
                  </div>
                  
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTemplateSelect(template);
                    }}
                  >
                    Use Template
                  </Button>
                </div>

                {/* Template Preview Info */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>
                      <span className="font-medium">Criteria:</span> {template.config.ranking_criteria.toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">Period:</span> {template.config.time_period.replace('_', ' ')}
                    </div>
                    <div>
                      <span className="font-medium">Max Entries:</span> {template.config.max_entries}
                    </div>
                    <div>
                      <span className="font-medium">Rewards:</span> {template.config.rewards.enabled ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <span className="font-medium">Start Balance:</span> ${(template.trading_settings.default_starting_balance / 1000).toFixed(0)}k
                    </div>
                    <div>
                      <span className="font-medium">Max Trade:</span> ${(template.trading_settings.max_trade_amount / 1000).toFixed(0)}k
                    </div>
                    <div>
                      <span className="font-medium">Short Selling:</span> {template.trading_settings.risk_management.allow_short_selling ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <span className="font-medium">Leverage:</span> {template.trading_settings.risk_management.allow_leverage ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No templates found</p>
          <p className="text-sm">Try selecting a different category</p>
        </div>
      )}
    </div>
  );
}