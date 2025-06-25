'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useTheme } from 'next-themes';
import { RefreshCw, Loader2 } from 'lucide-react';

// Chart data type
interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartFixProps {
  symbol: string;
  height?: number;
}

export default function ChartFix({ symbol, height = 400 }: ChartFixProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const { theme } = useTheme();
  
  // Fetch chart data
  const fetchChartData = async () => {
    if (!symbol) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/alpaca/market-data/bars?symbol=${symbol}&timeframe=${timeframe}&limit=100`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chart data (${response.status})`);
      }
      
      const data = await response.json();
      
      if (!data.bars || data.bars.length === 0) {
        setError('No data available for this symbol and timeframe');
        setChartData([]);
        return;
      }
      
      // Format data for chart
      const formattedData = data.bars.map((bar: any) => ({
        time: new Date(bar.t).getTime() / 1000,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      }));
      
      setChartData(formattedData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch chart data');
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initialize chart when data is available
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;
    
    // Clear existing chart
    while (chartContainerRef.current.firstChild) {
      chartContainerRef.current.removeChild(chartContainerRef.current.firstChild);
    }
    
    // Set theme colors
    const isDarkTheme = theme === 'dark';
    const textColor = isDarkTheme ? '#E1E1E6' : '#1D1D1F';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const backgroundColor = isDarkTheme ? '#1A1A1A' : '#FFFFFF';
    
    const initChart = async () => {
      try {
        // Only import the library on the client
        const { createChart } = await import('lightweight-charts');
        
        // Create chart
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: height,
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
        
        // Create candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        
        // Set data
        candlestickSeries.setData(chartData);
        
        // Fit content
        chart.timeScale().fitContent();
        
        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current) {
            chart.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };
        
        window.addEventListener('resize', handleResize);
        
        return () => {
          window.removeEventListener('resize', handleResize);
          chart.remove();
        };
      } catch (err) {
        console.error('Failed to initialize chart:', err);
        setError('Failed to load chart library. Please refresh the page.');
      }
    };
    
    initChart();
  }, [chartData, theme, height]);
  
  // Fetch data on mount and when timeframe changes
  useEffect(() => {
    fetchChartData();
    
    // Set up refresh interval
    const interval = setInterval(() => {
      fetchChartData();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [symbol, timeframe]);
  
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex justify-between items-center">
          <CardTitle>{symbol} Chart</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchChartData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs value={timeframe} onValueChange={setTimeframe} className="mb-4">
          <TabsList>
            <TabsTrigger value="1D">Day</TabsTrigger>
            <TabsTrigger value="1W">Week</TabsTrigger>
            <TabsTrigger value="1M">Month</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {isLoading ? (
          <div className="flex justify-center items-center" style={{ height: `${height}px` }}>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center" style={{ height: `${height}px` }}>
            <div className="text-red-500">{error}</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center" style={{ height: `${height}px` }}>
            <div className="text-muted-foreground">No chart data available</div>
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />
        )}
      </CardContent>
    </Card>
  );
} 