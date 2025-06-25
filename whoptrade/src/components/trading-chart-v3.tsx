'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { useTheme } from 'next-themes';
import { LineChart, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

// Types
export type ChartTimeframeType = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W' | '1M';

interface ChartPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingChartProps {
  symbol: string;
  initialTimeframe?: ChartTimeframeType;
  onPriceUpdate?: (price: number) => void;
}

// Helper to format numbers
const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

// Fallback chart component that displays when the chart library can't be loaded
function FallbackChartDisplay({ 
  data, 
  symbol, 
  currentPrice, 
  priceChange 
}: { 
  data: ChartPoint[]; 
  symbol: string; 
  currentPrice: number | null; 
  priceChange: number; 
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="text-2xl font-bold mb-4">{symbol}</div>
      {currentPrice !== null && (
        <div className="text-3xl mb-2">${formatPrice(currentPrice)}</div>
      )}
      <div className={`text-lg ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'} mb-6`}>
        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
      </div>
      
      <div className="text-muted-foreground text-center mb-4">
        Chart visualization is unavailable
      </div>
      
      {data.length > 0 && (
        <div className="w-full max-w-md">
          <div className="text-sm font-medium mb-1">Recent Price Data</div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="font-medium">Time</div>
            <div className="font-medium">Open</div>
            <div className="font-medium">High</div>
            <div className="font-medium">Close</div>
            
            {data.slice(-5).reverse().map((point, idx) => (
              <React.Fragment key={idx}>
                <div>{new Date(point.time).toLocaleTimeString()}</div>
                <div>{formatPrice(point.open)}</div>
                <div>{formatPrice(point.high)}</div>
                <div className={point.close >= point.open ? 'text-green-500' : 'text-red-500'}>
                  {formatPrice(point.close)}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradingChartV3({
  symbol,
  initialTimeframe = '1D',
  onPriceUpdate
}: TradingChartProps) {
  // State management
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframeType>(initialTimeframe);
  const [priceChange, setPriceChange] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [chartLibraryLoaded, setChartLibraryLoaded] = useState(false);
  const [libraryLoadError, setLibraryLoadError] = useState(false);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  
  const { theme } = useTheme();
  
  // Fetch chart data with debouncing
  const fetchChartData = useCallback(async () => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching chart data for ${symbol}`);
      
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
        setLoading(false);
        return;
      }
      
      console.log(`Received ${data.bars.length} bars for ${symbol}`);
      
      // Format the data
      const formattedData = data.bars.map((bar: any) => ({
        time: new Date(bar.t).getTime(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      }));
      
      setChartData(formattedData);
      
      // Update current price
      if (formattedData.length > 0) {
        const latestPrice = formattedData[formattedData.length - 1].close;
        setCurrentPrice(latestPrice);
        
        // Calculate price change
        if (formattedData.length > 1) {
          const previousPrice = formattedData[0].open;
          const changePercent = ((latestPrice - previousPrice) / previousPrice) * 100;
          setPriceChange(changePercent);
        } else {
          setPriceChange(0);
        }
        
        // Notify parent component
        if (onPriceUpdate) {
          onPriceUpdate(latestPrice);
        }
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setError('Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, onPriceUpdate]);

  // Initial data fetch
  useEffect(() => {
    fetchChartData();
    
    // Refresh data every 15 seconds
    const intervalId = setInterval(() => {
      fetchChartData();
    }, 15000);
    
    return () => clearInterval(intervalId);
  }, [fetchChartData]);

  // Load chart library
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    let isMounted = true;
    
    const loadLibrary = async () => {
      try {
        // Dynamic import with error handling
        const module = await import('lightweight-charts');
        
        if (isMounted) {
          console.log('Chart library loaded successfully');
          setChartLibraryLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load chart library:', error);
        if (isMounted) {
          setLibraryLoadError(true);
        }
      }
    };
    
    loadLibrary();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize chart when data is available and library is loaded
  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length || !chartLibraryLoaded || libraryLoadError) {
      return;
    }
    
    // Dynamic import inside the effect
    import('lightweight-charts').then(LightweightCharts => {
      // Get theme colors
      const isDarkTheme = theme === 'dark';
      const textColor = isDarkTheme ? '#E1E1E6' : '#1D1D1F';
      const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      const backgroundColor = isDarkTheme ? '#1A1A1A' : '#FFFFFF';
      
      try {
        // Create chart instance
        const chart = LightweightCharts.createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { color: backgroundColor },
            textColor: textColor,
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        });
        
        // Store chart reference
        chartRef.current = chart;
        
        // Create a line series
        const lineSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
        
        // Store series reference
        seriesRef.current = lineSeries;
        
        // Format data for the chart
        const formattedData = chartData.map(d => ({
          time: Math.floor(d.time / 1000), // Convert to seconds
          value: d.close,
        }));
        
        // Set data
        lineSeries.setData(formattedData);
        
        // Fit content
        chart.timeScale().fitContent();
        
        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.resize(
              chartContainerRef.current.clientWidth,
              chartContainerRef.current.clientHeight
            );
          }
        };
        
        // Add resize listener
        window.addEventListener('resize', handleResize);
        
        // Return cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          
          if (chartRef.current) {
            // Remove the chart when component unmounts
            chartRef.current = null;
          }
        };
      } catch (error) {
        console.error('Error creating chart:', error);
        setError('Failed to create chart');
        setLibraryLoadError(true);
      }
    }).catch(error => {
      console.error('Error importing chart library:', error);
      setLibraryLoadError(true);
    });
  }, [chartData, theme, chartLibraryLoaded, libraryLoadError]);

  // Format the price change as a string with sign and percentage
  const formattedPriceChange = priceChange !== null
    ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`
    : '0.00%';

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden">
      {/* Chart Header */}
      <CardHeader className="px-4 py-3 flex flex-row justify-between items-center space-y-0">
        <div className="flex flex-col">
          <CardTitle className="text-xl font-bold">{symbol}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            {currentPrice !== null ? (
              <>
                <span className="text-lg font-medium">${formatPrice(currentPrice)}</span>
                <Badge variant={priceChange >= 0 ? "success" : "destructive"} className="text-xs">
                  {formattedPriceChange}
                </Badge>
              </>
            ) : (
              <span className="text-lg font-medium">Loading...</span>
            )}
          </CardDescription>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchChartData()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      {/* Chart Controls */}
      <div className="px-4 flex items-center justify-between border-b">
        <div className="flex items-center space-x-1">
          <Button 
            variant="secondary" 
            size="sm"
            className="h-8"
          >
            <LineChart className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Line</span>
          </Button>
        </div>
        
        <div className="flex items-center">
          <Select value={timeframe} onValueChange={(value) => setTimeframe(value as ChartTimeframeType)}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue placeholder="1D" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1m</SelectItem>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="4h">4h</SelectItem>
              <SelectItem value="1D">1D</SelectItem>
              <SelectItem value="1W">1W</SelectItem>
              <SelectItem value="1M">1M</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Chart Container */}
      <CardContent className="flex-1 p-0 relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex items-center p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        
        {/* Show fallback UI when chart library cannot be loaded */}
        {libraryLoadError ? (
          <FallbackChartDisplay 
            data={chartData} 
            symbol={symbol} 
            currentPrice={currentPrice} 
            priceChange={priceChange} 
          />
        ) : (
          <div ref={chartContainerRef} className="w-full h-full" />
        )}
      </CardContent>
    </Card>
  );
} 