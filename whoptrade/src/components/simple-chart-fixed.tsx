'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';

// Import the library dynamically to ensure it only runs on the client
const LightweightCharts = dynamic(
  () => import('lightweight-charts').then((mod) => mod),
  { ssr: false }
);

interface ChartData {
  time: number;
  value: number;
}

interface SimpleChartFixedProps {
  data: ChartData[];
  height?: number;
}

export default function SimpleChartFixed({ data = [], height = 400 }: SimpleChartFixedProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Set isClient to true when component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    // Only run on client and when container is available
    if (!isClient || !chartContainerRef.current) {
      return;
    }
    
    // Clear any existing chart
    if (chartContainerRef.current) {
      while (chartContainerRef.current.firstChild) {
        chartContainerRef.current.removeChild(chartContainerRef.current.firstChild);
      }
    }
    
    // Validate data
    if (!data || data.length === 0) {
      setError('No chart data available');
      return;
    }
    
    // Set theme colors
    const isDarkTheme = theme === 'dark';
    const textColor = isDarkTheme ? '#E1E1E6' : '#1D1D1F';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const backgroundColor = isDarkTheme ? '#1A1A1A' : '#FFFFFF';
    
    const initChart = async () => {
      try {
        // Import the lightweight-charts module
        const chartLib = await import('lightweight-charts');
        
        // Check if the container still exists (component might have unmounted)
        if (!chartContainerRef.current) {
          return;
        }
        
        // Create chart
        const chart = chartLib.createChart(chartContainerRef.current, {
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
        
        // Create series
        const lineSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
        
        // Format data for chart and ensure all required fields are present
        const formattedData = data.map(point => ({
          time: point.time || Date.now() / 1000,
          value: point.value || 0,
        }));
        
        // Set data
        lineSeries.setData(formattedData);
        
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
  }, [data, theme, height, isClient]);
  
  // Server-side or loading
  if (!isClient) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: `${height}px` }}>
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: `${height}px` }}>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: `${height}px` }}>
        <div className="text-muted-foreground">No chart data available</div>
      </div>
    );
  }
  
  return <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />;
} 