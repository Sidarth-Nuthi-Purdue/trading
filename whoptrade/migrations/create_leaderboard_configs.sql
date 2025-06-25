-- Migration: Create leaderboard_configs table
-- This table stores custom leaderboard configurations created by creators

CREATE TABLE IF NOT EXISTS leaderboard_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('global', 'competition', 'custom')),
    ranking_criteria VARCHAR(50) NOT NULL CHECK (ranking_criteria IN ('pnl', 'roi', 'win_rate', 'total_trades', 'volume', 'sharpe_ratio')),
    time_period VARCHAR(50) NOT NULL CHECK (time_period IN ('all_time', 'yearly', 'monthly', 'weekly', 'daily', 'custom')),
    custom_period_days INTEGER,
    max_entries INTEGER NOT NULL DEFAULT 100 CHECK (max_entries >= 10 AND max_entries <= 1000),
    auto_refresh BOOLEAN NOT NULL DEFAULT true,
    refresh_interval INTEGER NOT NULL DEFAULT 5 CHECK (refresh_interval >= 1 AND refresh_interval <= 60),
    display_settings JSONB NOT NULL DEFAULT '{
        "show_rank_icons": true,
        "show_user_avatar": true,
        "show_join_date": true,
        "show_balance": true,
        "show_percentage_change": true,
        "show_trade_count": true,
        "color_scheme": "default",
        "animation_enabled": true,
        "compact_mode": false
    }'::jsonb,
    filters JSONB NOT NULL DEFAULT '{
        "exclude_inactive": true,
        "verified_only": false
    }'::jsonb,
    rewards JSONB NOT NULL DEFAULT '{
        "enabled": false,
        "positions": []
    }'::jsonb,
    visibility JSONB NOT NULL DEFAULT '{
        "public": true,
        "featured": false,
        "embed_enabled": true,
        "api_access": true
    }'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_creator_id ON leaderboard_configs(creator_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_type ON leaderboard_configs(type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_status ON leaderboard_configs(status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_featured ON leaderboard_configs((visibility->>'featured')) WHERE (visibility->>'featured')::boolean = true;
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_public ON leaderboard_configs((visibility->>'public')) WHERE (visibility->>'public')::boolean = true;

-- Add RLS policies
ALTER TABLE leaderboard_configs ENABLE ROW LEVEL SECURITY;

-- Creators can view, create, update, and delete their own configs
CREATE POLICY "Creators can manage their own leaderboard configs" ON leaderboard_configs
    FOR ALL USING (creator_id = auth.uid());

-- Public configs can be viewed by anyone
CREATE POLICY "Public configs can be viewed by anyone" ON leaderboard_configs
    FOR SELECT USING ((visibility->>'public')::boolean = true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leaderboard_configs_updated_at 
    BEFORE UPDATE ON leaderboard_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE leaderboard_configs IS 'Custom leaderboard configurations created by creators';
COMMENT ON COLUMN leaderboard_configs.creator_id IS 'User ID of the creator who owns this configuration';
COMMENT ON COLUMN leaderboard_configs.ranking_criteria IS 'The metric used for ranking (pnl, roi, win_rate, etc.)';
COMMENT ON COLUMN leaderboard_configs.time_period IS 'Time period for the leaderboard data';
COMMENT ON COLUMN leaderboard_configs.display_settings IS 'JSON object containing UI display preferences';
COMMENT ON COLUMN leaderboard_configs.filters IS 'JSON object containing entry filters and criteria';
COMMENT ON COLUMN leaderboard_configs.rewards IS 'JSON object containing reward configuration for top positions';
COMMENT ON COLUMN leaderboard_configs.visibility IS 'JSON object containing visibility and access settings';