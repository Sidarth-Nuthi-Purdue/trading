import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Opt into dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // HTML content for diagnostic page
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhopTrade Auth Quick Fix</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      h1 { color: #2563eb; }
      h2 { color: #4b5563; margin-top: 20px; }
      pre {
        background-color: #f1f5f9;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
      }
      button {
        background-color: #2563eb;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        margin-right: 10px;
        margin-bottom: 10px;
      }
      button:hover {
        background-color: #1d4ed8;
      }
      .danger {
        background-color: #dc2626;
      }
      .danger:hover {
        background-color: #b91c1c;
      }
      .success {
        background-color: #10b981;
      }
      .success:hover {
        background-color: #059669;
      }
      .warning {
        background-color: #f59e0b;
      }
      .warning:hover {
        background-color: #d97706;
      }
      .result {
        padding: 15px;
        border-radius: 5px;
        margin-top: 20px;
        border: 1px solid #e5e7eb;
      }
      .success-message {
        background-color: #d1fae5;
        color: #065f46;
      }
      .error-message {
        background-color: #fee2e2;
        color: #b91c1c;
      }
      .warning-message {
        background-color: #fef3c7;
        color: #92400e;
      }
      .code-block {
        border: 1px solid #e5e7eb;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
      }
      .copy-button {
        background-color: #6b7280;
        font-size: 12px;
        padding: 5px 10px;
      }
    </style>
    <script>
      async function runFix(action) {
        const resultDiv = document.getElementById('result');
        resultDiv.className = 'result';
        resultDiv.innerHTML = '<p>Processing...</p>';
        
        try {
          const response = await fetch(\`/api/auth/\${action}\`);
          const data = await response.json();
          
          if (response.ok) {
            resultDiv.className = 'result success-message';
            resultDiv.innerHTML = \`<p>Success: \${data.message || JSON.stringify(data)}</p>\`;
          } else {
            resultDiv.className = 'result error-message';
            resultDiv.innerHTML = \`<p>Error: \${data.error || 'Unknown error'}</p>\`;
          }
        } catch (error) {
          resultDiv.className = 'result error-message';
          resultDiv.innerHTML = \`<p>Error: \${error.message}</p>\`;
        }
      }
      
      function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
          alert('SQL copied to clipboard');
        }).catch(err => {
          console.error('Failed to copy: ', err);
        });
      }
    </script>
  </head>
  <body>
    <h1>WhopTrade Authentication Quick Fix</h1>
    <p>This utility helps diagnose and fix authentication issues in the WhopTrade app.</p>
    
    <h2>Clear Authentication Cookies</h2>
    <p>This will clear all authentication-related cookies from your browser.</p>
    <button onclick="runFix('clear-cookies')">Clear Auth Cookies</button>
    
    <h2>Fix Authentication State</h2>
    <p>This will reset the authentication state and verify the database schema.</p>
    <button onclick="runFix('fix-auth')">Fix Auth State</button>
    
    <h2>Repair Database</h2>
    <p>This will fix common database issues by ensuring all required tables and triggers exist.</p>
    <button onclick="runFix('repair-db')">Repair Database</button>
    
    <h2>Manual Database Fixes</h2>
    <p>If the automated fixes don't work, you can run these SQL statements directly in your database:</p>
    
    <div class="code-block">
      <button class="copy-button" onclick="copyToClipboard(\`CREATE EXTENSION IF NOT EXISTS \\\"uuid-ossp\\\";
      
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_balance DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  portfolio_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  buying_power DECIMAL(15, 4) NOT NULL DEFAULT 20000.0000,
  total_deposits DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  total_withdrawals DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.virtual_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty DECIMAL(15, 4) NOT NULL,
  avg_entry_price DECIMAL(15, 4) NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  market_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  cost_basis DECIMAL(15, 4) NOT NULL,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  current_price DECIMAL(15, 4) DEFAULT 0.0000,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(account_id, symbol)
);

CREATE TABLE IF NOT EXISTS public.virtual_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty DECIMAL(15, 4) NOT NULL,
  filled_qty DECIMAL(15, 4) DEFAULT 0,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  type TEXT NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
  time_in_force TEXT NOT NULL CHECK (time_in_force IN ('day', 'gtc', 'ioc', 'fok')),
  limit_price DECIMAL(15, 4),
  stop_price DECIMAL(15, 4),
  status TEXT NOT NULL CHECK (status IN ('new', 'partially_filled', 'filled', 'done_for_day', 'canceled', 'expired', 'rejected')),
  filled_avg_price DECIMAL(15, 4),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  filled_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.virtual_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.virtual_orders(id),
  symbol TEXT,
  side TEXT CHECK (side IN ('buy', 'sell', 'deposit', 'withdrawal')),
  qty DECIMAL(15, 4),
  price DECIMAL(15, 4),
  amount DECIMAL(15, 4) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trade', 'deposit', 'withdrawal', 'fee', 'dividend', 'interest')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);\`)">Copy SQL</button>
      <pre>CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.virtual_trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_balance DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  portfolio_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  buying_power DECIMAL(15, 4) NOT NULL DEFAULT 20000.0000,
  total_deposits DECIMAL(15, 4) NOT NULL DEFAULT 10000.0000,
  total_withdrawals DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  realized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.virtual_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty DECIMAL(15, 4) NOT NULL,
  avg_entry_price DECIMAL(15, 4) NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  market_value DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  cost_basis DECIMAL(15, 4) NOT NULL,
  unrealized_pl DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  unrealized_pl_percent DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  current_price DECIMAL(15, 4) DEFAULT 0.0000,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(account_id, symbol)
);

CREATE TABLE IF NOT EXISTS public.virtual_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty DECIMAL(15, 4) NOT NULL,
  filled_qty DECIMAL(15, 4) DEFAULT 0,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  type TEXT NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
  time_in_force TEXT NOT NULL CHECK (time_in_force IN ('day', 'gtc', 'ioc', 'fok')),
  limit_price DECIMAL(15, 4),
  stop_price DECIMAL(15, 4),
  status TEXT NOT NULL CHECK (status IN ('new', 'partially_filled', 'filled', 'done_for_day', 'canceled', 'expired', 'rejected')),
  filled_avg_price DECIMAL(15, 4),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  filled_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.virtual_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.virtual_trading_accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.virtual_orders(id),
  symbol TEXT,
  side TEXT CHECK (side IN ('buy', 'sell', 'deposit', 'withdrawal')),
  qty DECIMAL(15, 4),
  price DECIMAL(15, 4),
  amount DECIMAL(15, 4) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trade', 'deposit', 'withdrawal', 'fee', 'dividend', 'interest')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);</pre>
    </div>
    
    <h2>Result</h2>
    <div id="result" class="result">
      <p>No actions performed yet.</p>
    </div>
    
    <h2>Next Steps</h2>
    <p>After applying fixes:</p>
    <ol>
      <li>Return to the <a href="/login">login page</a> and try signing in again</li>
      <li>If problems persist, use the <a href="/register">registration page</a> to create a new account</li>
      <li>Check the <a href="/api/auth/repair-db">database repair endpoint</a> for more detailed diagnostics</li>
    </ol>
  </body>
  </html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
} 