import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createServerSupabaseClient();
    
    // Sign out the user with proper error handling
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        return NextResponse.json(
          { error: 'Logout failed', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ message: 'Logged out successfully' });
    } catch (signOutError) {
      console.error('Error during sign out:', signOutError);
      return NextResponse.json(
        { error: 'Logout failed', details: signOutError instanceof Error ? signOutError.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during logout' },
      { status: 500 }
    );
  }
} 