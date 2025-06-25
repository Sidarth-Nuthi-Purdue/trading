// Environment variables helper for Alpaca API
export const ALPACA_API_KEY = process.env.ALPACA_API_KEY || process.env.NEXT_PUBLIC_ALPACA_PAPER_API_KEY || '';
export const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET || process.env.NEXT_PUBLIC_ALPACA_PAPER_API_SECRET || '';
export const ALPACA_API_BASE_URL = process.env.ALPACA_BASE_URL || process.env.NEXT_PUBLIC_ALPACA_API_BASE_URL || 'https://paper-api.alpaca.markets/v2';
export const ALPACA_DATA_BASE_URL = process.env.ALPACA_DATA_BASE_URL || process.env.NEXT_PUBLIC_ALPACA_DATA_BASE_URL || 'https://data.alpaca.markets';
export const ALPACA_PAPER = process.env.ALPACA_PAPER === 'true' || true; // Default to paper trading

// Environment variables helper for Supabase
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Application URLs
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Check if we're running in development mode
export const IS_DEV = process.env.NODE_ENV === 'development';

// Validate required environment variables
export function validateEnv() {
  const missingVars = [];
  
  if (!ALPACA_API_KEY) missingVars.push('ALPACA_API_KEY');
  if (!ALPACA_API_SECRET) missingVars.push('ALPACA_API_SECRET');
  if (!SUPABASE_URL) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  return true;
} 