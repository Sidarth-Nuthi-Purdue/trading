import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.orderId;
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }
    
    // Get the access token from the Authorization header
    const authHeader = req.headers.get('authorization');
    let accessToken: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.split(' ')[1];
    }
    
    if (!accessToken) {
      console.error('No access token provided');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create a Supabase client with the access token
    const supabase = createServerSupabaseClient(accessToken);
    
    // Get the user if authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Cancelling order ${orderId} for user ${user.id}`);

    // Check if order exists and belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('virtual_orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();
    
    if (orderError || !order) {
      console.error('Order not found or does not belong to user');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Cancel the order
    const { error: deleteError } = await supabase
      .from('virtual_orders')
      .update({ 
        status: 'canceled',
        canceled_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('user_id', user.id);
    
    if (deleteError) {
      console.error('Error cancelling order:', deleteError.message);
      throw deleteError;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Order cancelled successfully' 
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DELETE order error:', errorMessage);
    return NextResponse.json({ error: 'Failed to cancel order', details: errorMessage }, { status: 500 });
  }
} 