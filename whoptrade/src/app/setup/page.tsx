'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Code } from "@/components/ui/code";

export default function SetupPage() {
  const [copiedSQL, setCopiedSQL] = useState(false);
  
  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-6">WhopTrade Setup</h1>
      <p className="text-xl mb-8">
        Follow these steps to set up your WhopTrade paper trading platform.
      </p>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="database">Database Setup</TabsTrigger>
          <TabsTrigger value="alpaca">Alpaca API</TabsTrigger>
          <TabsTrigger value="env">Environment Variables</TabsTrigger>
        </TabsList>

        {/* Database Setup Tab */}
        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle>Supabase Database Setup</CardTitle>
              <CardDescription>
                Configure your Supabase database with the required tables and security policies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">1. Log in to your Supabase project</h3>
                <p>Go to the Supabase dashboard and select your project.</p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">2. Open the SQL Editor</h3>
                <p>Navigate to the SQL Editor in the left sidebar.</p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">3. Create a new query</h3>
                <p>Click on "New Query" and paste the following SQL:</p>
                <div className="mt-2 bg-gray-900 rounded-md p-4 overflow-auto max-h-96">
                  <Code className="text-sm text-gray-200">
{`-- Supabase SQL Schema for WhopTrade Paper Trading Platform
-- This script creates the necessary tables and security policies for the application

-- Create trading_accounts table
CREATE TABLE IF NOT EXISTS public.trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alpaca_account_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(alpaca_account_id)
);

-- Add comment to trading_accounts table
COMMENT ON TABLE public.trading_accounts IS 'Stores Alpaca paper trading accounts linked to user accounts';

-- Create users table (public profile info)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to users table
COMMENT ON TABLE public.users IS 'Public user profiles';

-- Create user trigger function to automatically add users to public.users table
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS (Row Level Security) Policies

-- Enable RLS on tables
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Trading accounts policies
CREATE POLICY "Users can view their own trading accounts"
  ON public.trading_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trading accounts"
  ON public.trading_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trading accounts"
  ON public.trading_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- User profile policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Grant privileges to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.trading_accounts TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;`}
                  </Code>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">4. Run the query</h3>
                <p>Click the "Run" button to execute the SQL and set up your database.</p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500">
                This script creates the necessary tables with Row Level Security (RLS) to ensure data privacy.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Alpaca API Tab */}
        <TabsContent value="alpaca">
          <Card>
            <CardHeader>
              <CardTitle>Alpaca Broker API Setup</CardTitle>
              <CardDescription>
                Configure your connection to the Alpaca Broker API for paper trading.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">1. Create an Alpaca account</h3>
                <p>
                  Sign up for an Alpaca Broker API account at{" "}
                  <a 
                    href="https://alpaca.markets/broker" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    alpaca.markets/broker
                  </a>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">2. Generate API keys</h3>
                <p>Once logged in, navigate to the Dashboard and create a new API key for paper trading.</p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">3. Set environment variables</h3>
                <p>Add your Alpaca API keys to your environment variables (see Environment Variables tab).</p>
              </div>

              <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-md">
                <h3 className="text-lg font-medium mb-2">Default Configuration</h3>
                <p>
                  For development and testing, the application uses default sandbox API keys.
                  For production, you should replace these with your own Alpaca Broker API keys.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500">
                Alpaca provides a sandbox environment for paper trading with simulated market data.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Environment Variables Tab */}
        <TabsContent value="env">
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                Set up your environment variables for WhopTrade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Required Environment Variables</h3>
                <p>Create a <code>.env.local</code> file in the project root with the following variables:</p>
                <div className="mt-2 bg-gray-900 rounded-md p-4">
                  <Code className="text-sm text-gray-200">
{`# Supabase Connection
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Alpaca Broker API (Paper Trading)
ALPACA_BROKER_API_KEY=your-alpaca-broker-api-key
ALPACA_BROKER_API_SECRET=your-alpaca-broker-api-secret

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000`}
                  </Code>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Supabase Environment Variables</h3>
                <p>
                  Get your Supabase URL and anon key from your Supabase project settings under "API" → "Project API Keys".
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Alpaca API Environment Variables</h3>
                <p>
                  Get your Alpaca Broker API keys from your Alpaca dashboard after setting up your account.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500">
                Restart your development server after updating the environment variables.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-center">
        <Link href="/dashboard/trading" passHref>
          <Button size="lg">
            Continue to Trading Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

const sqlScript = `-- Create trading_accounts table to link Supabase users with Alpaca accounts
CREATE TABLE IF NOT EXISTS public.trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alpaca_account_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Add a unique constraint on user_id to ensure one trading account per user
  CONSTRAINT trading_accounts_user_id_key UNIQUE (user_id),
  
  -- Add a unique constraint on alpaca_account_id to ensure each Alpaca account is linked to only one user
  CONSTRAINT trading_accounts_alpaca_account_id_key UNIQUE (alpaca_account_id)
);

-- Enable Row Level Security
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own trading accounts
CREATE POLICY trading_accounts_select_policy ON public.trading_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert only their own trading accounts
CREATE POLICY trading_accounts_insert_policy ON public.trading_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update only their own trading accounts
CREATE POLICY trading_accounts_update_policy ON public.trading_accounts
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete only their own trading accounts
CREATE POLICY trading_accounts_delete_policy ON public.trading_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically add user metadata to auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a users table to store additional user information
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  alpaca_account_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own user data
CREATE POLICY users_select_policy ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Create policy to allow users to update only their own user data
CREATE POLICY users_update_policy ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- Create an index on alpaca_account_id for faster lookups
CREATE INDEX IF NOT EXISTS users_alpaca_account_id_idx ON public.users (alpaca_account_id);

-- Create a trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 