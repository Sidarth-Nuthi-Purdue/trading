/**
 * TradingView Chart Component
 * Uses TradingView Lightweight Charts library to display interactive charts with trading functionality
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  LineStyle, 
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
  SeriesMarkerPosition,
  SeriesMarker
} from 'lightweight-charts';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import TradingViewBrokerApi from '@/lib/tradingview-broker-api';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface TradingViewChartProps {
  symbol: string;
  timeInterval?: string;
  height?: number;
  width?: number;
  darkMode?: boolean;
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
  className?: string;
  onCrosshairMove?: (price: number, time: string) => void;
  onPriceUpdate?: (price: number) => void;
  enableTrading?: boolean;
}

// Define the bar data interface
interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  timeInterval = '1h',
  height = 500,
  width = 800,
  darkMode = true,
  onSymbolChange,
  onIntervalChange,
  className = '',
  onCrosshairMove,
  onPriceUpdate,
  enableTrading = false,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentInterval, setCurrentInterval] = useState(timeInterval);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [chartInitialized, setChartInitialized] = useState(false);
  const brokerApiRef = useRef<any>(null);
  const tradingHostRef = useRef<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const supabase = createClientComponentClient();
  
  // Legend state
  const [legendData, setLegendData] = useState({
    price: null as number | null,
    open: null as number | null,
    high: null as number | null,
    low: null as number | null,
    change: null as number | null,
    changePercent: null as number | null,
    time: '',
    date: '',
  });
  const legendRef = useRef<HTMLDivElement>(null);

  // Check authentication status once on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    
    checkAuth();
  }, [supabase.auth]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const { clientWidth, clientHeight } = chartContainerRef.current;
        chartRef.current.resize(clientWidth, clientHeight);
      }
    };

    // Chart colors - updated for sleeker design
    const chartColors = {
      backgroundColor: '#000000',
      textColor: '#9ca3af',
      gridColor: '#1f2937',
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      volumeUpColor: 'rgba(16, 185, 129, 0.3)',
      volumeDownColor: 'rgba(239, 68, 68, 0.3)',
    };

    // Create chart with updated options
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: chartColors.backgroundColor },
        textColor: chartColors.textColor,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: chartColors.gridColor, style: LineStyle.Dotted },
        horzLines: { color: chartColors.gridColor, style: LineStyle.Dotted },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: chartColors.gridColor,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        borderColor: chartColors.gridColor,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#6b7280',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#374151',
        },
        horzLine: {
          width: 1,
          color: '#6b7280',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#374151',
        },
      },
      handleScroll: {
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
      },
    });

    // Create candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      borderUpColor: chartColors.borderUpColor,
      borderDownColor: chartColors.borderDownColor,
      wickUpColor: chartColors.wickUpColor,
      wickDownColor: chartColors.wickDownColor,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Create volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#10b981',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Set as an overlay
    });
    
    // Apply volume series options to show below price
    volumeSeries.applyOptions({
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Save references
    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    
    // Set up resize observer
    resizeObserverRef.current = new ResizeObserver(handleResize);
    resizeObserverRef.current.observe(chartContainerRef.current);

    // Set up event handlers for crosshair movement to update legend
    chart.subscribeCrosshairMove((param) => {
      if (param && param.time && param.seriesPrices && param.seriesPrices.size > 0) {
        const seriesData = param.seriesPrices.get(candlestickSeries);
        if (seriesData) {
          const ohlc = seriesData as any;
          const price = ohlc.close || ohlc;
          const open = ohlc.open || null;
          const high = ohlc.high || null;
          const low = ohlc.low || null;
          
          // Calculate timestamp
          const timestamp = param.time as number;
          const date = new Date(timestamp * 1000);
          const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
          
          // Calculate change from previous day
          const change = open !== null ? price - open : null;
          const changePercent = open !== null && open !== 0 ? (price - open) / open * 100 : null;
          
          // Update legend data
          setLegendData({
            price,
            open,
            high,
            low,
            change,
            changePercent,
            time: formattedTime,
            date: formattedDate
          });
          
          if (onCrosshairMove && price) {
            onCrosshairMove(price, formattedTime);
          }
        }
      }
    });

    // Fetch historical data
    fetchHistoricalData(currentSymbol, currentInterval);
    
    // Mark chart as initialized
    setChartInitialized(true);

    // Clean up
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      
      if (resizeObserverRef.current && chartContainerRef.current) {
        resizeObserverRef.current.unobserve(chartContainerRef.current);
        resizeObserverRef.current = null;
      }
    };
  }, [darkMode, height]); // Only re-initialize when these props change

  // Update chart when symbol or interval changes
  useEffect(() => {
    if (currentSymbol !== symbol || currentInterval !== timeInterval) {
      setCurrentSymbol(symbol);
      setCurrentInterval(timeInterval);
      
      if (chartRef.current && candlestickSeriesRef.current && chartInitialized) {
        // Clear existing data
        candlestickSeriesRef.current.setData([]);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData([]);
        }
        
        // Fetch new data
        fetchHistoricalData(symbol, timeInterval);
      }
    }
  }, [symbol, timeInterval, chartInitialized, currentSymbol, currentInterval]);

  // Initialize trading functionality only when authenticated
  useEffect(() => {
    let isMounted = true;
    
    if (enableTrading && chartInitialized && isAuthenticated) {
      initializeTrading();
    }
    
    return () => {
      isMounted = false;
      // Clean up any trading subscriptions
      if (brokerApiRef.current && tradingHostRef.current) {
        // Clean up logic here
      }
    };
  }, [enableTrading, chartInitialized, isAuthenticated]);

  // Initialize TradingView Broker API
  const initializeTrading = useCallback(() => {
    if (!chartRef.current || !isAuthenticated) return;
    
    // Create a trading host
    const tradingHost = {
      connectionOpened: () => {
        console.log('Trading connection opened');
      },
      connectionClosed: () => {
        console.log('Trading connection closed');
      },
      connectionError: (error: string) => {
        console.error('Trading connection error:', error);
        setError(`Trading connection error: ${error}`);
      },
      sessionEstablished: () => {
        console.log('Trading session established');
      },
      orderUpdate: (order: any) => {
        console.log('Order update:', order);
        setOrders(prevOrders => {
          const newOrders = [...prevOrders];
          const index = newOrders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            newOrders[index] = order;
          } else {
            newOrders.push(order);
          }
          return newOrders;
        });
        
        // Add order markers to chart
        updateOrderMarkers();
      },
      positionUpdate: (position: any) => {
        console.log('Position update:', position);
        setPositions(prevPositions => {
          const newPositions = [...prevPositions];
          const index = newPositions.findIndex(p => p.id === position.id);
          if (index !== -1) {
            if (position.qty > 0) {
              newPositions[index] = position;
            } else {
              newPositions.splice(index, 1);
            }
          } else if (position.qty > 0) {
            newPositions.push(position);
          }
          return newPositions;
        });
        
        // Update position markers on chart
        updatePositionMarkers();
      },
      executionUpdate: (execution: any) => {
        console.log('Execution update:', execution);
        // Add execution marker to chart
        if (candlestickSeriesRef.current) {
          addExecutionMarker(execution);
        }
      },
      plUpdate: (id: string, pl: number, realizedPl: number) => {
        console.log('P&L update:', id, pl, realizedPl);
        // Update positions with P&L information
        setPositions(prevPositions => {
          return prevPositions.map(position => {
            if (position.id === id) {
              return { ...position, pl, realizedPl };
            }
            return position;
          });
        });
      },
      equityUpdate: (equity: number[]) => {
        console.log('Equity update:', equity);
      },
      orderPartialUpdate: (data: any) => {
        console.log('Order partial update:', data);
      },
      positionPartialUpdate: (data: any) => {
        console.log('Position partial update:', data);
      },
      individualPositionUpdate: (position: any) => {
        console.log('Individual position update:', position);
      },
      individualPositionPLUpdate: (id: string, pl: number) => {
        console.log('Individual position P&L update:', id, pl);
      }
    };
    
    // Store the trading host reference
    tradingHostRef.current = tradingHost;
    
    // Create broker API
    const brokerApi = new TradingViewBrokerApi(tradingHost);
    brokerApiRef.current = brokerApi;
  }, [isAuthenticated]);

  // Add execution marker to chart
  const addExecutionMarker = useCallback((execution: any) => {
    if (!candlestickSeriesRef.current || !execution) return;
    
    // Create a marker for the execution
    const marker: SeriesMarker<Time> = {
      time: execution.time / 1000, // Convert to seconds for the chart
      position: execution.side === 1 ? 'belowBar' : 'aboveBar',
      color: execution.side === 1 ? '#10b981' : '#ef4444',
      shape: execution.side === 1 ? 'arrowUp' : 'arrowDown',
      text: `${execution.side === 1 ? 'Buy' : 'Sell'} ${execution.qty} @ ${formatPrice(execution.price)}`,
      size: 1,
    };
    
    // Add marker to chart
    const currentMarkers = candlestickSeriesRef.current.markers() || [];
    candlestickSeriesRef.current.setMarkers([...currentMarkers, marker]);
  }, []);

  // Update order markers on chart
  const updateOrderMarkers = useCallback(() => {
    // Implementation for order markers would go here
    // For brevity and to avoid complexity, skipping detailed implementation
  }, []);

  // Update position markers on chart
  const updatePositionMarkers = useCallback(() => {
    // Implementation for position markers would go here
    // For brevity and to avoid complexity, skipping detailed implementation
  }, []);

  // Fetch historical data for the chart
  const fetchHistoricalData = useCallback(async (sym: string, ival: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Map interval to TradingView timeframe format
      const timeframeMap: Record<string, string> = {
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1h': '60',
        '4h': '240',
        '1d': 'D',
        '1w': 'W',
        '1M': 'M'
      };
      
      // Use a local API endpoint to avoid CORS issues
      const response = await fetch(`/api/market-data/bars?symbol=${encodeURIComponent(sym)}&interval=${ival}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.bars || data.bars.length === 0) {
        throw new Error('No historical data available');
      }
      
      // Transform data for lightweight-charts format
      const transformedBars: BarData[] = data.bars.map((bar: any) => {
        // Ensure each timestamp is properly formatted for the chart
        // TradingView expects timestamps in seconds
        return {
          time: typeof bar.time === 'string' ? Math.floor(new Date(bar.time).getTime() / 1000) : bar.time,
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close),
          volume: Number(bar.volume)
        };
      }).filter((bar: BarData) => 
        // Filter out bars with null/undefined/NaN values
        bar.open !== null && bar.high !== null && bar.low !== null && bar.close !== null &&
        !isNaN(bar.open) && !isNaN(bar.high) && !isNaN(bar.low) && !isNaN(bar.close)
      );
      
      if (transformedBars.length === 0) {
        throw new Error('No valid data points available');
      }
      
      // Get the latest price and update legend
      const latestBar = transformedBars[transformedBars.length - 1];
      const price = latestBar.close;
      setLastPrice(price);
      
      // Calculate change from previous day's close
      const prevDayBar = transformedBars.length > 1 ? transformedBars[transformedBars.length - 2] : null;
      const prevClose = prevDayBar ? prevDayBar.close : latestBar.open;
      const change = price - prevClose;
      const changePercent = (change / prevClose) * 100;
      
      // Update legend with latest data
      const date = new Date(latestBar.time * 1000);
      setLegendData({
        price: price,
        open: latestBar.open,
        high: latestBar.high,
        low: latestBar.low,
        change: change,
        changePercent: changePercent,
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      });
      
      if (onPriceUpdate) {
        onPriceUpdate(price, change, changePercent);
      }
      
      // Update chart with candlestick data
      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData(transformedBars);
      }
      
      // Update volume series
      if (volumeSeriesRef.current) {
        const volumeData = transformedBars.map((bar: BarData) => ({
          time: bar.time,
          value: bar.volume,
          color: bar.close >= bar.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }));
        
        volumeSeriesRef.current.setData(volumeData);
      }
      
      // Fit content to visible range
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error fetching data');
    } finally {
      setIsLoading(false);
    }
  }, [onPriceUpdate]);

  // Render chart and legend
  return (
    <div className={cn("relative w-full h-full flex flex-col", className)}>
      {/* Legend Overlay */}
      <div 
        ref={legendRef}
        className="absolute top-2 left-2 z-10 p-3 rounded-md bg-black/80 backdrop-blur-sm text-white font-mono text-sm"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold">{currentSymbol}</span>
          {legendData.price !== null && (
            <span className="font-semibold">{formatPrice(legendData.price)}</span>
          )}
        </div>
        
        {legendData.change !== null && legendData.changePercent !== null && (
          <div className={`text-xs mb-1 ${legendData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {legendData.change >= 0 ? '+' : ''}{formatPrice(legendData.change)} ({legendData.change >= 0 ? '+' : ''}
            {legendData.changePercent.toFixed(2)}%)
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300">
          <div>O: {legendData.open !== null ? formatPrice(legendData.open) : '-'}</div>
          <div>H: {legendData.high !== null ? formatPrice(legendData.high) : '-'}</div>
          <div>L: {legendData.low !== null ? formatPrice(legendData.low) : '-'}</div>
          <div>C: {legendData.price !== null ? formatPrice(legendData.price) : '-'}</div>
        </div>
        
        <div className="mt-1 text-xs text-gray-400">
          {legendData.time} · {legendData.date}
        </div>
      </div>
      
      {/* Chart Container */}
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
        style={{ height: `${height}px` }}
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-sm text-white">Loading chart data...</span>
          </div>
        </div>
      )}
      
      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 max-w-md p-4 bg-red-900/80 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-300" />
            <span className="text-sm text-white text-center">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface Time {
  time: number;
}

export default TradingViewChart; 