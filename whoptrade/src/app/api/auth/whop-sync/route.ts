import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Sync Whop authenticated user to Supabase
 * Creates a Supabase user account and profile based on Whop user data
 */
export async function POST(request: NextRequest) {
  try {
    // Get Whop user data from request body
    const whopUserData = await request.json();
    
    if (!whopUserData || !whopUserData.id) {
      return NextResponse.json({ error: 'Invalid Whop user data' }, { status: 400 });
    }

    // Extract company information from experience data
    const companyId = whopUserData.experience?.company?.id || null;
    const companyTitle = whopUserData.experience?.company?.title || null;
    const accessLevel = whopUserData.accessLevel || 'member';
    const experienceId = whopUserData.experience?.id || null;

    console.log('Syncing Whop user to Supabase:', whopUserData.id);

    // Create Supabase admin client (with service role key)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // This needs to be set in environment
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user already exists in Supabase
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('whop_user_id', whopUserData.id)
      .single();

    if (existingProfile) {
      console.log('User already exists in Supabase:', existingProfile.user_id);
      
      // Determine role based on access level - admins become creators
      const userRole = accessLevel === 'admin' ? 'creator' : 'user';
      
      // Update existing profile with latest Whop data
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          email: whopUserData.email,
          username: whopUserData.username,
          first_name: whopUserData.name?.split(' ')[0] || null,
          last_name: whopUserData.name?.split(' ').slice(1).join(' ') || null,
          role: userRole,
          company_id: companyId,
          company_name: companyTitle,
          experience_id: experienceId,
          access_level: accessLevel,
          updated_at: new Date().toISOString()
        })
        .eq('whop_user_id', whopUserData.id);

      if (updateError) {
        console.error('Error updating user profile:', updateError);
      }

      // Return existing user data with Supabase session
      const { data: session, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: existingProfile.email || whopUserData.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
        }
      });

      if (sessionError) {
        console.error('Error generating session:', sessionError);
        return NextResponse.json({ 
          success: true, 
          user_id: existingProfile.user_id,
          message: 'User updated but session generation failed'
        });
      }

      return NextResponse.json({ 
        success: true, 
        user_id: existingProfile.user_id,
        session_url: session.properties?.action_link,
        message: 'User updated successfully'
      });
    }

    // Create new Supabase user
    const email = whopUserData.email || `${whopUserData.id}@whop.generated`;
    const password = generateRandomPassword();

    console.log('Creating new Supabase user with email:', email);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        whop_user_id: whopUserData.id,
        whop_username: whopUserData.username,
        full_name: whopUserData.name,
        source: 'whop_sync'
      }
    });

    if (authError || !authUser.user) {
      console.error('Error creating Supabase user:', authError);
      return NextResponse.json({ 
        error: 'Failed to create Supabase user',
        details: authError?.message 
      }, { status: 500 });
    }

    console.log('Created Supabase user:', authUser.user.id);

    // Determine role based on access level - admins become creators
    const userRole = accessLevel === 'admin' ? 'creator' : 'user';
    
    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: authUser.user.id,
        whop_user_id: whopUserData.id,
        email: whopUserData.email,
        username: whopUserData.username,
        first_name: whopUserData.name?.split(' ')[0] || null,
        last_name: whopUserData.name?.split(' ').slice(1).join(' ') || null,
        role: userRole,
        company_id: companyId,
        company_name: companyTitle,
        experience_id: experienceId,
        access_level: accessLevel,
        is_active: true
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      // Continue anyway, profile can be created later
    }

    // Create initial balance for the user
    const { error: balanceError } = await supabaseAdmin
      .from('user_balances')
      .insert({
        user_id: authUser.user.id,
        balance: 100000, // Default starting balance
        available_balance: 100000,
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0
      });

    if (balanceError) {
      console.error('Error creating user balance:', balanceError);
    }

    // Generate a magic link for immediate login
    const { data: session, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
      }
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
    }

    console.log('Successfully synced Whop user to Supabase');

    return NextResponse.json({ 
      success: true, 
      user_id: authUser.user.id,
      session_url: session?.properties?.action_link,
      message: 'User created and synced successfully'
    });

  } catch (error) {
    console.error('Error in Whop sync:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Generate a random password for Supabase user
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}