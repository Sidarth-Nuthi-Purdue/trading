'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ColorType, CandlestickSeries } from 'lightweight-charts';

interface StableChartProps {
  symbol: string;
  timeInterval?: string;
  height?: number;
  onPriceUpdate?: (price: number) => void;
  className?: string;
}

const StableChart: React.FC<StableChartProps> = ({
  symbol,
  timeInterval = '1h',
  height = 500,
  onPriceUpdate,
  className = ''
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || !isMountedRef.current) return;

    const container = chartContainerRef.current;
    
    try {
      // Create chart with minimal options to reduce errors
      const chart = createChart(container, {
        width: container.clientWidth,
        height: height,
        layout: {
          background: { type: ColorType.Solid, color: '#000000' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: '#1f2937' },
          horzLines: { color: '#1f2937' },
        },
        timeScale: {
          borderColor: '#1f2937',
        },
        rightPriceScale: {
          borderColor: '#1f2937',
        },
      });

      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#10b981',
        wickDownColor: '#ef4444',
        wickUpColor: '#10b981',
      });

      // Store references
      chartRef.current = chart;
      seriesRef.current = candlestickSeries;

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && container && isMountedRef.current) {
          try {
            chartRef.current.applyOptions({
              width: container.clientWidth,
              height: height,
            });
          } catch (e) {
            console.warn('Chart resize warning:', e);
          }
        }
      };

      // Add resize listener
      window.addEventListener('resize', handleResize);

      // Fetch initial data
      fetchData();

      return () => {
        try {
          window.removeEventListener('resize', handleResize);
          
          // Clean up chart with timeout to avoid disposal errors
          setTimeout(() => {
            if (chartRef.current) {
              try {
                chartRef.current.remove();
              } catch (e) {
                console.warn('Chart cleanup warning:', e);
              }
            }
            chartRef.current = null;
            seriesRef.current = null;
          }, 10);
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      };
    } catch (error) {
      console.error('Chart initialization error:', error);
    }
  }, [symbol, height]);

  const generateMockData = () => {
    if (!seriesRef.current || !isMountedRef.current) return;
    
    const now = Math.floor(Date.now() / 1000);
    const basePrice = 150 + Math.random() * 50; // Base price between 150-200
    const mockData = [];
    
    for (let i = 99; i >= 0; i--) {
      const time = now - (i * 3600); // 1 hour intervals
      const volatility = 0.02; // 2% volatility
      const change = (Math.random() - 0.5) * volatility * basePrice;
      const open = basePrice + change;
      const close = open + (Math.random() - 0.5) * volatility * basePrice;
      const high = Math.max(open, close) + Math.random() * volatility * basePrice * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * basePrice * 0.5;
      
      mockData.push({
        time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });
    }
    
    try {
      seriesRef.current.setData(mockData);
      if (onPriceUpdate && mockData.length > 0) {
        onPriceUpdate(mockData[mockData.length - 1].close);
      }
    } catch (e) {
      console.warn('Mock data update warning:', e);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch market data - use the correct endpoint
      const response = await fetch(`/api/market-data/bars?symbol=${symbol}&timeframe=${timeInterval}&limit=100`);
      
      if (!response.ok) {
        // Try alternative mock data
        console.warn('Market data API failed, using mock data');
        generateMockData();
        return;
      }
      
      const data = await response.json();
      
      if (data.bars && data.bars.length > 0 && seriesRef.current && isMountedRef.current) {
        // Transform data for lightweight-charts
        const chartData = data.bars.map((bar: any) => ({
          time: Math.floor(new Date(bar.timestamp || bar.t).getTime() / 1000),
          open: parseFloat(bar.open || bar.o),
          high: parseFloat(bar.high || bar.h),
          low: parseFloat(bar.low || bar.l),
          close: parseFloat(bar.close || bar.c),
        })).sort((a: any, b: any) => a.time - b.time);

        try {
          seriesRef.current.setData(chartData);
          
          // Update price if callback provided
          if (onPriceUpdate && chartData.length > 0) {
            const latestPrice = chartData[chartData.length - 1].close;
            onPriceUpdate(latestPrice);
          }
        } catch (e) {
          console.warn('Data update warning:', e);
        }
      }
    } catch (error) {
      console.error('Data fetch error:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-sm">Loading chart...</div>
        </div>
      )}
    </div>
  );
};

export default StableChart;