import { NextResponse } from 'next/server';

// Define allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://whop.com',
  'https://aknm85dzxutr9tpxryi2.apps.whop.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:65130'
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const whopDevUserToken = url.searchParams.get("whop-dev-user-token");

  // Get the origin from the request headers
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  
  // Determine if the request is from an allowed origin
  const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => 
    origin.includes(allowed) || referer.includes(allowed)
  );

  console.log(`Request from origin: ${origin}, referer: ${referer}`);
  console.log(`Is allowed origin: ${isAllowedOrigin}`);

  // If there's a whop-dev-user-token, the user is already authenticated via Whop's iframe
  if (whopDevUserToken) {
    console.log("User already authenticated via Whop iframe");
    
    // Create the response
    const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
    
    // Set cookie for the token - with relaxed settings for dev
    redirectResponse.cookies.set("whop_dev_user_token", whopDevUserToken, {
      httpOnly: true,
      secure: false, // Set to false for local development
      sameSite: "lax", // Changed from none to lax for local development
      maxAge: 3600,
      path: "/"
    });
    
    // Add CORS headers
    if (isAllowedOrigin) {
      redirectResponse.headers.set('Access-Control-Allow-Origin', origin);
      redirectResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      redirectResponse.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    
    return redirectResponse;
  }

  // Standard OAuth flow begins here
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  if (!state) {
    return NextResponse.redirect(new URL("/login?error=missing_state", request.url));
  }

  // Get cookies
  const cookies = request.headers.get("Cookie") || "";
  const cookieState = getCookieValue(cookies, "oauth-state");
  const redirectUrl = getCookieValue(cookies, "oauth-redirect");

  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  try {
    // Exchange the code for a token
    const response = await fetch("https://api.whop.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_WHOP_CLIENT_ID,
        client_secret: process.env.WHOP_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.NEXT_PUBLIC_WHOP_CALLBACK_URL,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Whop OAuth token error:", errorData);
      return NextResponse.redirect(new URL("/login?error=token_exchange_failed", request.url));
    }

    const { access_token } = await response.json();
    const nextUrl = redirectUrl ? decodeURIComponent(redirectUrl) : "/dashboard";

    // Create response with CORS headers if needed
    const redirectResponse = NextResponse.redirect(new URL(nextUrl, request.url));
    
    // Set cookie with more permissive settings for local development
    redirectResponse.cookies.set("whop_access_token", access_token, {
      httpOnly: true,
      secure: false, // Set to false for local development
      sameSite: "lax", // Changed from none to lax for local development
      maxAge: 3600,
      path: "/"
    });
    
    // Add CORS headers
    if (isAllowedOrigin) {
      redirectResponse.headers.set('Access-Control-Allow-Origin', origin);
      redirectResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      redirectResponse.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }

    return redirectResponse;
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}

// Helper function to get cookie value
function getCookieValue(cookies: string, name: string): string | null {
  const match = cookies.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin') || '';
  
  // Check if the origin is allowed
  const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => origin.includes(allowed));
  
  // Create response with appropriate CORS headers
  const response = new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
  
  return response;
}
