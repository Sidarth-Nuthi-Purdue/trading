import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * POST - Join a competition
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const competitionId = params.id;

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invitation_code } = await request.json();
    const supabase = createDatabaseClient();

    // Get competition details
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .single();

    if (compError) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Check competition status
    if (competition.status !== 'active') {
      return NextResponse.json({ error: 'Competition is not active' }, { status: 400 });
    }

    // Check registration deadline
    const now = new Date();
    const regDeadline = new Date(competition.registration_deadline);
    if (now > regDeadline) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    // For invite-only competitions, verify invitation
    if (competition.type === 'invite_only') {
      if (!invitation_code) {
        return NextResponse.json({ error: 'Invitation code required' }, { status: 400 });
      }

      const { data: invitation, error: inviteError } = await supabase
        .from('competition_invitations')
        .select('*')
        .eq('invitation_code', invitation_code)
        .eq('competition_id', competitionId)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invitation) {
        return NextResponse.json({ error: 'Invalid invitation code' }, { status: 400 });
      }

      // Check if invitation is expired
      if (new Date() > new Date(invitation.expires_at)) {
        return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
      }

      // Check if invitation is for this user (if whop_user_id is set)
      if (invitation.invitee_whop_id && invitation.invitee_whop_id !== authResult.user.whop_user_id) {
        return NextResponse.json({ error: 'Invitation is not for this user' }, { status: 400 });
      }

      // Mark invitation as accepted
      await supabase
        .from('competition_invitations')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id);
    }

    // Check if user is already participating in ANY active competition
    const { data: existingParticipation } = await supabase
      .from('competition_participants')
      .select(`
        id,
        competition_id,
        competitions (name, status)
      `)
      .eq('user_id', authResult.user.id)
      .eq('status', 'active')
      .single();

    if (existingParticipation) {
      return NextResponse.json({ 
        error: 'You are already participating in another competition',
        current_competition: existingParticipation.competitions.name
      }, { status: 400 });
    }

    // Check if competition is full
    const { count: participantCount } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId)
      .eq('status', 'active');

    if (participantCount >= competition.max_participants) {
      return NextResponse.json({ error: 'Competition is full' }, { status: 400 });
    }

    // Use the join_competition function to handle balance reset
    try {
      const { error: joinError } = await supabase.rpc('join_competition', {
        comp_id: competitionId,
        user_uuid: authResult.user.id,
        whop_id: authResult.user.whop_user_id || authResult.user.id
      });

      if (joinError) {
        console.error('Join competition error:', joinError);
        return NextResponse.json({ 
          error: joinError.message || 'Failed to join competition' 
        }, { status: 400 });
      }

      return NextResponse.json({ 
        message: 'Successfully joined competition',
        starting_balance: competition.starting_balance
      });

    } catch (funcError) {
      console.error('Competition join function error:', funcError);
      return NextResponse.json({ error: 'Failed to join competition' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error joining competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}