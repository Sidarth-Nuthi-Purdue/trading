import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Opt into dynamic rendering to resolve the static analysis error with cookies()
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { email, password, username } = await request.json();
    
    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Create a Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Register the user
    console.log("Signing up user with email:", email);
    
    // Use the public signUp method
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0]
        }
      }
    });
    
    if (error) {
      console.error("Supabase signup error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    // Check if we actually got a user back
    if (!data?.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
    
    // Success - return the user data
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: username || email.split('@')[0]
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
} 