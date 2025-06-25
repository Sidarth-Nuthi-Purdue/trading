'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { useTheme } from 'next-themes';
import { Activity, AreaChart, BarChart3, CandlestickChart, Layers, LineChart, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { debounce } from 'lodash';

// Import the chart library dynamically to ensure it's only loaded in browser context
let LightweightCharts: any = null;

// Ensure the chart library is only loaded on the client side
if (typeof window !== 'undefined') {
  try {
    LightweightCharts = require('lightweight-charts');
    console.log('LightweightCharts library loaded successfully');
  } catch (error) {
    console.error('Failed to load LightweightCharts library:', error);
  }
}

// Types
export type ChartTimeframeType = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W' | '1M';
export type ChartPeriodType = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';
export type ChartStyleType = 'candles' | 'bars' | 'line' | 'area';
export type IndicatorType = 'sma' | 'ema' | 'bollinger' | 'rsi' | 'macd' | 'volume';

interface ChartPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Level2Data {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
}

interface Indicator {
  type: IndicatorType;
  visible: boolean;
  color: string;
  params: Record<string, number>;
}

export interface TradingChartProps {
  symbol: string;
  initialTimeframe?: ChartTimeframeType;
  showOrderPanel?: boolean;
  simulationMode?: boolean;
  simulationData?: ChartPoint[];
  onPriceUpdate?: (price: number) => void;
}

// Helper to format numbers
const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toString();
};

// Helper function to check if chart is properly initialized
const isChartInitialized = (chart: any) => {
  // Simple check if chart exists
  if (!chart || typeof chart !== 'object') {
    console.error('Chart is not a valid object');
    return false;
  }
  
  // Log available methods for debugging
  console.log('Chart methods:', Object.keys(chart).filter(k => typeof chart[k] === 'function'));
  console.log('Chart prototype methods:', 
    Object.getOwnPropertyNames(Object.getPrototypeOf(chart))
      .filter(name => typeof chart[name] === 'function')
  );
  
  // For our minimal implementation, we only need some basic functionality
  const hasAddSeries = typeof chart.addLineSeries === 'function';
  
  if (!hasAddSeries) {
    console.error('Chart is missing required method: addLineSeries');
    return false;
  }
  
  return true;
};

export default function TradingChart({
  symbol,
  initialTimeframe = '1D',
  showOrderPanel = true,
  simulationMode = false,
  simulationData = [],
  onPriceUpdate
}: TradingChartProps) {
  // State management
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframeType>(initialTimeframe);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriodType>('1M');
  const [chartStyle, setChartStyle] = useState<ChartStyleType>('line'); // Default to line chart for better compatibility
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [showLevel2Panel, setShowLevel2Panel] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [priceChange, setPriceChange] = useState(0);
  const [level2Data, setLevel2Data] = useState<Level2Data>({ 
    bids: [], 
    asks: [] 
  });
  const [error, setError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([
    { type: 'sma', visible: false, color: '#2962FF', params: { period: 20 } },
    { type: 'ema', visible: false, color: '#9C27B0', params: { period: 21 } },
    { type: 'bollinger', visible: false, color: '#FF9800', params: { period: 20, deviation: 2 } },
    { type: 'rsi', visible: false, color: '#F44336', params: { period: 14, overbought: 70, oversold: 30 } },
    { type: 'macd', visible: false, color: '#4CAF50', params: { fast: 12, slow: 26, signal: 9 } },
    { type: 'volume', visible: true, color: '#757575', params: {} },
  ]);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const areaSeriesRef = useRef<any>(null);
  const barSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const indicatorSeriesRefs = useRef<Record<string, any[]>>({});
  
  const isMounted = useRef<boolean>(false);
  const { theme } = useTheme();
  
  // Refs for tracking API request state
  const requestStateRef = useRef<{
    lastRequestTime: number;
    pendingRequest: boolean;
    retryCount: number;
    retryTimeout: NodeJS.Timeout | null;
  }>({
    lastRequestTime: 0,
    pendingRequest: false,
    retryCount: 0,
    retryTimeout: null,
  });

  // Memoized function to convert timeframe to API format
  const convertTimeframeToApi = useCallback((tf: ChartTimeframeType): string => {
    switch(tf) {
      case '1m': return '1Min';
      case '5m': return '5Min';
      case '15m': return '15Min';
      case '1h': return '1Hour';
      case '4h': return '1Hour'; // 4h not directly supported, fallback to 1h
      case '1D': return '1Day';
      case '1W': return '1Week';
      case '1M': return '1Month';
      default: return '1Day';
    }
  }, []);

  // Fetch chart data with debouncing and rate limiting
  const fetchChartData = useCallback(async () => {
    if (!symbol) return;
    
    const now = Date.now();
    const minInterval = 10000; // Increase to 10 seconds minimum between requests to avoid rate limiting
    
    // Check if we're within the rate limit window
    if (now - requestStateRef.current.lastRequestTime < minInterval) {
      console.log(`Rate limiting ourselves for ${symbol}, waiting...`);
      
      // If we're not already waiting to retry, schedule one
      if (!requestStateRef.current.retryTimeout) {
        const delayMs = minInterval - (now - requestStateRef.current.lastRequestTime) + 1000; // Increase buffer to 1000ms
        
        console.log(`Scheduling retry in ${delayMs}ms`);
        
        requestStateRef.current.retryTimeout = setTimeout(() => {
          requestStateRef.current.retryTimeout = null;
          fetchChartData();
        }, delayMs);
      }
      
      return;
    }
    
    // Update request tracking
    requestStateRef.current.lastRequestTime = now;
    requestStateRef.current.pendingRequest = true;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching chart data for ${symbol} with timeframe ${convertTimeframeToApi(timeframe)}`);
      
      const queryParams = new URLSearchParams({
        symbol: symbol,
        timeframe: convertTimeframeToApi(timeframe),
        limit: '100', 
      });
      
      const response = await fetch(`/api/alpaca/market-data/bars?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        // Get detailed error from response
        let errorMessage = 'Failed to fetch chart data';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          
          // Handle rate limiting specially
          if (response.status === 429) {
            const retryAfter = errorData.retryAfter || 10000; // Default to 10s if not specified
            console.log(`Server requested retry after ${retryAfter}ms`);
            
            // Schedule a retry
            if (!requestStateRef.current.retryTimeout) {
              requestStateRef.current.retryTimeout = setTimeout(() => {
                requestStateRef.current.retryTimeout = null;
                fetchChartData();
              }, retryAfter + 2000); // Add a 2s buffer
            }
          }
        } catch (parseError) {
          // If can't parse JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.bars || data.bars.length === 0) {
        setError('No data available for this symbol and timeframe');
        setLoading(false);
        return;
      }
      
      console.log(`Received ${data.bars.length} bars for ${symbol}`);
      
      // Reset retry count on success
      requestStateRef.current.retryCount = 0;
      
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
      
      // Update current price and calculate price change
      if (formattedData.length > 0) {
        const latestPrice = formattedData[formattedData.length - 1].close;
        setCurrentPrice(latestPrice);
        
        // Calculate price change percentage if we have at least 2 data points
        if (formattedData.length > 1) {
          const previousPrice = formattedData[0].open;
          const changePercent = ((latestPrice - previousPrice) / previousPrice) * 100;
          setPriceChange(changePercent);
        } else {
          setPriceChange(0);
        }
        
        // Notify parent component if callback is provided
        if (onPriceUpdate) {
          onPriceUpdate(latestPrice);
        }
      }
    } catch (error: any) {
      console.error('Error fetching chart data:', error);
      
      // If the API failed, use simulation data in development or show error
      if (simulationMode && simulationData.length > 0) {
        console.log('Using simulation data instead');
        setChartData(simulationData);
        
        // Update current price from simulation data
        const latestPrice = simulationData[simulationData.length - 1].close;
        setCurrentPrice(latestPrice);
        
        // Calculate simulated price change
        if (simulationData.length > 1) {
          const previousPrice = simulationData[0].open;
          const changePercent = ((latestPrice - previousPrice) / previousPrice) * 100;
          setPriceChange(changePercent);
        }
        
        // Notify parent
        if (onPriceUpdate) {
          onPriceUpdate(latestPrice);
        }
      } else {
        setError(error.message || 'Failed to fetch chart data');
        
        // Implement exponential backoff for retries
        const shouldRetry = requestStateRef.current.retryCount < 3; // Max 3 retries
        
        if (shouldRetry) {
          const retryDelay = 2000 * Math.pow(2, requestStateRef.current.retryCount); // Exponential backoff
          console.log(`Scheduling retry in ${retryDelay}ms (attempt ${requestStateRef.current.retryCount + 1}/3)`);
          
          requestStateRef.current.retryCount++;
          
          if (!requestStateRef.current.retryTimeout) {
            requestStateRef.current.retryTimeout = setTimeout(() => {
              requestStateRef.current.retryTimeout = null;
              fetchChartData();
            }, retryDelay);
          }
        }
      }
    } finally {
      requestStateRef.current.pendingRequest = false;
      setLoading(false);
    }
  }, [symbol, timeframe, convertTimeframeToApi, simulationMode, simulationData, onPriceUpdate]);

  // Initial data fetch
  useEffect(() => {
    isMounted.current = true;
    
    // Clear previous data and chart when symbol or timeframe changes
    setChartData([]);
    setCurrentPrice(null);
    setPriceChange(0);
    
    // Reset chart
    if (chartRef.current) {
      try {
        // Remove all series first
        if (candleSeriesRef.current) {
          chartRef.current.removeSeries(candleSeriesRef.current);
          candleSeriesRef.current = null;
        }
        
        if (lineSeriesRef.current) {
          chartRef.current.removeSeries(lineSeriesRef.current);
          lineSeriesRef.current = null;
        }
        
        if (areaSeriesRef.current) {
          chartRef.current.removeSeries(areaSeriesRef.current);
          areaSeriesRef.current = null;
        }
        
        if (barSeriesRef.current) {
          chartRef.current.removeSeries(barSeriesRef.current);
          barSeriesRef.current = null;
        }
        
        if (volumeSeriesRef.current) {
          chartRef.current.removeSeries(volumeSeriesRef.current);
          volumeSeriesRef.current = null;
        }
      } catch (error) {
        console.error('Error resetting chart:', error);
      }
    }
    
    // Fetch new data
    fetchChartData();
    
    return () => {
      isMounted.current = false;
      
      // Clear any pending timeouts
      if (requestStateRef.current.retryTimeout) {
        clearTimeout(requestStateRef.current.retryTimeout);
        requestStateRef.current.retryTimeout = null;
      }
    };
  }, [symbol, timeframe, fetchChartData]);

  // Effect to initialize and update the chart
  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length) return;
    
    // Define resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        try {
          chartRef.current.resize(
            chartContainerRef.current.clientWidth,
            chartContainerRef.current.clientHeight
          );
        } catch (error) {
          console.error("Error resizing chart:", error);
        }
      }
    };
    
    // Get theme colors
    const isDarkTheme = theme === 'dark';
    const textColor = isDarkTheme ? '#E1E1E6' : '#1D1D1F';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const backgroundColor = isDarkTheme ? '#1A1A1A' : '#FFFFFF';
    const upColor = '#4CAF50'; // Green
    const downColor = '#F44336'; // Red
    
    // If no chart exists, create a new one
    if (!chartRef.current) {
      try {
        console.log("Creating new chart");
        
        // Ensure the library is loaded
        if (!LightweightCharts) {
          console.error("LightweightCharts library not loaded");
          setError("Chart library not loaded. Please try refreshing the page.");
          return;
        }
        
        // Create the chart instance with a safer approach
        const chart = LightweightCharts.createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { type: LightweightCharts.ColorType.Solid, color: backgroundColor },
            textColor: textColor,
          },
          grid: {
            vertLines: { color: gridColor, style: LightweightCharts.LineStyle.Dotted },
            horzLines: { color: gridColor, style: LightweightCharts.LineStyle.Dotted },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: gridColor,
          },
          rightPriceScale: {
            borderColor: gridColor,
          },
          crosshair: {
            mode: 1, // CrosshairMode.Normal
            vertLine: {
              width: 1,
              color: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              style: LightweightCharts.LineStyle.Solid,
            },
            horzLine: {
              width: 1,
              color: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              style: LightweightCharts.LineStyle.Solid,
            },
          }
        });
        
        // Store the chart in ref
        chartRef.current = chart;
        
        // Verify chart is properly initialized
        if (!isChartInitialized(chart)) {
          console.error("Chart created but methods are missing");
          setError("Chart library not properly initialized. Try refreshing the page.");
          return;
        }
        
        console.log("Chart initialized successfully");
        
        // Setup crosshair move handler for price hover
        chart.subscribeCrosshairMove(handleCrosshairMove);
        
        // Listen for resize events
        window.addEventListener('resize', handleResize);
      } catch (error) {
        console.error("Error creating chart:", error);
        setError("Failed to create chart. Please try refreshing the page.");
        return;
      }
    }
    
    // Format data for chart (with proper time formatting)
    const formattedData = chartData.map(d => ({
      time: Math.floor(d.time / 1000), // Convert to seconds for the chart
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      value: d.close, // For line/area charts
    }));
    
    // Function to create and update series based on chart style
    const updateChartSeries = () => {
      // Safety check - ensure chart is initialized properly
      if (!chartRef.current || !isChartInitialized(chartRef.current)) {
        console.error("Chart not properly initialized when updating series");
        return;
      }
      
      try {
        // Remove all existing series
        if (candleSeriesRef.current) {
          chartRef.current.removeSeries(candleSeriesRef.current);
          candleSeriesRef.current = null;
        }
        
        if (lineSeriesRef.current) {
          chartRef.current.removeSeries(lineSeriesRef.current);
          lineSeriesRef.current = null;
        }
        
        if (areaSeriesRef.current) {
          chartRef.current.removeSeries(areaSeriesRef.current);
          areaSeriesRef.current = null;
        }
        
        if (barSeriesRef.current) {
          chartRef.current.removeSeries(barSeriesRef.current);
          barSeriesRef.current = null;
        }
        
        if (volumeSeriesRef.current) {
          chartRef.current.removeSeries(volumeSeriesRef.current);
          volumeSeriesRef.current = null;
        }
        
        // Always create a line series first as fallback
        lineSeriesRef.current = chartRef.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
        
        lineSeriesRef.current.setData(formattedData.map(d => ({
          time: d.time,
          value: d.close,
        })));
        console.log("Line series created successfully");
        
        // Try to create the requested chart style if it's not a line chart
        if (chartStyle !== 'line') {
          try {
            switch (chartStyle) {
              case 'candles':
                candleSeriesRef.current = chartRef.current.addCandlestickSeries({
                  upColor,
                  downColor,
                  borderVisible: false,
                  wickUpColor: upColor,
                  wickDownColor: downColor,
                });
                
                candleSeriesRef.current.setData(formattedData);
                
                // Hide the line series if candlestick is successful
                if (candleSeriesRef.current) {
                  chartRef.current.removeSeries(lineSeriesRef.current);
                  lineSeriesRef.current = null;
                }
                break;
                
              case 'area':
                areaSeriesRef.current = chartRef.current.addAreaSeries({
                  topColor: isDarkTheme ? 'rgba(41, 98, 255, 0.56)' : 'rgba(41, 98, 255, 0.56)',
                  bottomColor: isDarkTheme ? 'rgba(41, 98, 255, 0.04)' : 'rgba(41, 98, 255, 0.04)',
                  lineColor: '#2962FF',
                  lineWidth: 2,
                });
                
                areaSeriesRef.current.setData(formattedData.map(d => ({
                  time: d.time,
                  value: d.close,
                })));
                
                // Hide the line series if area is successful
                if (areaSeriesRef.current) {
                  chartRef.current.removeSeries(lineSeriesRef.current);
                  lineSeriesRef.current = null;
                }
                break;
                
              case 'bars':
                barSeriesRef.current = chartRef.current.addBarSeries({
                  upColor,
                  downColor,
                });
                
                barSeriesRef.current.setData(formattedData);
                
                // Hide the line series if bar is successful
                if (barSeriesRef.current) {
                  chartRef.current.removeSeries(lineSeriesRef.current);
                  lineSeriesRef.current = null;
                }
                break;
            }
          } catch (error) {
            console.error(`Error creating ${chartStyle} series, falling back to line:`, error);
            // We already have a line series as fallback, so no need to do anything
          }
        }
        
        // Only try to add volume if we have a main series
        const mainSeries = candleSeriesRef.current || lineSeriesRef.current || 
                          areaSeriesRef.current || barSeriesRef.current;
                          
        if (mainSeries && indicators.some(i => i.type === 'volume' && i.visible)) {
          try {
            volumeSeriesRef.current = chartRef.current.addHistogramSeries({
              color: '#26a69a',
              priceScaleId: 'volume',
              scaleMargins: {
                top: 0.8,
                bottom: 0,
              },
            });
            
            volumeSeriesRef.current.setData(chartData.map(d => ({
              time: Math.floor(d.time / 1000),
              value: d.volume,
              color: d.close >= d.open ? upColor : downColor,
            })));
            console.log("Volume series created successfully");
          } catch (error) {
            console.error("Error adding volume series:", error);
          }
        }
        
        // Fit content to the visible range
        chartRef.current.timeScale().fitContent();
      } catch (error) {
        console.error("Error updating chart series:", error);
      }
    };
    
    // Update series when data or chart style changes
    updateChartSeries();
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chartData, chartStyle, theme, indicators]);

  // Handle crosshair move to show price at cursor position
  const handleCrosshairMove = useCallback((param: any) => {
    if (
      !param ||
      !param.point ||
      !param.time ||
      param.point.x < 0 ||
      param.point.y < 0
    ) {
      // Reset hovered price when cursor leaves chart
      setHoveredPrice(null);
      return;
    }
    
    // Get price from parameter
    const price = param.seriesPrices.get(
      candleSeriesRef.current || 
      lineSeriesRef.current || 
      areaSeriesRef.current || 
      barSeriesRef.current
    );
    
    if (price !== undefined) {
      setHoveredPrice(price);
    }
  }, []);

  // Refresh data periodically (every 15 seconds)
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date()); // Update time display
      
      // Only auto-refresh if not already loading
      if (!loading && !requestStateRef.current.pendingRequest) {
        fetchChartData();
      }
    }, 15000);
    
    return () => clearInterval(intervalId);
  }, [loading, fetchChartData]);
  
  // Toggle chart style
  const toggleChartStyle = (style: ChartStyleType) => {
    setChartStyle(style);
  };
  
  // Toggle indicator visibility
  const toggleIndicator = (type: IndicatorType) => {
    setIndicators(prev => 
      prev.map(ind => 
        ind.type === type 
          ? { ...ind, visible: !ind.visible } 
          : ind
      )
    );
  };
  
  // Toggle time period
  const handleTimeframeChange = (newTimeframe: ChartTimeframeType) => {
    setTimeframe(newTimeframe);
  };
  
  // Toggle period
  const handlePeriodChange = (newPeriod: ChartPeriodType) => {
    setChartPeriod(newPeriod);
  };
  
  // Format the price change as a string with sign and percentage
  const formattedPriceChange = priceChange !== null
    ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`
    : '0.00%';
  
  // Determine price change color
  const priceChangeColor = priceChange >= 0 ? 'text-green-500' : 'text-red-500';

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
            variant={chartStyle === 'candles' ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => toggleChartStyle('candles')}
            className="h-8"
          >
            <CandlestickChart className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Candles</span>
          </Button>
          
          <Button 
            variant={chartStyle === 'bars' ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => toggleChartStyle('bars')}
            className="h-8"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Bars</span>
          </Button>
          
          <Button 
            variant={chartStyle === 'line' ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => toggleChartStyle('line')}
            className="h-8"
          >
            <LineChart className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Line</span>
          </Button>
          
          <Button 
            variant={chartStyle === 'area' ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => toggleChartStyle('area')}
            className="h-8"
          >
            <AreaChart className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Area</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
            className="h-8"
          >
            <Activity className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Indicators</span>
          </Button>
        </div>
        
        <div className="flex items-center">
          <Select value={timeframe} onValueChange={(value) => handleTimeframeChange(value as ChartTimeframeType)}>
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
      
      {/* Indicator Panel (collapsible) */}
      {showIndicatorPanel && (
        <div className="px-4 py-2 border-b bg-muted/30 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {indicators.map((indicator) => (
            <div key={indicator.type} className="flex items-center space-x-2">
              <Switch 
                id={`indicator-${indicator.type}`}
                checked={indicator.visible}
                onCheckedChange={() => toggleIndicator(indicator.type)}
              />
              <Label htmlFor={`indicator-${indicator.type}`}>{indicator.type.toUpperCase()}</Label>
            </div>
          ))}
        </div>
      )}
      
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
        
        <div 
          ref={chartContainerRef} 
          className="w-full h-full"
        />
      </CardContent>
      
      {/* Order Panel (if enabled) */}
      {showOrderPanel && (
        <CardFooter className="border-t p-4">
          <div className="w-full grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="buy-price">Buy Price</Label>
              <Input 
                id="buy-price"
                type="number"
                placeholder="0.00"
                value={currentPrice?.toString() || ''}
                className="mt-1"
              />
              <Button className="w-full mt-2 bg-green-600 hover:bg-green-700">Buy</Button>
            </div>
            <div>
              <Label htmlFor="sell-price">Sell Price</Label>
              <Input 
                id="sell-price"
                type="number"
                placeholder="0.00"
                value={currentPrice?.toString() || ''}
                className="mt-1"
              />
              <Button variant="destructive" className="w-full mt-2">Sell</Button>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
} 