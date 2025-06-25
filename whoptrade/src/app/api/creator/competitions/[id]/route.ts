import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const competitionId = params.id;

    // Get competition details
    const { data: competition, error: competitionError } = await supabase
      .from('competitions')
      .select(`
        id,
        creator_id,
        name,
        description,
        start_date,
        end_date,
        prize_amount,
        prize_currency,
        status,
        max_participants,
        entry_fee,
        rules,
        created_at,
        updated_at
      `)
      .eq('id', competitionId)
      .single();

    if (competitionError) {
      console.error('Error fetching competition:', competitionError);
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Check if user has access to this competition
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    const isCreator = profile?.role === 'creator';
    const isOwner = competition.creator_id === session.user.id;

    if (!isCreator && !isOwner && competition.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get leaderboard data
    const { data: leaderboard, error: leaderboardError } = await supabase
      .from('competition_leaderboard')
      .select(`
        user_id,
        username,
        first_name,
        last_name,
        starting_balance,
        current_balance,
        total_pnl,
        pnl_percentage,
        rank,
        status,
        joined_at,
        updated_at
      `)
      .eq('competition_id', competitionId)
      .order('rank', { ascending: true });

    if (leaderboardError) {
      console.error('Error fetching leaderboard:', leaderboardError);
    }

    // Get participant count
    const { data: participants, error: participantError } = await supabase
      .from('competition_participants')
      .select('user_id, status')
      .eq('competition_id', competitionId);

    if (participantError) {
      console.error('Error fetching participants:', participantError);
    }

    const participantCount = participants?.filter(p => p.status === 'active').length || 0;

    return NextResponse.json({
      competition: {
        ...competition,
        participant_count: participantCount
      },
      leaderboard: leaderboard || [],
      participants: participants || []
    });

  } catch (error) {
    console.error('Error in /api/creator/competitions/[id] GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const competitionId = params.id;
    const updateData = await request.json();

    // Verify user owns this competition
    const { data: competition, error: competitionError } = await supabase
      .from('competitions')
      .select('creator_id, status')
      .eq('id', competitionId)
      .single();

    if (competitionError) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    if (competition.creator_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden - Only competition creator can update' }, { status: 403 });
    }

    // Don't allow updates to completed competitions
    if (competition.status === 'completed') {
      return NextResponse.json({ error: 'Cannot update completed competition' }, { status: 400 });
    }

    // Update competition
    const { data: updatedCompetition, error: updateError } = await supabase
      .from('competitions')
      .update(updateData)
      .eq('id', competitionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating competition:', updateError);
      return NextResponse.json({ error: 'Failed to update competition' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Competition updated successfully',
      competition: updatedCompetition
    });

  } catch (error) {
    console.error('Error in /api/creator/competitions/[id] PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const competitionId = params.id;

    // Verify user owns this competition
    const { data: competition, error: competitionError } = await supabase
      .from('competitions')
      .select('creator_id, status')
      .eq('id', competitionId)
      .single();

    if (competitionError) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    if (competition.creator_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden - Only competition creator can delete' }, { status: 403 });
    }

    // Don't allow deletion of active competitions with participants
    if (competition.status === 'active') {
      const { data: participants, error: participantError } = await supabase
        .from('competition_participants')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('status', 'active');

      if (participantError) {
        console.error('Error checking participants:', participantError);
        return NextResponse.json({ error: 'Failed to check participants' }, { status: 500 });
      }

      if (participants && participants.length > 0) {
        return NextResponse.json({ 
          error: 'Cannot delete active competition with participants' 
        }, { status: 400 });
      }
    }

    // Delete competition (CASCADE will handle related records)
    const { error: deleteError } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competitionId);

    if (deleteError) {
      console.error('Error deleting competition:', deleteError);
      return NextResponse.json({ error: 'Failed to delete competition' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Competition deleted successfully'
    });

  } catch (error) {
    console.error('Error in /api/creator/competitions/[id] DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}