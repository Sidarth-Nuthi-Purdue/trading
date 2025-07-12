-- Create RPC function to bypass RLS when creating Whop users
-- This function runs with SECURITY DEFINER to bypass RLS policies

CREATE OR REPLACE FUNCTION create_whop_user(
    p_user_id UUID,
    p_whop_user_id TEXT,
    p_email TEXT,
    p_username TEXT
) RETURNS UUID AS $$
DECLARE
    inserted_user_id UUID;
BEGIN
    -- Insert user profile record bypassing RLS
    INSERT INTO user_profiles (
        user_id,
        whop_user_id,
        email,
        username,
        first_name,
        last_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_whop_user_id,
        p_email,
        p_username,
        p_username,
        '',
        'member',
        NOW(),
        NOW()
    )
    RETURNING user_id INTO inserted_user_id;
    
    -- Create initial balance record
    INSERT INTO user_balances (
        user_id,
        balance,
        available_balance,
        total_pnl,
        daily_pnl,
        weekly_pnl,
        monthly_pnl,
        created_at,
        updated_at
    ) VALUES (
        inserted_user_id,
        100000.00,
        100000.00,
        0.00,
        0.00,
        0.00,
        0.00,
        NOW(),
        NOW()
    );
    
    RETURN inserted_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION create_whop_user(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_whop_user(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION create_whop_user(UUID, TEXT, TEXT, TEXT) IS 
'Creates a new Whop user with initial balance, bypassing RLS policies';