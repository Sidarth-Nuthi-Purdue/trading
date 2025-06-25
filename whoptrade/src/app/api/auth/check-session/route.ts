import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session error:', error.message);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get user data
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('User fetch error:', userError?.message || 'No user found');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    
    // Return user data (excluding sensitive information)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
        created_at: user.created_at
      },
      authenticated: true
    });
  } catch (error) {
    console.error('Check session error:', error);
    return NextResponse.json({ error: 'Failed to check authentication status' }, { status: 500 });
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
} 