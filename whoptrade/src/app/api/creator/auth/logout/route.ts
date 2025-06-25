import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    // Clear the creator token cookie
    cookieStore.set('creator_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    });

    return NextResponse.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Creator logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}