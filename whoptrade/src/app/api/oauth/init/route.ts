import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Parse the URL to get the "next" parameter (where to redirect after login)
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/dashboard-whop";

  // Since OAuth is not working, redirect to the Whop-authenticated dashboard
  // The Whop SDK will handle authentication automatically when the app is loaded in Whop iframe
  console.log('Redirecting to Whop dashboard:', next);
  
  return NextResponse.redirect(new URL(next, request.url));
} 