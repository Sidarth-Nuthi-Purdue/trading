'use client';

import React, { useState } from 'react';
import { RefreshCw, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PnLRecalculatorProps {
  onComplete?: () => void;
}

export default function PnLRecalculator({ onComplete }: PnLRecalculatorProps = {}) {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/creator/recalculate-pnl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        if (onComplete) {
          onComplete();
        }
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to recalculate P&L');
      }
    } catch (error) {
      console.error('Error recalculating P&L:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Calculator className="h-5 w-5" />
          <span>P&L Recalculation</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-gray-400 text-sm">
          <p>
            Recalculate profit and loss values for all users based on their trading history. 
            This will update realized P&L, unrealized P&L, and portfolio positions.
          </p>
        </div>

        {error && (
          <Alert className="border-red-700 bg-red-900/20">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="border-green-700 bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-400">
              <div>
                <p>{result.message}</p>
                <div className="mt-2 text-xs">
                  <p>Total Users: {result.total_users}</p>
                  <p>Updated Users: {result.updated_users}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleRecalculate}
          disabled={isRecalculating}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isRecalculating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Recalculating...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Recalculate All P&L
            </>
          )}
        </Button>

        <div className="text-xs text-gray-500">
          <p>⚠️ This operation may take a few moments for large datasets.</p>
          <p>💡 Run this after any significant changes to the trading system.</p>
        </div>
      </CardContent>
    </Card>
  );
}