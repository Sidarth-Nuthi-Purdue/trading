import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * GET - Get specific competition details
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const competitionId = params.id;

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Get competition details
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select(`
        *,
        user_profiles!creator_id (username, first_name, last_name)
      `)
      .eq('id', competitionId)
      .single();

    if (compError) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Get participant count and user's participation status
    const { count: participantCount } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId)
      .eq('status', 'active');

    // Check if current user is participating
    const { data: userParticipation } = await supabase
      .from('competition_participants')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('user_id', authResult.user.id)
      .single();

    // Get leaderboard (top 10)
    const { data: leaderboard } = await supabase
      .from('competition_leaderboard')
      .select('*')
      .eq('competition_id', competitionId)
      .limit(10)
      .order('current_rank');

    return NextResponse.json({
      competition: {
        ...competition,
        participant_count: participantCount || 0,
        spots_remaining: competition.max_participants - (participantCount || 0),
        user_participation: userParticipation,
        leaderboard: leaderboard || []
      }
    });

  } catch (error) {
    console.error('Error fetching competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Update competition (creator only)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const competitionId = params.id;

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = createDatabaseClient();

    // Check if user is the creator
    const { data: competition } = await supabase
      .from('competitions')
      .select('creator_id')
      .eq('id', competitionId)
      .single();

    if (!competition || competition.creator_id !== authResult.user.id) {
      return NextResponse.json({ error: 'Not authorized to update this competition' }, { status: 403 });
    }

    const { data: updatedCompetition, error } = await supabase
      .from('competitions')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', competitionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating competition:', error);
      return NextResponse.json({ error: 'Failed to update competition' }, { status: 500 });
    }

    return NextResponse.json({ competition: updatedCompetition });

  } catch (error) {
    console.error('Error updating competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Delete competition (creator only)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
      .select('creator_id, status')
      .eq('id', competitionId)
      .single();

    if (!competition || competition.creator_id !== authResult.user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this competition' }, { status: 403 });
    }

    // Can only delete draft competitions
    if (competition.status !== 'draft') {
      return NextResponse.json({ error: 'Can only delete draft competitions' }, { status: 400 });
    }

    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competitionId);

    if (error) {
      console.error('Error deleting competition:', error);
      return NextResponse.json({ error: 'Failed to delete competition' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Competition deleted successfully' });

  } catch (error) {
    console.error('Error deleting competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}