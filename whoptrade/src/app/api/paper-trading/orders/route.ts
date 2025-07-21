import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';
import { whopSync } from '@/lib/whop-sync';

export const dynamic = 'force-dynamic';

// Force reload to clear any cached session references

/**
 * GET - Fetch user's orders
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user (supports both Supabase and Whop tokens)
    const authHeader = request.headers.get('authorization');
    const { user, error: authError } = await authenticateUser(authHeader);

    if (authError || !user) {
      console.log('Authentication failed:', authError);
      return NextResponse.json({ error: authError || 'Authentication failed' }, { status: 401 });
    }

    console.log('User authenticated for orders:', user.id);

    // Create database client for queries
    const supabase = createDatabaseClient();

    // Check if user is allowed to trade (prevent admin accounts from trading)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('can_trade, role')
      .eq('user_id', user.id)
      .single();

    if (userProfile && userProfile.can_trade === false) {
      return NextResponse.json({ 
        error: 'Trading not allowed for admin accounts due to conflict of interest' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, filled, cancelled
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = parseInt(searchParams.get('offset') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    
    // Calculate offset from page if provided
    const calculatedOffset = page > 1 ? (page - 1) * limit : offset;

    // Get total count for pagination
    let countQuery = supabase
      .from('trade_orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (symbol) {
      countQuery = countQuery.eq('symbol', symbol.toUpperCase());
    }

    const { count: totalCount } = await countQuery;

    // Create query for user's orders only
    let query = supabase
      .from('trade_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(calculatedOffset, calculatedOffset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: orders, error: queryError } = await query;

    if (queryError) {
      console.error('Error fetching orders:', queryError);
      console.error('Query details:', { user_id: user.id, status, symbol, limit });
      
      // Check if it's a table not found error
      if (queryError.message?.includes('relation') && queryError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database tables not found. Please run the schema setup first.',
          details: queryError.message 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch orders', 
        details: queryError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      orders,
      pagination: {
        total: totalCount || 0,
        page: page,
        limit: limit,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in orders GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Place a new order
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user (supports both Supabase and Whop tokens)
    const authHeader = request.headers.get('authorization');
    const { user, error: authError } = await authenticateUser(authHeader);

    if (authError || !user) {
      console.log('Authentication failed:', authError);
      return NextResponse.json({ error: authError || 'Authentication failed' }, { status: 401 });
    }

    console.log('User authenticated for order placement:', user.id);

    // Create database client for queries
    const supabase = createDatabaseClient();

    // Check if user is allowed to trade (prevent admin accounts from trading)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('can_trade, role')
      .eq('user_id', user.id)
      .single();

    if (userProfile && userProfile.can_trade === false) {
      return NextResponse.json({ 
        error: 'Trading not allowed for admin accounts due to conflict of interest' 
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      symbol,
      side, // 'buy' or 'sell'
      order_type, // Only 'market' allowed
      quantity,
      asset_type = 'stock'
    } = body;

    // Validate that only market orders are allowed
    if (order_type !== 'market') {
      return NextResponse.json({ 
        error: 'Only market orders are supported' 
      }, { status: 400 });
    }

    // Security: Calculate price server-side only for market orders
    let serverPrice: number;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-data/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        serverPrice = data.price;
      } else {
        serverPrice = await getMockPrice(symbol);
      }
    } catch (error) {
      console.log('Failed to fetch market price, using mock price');
      serverPrice = await getMockPrice(symbol);
    }

    // Validate required fields
    if (!symbol || !side || !order_type || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: symbol, side, order_type, quantity' 
      }, { status: 400 });
    }

    // Validate market price was obtained
    if (!serverPrice || serverPrice <= 0) {
      return NextResponse.json({ 
        error: 'Unable to get current market price' 
      }, { status: 500 });
    }

    // Get user balance to validate order
    const { data: userBalance, error: balanceError } = await supabase
      .from('user_balances')
      .select('available_balance')
      .eq('user_id', user.id)
      .single();

    if (balanceError || !userBalance) {
      return NextResponse.json({ 
        error: 'Unable to fetch user balance' 
      }, { status: 500 });
    }

    // For buy orders, check if user has sufficient balance
    if (side === 'buy') {
      const estimatedCost = quantity * serverPrice;

      if (estimatedCost > userBalance.available_balance) {
        return NextResponse.json({ 
          error: 'Insufficient balance for this order' 
        }, { status: 400 });
      }
    }

    // For sell orders, check if user has the position
    if (side === 'sell') {
      const { data: position, error: positionError } = await supabase
        .from('user_portfolios')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
        .eq('asset_type', asset_type)
        .single();

      console.log('Sell validation - Position data:', position);
      console.log('Sell validation - Position error:', positionError);
      console.log('Sell validation - Required quantity:', quantity);

      if (!position || position.quantity < quantity) {
        return NextResponse.json({ 
          error: `Insufficient position to sell. You have ${position?.quantity || 0} shares, but trying to sell ${quantity} shares.`
        }, { status: 400 });
      }
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('trade_orders')
      .insert({
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        asset_type,
        side,
        order_type,
        quantity: parseFloat(quantity),
        price: serverPrice,
        filled_quantity: 0, // Initialize as 0 for pending orders
        filled_price: null, // Will be set when order is filled
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
    }

    // All orders are now market orders, so execute immediately
    await executeMarketOrder(supabase, order.id, serverPrice);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Error in orders POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Execute a market order immediately
 */
async function executeMarketOrder(supabase: any, orderId: string, marketPrice?: number) {
  try {
    // Get the order details
    const { data: order } = await supabase
      .from('trade_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) return;

    // Use provided market price or fetch current market price
    let executionPrice = marketPrice;
    
    if (!executionPrice || executionPrice <= 0) {
      // Fallback to fetching real market data
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-data/quote?symbol=${order.symbol}`);
        if (response.ok) {
          const data = await response.json();
          executionPrice = data.price;
        }
      } catch (error) {
        console.log('Failed to fetch real market price, using mock price');
      }
      
      // Final fallback to mock price
      if (!executionPrice || executionPrice <= 0) {
        executionPrice = await getMockPrice(order.symbol);
      }
    }

    // Update order as filled
    await supabase
      .from('trade_orders')
      .update({
        status: 'filled',
        filled_quantity: order.quantity,
        filled_price: executionPrice
        // filled_at: new Date().toISOString() // Check if this column exists
      })
      .eq('id', orderId);

    // Update user balance and portfolio
    const totalCost = order.quantity * executionPrice;
    
    if (order.side === 'buy') {
      // For buy orders: deduct cash, add to portfolio
      // First get current balance
      const { data: currentBalance } = await supabase
        .from('user_balances')
        .select('available_balance')
        .eq('user_id', order.user_id)
        .single();
      
      if (currentBalance) {
        const newBalance = currentBalance.available_balance - totalCost;
        await supabase
          .from('user_balances')
          .update({
            available_balance: newBalance
          })
          .eq('user_id', order.user_id);
      }
      
      // Add or update portfolio position
      const { data: existingPosition } = await supabase
        .from('user_portfolios')
        .select('*')
        .eq('user_id', order.user_id)
        .eq('symbol', order.symbol)
        .eq('asset_type', order.asset_type)
        .single();
      
      if (existingPosition) {
        // Update existing position
        const newQuantity = existingPosition.quantity + order.quantity;
        const newAverageCost = ((existingPosition.quantity * existingPosition.average_cost) + totalCost) / newQuantity;
        
        await supabase
          .from('user_portfolios')
          .update({
            quantity: newQuantity,
            average_cost: newAverageCost
          })
          .eq('id', existingPosition.id);
      } else {
        // Create new position
        console.log('Creating new position:', {
          user_id: order.user_id,
          symbol: order.symbol,
          asset_type: order.asset_type,
          quantity: order.quantity,
          average_cost: executionPrice
        });
        
        const { error: insertError } = await supabase
          .from('user_portfolios')
          .insert({
            user_id: order.user_id,
            symbol: order.symbol,
            asset_type: order.asset_type,
            quantity: order.quantity,
            average_cost: executionPrice
          });
          
        if (insertError) {
          console.error('Error creating position:', insertError);
        } else {
          console.log('Position created successfully');
        }
      }
    } else if (order.side === 'sell') {
      // For sell orders: add cash, reduce portfolio position
      // First get current balance
      const { data: currentBalance } = await supabase
        .from('user_balances')
        .select('available_balance')
        .eq('user_id', order.user_id)
        .single();
      
      if (currentBalance) {
        const newBalance = currentBalance.available_balance + totalCost;
        await supabase
          .from('user_balances')
          .update({
            available_balance: newBalance
          })
          .eq('user_id', order.user_id);
      }
      
      // Update portfolio position
      const { data: existingPosition } = await supabase
        .from('user_portfolios')
        .select('*')
        .eq('user_id', order.user_id)
        .eq('symbol', order.symbol)
        .eq('asset_type', order.asset_type)
        .single();
      
      if (existingPosition) {
        const newQuantity = existingPosition.quantity - order.quantity;
        
        // Calculate realized P&L for the sale
        const avgCost = existingPosition.average_cost;
        const realizedPnL = (executionPrice - avgCost) * order.quantity;
        
        // Update the order with realized P&L
        await supabase
          .from('trade_orders')
          .update({
            realized_pnl: realizedPnL
          })
          .eq('id', orderId);

        // Update user's total P&L in balances
        await updateUserPnL(supabase, order.user_id, realizedPnL);
        
        if (newQuantity <= 0) {
          // Remove position if fully sold
          await supabase
            .from('user_portfolios')
            .delete()
            .eq('id', existingPosition.id);
        } else {
          // Update remaining quantity
          await supabase
            .from('user_portfolios')
            .update({
              quantity: newQuantity
            })
            .eq('id', existingPosition.id);
        }
      }
    }

  } catch (error) {
    console.error('Error executing market order:', error);
  }
}

/**
 * Update user's P&L in the user_balances table
 */
async function updateUserPnL(supabase: any, userId: string, realizedPnL: number) {
  try {
    // Get current balance record
    const { data: currentBalance } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (currentBalance) {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentWeek = getWeekStart(now);
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Update total P&L
      const newTotalPnL = (currentBalance.total_pnl || 0) + realizedPnL;
      
      // Update daily P&L (reset if new day)
      const lastUpdateDate = currentBalance.updated_at ? new Date(currentBalance.updated_at).toISOString().split('T')[0] : null;
      const newDailyPnL = lastUpdateDate === today 
        ? (currentBalance.daily_pnl || 0) + realizedPnL 
        : realizedPnL;

      // Update weekly P&L (reset if new week)
      const lastUpdateWeek = currentBalance.updated_at ? getWeekStart(new Date(currentBalance.updated_at)) : null;
      const newWeeklyPnL = lastUpdateWeek && lastUpdateWeek.getTime() === currentWeek.getTime()
        ? (currentBalance.weekly_pnl || 0) + realizedPnL
        : realizedPnL;

      // Update monthly P&L (reset if new month)
      const lastUpdateMonth = currentBalance.updated_at ? new Date(currentBalance.updated_at) : null;
      const newMonthlyPnL = lastUpdateMonth && 
        lastUpdateMonth.getFullYear() === now.getFullYear() && 
        lastUpdateMonth.getMonth() === now.getMonth()
        ? (currentBalance.monthly_pnl || 0) + realizedPnL
        : realizedPnL;

      await supabase
        .from('user_balances')
        .update({
          total_pnl: newTotalPnL,
          daily_pnl: newDailyPnL,
          weekly_pnl: newWeeklyPnL,
          monthly_pnl: newMonthlyPnL,
          updated_at: now.toISOString()
        })
        .eq('user_id', userId);

      // Also update unrealized P&L based on current positions
      await updateUnrealizedPnL(supabase, userId);
      
      // Sync with Whop leaderboard after P&L update
      await whopSync.syncUserStatsAfterTrade(userId);
    }
  } catch (error) {
    console.error('Error updating user P&L:', error);
  }
}

/**
 * Update unrealized P&L for a user based on current positions
 */
async function updateUnrealizedPnL(supabase: any, userId: string) {
  try {
    // Get user's positions
    const { data: positions } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', userId);

    if (!positions || positions.length === 0) {
      return;
    }

    let totalUnrealizedPnL = 0;

    // Calculate unrealized P&L for each position
    for (const position of positions) {
      const currentPrice = await getMockPrice(position.symbol);
      const unrealizedPnL = (currentPrice - position.average_cost) * position.quantity;
      totalUnrealizedPnL += unrealizedPnL;
    }

    // Update the user's balance with unrealized P&L
    const { data: currentBalance } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (currentBalance) {
      await supabase
        .from('user_balances')
        .update({
          balance: currentBalance.available_balance + totalUnrealizedPnL
        })
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Error updating unrealized P&L:', error);
  }
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get mock price for a symbol (in production, this would fetch real market data)
 */
async function getMockPrice(symbol: string): Promise<number> {
  const mockPrices: Record<string, number> = {
    'AAPL': 201.00, // Updated to match current trading price
    'MSFT': 335.15,
    'AMZN': 130.25,
    'GOOGL': 140.80,
    'META': 290.35,
    'TSLA': 245.75,
    'NVDA': 425.65,
    'AMD': 155.20,
    'INTC': 45.80,
    'NFLX': 410.30,
  };

  const basePrice = mockPrices[symbol] || 100;
  
  // Check if markets are open (9:30 AM - 4:00 PM ET, Monday-Friday)
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  const day = easternTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  const isWeekday = day >= 1 && day <= 5;
  const isMarketHours = isWeekday && 
    ((hour > 9) || (hour === 9 && minute >= 30)) && 
    (hour < 16);
  
  if (isMarketHours) {
    // During market hours, add small random variation (±0.5%)
    const variation = (Math.random() - 0.5) * 0.01;
    return parseFloat((basePrice * (1 + variation)).toFixed(2));
  } else {
    // After hours, use consistent price (last close price)
    return basePrice;
  }
}