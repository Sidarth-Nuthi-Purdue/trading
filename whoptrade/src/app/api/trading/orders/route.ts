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

// Define types for Alpaca API order
interface AlpacaOrderRequest {
  symbol: string;
  qty: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limit_price?: string;
  stop_price?: string;
  extended_hours?: boolean;
  client_order_id?: string;
}

// Check if the market is currently open
function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // Convert to Eastern Time (ET) - this is a simplified version
  // In production, you should use a proper timezone library
  const etHours = (hours + 24 - 4) % 24; // Rough ET conversion (UTC-4)
  
  // Weekend check (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Regular trading hours: 9:30 AM - 4:00 PM ET
  if (etHours < 9 || etHours >= 16) {
    return false;
  }
  
  // Check for 9:30 AM
  if (etHours === 9 && minutes < 30) {
    return false;
  }
  
  return true;
}

// GET handler for retrieving orders
export async function GET(req: NextRequest) {
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
    
    // Get orders status from query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    
    // Build query
    let query = supabase
      .from('trading_orders')
      .select('*')
      .eq('account_id', accountData.id);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Execute query
    const { data: orders, error: ordersError } = await query;
    
    if (ordersError) {
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error fetching orders' },
      { status: 500 }
    );
  }
}

// POST handler for creating new orders
export async function POST(req: NextRequest) {
  try {
    // Get order data from request body
    const orderData = await req.json();
    
    // Validate required fields
    if (!orderData.symbol || !orderData.side || !orderData.quantity || !orderData.type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if market is open (unless explicitly bypassed for paper trading)
    if (!orderData.bypassMarketHours && !isMarketOpen()) {
      return NextResponse.json(
        { error: 'Market is currently closed. Trading is only available during market hours (9:30 AM - 4:00 PM ET, Monday-Friday).' },
        { status: 400 }
      );
    }
    
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
      // For development/testing, create a test user if no user is found
      const testUserId = 'test_user_' + Math.random().toString(36).substring(2, 15);
      
      return NextResponse.json(
        { error: 'User not authenticated. Please log in to place orders.' },
        { status: 401 }
      );
    }
    
    // Get or create user's trading account
    let accountData;
    const { data: existingAccount, error: accountError } = await supabase
      .from('trading_accounts')
      .select('id, balance')
      .eq('user_id', user.id)
      .single();
    
    if (accountError || !existingAccount) {
      // Create account if it doesn't exist
      const { data: newAccount, error: createError } = await supabase
        .from('trading_accounts')
        .insert([
          { user_id: user.id, balance: 10000.00 } // Default balance of $10,000
        ])
        .select('id, balance')
        .single();
      
      if (createError || !newAccount) {
        console.error('Failed to create trading account:', createError);
        return NextResponse.json(
          { error: 'Failed to create trading account' },
          { status: 500 }
        );
      }
      
      // Use the new account
      accountData = newAccount;
    } else {
      accountData = existingAccount;
    }
    
    // Get latest quote for the symbol
    let price;
    try {
      const quoteResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/market-data/latest-quote?symbol=${encodeURIComponent(orderData.symbol)}`);
      
      if (!quoteResponse.ok) {
        throw new Error(`Failed to fetch quote: ${quoteResponse.statusText}`);
      }
      
      const quoteData = await quoteResponse.json();
      
      if (!quoteData.quote || !quoteData.quote.price) {
        // Fallback to a simulated price if no quote is available
        console.warn('No quote available, using simulated price');
        // Generate a random price between 50 and 500
        price = Math.random() * 450 + 50;
      } else {
        // Use the quote price based on order side
        price = orderData.side === 'buy' 
          ? (quoteData.quote.ask || quoteData.quote.price)
          : (quoteData.quote.bid || quoteData.quote.price);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      // Fallback to a simulated price if quote fetch fails
      price = Math.random() * 450 + 50;
    }
    
    // For limit orders, use the specified limit price
    if (orderData.type === 'limit' && orderData.limitPrice) {
      price = orderData.limitPrice;
    }
    
    // Calculate order cost
    const orderCost = orderData.side === 'buy' 
      ? parseFloat(orderData.quantity) * price
      : 0; // For sell orders, we don't need to check balance
    
    // Check if user has enough balance for buy orders
    if (orderData.side === 'buy' && orderCost > accountData.balance) {
      return NextResponse.json(
        { error: 'Insufficient funds to place this order' },
        { status: 400 }
      );
    }
    
    // For market orders, execute immediately
    const orderStatus = orderData.type === 'market' ? 'filled' : 'working';
    
    // Create the order
    const { data: newOrder, error: orderError } = await supabase
      .from('trading_orders')
      .insert([
        {
          account_id: accountData.id,
          symbol: orderData.symbol,
          side: orderData.side,
          quantity: orderData.quantity,
          type: orderData.type,
          status: orderStatus,
          limit_price: orderData.type === 'limit' ? orderData.limitPrice : null,
          filled_price: orderStatus === 'filled' ? price : null,
          filled_quantity: orderStatus === 'filled' ? orderData.quantity : null,
          filled_at: orderStatus === 'filled' ? new Date().toISOString() : null
        }
      ])
      .select('*')
      .single();
    
    if (orderError || !newOrder) {
      console.error('Failed to create order:', orderError);
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }
    
    // For filled orders, create execution record and update positions
    if (orderStatus === 'filled') {
      // Create execution record
      const { error: executionError } = await supabase
        .from('trading_executions')
        .insert([
          {
            account_id: accountData.id,
            order_id: newOrder.id,
            symbol: orderData.symbol,
            side: orderData.side,
            price: price,
            quantity: orderData.quantity,
            executed_at: new Date().toISOString()
          }
        ]);
      
      if (executionError) {
        console.error('Failed to create execution record:', executionError);
      }
      
      // Update account balance for buy orders
      if (orderData.side === 'buy') {
        const { error: updateError } = await supabase
          .from('trading_accounts')
          .update({ 
            balance: accountData.balance - orderCost,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountData.id);
        
        if (updateError) {
          console.error('Failed to update account balance:', updateError);
        }
      }
      
      // Check if position exists
      const { data: existingPosition, error: positionError } = await supabase
        .from('trading_positions')
        .select('*')
        .eq('account_id', accountData.id)
        .eq('symbol', orderData.symbol)
        .maybeSingle();
      
      if (positionError) {
        console.error('Error checking position:', positionError);
      }
      
      if (!existingPosition) {
        // Create new position
        const { error: createPositionError } = await supabase
          .from('trading_positions')
          .insert([
            {
              account_id: accountData.id,
              symbol: orderData.symbol,
              side: orderData.side,
              quantity: orderData.quantity,
              avg_price: price
            }
          ]);
        
        if (createPositionError) {
          console.error('Failed to create position:', createPositionError);
        }
      } else {
        // Update existing position
        let newQuantity, newSide, newAvgPrice, realizedPL = 0;
        
        if (existingPosition.side === orderData.side) {
          // Adding to existing position
          newQuantity = parseFloat(existingPosition.quantity) + parseFloat(orderData.quantity);
          newSide = existingPosition.side;
          
          // Calculate new average price for buys
          if (orderData.side === 'buy') {
            newAvgPrice = (parseFloat(existingPosition.avg_price) * parseFloat(existingPosition.quantity) + 
                          price * parseFloat(orderData.quantity)) / newQuantity;
          } else {
            newAvgPrice = existingPosition.avg_price;
          }
        } else {
          // Closing or reducing position
          const existingQty = parseFloat(existingPosition.quantity);
          const orderQty = parseFloat(orderData.quantity);
          
          if (existingQty > orderQty) {
            // Reducing position
            newQuantity = existingQty - orderQty;
            newSide = existingPosition.side;
            newAvgPrice = existingPosition.avg_price;
            
            // Calculate realized P&L
            if (existingPosition.side === 'buy') {
              realizedPL = (price - parseFloat(existingPosition.avg_price)) * orderQty;
            } else {
              realizedPL = (parseFloat(existingPosition.avg_price) - price) * orderQty;
            }
          } else if (existingQty < orderQty) {
            // Flipping position
            newQuantity = orderQty - existingQty;
            newSide = orderData.side;
            newAvgPrice = price;
            
            // Calculate realized P&L
            if (existingPosition.side === 'buy') {
              realizedPL = (price - parseFloat(existingPosition.avg_price)) * existingQty;
            } else {
              realizedPL = (parseFloat(existingPosition.avg_price) - price) * existingQty;
            }
          } else {
            // Closing position exactly
            newQuantity = 0;
            newSide = orderData.side;
            newAvgPrice = 0;
            
            // Calculate realized P&L
            if (existingPosition.side === 'buy') {
              realizedPL = (price - parseFloat(existingPosition.avg_price)) * existingQty;
            } else {
              realizedPL = (parseFloat(existingPosition.avg_price) - price) * existingQty;
            }
          }
          
          // Add to trading history if closing or reducing position
          const { error: historyError } = await supabase
            .from('trading_history')
            .insert([
              {
                account_id: accountData.id,
                symbol: orderData.symbol,
                side: existingPosition.side,
                quantity: Math.min(existingQty, orderQty),
                entry_price: existingPosition.avg_price,
                exit_price: price,
                realized_pl: realizedPL,
                entry_at: existingPosition.created_at,
                exit_at: new Date().toISOString()
              }
            ]);
          
          if (historyError) {
            console.error('Failed to create history record:', historyError);
          }
          
          // Update account balance with realized P&L
          const { error: updateBalanceError } = await supabase
            .from('trading_accounts')
            .update({ 
              balance: accountData.balance + realizedPL,
              updated_at: new Date().toISOString()
            })
            .eq('id', accountData.id);
          
          if (updateBalanceError) {
            console.error('Failed to update account balance with P&L:', updateBalanceError);
          }
        }
        
        // Update or delete position
        if (newQuantity > 0) {
          const { error: updatePositionError } = await supabase
            .from('trading_positions')
            .update({
              quantity: newQuantity,
              side: newSide,
              avg_price: newAvgPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPosition.id);
          
          if (updatePositionError) {
            console.error('Failed to update position:', updatePositionError);
          }
        } else {
          // Delete position if quantity is 0
          const { error: deletePositionError } = await supabase
            .from('trading_positions')
            .delete()
            .eq('id', existingPosition.id);
          
          if (deletePositionError) {
            console.error('Failed to delete position:', deletePositionError);
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      order: newOrder
    });
    
  } catch (error) {
    console.error('Error placing order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error placing order' },
      { status: 500 }
    );
  }
} 