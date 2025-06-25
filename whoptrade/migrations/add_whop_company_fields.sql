-- Add Whop company and experience fields to user_profiles table
-- This enables linking creators to users through Whop company information

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS company_id TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS experience_id TEXT,
ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'member' CHECK (access_level IN ('admin', 'member', 'none'));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_experience_id ON user_profiles(experience_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_level ON user_profiles(access_level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.company_id IS 'Whop company ID from experience.company.id';
COMMENT ON COLUMN user_profiles.company_name IS 'Whop company name from experience.company.title';
COMMENT ON COLUMN user_profiles.experience_id IS 'Whop experience ID that the user has access to';
COMMENT ON COLUMN user_profiles.access_level IS 'User access level within the Whop experience (admin = creator, member = user)';