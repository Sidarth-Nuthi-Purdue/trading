'use client';

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { createChart, IChartApi, ISeriesApi, DeepPartial, TimeRange, ChartOptions, CandlestickSeriesOptions } from 'lightweight-charts';

// Define chart data types
interface ChartData {
  time: number; // timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SimpleChartDynamicProps {
  data: ChartData[];
  height?: number;
  theme?: 'light' | 'dark';
}

// Chart ref interface for external control
interface ChartRefType {
  zoomIn: () => void;
  zoomOut: () => void;
  fitContent: () => void;
  updateLastPrice: (price: number) => void;
}

// Create a client-only component with forwardRef
const SimpleChartDynamic = forwardRef<ChartRefType, SimpleChartDynamicProps>(
  ({ data, height = 400, theme = 'light' }, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const lastDataRef = useRef<ChartData[]>([]);
    const isInitializedRef = useRef(false);
    const [dimensions, setDimensions] = useState({ width: 0, height });

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      // Zoom in
      zoomIn: () => {
        if (!chartInstanceRef.current) return;
        
        // Get the visible time range
        const timeScale = chartInstanceRef.current.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (!visibleRange) return;
        
        // Calculate new zoomed-in range (zoom in by ~20%)
        const duration = visibleRange.to - visibleRange.from;
        const zoomFactor = 0.2; // 20% zoom factor
        const newDuration = duration * (1 - zoomFactor);
        
        // Calculate center point to zoom into
        const center = (visibleRange.from + visibleRange.to) / 2;
        
        // Calculate new range
        const newFrom = Math.max(0, center - newDuration / 2);
        const newTo = center + newDuration / 2;
        
        // Apply new range
        timeScale.setVisibleRange({
          from: newFrom,
          to: newTo
        });
      },
      
      // Zoom out
      zoomOut: () => {
        if (!chartInstanceRef.current) return;
        
        // Get the visible time range
        const timeScale = chartInstanceRef.current.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (!visibleRange) return;
        
        // Calculate new zoomed-out range (zoom out by ~20%)
        const duration = visibleRange.to - visibleRange.from;
        const zoomFactor = 0.2; // 20% zoom factor
        const newDuration = duration * (1 + zoomFactor);
        
        // Calculate center point to zoom from
        const center = (visibleRange.from + visibleRange.to) / 2;
        
        // Calculate new range
        const newFrom = Math.max(0, center - newDuration / 2);
        const newTo = center + newDuration / 2;
        
        // Apply new range
        timeScale.setVisibleRange({
          from: newFrom,
          to: newTo
        });
      },
      
      // Fit all content in the visible area
      fitContent: () => {
        if (!chartInstanceRef.current) return;
        chartInstanceRef.current.timeScale().fitContent();
      },
      
      // Update last price (for real-time updates)
      updateLastPrice: (price: number) => {
        if (!candleSeriesRef.current || !data || data.length === 0) return;
        
        // Get the last candle
        const lastCandle = { ...data[data.length - 1] };
        
        // Update the close price
        const updatedCandle = {
          ...lastCandle,
          close: price,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price)
        };
        
        // Update the last candle
        candleSeriesRef.current.update(updatedCandle);
      }
    }));

    // Initialize the chart
    useEffect(() => {
      const handleResize = () => {
        if (chartContainerRef.current) {
          setDimensions({
            width: chartContainerRef.current.clientWidth,
            height
          });
        }
      };

      // Set initial dimensions
      handleResize();

      // Listen for resize events
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, [height]);

    // Create or update chart when dimensions or theme changes
    useEffect(() => {
      if (!chartContainerRef.current || dimensions.width === 0) {
        return;
      }

      // Destroy existing chart if it exists
      if (chartInstanceRef.current) {
        // Store reference to avoid race conditions
        const chartToRemove = chartInstanceRef.current;
        
        // Clear refs first to prevent access during cleanup
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        
        // Then safely remove the chart
        chartToRemove.remove();
      }

      // Chart options based on theme
      const chartOptions: DeepPartial<ChartOptions> = {
        width: dimensions.width,
        height: dimensions.height,
        layout: {
          background: { color: theme === 'dark' ? '#1e1e1e' : '#ffffff' },
          textColor: theme === 'dark' ? '#d1d4dc' : '#000000',
        },
        grid: {
          vertLines: { color: theme === 'dark' ? '#2e2e2e' : '#f0f3fa' },
          horzLines: { color: theme === 'dark' ? '#2e2e2e' : '#f0f3fa' },
        },
        timeScale: {
          borderColor: theme === 'dark' ? '#2e2e2e' : '#d6dcde',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: {
            labelBackgroundColor: theme === 'dark' ? '#5f5f5f' : '#f0f3fa',
          },
          horzLine: {
            labelBackgroundColor: theme === 'dark' ? '#5f5f5f' : '#f0f3fa',
          },
        },
      };

      // Create a new chart
      try {
        const chart = createChart(chartContainerRef.current, chartOptions);
        chartInstanceRef.current = chart;

        // Candlestick series options
        const candleStickOptions: DeepPartial<CandlestickSeriesOptions> = {
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        };

        // Add candlestick series
        const candleSeries = chart.addCandlestickSeries(candleStickOptions);
        candleSeriesRef.current = candleSeries;

        // Store current data for comparison
        lastDataRef.current = [...data];
        
        // Set data
        if (data && data.length > 0) {
          candleSeries.setData(data);
          
          // Fit content to view
          chart.timeScale().fitContent();
        }
        
        isInitializedRef.current = true;
      } catch (error) {
        console.error('Error creating chart:', error);
        // Reset refs on error
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
        isInitializedRef.current = false;
      }

      // Cleanup function
      return () => {
        if (chartInstanceRef.current) {
          try {
            // Store reference to avoid race conditions
            const chartToRemove = chartInstanceRef.current;
            
            // Clear refs first
            chartInstanceRef.current = null;
            candleSeriesRef.current = null;
            isInitializedRef.current = false;
            
            // Then safely remove the chart
            chartToRemove.remove();
          } catch (error) {
            console.error('Error removing chart:', error);
          }
        }
      };
    }, [dimensions, theme]);

    // Update data when it changes
    useEffect(() => {
      // Skip if not initialized yet
      if (!isInitializedRef.current || !candleSeriesRef.current || !data) {
        return;
      }

      // Check if data has actually changed (avoid unnecessary updates)
      const lastData = lastDataRef.current;
      
      // Simple comparison - check length and last item
      const hasChanged = 
        !lastData || 
        lastData.length !== data.length || 
        (lastData.length > 0 && data.length > 0 && 
         (lastData[lastData.length - 1].time !== data[data.length - 1].time ||
          lastData[lastData.length - 1].close !== data[data.length - 1].close));
      
      if (hasChanged) {
        try {
          // Update data
          candleSeriesRef.current.setData(data);
          
          // Store current data for comparison
          lastDataRef.current = [...data];
        } catch (error) {
          console.error('Error updating chart data:', error);
        }
      }
    }, [data]);

    return (
      <div 
        ref={chartContainerRef} 
        className="w-full"
        style={{ height: `${height}px` }}
      />
    );
  }
);

SimpleChartDynamic.displayName = 'SimpleChartDynamic';

export default SimpleChartDynamic; 