import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch competitions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const creatorOnly = searchParams.get('creator_only') === 'true';

    let query = supabase
      .from('competitions')
      .select(`
        *,
        competition_participants(
          id,
          user_id,
          total_pnl,
          rank,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (creatorOnly) {
      query = query.eq('creator_id', session.user.id);
    }

    const { data: competitions, error } = await query;

    if (error) {
      console.error('Error fetching competitions:', error);
      return NextResponse.json({ error: 'Failed to fetch competitions' }, { status: 500 });
    }

    // Add participant count info
    const enrichedCompetitions = competitions?.map(comp => ({
      ...comp,
      participant_count: comp.competition_participants?.length || 0,
      is_participating: comp.competition_participants?.some(
        (p: any) => p.user_id === session.user.id && p.status === 'active'
      ) || false
    }));

    return NextResponse.json({ competitions: enrichedCompetitions });
  } catch (error) {
    console.error('Error in competitions GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create a new competition (Creator only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      start_date,
      end_date,
      prize_amount,
      prize_currency = 'USD',
      max_participants,
      entry_fee = 0,
      rules
    } = body;

    // Validate required fields
    if (!name || !start_date || !end_date || !prize_amount) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, start_date, end_date, prize_amount' 
      }, { status: 400 });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const now = new Date();

    if (startDate <= now) {
      return NextResponse.json({ 
        error: 'Start date must be in the future' 
      }, { status: 400 });
    }

    if (endDate <= startDate) {
      return NextResponse.json({ 
        error: 'End date must be after start date' 
      }, { status: 400 });
    }

    // Determine status based on dates
    let status = 'upcoming';
    if (startDate <= now && endDate > now) {
      status = 'active';
    } else if (endDate <= now) {
      status = 'completed';
    }

    const { data: competition, error } = await supabase
      .from('competitions')
      .insert({
        creator_id: session.user.id,
        name,
        description,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        prize_amount: parseFloat(prize_amount),
        prize_currency,
        status,
        max_participants: max_participants ? parseInt(max_participants) : null,
        entry_fee: parseFloat(entry_fee),
        rules: rules || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating competition:', error);
      return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 });
    }

    return NextResponse.json({ competition }, { status: 201 });
  } catch (error) {
    console.error('Error in competitions POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}