-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create triggers helper function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. AUTH SETUP
-- Public users table to store additional user info
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Create trigger to automatically create a user record when a new auth.user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. VIRTUAL TRADING ACCOUNTS
CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_balance DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  portfolio_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  buying_power DECIMAL(15, 4) NOT NULL DEFAULT 20000.0000,
  total_deposits DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  total_withdrawals DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_virtual_trading_accounts_updated_at ON public.virtual_trading_accounts;
CREATE TRIGGER set_virtual_trading_accounts_updated_at
BEFORE UPDATE ON public.virtual_trading_accounts
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 3. VIRTUAL POSITIONS
CREATE TABLE IF NOT EXISTS public.virtual_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL,
  average_entry_price DECIMAL(15, 4) NOT NULL,
  current_price DECIMAL(15, 4) NOT NULL,
  market_value DECIMAL(15, 4) NOT NULL,
  cost_basis DECIMAL(15, 4) NOT NULL,
  unrealized_pl DECIMAL(15, 4) NOT NULL,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL,
  asset_class TEXT NOT NULL DEFAULT 'equity' CHECK (asset_class IN ('equity', 'option', 'future', 'crypto')),
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, account_id, symbol, side)
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_virtual_positions_updated_at ON public.virtual_positions;
CREATE TRIGGER set_virtual_positions_updated_at
BEFORE UPDATE ON public.virtual_positions
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 4. VIRTUAL ORDERS
CREATE TABLE IF NOT EXISTS public.virtual_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop_limit', 'stop')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(15, 4) NOT NULL,
  price DECIMAL(15, 4),
  stop_price DECIMAL(15, 4),
  filled_quantity DECIMAL(15, 4) DEFAULT 0,
  filled_avg_price DECIMAL(15, 4),
  status TEXT NOT NULL CHECK (status IN ('open', 'filled', 'partially_filled', 'canceled', 'expired', 'rejected')),
  time_in_force TEXT NOT NULL DEFAULT 'day' CHECK (time_in_force IN ('day', 'gtc', 'ioc', 'fok')),
  asset_class TEXT NOT NULL DEFAULT 'equity' CHECK (asset_class IN ('equity', 'option', 'future', 'crypto')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  filled_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_virtual_orders_updated_at ON public.virtual_orders;
CREATE TRIGGER set_virtual_orders_updated_at
BEFORE UPDATE ON public.virtual_orders
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 5. VIRTUAL TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.virtual_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.virtual_orders(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('trade', 'deposit', 'withdrawal', 'dividend', 'interest', 'fee', 'adjustment')),
  symbol TEXT,
  side TEXT CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(15, 4),
  price DECIMAL(15, 4),
  amount DECIMAL(15, 4) NOT NULL,
  fees DECIMAL(15, 4) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 6. COMPETITIONS
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  prize_amount DECIMAL(15, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_competitions_updated_at ON public.competitions;
CREATE TRIGGER set_competitions_updated_at
BEFORE UPDATE ON public.competitions
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 7. COMPETITION PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.competition_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_balance DECIMAL(15, 4) NOT NULL,
  current_balance DECIMAL(15, 4) NOT NULL,
  pnl DECIMAL(15, 4) NOT NULL DEFAULT 0,
  pnl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0,
  rank INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disqualified', 'completed')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(competition_id, user_id)
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_competition_participants_updated_at ON public.competition_participants;
CREATE TRIGGER set_competition_participants_updated_at
BEFORE UPDATE ON public.competition_participants
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 8. CREATOR SETTINGS
CREATE TABLE IF NOT EXISTS public.creator_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_balance DECIMAL(15, 4) NOT NULL DEFAULT 10000,
  max_trade_size DECIMAL(15, 4),
  min_trade_size DECIMAL(15, 4) DEFAULT 1,
  leverage_allowed BOOLEAN DEFAULT true,
  max_leverage DECIMAL(5, 2) DEFAULT 2.00,
  allowed_asset_classes TEXT[] DEFAULT ARRAY['equity', 'option', 'future', 'crypto'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(created_by)
);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS set_creator_settings_updated_at ON public.creator_settings;
CREATE TRIGGER set_creator_settings_updated_at
BEFORE UPDATE ON public.creator_settings
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 9. LEADERBOARD VIEWS
-- Create view for all-time leaderboard
CREATE OR REPLACE VIEW public.leaderboard_all_time AS
SELECT
  u.id as user_id,
  u.username,
  vta.realized_pl + vta.unrealized_pl as total_pnl,
  ((vta.realized_pl + vta.unrealized_pl) / NULLIF(vta.total_deposits - vta.total_withdrawals, 0)) * 100 as pnl_percent,
  vta.cash_balance + vta.portfolio_value as total_value,
  COUNT(DISTINCT vo.id) as total_trades
FROM
  public.users u
JOIN
  public.virtual_trading_accounts vta ON u.id = vta.user_id
LEFT JOIN
  public.virtual_orders vo ON u.id = vo.user_id AND vo.status = 'filled'
GROUP BY
  u.id, u.username, vta.realized_pl, vta.unrealized_pl, vta.total_deposits, vta.total_withdrawals, vta.cash_balance, vta.portfolio_value
ORDER BY
  total_pnl DESC;

-- Create function to get or create a trading account for a user
CREATE OR REPLACE FUNCTION get_or_create_virtual_account(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
    v_starting_balance DECIMAL(15, 4) := 10000.0000; -- Default starting balance
BEGIN
    -- Try to get creator settings for default balance
    BEGIN
        SELECT starting_balance INTO v_starting_balance
        FROM public.creator_settings
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- Use default if no settings found
        v_starting_balance := 10000.0000;
    END;

    -- Try to get existing account
    SELECT id INTO v_account_id
    FROM public.virtual_trading_accounts
    WHERE user_id = p_user_id;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
        INSERT INTO public.virtual_trading_accounts (
            user_id, 
            cash_balance, 
            buying_power,
            total_deposits,
            status
        )
        VALUES (
            p_user_id, 
            v_starting_balance, 
            v_starting_balance * 2,
            v_starting_balance,
            'active'
        )
        RETURNING id INTO v_account_id;
    END IF;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql; 