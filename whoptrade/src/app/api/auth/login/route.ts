import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { email, password } = await req.json();
    
    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Initialize Supabase client
    const supabase = createServerSupabaseClient();
    
    // Attempt to sign in with proper error handling
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      // Create response with appropriate headers for iframe context
      const response = NextResponse.json({
        user: data.user,
        session: data.session,
      });
      
      // Set necessary headers for cross-site cookies
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
      
      return response;
    } catch (signInError) {
      console.error('Error during sign in:', signInError);
      return NextResponse.json(
        { error: 'Authentication failed', details: signInError instanceof Error ? signInError.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
} 