import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * GET - Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const role = searchParams.get('role');
    const organization = searchParams.get('organization');

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Check if user has permission to view users
    const { data: hasPermission } = await supabase.rpc('user_has_permission', {
      p_user_id: authResult.user.id,
      p_permission: 'manage_users'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let query = supabase
      .from('user_profiles')
      .select(`
        user_id,
        whop_user_id,
        email,
        username,
        first_name,
        last_name,
        role,
        organization_id,
        can_trade,
        created_at,
        updated_at
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }

    if (organization) {
      query = query.eq('organization_id', organization);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get total count
    const { count } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      users: users || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create admin user
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Check if user has permission to manage users
    const { data: hasPermission } = await supabase.rpc('user_has_permission', {
      p_user_id: authResult.user.id,
      p_permission: 'manage_users'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      whop_user_id,
      email,
      username,
      role_name = 'competition_admin',
      organization_id
    } = body;

    if (!whop_user_id || !email || !username) {
      return NextResponse.json({ 
        error: 'Missing required fields: whop_user_id, email, username' 
      }, { status: 400 });
    }

    // Create admin user
    const userUuid = crypto.randomUUID();
    const { data: newUserId, error: createError } = await supabase.rpc('create_admin_user', {
      p_user_id: userUuid,
      p_whop_user_id: whop_user_id,
      p_email: email,
      p_username: username,
      p_role_name: role_name,
      p_organization_id: organization_id || null
    });

    if (createError) {
      console.error('Error creating admin user:', createError);
      return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 });
    }

    // Log admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: authResult.user.id,
        action: 'create_admin_user',
        target_type: 'user',
        target_id: userUuid,
        details: {
          whop_user_id,
          email,
          username,
          role_name,
          organization_id
        }
      });

    return NextResponse.json({
      message: 'Admin user created successfully',
      user_id: newUserId
    });

  } catch (error) {
    console.error('Admin user creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}