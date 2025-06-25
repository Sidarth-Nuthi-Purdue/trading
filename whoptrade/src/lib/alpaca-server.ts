/**
 * Alpaca API Server-Side Utilities
 * This module provides server-side utilities for interacting with the Alpaca API.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { verifyUserToken } from '@whop/api';
import {
  ALPACA_API_KEY,
  ALPACA_API_SECRET,
  ALPACA_API_BASE_URL,
  ALPACA_DATA_BASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from '@/utils/env';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cookie option types
interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Validate that we have the necessary credentials
if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
  console.error('Missing Alpaca API credentials in environment variables');
}

// Helper function to get Alpaca API headers
export function getAlpacaHeaders() {
  return {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    'Content-Type': 'application/json'
  };
}

// Create a Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get the current session information from cookies and headers
 */
export async function getSession(req?: NextRequest) {
    const cookieStore = cookies();
    const headersList = headers();

    // First check for Whop authentication
    const whopAccessToken = (await cookieStore).get('whop_access_token')?.value;
    const whopDevUserToken = (await cookieStore).get('whop_dev_user_token')?.value;

    // Also check for Whop token in Authorization header (for API calls)
    const authHeader = (await headersList).get('Authorization');
    const whopTokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Check for dev token in X-Whop-Dev-User-Token header
    const devTokenHeader = (await headersList).get('X-Whop-Dev-User-Token');

    // Check URL for whop-dev-user-token parameter (for iframe contexts)
    const url = (await headersList).get('referer') || '';
    const urlParams = new URLSearchParams(url.split('?')[1] || '');
    const whopDevUserTokenParam = urlParams.get('whop-dev-user-token');

    // Determine which token to use
    const whopToken = whopAccessToken || whopTokenFromHeader;
    const devToken = whopDevUserToken || devTokenHeader || whopDevUserTokenParam;

    // Create a Supabase admin client
    const supabase = createClient(
        supabaseUrl,
        supabaseServiceKey,
    {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
      cookies: {
                get(name) {
                    const cookie = cookieStore.get(name);
                    return cookie?.value;
        },
                set(name, value, options) {
                    cookieStore.set(name, value, options);
        },
                remove(name, options) {
                    cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
  
    return {
        whopToken,
        devToken,
        supabase,
    };
}

/**
 * Get the Alpaca API client configuration
 */
export async function getAlpacaConfig() {
    return {
        baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets/v2',
        dataBaseUrl: process.env.ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets',
        apiKey: process.env.ALPACA_API_KEY,
        apiSecret: process.env.ALPACA_API_SECRET,
    };
}

/**
 * Make an authenticated request to the Alpaca API
 */
export async function fetchFromAlpaca(endpoint: string, options: RequestInit = {}) {
    const config = await getAlpacaConfig();
    
    const url = endpoint.startsWith('http') 
        ? endpoint 
        : `${config.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
    console.log(`Fetching from Alpaca: ${url}`);
    
    const headers = {
        'APCA-API-KEY-ID': config.apiKey!,
        'APCA-API-SECRET-KEY': config.apiSecret!,
        ...options.headers,
    };
    
    return fetch(url, {
    ...options,
        headers,
        cache: 'no-store',
    });
}

/**
 * Make an authenticated request to the Alpaca Data API
 */
export async function fetchFromAlpacaData(endpoint: string, options: RequestInit = {}) {
    const config = await getAlpacaConfig();
    
    const url = endpoint.startsWith('http') 
        ? endpoint 
        : `${config.dataBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    console.log(`Fetching from Alpaca Data: ${url}`);
    
    const headers = {
        'APCA-API-KEY-ID': config.apiKey!,
        'APCA-API-SECRET-KEY': config.apiSecret!,
        ...options.headers,
    };
    
    return fetch(url, {
        ...options,
        headers,
        cache: 'no-store',
    });
}

/**
 * Function to fetch latest quote for a symbol
 */
export async function fetchLatestQuote(symbol: string) {
    try {
        // Use the data API for quotes
        const response = await fetchFromAlpacaData(`/v2/stocks/${symbol}/quotes/latest`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch quote for ${symbol}: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.quote;
    } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

/**
 * Function to fetch latest quotes for multiple symbols
 */
export async function fetchLatestQuotes(symbols: string[]) {
    try {
        // Use the data API for quotes
        const response = await fetchFromAlpacaData(`/v2/stocks/quotes/latest?symbols=${symbols.join(',')}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch quotes: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.quotes;
    } catch (error) {
        console.error('Error fetching quotes:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

// Function to get account information
export async function getAccountInfo() {
  return fetchFromAlpaca('/account');
}

// Function to get positions
export async function getPositions() {
  return fetchFromAlpaca('/positions');
}

// Function to get orders
export async function getOrders(status = 'open') {
  return fetchFromAlpaca(`/orders?status=${status}`);
}

// Function to place a market order
export async function placeMarketOrder(
  symbol: string,
  qty: number,
  side: 'buy' | 'sell',
  type: 'market' | 'limit' = 'market',
  timeInForce: 'day' | 'gtc' | 'ioc' | 'opg' = 'day',
  limitPrice?: number
) {
  const orderData = {
    symbol,
    qty: qty.toString(),
    side,
    type,
    time_in_force: timeInForce,
    ...(type === 'limit' && limitPrice ? { limit_price: limitPrice.toString() } : {})
  };
  
  return fetchFromAlpaca('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
} 