import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * GET - Get current user's permissions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organization_id = searchParams.get('organization_id');

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Get user's permissions
    const { data: permissions, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: authResult.user.id,
      p_organization_id: organization_id || null
    });

    if (error) {
      console.error('Error fetching permissions:', error);
      return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
    }

    // Get user's roles
    const { data: roles } = await supabase
      .from('user_role_assignments')
      .select(`
        id,
        active,
        assigned_at,
        expires_at,
        admin_roles (
          name,
          description,
          permissions
        )
      `)
      .eq('user_id', authResult.user.id)
      .eq('active', true);

    // Get user profile with role info
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, can_trade, organization_id')
      .eq('user_id', authResult.user.id)
      .single();

    return NextResponse.json({
      permissions: permissions || [],
      roles: roles || [],
      user_profile: userProfile,
      is_admin: userProfile?.role === 'admin',
      can_trade: userProfile?.can_trade || false
    });

  } catch (error) {
    console.error('Permissions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Assign role to user (admin only)
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
      user_id,
      role_name,
      organization_id,
      expires_at
    } = body;

    if (!user_id || !role_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: user_id, role_name' 
      }, { status: 400 });
    }

    // Get role ID
    const { data: role, error: roleError } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('name', role_name)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: 'Invalid role name' }, { status: 400 });
    }

    // Assign role
    const { error: assignError } = await supabase
      .from('user_role_assignments')
      .insert({
        user_id,
        role_id: role.id,
        organization_id: organization_id || null,
        assigned_by: authResult.user.id,
        expires_at: expires_at || null
      });

    if (assignError) {
      console.error('Error assigning role:', assignError);
      return NextResponse.json({ error: 'Failed to assign role' }, { status: 500 });
    }

    // Log admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: authResult.user.id,
        action: 'assign_role',
        target_type: 'user',
        target_id: user_id,
        details: {
          role_name,
          organization_id,
          expires_at
        }
      });

    return NextResponse.json({
      message: 'Role assigned successfully'
    });

  } catch (error) {
    console.error('Role assignment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}