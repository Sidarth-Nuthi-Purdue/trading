import { NextRequest, NextResponse } from 'next/server';
import { getSession, fetchFromAlpaca } from '@/lib/alpaca-server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // ms between requests to prevent rate limiting

// Throttle requests to prevent rate limiting
const throttleRequest = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
};

// GET handler for retrieving positions
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const cookieStore = await cookies();
    
    // Create a Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user's trading account
    const { data: accountData, error: accountError } = await supabase
      .from('trading_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (accountError || !accountData) {
      return NextResponse.json(
        { error: 'Trading account not found' },
        { status: 404 }
      );
    }
    
    // Fetch active positions
    const { data: positions, error: positionsError } = await supabase
      .from('trading_positions')
      .select('*')
      .eq('account_id', accountData.id)
      .gt('quantity', 0);
    
    if (positionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch positions' },
        { status: 500 }
      );
    }
    
    // Get latest quotes for P&L calculation
    const symbols = positions.map((position: any) => position.symbol);
    
    if (symbols.length === 0) {
      return NextResponse.json({
        success: true,
        positions: []
      });
    }
    
    // Fetch quotes for all symbols
    const enrichedPositions = await Promise.all(positions.map(async (position: any) => {
      try {
        // Fetch quote for the position
        const quoteResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/market-data/latest-quote?symbol=${encodeURIComponent(position.symbol)}`);
        
        if (!quoteResponse.ok) {
          return position;
        }
        
        const quoteData = await quoteResponse.json();
        
        if (!quoteData.quote || !quoteData.quote.price) {
          return position;
        }
        
        // Calculate P&L
        const currentPrice = quoteData.quote.price;
        const avgPrice = parseFloat(position.avg_price);
        const quantity = parseFloat(position.quantity);
        
        let unrealizedPL = 0;
        if (position.side === 'buy') {
          unrealizedPL = (currentPrice - avgPrice) * quantity;
        } else {
          unrealizedPL = (avgPrice - currentPrice) * quantity;
        }
        
        // Calculate P&L percentage
        const plPercentage = avgPrice !== 0 
          ? (unrealizedPL / (avgPrice * quantity)) * 100
          : 0;
        
        // Return position with P&L data
        return {
          ...position,
          current_price: currentPrice,
          unrealized_pl: unrealizedPL,
          pl_percentage: plPercentage
        };
      } catch (error) {
        console.error(`Error enriching position for ${position.symbol}:`, error);
        return position;
      }
    }));
    
    return NextResponse.json({
      success: true,
      positions: enrichedPositions
    });
    
  } catch (error) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error fetching positions' },
      { status: 500 }
    );
  }
}

// DELETE handler for closing positions (liquidating)
export async function DELETE(req: NextRequest) {
  try {
    // Get user session
    const cookieStore = await cookies();
    
    // Create a Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query parameters to determine if we're closing a specific position or all positions
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const percentage = searchParams.get('percentage'); // Optional - percentage to close (0-100)
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }
    
    // Get user's trading account
    const { data: accountData, error: accountError } = await supabase
      .from('trading_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (accountError || !accountData) {
      return NextResponse.json(
        { error: 'Trading account not found' },
        { status: 404 }
      );
    }
    
    // Get the position to close
    const { data: position, error: positionError } = await supabase
      .from('trading_positions')
      .select('*')
      .eq('account_id', accountData.id)
      .eq('symbol', symbol)
      .single();
    
    if (positionError || !position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }
    
    // Get latest quote for the symbol
    const quoteResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/market-data/latest-quote?symbol=${encodeURIComponent(symbol)}`);
    
    if (!quoteResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch latest quote' },
        { status: 500 }
      );
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.quote || !quoteData.quote.price) {
      return NextResponse.json(
        { error: 'No quote available for this symbol' },
        { status: 404 }
      );
    }
    
    // Calculate execution price based on position side (opposite for closing)
    const price = position.side === 'buy' 
      ? quoteData.quote.bid || quoteData.quote.price
      : quoteData.quote.ask || quoteData.quote.price;
    
    // Calculate quantity to close
    let closeQuantity = parseFloat(position.quantity);
    if (percentage && parseInt(percentage) > 0 && parseInt(percentage) < 100) {
      closeQuantity = (parseInt(percentage) / 100) * closeQuantity;
    }
    
    // Create a closing order
    const { data: newOrder, error: orderError } = await supabase
      .from('trading_orders')
      .insert([
        {
          account_id: accountData.id,
          symbol: symbol,
          side: position.side === 'buy' ? 'sell' : 'buy',
          quantity: closeQuantity,
          type: 'market',
          status: 'filled',
          filled_price: price,
          filled_quantity: closeQuantity,
          filled_at: new Date().toISOString(),
          is_close: true
        }
      ])
      .select('*')
      .single();
    
    if (orderError || !newOrder) {
      return NextResponse.json(
        { error: 'Failed to create closing order' },
        { status: 500 }
      );
    }
    
    // Create execution record
    const { error: executionError } = await supabase
      .from('trading_executions')
      .insert([
        {
          account_id: accountData.id,
          order_id: newOrder.id,
          symbol: symbol,
          side: position.side === 'buy' ? 'sell' : 'buy',
          price: price,
          quantity: closeQuantity,
          executed_at: new Date().toISOString()
        }
      ]);
    
    if (executionError) {
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      );
    }
    
    // Update position
    const remainingQuantity = parseFloat(position.quantity) - closeQuantity;
    
    if (remainingQuantity <= 0) {
      // Close position completely
      const { error: updateError } = await supabase
        .from('trading_positions')
        .update({
          quantity: 0,
          closed_at: new Date().toISOString()
        })
        .eq('id', position.id);
      
      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to close position' },
          { status: 500 }
        );
      }
    } else {
      // Reduce position
      const { error: updateError } = await supabase
        .from('trading_positions')
        .update({
          quantity: remainingQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', position.id);
      
      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update position' },
          { status: 500 }
        );
      }
    }
    
    // Calculate P&L
    const avgPrice = parseFloat(position.avg_price);
    let realizedPL = 0;
    if (position.side === 'buy') {
      realizedPL = (price - avgPrice) * closeQuantity;
    } else {
      realizedPL = (avgPrice - price) * closeQuantity;
    }
    
    // Update account balance
    const { data: account, error: getAccountError } = await supabase
      .from('trading_accounts')
      .select('balance')
      .eq('id', accountData.id)
      .single();
    
    if (getAccountError || !account) {
      return NextResponse.json(
        { error: 'Failed to get account balance' },
        { status: 500 }
      );
    }
    
    const newBalance = parseFloat(account.balance) + realizedPL;
    
    const { error: updateBalanceError } = await supabase
      .from('trading_accounts')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountData.id);
    
    if (updateBalanceError) {
      return NextResponse.json(
        { error: 'Failed to update account balance' },
        { status: 500 }
      );
    }
    
    // Add to trading history
    const { error: historyError } = await supabase
      .from('trading_history')
      .insert([
        {
          account_id: accountData.id,
          symbol: symbol,
          side: position.side,
          quantity: closeQuantity,
          entry_price: avgPrice,
          exit_price: price,
          realized_pl: realizedPL,
          entry_at: position.created_at,
          exit_at: new Date().toISOString()
        }
      ]);
    
    if (historyError) {
      console.error('Failed to add to trading history:', historyError);
      // Non-critical error, continue
    }
    
    return NextResponse.json({
      success: true,
      message: `Position for ${symbol} closed successfully`,
      order: newOrder,
      realizedPL: realizedPL
    });
    
  } catch (error) {
    console.error('Error closing position:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error closing position' },
      { status: 500 }
    );
  }
} 