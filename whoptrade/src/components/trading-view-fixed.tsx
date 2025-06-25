'use client';

import React, { useState, useEffect, useCallback } from 'react';
import SimpleChart from './simple-chart';
import OrderForm from './order-form';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { ArrowUp, ArrowDown, RefreshCw, Loader2 } from 'lucide-react';

// Helper to format prices consistently
const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

interface TradingViewProps {
  symbol: string;
  initialTimeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W' | '1M';
  showOrderPanel?: boolean;
}

export default function TradingViewFixed({
  symbol,
  initialTimeframe = '1D',
  showOrderPanel = true
}: TradingViewProps) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState<number | null>(null);
  const [askPrice, setAskPrice] = useState<number | null>(null);
  const [spread, setSpread] = useState<number | null>(null);
  const [lastTradeTime, setLastTradeTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  
  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    if (!symbol) return;
    
    try {
      setIsLoading(true);
      
      const queryParams = new URLSearchParams({
        symbol: symbol,
        timeframe: timeframe,
        limit: '100', 
      });
      
      const response = await fetch(`/api/alpaca/market-data/bars?${queryParams}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      
      const data = await response.json();
      
      if (!data.bars || data.bars.length === 0) {
        setError('No data available for this symbol and timeframe');
        setChartData([]); // Initialize with empty array
        return;
      }
      
      console.log(`Received ${data.bars.length} bars for ${symbol}`);
      
      // Format the data
      const formattedData = data.bars.map((bar: any) => ({
        time: new Date(bar.t).getTime() / 1000, // Convert to seconds for lightweight-charts
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      }));
      
      setChartData(formattedData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setError('Failed to fetch chart data');
      setChartData([]); // Initialize with empty array
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe]);
  
  // Fetch latest quote data from API
  const fetchQuoteData = useCallback(async () => {
    if (!symbol) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/alpaca/market-data/quotes/latest?symbol=${symbol}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch quote: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.quote) {
        const quote = data.quote;
        
        // Update bid and ask prices
        setBidPrice(quote.bp);
        setAskPrice(quote.ap);
        
        // Calculate spread
        const calculatedSpread = quote.ap - quote.bp;
        setSpread(calculatedSpread);
        
        // Calculate midpoint price as current price
        const midpointPrice = (quote.ap + quote.bp) / 2;
        setCurrentPrice(midpointPrice);
        
        // Set last trade time
        setLastTradeTime(new Date(quote.t));
        
        // Clear any previous errors
        setError(null);
      } else {
        throw new Error('Invalid quote data received');
      }
    } catch (error) {
      console.error('Error fetching quote data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch quote');
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);
  
  // Fetch recent trades
  const fetchRecentTrades = useCallback(async () => {
    if (!symbol) return;
    
    try {
      const response = await fetch(`/api/alpaca/market-data/trades?symbol=${symbol}&limit=5`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.trades) {
          setRecentTrades(data.trades);
        }
      } else {
        console.warn(`Failed to fetch trades: ${response.status} ${response.statusText}`);
        // Not setting error state here to keep UI clean, just log the warning
      }
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      // Continue gracefully without updating trades data
    }
  }, [symbol]);
  
  // Handle price updates from the chart component
  const handlePriceUpdate = (price: number) => {
    setCurrentPrice(price);
  };
  
  // Fetch data on mount and when symbol changes
  useEffect(() => {
    fetchQuoteData();
    fetchRecentTrades();
    fetchChartData();
    
    // Set up refresh interval for real-time data
    const quoteInterval = setInterval(() => {
      fetchQuoteData();
    }, 15000); // Refresh less frequently - every 15 seconds
    
    const tradesInterval = setInterval(() => {
      fetchRecentTrades();
    }, 30000); // Refresh trades less frequently - every 30 seconds
    
    const chartInterval = setInterval(() => {
      fetchChartData();
    }, 60000); // Refresh chart data every minute
    
    return () => {
      clearInterval(quoteInterval);
      clearInterval(tradesInterval);
      clearInterval(chartInterval);
    };
  }, [symbol, timeframe, fetchQuoteData, fetchRecentTrades, fetchChartData]);
  
  // Function to transform data for the SimpleChart
  const getSimpleChartData = () => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    
    return chartData.map(bar => ({
      time: bar.time,
      value: bar.close
    }));
  };
  
  return (
    <div className="space-y-4">
      {/* Price and quote information */}
      <div className="flex flex-col sm:flex-row justify-between mb-4 gap-4">
        <div className="space-y-1">
          <div className="text-3xl font-bold">{symbol}</div>
          {currentPrice !== null && (
            <div className="text-2xl">{formatPrice(currentPrice)}</div>
          )}
          <div className="text-sm text-muted-foreground">
            {lastTradeTime && `Last updated: ${lastTradeTime.toLocaleTimeString()}`}
          </div>
        </div>
        
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Bid</div>
              <div className="text-base">{bidPrice !== null ? formatPrice(bidPrice) : '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Ask</div>
              <div className="text-base">{askPrice !== null ? formatPrice(askPrice) : '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Spread</div>
              <div className="text-base">{spread !== null ? formatPrice(spread) : '-'}</div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchQuoteData} 
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {/* Recent trades */}
          {recentTrades.length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-muted-foreground mb-1">Recent Trades</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {recentTrades.slice(0, 3).map((trade, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <span className={trade.p >= (recentTrades[i+1]?.p || trade.p) ? 'text-green-500' : 'text-red-500'}>
                      {trade.p >= (recentTrades[i+1]?.p || trade.p) ? '↑' : '↓'}
                    </span>
                    <span>{formatPrice(trade.p)}</span>
                    <span className="text-muted-foreground">({trade.s})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {/* Main chart */}
      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue={timeframe} onValueChange={(value) => setTimeframe(value as any)}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="1D">Day</TabsTrigger>
                <TabsTrigger value="1W">Week</TabsTrigger>
                <TabsTrigger value="1M">Month</TabsTrigger>
                <TabsTrigger value="3M">3M</TabsTrigger>
                <TabsTrigger value="1Y">Year</TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchChartData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            
            <TabsContent value="1D" className="mt-0">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                </div>
              ) : chartData.length > 0 ? (
                <SimpleChart data={getSimpleChartData()} height={400} />
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center text-muted-foreground">
                    {error || 'No chart data available for this timeframe'}
                  </div>
                </div>
              )}
            </TabsContent>
            
            {['1W', '1M', '3M', '1Y'].map((period) => (
              <TabsContent key={period} value={period} className="mt-0">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                  </div>
                ) : chartData.length > 0 ? (
                  <SimpleChart data={getSimpleChartData()} height={400} />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-center text-muted-foreground">
                      {error || 'No chart data available for this timeframe'}
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Order panel (optional) */}
      {showOrderPanel && (
        <Card>
          <CardContent className="p-4">
            <OrderForm symbol={symbol} onSubmit={() => {}} portfolioData={null} />
          </CardContent>
        </Card>
      )}
    </div>
  );
} 