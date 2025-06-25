import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST - Recalculate P&L for all users (Creator only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all users
    const { data: users } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('role', 'user');

    if (!users) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 });
    }

    let updatedUsers = 0;
    const results = [];

    for (const user of users) {
      try {
        const result = await recalculateUserPnL(supabase, user.user_id);
        results.push({ user_id: user.user_id, ...result });
        updatedUsers++;
      } catch (error) {
        console.error(`Error recalculating P&L for user ${user.user_id}:`, error);
        results.push({ 
          user_id: user.user_id, 
          error: 'Failed to recalculate' 
        });
      }
    }

    return NextResponse.json({
      message: `P&L recalculated for ${updatedUsers} users`,
      results,
      total_users: users.length,
      updated_users: updatedUsers
    });

  } catch (error) {
    console.error('Error in P&L recalculation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Recalculate P&L for a specific user
 */
async function recalculateUserPnL(supabase: any, userId: string) {
  // Get all filled orders for the user
  const { data: orders } = await supabase
    .from('trade_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'filled')
    .order('created_at', { ascending: true });

  if (!orders || orders.length === 0) {
    return { total_pnl: 0, positions: 0, orders: 0 };
  }

  // Track positions for P&L calculation
  const positions: { [symbol: string]: { quantity: number; totalCost: number; avgCost: number } } = {};
  let totalRealizedPnL = 0;
  let totalUnrealizedPnL = 0;

  // Process each order chronologically
  for (const order of orders) {
    const { symbol, side, quantity, filled_price } = order;
    const totalValue = quantity * filled_price;

    if (side === 'buy') {
      // Add to position
      if (positions[symbol]) {
        const existingValue = positions[symbol].quantity * positions[symbol].avgCost;
        const newTotalQuantity = positions[symbol].quantity + quantity;
        const newTotalValue = existingValue + totalValue;
        positions[symbol] = {
          quantity: newTotalQuantity,
          totalCost: newTotalValue,
          avgCost: newTotalValue / newTotalQuantity
        };
      } else {
        positions[symbol] = {
          quantity: quantity,
          totalCost: totalValue,
          avgCost: filled_price
        };
      }
    } else if (side === 'sell') {
      // Sell from position
      if (positions[symbol] && positions[symbol].quantity >= quantity) {
        const avgCost = positions[symbol].avgCost;
        const realizedPnL = (filled_price - avgCost) * quantity;
        totalRealizedPnL += realizedPnL;

        // Update order with realized P&L
        await supabase
          .from('trade_orders')
          .update({ realized_pnl: realizedPnL })
          .eq('id', order.id);

        // Reduce position
        positions[symbol].quantity -= quantity;
        if (positions[symbol].quantity <= 0) {
          delete positions[symbol];
        }
      }
    }
  }

  // Calculate unrealized P&L for remaining positions
  for (const symbol in positions) {
    const position = positions[symbol];
    const currentPrice = await getMockPrice(symbol);
    const unrealizedPnL = (currentPrice - position.avgCost) * position.quantity;
    totalUnrealizedPnL += unrealizedPnL;
  }

  // Get current time for period calculations
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentWeek = getWeekStart(now);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calculate period-specific P&L
  const dayStart = new Date(today + 'T00:00:00Z');
  const weekStart = currentWeek;
  const monthStart = currentMonth;

  const dailyOrders = orders.filter(o => new Date(o.created_at) >= dayStart);
  const weeklyOrders = orders.filter(o => new Date(o.created_at) >= weekStart);
  const monthlyOrders = orders.filter(o => new Date(o.created_at) >= monthStart);

  const dailyPnL = dailyOrders.reduce((sum, o) => sum + (o.realized_pnl || 0), 0);
  const weeklyPnL = weeklyOrders.reduce((sum, o) => sum + (o.realized_pnl || 0), 0);
  const monthlyPnL = monthlyOrders.reduce((sum, o) => sum + (o.realized_pnl || 0), 0);

  // Update user balances
  const { data: currentBalance } = await supabase
    .from('user_balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (currentBalance) {
    // Calculate new balances properly
    const startingBalance = 100000;
    
    // Calculate total cost of current positions
    let totalPositionCost = 0;
    for (const symbol in positions) {
      const position = positions[symbol];
      totalPositionCost += position.quantity * position.avgCost;
    }
    
    // Available balance = starting balance + realized P&L - current position costs
    const newAvailableBalance = startingBalance + totalRealizedPnL - totalPositionCost;
    
    await supabase
      .from('user_balances')
      .update({
        total_pnl: totalRealizedPnL,
        daily_pnl: dailyPnL,
        weekly_pnl: weeklyPnL,
        monthly_pnl: monthlyPnL,
        balance: newAvailableBalance + totalUnrealizedPnL,
        available_balance: newAvailableBalance,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId);
  }

  // Update portfolio positions
  await supabase
    .from('user_portfolios')
    .delete()
    .eq('user_id', userId);

  for (const symbol in positions) {
    const position = positions[symbol];
    if (position.quantity > 0) {
      await supabase
        .from('user_portfolios')
        .insert({
          user_id: userId,
          symbol: symbol,
          asset_type: 'stock',
          quantity: position.quantity,
          average_cost: position.avgCost
        });
    }
  }

  return {
    total_pnl: totalRealizedPnL,
    unrealized_pnl: totalUnrealizedPnL,
    daily_pnl: dailyPnL,
    weekly_pnl: weeklyPnL,
    monthly_pnl: monthlyPnL,
    positions: Object.keys(positions).length,
    orders: orders.length
  };
}

/**
 * Get mock price for a symbol
 */
async function getMockPrice(symbol: string): Promise<number> {
  const mockPrices: Record<string, number> = {
    'AAPL': 201.00,
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

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}