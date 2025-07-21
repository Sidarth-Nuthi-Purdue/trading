import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createDatabaseClient } from '@/lib/auth-helper';

/**
 * GET - Get list of competitions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');

    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createDatabaseClient();

    let query = supabase
      .from('competitions')
      .select(`
        id,
        name,
        description,
        status,
        type,
        starting_balance,
        max_participants,
        entry_fee,
        prize_pool,
        start_date,
        end_date,
        registration_deadline,
        ranking_criteria,
        organization_id,
        created_at,
        creator_id
      `)
      .eq('status', status)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data: competitions, error } = await query;

    if (error) {
      console.error('Error fetching competitions:', error);
      return NextResponse.json({ error: 'Failed to fetch competitions' }, { status: 500 });
    }

    // Get user's organization for filtering
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', authResult.user.id)
      .single();

    // Filter competitions based on access rules
    const accessibleCompetitions = competitions.filter(comp => {
      switch (comp.type) {
        case 'public':
          return true; // Anyone can see public competitions
        case 'organization':
          return userProfile?.organization_id === comp.organization_id; // Same org only
        case 'invite_only':
          return true; // Show invite-only but user needs invitation to join
        default:
          return true;
      }
    });

    // Get participant counts and creator info for each competition
    const competitionsWithCounts = await Promise.all(
      accessibleCompetitions.map(async (comp) => {
        // Get participant count
        const { count } = await supabase
          .from('competition_participants')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id)
          .eq('status', 'active');

        // Get creator info
        const { data: creator } = await supabase
          .from('user_profiles')
          .select('username, first_name, last_name')
          .eq('user_id', comp.creator_id)
          .single();

        // Check if current user is participating
        const { data: userParticipation } = await supabase
          .from('competition_participants')
          .select('id, status')
          .eq('competition_id', comp.id)
          .eq('user_id', authResult.user.id)
          .single();

        return {
          ...comp,
          participant_count: count || 0,
          spots_remaining: comp.max_participants - (count || 0),
          user_profiles: creator || { username: 'Unknown', first_name: 'Unknown', last_name: 'Creator' },
          user_participation: userParticipation
        };
      })
    );

    return NextResponse.json({
      competitions: competitionsWithCounts,
      total: competitions.length
    });

  } catch (error) {
    console.error('Competition fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create new competition
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request.headers.get('authorization'));
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      type = 'invite_only',
      organization_id,
      starting_balance = 100000,
      max_participants = 100,
      entry_fee = 0,
      prize_pool = 0,
      start_date,
      end_date,
      registration_deadline,
      ranking_criteria = 'total_pnl',
      allowed_instruments = ['stocks', 'options'],
      max_position_size = 100,
      day_trading_enabled = true,
      options_trading_enabled = true
    } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, start_date, end_date' 
      }, { status: 400 });
    }

    const supabase = createDatabaseClient();

    const { data: competition, error } = await supabase
      .from('competitions')
      .insert({
        name,
        description,
        creator_id: authResult.user.id,
        type,
        organization_id,
        starting_balance,
        max_participants,
        entry_fee,
        prize_pool,
        start_date,
        end_date,
        registration_deadline: registration_deadline || end_date,
        ranking_criteria,
        allowed_instruments,
        max_position_size,
        day_trading_enabled,
        options_trading_enabled
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating competition:', error);
      return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 });
    }

    return NextResponse.json({ competition }, { status: 201 });

  } catch (error) {
    console.error('Competition creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}