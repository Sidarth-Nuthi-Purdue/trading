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

// Import LightweightCharts library
import * as LightweightCharts from 'lightweight-charts';

// Create a lazy loading mechanism for the chart library
const getLightweightCharts = () => {
  if (typeof window !== 'undefined') {
    // Ensure the library is loaded in the browser
    return require('lightweight-charts');
  }
  return null;
};

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
  // Simple check if chart exists and is an object
  if (!chart || typeof chart !== 'object') return false;
  
  // Log available methods to debug
  console.log('Chart prototype methods:', 
    Object.getOwnPropertyNames(Object.getPrototypeOf(chart))
      .filter(name => typeof chart[name] === 'function')
  );
  
  // More lenient check - just make sure we have basic functionality
  return chart && 
         (typeof chart.addCandlestickSeries === 'function' || 
          typeof chart.addLineSeries === 'function');
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
  const [chartStyle, setChartStyle] = useState<ChartStyleType>('candles');
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
  const candleSeriesRef = useRef<any>(null);
  const lineSeriesRef = useRef<any>(null);
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
      console.log(`Fetching chart data for ${symbol} with timeframe ${convertTimeframeToApi(timeframe)} ${Math.floor(Math.random() * 10)}`);
      
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
        time: new Date(bar.t).getTime() / 1000, // Convert to seconds for the chart
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
        
        // Notify parent component of price update
        if (onPriceUpdate) {
          onPriceUpdate(latestPrice);
        }
      }
      
      // Get the latest quote for real-time bid/ask
      // Only fetch quote if we successfully got bars and not too frequently
      setTimeout(() => {
        fetchLatestQuote();
      }, 1000); // Add a delay to avoid too many requests at once
      
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setError(`Failed to fetch chart data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Increment retry count on failure
      requestStateRef.current.retryCount++;
      
      // Exponential backoff based on retry count
      const backoffTime = Math.min(30000, 1000 * Math.pow(2, requestStateRef.current.retryCount));
      
      // Schedule another retry with backoff
      if (!requestStateRef.current.retryTimeout) {
        console.log(`Scheduling retry with backoff: ${backoffTime}ms`);
        requestStateRef.current.retryTimeout = setTimeout(() => {
          requestStateRef.current.retryTimeout = null;
          fetchChartData();
        }, backoffTime);
      }
    } finally {
      setLoading(false);
      requestStateRef.current.pendingRequest = false;
    }
  }, [symbol, timeframe, convertTimeframeToApi, onPriceUpdate]);
  
  // Create a debounced version of fetchChartData
  const debouncedFetchChartData = useCallback(
    debounce(() => {
      fetchChartData();
    }, 300), // 300ms debounce time
    [fetchChartData]
  );

  // Add a function to fetch the latest quote with rate limiting
  const fetchLatestQuote = useCallback(async () => {
    if (!symbol) return;
    
    try {
      const response = await fetch(`/api/alpaca/market-data/quotes/latest?symbol=${symbol}`);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Failed to fetch latest quote: Too Many Requests`);
        } else {
          console.warn(`Failed to fetch latest quote: ${response.statusText}`);
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.quote) {
        const quote = data.quote;
        setLevel2Data(prev => ({
          ...prev,
          bids: [{ price: quote.bp, size: quote.bs }],
          asks: [{ price: quote.ap, size: quote.as }]
        }));
      }
      
      // Also fetch latest trades if needed
      try {
        const tradesResponse = await fetch(`/api/alpaca/market-data/trades?symbol=${symbol}`);
        // Process trades if needed
      } catch (tradeError) {
        console.warn('Error fetching trades:', tradeError);
      }
    } catch (error) {
      console.warn('Error fetching latest quote:', error);
    }
  }, [symbol]);

  // Initialize/update chart when data changes or theme changes
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
        
        // Make sure LightweightCharts is properly loaded before creating the chart
        if (!LightweightCharts || typeof LightweightCharts.createChart !== 'function') {
          console.error("LightweightCharts library not properly loaded");
          setError("Chart library not loaded properly. Try refreshing the page.");
          return;
        }
        
        // Explicitly import required modules before creating chart
        const { createChart, ColorType, LineStyle } = LightweightCharts;
        
        // Create the chart instance
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: backgroundColor },
            textColor: textColor,
          },
          grid: {
            vertLines: { color: gridColor, style: LineStyle.Dotted },
            horzLines: { color: gridColor, style: LineStyle.Dotted },
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
              style: LineStyle.Solid,
            },
            horzLine: {
              width: 1,
              color: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              style: LineStyle.Solid,
            },
          }
        });
        
        // Store the chart in ref
        chartRef.current = chart;
        
        // Verify chart is properly initialized
        if (!isChartInitialized(chart)) {
          console.error("Chart created but methods are missing");
          
          // Check which methods are actually available
          console.log("Chart methods available:", Object.keys(chart));
          console.log("Chart prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(chart)));
          
          setError("Chart library not properly initialized. Try refreshing the page.");
          return;
        }
        
        console.log("Chart initialized successfully");
        
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
        
        // Simplified series creation with better error handling
        switch (chartStyle) {
          case 'candles':
            try {
              candleSeriesRef.current = chartRef.current.addCandlestickSeries({
                upColor,
                downColor,
                borderVisible: false,
                wickUpColor: upColor,
                wickDownColor: downColor,
              });
              
              candleSeriesRef.current.setData(formattedData);
              console.log("Candlestick series created successfully");
            } catch (error) {
              console.error("Error adding candlestick series, falling back to line:", error);
              chartStyle = 'line'; // Fall through to line case
            }
            break;
        }
        
        // If candlestick failed or style is line, try line series
        if (chartStyle === 'line') {
          try {
            lineSeriesRef.current = chartRef.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
            
            lineSeriesRef.current.setData(formattedData.map(d => ({
              time: d.time,
              value: d.close,
            })));
            console.log("Line series created successfully");
          } catch (error) {
            console.error("Error creating line series:", error);
            setError("Failed to create chart. Please try a different chart style.");
          }
        }
        
        // Only try to add volume if we have a main series
        if ((candleSeriesRef.current || lineSeriesRef.current) && indicators.some(i => i.type === 'volume' && i.visible)) {
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
  
  // Setup real-time refresh for 1-minute charts with progressive backoff for rate limiting
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // Adjusted fetch handler that respects rate limits
    const fetchWithBackoff = () => {
      // Only trigger a fetch if we're not already waiting for one
      if (!requestStateRef.current.pendingRequest && !requestStateRef.current.retryTimeout) {
        debouncedFetchChartData();
      }
    };
    
    // If 1-minute or 5-minute chart, refresh data periodically for near real-time updates
    if ((timeframe === '1m' || timeframe === '5m') && symbol) {
      // Base interval with exponential backoff based on retry count
      const retryFactor = Math.min(requestStateRef.current.retryCount, 4);
      const actualInterval = 10000 * Math.pow(2, retryFactor); // Start at 10s, double each retry up to 160s
      
      console.log(`Set up auto-refresh every ${actualInterval}ms for ${timeframe} chart`);
      
      intervalId = setInterval(fetchWithBackoff, actualInterval);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [timeframe, symbol, debouncedFetchChartData]);
  
  // Initialize chart once on mount
  useEffect(() => {
    isMounted.current = true;
    
    // Fetch initial data with a small delay to prevent immediate rate limiting
    setTimeout(() => {
      debouncedFetchChartData();
    }, 100);
    
    return () => {
      isMounted.current = false;
      
      // Cleanup chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      
      // Clear any pending timeouts
      if (requestStateRef.current.retryTimeout) {
        clearTimeout(requestStateRef.current.retryTimeout);
        requestStateRef.current.retryTimeout = null;
      }
    };
  }, [debouncedFetchChartData]);
  
  // Update clock every second
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Add crosshair move handler
  useEffect(() => {
    if (!chartRef.current) return;
    
    const handleCrosshairMove = (param: any) => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        setHoveredPrice(null);
        return;
      }
      
      // Find the price from the appropriate series
      let price = null;
      let series = null;
      
      if (candleSeriesRef.current) series = candleSeriesRef.current;
      else if (lineSeriesRef.current) series = lineSeriesRef.current;
      else if (areaSeriesRef.current) series = areaSeriesRef.current;
      else if (barSeriesRef.current) series = barSeriesRef.current;
      
      if (series && param.seriesData.has(series)) {
        const data = param.seriesData.get(series);
        if (data) {
          price = typeof data === 'number' ? data : data.close || data.value;
        }
      }
      
      if (price !== null) {
        setHoveredPrice(price);
      }
    };
    
    // Subscribe to crosshair move
    const unsubscribe = chartRef.current.subscribeCrosshairMove(handleCrosshairMove);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  
  // Apply technical indicators
  const applyIndicators = useCallback(() => {
    if (!chartRef.current || chartData.length === 0) return;
    
    // Clear existing indicator series
    Object.values(indicatorSeriesRefs.current).forEach(seriesArray => {
      seriesArray.forEach(series => {
        try {
          chartRef.current.removeSeries(series);
        } catch (error) {
          console.error("Error removing indicator series:", error);
        }
      });
    });
    
    indicatorSeriesRefs.current = {};
    
    // Add indicators based on which ones are visible
    indicators.forEach(indicator => {
      if (!indicator.visible || indicator.type === 'volume') return;
      
      switch (indicator.type) {
        case 'sma':
          try {
            // Calculate SMA
          const period = indicator.params.period;
            const smaData = [];
            
          for (let i = period - 1; i < chartData.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
              sum += chartData[i - j].close;
            }
            const average = sum / period;
              smaData.push({
                time: Math.floor(chartData[i].time / 1000),
              value: average
            });
          }
          
            const smaSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 1,
            priceLineVisible: false,
              lastValueVisible: false,
          });
            
            smaSeries.setData(smaData);
          
          if (!indicatorSeriesRefs.current['sma']) {
            indicatorSeriesRefs.current['sma'] = [];
          }
          indicatorSeriesRefs.current['sma'].push(smaSeries);
          } catch (error) {
            console.error("Error applying SMA indicator:", error);
        }
          break;
        
        case 'ema':
          try {
            // Calculate EMA
          const period = indicator.params.period;
          const k = 2 / (period + 1);
            const emaData = [];
            
            // Initial value is SMA
            let sum = 0;
            for (let i = 0; i < period; i++) {
              sum += chartData[i].close;
            }
            let ema = sum / period;
            
            emaData.push({
              time: Math.floor(chartData[period - 1].time / 1000),
              value: ema
            });
            
            for (let i = period; i < chartData.length; i++) {
            ema = chartData[i].close * k + ema * (1 - k);
              emaData.push({
                time: Math.floor(chartData[i].time / 1000),
              value: ema
            });
          }
          
            const emaSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 1,
            priceLineVisible: false,
              lastValueVisible: false,
          });
            
            emaSeries.setData(emaData);
          
          if (!indicatorSeriesRefs.current['ema']) {
            indicatorSeriesRefs.current['ema'] = [];
          }
          indicatorSeriesRefs.current['ema'].push(emaSeries);
          } catch (error) {
            console.error("Error applying EMA indicator:", error);
          }
          break;
      }
    });
  }, [chartData, indicators]);
  
  // Apply indicators when they change
  useEffect(() => {
    applyIndicators();
  }, [indicators, applyIndicators]);
  
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
  
  // Update chart data when symbol or timeframe changes
  useEffect(() => {
    if (isMounted.current) {
      // Use a small delay to prevent immediate rate limiting
      setTimeout(() => {
        debouncedFetchChartData();
      }, 300);
    }
  }, [symbol, timeframe, debouncedFetchChartData]);

  // Render the chart UI
    return (
    <Card className="w-full max-w-full overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold tracking-tight">{symbol || 'Chart'}</h2>
            {currentPrice && (
              <Badge variant={priceChange >= 0 ? 'success' : 'destructive'} className="h-6 px-2">
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </Badge>
            )}
        </div>
          
          <div className="flex items-center space-x-1 text-sm">
        <Button 
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => debouncedFetchChartData()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
            
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex flex-wrap items-center gap-2">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
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
          
            <div className="flex items-center space-x-1">
          <Button 
                variant={chartStyle === 'candles' ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setChartStyle('candles')}
              >
                <CandlestickChart className="h-4 w-4" />
          </Button>
          <Button 
                variant={chartStyle === 'line' ? 'default' : 'outline'}
                size="icon" 
                className="h-8 w-8"
                onClick={() => setChartStyle('line')}
              >
                <LineChart className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Switch 
                id="level2" 
                checked={showLevel2Panel}
                onCheckedChange={setShowLevel2Panel}
                className="h-4 w-7"
              />
              <Label htmlFor="level2" className="text-xs">Level 2</Label>
        </div>
            {currentPrice && (
              <div className="text-lg font-semibold">${currentPrice.toFixed(2)}</div>
        )}
      </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {error ? (
          <div className="flex h-[400px] w-full flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-10 w-10 text-destructive mb-2" />
            <h3 className="text-lg font-semibold">Chart Error</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button 
              onClick={() => {
                setError(null);
                setTimeout(() => debouncedFetchChartData(), 500);
              }}
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="relative">
        {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
            <div 
              ref={chartContainerRef} 
              className="h-[400px] w-full"
            />
            
            {/* Add Level 2 data display */}
            {showLevel2Panel && level2Data && (
              <div className="absolute top-2 right-2 bg-background/80 p-2 rounded border text-xs">
                <div className="grid grid-cols-3 gap-x-2">
                  <div className="font-semibold">Size</div>
                  <div className="font-semibold text-center">Bid</div>
                  <div className="font-semibold text-center">Ask</div>
                  
                  {level2Data.bids.slice(0, 1).map((bid, i) => (
                    <React.Fragment key={`bid-${i}`}>
                      <div>{formatVolume(bid.size)}</div>
                      <div className="text-green-500">${bid.price.toFixed(2)}</div>
                      <div className="text-red-500">${level2Data.asks[i]?.price.toFixed(2) || '--'}</div>
                    </React.Fragment>
                  ))}
                  
                  {level2Data.bids.length > 0 && level2Data.asks.length > 0 && (
                    <div className="col-span-3 text-center mt-1">
                      Spread: ${(level2Data.asks[0]?.price - level2Data.bids[0]?.price).toFixed(2)}
      </div>
                  )}
    </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 