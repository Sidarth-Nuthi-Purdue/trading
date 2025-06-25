import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch analytics data (Creator only, filtered by company)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Development bypass for testing
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isDevelopment) {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check if user is a creator
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role, company_id, company_name')
        .eq('user_id', session.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'creator') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Get the creator's company ID for filtering
      const creatorCompanyId = userProfile.company_id;
      
      if (!creatorCompanyId) {
        return NextResponse.json({ error: 'Creator not associated with a company' }, { status: 400 });
      }

      // Fetch analytics data filtered by company
      const analytics = await getCompanyAnalytics(supabase, creatorCompanyId);
      
      return NextResponse.json({ analytics });
    } else {
      // Development mode - return mock data
      return NextResponse.json({
        analytics: {
          overview: {
            total_users: 0,
            active_users: 0,
            total_orders: 0,
            fill_rate: 0,
            avg_pnl: 0,
            total_volume: 0
          }
        }
      });
    }

  } catch (error) {
    console.error('Error in /api/creator/analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get analytics data filtered by company
 */
async function getCompanyAnalytics(supabase: any, companyId: string) {
  // Get users from the same company
  const { data: companyUsers } = await supabase
    .from('user_profiles')
    .select('user_id, created_at, is_active')
    .eq('company_id', companyId)
    .eq('role', 'user'); // Only regular users, not other creators

  const totalUsers = companyUsers?.length || 0;
  const activeUsers = companyUsers?.filter(user => user.is_active)?.length || 0;

  // Get trading orders for company users
  const userIds = companyUsers?.map(user => user.user_id) || [];
  
  let totalOrders = 0;
  let filledOrders = 0;
  let totalVolume = 0;
  let totalPnL = 0;

  if (userIds.length > 0) {
    const { data: orders } = await supabase
      .from('trade_orders')
      .select('user_id, status, quantity, filled_price, realized_pnl')
      .in('user_id', userIds);

    totalOrders = orders?.length || 0;
    filledOrders = orders?.filter(order => order.status === 'filled')?.length || 0;

    totalVolume = orders?.reduce((sum, order) => {
      if (order.status === 'filled' && order.filled_price) {
        return sum + (order.quantity * order.filled_price);
      }
      return sum;
    }, 0) || 0;

    // Get user balances for P&L data
    const { data: balances } = await supabase
      .from('user_balances')
      .select('total_pnl')
      .in('user_id', userIds);

    totalPnL = balances?.reduce((sum, balance) => sum + (balance.total_pnl || 0), 0) || 0;
  }

  const avgPnL = totalUsers > 0 ? totalPnL / totalUsers : 0;
  const fillRate = totalOrders > 0 ? (filledOrders / totalOrders) * 100 : 0;

  return {
    overview: {
      total_users: totalUsers,
      active_users: activeUsers,
      total_orders: totalOrders,
      fill_rate: fillRate,
      avg_pnl: avgPnL,
      total_volume: totalVolume
    }
  };
}