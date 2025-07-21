import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * GET - Get organizations
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Check if user has permission to view organizations
    const { data: hasPermission } = await supabase.rpc('user_has_permission', {
      p_user_id: authResult.user.id,
      p_permission: 'manage_organizations'
    });

    if (!hasPermission) {
      // Users can at least see their own organization
      const { data: userOrg } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('user_id', authResult.user.id)
        .single();

      if (!userOrg?.organization_id) {
        return NextResponse.json({ organizations: [] });
      }

      const { data: organization } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userOrg.organization_id)
        .single();

      return NextResponse.json({
        organizations: organization ? [organization] : []
      });
    }

    // Admin can see all organizations
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    return NextResponse.json({
      organizations: organizations || []
    });

  } catch (error) {
    console.error('Organizations fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create organization
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Check if user has permission to manage organizations
    const { data: hasPermission } = await supabase.rpc('user_has_permission', {
      p_user_id: authResult.user.id,
      p_permission: 'manage_organizations'
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      whop_company_id,
      description,
      settings = {}
    } = body;

    if (!name) {
      return NextResponse.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 });
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({
        name,
        whop_company_id,
        description,
        settings
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    // Log admin action
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: authResult.user.id,
        action: 'create_organization',
        target_type: 'organization',
        target_id: organization.id,
        details: {
          name,
          whop_company_id,
          description
        }
      });

    return NextResponse.json({
      message: 'Organization created successfully',
      organization
    });

  } catch (error) {
    console.error('Organization creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}