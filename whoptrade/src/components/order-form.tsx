'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useSupabase } from '@/components/auth-provider';

interface OrderFormProps {
  symbol: string;
  currentPrice?: number;
  onOrderPlaced?: () => void;
}

export default function OrderForm({ symbol, currentPrice, onOrderPlaced }: OrderFormProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useSupabase();
  
  // State for form inputs
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<string>('1');
  
  // State for UI
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  
  // Add a state for market status
  const [marketStatus, setMarketStatus] = useState<{isOpen: boolean; message: string}>(() => {
    const open = isMarketOpen();
    return {
      isOpen: open,
      message: open ? 'Market Open' : 'Market Closed'
    };
  });
  
  // Update latest price when current price changes
  useEffect(() => {
    if (currentPrice) {
      setLatestPrice(currentPrice);
    }
  }, [currentPrice]);
  
  // Fetch latest quote manually
  const fetchLatestQuote = async () => {
    if (isFetchingQuote) return;
    
    setIsFetchingQuote(true);
    try {
      const response = await fetch(`/api/alpaca-direct/quote?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch quote: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.quote) {
        const price = side === 'buy' ? parseFloat(data.quote.ap) : parseFloat(data.quote.bp);
        setLatestPrice(price);
        toast.success('Latest price updated');
      } else if (data.bp && data.ap) { // Fallback for direct quote response
        const price = side === 'buy' ? parseFloat(data.ap) : parseFloat(data.bp);
        setLatestPrice(price);
        toast.success('Latest price updated');
      }

    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('Failed to fetch latest price');
    } finally {
      setIsFetchingQuote(false);
    }
  };
  
  // Check if the market is currently open
  const isMarketOpen = (): boolean => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Convert to Eastern Time (ET) - this is a simplified version
    // In production, you should use a proper timezone library
    const etHours = (hours + 24 - 4) % 24; // Rough ET conversion (UTC-4)
    
    // Weekend check (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Regular trading hours: 9:30 AM - 4:00 PM ET
    if (etHours < 9 || etHours >= 16) {
      return false;
    }
    
    // Check for 9:30 AM
    if (etHours === 9 && minutes < 30) {
      return false;
    }
    
    return true;
  };
  
  // Add a useEffect to update market status periodically
  useEffect(() => {
    // Update market status initially
    setMarketStatus({
      isOpen: isMarketOpen(),
      message: isMarketOpen() ? 'Market Open' : 'Market Closed'
    });
    
    // Update market status every minute
    const interval = setInterval(() => {
      const open = isMarketOpen();
      setMarketStatus({
        isOpen: open,
        message: open ? 'Market Open' : 'Market Closed'
      });
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Place order
  const placeOrder = async () => {
    setOrderError(null);
    
    if (!user) {
      setOrderError('You must be logged in to place an order');
      toast.error('Authentication required', { description: 'Please log in to place orders' });
      router.push('/login');
      return;
    }
    
    const qtyValue = parseFloat(quantity);
    if (isNaN(qtyValue) || qtyValue <= 0) {
      setOrderError('Quantity must be a positive number');
      return;
    }
    
    
    // Show warning if market is closed
    if (!marketStatus.isOpen) {
      const confirmTrade = window.confirm(
        'The market is currently closed. This is a paper trading platform, so your order will still be processed, but in real trading, you would need to wait for market hours (9:30 AM - 4:00 PM ET, Monday-Friday). Do you want to proceed?'
      );
      
      if (!confirmTrade) {
        return;
      }
    }
    
    const orderData = {
      symbol,
      quantity: qtyValue,
      side,
      order_type: 'market',
      bypassMarketHours: true // Allow paper trading outside market hours
    };
    
    setIsPlacingOrder(true);
    
    try {
      const response = await fetch('/api/trading/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to place order');
      }
      
      toast.success(`${side.toUpperCase()} order placed successfully`, {
        description: `${quantity} shares of ${symbol} at market price`
      });
      
      setQuantity('1');
      
      if (onOrderPlaced) {
        onOrderPlaced();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setOrderError(errorMessage);
      
      toast.error('Order failed', {
        description: errorMessage
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };
  
  // Order value calculation for display only - backend calculates actual execution prices
  const calculateOrderValue = (): string => {
    const qty = parseFloat(quantity) || 0;
    let price = 0;
    
    if (latestPrice) {
      price = latestPrice;
    } else if (currentPrice) {
      price = currentPrice;
    }
    
    const total = qty * price;
    return total.toFixed(2);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Place Order</CardTitle>
        <CardDescription>
          {symbol} - {latestPrice ? `$${latestPrice.toFixed(2)}` : currentPrice ? `$${currentPrice.toFixed(2)}` : 'Loading price...'} 
          <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${marketStatus.isOpen ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {marketStatus.message}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-1"
            onClick={fetchLatestQuote}
            disabled={isFetchingQuote}
          >
            {isFetchingQuote ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buy" onValueChange={(value) => setSide(value as 'buy' | 'sell')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">Sell</TabsTrigger>
          </TabsList>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Order Type</Label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                Market Order (executes immediately at current market price)
              </div>
            </div>
          </div>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch">
        <div className="flex justify-between text-sm text-muted-foreground mb-4">
          <span>Est. Order Value</span>
          <span>${calculateOrderValue()}</span>
        </div>
        
        {orderError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{orderError}</AlertDescription>
          </Alert>
        )}
        
        <Button
          onClick={placeOrder}
          disabled={isPlacingOrder || authLoading}
          className={side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
        >
          {isPlacingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isPlacingOrder ? 'Placing Order...' : `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`}
        </Button>
      </CardFooter>
    </Card>
  );
} 