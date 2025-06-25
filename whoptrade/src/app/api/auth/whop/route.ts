import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import config from '../../../../../whop.config.js';

// Handle GET requests (OAuth initialization or redirect)
export async function GET(req: NextRequest) {
  // For backward compatibility - redirect to the new OAuth callback endpoint
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  console.log('Redirecting from legacy /api/auth/whop endpoint to new /api/oauth/callback endpoint');
  
  // Construct the new URL
  const newCallbackUrl = new URL('/api/oauth/callback', req.url);
  if (code) newCallbackUrl.searchParams.set('code', code);
  if (state) newCallbackUrl.searchParams.set('state', state);
  
  return NextResponse.redirect(newCallbackUrl);
}

// Handle POST requests (not typically needed for OAuth flow)
export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 