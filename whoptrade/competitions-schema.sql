-- Enhanced Competition System for Whop Trading Platform
-- Individual competitions with invite-only access and balance isolation

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'ended', 'cancelled'
    type VARCHAR(50) DEFAULT 'invite_only', -- 'invite_only', 'public'
    
    -- Competition settings
    starting_balance DECIMAL(15,2) DEFAULT 100000.00,
    max_participants INTEGER DEFAULT 100,
    entry_fee DECIMAL(15,2) DEFAULT 0.00,
    prize_pool DECIMAL(15,2) DEFAULT 0.00,
    
    -- Time settings
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    registration_deadline TIMESTAMP,
    
    -- Competition rules
    allowed_instruments JSONB DEFAULT '["stocks", "options"]'::jsonb,
    max_position_size DECIMAL(5,2) DEFAULT 100.00, -- percentage
    day_trading_enabled BOOLEAN DEFAULT true,
    options_trading_enabled BOOLEAN DEFAULT true,
    
    -- Ranking criteria
    ranking_criteria VARCHAR(50) DEFAULT 'total_pnl', -- 'total_pnl', 'roi', 'sharpe_ratio'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (creator_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Create competition participants table
CREATE TABLE IF NOT EXISTS competition_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL,
    user_id UUID NOT NULL,
    whop_user_id VARCHAR(255),
    
    -- Participation status
    status VARCHAR(50) DEFAULT 'invited', -- 'invited', 'accepted', 'active', 'withdrawn', 'disqualified'
    joined_at TIMESTAMP DEFAULT NOW(),
    
    -- Competition-specific balance and stats (isolated from main account)
    starting_balance DECIMAL(15,2) DEFAULT 100000.00,
    current_balance DECIMAL(15,2) DEFAULT 100000.00,
    total_pnl DECIMAL(15,2) DEFAULT 0.00,
    realized_pnl DECIMAL(15,2) DEFAULT 0.00,
    unrealized_pnl DECIMAL(15,2) DEFAULT 0.00,
    
    -- Performance metrics
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    max_drawdown DECIMAL(15,2) DEFAULT 0.00,
    best_day DECIMAL(15,2) DEFAULT 0.00,
    worst_day DECIMAL(15,2) DEFAULT 0.00,
    
    -- Daily tracking
    daily_pnl DECIMAL(15,2) DEFAULT 0.00,
    weekly_pnl DECIMAL(15,2) DEFAULT 0.00,
    monthly_pnl DECIMAL(15,2) DEFAULT 0.00,
    
    -- Current ranking
    current_rank INTEGER,
    final_rank INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    
    -- Ensure one participation per user per competition
    UNIQUE(competition_id, user_id)
);

-- Competition-specific trades table (isolated from main trading)
CREATE TABLE IF NOT EXISTS competition_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Trade details (similar to main trade_orders but competition-specific)
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    order_type VARCHAR(20) DEFAULT 'market', -- 'market', 'limit', 'stop'
    asset_type VARCHAR(20) DEFAULT 'stock', -- 'stock', 'option'
    
    quantity INTEGER NOT NULL,
    price DECIMAL(10,4),
    filled_price DECIMAL(10,4),
    
    -- Option-specific fields
    option_contract VARCHAR(100),
    expiration_date DATE,
    strike_price DECIMAL(10,2),
    option_type VARCHAR(10), -- 'call', 'put'
    
    -- Trade execution
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'filled', 'partial', 'cancelled'
    filled_quantity INTEGER DEFAULT 0,
    remaining_quantity INTEGER,
    
    -- Financial impact
    total_cost DECIMAL(15,2),
    realized_pnl DECIMAL(15,2) DEFAULT 0.00,
    fees DECIMAL(10,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    filled_at TIMESTAMP,
    
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES competition_participants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Competition invitations table
CREATE TABLE IF NOT EXISTS competition_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL,
    inviter_id UUID NOT NULL, -- Who sent the invite
    invitee_whop_id VARCHAR(255), -- Whop user ID being invited
    invitee_email VARCHAR(255), -- Email if Whop ID not available
    
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    invitation_code VARCHAR(100) UNIQUE,
    expires_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Competition portfolio snapshots (for tracking performance over time)
CREATE TABLE IF NOT EXISTS competition_portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    
    snapshot_date DATE NOT NULL,
    portfolio_value DECIMAL(15,2) NOT NULL,
    cash_balance DECIMAL(15,2) NOT NULL,
    positions_value DECIMAL(15,2) NOT NULL,
    daily_pnl DECIMAL(15,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES competition_participants(id) ON DELETE CASCADE,
    
    -- One snapshot per participant per day
    UNIQUE(competition_id, participant_id, snapshot_date)
);

-- Competition leaderboard materialized view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS competition_leaderboard AS
SELECT 
    cp.competition_id,
    cp.id as participant_id,
    cp.user_id,
    cp.whop_user_id,
    up.username,
    up.first_name,
    up.last_name,
    cp.current_balance,
    cp.total_pnl,
    cp.realized_pnl,
    cp.unrealized_pnl,
    cp.total_trades,
    cp.winning_trades,
    cp.losing_trades,
    cp.win_rate,
    cp.daily_pnl,
    cp.weekly_pnl,
    cp.monthly_pnl,
    ROW_NUMBER() OVER (
        PARTITION BY cp.competition_id 
        ORDER BY cp.total_pnl DESC, cp.current_balance DESC
    ) as current_rank,
    c.name as competition_name,
    c.status as competition_status,
    c.ranking_criteria
FROM competition_participants cp
JOIN competitions c ON cp.competition_id = c.id
JOIN user_profiles up ON cp.user_id = up.user_id
WHERE cp.status = 'active'
AND c.status = 'active';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_creator ON competitions(creator_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user ON competition_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_whop ON competition_participants(whop_user_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_status ON competition_participants(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_competition_trades_participant ON competition_trades(participant_id);
CREATE INDEX IF NOT EXISTS idx_competition_trades_symbol ON competition_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_competition_invitations_code ON competition_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_competition_invitations_whop ON competition_invitations(invitee_whop_id);

-- Function to update competition participant rankings
CREATE OR REPLACE FUNCTION update_competition_rankings(comp_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Update current ranks based on total P&L
    WITH ranked_participants AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY total_pnl DESC, current_balance DESC) as new_rank
        FROM competition_participants 
        WHERE competition_id = comp_id 
        AND status = 'active'
    )
    UPDATE competition_participants 
    SET current_rank = rp.new_rank,
        updated_at = NOW()
    FROM ranked_participants rp
    WHERE competition_participants.id = rp.id;
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW competition_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- Function to create competition invitation
CREATE OR REPLACE FUNCTION create_competition_invitation(
    comp_id UUID,
    inviter UUID,
    whop_id VARCHAR(255),
    email VARCHAR(255) DEFAULT NULL
) RETURNS VARCHAR(100) AS $$
DECLARE
    invite_code VARCHAR(100);
    expiry_date TIMESTAMP;
BEGIN
    -- Generate unique invitation code
    invite_code := 'COMP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
    expiry_date := NOW() + INTERVAL '7 days';
    
    INSERT INTO competition_invitations (
        competition_id,
        inviter_id,
        invitee_whop_id,
        invitee_email,
        invitation_code,
        expires_at
    ) VALUES (
        comp_id,
        inviter,
        whop_id,
        email,
        invite_code,
        expiry_date
    );
    
    RETURN invite_code;
END;
$$ LANGUAGE plpgsql;

-- Function to join competition (resets balance)
CREATE OR REPLACE FUNCTION join_competition(
    comp_id UUID,
    user_uuid UUID,
    whop_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    competition_record RECORD;
    existing_participation RECORD;
    starting_bal DECIMAL(15,2);
BEGIN
    -- Check if competition exists and is active
    SELECT * INTO competition_record 
    FROM competitions 
    WHERE id = comp_id AND status IN ('active', 'draft');
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Competition not found or not active';
    END IF;
    
    -- Check if user is already in an active competition
    SELECT * INTO existing_participation
    FROM competition_participants cp
    JOIN competitions c ON cp.competition_id = c.id
    WHERE cp.user_id = user_uuid 
    AND cp.status = 'active'
    AND c.status = 'active';
    
    IF FOUND THEN
        RAISE EXCEPTION 'User already participating in an active competition';
    END IF;
    
    starting_bal := competition_record.starting_balance;
    
    -- Create participant record with reset balance
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        whop_user_id,
        status,
        starting_balance,
        current_balance
    ) VALUES (
        comp_id,
        user_uuid,
        whop_id,
        'active',
        starting_bal,
        starting_bal
    );
    
    -- Update rankings
    PERFORM update_competition_rankings(comp_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for competitions
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_invitations ENABLE ROW LEVEL SECURITY;

-- Competition access policies
CREATE POLICY "Users can view active competitions" ON competitions
    FOR SELECT USING (status = 'active' OR creator_id = auth.uid());

CREATE POLICY "Creators can manage own competitions" ON competitions
    FOR ALL USING (creator_id = auth.uid());

-- Participant access policies  
CREATE POLICY "Users can view own participation" ON competition_participants
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can join competitions" ON competition_participants
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Trade access policies
CREATE POLICY "Users can view own competition trades" ON competition_trades
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own competition trades" ON competition_trades
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON competition_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON competition_trades TO authenticated;
GRANT SELECT, INSERT ON competition_invitations TO authenticated;
GRANT SELECT ON competition_leaderboard TO authenticated;

-- Grant all to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;