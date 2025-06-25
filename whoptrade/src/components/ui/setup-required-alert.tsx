'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';

interface SetupRequiredAlertProps {
  error: string;
  details?: string;
}

export function SetupRequiredAlert({ error, details }: SetupRequiredAlertProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Database Setup Required</AlertTitle>
      <AlertDescription className="mt-2">
        <p>{error}</p>
        {details && <p className="mt-2 text-sm opacity-80">{details}</p>}
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/setup">Go to Setup Page</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
} 