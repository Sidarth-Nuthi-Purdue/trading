import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch user's portfolio performance history
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

    console.log('User authenticated for performance data:', user.id);

    // Create database client for queries
    const supabase = createDatabaseClient();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // 1d, 7d, 30d, 90d, 1y, all
    const granularity = searchParams.get('granularity') || 'daily'; // hourly, daily, weekly

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01'); // Far back date
        break;
    }

    // Get all filled orders for the user within the time period
    const { data: orders, error: ordersError } = await supabase
      .from('trade_orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'filled')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Get current portfolio
    const { data: positions, error: portfolioError } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', user.id)
      .gt('quantity', 0);

    if (portfolioError) {
      console.error('Error fetching portfolio:', portfolioError);
      return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
    }

    // Get current balance
    const { data: balance, error: balanceError } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Calculate performance history
    const performanceHistory = await calculatePerformanceHistory(
      orders || [],
      positions || [],
      balance,
      startDate,
      now,
      granularity
    );

    return NextResponse.json({
      period,
      granularity,
      history: performanceHistory,
      summary: {
        startValue: performanceHistory[0]?.totalValue || 100000,
        endValue: performanceHistory[performanceHistory.length - 1]?.totalValue || 100000,
        totalReturn: performanceHistory[performanceHistory.length - 1]?.totalReturn || 0,
        totalReturnPercent: performanceHistory[performanceHistory.length - 1]?.totalReturnPercent || 0,
        realizedPnL: performanceHistory[performanceHistory.length - 1]?.realizedPnL || 0,
        unrealizedPnL: performanceHistory[performanceHistory.length - 1]?.unrealizedPnL || 0,
        maxDrawdown: calculateMaxDrawdown(performanceHistory),
        sharpeRatio: calculateSharpeRatio(performanceHistory),
        winRate: calculateWinRate(orders || [])
      }
    });

  } catch (error) {
    console.error('Error in performance GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Calculate performance history with proper options P&L tracking
 */
async function calculatePerformanceHistory(
  orders: any[],
  currentPositions: any[],
  balance: any,
  startDate: Date,
  endDate: Date,
  granularity: string
): Promise<any[]> {
  const history: any[] = [];
  const startingBalance = 100000; // Default starting balance
  
  // Group time periods based on granularity
  const timeStep = granularity === 'hourly' ? 60 * 60 * 1000 : 
                   granularity === 'daily' ? 24 * 60 * 60 * 1000 :
                   7 * 24 * 60 * 60 * 1000; // weekly

  const currentTime = new Date(startDate);
  let runningBalance = startingBalance;
  let totalRealizedPnL = 0;
  let positions: Map<string, any> = new Map();

  while (currentTime <= endDate) {
    const periodEnd = new Date(currentTime.getTime() + timeStep);
    
    // Get orders filled in this period
    const periodOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= currentTime && orderDate < periodEnd;
    });

    // Process orders chronologically
    for (const order of periodOrders) {
      const totalCost = order.filled_quantity * order.filled_price;
      
      if (order.side === 'buy') {
        // Add position
        const positionKey = `${order.symbol}_${order.asset_type}`;
        const existing = positions.get(positionKey);
        
        if (existing) {
          const newQuantity = existing.quantity + order.filled_quantity;
          const newAvgCost = ((existing.quantity * existing.avgCost) + totalCost) / newQuantity;
          positions.set(positionKey, {
            ...existing,
            quantity: newQuantity,
            avgCost: newAvgCost
          });
        } else {
          positions.set(positionKey, {
            symbol: order.symbol,
            assetType: order.asset_type,
            quantity: order.filled_quantity,
            avgCost: order.filled_price
          });
        }
        
        runningBalance -= totalCost;
      } else {
        // Sell position
        const positionKey = `${order.symbol}_${order.asset_type}`;
        const existing = positions.get(positionKey);
        
        if (existing) {
          const realizedPnL = order.realized_pnl || 0;
          totalRealizedPnL += realizedPnL;
          
          const newQuantity = existing.quantity - order.filled_quantity;
          if (newQuantity <= 0) {
            positions.delete(positionKey);
          } else {
            positions.set(positionKey, {
              ...existing,
              quantity: newQuantity
            });
          }
        }
        
        runningBalance += totalCost;
      }
    }

    // Calculate current portfolio value with real market prices
    let portfolioValue = 0;
    let unrealizedPnL = 0;
    
    for (const [key, position] of positions) {
      const currentPrice = await getRealMarketPrice(position.symbol, position.assetType);
      const positionValue = position.quantity * currentPrice;
      const positionUnrealizedPnL = positionValue - (position.quantity * position.avgCost);
      
      portfolioValue += positionValue;
      unrealizedPnL += positionUnrealizedPnL;
    }

    const totalValue = runningBalance + portfolioValue;
    const totalReturn = totalValue - startingBalance;
    const totalReturnPercent = ((totalValue - startingBalance) / startingBalance) * 100;

    history.push({
      timestamp: new Date(currentTime),
      cashBalance: runningBalance,
      portfolioValue,
      totalValue,
      realizedPnL: totalRealizedPnL,
      unrealizedPnL,
      totalReturn,
      totalReturnPercent,
      positions: Array.from(positions.values()),
      ordersCount: periodOrders.length
    });

    currentTime.setTime(currentTime.getTime() + timeStep);
  }

  return history;
}

/**
 * Get real market price for both stocks and options
 */
async function getRealMarketPrice(symbol: string, assetType: string = 'stock'): Promise<number> {
  try {
    if (assetType === 'option') {
      // For options, use the options quote endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-data/options/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        return data.lastPrice || data.bid || data.ask || 0;
      }
    } else {
      // For stocks, use the regular quote endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/market-data/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        return data.price || 0;
      }
    }
  } catch (error) {
    console.log('Failed to fetch real market price for', symbol, assetType);
  }

  // Fallback prices
  const mockPrices: Record<string, number> = {
    'AAPL': 201.00,
    'MSFT': 335.15,
    'AMZN': 130.25,
    'GOOGL': 140.80,
    'META': 290.35,
    'TSLA': 245.75,
    'NVDA': 425.65
  };

  return mockPrices[symbol] || 100;
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(history: any[]): number {
  let maxValue = 0;
  let maxDrawdown = 0;

  for (const point of history) {
    if (point.totalValue > maxValue) {
      maxValue = point.totalValue;
    }
    
    const drawdown = (maxValue - point.totalValue) / maxValue;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown * 100; // Return as percentage
}

/**
 * Calculate Sharpe ratio (simplified)
 */
function calculateSharpeRatio(history: any[]): number {
  if (history.length < 2) return 0;

  const returns = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].totalValue;
    const curr = history[i].totalValue;
    returns.push((curr - prev) / prev);
  }

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualized Sharpe ratio (assuming daily returns)
  const riskFreeRate = 0.02 / 252; // 2% annual risk-free rate, daily
  return stdDev === 0 ? 0 : ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252);
}

/**
 * Calculate win rate from orders
 */
function calculateWinRate(orders: any[]): number {
  const trades = orders.filter(order => order.side === 'sell' && order.realized_pnl !== null);
  if (trades.length === 0) return 0;

  const wins = trades.filter(trade => trade.realized_pnl > 0).length;
  return (wins / trades.length) * 100;
}