import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      );
    }
    
    // Read the SQL schema file
    const schemaPath = path.join(process.cwd(), 'virtual-trading-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Initialize Supabase client with admin privileges
    const supabase = createServerSupabaseClient();
    
    // Execute the SQL schema directly
    const { data, error } = await supabase.rpc('exec_sql', { sql: schema });
    
    if (error) {
      console.error('Error applying schema:', error);
      return NextResponse.json(
        { error: 'Failed to apply schema', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Virtual trading schema applied successfully',
      tables: [
        'virtual_trading_accounts',
        'virtual_positions', 
        'virtual_orders', 
        'virtual_transactions'
      ]
    });
  } catch (error: any) {
    console.error('Schema application error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
} 