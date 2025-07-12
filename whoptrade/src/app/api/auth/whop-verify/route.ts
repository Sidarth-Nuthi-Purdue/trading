import { NextRequest, NextResponse } from 'next/server';
import { verifyWhopAuth } from '@/lib/whop-auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyWhopAuth(request);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        authenticated: false, 
        error: authResult.error 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      authenticated: true, 
      userId: authResult.userId 
    });

  } catch (error) {
    console.error('Error verifying Whop auth:', error);
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Authentication verification failed' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyWhopAuth(request);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        success: false, 
        error: authResult.error 
      }, { status: 401 });
    }

    // Here you could sync the Whop user with your Supabase database
    // For now, just return success
    return NextResponse.json({ 
      success: true, 
      userId: authResult.userId,
      message: 'Whop authentication successful'
    });

  } catch (error) {
    console.error('Error in Whop auth POST:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Authentication failed' 
    }, { status: 500 });
  }
}