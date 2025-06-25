'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ChartView from './chart-view';
import OrderForm from './order-form';
import PositionList from './position-list';
import OrderList from './order-list';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search } from 'lucide-react';

// Helper to format prices consistently
const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

export default function TradingView() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState<string>(searchParams.get('symbol') || 'AAPL');
  const [searchInput, setSearchInput] = useState<string>(symbol);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1Day');
  const [showPositions, setShowPositions] = useState<boolean>(true);
  
  // Handle price updates from the chart
  const handlePriceUpdate = useCallback((price: number) => {
    setCurrentPrice(price);
  }, []);
  
  // Handle symbol change
  const handleSymbolChange = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput) {
      setSymbol(searchInput.toUpperCase());
      
      // Update URL without causing a navigation/refresh
      const url = new URL(window.location.href);
      url.searchParams.set('symbol', searchInput.toUpperCase());
      window.history.pushState({}, '', url.toString());
    }
  }, [searchInput]);
  
  // Handle when an order is placed
  const handleOrderPlaced = useCallback(() => {
    // Refresh positions and orders
    setShowPositions(false);
    setTimeout(() => {
      setShowPositions(true);
    }, 500);
  }, []);
  
  // Update searchInput when symbol changes (e.g., from URL)
  useEffect(() => {
    setSearchInput(symbol);
  }, [symbol]);
  
  // When receiving the symbol from URL parameters on initial load
  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setSymbol(symbolFromUrl.toUpperCase());
      setSearchInput(symbolFromUrl.toUpperCase());
    }
  }, [searchParams]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Symbol search and chart */}
        <Card>
          <CardHeader className="pb-0">
            <form onSubmit={handleSymbolChange} className="flex space-x-2">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter symbol (e.g. AAPL, MSFT)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button type="submit">Go</Button>
            </form>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue={timeframe} onValueChange={setTimeframe}>
              <TabsList className="mb-2">
                <TabsTrigger value="1Min">1m</TabsTrigger>
                <TabsTrigger value="5Min">5m</TabsTrigger>
                <TabsTrigger value="15Min">15m</TabsTrigger>
                <TabsTrigger value="1Hour">1h</TabsTrigger>
                <TabsTrigger value="1Day">Day</TabsTrigger>
                <TabsTrigger value="1Week">Week</TabsTrigger>
              </TabsList>
              
              <ChartView
                symbol={symbol}
                timeframe={timeframe}
                height={400}
                onPriceUpdate={handlePriceUpdate}
              />
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Positions and Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Positions & Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="positions">
              <TabsList className="mb-4">
                <TabsTrigger value="positions">Positions</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
              </TabsList>
              
              <TabsContent value="positions" className="mt-0">
                {showPositions && <PositionList />}
              </TabsContent>
              
              <TabsContent value="orders" className="mt-0">
                <OrderList />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Order form */}
      <div className="lg:col-span-1">
        <OrderForm 
          symbol={symbol} 
          currentPrice={currentPrice}
          onOrderPlaced={handleOrderPlaced}
        />
      </div>
    </div>
  );
} 