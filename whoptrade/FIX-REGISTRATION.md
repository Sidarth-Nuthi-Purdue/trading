# Fix Registration Error

## The Problem
You're seeing: "Registration failed: AuthApiError: Database error saving new user"

## Quick Fix Steps

1. **Go to Supabase Dashboard**
   - Open [Supabase](https://app.supabase.com)
   - Select your project

2. **Run SQL Commands**
   - Go to SQL Editor
   - Run this SQL:

```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create virtual trading accounts
CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(user_id)
);
```

3. **Update Environment Variables**
   - Check `.env.local` file
   - Make sure it has:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. **Restart Server**
   - Run `npm run dev`

5. **Test Registration**
   - Try registering again
   - If successful, users will have $10,000 trading balance

## Need More Help?
Check `README-REGISTRATION-FIX.md` for detailed instructions. 