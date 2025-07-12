'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createBrowserClient } from '@supabase/ssr';
import { getWhopAuthHeaders } from '@/lib/whop-supabase-bridge';

interface OrderPanelProps {
  symbol: string;
  portfolio: any;
  onOrderPlaced: () => void;
  currentPrice?: number;
  selectedOption?: any; // For options trading
  assetType?: 'stock' | 'option';
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OrderPanel({ symbol, portfolio, onOrderPlaced, currentPrice: propCurrentPrice, selectedOption, assetType = 'stock' }: OrderPanelProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Use price from chart, option, or fetch fallback
  useEffect(() => {
    if (assetType === 'option' && selectedOption) {
      // For options, use the selected option's price
      setCurrentPrice(selectedOption.lastPrice || selectedOption.bid || selectedOption.ask || 0);
    } else if (propCurrentPrice && propCurrentPrice > 0) {
      setCurrentPrice(propCurrentPrice);
    } else {
      // Fallback: fetch current price if not provided
      const fetchCurrentPrice = async () => {
        try {
          const response = await fetch(`/api/market-data/bars?symbol=${symbol}&interval=1d`);
          if (response.ok) {
            const data = await response.json();
            const bars = data.bars || [];
            if (bars.length > 0) {
              const latestPrice = bars[bars.length - 1].close;
              if (latestPrice && latestPrice > 0) {
                setCurrentPrice(latestPrice);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching current price:', error);
        }
      };
      
      fetchCurrentPrice();
    }
  }, [symbol, propCurrentPrice, selectedOption, assetType]);


  const availableBalance = portfolio?.balance?.available_balance || 0;
  const currentPosition = portfolio?.positions?.find((p: any) => p.symbol === symbol);
  const availableShares = currentPosition?.quantity || 0;

  // Estimated cost calculation for display only - backend will use actual market prices
  const estimatedCost = () => {
    const qty = parseFloat(quantity) || 0;
    return qty * currentPrice;
  };

  const maxQuantity = () => {
    if (side === 'buy') {
      return Math.floor(availableBalance / currentPrice);
    } else {
      return availableShares;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validation
      if (!quantity || parseFloat(quantity) <= 0) {
        throw new Error('Please enter a valid quantity');
      }


      if (side === 'buy' && estimatedCost() > availableBalance) {
        throw new Error('Insufficient balance for this order');
      }

      if (side === 'sell' && parseFloat(quantity) > availableShares) {
        throw new Error('Insufficient shares to sell');
      }

      // Submit order with authentication
      const orderData = {
        symbol: assetType === 'option' ? selectedOption?.contractSymbol : symbol,
        side,
        order_type: 'market',
        quantity: parseFloat(quantity),
        asset_type: assetType,
        // Additional fields for options
        ...(assetType === 'option' && selectedOption && {
          underlying_symbol: symbol,
          strike_price: selectedOption.strike,
          expiration_date: selectedOption.contractSymbol ? parseExpirationFromContract(selectedOption.contractSymbol) : null,
          option_type: selectedOption.contractSymbol ? parseOptionType(selectedOption.contractSymbol) : null
        })
      };

      const response = await fetch('/api/paper-trading/orders', {
        method: 'POST',
        headers: getWhopAuthHeaders(),
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to place order');
      }

      setSuccess(`${side.toUpperCase()} order for ${quantity} shares of ${symbol} placed successfully!`);
      
      // Reset form
      setQuantity('');
      
      // Notify parent component
      onOrderPlaced();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const parseExpirationFromContract = (contractSymbol: string): string | null => {
    try {
      const match = contractSymbol.match(/(\d{6})/);
      if (match) {
        const dateStr = match[1];
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const day = parseInt(dateStr.substring(4, 6));
        return new Date(year, month - 1, day).toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error parsing expiration:', error);
    }
    return null;
  };

  const parseOptionType = (contractSymbol: string): string | null => {
    try {
      const match = contractSymbol.match(/[CP]/);
      return match ? (match[0] === 'C' ? 'call' : 'put') : null;
    } catch (error) {
      console.error('Error parsing option type:', error);
    }
    return null;
  };

  return (
    <Card className="bg-gray-900 border-gray-700 h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-white">
          <span>Place Order</span>
          <div className="text-sm font-normal">
            {assetType === 'option' && selectedOption ? (
              <div>
                <div className="text-gray-400">{selectedOption.contractSymbol}</div>
                <div className="text-xs text-gray-500">
                  {symbol} ${selectedOption.strike} {parseOptionType(selectedOption.contractSymbol)?.toUpperCase()}
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-white font-medium">${currentPrice.toFixed(2)}</span>
                  <TrendingUp className="w-3 h-3 text-green-400" />
                </div>
              </div>
            ) : (
              <div>
                <div className="text-gray-400">{symbol}</div>
                <div className="flex items-center space-x-1">
                  <span className="text-white font-medium">${currentPrice.toFixed(2)}</span>
                  <TrendingUp className="w-3 h-3 text-green-400" />
                </div>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Buy/Sell Tabs */}
        <Tabs value={side} onValueChange={(value) => setSide(value as any)}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger 
              value="buy" 
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger 
              value="sell"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
            >
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value={side} className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Order Type */}
              <div className="space-y-2">
                <Label className="text-gray-300">Order Type</Label>
                <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-300 text-sm">
                  Market Order (executes immediately at current market price)
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Quantity</Label>
                  <button
                    type="button"
                    onClick={() => setQuantity(maxQuantity().toString())}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Max: {maxQuantity()}
                  </button>
                </div>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>


              {/* Order Summary */}
              {quantity && (
                <div className="p-3 bg-gray-800 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Estimated {side === 'buy' ? 'Cost' : 'Proceeds'}:</span>
                    <span className="text-white font-medium">
                      {formatCurrency(estimatedCost())}
                    </span>
                  </div>
                  
                  {side === 'buy' && (
                    <div className="flex justify-between text-gray-300">
                      <span>Available Balance:</span>
                      <span className="text-white">{formatCurrency(availableBalance)}</span>
                    </div>
                  )}
                  
                  {side === 'sell' && (
                    <div className="flex justify-between text-gray-300">
                      <span>Available Shares:</span>
                      <span className="text-white">{availableShares.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <Alert className="border-red-700 bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-700 bg-green-900/20">
                  <AlertDescription className="text-green-400">{success}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !quantity}
                className={`w-full ${
                  side === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } text-white`}
              >
                {loading ? 'Placing Order...' : `${side.toUpperCase()} ${symbol}`}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Position Info */}
        {currentPosition && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <div className="text-sm font-medium text-gray-300 mb-2">Current Position</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Shares:</span>
                <span className="text-white">{currentPosition.quantity.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Cost:</span>
                <span className="text-white">${currentPosition.average_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Value:</span>
                <span className="text-white">{formatCurrency(currentPosition.current_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Unrealized P&L:</span>
                <span className={currentPosition.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {currentPosition.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(currentPosition.unrealized_pnl)}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}