import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extract the token from the request
    const whopDevUserToken = request.nextUrl.searchParams.get('whop-dev-user-token');
    const experienceId = request.nextUrl.searchParams.get('experienceId');
    
    // In a real implementation, you would validate the token with Whop's API
    // and fetch the appropriate data based on the experience ID
    
    if (!whopDevUserToken) {
      return NextResponse.json(
        { error: 'Missing whop-dev-user-token parameter' },
        { status: 400 }
      );
    }
    
    // Log the token for debugging (remove in production)
    console.log('Received token in API:', whopDevUserToken.substring(0, 20) + '...');
    
    // Return mock experience data
    return NextResponse.json({
      success: true,
      experienceId: experienceId || 'unknown',
      data: {
        name: `Experience ${experienceId || 'Default'}`,
        description: 'This is a dynamically loaded experience from the API',
        timestamp: new Date().toISOString()
      },
      tokenReceived: true
    });
    
  } catch (error) {
    console.error('Error in experiences API:', error);
    return NextResponse.json(
      { error: 'Failed to process experience request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { token, experienceId, action } = body;
    
    // Validate required fields
    if (!token || !experienceId) {
      return NextResponse.json(
        { error: 'Missing required fields (token, experienceId)' },
        { status: 400 }
      );
    }
    
    // In a real implementation, you would validate the token with Whop's API
    // and perform actions based on the experience ID and requested action
    
    // Return success response
    return NextResponse.json({
      success: true,
      experienceId,
      action: action || 'default',
      processed: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in experiences API (POST):', error);
    return NextResponse.json(
      { error: 'Failed to process experience action request' },
      { status: 500 }
    );
  }
} 