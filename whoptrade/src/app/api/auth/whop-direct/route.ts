import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { whopToken } = await request.json();
    
    if (!whopToken) {
      return NextResponse.json({ error: 'Whop token required' }, { status: 400 });
    }

    // Verify the Whop token by calling Whop's API
    const response = await fetch('https://api.whop.com/v5/me', {
      headers: {
        'Authorization': `Bearer ${whopToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Whop token verification failed:', response.status);
      return NextResponse.json({ error: 'Invalid Whop token' }, { status: 401 });
    }

    const whopUser = await response.json();
    
    // Create response with user data
    const successResponse = NextResponse.json({ 
      success: true, 
      user: whopUser 
    });

    // Set HTTP-only cookie with the Whop token
    successResponse.cookies.set('whop_access_token', whopToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    return successResponse;

  } catch (error) {
    console.error('Error in Whop direct auth:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if user has a valid Whop token in cookies
    const whopToken = request.cookies.get('whop_access_token')?.value;
    
    if (!whopToken) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // Verify the token
    const response = await fetch('https://api.whop.com/v5/me', {
      headers: {
        'Authorization': `Bearer ${whopToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Token is invalid, clear the cookie
      const errorResponse = NextResponse.json({ authenticated: false }, { status: 200 });
      errorResponse.cookies.set('whop_access_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      });
      return errorResponse;
    }

    const whopUser = await response.json();
    return NextResponse.json({ 
      authenticated: true, 
      user: whopUser 
    });

  } catch (error) {
    console.error('Error checking Whop auth:', error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}