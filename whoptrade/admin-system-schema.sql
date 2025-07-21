-- Admin System and Organization Management Schema
-- This creates role-based permissions and organizational structure

-- Add role and organization columns to user_profiles if they don't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR(255);

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS can_trade BOOLEAN DEFAULT true;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '[]'::jsonb;

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    whop_company_id VARCHAR(255) UNIQUE,
    description TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create admin roles table for granular permissions
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL, -- Array of permission strings
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin roles
INSERT INTO admin_roles (name, permissions, description) VALUES 
(
    'super_admin', 
    '["manage_users", "manage_competitions", "manage_leaderboards", "view_analytics", "manage_organizations", "system_admin"]'::jsonb,
    'Full system administrator with all permissions'
),
(
    'competition_admin', 
    '["manage_competitions", "manage_leaderboards", "view_analytics"]'::jsonb,
    'Can manage competitions and leaderboards'
),
(
    'organization_admin', 
    '["manage_org_users", "manage_org_competitions", "view_org_analytics"]'::jsonb,
    'Can manage users and competitions within their organization'
),
(
    'support_admin', 
    '["view_users", "view_competitions", "view_analytics"]'::jsonb,
    'Read-only access for support purposes'
);

-- Create user_role_assignments table for flexible role management
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    organization_id UUID, -- NULL for global roles, specific org for org-scoped roles
    assigned_by UUID NOT NULL, -- Who assigned this role
    assigned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- Optional expiration
    active BOOLEAN DEFAULT true,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id, organization_id)
);

-- Add organization support to competitions
ALTER TABLE competitions 
ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE competitions 
ADD CONSTRAINT fk_competition_organization 
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- Create audit log for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL, -- 'create_competition', 'ban_user', 'modify_leaderboard', etc.
    target_type VARCHAR(50) NOT NULL, -- 'user', 'competition', 'leaderboard', etc.
    target_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (admin_user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_permission TEXT,
    p_organization_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    -- Check if user has the permission through role assignments
    SELECT EXISTS(
        SELECT 1 
        FROM user_role_assignments ura
        JOIN admin_roles ar ON ura.role_id = ar.id
        WHERE ura.user_id = p_user_id
        AND ura.active = true
        AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
        AND (
            ura.organization_id IS NULL  -- Global permission
            OR ura.organization_id = p_organization_id  -- Organization-specific permission
        )
        AND ar.permissions ? p_permission
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's permissions
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    permissions JSONB := '[]'::jsonb;
BEGIN
    -- Get all permissions from active role assignments
    SELECT COALESCE(jsonb_agg(DISTINCT perm), '[]'::jsonb)
    FROM (
        SELECT jsonb_array_elements_text(ar.permissions) as perm
        FROM user_role_assignments ura
        JOIN admin_roles ar ON ura.role_id = ar.id
        WHERE ura.user_id = p_user_id
        AND ura.active = true
        AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
        AND (
            ura.organization_id IS NULL
            OR ura.organization_id = p_organization_id
        )
    ) perms
    INTO permissions;
    
    RETURN permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create admin user (bypasses trading restrictions)
CREATE OR REPLACE FUNCTION create_admin_user(
    p_user_id UUID,
    p_whop_user_id TEXT,
    p_email TEXT,
    p_username TEXT,
    p_role_name TEXT DEFAULT 'competition_admin',
    p_organization_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    inserted_user_id UUID;
    role_id UUID;
BEGIN
    -- Get role ID
    SELECT id INTO role_id FROM admin_roles WHERE name = p_role_name;
    
    IF role_id IS NULL THEN
        RAISE EXCEPTION 'Invalid role name: %', p_role_name;
    END IF;
    
    -- Insert user profile with admin settings
    INSERT INTO user_profiles (
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
    ) VALUES (
        p_user_id,
        p_whop_user_id,
        p_email,
        p_username,
        p_username,
        'Admin',
        'admin',
        p_organization_id,
        false, -- Admins cannot trade
        NOW(),
        NOW()
    )
    RETURNING user_id INTO inserted_user_id;
    
    -- Assign admin role
    INSERT INTO user_role_assignments (
        user_id,
        role_id,
        organization_id,
        assigned_by,
        assigned_at
    ) VALUES (
        inserted_user_id,
        role_id,
        p_organization_id,
        inserted_user_id, -- Self-assigned for initial admin
        NOW()
    );
    
    -- Do NOT create trading balance for admin users
    -- They should not be able to trade due to conflict of interest
    
    RETURN inserted_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update competitions to support organization-wide access
CREATE OR REPLACE FUNCTION can_user_join_competition(
    p_user_id UUID,
    p_competition_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    user_org_id UUID;
    comp_org_id UUID;
    comp_type VARCHAR(50);
    can_join BOOLEAN := false;
BEGIN
    -- Get user's organization
    SELECT organization_id INTO user_org_id 
    FROM user_profiles 
    WHERE user_id = p_user_id;
    
    -- Get competition details
    SELECT organization_id, type INTO comp_org_id, comp_type
    FROM competitions 
    WHERE id = p_competition_id;
    
    -- Check access rules:
    -- 1. Public competitions - anyone can join
    -- 2. Organization competitions - only same org members
    -- 3. Invite-only - requires invitation (handled elsewhere)
    
    IF comp_type = 'public' THEN
        can_join := true;
    ELSIF comp_type = 'organization' AND user_org_id = comp_org_id THEN
        can_join := true;
    ELSIF comp_type = 'invite_only' THEN
        -- Check for valid invitation
        SELECT EXISTS(
            SELECT 1 FROM competition_invitations ci
            WHERE ci.competition_id = p_competition_id
            AND ci.invitee_whop_id = (
                SELECT whop_user_id FROM user_profiles WHERE user_id = p_user_id
            )
            AND ci.status = 'pending'
            AND ci.expires_at > NOW()
        ) INTO can_join;
    END IF;
    
    RETURN can_join;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add competition type for organization-wide competitions
ALTER TABLE competitions 
DROP CONSTRAINT IF EXISTS competitions_type_check;

ALTER TABLE competitions 
ADD CONSTRAINT competitions_type_check 
CHECK (type IN ('public', 'invite_only', 'organization'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_active ON user_role_assignments(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_competitions_organization ON competitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- RLS policies for admin system
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Organization policies
CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT USING (
        id = (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can manage organizations" ON organizations
    FOR ALL USING (
        user_has_permission(auth.uid(), 'manage_organizations')
        OR user_has_permission(auth.uid(), 'system_admin')
    );

-- Admin roles policies
CREATE POLICY "Everyone can view admin roles" ON admin_roles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage roles" ON admin_roles
    FOR ALL USING (user_has_permission(auth.uid(), 'system_admin'));

-- User role assignments policies
CREATE POLICY "Users can view their own role assignments" ON user_role_assignments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage role assignments" ON user_role_assignments
    FOR ALL USING (
        user_has_permission(auth.uid(), 'manage_users')
        OR user_has_permission(auth.uid(), 'system_admin')
    );

-- Audit log policies
CREATE POLICY "Admins can view audit logs" ON admin_audit_log
    FOR SELECT USING (
        user_has_permission(auth.uid(), 'view_analytics')
        OR user_has_permission(auth.uid(), 'system_admin')
        OR admin_user_id = auth.uid()
    );

CREATE POLICY "System creates audit logs" ON admin_audit_log
    FOR INSERT WITH CHECK (admin_user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;
GRANT SELECT ON admin_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_role_assignments TO authenticated;
GRANT SELECT, INSERT ON admin_audit_log TO authenticated;

-- Grant all to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create initial super admin (run this manually with actual admin details)
-- SELECT create_admin_user(
--     'your-admin-uuid-here'::uuid,
--     'your-whop-admin-id',
--     'admin@yourcompany.com',
--     'admin',
--     'super_admin'
-- );