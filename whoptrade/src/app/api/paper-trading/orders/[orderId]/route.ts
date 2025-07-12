import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Get specific order details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { data: order, error } = await supabase
      .from('trade_orders')
      .select('*')
      .eq('id', resolvedParams.orderId)
      .eq('user_id', session.user.id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Update order (modify or cancel)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { action, ...updateData } = body;

    // Get the current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('trade_orders')
      .select('*')
      .eq('id', resolvedParams.orderId)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if order can be modified
    if (currentOrder.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Only pending orders can be modified' 
      }, { status: 400 });
    }

    let updatePayload: any = {};

    if (action === 'cancel') {
      updatePayload = {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      };
    } else if (action === 'modify') {
      // Allow modification of price, quantity, etc.
      if (updateData.price) updatePayload.price = parseFloat(updateData.price);
      if (updateData.quantity) updatePayload.quantity = parseFloat(updateData.quantity);
      if (updateData.stop_price) updatePayload.stop_price = parseFloat(updateData.stop_price);
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('trade_orders')
      .update(updatePayload)
      .eq('id', resolvedParams.orderId)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error('Error in order PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Cancel order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: order, error: updateError } = await supabase
      .from('trade_orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', params.orderId)
      .eq('user_id', session.user.id)
      .eq('status', 'pending') // Only allow cancelling pending orders
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ 
        error: 'Order not found or cannot be cancelled' 
      }, { status: 404 });
    }

    return NextResponse.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}