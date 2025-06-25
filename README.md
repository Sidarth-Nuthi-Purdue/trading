Installation guide:

'cd whoptrade'
'npm install'
'npm run whop-proxy'

Credentials:

1. Create .env.local file and place it in the root of your project

# Environment Variables for Whop Trade

# Alpaca API credentials (Paper Trading)
ALPACA_BASE_URL=
ALPACA_DATA_BASE_URL=
ALPACA_API_KEY=
ALPACA_API_SECRET=

# Next.js public environment variables for client-side
NEXT_PUBLIC_ALPACA_PAPER_API_KEY
NEXT_PUBLIC_ALPACA_PAPER_API_SECRET=
NEXT_PUBLIC_ALPACA_API_BASE_URL=
NEXT_PUBLIC_ALPACA_DATA_BASE_URL=

# Finnhub API for market data (use alpaca market api data if needed)
FINNHUB_API_KEY=
NEXT_PUBLIC_FINNHUB_API_KEY=

# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

DATABASE_URL=

# Whop Integration
WHOP_API_KEY=
NEXT_PUBLIC_WHOP_APP_ID=

# Other Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Next.js environment
NODE_ENV="development" 

NEXT_PUBLIC_WHOP_CALLBACK_URL=http://localhost:3000/api/oauth/callback

# Whop configuration
NEXT_PUBLIC_WHOP_CLIENT_ID=
WHOP_CLIENT_SECRET=

