-- WhopTrade Paper Trading System - Row Level Security Policies
-- These policies control access to paper trading data based on user roles and ownership

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER_PROFILES TABLE POLICIES
-- =====================================================

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Creators can view all user profiles
CREATE POLICY "Creators can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- =====================================================
-- USER_BALANCES TABLE POLICIES
-- =====================================================

-- Users can view their own balance
CREATE POLICY "Users can view own balance" ON user_balances
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own balance (for P&L calculations)
CREATE POLICY "Users can update own balance" ON user_balances
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own balance record
CREATE POLICY "Users can insert own balance" ON user_balances
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Creators can view all user balances
CREATE POLICY "Creators can view all balances" ON user_balances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- Creators can modify user balances (for balance adjustments)
CREATE POLICY "Creators can modify user balances" ON user_balances
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- Creators can insert user balance records
CREATE POLICY "Creators can insert user balances" ON user_balances
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- =====================================================
-- USER_PORTFOLIOS TABLE POLICIES
-- =====================================================

-- Users can view their own portfolio
CREATE POLICY "Users can view own portfolio" ON user_portfolios
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own portfolio (for trades)
CREATE POLICY "Users can update own portfolio" ON user_portfolios
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own portfolio positions
CREATE POLICY "Users can insert own positions" ON user_portfolios
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own portfolio positions (when quantity reaches 0)
CREATE POLICY "Users can delete own positions" ON user_portfolios
    FOR DELETE USING (auth.uid() = user_id);

-- Creators can view all user portfolios
CREATE POLICY "Creators can view all portfolios" ON user_portfolios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- =====================================================
-- TRADE_ORDERS TABLE POLICIES
-- =====================================================

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON trade_orders
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders" ON trade_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own orders (for cancellations and fills)
CREATE POLICY "Users can update own orders" ON trade_orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can cancel (delete) their own pending orders
CREATE POLICY "Users can cancel own orders" ON trade_orders
    FOR DELETE USING (
        auth.uid() = user_id 
        AND status IN ('pending', 'partially_filled')
    );

-- Creators can view all user orders
CREATE POLICY "Creators can view all orders" ON trade_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- =====================================================
-- COMPETITIONS TABLE POLICIES
-- =====================================================

-- Anyone can view active competitions
CREATE POLICY "Anyone can view competitions" ON competitions
    FOR SELECT USING (true);

-- Only creators can create competitions
CREATE POLICY "Creators can create competitions" ON competitions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
        AND auth.uid() = creator_id
    );

-- Creators can update their own competitions
CREATE POLICY "Creators can update own competitions" ON competitions
    FOR UPDATE USING (auth.uid() = creator_id);

-- Creators can delete their own competitions
CREATE POLICY "Creators can delete own competitions" ON competitions
    FOR DELETE USING (auth.uid() = creator_id);

-- =====================================================
-- COMPETITION_PARTICIPANTS TABLE POLICIES
-- =====================================================

-- Users can view competitions they're participating in
CREATE POLICY "Users can view own participation" ON competition_participants
    FOR SELECT USING (auth.uid() = user_id);

-- Users can join competitions
CREATE POLICY "Users can join competitions" ON competition_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can leave competitions (delete their participation)
CREATE POLICY "Users can leave competitions" ON competition_participants
    FOR DELETE USING (auth.uid() = user_id);

-- Creators can view all participants in their competitions
CREATE POLICY "Creators can view competition participants" ON competition_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM competitions c 
            WHERE c.id = competition_participants.competition_id 
            AND c.creator_id = auth.uid()
        )
    );

-- =====================================================
-- GLOBAL_SETTINGS TABLE POLICIES
-- =====================================================

-- Anyone can view global settings (read-only for users)
CREATE POLICY "Anyone can view settings" ON global_settings
    FOR SELECT USING (true);

-- Only creators can modify global settings
CREATE POLICY "Creators can modify settings" ON global_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles creator_profile 
            WHERE creator_profile.user_id = auth.uid() 
            AND creator_profile.role = 'creator'
        )
    );

-- =====================================================
-- UTILITY FUNCTIONS FOR ROLE CHECKING
-- =====================================================

-- Function to check if current user is a creator
CREATE OR REPLACE FUNCTION auth.is_creator() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = auth.uid() 
        AND role = 'creator'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user owns a competition
CREATE OR REPLACE FUNCTION auth.owns_competition(competition_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM competitions 
        WHERE id = competition_id 
        AND creator_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for efficient RLS policy checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_role ON user_profiles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user_id ON user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_user_id ON trade_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_user_status ON trade_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_competitions_creator_id ON competitions(creator_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user_id ON competition_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_competition_id ON competition_participants(competition_id);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_portfolios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trade_orders TO authenticated;
GRANT SELECT, INSERT ON competitions TO authenticated;
GRANT SELECT, INSERT, DELETE ON competition_participants TO authenticated;
GRANT SELECT ON global_settings TO authenticated;
GRANT UPDATE, INSERT, DELETE ON global_settings TO authenticated;

-- Grant all permissions to service_role (for backend operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Users can view own profile" ON user_profiles IS 
'Users can only see their own profile information';

COMMENT ON POLICY "Creators can view all profiles" ON user_profiles IS 
'Creators can view all user profiles for management purposes';

COMMENT ON POLICY "Users can view own balance" ON user_balances IS 
'Users can only see their own balance and P&L information';

COMMENT ON POLICY "Creators can modify user balances" ON user_balances IS 
'Creators can adjust user balances for management purposes';

COMMENT ON POLICY "Users can view own orders" ON trade_orders IS 
'Users can only see their own trading orders';

COMMENT ON POLICY "Users can cancel own orders" ON trade_orders IS 
'Users can only cancel their own pending or partially filled orders';

COMMENT ON POLICY "Anyone can view competitions" ON competitions IS 
'All users can view available competitions';

COMMENT ON POLICY "Creators can create competitions" ON competitions IS 
'Only creators can create new trading competitions';