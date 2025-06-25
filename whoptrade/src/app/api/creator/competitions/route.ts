import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Development mode - return empty competitions array
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return NextResponse.json([]);
    }
    
    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator and get their company
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role, company_id, company_name')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'creator') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const creatorCompanyId = userProfile.company_id;

    // Get competitions created by creators from the same company
    let query = supabase
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
      `);

    // If creator has a company, filter by company creators
    if (creatorCompanyId) {
      // Get all creator IDs from the same company
      const { data: companyCreators } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('company_id', creatorCompanyId)
        .eq('role', 'creator');

      const creatorIds = companyCreators?.map(creator => creator.user_id) || [session.user.id];
      query = query.in('creator_id', creatorIds);
    } else {
      // If no company, only show current creator's competitions
      query = query.eq('creator_id', session.user.id);
    }

    const { data: competitions, error: competitionsError } = await query;

    if (competitionsError) {
      console.error('Error fetching competitions:', competitionsError);
      return NextResponse.json({ error: 'Failed to fetch competitions' }, { status: 500 });
    }

    // Get participant counts for each competition
    const competitionIds = competitions?.map(comp => comp.id) || [];
    let participantCounts: any[] = [];
    
    if (competitionIds.length > 0) {
      const { data: counts } = await supabase
        .from('competition_participants')
        .select('competition_id, status')
        .in('competition_id', competitionIds);
      
      participantCounts = counts || [];
    }

    // Count participants for each competition
    const participantCountMap = new Map();
    participantCounts?.forEach(participant => {
      const compId = participant.competition_id;
      if (!participantCountMap.has(compId)) {
        participantCountMap.set(compId, 0);
      }
      if (participant.status === 'active') {
        participantCountMap.set(compId, participantCountMap.get(compId) + 1);
      }
    });

    // Format the response
    const formattedCompetitions = competitions?.map(comp => ({
      ...comp,
      participant_count: participantCountMap.get(comp.id) || 0,
      is_participating: false,
      prize_pool: comp.prize_amount // Add prize_pool for backward compatibility
    })) || [];

    return NextResponse.json(formattedCompetitions);

  } catch (error) {
    console.error('Error in /api/creator/competitions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Development mode - return error instead of mock data
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return NextResponse.json({ error: 'Development mode - competition creation disabled' }, { status: 400 });
    }
    
    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a creator
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, company_id, company_name')
      .eq('user_id', session.user.id)
      .single();

    if (profileError || profile?.role !== 'creator') {
      return NextResponse.json({ error: 'Forbidden - Creator access required' }, { status: 403 });
    }

    const {
      name,
      description,
      start_date,
      end_date,
      prize_amount,
      prize_currency = 'USD',
      max_participants,
      entry_fee = 0,
      prize_distribution = []
    } = await request.json();

    // Validate required fields
    if (!name || !start_date || !end_date || prize_amount === undefined) {
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

    // Determine competition status
    let status = 'upcoming';
    if (startDate <= now && endDate > now) {
      status = 'active';
    } else if (endDate <= now) {
      status = 'completed';
    }

    // Create competition
    const { data: competition, error: createError } = await supabase
      .from('competitions')
      .insert({
        creator_id: session.user.id,
        name,
        description,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        prize_amount: Number(prize_amount),
        prize_currency,
        status,
        max_participants: max_participants ? Number(max_participants) : null,
        entry_fee: Number(entry_fee),
        rules: {
          allow_short_selling: true,
          max_position_size: 10000,
          trading_hours: {
            start: '09:30',
            end: '16:00',
            timezone: 'America/New_York'
          },
          prize_distribution: prize_distribution.length > 0 ? prize_distribution : [
            { position: 1, amount: prize_amount, percentage: 100 }
          ],
          company_id: profile.company_id, // Associate competition with creator's company
          company_name: profile.company_name
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating competition:', createError);
      return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Competition created successfully',
      competition: {
        ...competition,
        participant_count: 0,
        is_participating: false,
        prize_pool: competition.prize_amount
      }
    });

  } catch (error) {
    console.error('Error in /api/creator/competitions POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}