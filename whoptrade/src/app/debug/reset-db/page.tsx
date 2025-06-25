'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

export default function ResetDbPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [isCreatingSchema, setIsCreatingSchema] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();

  const resetUserAccount = async () => {
    try {
      setIsResetting(true);
      setResult(null);
      
      const response = await fetch('/api/reset-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'reset_user_account' })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset account');
      }
      
      setResult(JSON.stringify(data, null, 2));
      
      toast({
        title: 'Account Reset Successful',
        description: 'Your trading account has been reset to initial state.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error resetting account:', error);
      
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
      
      setResult(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsResetting(false);
    }
  };
  
  const initializeSchema = async () => {
    try {
      setIsCreatingSchema(true);
      setResult(null);
      
      const response = await fetch('/api/reset-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'initialize_schema' })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize schema');
      }
      
      setResult(JSON.stringify(data, null, 2));
      
      toast({
        title: 'Schema Initialized Successfully',
        description: 'The database schema has been created and sample data loaded.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error initializing schema:', error);
      
      toast({
        title: 'Initialization Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
      
      setResult(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsCreatingSchema(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Database Management Tools</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reset Account</CardTitle>
            <CardDescription>
              Reset your trading account to initial state with $10,000 cash balance and $20,000 buying power.
              This will delete all your positions, orders, and transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-500 mb-4">
              ⚠️ Warning: This action cannot be undone. All your trading history will be deleted.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={resetUserAccount} 
              disabled={isResetting}
              variant="destructive"
            >
              {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isResetting ? 'Resetting...' : 'Reset My Account'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Initialize Schema</CardTitle>
            <CardDescription>
              Completely rebuild the database schema and install all functions.
              This will create or recreate all necessary tables and functions for paper trading.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-500 mb-4">
              ⚠️ Warning: This is a global operation that affects all users. Only use if the database is corrupted.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={initializeSchema} 
              disabled={isCreatingSchema}
              variant="destructive"
            >
              {isCreatingSchema && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingSchema ? 'Initializing...' : 'Initialize Schema'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          <pre className="bg-slate-100 p-4 rounded-md overflow-auto max-h-[400px]">
            {result}
          </pre>
        </div>
      )}
      
      <div className="mt-8">
        <Link href="/dashboard/trading" className="text-blue-600 hover:underline">
          Return to Trading Dashboard
        </Link>
      </div>
    </div>
  );
} 