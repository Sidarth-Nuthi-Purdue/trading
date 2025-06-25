import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.CREATOR_JWT_SECRET || 'creator-secret-key-change-in-production';

interface CreatorTokenPayload {
  id: string;
  email: string;
  username: string;
  company_id: string;
  role: string;
  iat?: number;
  exp?: number;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('creator_token')?.value;

    if (!token) {
      return NextResponse.json({ 
        error: 'No authentication token found' 
      }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as CreatorTokenPayload;
      
      return NextResponse.json({
        authenticated: true,
        user: {
          id: decoded.id,
          email: decoded.email,
          username: decoded.username,
          company_id: decoded.company_id,
          role: decoded.role
        }
      });

    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      
      // Clear invalid token
      cookieStore.set('creator_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0
      });

      return NextResponse.json({ 
        error: 'Invalid or expired token' 
      }, { status: 401 });
    }

  } catch (error) {
    console.error('Creator auth verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}