import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * POST - Create invitation to competition
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const competitionId = params.id;

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { whop_user_id, email } = await request.json();

    if (!whop_user_id && !email) {
      return NextResponse.json({ 
        error: 'Either whop_user_id or email is required' 
      }, { status: 400 });
    }

    const supabase = createDatabaseClient();

    // Check if competition exists and user has permission to invite
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .single();

    if (compError) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Only creator can send invitations for now
    if (competition.creator_id !== authResult.user.id) {
      return NextResponse.json({ 
        error: 'Only competition creator can send invitations' 
      }, { status: 403 });
    }

    // Check if competition is invite-only
    if (competition.type !== 'invite_only') {
      return NextResponse.json({ 
        error: 'This competition does not require invitations' 
      }, { status: 400 });
    }

    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from('competition_invitations')
      .select('id, status')
      .eq('competition_id', competitionId)
      .eq(whop_user_id ? 'invitee_whop_id' : 'invitee_email', whop_user_id || email)
      .single();

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return NextResponse.json({ 
          error: 'Invitation already sent to this user' 
        }, { status: 400 });
      }
    }

    // Create invitation using the database function
    const { data: inviteCode, error: inviteError } = await supabase.rpc('create_competition_invitation', {
      comp_id: competitionId,
      inviter: authResult.user.id,
      whop_id: whop_user_id || null,
      email: email || null
    });

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Invitation created successfully',
      invitation_code: inviteCode,
      expires_in_days: 7
    });

  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Get invitations for competition
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const competitionId = params.id;

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Check if user is the creator
    const { data: competition } = await supabase
      .from('competitions')
      .select('creator_id')
      .eq('id', competitionId)
      .single();

    if (!competition || competition.creator_id !== authResult.user.id) {
      return NextResponse.json({ 
        error: 'Not authorized to view invitations' 
      }, { status: 403 });
    }

    // Get all invitations for this competition
    const { data: invitations, error } = await supabase
      .from('competition_invitations')
      .select('*')
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({ invitations: invitations || [] });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}