/**
 * Environment configuration for the application
 */
import { z } from 'zod';

// Environment variables
/**
 * Validate environment variables
 */
const envSchema = z.object({
  WHOP_API_URL: z.string().default('https://api.whop.com'),
  WHOP_APP_ID: z.string(),
  WHOP_APP_SECRET: z.string(),
  WHOP_API_KEY: z.string(),
  NEXT_PUBLIC_WHOP_APP_URL: z.string().default('https://app.whop.com'),
  
  // Alpaca API credentials
  ALPACA_API_KEY: z.string().default('PKFN69V0XUS87FC3T9VL'),
  ALPACA_API_SECRET: z.string().default('vWfbFQrRN0XdKqHsOj67lkWHflODsjblPR93GosQ'),
  ALPACA_BASE_URL: z.string().default('https://paper-api.alpaca.markets'),
  ALPACA_DATA_BASE_URL: z.string().default('https://data.alpaca.markets'),
  
  // Alpaca Broker API credentials
  ALPACA_BROKER_API_KEY: z.string().default('CK90WR9J806KXZGQ63WU'),
  ALPACA_BROKER_API_SECRET: z.string().default('2Dx9BGbynRqNm31mDUfYW3rhjyOrWtg2a81baIAt'),
  ALPACA_BROKER_BASE_URL: z.string().default('https://broker-api.sandbox.alpaca.markets'),
  
  // Supabase credentials
  SUPABASE_URL: z.string().default('https://emscntnnljbgjrxeeolm.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtc2NudG5ubGpiZ2pyeGVlb2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1ODEzNzIsImV4cCI6MjA2NTE1NzM3Mn0.17rc_q2DR-PcDKYtTMzcw6DTTL8di-oHTv7V6ZuhNmM'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

/**
 * Parse environment variables with validation
 */
export const env = envSchema.parse({
  WHOP_API_URL: process.env.WHOP_API_URL,
  WHOP_APP_ID: process.env.WHOP_APP_ID,
  WHOP_APP_SECRET: process.env.WHOP_APP_SECRET,
  WHOP_API_KEY: process.env.WHOP_API_KEY,
  NEXT_PUBLIC_WHOP_APP_URL: process.env.NEXT_PUBLIC_WHOP_APP_URL,
  
  // Alpaca API
  ALPACA_API_KEY: process.env.ALPACA_API_KEY,
  ALPACA_API_SECRET: process.env.ALPACA_API_SECRET,
  ALPACA_BASE_URL: process.env.ALPACA_BASE_URL,
  ALPACA_DATA_BASE_URL: process.env.ALPACA_DATA_BASE_URL,
  
  // Alpaca Broker API
  ALPACA_BROKER_API_KEY: process.env.ALPACA_BROKER_API_KEY,
  ALPACA_BROKER_API_SECRET: process.env.ALPACA_BROKER_API_SECRET,
  ALPACA_BROKER_BASE_URL: process.env.ALPACA_BROKER_BASE_URL,
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// Features flags
export const envFeatures = {
  enableLiveTrading: false,
  enableCompetitions: true,
  enableLeaderboard: true,
  enableHistoricalTrading: true,
};

// Default values
export const envDefaults = {
  startingBalance: 10000,
  maxTradeAmount: 100000,
  minTradeAmount: 1,
};

// UI configuration
export const envUI = {
  chartTimeframes: ['1Min', '5Min', '15Min', '1H', '1D'],
  defaultTimeframe: '1D',
  defaultChart: {
    showVolume: true,
    showMA: true,
    maLength: 20,
  },
  orderTypes: ['market', 'limit', 'stop', 'stop_limit'],
  timeInForce: ['day', 'gtc', 'ioc', 'fok'],
};

// Environment variables helper file for server-side API routes

interface EnvVariables {
  NODE_ENV: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_WHOP_CLIENT_ID?: string;
  WHOP_CLIENT_SECRET?: string;
  NEXT_PUBLIC_WHOP_CALLBACK_URL?: string;
  ALPACA_API_KEY?: string;
  ALPACA_API_SECRET?: string;
  ALPACA_PAPER_API_KEY?: string;
  ALPACA_PAPER_API_SECRET?: string;
  DATABASE_URL?: string;
}

/**
 * Validates that required environment variables are present
 * @returns An object with all environment variables
 */
export function getEnv(): EnvVariables {
  // Create the environment object
  const env: EnvVariables = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_WHOP_CLIENT_ID: process.env.NEXT_PUBLIC_WHOP_CLIENT_ID,
    WHOP_CLIENT_SECRET: process.env.WHOP_CLIENT_SECRET,
    NEXT_PUBLIC_WHOP_CALLBACK_URL: process.env.NEXT_PUBLIC_WHOP_CALLBACK_URL,
    ALPACA_API_KEY: process.env.ALPACA_API_KEY,
    ALPACA_API_SECRET: process.env.ALPACA_API_SECRET,
    ALPACA_PAPER_API_KEY: process.env.ALPACA_PAPER_API_KEY,
    ALPACA_PAPER_API_SECRET: process.env.ALPACA_PAPER_API_SECRET,
    DATABASE_URL: process.env.DATABASE_URL
  };

  // Check if required variables exist
  const requiredVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missingVars = requiredVars.filter(name => !env[name as keyof EnvVariables]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // For development, show a warning about optional variables
  if (process.env.NODE_ENV === 'development') {
    const optionalVars = [
      'SUPABASE_SERVICE_ROLE_KEY', 
      'NEXT_PUBLIC_WHOP_CLIENT_ID', 
      'WHOP_CLIENT_SECRET',
      'NEXT_PUBLIC_WHOP_CALLBACK_URL',
      'ALPACA_API_KEY',
      'ALPACA_API_SECRET',
      'ALPACA_PAPER_API_KEY',
      'ALPACA_PAPER_API_SECRET'
    ];
    
    const missingOptionalVars = optionalVars.filter(name => !env[name as keyof EnvVariables]);
    
    if (missingOptionalVars.length > 0) {
      console.warn(`Warning: Missing optional environment variables: ${missingOptionalVars.join(', ')}`);
    }
  }
  
  return env;
}

// Export all environment variables
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_WHOP_CLIENT_ID: process.env.NEXT_PUBLIC_WHOP_CLIENT_ID,
  WHOP_CLIENT_SECRET: process.env.WHOP_CLIENT_SECRET,
  NEXT_PUBLIC_WHOP_CALLBACK_URL: process.env.NEXT_PUBLIC_WHOP_CALLBACK_URL,
  ALPACA_API_KEY: process.env.ALPACA_API_KEY,
  ALPACA_API_SECRET: process.env.ALPACA_API_SECRET,
  ALPACA_PAPER_API_KEY: process.env.ALPACA_PAPER_API_KEY,
  ALPACA_PAPER_API_SECRET: process.env.ALPACA_PAPER_API_SECRET,
  DATABASE_URL: process.env.DATABASE_URL
}; 