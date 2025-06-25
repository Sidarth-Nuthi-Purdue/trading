import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.CREATOR_JWT_SECRET || 'creator-secret-key-change-in-production';

// Hardcoded creator accounts (in production, this would be in a database)
const CREATOR_ACCOUNTS = [
  {
    id: 'creator_1',
    email: 'admin@whoptrade.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    username: 'admin',
    first_name: 'Admin',
    last_name: 'User',
    company_id: 'whoptrade_main',
    company_name: 'WhopTrade',
    role: 'creator'
  },
  {
    id: 'creator_2',
    email: 'creator@example.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    username: 'creator_demo',
    first_name: 'Demo',
    last_name: 'Creator',
    company_id: 'demo_company',
    company_name: 'Demo Trading Co.',
    role: 'creator'
  }
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ 
        error: 'Email and password are required' 
      }, { status: 400 });
    }

    // Find creator account
    const creator = CREATOR_ACCOUNTS.find(account => account.email === email);
    
    if (!creator) {
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, creator.password);
    
    if (!isValidPassword) {
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: creator.id,
        email: creator.email,
        username: creator.username,
        company_id: creator.company_id,
        role: creator.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    const cookieStore = cookies();
    cookieStore.set('creator_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: creator.id,
        email: creator.email,
        username: creator.username,
        first_name: creator.first_name,
        last_name: creator.last_name,
        company_id: creator.company_id,
        company_name: creator.company_name,
        role: creator.role
      }
    });

  } catch (error) {
    console.error('Creator login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}