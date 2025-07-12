import { NextRequest } from 'next/server';
import { verifyUserToken } from '@whop/api';

export interface WhopAuthResult {
  authenticated: boolean;
  userId: string | null;
  error: string | null;
}

/**
 * Verify Whop user authentication using the proper SDK
 */
export async function verifyWhopAuth(request: NextRequest): Promise<WhopAuthResult> {
  try {
    // Use Whop's built-in token verification
    const { userId } = await verifyUserToken(request.headers);
    
    if (!userId) {
      return {
        authenticated: false,
        userId: null,
        error: 'No valid user token'
      };
    }

    return {
      authenticated: true,
      userId,
      error: null
    };
    
  } catch (error) {
    console.error('Whop authentication error:', error);
    return {
      authenticated: false,
      userId: null,
      error: 'Authentication failed'
    };
  }
}

/**
 * Verify Whop user authentication for server components
 */
export async function verifyWhopAuthServer(headers: Headers): Promise<WhopAuthResult> {
  try {
    const { userId } = await verifyUserToken(headers);
    
    if (!userId) {
      return {
        authenticated: false,
        userId: null,
        error: 'No valid user token'
      };
    }

    return {
      authenticated: true,
      userId,
      error: null
    };
    
  } catch (error) {
    console.error('Whop authentication error:', error);
    return {
      authenticated: false,
      userId: null,
      error: 'Authentication failed'
    };
  }
}