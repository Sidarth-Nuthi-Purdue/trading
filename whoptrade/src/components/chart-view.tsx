/**
 * Chart View Component
 * Displays a chart with price data and trading controls
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import TradingViewChart from './tradingview-chart';
import StableChart from './stable-chart';
import ChartErrorBoundary from './chart-error-boundary';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '../lib/format';
import { BarChart2, ChevronDown } from 'lucide-react';

interface ChartViewProps {
  symbol: string;
  onSymbolChange?: (symbol: string) => void;
  enableTrading?: boolean;
  onPriceUpdate?: (price: number, change?: number, changePercent?: number) => void;
}

const ChartView: React.FC<ChartViewProps> = ({
  symbol,
  onSymbolChange,
  enableTrading = true,
  onPriceUpdate,
}) => {
  const { toast } = useToast();
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [timeInterval, setTimeInterval] = useState<string>('1h');
  const [price, setPrice] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [activeTab, setActiveTab] = useState('market');
  const [useStableChart, setUseStableChart] = useState(false);

  // Update currentSymbol when symbol prop changes
  useEffect(() => {
    if (symbol !== currentSymbol) {
      setCurrentSymbol(symbol);
    }
  }, [symbol, currentSymbol]);

  // Handle symbol change
  const handleSymbolChange = useCallback((newSymbol: string) => {
    setCurrentSymbol(newSymbol);
    if (onSymbolChange) onSymbolChange(newSymbol);
  }, [onSymbolChange]);

  // Handle interval change
  const handleIntervalChange = useCallback((newInterval: string) => {
    setTimeInterval(newInterval);
  }, []);

  // Handle price update from chart
  const handlePriceUpdate = useCallback((newPrice: number) => {
    setPrice(newPrice);
    if (onPriceUpdate) {
      onPriceUpdate(newPrice);
    }
  }, [onPriceUpdate]);

  // Handle trading actions
  const handleBuy = useCallback(async () => {
    try {
      if (!price || !quantity || parseFloat(quantity) <= 0) {
        toast({
          title: 'Invalid quantity',
          description: 'Please enter a valid quantity',
        });
        return;
      }
      
      const response = await fetch('/api/trading/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: currentSymbol,
          side: 'buy',
          quantity: parseFloat(quantity),
          type: 'market',
          timeInForce: 'day'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to place buy order: ${response.statusText}`);
      }
      
      await response.json();
      
      toast({
        title: 'Order Placed',
        description: `Buy ${quantity} ${currentSymbol} at market price`,
      });
      
      setQuantity('');
    } catch (error) {
      console.error('Error placing buy order:', error);
      toast({
        title: 'Order Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [currentSymbol, price, quantity, toast]);

  const handleSell = useCallback(async () => {
    try {
      if (!price || !quantity || parseFloat(quantity) <= 0) {
        toast({
          title: 'Invalid quantity',
          description: 'Please enter a valid quantity',
        });
        return;
      }
      
      const response = await fetch('/api/trading/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: currentSymbol,
          side: 'sell',
          quantity: parseFloat(quantity),
          type: 'market',
          timeInForce: 'day'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to place sell order: ${response.statusText}`);
      }
      
      await response.json();
      
      toast({
        title: 'Order Placed',
        description: `Sell ${quantity} ${currentSymbol} at market price`,
      });
      
      setQuantity('');
    } catch (error) {
      console.error('Error placing sell order:', error);
      toast({
        title: 'Order Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [currentSymbol, price, quantity, toast]);

  // Handle price input change in limit orders
  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setPrice(null);
    } else {
      setPrice(parseFloat(value));
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Symbol Header - Simplified since we have the legend in the chart */}
      <div className="flex items-center p-3 border-b border-gray-800">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <h2 className="text-base font-medium mr-1">{currentSymbol}</h2>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Chart Area */}
        <div className="flex-1 flex flex-col">
          {/* Interval Selector */}
          <div className="flex items-center justify-between border-b border-gray-800 bg-black p-2">
            <div className="flex items-center">
              <Button variant="ghost" className="text-gray-400 h-8 px-3">
                <BarChart2 className="h-4 w-4 mr-1" />
                Indicators
              </Button>
            </div>
            <div className="flex items-center bg-gray-900 rounded-md">
              <Button 
                variant={timeInterval === '1m' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('1m')}
              >
                1m
              </Button>
              <Button 
                variant={timeInterval === '5m' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('5m')}
              >
                5m
              </Button>
              <Button 
                variant={timeInterval === '15m' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('15m')}
              >
                15m
              </Button>
              <Button 
                variant={timeInterval === '30m' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('30m')}
              >
                30m
              </Button>
              <Button 
                variant={timeInterval === '1h' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('1h')}
              >
                1h
              </Button>
              <Button 
                variant={timeInterval === '1d' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('1d')}
              >
                1D
              </Button>
              <Button 
                variant={timeInterval === '1w' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-6 px-2 rounded-md text-xs"
                onClick={() => handleIntervalChange('1w')}
              >
                1W
              </Button>
            </div>
          </div>
          
          {/* Chart */}
          <div className="flex-1">
            <TradingViewChart 
              symbol={currentSymbol}
              timeInterval={timeInterval}
              height={500}
              darkMode={true}
              onSymbolChange={handleSymbolChange}
              onIntervalChange={handleIntervalChange}
              onPriceUpdate={handlePriceUpdate}
              enableTrading={enableTrading}
              className="w-full h-full"
            />
          </div>
        </div>
        
        {/* Trading Panel (conditionally rendered) */}
        {enableTrading && (
          <div className="w-64 border-l border-gray-800 p-4 flex flex-col">
            <h3 className="text-sm font-medium mb-4">Trade {currentSymbol}</h3>
            
            {/* Order Type Tabs */}
            <div className="flex mb-4">
              <Button
                variant={activeTab === 'market' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 rounded-r-none"
                onClick={() => setActiveTab('market')}
              >
                Market
              </Button>
              <Button
                variant={activeTab === 'limit' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 rounded-l-none"
                onClick={() => setActiveTab('limit')}
              >
                Limit
              </Button>
            </div>
            
            {/* Order Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                  placeholder="Enter quantity"
                />
              </div>
              
              {activeTab === 'limit' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price</label>
                  <Input
                    type="number"
                    value={price?.toString() || ''}
                    onChange={handlePriceChange}
                    className="bg-gray-900 border-gray-700"
                    placeholder="Enter price"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleBuy}
                >
                  Buy
                </Button>
                <Button
                  variant="default"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleSell}
                >
                  Sell
                </Button>
              </div>
            </div>
            
            {/* Market Data */}
            <div className="mt-auto pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-400">
                <div className="flex justify-between mb-1">
                  <span>Current Price</span>
                  <span className="font-medium text-white">${price !== null ? formatPrice(price) : '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartView; 
