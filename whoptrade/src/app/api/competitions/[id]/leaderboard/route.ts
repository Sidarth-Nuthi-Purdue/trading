import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * GET - Get competition leaderboard
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const competitionId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    // Verify user has access to this competition
    const { data: competition } = await supabase
      .from('competitions')
      .select('id, status, type')
      .eq('id', competitionId)
      .single();

    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // For private competitions, check if user is participating
    if (competition.type === 'invite_only') {
      const { data: participation } = await supabase
        .from('competition_participants')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('user_id', authResult.user.id)
        .single();

      if (!participation) {
        return NextResponse.json({ error: 'Access denied to this competition' }, { status: 403 });
      }
    }

    // Get leaderboard data
    const { data: leaderboard, error } = await supabase
      .from('competition_leaderboard')
      .select('*')
      .eq('competition_id', competitionId)
      .range(offset, offset + limit - 1)
      .order('current_rank');

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    // Get current user's rank if participating
    const { data: userRank } = await supabase
      .from('competition_leaderboard')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('user_id', authResult.user.id)
      .single();

    // Get total participant count
    const { count: totalParticipants } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId)
      .eq('status', 'active');

    return NextResponse.json({
      leaderboard: leaderboard || [],
      user_rank: userRank,
      total_participants: totalParticipants || 0,
      competition: {
        id: competition.id,
        status: competition.status,
        type: competition.type
      }
    });

  } catch (error) {
    console.error('Error fetching competition leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}