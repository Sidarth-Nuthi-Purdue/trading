import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getOrders, createOrder, cancelOrder } from '@/lib/alpaca-broker-api';

/**
 * GET all orders for the user's trading account
 */
export async function GET(req: NextRequest) {
  try {
    // Generate mock orders
    const mockOrders = [
      {
        id: 'order-1-1689842562120',
        client_order_id: 'client-order-1-1689842562120',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updated_at: new Date(Date.now() - 86400000 + 3600000).toISOString(), // 1 hour after creation
        submitted_at: new Date(Date.now() - 86400000).toISOString(),
        filled_at: new Date(Date.now() - 86400000 + 3600000).toISOString(),
        expired_at: null,
        canceled_at: null,
        failed_at: null,
        replaced_at: null,
        replaced_by: null,
        replaces: null,
        asset_id: 'asset-AAPL',
        symbol: 'AAPL',
        asset_class: 'us_equity',
        notional: null,
        qty: '10',
        filled_qty: '10',
        filled_avg_price: '170.25',
        order_class: 'simple',
        order_type: 'market',
        type: 'market',
        side: 'buy',
        time_in_force: 'day',
        limit_price: null,
        stop_price: null,
        status: 'filled',
        extended_hours: false,
        legs: null,
        trail_percent: null,
        trail_price: null,
        hwm: null
      },
      {
        id: 'order-2-1689842562120',
        client_order_id: 'client-order-2-1689842562120',
        created_at: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
        updated_at: new Date(Date.now() - 432000000 + 7200000).toISOString(), // 2 hours after creation
        submitted_at: new Date(Date.now() - 432000000).toISOString(),
        filled_at: new Date(Date.now() - 432000000 + 7200000).toISOString(),
        expired_at: null,
        canceled_at: null,
        failed_at: null,
        replaced_at: null,
        replaced_by: null,
        replaces: null,
        asset_id: 'asset-MSFT',
        symbol: 'MSFT',
        asset_class: 'us_equity',
        notional: null,
        qty: '5',
        filled_qty: '5',
        filled_avg_price: '330.50',
        order_class: 'simple',
        order_type: 'limit',
        type: 'limit',
        side: 'buy',
        time_in_force: 'day',
        limit_price: '331.00',
        stop_price: null,
        status: 'filled',
        extended_hours: false,
        legs: null,
        trail_percent: null,
        trail_price: null,
        hwm: null
      },
      {
        id: 'order-3-1689842562120',
        client_order_id: 'client-order-3-1689842562120',
        created_at: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        updated_at: new Date(Date.now() - 10800000 + 1800000).toISOString(), // 30 minutes after creation
        submitted_at: new Date(Date.now() - 10800000).toISOString(),
        filled_at: null,
        expired_at: null,
        canceled_at: new Date(Date.now() - 10800000 + 1800000).toISOString(),
        failed_at: null,
        replaced_at: null,
        replaced_by: null,
        replaces: null,
        asset_id: 'asset-NVDA',
        symbol: 'NVDA',
        asset_class: 'us_equity',
        notional: null,
        qty: '3',
        filled_qty: '0',
        filled_avg_price: null,
        order_class: 'simple',
        order_type: 'limit',
        type: 'limit',
        side: 'buy',
        time_in_force: 'day',
        limit_price: '420.00',
        stop_price: null,
        status: 'canceled',
        extended_hours: false,
        legs: null,
        trail_percent: null,
        trail_price: null,
        hwm: null
      }
    ];

    return NextResponse.json(mockOrders);
  } catch (error) {
    console.error('Error in orders API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST a new order
 */
export async function POST(req: NextRequest) {
  try {
    const orderData = await req.json();
    
    // Validate required fields
    if (!orderData.symbol || !orderData.qty || !orderData.side || !orderData.type) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'symbol, qty, side, and type are required' },
        { status: 400 }
      );
    }
    
    // Create a mock order response
    const now = new Date();
    const orderId = `order-${Date.now()}`;
    const status = Math.random() > 0.1 ? 'filled' : 'new'; // 90% chance of being filled immediately
    const filledAt = status === 'filled' ? new Date(now.getTime() + 500).toISOString() : null;
    
    // Get a realistic price for the symbol
    const price = getSymbolPrice(orderData.symbol);
    const filledPrice = orderData.type === 'limit' ? orderData.limit_price : price;
    
    // Create mock order response
    const mockOrder = {
      id: orderId,
      client_order_id: `client-${orderId}`,
      created_at: now.toISOString(),
      updated_at: status === 'filled' ? new Date(now.getTime() + 500).toISOString() : now.toISOString(),
      submitted_at: now.toISOString(),
      filled_at: filledAt,
      expired_at: null,
      canceled_at: null,
      failed_at: null,
      replaced_at: null,
      replaced_by: null,
      replaces: null,
      asset_id: `asset-${orderData.symbol}`,
      symbol: orderData.symbol,
      asset_class: 'us_equity',
      notional: orderData.notional || null,
      qty: orderData.qty,
      filled_qty: status === 'filled' ? orderData.qty : '0',
      filled_avg_price: status === 'filled' ? filledPrice : null,
      order_class: orderData.order_class || 'simple',
      order_type: orderData.type,
      type: orderData.type,
      side: orderData.side,
      time_in_force: orderData.time_in_force || 'day',
      limit_price: orderData.limit_price || null,
      stop_price: orderData.stop_price || null,
      status,
      extended_hours: orderData.extended_hours || false,
      legs: null,
      trail_percent: orderData.trail_percent || null,
      trail_price: orderData.trail_price || null,
      hwm: null
    };

    return NextResponse.json(mockOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE (cancel) an order
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }
    
    // Mock order cancellation - always succeeds
    return NextResponse.json({
      id: orderId,
      status: 'canceled',
      canceled_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error canceling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get price for a symbol (mock data)
 */
function getSymbolPrice(symbol: string): string {
  const prices: Record<string, string> = {
    AAPL: '175.50',
    MSFT: '335.15',
    NVDA: '425.65',
    TSLA: '245.75',
    AMZN: '130.25',
    GOOGL: '140.80',
    META: '290.35',
    AMD: '155.20',
  };
  
  return prices[symbol] || '100.00';
} 