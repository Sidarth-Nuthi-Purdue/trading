import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check if tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_balances', 'trade_orders', 'user_portfolios']);

    if (tablesError) {
      console.error('Error checking tables:', tablesError);
      return NextResponse.json({ 
        error: 'Failed to check database tables', 
        details: tablesError.message 
      }, { status: 500 });
    }

    const existingTables = tables?.map(t => t.table_name) || [];
    const requiredTables = ['user_balances', 'trade_orders', 'user_portfolios'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      return NextResponse.json({
        status: 'missing_tables',
        existing_tables: existingTables,
        missing_tables: missingTables,
        message: 'Some required tables are missing. Please run the database schema setup.'
      });
    }

    return NextResponse.json({
      status: 'ready',
      existing_tables: existingTables,
      message: 'All required tables exist.'
    });

  } catch (error) {
    console.error('Database setup check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}