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

  // Get cookies using the state-based approach
  const cookies = request.headers.get("Cookie") || "";
  const stateCookieName = `oauth-state.${state}`;
  const stateCookie = cookies
    .split(";")
    .find(cookie => cookie.trim().startsWith(`${stateCookieName}=`));

  if (!stateCookie) {
    console.error('No state cookie found for state:', state);
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  // Extract the redirect URL from the cookie value
  const redirectUrl = decodeURIComponent(stateCookie.split("=")[1]);

  try {
    // Exchange the code for a token using Whop's API
    console.log('Attempting token exchange with:', {
      client_id: process.env.NEXT_PUBLIC_WHOP_APP_ID,
      redirect_uri: process.env.NEXT_PUBLIC_WHOP_CALLBACK_URL,
      code: code ? code.substring(0, 10) + '...' : 'missing'
    });

    // Try different OAuth token exchange approaches for Whop
    let response;
    
    // First try: Standard OAuth with form-encoded data
    response = await fetch("https://api.whop.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_WHOP_APP_ID!,
        client_secret: process.env.WHOP_API_KEY!,
        code: code!,
        grant_type: "authorization_code",
        redirect_uri: process.env.NEXT_PUBLIC_WHOP_CALLBACK_URL!,
      }).toString(),
    });

    // If that fails, try with Bearer auth
    if (!response.ok) {
      console.log('First attempt failed, trying with Bearer auth...');
      response = await fetch("https://api.whop.com/v5/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.WHOP_API_KEY}`,
        },
        body: JSON.stringify({
          client_id: process.env.NEXT_PUBLIC_WHOP_APP_ID,
          code: code,
          redirect_uri: process.env.NEXT_PUBLIC_WHOP_CALLBACK_URL,
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Whop OAuth token error:", errorData);
      
      // If OAuth fails with invalid_client, redirect to fallback auth
      if (errorData.error === 'invalid_client') {
        console.log('OAuth not enabled for this app, redirecting to fallback auth');
        return NextResponse.redirect(new URL("/auth/whop-fallback?error=oauth_not_enabled", request.url));
      }
      
      return NextResponse.redirect(new URL("/login?error=token_exchange_failed", request.url));
    }

    const responseData = await response.json();
    const access_token = responseData.access_token || responseData.tokens?.access_token;
    
    if (!access_token) {
      console.error("No access token in response:", responseData);
      return NextResponse.redirect(new URL("/login?error=no_access_token", request.url));
    }
    
    const nextUrl = redirectUrl || "/dashboard";

    // Create response with CORS headers if needed
    const redirectResponse = NextResponse.redirect(new URL(nextUrl, request.url));
    
    // Set cookie with the access token
    redirectResponse.cookies.set("whop_access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600,
      path: "/"
    });
    
    // Clear the state cookie since it's no longer needed
    redirectResponse.cookies.set(stateCookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
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
