import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { TimeframeType, fetchBars, AlpacaBar } from '@/lib/alpaca-api';
import { Card, CardContent } from './ui/card';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, ReferenceLine, LineChart, Line, ComposedChart, Scatter
} from 'recharts';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Clock, BarChart2, LineChart as LineChartIcon, CandlestickChart as CandlestickIcon, Mountain, TrendingUp, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

// Type for chart data
type ChartData = {
  timestamp: string;
  value: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time?: string;
  date?: string;
  ma?: number; // Moving average value
}

// Types for props
export type TimeframeType = '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '1Day' | '1Week' | '1Month';

// Chart type definition
export type ChartType = 'line' | 'candle' | 'bar' | 'mountain' | 'baseline';

type StockChartProps = {
  symbol: string;
  title?: string;
  initialTimeframe?: TimeframeType;
  timeframe?: TimeframeType;
  onTimeframeChange?: (timeframe: TimeframeType) => void;
  height?: number | string;
  onClose?: () => void;
  onExpand?: () => void;
  showExpandButton?: boolean;
  expanded?: boolean;
  isExpandable?: boolean;
  isFullWidth?: boolean;
  showVolume?: boolean;
  showMA?: boolean;
  maLength?: number;
  onCrosshairMove?: (price: number, time: string) => void;
  initialChartType?: ChartType;
  simulationMode?: boolean;
  simulationData?: AlpacaBar[];
};

// Check if market is currently open (simplified version)
function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // Weekend check (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;
  
  // Convert to Eastern Time (approximated, proper implementation would use a timezone library)
  const estHours = (hours + 24 - 5) % 24; // Simple approximation of EST
  
  // Regular market hours: 9:30 AM - 4:00 PM EST
  if (estHours > 9 || (estHours === 9 && minutes >= 30)) {
    if (estHours < 16) {
      return true;
    }
  }
  
  return false;
}

// Get market status text
function getMarketStatus(): { status: string; color: string } {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  
  // Convert to Eastern Time (approximated)
  const estHours = (hours + 24 - 5) % 24;
  
  // Weekend
  if (day === 0 || day === 6) {
    return { status: 'Market Closed (Weekend)', color: 'text-orange-500' };
  }
  
  // Pre-market (4:00 AM - 9:30 AM EST)
  if ((estHours >= 4 && estHours < 9) || (estHours === 9 && now.getMinutes() < 30)) {
    return { status: 'Pre-Market', color: 'text-blue-500' };
  }
  
  // Regular hours (9:30 AM - 4:00 PM EST)
  if ((estHours > 9 || (estHours === 9 && now.getMinutes() >= 30)) && estHours < 16) {
    return { status: 'Market Open', color: 'text-green-500' };
  }
  
  // After-hours (4:00 PM - 8:00 PM EST)
  if (estHours >= 16 && estHours < 20) {
    return { status: 'After Hours', color: 'text-purple-500' };
  }
  
  // Closed
  return { status: 'Market Closed', color: 'text-red-500' };
}

// Chart type settings - define icons and labels for each chart type
const chartTypeSettings: Record<ChartType, { icon: React.ReactNode; label: string }> = {
  candle: { icon: <CandlestickIcon className="h-4 w-4" />, label: 'Candle' },
  line: { icon: <LineChartIcon className="h-4 w-4" />, label: 'Line' },
  bar: { icon: <BarChart2 className="h-4 w-4" />, label: 'Bar' },
  mountain: { icon: <Mountain className="h-4 w-4" />, label: 'Mountain' },
  baseline: { icon: <TrendingUp className="h-4 w-4" />, label: 'Baseline' },
};

export default function StockChart({
  symbol,
  title,
  initialTimeframe = '1Day',
  timeframe: externalTimeframe,
  onTimeframeChange,
  height = 300,
  onClose,
  onExpand,
  showExpandButton = false,
  expanded = false,
  isExpandable = false,
  isFullWidth = false,
  showVolume = true,
  showMA = false,
  maLength = 20,
  onCrosshairMove,
  initialChartType = 'candle',
  simulationMode = false,
  simulationData,
}: StockChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [internalTimeframe, setInternalTimeframe] = useState<TimeframeType>(initialTimeframe);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [percentChange, setPercentChange] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const { resolvedTheme } = useTheme();

  // Use external timeframe if provided (controlled component), otherwise use internal state
  const timeframe = externalTimeframe || internalTimeframe;

  const isDarkTheme = resolvedTheme === 'dark';

  // Update market status every minute
  useEffect(() => {
    const statusInterval = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 60000); // Update every minute
    
    return () => clearInterval(statusInterval);
  }, []);

  // Function to format date/time based on timeframe
  const formatDateTime = (timestamp: string, timeframeType: TimeframeType): { time?: string; date?: string } => {
    const date = new Date(timestamp);
    
    // For intraday timeframes, show time
    if (['1Min', '5Min', '15Min', '30Min', '1Hour'].includes(timeframeType)) {
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      };
    }
    
    // For daily or longer timeframes, show date only
    return {
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    };
  };

  // Calculate moving average
  const calculateMovingAverage = (data: ChartData[], period: number): ChartData[] => {
    if (!data || data.length === 0 || !showMA) return data;

    const result = [...data];
    
    for (let i = 0; i < result.length; i++) {
      if (i < period - 1) {
        result[i].ma = undefined; // Not enough data points yet
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += result[i - j].close;
        }
        result[i].ma = parseFloat((sum / period).toFixed(2));
      }
    }
    
    return result;
  };

  // Fetch data on mount and when timeframe changes
  useEffect(() => {
    // If in simulation mode, use the simulation data instead of fetching from API
    if (simulationMode && simulationData && simulationData.length > 0) {
      try {
        // Transform simulation data to chart data
        const chartData = simulationData.map((bar: AlpacaBar) => {
          const dateTime = formatDateTime(bar.t, timeframe);
          
          return {
            timestamp: bar.t,
            value: bar.c,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
            ...dateTime
          };
        });
        
        // Apply moving average if enabled
        const processedData = showMA ? calculateMovingAverage(chartData, maLength) : chartData;
        setData(processedData);
        
        // Set current price and change
        if (chartData.length > 0) {
          const latestBar = chartData[chartData.length - 1];
          const firstBar = chartData[0];
          
          setCurrentPrice(latestBar.close);
          const change = latestBar.close - firstBar.open;
          setPriceChange(change);
          setPercentChange((change / firstBar.open) * 100);
          setLastUpdated(new Date(latestBar.timestamp));
        }
        
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error processing simulation data:', err);
        setError('Failed to process simulation data');
        setLoading(false);
      }
    }
    
    // Only fetch from API if not in simulation mode
    if (!simulationMode) {
      const getChartData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const response = await fetchBars(
            symbol, 
            timeframe, 
            100,
            'iex'
          );
          
          if (!response.bars || response.bars.length === 0) {
            throw new Error('No data available');
          }
          
          // Transform API response to chart data
          const chartData = response.bars.map((bar: AlpacaBar) => {
            const dateTime = formatDateTime(bar.t, timeframe);
            
            return {
              timestamp: bar.t,
              value: bar.c,
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              ...dateTime
            };
          });
          
          // Apply moving average if enabled
          const processedData = showMA ? calculateMovingAverage(chartData, maLength) : chartData;
          setData(processedData);
          
          // Calculate current price and change
          const latestBar = response.bars[response.bars.length - 1];
          const firstBar = response.bars[0];
          
          if (latestBar && firstBar) {
            setCurrentPrice(latestBar.c);
            const change = latestBar.c - firstBar.o;
            setPriceChange(change);
            setPercentChange((change / firstBar.o) * 100);
            setLastUpdated(new Date(latestBar.t));
          }
        } catch (err) {
          console.error('Error fetching chart data:', err);
          setError('Failed to load chart data');
        } finally {
          setLoading(false);
        }
      };
      
      getChartData();
      
      // Set up polling interval based on market status and timeframe
      const marketOpen = isMarketOpen();
      const isIntraday = ['1Min', '5Min', '15Min', '30Min', '1Hour'].includes(timeframe);
      
      // Poll more frequently during market hours and for intraday charts
      let pollInterval = 30000; // Default 30 seconds
      
      if (marketOpen && isIntraday) {
        // During market hours with intraday timeframes, poll every 10 seconds
        pollInterval = 10000;
      } else if (!marketOpen && isIntraday) {
        // Outside market hours with intraday timeframes, poll every minute
        pollInterval = 60000;
      } else {
        // For daily/weekly/monthly charts, poll every 5 minutes
        pollInterval = 300000;
      }
      
      const interval = setInterval(getChartData, pollInterval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [symbol, timeframe, showMA, maLength, simulationMode, simulationData]);

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: TimeframeType) => {
    if (onTimeframeChange) {
      onTimeframeChange(newTimeframe);
    } else {
      setInternalTimeframe(newTimeframe);
    }
  };

  // Handle chart type change
  const handleChartTypeChange = (newChartType: ChartType) => {
    setChartType(newChartType);
  };

  // Helper function to safely format price values
  const formatPrice = (price: number | null): string => {
    if (price === null || typeof price !== 'number' || isNaN(price)) {
      return 'N/A';
    }
    return price.toFixed(2);
  };

  // Memoize chart color based on price change
  const chartColor = useMemo(() => {
    if (priceChange === null) return '#10b981'; // Default green
    return priceChange >= 0 ? '#10b981' : '#ef4444';
  }, [priceChange]);

  // Timeframe buttons
  const timeframeButtons: TimeframeType[] = ['1Min', '5Min', '15Min', '30Min', '1Hour', '1Day', '1Week', '1Month'];

  // Determine if we should show expand button (either through direct prop or legacy isExpandable)
  const shouldShowExpandButton = showExpandButton || isExpandable;

  // Prepare data for candlestick chart
  const prepareCandlestickData = (data: ChartData[]) => {
    return data.map(item => {
      // Determine if this is an up or down candle
      const isUp = item.close >= item.open;
      
      // Calculate the body (rectangle) position and size
      const bodyStart = Math.min(item.open, item.close);
      const bodyHeight = Math.abs(item.close - item.open);
      
      // Calculate wick lengths
      const upperWick = item.high - Math.max(item.open, item.close);
      const lowerWick = Math.min(item.open, item.close) - item.low;
      
      return {
        ...item,
        // For conditional styling
        isUp,
        // For candle body
        bodyStart,
        bodyHeight: Math.max(bodyHeight, 0.01), // Ensure minimum height for visibility
        // For wicks
        upperWick,
        lowerWick,
        // Center point for wick lines
        centerX: 0, // Will be determined by Recharts
        // Colors
        fillColor: isUp ? '#10b981' : '#ef4444',
        strokeColor: isUp ? '#10b981' : '#ef4444',
        wickColor: isUp ? '#10b981' : '#ef4444'
      };
    });
  };

  // Calculate price and volume ranges for better scaling
  const calculateDataRanges = (data: ChartData[]) => {
    if (!data || data.length === 0) return { min: 0, max: 0, volumeMax: 0 };
    
    let min = Number.MAX_VALUE;
    let max = Number.MIN_VALUE;
    let volumeMax = 0;
    
    data.forEach(item => {
      min = Math.min(min, item.low);
      max = Math.max(max, item.high);
      volumeMax = Math.max(volumeMax, item.volume);
    });
    
    // Add some padding to the range (5%)
    const padding = (max - min) * 0.05;
    
    return {
      min: min - padding,
      max: max + padding,
      volumeMax
    };
  };

  // Render the appropriate chart based on selected chart type
  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex justify-center items-center h-full text-muted-foreground">
          No data available
        </div>
      );
    }
    
    // Calculate data ranges for better scaling
    const { min, max } = calculateDataRanges(data);
    
    // Common props for all chart types
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
      onMouseMove: (e: any) => {
        if (onCrosshairMove && e?.activePayload?.[0]) {
          const price = e.activePayload[0].payload.close;
          const time = e.activePayload[0].payload.timestamp;
          onCrosshairMove(price, time);
        }
      }
    };

    // Common axis props
    const xAxisProps = {
      dataKey: timeframe.includes('Min') || timeframe === '1Hour' ? 'time' : 'date',
      axisLine: false,
      tickLine: false,
      minTickGap: 20,
      tick: { fontSize: 10, fill: isDarkTheme ? '#9ca3af' : '#6b7280' }
    };

    const yAxisProps = {
      domain: [min, max],
      axisLine: false,
      tickLine: false,
      orientation: "right" as const,
      tickFormatter: (value: number) => `$${value.toFixed(2)}`,
      tick: { fontSize: 10, fill: isDarkTheme ? '#9ca3af' : '#6b7280' },
      width: 60
    };

    // Common tooltip props
    const tooltipProps = {
      formatter: (value: number, name: string) => {
        if (name === 'ma') return [`$${value.toFixed(2)}`, `MA(${maLength})`];
        return [`$${value.toFixed(2)}`, name === 'close' ? 'Price' : name.charAt(0).toUpperCase() + name.slice(1)];
      },
      labelFormatter: (label: string) => {
        const item = data.find(d => d.time === label || d.date === label);
        if (!item) return label;
        
        const date = new Date(item.timestamp);
        if (timeframe.includes('Min') || timeframe === '1Hour') {
          return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }
        return date.toLocaleDateString();
      },
      contentStyle: {
        backgroundColor: isDarkTheme ? '#1e293b' : '#ffffff',
        borderColor: isDarkTheme ? '#334155' : '#e5e7eb',
        borderRadius: '0.375rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }
    };

    // Gradient definition for area charts
    const gradientDef = (
      <defs>
        <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={chartColor} stopOpacity={0.8} />
          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`gradient-volume-${symbol}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={chartColor} stopOpacity={0.5} />
          <stop offset="95%" stopColor={chartColor} stopOpacity={0.2} />
        </linearGradient>
      </defs>
    );

    // CartesianGrid common props
    const gridProps = {
      strokeDasharray: "3 3",
      vertical: false,
      opacity: isDarkTheme ? 0.1 : 0.2,
      stroke: isDarkTheme ? '#475569' : '#cbd5e1'
    };

    // Customized tooltip component
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
          <div className="bg-background border border-border rounded p-2 shadow-md text-sm">
            <div className="font-medium mb-1">
              {data.date} {data.time || ''}
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <div>Open:</div>
              <div className="text-right">${data.open.toFixed(2)}</div>
              <div>High:</div>
              <div className="text-right">${data.high.toFixed(2)}</div>
              <div>Low:</div>
              <div className="text-right">${data.low.toFixed(2)}</div>
              <div>Close:</div>
              <div className={`text-right ${data.isUp || data.close >= data.open ? 'text-green-500' : 'text-red-500'}`}>
                ${data.close.toFixed(2)}
              </div>
              <div>Volume:</div>
              <div className="text-right">{data.volume.toLocaleString()}</div>
              {data.ma && (
                <>
                  <div>{`MA(${maLength}):`}</div>
                  <div className="text-right text-purple-500">${data.ma.toFixed(2)}</div>
                </>
              )}
            </div>
          </div>
        );
      }
      return null;
    };

    switch (chartType) {
      case 'candle': {
        // Prepare candlestick data
        const candleData = prepareCandlestickData(data);
        
        // Calculate appropriate bar size based on timeframe and data density
        const dataLength = candleData.length;
        let barSize = Math.min(20, Math.max(6, 180 / dataLength)); // Responsive bar sizing
        
        return (
          <ComposedChart {...commonProps} data={candleData}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Lower Wicks */}
            <Bar 
              dataKey="lowerWick" 
              fill="none"
              stroke={(entry) => entry.wickColor}
              barSize={1}
              stackId="lowerWick"
              baseValue={(entry) => entry.bodyStart}
              isAnimationActive={false}
            />
            
            {/* Candle Bodies */}
            <Bar 
              dataKey="bodyHeight" 
              fill={(entry) => entry.fillColor}
              stroke={(entry) => entry.strokeColor}
              barSize={barSize}
              stackId="body"
              baseValue={(entry) => entry.bodyStart}
              name="Price"
              isAnimationActive={false}
              radius={[0, 0, 0, 0]}
            />
            
            {/* Upper Wicks */}
            <Bar 
              dataKey="upperWick" 
              fill="none"
              stroke={(entry) => entry.wickColor}
              barSize={1}
              stackId="upperWick"
              baseValue={(entry) => Math.max(entry.open, entry.close)}
              isAnimationActive={false}
            />
            
            {showMA && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#8884d8"
                strokeWidth={1.5}
                dot={false}
                name={`MA(${maLength})`}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        );
      }
      
      case 'line':
        return (
          <LineChart {...commonProps}>
            {gradientDef}
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="close"
              stroke={chartColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: chartColor, stroke: isDarkTheme ? '#1e293b' : '#ffffff', strokeWidth: 2 }}
              name="Price"
              isAnimationActive={false}
            />
            {showMA && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#8884d8"
                strokeWidth={1.5}
                dot={false}
                name={`MA(${maLength})`}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        );
      
      case 'bar':
        return (
          <ComposedChart {...commonProps}>
            {gradientDef}
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="close" 
              fill={chartColor}
              stroke={chartColor}
              name="Price"
              barSize={data.length > 50 ? 2 : data.length > 20 ? 4 : 6}
              isAnimationActive={false}
            />
            {showMA && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#8884d8"
                strokeWidth={1.5}
                dot={false}
                name={`MA(${maLength})`}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        );
      
      case 'mountain':
        return (
          <AreaChart {...commonProps}>
            {gradientDef}
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="close" 
              stroke={chartColor} 
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${symbol})`} 
              name="Price"
              isAnimationActive={false}
              activeDot={{ r: 4, fill: chartColor, stroke: isDarkTheme ? '#1e293b' : '#ffffff', strokeWidth: 2 }}
            />
            {showMA && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#8884d8"
                strokeWidth={1.5}
                dot={false}
                name={`MA(${maLength})`}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        );
      
      case 'baseline':
        // Find the starting price for the baseline
        const baselineValue = data[0]?.close || 0;
        
        return (
          <ComposedChart {...commonProps}>
            {gradientDef}
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={baselineValue} 
              stroke={isDarkTheme ? '#475569' : '#94a3b8'} 
              strokeDasharray="3 3" 
              label={{ 
                value: `$${baselineValue.toFixed(2)}`, 
                position: 'right',
                fill: isDarkTheme ? '#9ca3af' : '#6b7280',
                fontSize: 10
              }} 
            />
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="splitColor2" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="close"
              stroke={chartColor}
              strokeWidth={2}
              name="Price"
              isAnimationActive={false}
              activeDot={{ r: 4, fill: chartColor, stroke: isDarkTheme ? '#1e293b' : '#ffffff', strokeWidth: 2 }}
              fill="url(#splitColor)"
              fillOpacity={1}
              baseLine={baselineValue}
            />
            {showMA && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#8884d8"
                strokeWidth={1.5}
                dot={false}
                name={`MA(${maLength})`}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        );
      
      default:
        return (
          <AreaChart {...commonProps}>
            {gradientDef}
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="close" 
              stroke={chartColor} 
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${symbol})`} 
              name="Price"
              isAnimationActive={false}
              activeDot={{ r: 4, fill: chartColor, stroke: isDarkTheme ? '#1e293b' : '#ffffff', strokeWidth: 2 }}
            />
            {showMA && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#8884d8"
                strokeWidth={1.5}
                dot={false}
                name={`MA(${maLength})`}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        );
    }
  };

  // Render volume chart
  const renderVolumeChart = () => {
    if (!data || data.length === 0) return null;
    
    return (
      <ResponsiveContainer width="100%" height="25%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`gradient-volume-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.6} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={isDarkTheme ? 0.1 : 0.2} />
          <XAxis 
            dataKey={timeframe.includes('Min') || timeframe === '1Hour' ? 'time' : 'date'} 
            axisLine={false}
            tickLine={false}
            hide
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            orientation="right"
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
              return value.toString();
            }}
            tick={{ fontSize: 10, fill: isDarkTheme ? '#9ca3af' : '#6b7280' }}
            width={50}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString()}`, 'Volume']}
            contentStyle={{
              backgroundColor: isDarkTheme ? '#1e293b' : '#ffffff',
              borderColor: isDarkTheme ? '#334155' : '#e5e7eb',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
          <Bar 
            dataKey="volume" 
            fill={`url(#gradient-volume-${symbol})`}
            stroke={chartColor}
            strokeOpacity={0.3}
            barSize={data.length > 50 ? 2 : data.length > 20 ? 4 : 6}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className={`w-full overflow-hidden ${isFullWidth ? 'col-span-2 row-span-2' : ''}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">
                {title || symbol} {currentPrice && `$${currentPrice.toFixed(2)}`}
              </h3>
              <Badge className={marketStatus.color}>{marketStatus.status}</Badge>
            </div>
            {(priceChange !== null && percentChange !== null) && (
              <p className={`text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%)
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {shouldShowExpandButton && onExpand && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-2"
                onClick={onExpand}
                aria-label={expanded ? "Collapse chart" : "Expand chart"}
              >
                {expanded ? 'Collapse' : 'Expand'}
              </Button>
            )}
            {onClose && (
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onClose}
                aria-label="Close chart"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
        
        {/* Chart controls - row 1: Timeframe and Chart Type selectors */}
        <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
          {/* Timeframe selector */}
          <div className="flex flex-wrap gap-1">
            {timeframeButtons.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeframeChange(tf)}
                className="h-7 px-2 py-1 text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>
          
          {/* Chart type selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                {chartTypeSettings[chartType].icon}
                {chartTypeSettings[chartType].label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <div className="grid gap-1">
                {Object.entries(chartTypeSettings).map(([type, { icon, label }]) => (
                  <Button
                    key={type}
                    variant={chartType === type ? "default" : "ghost"}
                    size="sm"
                    className="justify-start gap-2 h-9 px-2 w-full"
                    onClick={() => handleChartTypeChange(type as ChartType)}
                  >
                    {icon}
                    {label}
                    {chartType === type && <Check className="h-4 w-4 ml-auto" />}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Last updated time */}
        {lastUpdated && (
          <div className="flex items-center text-xs text-muted-foreground mb-4">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          </div>
        )}
        
        {/* Chart or loading state */}
        {loading ? (
          <div className="flex flex-col space-y-3">
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-[300px] text-red-500">
            {error}
          </div>
        ) : (
          <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
            <ResponsiveContainer width="100%" height={showVolume ? "70%" : "100%"}>
              {renderChart()}
            </ResponsiveContainer>

            {/* Volume chart */}
            {showVolume && renderVolumeChart()}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 