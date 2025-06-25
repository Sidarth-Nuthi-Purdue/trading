import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // For development, return empty data until proper authentication is implemented
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // Return empty users array for development
      return NextResponse.json({ 
        users: [],
        total: 0 
      });
    }

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator and get company info
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, company_id, company_name')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const creatorCompanyId = userProfile.company_id;

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;

    // Build query to get users from same company
    let query = supabase
      .from('user_profiles')
      .select(`
        user_id,
        email,
        username,
        first_name,
        last_name,
        company_id,
        company_name,
        is_active,
        created_at,
        user_balances(balance, total_pnl, daily_pnl)
      `)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by company if creator has one
    if (creatorCompanyId) {
      query = query.eq('company_id', creatorCompanyId);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'user');

    if (creatorCompanyId) {
      countQuery = countQuery.eq('company_id', creatorCompanyId);
    }

    const { count: totalCount } = await countQuery;

    return NextResponse.json({ 
      users: users || [],
      total: totalCount || 0,
      page,
      limit,
      totalPages: Math.ceil((totalCount || 0) / limit)
    });

  } catch (error) {
    console.error('Error in /api/creator/users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Development mode - return error instead of mock data
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return NextResponse.json({ error: 'Development mode - user modification disabled' }, { status: 400 });
    }

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator and get company info
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, company_id, company_name')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { action, user_id, balance_adjustment, new_balance } = await request.json();

    if (action === 'adjust_balance' && user_id) {
      // Verify the target user belongs to the same company
      const { data: targetUser } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', user_id)
        .eq('role', 'user')
        .single();

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check company permission
      if (userProfile.company_id && targetUser.company_id !== userProfile.company_id) {
        return NextResponse.json({ error: 'Cannot modify users from different companies' }, { status: 403 });
      }

      // Update user balance
      const updateData: any = {};
      if (balance_adjustment !== undefined) {
        updateData.available_balance = balance_adjustment;
        updateData.balance = balance_adjustment;
      } else if (new_balance !== undefined) {
        updateData.available_balance = new_balance;
        updateData.balance = new_balance;
      }

      const { error: updateError } = await supabase
        .from('user_balances')
        .update(updateData)
        .eq('user_id', user_id);

      if (updateError) {
        console.error('Error updating user balance:', updateError);
        return NextResponse.json({ error: 'Failed to update user balance' }, { status: 500 });
      }

      return NextResponse.json({ message: 'User balance updated successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in /api/creator/users POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}