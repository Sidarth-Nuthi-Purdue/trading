'use client';

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  ColorType, 
  CandlestickData,
  HistogramData,
  Time,
  UTCTimestamp,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries
} from 'lightweight-charts';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Define chart data types
interface OHLCData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ChartOptions {
  height?: number;
  width?: number;
  theme?: 'light' | 'dark';
  timeScale?: 'seconds' | 'minutes' | 'hours' | 'days';
  showVolume?: boolean;
  autoResize?: boolean;
  symbol?: string;
  defaultInterval?: TimeInterval;
}

// Define indicator types
interface Indicator {
  id: string;
  name: string;
  active: boolean;
  color?: string;
  settings?: Record<string, unknown>;
}

export interface TradingViewChartHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitContent: () => void;
  updateLastPrice: (price: number) => void;
  setVisibleTimeRange: (from: number, to: number) => void;
  loadMoreData: (from: number, to: number) => Promise<void>;
  updateData: (data: any[]) => void;
  setVisibleRange: (from: number, to: number) => void;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: TimeInterval) => void;
  addIndicator: (indicator: Indicator) => void;
  removeIndicator: (indicatorId: string) => void;
}

interface TradingViewChartProps {
  data: OHLCData[];
  options?: ChartOptions;
  onCrosshairMove?: (param: { price: number; time: Time }) => void;
  onVisibleTimeRangeChange?: (range: { from: number; to: number }) => void;
  onLoadMoreData?: (from: number, to: number) => Promise<OHLCData[]>;
  activeIndicators?: Indicator[];
  className?: string;
}

type TimeInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

// Map time intervals to API timeframes
const timeIntervalToApiTimeframe: Record<TimeInterval, string> = {
  '1m': '1Min',
  '5m': '5Min',
  '15m': '15Min',
  '30m': '30Min',
  '1h': '1Hour',
  '4h': '4Hour',
  '1d': '1Day'
};

// Format time utility function
const formatTimeByScale = (time: Time, scale: 'seconds' | 'minutes' | 'hours' | 'days'): Time => {
  if (typeof time === 'string' || typeof time === 'object') {
    return time; // BusinessDay or string format
  }
  
  const timestamp = time as number;
  
  // If timestamp is in milliseconds, convert to appropriate scale
  if (timestamp > 1e12) { // Likely milliseconds timestamp
    const seconds = Math.floor(timestamp / 1000);
    return seconds as UTCTimestamp;
  }
  
  return timestamp as UTCTimestamp;
};

// Primary chart component
const TradingViewChart = forwardRef<TradingViewChartHandle, TradingViewChartProps>(
  ({ data, options = {}, onCrosshairMove, onVisibleTimeRangeChange, onLoadMoreData, activeIndicators = [], className }, ref) => {
    const {
      height = 500, // Increased default height
      width,
      theme = 'dark',
      timeScale = 'days',
      showVolume = true,
      autoResize = true,
      symbol = 'AAPL',
      defaultInterval = '1h'
    } = options;
    
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<any>>>(new Map());
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const dataRef = useRef<OHLCData[]>(data);
    const isLoadingMoreDataRef = useRef(false);
    const [selectedInterval, setSelectedInterval] = useState<TimeInterval>(defaultInterval);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastCrosshairMoveRef = useRef<{ x: number, y: number } | null>(null);
    
    // Update the data ref when data changes
    useEffect(() => {
      dataRef.current = data;
    }, [data]);
    
    // Apply indicators when they change
    useEffect(() => {
      if (!chartRef.current || !candleSeriesRef.current) return;
      
      // Handle indicators
      applyIndicators();
    }, [activeIndicators]);
    
    // Apply indicators to the chart
    const applyIndicators = () => {
      if (!chartRef.current || !candleSeriesRef.current) return;
      
      const chart = chartRef.current;
      
      // Remove all existing indicators first
      indicatorSeriesRefs.current.forEach((series) => {
        chart.removeSeries(series);
      });
      
      indicatorSeriesRefs.current.clear();
      
      // Add active indicators
      activeIndicators.forEach((indicator) => {
        try {
          switch (indicator.id) {
            case 'sma':
              addSMA(chart, indicator, 14);
              break;
            case 'ema':
              addEMA(chart, indicator, 20);
              break;
            case 'bb':
              addBollingerBands(chart, indicator);
              break;
            case 'rsi':
              addRSI(chart, indicator);
              break;
            case 'macd':
              addMACD(chart, indicator);
              break;
            case 'vol':
              // Volume is handled separately
              break;
            default:
              console.warn(`Indicator ${indicator.id} not implemented`);
          }
        } catch (err) {
          console.error(`Error adding indicator ${indicator.id}:`, err);
        }
      });
    };
    
    // Add Simple Moving Average indicator
    const addSMA = (chart: IChartApi, indicator: Indicator, period: number) => {
      if (!dataRef.current.length) return;
      
      const smaData = calculateSMA(dataRef.current, period);
      const lineSeries = chart.addLineSeries({
        color: indicator.color || '#2962FF',
        lineWidth: 2,
        priceLineVisible: false,
      });
      
      lineSeries.setData(smaData);
      indicatorSeriesRefs.current.set(indicator.id, lineSeries);
    };
    
    // Add Exponential Moving Average indicator
    const addEMA = (chart: IChartApi, indicator: Indicator, period: number) => {
      if (!dataRef.current.length) return;
      
      const emaData = calculateEMA(dataRef.current, period);
      const lineSeries = chart.addLineSeries({
        color: indicator.color || '#FF6D00',
        lineWidth: 2,
        priceLineVisible: false,
      });
      
      lineSeries.setData(emaData);
      indicatorSeriesRefs.current.set(indicator.id, lineSeries);
    };
    
    // Add Bollinger Bands indicator
    const addBollingerBands = (chart: IChartApi, indicator: Indicator) => {
      if (!dataRef.current.length) return;
      
      const period = 20;
      const stdDev = 2;
      
      const { middle, upper, lower } = calculateBollingerBands(dataRef.current, period, stdDev);
      
      // Middle band (SMA)
      const middleSeries = chart.addLineSeries({
        color: indicator.color || '#9C27B0',
        lineWidth: 1,
        priceLineVisible: false,
      });
      
      // Upper band
      const upperSeries = chart.addLineSeries({
        color: indicator.color || '#9C27B0',
        lineWidth: 1,
        lineStyle: 1, // Dashed
        priceLineVisible: false,
      });
      
      // Lower band
      const lowerSeries = chart.addLineSeries({
        color: indicator.color || '#9C27B0',
        lineWidth: 1,
        lineStyle: 1, // Dashed
        priceLineVisible: false,
      });
      
      middleSeries.setData(middle);
      upperSeries.setData(upper);
      lowerSeries.setData(lower);
      
      indicatorSeriesRefs.current.set(`${indicator.id}-middle`, middleSeries);
      indicatorSeriesRefs.current.set(`${indicator.id}-upper`, upperSeries);
      indicatorSeriesRefs.current.set(`${indicator.id}-lower`, lowerSeries);
    };
    
    // Add RSI indicator
    const addRSI = (chart: IChartApi, indicator: Indicator) => {
      // RSI would typically be added to a separate pane below the main chart
      // This is a simplified implementation
      console.log('RSI indicator not fully implemented yet');
    };
    
    // Add MACD indicator
    const addMACD = (chart: IChartApi, indicator: Indicator) => {
      // MACD would typically be added to a separate pane below the main chart
      // This is a simplified implementation
      console.log('MACD indicator not fully implemented yet');
    };
    
    // Calculate Simple Moving Average
    const calculateSMA = (data: OHLCData[], period: number) => {
      const result: Array<{ time: Time; value: number }> = [];
      
      if (data.length < period) return result;
      
      for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        
        result.push({
          time: data[i].time,
          value: sum / period
        });
      }
      
      return result;
    };
    
    // Calculate Exponential Moving Average
    const calculateEMA = (data: OHLCData[], period: number) => {
      const result: Array<{ time: Time; value: number }> = [];
      
      if (data.length < period) return result;
      
      // Calculate first SMA as the first EMA value
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += data[i].close;
      }
      
      let ema = sum / period;
      const multiplier = 2 / (period + 1);
      
      result.push({
        time: data[period - 1].time,
        value: ema
      });
      
      // Calculate EMA for the rest of the data
      for (let i = period; i < data.length; i++) {
        ema = (data[i].close - ema) * multiplier + ema;
        
        result.push({
          time: data[i].time,
          value: ema
        });
      }
      
      return result;
    };
    
    // Calculate Bollinger Bands
    const calculateBollingerBands = (data: OHLCData[], period: number, stdDev: number) => {
      const middle: Array<{ time: Time; value: number }> = [];
      const upper: Array<{ time: Time; value: number }> = [];
      const lower: Array<{ time: Time; value: number }> = [];
      
      if (data.length < period) return { middle, upper, lower };
      
      for (let i = period - 1; i < data.length; i++) {
        // Calculate SMA
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        
        const sma = sum / period;
        
        // Calculate standard deviation
        let squaredDiffSum = 0;
        for (let j = 0; j < period; j++) {
          const diff = data[i - j].close - sma;
          squaredDiffSum += diff * diff;
        }
        
        const stdDevValue = Math.sqrt(squaredDiffSum / period);
        
        // Calculate bands
        const upperBand = sma + stdDevValue * stdDev;
        const lowerBand = sma - stdDevValue * stdDev;
        
        middle.push({ time: data[i].time, value: sma });
        upper.push({ time: data[i].time, value: upperBand });
        lower.push({ time: data[i].time, value: lowerBand });
      }
      
      return { middle, upper, lower };
    };
    
    // Load more historical data
    const loadMoreData = useCallback(async (from: number, to: number) => {
      if (!onLoadMoreData || isLoadingMoreDataRef.current) return;
      
      try {
        isLoadingMoreDataRef.current = true;
        
        // Convert timestamps to ISO strings for API
        const fromDate = new Date(from * 1000).toISOString();
        const toDate = new Date(to * 1000).toISOString();
        
        console.log(`Loading more data from ${fromDate} to ${toDate}`);
        
        // Fetch more data
        const newData = await onLoadMoreData(from, to);
        
        if (newData.length > 0) {
          // Add new data to chart if it doesn't already exist
          const existingTimes = new Set(dataRef.current.map(item => 
            typeof item.time === 'number' ? item.time : 0
          ));
          
          const uniqueNewData = newData.filter(item => 
            typeof item.time === 'number' && !existingTimes.has(item.time as number)
          );
          
          if (uniqueNewData.length > 0) {
            // Add to data ref
            dataRef.current = [...uniqueNewData, ...dataRef.current];
            
            // Update chart series without changing the visible range
            if (candleSeriesRef.current && chartRef.current) {
              // Save current visible range
              const visibleRange = chartRef.current.timeScale().getVisibleRange();
              
              // Update the data
              candleSeriesRef.current.setData(dataRef.current as CandlestickData[]);
              
              // Restore the visible range to prevent jumping
              if (visibleRange) {
                chartRef.current.timeScale().setVisibleRange(visibleRange);
              }
              
              // Update volume series if exists
              if (volumeSeriesRef.current && showVolume) {
                const volumeData = dataRef.current
                  .filter(item => item.volume !== undefined)
                  .map(item => ({
                    time: item.time,
                    value: item.volume || 0,
                    color: (item.close || 0) >= (item.open || 0) 
                      ? 'rgba(38, 166, 154, 0.5)'  // green (bullish)
                      : 'rgba(239, 83, 80, 0.5)'   // red (bearish)
                  }));
                  
                volumeSeriesRef.current.setData(volumeData as HistogramData[]);
              }
              
              // Update indicators
              applyIndicators();
            }
          }
        }
      } catch (err) {
        console.error('Error loading more data:', err);
      } finally {
        isLoadingMoreDataRef.current = false;
      }
    }, [onLoadMoreData, showVolume]);
    
    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (!chartRef.current) return;
        
        const timeScaleApi = chartRef.current.timeScale();
        const visibleRange = timeScaleApi.getVisibleRange();
        
        if (!visibleRange) return;
        
        // Calculate new time range (zoom in by ~20%)
        const duration = (visibleRange.to as number) - (visibleRange.from as number);
        const zoomFactor = 0.2;
        const newDuration = duration * (1 - zoomFactor);
        const center = ((visibleRange.from as number) + (visibleRange.to as number)) / 2;
        
        timeScaleApi.setVisibleRange({
          from: (center - newDuration / 2) as UTCTimestamp,
          to: (center + newDuration / 2) as UTCTimestamp
        });
      },
      
      zoomOut: () => {
        if (!chartRef.current) return;
        
        const timeScaleApi = chartRef.current.timeScale();
        const visibleRange = timeScaleApi.getVisibleRange();
        
        if (!visibleRange) return;
        
        // Calculate new time range (zoom out by ~20%)
        const duration = (visibleRange.to as number) - (visibleRange.from as number);
        const zoomFactor = 0.2;
        const newDuration = duration * (1 + zoomFactor);
        const center = ((visibleRange.from as number) + (visibleRange.to as number)) / 2;
        
        timeScaleApi.setVisibleRange({
          from: (center - newDuration / 2) as UTCTimestamp,
          to: (center + newDuration / 2) as UTCTimestamp
        });
      },
      
      fitContent: () => {
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      },
      
      updateLastPrice: (price: number) => {
        if (!candleSeriesRef.current || dataRef.current.length === 0) return;
        
        // Get last candle and update it
        const lastCandle = {...dataRef.current[dataRef.current.length - 1]};
        const updatedCandle = {
          ...lastCandle,
          close: price,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price)
        };
        
        // Update the last candle in the data array
        dataRef.current[dataRef.current.length - 1] = updatedCandle;
        
        // Update the chart
        candleSeriesRef.current.update(updatedCandle as CandlestickData);
        
        // Update indicators
        applyIndicators();
      },
      
      setVisibleTimeRange: (from: number, to: number) => {
        if (!chartRef.current) return;
        
        chartRef.current.timeScale().setVisibleRange({
          from: from as UTCTimestamp,
          to: to as UTCTimestamp
        });
      },
      
      loadMoreData,
      
      updateData: (newData: any[]) => {
        if (candleSeriesRef.current) {
          // Store data in ref
          dataRef.current = newData;
          
          // Update candlestick series
          candleSeriesRef.current.setData(newData as CandlestickData[]);
          
          // Update volume series if exists
          if (volumeSeriesRef.current && showVolume) {
            const volumeData = newData
              .filter(item => item.volume !== undefined)
              .map(item => ({
                time: item.time,
                value: item.volume || 0,
                color: (item.close || 0) >= (item.open || 0) 
                  ? 'rgba(38, 166, 154, 0.5)'  // green (bullish)
                  : 'rgba(239, 83, 80, 0.5)'   // red (bearish)
              }));
              
            volumeSeriesRef.current.setData(volumeData as HistogramData[]);
          }
          
          // Update indicators
          applyIndicators();
        }
      },
      
      setVisibleRange: (from: number, to: number) => {
        if (chartRef.current) {
          chartRef.current.timeScale().setVisibleRange({
            from,
            to
          });
        }
      },
      
      setSymbol: (newSymbol: string) => {
        // Symbol change is handled externally
      },
      
      setInterval: (interval: TimeInterval) => {
        handleIntervalChange(interval);
      },
      
      addIndicator: (indicator: Indicator) => {
        if (!chartRef.current) return;
        
        // Add indicator to chart
        switch (indicator.id) {
          case 'sma':
            addSMA(chartRef.current, indicator, 14);
            break;
          case 'ema':
            addEMA(chartRef.current, indicator, 20);
            break;
          case 'bb':
            addBollingerBands(chartRef.current, indicator);
            break;
          case 'rsi':
            addRSI(chartRef.current, indicator);
            break;
          case 'macd':
            addMACD(chartRef.current, indicator);
            break;
          default:
            console.warn(`Indicator ${indicator.id} not implemented`);
        }
      },
      
      removeIndicator: (indicatorId: string) => {
        if (!chartRef.current) return;
        
        // Remove indicator from chart
        const series = indicatorSeriesRefs.current.get(indicatorId);
        if (series) {
          chartRef.current.removeSeries(series);
          indicatorSeriesRefs.current.delete(indicatorId);
        }
        
        // Also check for multi-series indicators (like Bollinger Bands)
        [`${indicatorId}-middle`, `${indicatorId}-upper`, `${indicatorId}-lower`].forEach(id => {
          const subSeries = indicatorSeriesRefs.current.get(id);
          if (subSeries) {
            chartRef.current!.removeSeries(subSeries);
            indicatorSeriesRefs.current.delete(id);
          }
        });
      }
    }));
    
    // Handle interval change
    const handleIntervalChange = async (interval: TimeInterval) => {
      setSelectedInterval(interval);
      setIsRefreshing(true);
      
      try {
        // Fetch data for the new interval
        const apiTimeframe = timeIntervalToApiTimeframe[interval];
        const response = await fetch(`/api/alpaca/market-data/bars?symbol=${symbol}&timeframe=${apiTimeframe}&limit=300`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.bars && result.bars.length > 0) {
          // Transform the data for the chart
          const transformedData = result.bars.map((bar: { 
            t: string; 
            o: string | number; 
            h: string | number; 
            l: string | number; 
            c: string | number; 
            v: string | number;
          }) => {
            // Parse values and ensure they're valid numbers
            const open = parseFloat(bar.o.toString());
            const high = parseFloat(bar.h.toString());
            const low = parseFloat(bar.l.toString());
            const close = parseFloat(bar.c.toString());
            const volume = parseFloat(bar.v.toString());
            
            return {
              // TradingView chart expects time in seconds (as UTCTimestamp)
              time: Math.floor(new Date(bar.t).getTime() / 1000) as UTCTimestamp,
              open: isNaN(open) ? 0 : open,
              high: isNaN(high) ? 0 : high,
              low: isNaN(low) ? 0 : low,
              close: isNaN(close) ? 0 : close,
              volume: isNaN(volume) ? 0 : volume
            };
          });
          
          // Sort data by time
          transformedData.sort((a, b) => {
            const timeA = typeof a.time === 'number' ? a.time : 0;
            const timeB = typeof b.time === 'number' ? b.time : 0;
            return timeA - timeB;
          });
          
          // Update data ref
          dataRef.current = transformedData;
          
          // Update chart series
          if (candleSeriesRef.current) {
            candleSeriesRef.current.setData(transformedData as CandlestickData[]);
          }
          
          // Update volume series if exists
          if (volumeSeriesRef.current && showVolume) {
            const volumeData = transformedData
              .filter(item => item.volume !== undefined)
              .map(item => ({
                time: item.time,
                value: item.volume || 0,
                color: (item.close || 0) >= (item.open || 0) 
                  ? 'rgba(38, 166, 154, 0.5)'  // green (bullish)
                  : 'rgba(239, 83, 80, 0.5)'   // red (bearish)
              }));
              
            volumeSeriesRef.current.setData(volumeData as HistogramData[]);
          }
          
          // Fit content to show the new data
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        }
      } catch (error) {
        console.error('Error changing interval:', error);
      } finally {
        setIsRefreshing(false);
      }
    };
    
    // Set up and clean up chart
    useEffect(() => {
      const container = chartContainerRef.current;
      if (!container) return;
      
      // Clean up any existing chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
      
      setIsLoading(true);
      
      try {
        // Create chart with improved styling for a premium look
        const chart = createChart(container, {
          width: width || container.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: theme === 'dark' ? '#0A0A0A' : '#FFFFFF' },
            textColor: theme === 'dark' ? '#D9D9D9' : '#191919',
            fontSize: 12,
            fontFamily: 'Inter, system-ui, sans-serif',
          },
          grid: {
            vertLines: { color: theme === 'dark' ? '#1a1a1a' : '#f0f3fa', style: 1 },
            horzLines: { color: theme === 'dark' ? '#1a1a1a' : '#f0f3fa', style: 1 },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: theme === 'dark' ? 'rgba(117, 134, 150, 0.8)' : 'rgba(117, 134, 150, 0.8)',
              width: 1,
              style: 3,
              labelBackgroundColor: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
            },
            horzLine: {
              color: theme === 'dark' ? 'rgba(117, 134, 150, 0.8)' : 'rgba(117, 134, 150, 0.8)',
              width: 1,
              style: 3,
              labelBackgroundColor: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
            },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: timeScale === 'seconds' || timeScale === 'minutes',
            borderColor: theme === 'dark' ? '#2a2a2a' : '#e0e3eb',
            tickMarkFormatter: (time: number) => {
              const date = new Date(time * 1000);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              return `${hours}:${minutes}`;
            },
          },
          rightPriceScale: {
            borderColor: theme === 'dark' ? '#2a2a2a' : '#e0e3eb',
            scaleMargins: {
              top: 0.1,
              bottom: showVolume ? 0.2 : 0.1,
            },
            textColor: theme === 'dark' ? '#d1d4dc' : '#131722',
          },
          handleScale: {
            axisPressedMouseMove: true,
          },
          handleScroll: {
            vertTouchDrag: false,
          },
        });
        
        chartRef.current = chart;
        
        // Format the data for lightweight-charts
        const formattedCandleData = data.map(item => ({
          ...item,
          time: formatTimeByScale(item.time, timeScale)
        }));
        
        // Add candlestick series - UPDATED FOR v5 API with improved colors
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', 
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        
        candleSeries.setData(formattedCandleData as CandlestickData[]);
        candleSeriesRef.current = candleSeries;
        
        // Add volume histogram if enabled - UPDATED FOR v5 API
        if (showVolume && data.some(item => item.volume !== undefined)) {
          const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: '', // Auto-scale
            scaleMargins: {
              top: 0.8,  // Start 80% from the top
              bottom: 0,
            },
          });
          
          // Format volume data
          const volumeData = formattedCandleData
            .filter(item => item.volume !== undefined)
            .map(item => ({
              time: item.time,
              value: item.volume || 0,
              color: (item.close || 0) >= (item.open || 0) 
                ? 'rgba(38, 166, 154, 0.5)'  // green (bullish)
                : 'rgba(239, 83, 80, 0.5)'   // red (bearish)
            }));
            
          volumeSeries.setData(volumeData as HistogramData[]);
          volumeSeriesRef.current = volumeSeries;
        }
        
        // Subscribe to crosshair move to provide price at cursor
        if (onCrosshairMove) {
          chart.subscribeCrosshairMove((param) => {
            if (
              param.point === undefined || 
              param.time === undefined || 
              param.seriesData.size === 0
            ) {
              return;
            }
            
            // Get the price at the crosshair
            const seriesData = param.seriesData.get(candleSeries);
            if (seriesData) {
              const price = (seriesData as CandlestickData).close;
              const time = param.time;
              onCrosshairMove({ price, time });
            }
          });
        }
        
        // Subscribe to visible time range change
        if (onVisibleTimeRangeChange) {
          chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (range) {
              onVisibleTimeRangeChange({
                from: range.from as number,
                to: range.to as number
              });
              
              // Check if we need to load more data when scrolling to the left (historical)
              if (onLoadMoreData && range.from && dataRef.current.length > 0) {
                const oldestDataTime = Math.min(...dataRef.current
                  .filter(item => typeof item.time === 'number')
                  .map(item => item.time as number));
                
                // If we're close to the oldest data point, load more historical data
                // Only load more data if the user is actively scrolling to the left edge
                if ((range.from as number) < oldestDataTime + 86400 && // Within 1 day of oldest data
                    (range.from as number) > oldestDataTime - 86400 * 10) { // Not too far back (prevents chain loading)
                  const loadFrom = (range.from as number) - 86400 * 30; // Load 30 days more
                  const loadTo = oldestDataTime - 86400; // Leave a 1-day gap to prevent duplicates
                  loadMoreData(loadFrom, loadTo);
                }
              }
            }
          });
        }
        
        // Set up auto-resizing if enabled
        if (autoResize) {
          const resizeHandler = () => {
            if (chartRef.current && container) {
              chartRef.current.applyOptions({
                width: container.clientWidth,
              });
            }
          };
          
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserverRef.current = new ResizeObserver(resizeHandler);
            resizeObserverRef.current.observe(container);
          } else {
            // Fallback for browsers without ResizeObserver
            window.addEventListener('resize', resizeHandler);
          }
        }
        
        // Fit all data to view
        chart.timeScale().fitContent();
        
      } catch (err) {
        console.error('Error creating TradingView chart:', err);
        setError('Failed to create chart');
      } finally {
        setIsLoading(false);
      }
      
      // Cleanup function
      return () => {
        if (resizeObserverRef.current && chartContainerRef.current) {
          resizeObserverRef.current.unobserve(chartContainerRef.current);
          resizeObserverRef.current = null;
        }
        
        window.removeEventListener('resize', () => {});
        
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          candleSeriesRef.current = null;
          volumeSeriesRef.current = null;
        }
      };
    }, [data, height, width, theme, timeScale, showVolume, onCrosshairMove, onVisibleTimeRangeChange, onLoadMoreData, loadMoreData]);
    
    return (
      <div className={cn("relative w-full flex flex-col rounded-xl overflow-hidden", className)} style={{ height: `${height + 50}px` }}>
        {/* Time interval selector - Redesigned with modern pill buttons */}
        <div className="flex justify-between items-center p-3 bg-[#0A0A0A] dark:bg-[#0A0A0A] border-b border-[#222222] dark:border-[#222222]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as TimeInterval[]).map((interval) => (
              <button 
                key={interval}
                onClick={() => handleIntervalChange(interval)}
                className={cn(
                  "h-8 px-4 text-sm font-medium rounded-full transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                  selectedInterval === interval
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-[#1A1A1A] dark:bg-[#1A1A1A] text-gray-300 hover:bg-[#222222] dark:hover:bg-[#222222]"
                )}
                disabled={isRefreshing}
              >
                {interval}
              </button>
            ))}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-[#1A1A1A] dark:bg-[#1A1A1A] hover:bg-[#222222] dark:hover:bg-[#222222] text-gray-300"
            onClick={() => {
              setIsRefreshing(true);
              setTimeout(() => setIsRefreshing(false), 500);
            }}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="relative flex-1 bg-[#0A0A0A] dark:bg-[#0A0A0A]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] bg-opacity-80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="text-sm font-medium text-gray-300">Loading chart data...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] bg-opacity-90 z-10">
              <div className="flex items-center text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}
          
          <div
            ref={chartContainerRef}
            className="w-full h-full"
          />
          
          {/* TradingView logo attribution */}
          <div className="absolute bottom-3 left-3 opacity-60">
            <a 
              href="https://www.tradingview.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 36 28" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 22H7V11H0V4h14v18zM28 22h-8l7.5-18h8L28 22z" fill="currentColor" />
                <circle cx="20" cy="8" r="4" fill="currentColor" />
              </svg>
              <span className="ml-1.5 font-medium">TradingView</span>
            </a>
          </div>
        </div>
      </div>
    );
  }
);

TradingViewChart.displayName = 'TradingViewChart';

export default TradingViewChart; 