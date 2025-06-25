-- Paper Trading Schema for TradingView Integration

-- Trading Accounts Table
CREATE TABLE IF NOT EXISTS trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);

-- Trading Orders Table
CREATE TABLE IF NOT EXISTS trading_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(15, 6) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
    status VARCHAR(10) NOT NULL CHECK (status IN ('placing', 'working', 'filled', 'canceled', 'rejected', 'inactive')),
    limit_price DECIMAL(15, 6),
    stop_price DECIMAL(15, 6),
    filled_price DECIMAL(15, 6),
    filled_quantity DECIMAL(15, 6),
    filled_at TIMESTAMP WITH TIME ZONE,
    parent_order_id UUID REFERENCES trading_orders(id),
    is_take_profit BOOLEAN DEFAULT FALSE,
    is_stop_loss BOOLEAN DEFAULT FALSE,
    take_profit DECIMAL(15, 6),
    stop_loss DECIMAL(15, 6),
    is_close BOOLEAN DEFAULT FALSE,
    client_order_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indices for orders
CREATE INDEX IF NOT EXISTS idx_trading_orders_account_id ON trading_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_trading_orders_symbol ON trading_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_orders_status ON trading_orders(status);

-- Trading Positions Table
CREATE TABLE IF NOT EXISTS trading_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(15, 6) NOT NULL DEFAULT 0,
    avg_price DECIMAL(15, 6) NOT NULL,
    take_profit DECIMAL(15, 6),
    stop_loss DECIMAL(15, 6),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create unique constraint on account_id and symbol
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_position ON trading_positions(account_id, symbol) WHERE quantity > 0;
CREATE INDEX IF NOT EXISTS idx_trading_positions_account_id ON trading_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_trading_positions_symbol ON trading_positions(symbol);

-- Trading Executions Table
CREATE TABLE IF NOT EXISTS trading_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES trading_orders(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    price DECIMAL(15, 6) NOT NULL,
    quantity DECIMAL(15, 6) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indices for executions
CREATE INDEX IF NOT EXISTS idx_trading_executions_account_id ON trading_executions(account_id);
CREATE INDEX IF NOT EXISTS idx_trading_executions_order_id ON trading_executions(order_id);
CREATE INDEX IF NOT EXISTS idx_trading_executions_symbol ON trading_executions(symbol);

-- Trading History Table for completed trades
CREATE TABLE IF NOT EXISTS trading_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(15, 6) NOT NULL,
    entry_price DECIMAL(15, 6) NOT NULL,
    exit_price DECIMAL(15, 6) NOT NULL,
    realized_pl DECIMAL(15, 6) NOT NULL,
    entry_at TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indices for history
CREATE INDEX IF NOT EXISTS idx_trading_history_account_id ON trading_history(account_id);
CREATE INDEX IF NOT EXISTS idx_trading_history_symbol ON trading_history(symbol);

-- Function to update trading_positions when an order is filled
CREATE OR REPLACE FUNCTION update_position_on_order_fill()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process filled orders that weren't previously filled
    IF NEW.status = 'filled' AND (OLD.status != 'filled' OR OLD IS NULL) THEN
        -- For buy orders
        IF NEW.side = 'buy' THEN
            -- Insert or update the position
            INSERT INTO trading_positions (account_id, symbol, side, quantity, avg_price)
            VALUES (NEW.account_id, NEW.symbol, NEW.side, NEW.filled_quantity, NEW.filled_price)
            ON CONFLICT (account_id, symbol) WHERE quantity > 0
            DO UPDATE SET
                quantity = CASE
                    -- If same side, add to position
                    WHEN trading_positions.side = 'buy' THEN trading_positions.quantity + NEW.filled_quantity
                    -- If opposite side and new buy is larger, flip to buy side
                    WHEN trading_positions.quantity < NEW.filled_quantity THEN NEW.filled_quantity - trading_positions.quantity
                    -- If opposite side and new buy is smaller, reduce sell position
                    ELSE trading_positions.quantity - NEW.filled_quantity
                END,
                side = CASE
                    -- Keep buy side if same side or if buy quantity is larger than sell position
                    WHEN trading_positions.side = 'buy' OR trading_positions.quantity < NEW.filled_quantity THEN 'buy'
                    -- Keep sell side if sell position is larger than buy quantity
                    ELSE 'sell'
                END,
                avg_price = CASE
                    -- If same side, calculate weighted average price
                    WHEN trading_positions.side = 'buy' THEN 
                        (trading_positions.avg_price * trading_positions.quantity + NEW.filled_price * NEW.filled_quantity) / 
                        (trading_positions.quantity + NEW.filled_quantity)
                    -- If flipping to buy, use the buy price
                    WHEN trading_positions.quantity < NEW.filled_quantity THEN NEW.filled_price
                    -- If reducing sell position, keep the original average price
                    ELSE trading_positions.avg_price
                END,
                updated_at = NOW();
        
        -- For sell orders
        ELSIF NEW.side = 'sell' THEN
            -- Insert or update the position
            INSERT INTO trading_positions (account_id, symbol, side, quantity, avg_price)
            VALUES (NEW.account_id, NEW.symbol, NEW.side, NEW.filled_quantity, NEW.filled_price)
            ON CONFLICT (account_id, symbol) WHERE quantity > 0
            DO UPDATE SET
                quantity = CASE
                    -- If same side, add to position
                    WHEN trading_positions.side = 'sell' THEN trading_positions.quantity + NEW.filled_quantity
                    -- If opposite side and new sell is larger, flip to sell side
                    WHEN trading_positions.quantity < NEW.filled_quantity THEN NEW.filled_quantity - trading_positions.quantity
                    -- If opposite side and new sell is smaller, reduce buy position
                    ELSE trading_positions.quantity - NEW.filled_quantity
                END,
                side = CASE
                    -- Keep sell side if same side or if sell quantity is larger than buy position
                    WHEN trading_positions.side = 'sell' OR trading_positions.quantity < NEW.filled_quantity THEN 'sell'
                    -- Keep buy side if buy position is larger than sell quantity
                    ELSE 'buy'
                END,
                avg_price = CASE
                    -- If same side, calculate weighted average price
                    WHEN trading_positions.side = 'sell' THEN 
                        (trading_positions.avg_price * trading_positions.quantity + NEW.filled_price * NEW.filled_quantity) / 
                        (trading_positions.quantity + NEW.filled_quantity)
                    -- If flipping to sell, use the sell price
                    WHEN trading_positions.quantity < NEW.filled_quantity THEN NEW.filled_price
                    -- If reducing buy position, keep the original average price
                    ELSE trading_positions.avg_price
                END,
                updated_at = NOW();
        END IF;
        
        -- If this is a close order and the position is fully closed, add to trading history
        IF NEW.is_close = TRUE THEN
            -- Get the position that was closed or partially closed
            INSERT INTO trading_history (
                account_id, symbol, side, quantity, entry_price, exit_price, realized_pl, entry_at, exit_at
            )
            SELECT 
                p.account_id,
                p.symbol,
                p.side,
                LEAST(p.quantity, NEW.filled_quantity) as closed_quantity,
                p.avg_price as entry_price,
                NEW.filled_price as exit_price,
                CASE 
                    WHEN p.side = 'buy' THEN 
                        (NEW.filled_price - p.avg_price) * LEAST(p.quantity, NEW.filled_quantity)
                    ELSE
                        (p.avg_price - NEW.filled_price) * LEAST(p.quantity, NEW.filled_quantity)
                END as realized_pl,
                p.created_at as entry_at,
                NEW.filled_at as exit_at
            FROM trading_positions p
            WHERE p.account_id = NEW.account_id AND p.symbol = NEW.symbol;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order fills
DROP TRIGGER IF EXISTS trg_order_fill ON trading_orders;
CREATE TRIGGER trg_order_fill
AFTER UPDATE ON trading_orders
FOR EACH ROW
WHEN (NEW.status = 'filled' AND OLD.status != 'filled')
EXECUTE FUNCTION update_position_on_order_fill();

-- Function to update account balance when a position is closed
CREATE OR REPLACE FUNCTION update_balance_on_position_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If position quantity decreased (position was closed or partially closed)
    IF NEW.quantity < OLD.quantity THEN
        -- Calculate the realized P&L
        DECLARE
            closed_quantity DECIMAL := OLD.quantity - NEW.quantity;
            realized_pl DECIMAL;
            current_balance DECIMAL;
        BEGIN
            -- Calculate realized P&L based on the position side
            IF OLD.side = 'buy' THEN
                -- For long positions, profit = (exit price - entry price) * quantity
                SELECT filled_price INTO STRICT realized_pl FROM trading_orders
                WHERE account_id = NEW.account_id AND symbol = NEW.symbol
                ORDER BY filled_at DESC LIMIT 1;
                
                realized_pl := (realized_pl - OLD.avg_price) * closed_quantity;
            ELSE
                -- For short positions, profit = (entry price - exit price) * quantity
                SELECT filled_price INTO STRICT realized_pl FROM trading_orders
                WHERE account_id = NEW.account_id AND symbol = NEW.symbol
                ORDER BY filled_at DESC LIMIT 1;
                
                realized_pl := (OLD.avg_price - realized_pl) * closed_quantity;
            END IF;
            
            -- Update account balance
            UPDATE trading_accounts
            SET balance = balance + realized_pl,
                updated_at = NOW()
            WHERE id = NEW.account_id;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for position changes
DROP TRIGGER IF EXISTS trg_position_change ON trading_positions;
CREATE TRIGGER trg_position_change
AFTER UPDATE ON trading_positions
FOR EACH ROW
WHEN (NEW.quantity < OLD.quantity)
EXECUTE FUNCTION update_balance_on_position_change(); 