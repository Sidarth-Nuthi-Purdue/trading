-- WhopTrade Paper Trading System - Comprehensive Database Schema
-- This schema supports the complete paper trading system with creator tools and user trading interface

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS competition_participants CASCADE;
DROP TABLE IF EXISTS competition_leaderboard CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;
DROP TABLE IF EXISTS trade_orders CASCADE;
DROP TABLE IF EXISTS user_portfolios CASCADE;
DROP TABLE IF EXISTS user_balances CASCADE;
DROP TABLE IF EXISTS global_settings CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- User Profiles Table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE, -- Supabase auth user ID
    whop_user_id TEXT, -- Whop platform user ID
    email TEXT,
    username TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('creator', 'user')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Global Settings Table (managed by creators)
CREATE TABLE global_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL,
    setting_name TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, setting_name)
);

-- Insert default global settings
INSERT INTO global_settings (creator_id, setting_name, setting_value) VALUES
('00000000-0000-0000-0000-000000000000', 'default_starting_balance', '{"amount": 100000}'),
('00000000-0000-0000-0000-000000000000', 'max_trade_amount', '{"amount": 10000}'),
('00000000-0000-0000-0000-000000000000', 'min_trade_amount', '{"amount": 1}'),
('00000000-0000-0000-0000-000000000000', 'trading_hours', '{"start": "09:30", "end": "16:00", "timezone": "America/New_York"}'),
('00000000-0000-0000-0000-000000000000', 'allowed_assets', '{"stocks": true, "options": false, "futures": false}');

-- User Balances Table
CREATE TABLE user_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00, -- Balance minus open orders
    total_pnl DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    daily_pnl DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    weekly_pnl DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    monthly_pnl DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- User Portfolios Table (holdings)
CREATE TABLE user_portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    symbol TEXT NOT NULL,
    asset_type TEXT DEFAULT 'stock' CHECK (asset_type IN ('stock', 'option', 'future')),
    quantity DECIMAL(15,6) NOT NULL DEFAULT 0,
    average_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
    current_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, symbol, asset_type)
);

-- Trade Orders Table
CREATE TABLE trade_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    symbol TEXT NOT NULL,
    asset_type TEXT DEFAULT 'stock' CHECK (asset_type IN ('stock', 'option', 'future')),
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop_loss', 'take_profit')),
    quantity DECIMAL(15,6) NOT NULL,
    price DECIMAL(15,4), -- NULL for market orders
    stop_price DECIMAL(15,4), -- For stop loss orders
    filled_quantity DECIMAL(15,6) NOT NULL DEFAULT 0,
    filled_price DECIMAL(15,4),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected')),
    time_in_force TEXT DEFAULT 'day' CHECK (time_in_force IN ('day', 'gtc', 'ioc', 'fok')),
    realized_pnl DECIMAL(15,2) DEFAULT 0,
    commission DECIMAL(8,2) DEFAULT 0,
    notes TEXT,
    filled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Competitions Table
CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    prize_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    prize_currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    max_participants INTEGER,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    rules JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Competition Participants Table
CREATE TABLE competition_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL,
    user_id UUID NOT NULL,
    starting_balance DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    total_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
    rank INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disqualified', 'withdrawn')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    UNIQUE(competition_id, user_id)
);

-- Competition Leaderboard View (materialized for performance)
CREATE MATERIALIZED VIEW competition_leaderboard AS
SELECT 
    cp.competition_id,
    cp.user_id,
    up.username,
    up.first_name,
    up.last_name,
    cp.starting_balance,
    cp.current_balance,
    cp.total_pnl,
    ROUND(((cp.current_balance - cp.starting_balance) / cp.starting_balance * 100), 2) as pnl_percentage,
    RANK() OVER (PARTITION BY cp.competition_id ORDER BY cp.total_pnl DESC) as rank,
    cp.status,
    cp.joined_at,
    cp.updated_at
FROM competition_participants cp
JOIN user_profiles up ON cp.user_id = up.user_id
WHERE cp.status = 'active';

-- Create indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_balances_user_id ON user_balances(user_id);
CREATE INDEX idx_user_portfolios_user_id ON user_portfolios(user_id);
CREATE INDEX idx_user_portfolios_symbol ON user_portfolios(symbol);
CREATE INDEX idx_trade_orders_user_id ON trade_orders(user_id);
CREATE INDEX idx_trade_orders_symbol ON trade_orders(symbol);
CREATE INDEX idx_trade_orders_status ON trade_orders(status);
CREATE INDEX idx_trade_orders_created_at ON trade_orders(created_at);
CREATE INDEX idx_competitions_creator_id ON competitions(creator_id);
CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competition_participants_competition_id ON competition_participants(competition_id);
CREATE INDEX idx_competition_participants_user_id ON competition_participants(user_id);
CREATE INDEX idx_global_settings_creator_id ON global_settings(creator_id);

-- Create GIN indexes for JSONB columns
CREATE INDEX idx_global_settings_value ON global_settings USING GIN(setting_value);
CREATE INDEX idx_competitions_rules ON competitions USING GIN(rules);

-- Functions and Triggers for automatic updates

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON global_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_balances_updated_at BEFORE UPDATE ON user_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_portfolios_updated_at BEFORE UPDATE ON user_portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trade_orders_updated_at BEFORE UPDATE ON trade_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_competition_participants_updated_at BEFORE UPDATE ON competition_participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate and update portfolio values
CREATE OR REPLACE FUNCTION update_portfolio_values()
RETURNS TRIGGER AS $$
BEGIN
    -- Update portfolio current_value and unrealized_pnl based on current market prices
    -- This would typically be called by a scheduled job with real market data
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update user balance after trade execution
CREATE OR REPLACE FUNCTION update_balance_after_trade()
RETURNS TRIGGER AS $$
DECLARE
    trade_value DECIMAL(15,2);
    user_balance RECORD;
BEGIN
    -- Only update if order status changed to 'filled'
    IF NEW.status = 'filled' AND OLD.status != 'filled' THEN
        -- Calculate trade value
        trade_value := NEW.filled_quantity * NEW.filled_price;
        
        -- Get current user balance
        SELECT * INTO user_balance FROM user_balances WHERE user_id = NEW.user_id;
        
        -- Update balance based on buy/sell
        IF NEW.side = 'buy' THEN
            -- Decrease balance for buy orders
            UPDATE user_balances 
            SET 
                available_balance = available_balance - trade_value - NEW.commission,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = NEW.user_id;
        ELSE
            -- Increase balance for sell orders
            UPDATE user_balances 
            SET 
                available_balance = available_balance + trade_value - NEW.commission,
                total_pnl = total_pnl + NEW.realized_pnl,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = NEW.user_id;
        END IF;
        
        -- Update or insert portfolio position
        INSERT INTO user_portfolios (user_id, symbol, asset_type, quantity, average_cost, current_value, updated_at)
        VALUES (NEW.user_id, NEW.symbol, NEW.asset_type, 
                CASE WHEN NEW.side = 'buy' THEN NEW.filled_quantity ELSE -NEW.filled_quantity END,
                NEW.filled_price, NEW.filled_quantity * NEW.filled_price, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, symbol, asset_type) 
        DO UPDATE SET
            quantity = user_portfolios.quantity + CASE WHEN NEW.side = 'buy' THEN NEW.filled_quantity ELSE -NEW.filled_quantity END,
            average_cost = CASE 
                WHEN NEW.side = 'buy' THEN 
                    ((user_portfolios.quantity * user_portfolios.average_cost) + (NEW.filled_quantity * NEW.filled_price)) / 
                    (user_portfolios.quantity + NEW.filled_quantity)
                ELSE user_portfolios.average_cost
            END,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update balance after trade execution
CREATE TRIGGER update_balance_after_trade_trigger 
    AFTER UPDATE ON trade_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_balance_after_trade();

-- Function to refresh competition leaderboard
CREATE OR REPLACE FUNCTION refresh_competition_leaderboard()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW competition_leaderboard;
END;
$$ language 'plpgsql';

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Creators can view all profiles" ON user_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'creator')
);

-- Policies for user_balances
CREATE POLICY "Users can view their own balance" ON user_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Creators can view all balances" ON user_balances FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'creator')
);
CREATE POLICY "Creators can update user balances" ON user_balances FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'creator')
);

-- Policies for user_portfolios
CREATE POLICY "Users can view their own portfolio" ON user_portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Creators can view all portfolios" ON user_portfolios FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'creator')
);

-- Policies for trade_orders
CREATE POLICY "Users can view their own orders" ON trade_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own orders" ON trade_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders" ON trade_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Creators can view all orders" ON trade_orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'creator')
);

-- Policies for competitions
CREATE POLICY "Everyone can view active competitions" ON competitions FOR SELECT USING (status = 'active');
CREATE POLICY "Creators can manage their competitions" ON competitions FOR ALL USING (auth.uid() = creator_id);

-- Policies for competition_participants
CREATE POLICY "Users can view competition participants" ON competition_participants FOR SELECT USING (true);
CREATE POLICY "Users can join competitions" ON competition_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Creators can manage participants" ON competition_participants FOR ALL USING (
    EXISTS (SELECT 1 FROM competitions WHERE id = competition_id AND creator_id = auth.uid())
);

-- Policies for global_settings
CREATE POLICY "Creators can manage settings" ON global_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'creator')
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'User profile information including role-based access';
COMMENT ON TABLE global_settings IS 'Creator-configurable global settings for the paper trading system';
COMMENT ON TABLE user_balances IS 'User account balances and P&L tracking';
COMMENT ON TABLE user_portfolios IS 'User stock/asset holdings and positions';
COMMENT ON TABLE trade_orders IS 'All trade orders including pending, filled, and cancelled orders';
COMMENT ON TABLE competitions IS 'Trading competitions created by creators';
COMMENT ON TABLE competition_participants IS 'Users participating in trading competitions';
COMMENT ON MATERIALIZED VIEW competition_leaderboard IS 'Pre-computed leaderboard for competitions';