import { createClient } from '@supabase/supabase-js';

interface AuthResult {
  user: {
    id: string;
    email: string;
    whop_user_id?: string;
  } | null;
  error: string | null;
}

/**
 * Authenticate user from authorization header
 * Supports both regular Supabase tokens and virtual Whop tokens
 */
export async function authenticateUser(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Missing or invalid authorization header:', authHeader);
    return { user: null, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  console.log('Authenticating with token:', token.substring(0, 20) + '...');

  // Check if this is a virtual Whop token
  if (token.startsWith('whop-')) {
    console.log('Using Whop authentication');
    return authenticateWhopUser(token);
  }

  // Regular Supabase authentication
  console.log('Using Supabase authentication');
  return authenticateSupabaseUser(token);
}

/**
 * Authenticate virtual Whop user
 */
async function authenticateWhopUser(token: string): Promise<AuthResult> {
  try {
    // Extract user ID from token format: whop-{userId}-{timestamp}
    const parts = token.split('-');
    if (parts.length < 2 || parts[0] !== 'whop') {
      return { user: null, error: 'Invalid Whop token format' };
    }

    const whopUserId = parts[1];
    
    // Create database client with service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Look up user by whop_user_id
    console.log('Looking up user with whop_user_id:', whopUserId);
    const { data: existingUser, error: lookupError } = await supabase
      .from('user_profiles')
      .select('id, user_id, email, username, first_name, last_name, whop_user_id')
      .eq('whop_user_id', whopUserId)
      .single();

    if (existingUser && !lookupError) {
      // User exists, return their UUID
      const user = {
        id: existingUser.user_id,
        email: existingUser.email || '',
        whop_user_id: whopUserId
      };
      
      console.log('Whop user authenticated:', existingUser.user_id);
      return { user, error: null };
    }

    console.log('User not found, creating new user. Lookup error:', lookupError);

    // User doesn't exist, create them using the RPC function to bypass RLS
    const userUuid = crypto.randomUUID();
    
    console.log('Creating new Whop user with RPC function...');
    const { data: newUserId, error: createError } = await supabase.rpc('create_whop_user', {
      p_user_id: userUuid,
      p_whop_user_id: whopUserId,
      p_email: `whop-${whopUserId}@whoptrade.internal`,
      p_username: whopUserId
    });

    if (createError) {
      console.error('Error creating Whop user via RPC:', createError);
      return { user: null, error: 'Failed to create Whop user' };
    }

    const user = {
      id: userUuid,
      email: `whop-${whopUserId}@whoptrade.internal`,
      whop_user_id: whopUserId
    };

    console.log('Whop user created and authenticated:', userUuid);
    return { user, error: null };

  } catch (error) {
    console.error('Whop authentication error:', error);
    return { user: null, error: 'Whop authentication failed' };
  }
}

/**
 * Authenticate regular Supabase user
 */
async function authenticateSupabaseUser(token: string): Promise<AuthResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('Supabase auth error:', authError);
      return { user: null, error: 'Invalid Supabase token' };
    }

    return { 
      user: {
        id: user.id,
        email: user.email || '',
        whop_user_id: user.user_metadata?.whop_user_id
      }, 
      error: null 
    };

  } catch (error) {
    console.error('Supabase authentication error:', error);
    return { user: null, error: 'Supabase authentication failed' };
  }
}

/**
 * Create Supabase client for database operations (no auth required)
 */
export function createDatabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}