import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET(request: Request) {
  // Parse the URL to get the "next" parameter (where to redirect after login)
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/dashboard";

  // Create the OAuth URL
  const oAuthUrl = new URL("https://whop.com/oauth/");

  // Set the required OAuth parameters
  oAuthUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_WHOP_CLIENT_ID || '');
  oAuthUrl.searchParams.set("redirect_uri", "http://localhost:3000/api/oauth/callback");
  oAuthUrl.searchParams.set("response_type", "code");
  oAuthUrl.searchParams.set("scope", "read_user");

  // Generate a random state to prevent CSRF attacks
  const state = randomUUID();
  oAuthUrl.searchParams.set("state", state);

  // Create the response that redirects to the OAuth URL
  const response = NextResponse.redirect(oAuthUrl.toString());
  
  // Set cookies to store the state and redirect URL
  response.cookies.set("oauth-state", state, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 3600 // 1 hour
  });
  
  response.cookies.set("oauth-redirect", next, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 3600 // 1 hour
  });

  return response;
} 