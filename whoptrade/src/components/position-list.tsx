'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { Button } from './ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Position {
  asset_id: string;
  symbol: string;
  qty: string;
  avg_entry_price: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export default function PositionList() {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch positions
  const fetchPositions = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      setError(null);
      
      const response = await fetch('/api/trading/positions');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Sort positions by market value
      const sortedPositions = Array.isArray(data.positions) 
        ? [...data.positions].sort((a, b) => 
            parseFloat(b.market_value) - parseFloat(a.market_value)
          )
        : [];
      
      setPositions(sortedPositions);
      setLastUpdated(new Date());
      
      if (!showLoadingState) {
        toast.success('Positions updated');
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load positions');
      
      if (!showLoadingState) {
        toast.error('Failed to update positions');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch positions on mount
  useEffect(() => {
    fetchPositions();
    
    // Set up refresh interval
    const interval = setInterval(() => {
      fetchPositions(false);
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchPositions(false);
  };

  // Format currency value
  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  // Format percentage value
  const formatPercentage = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue / 100);
  };

  // Handle click on symbol to navigate to trading view
  const handleSymbolClick = (symbol: string) => {
    router.push(`/dashboard/trading?symbol=${symbol}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p className="text-muted-foreground">Loading positions...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <p className="text-red-500 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchPositions()}>
          Try Again
        </Button>
      </div>
    );
  }

  // No positions state
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <p className="text-muted-foreground mb-2">No positions found</p>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg Price</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">P/L</TableHead>
              <TableHead className="text-right">P/L %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              const unrealizedPL = parseFloat(position.unrealized_pl);
              const unrealizedPLPC = parseFloat(position.unrealized_plpc);
              
              return (
                <TableRow key={position.asset_id}>
                  <TableCell>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto font-medium" 
                      onClick={() => handleSymbolClick(position.symbol)}
                    >
                      {position.symbol}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    {parseFloat(position.qty).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(position.avg_entry_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(position.current_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(position.market_value)}
                  </TableCell>
                  <TableCell className={`text-right ${unrealizedPL > 0 ? 'text-green-500' : unrealizedPL < 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency(unrealizedPL)}
                  </TableCell>
                  <TableCell className={`text-right ${unrealizedPLPC > 0 ? 'text-green-500' : unrealizedPLPC < 0 ? 'text-red-500' : ''}`}>
                    {formatPercentage(unrealizedPLPC)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 