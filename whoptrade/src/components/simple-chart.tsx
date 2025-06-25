'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

interface ChartData {
  time: number;
  value: number;
}

interface SimpleChartProps {
  data: ChartData[];
  height?: number;
}

export default function SimpleChart({ data, height = 400 }: SimpleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined' || !chartContainerRef.current || !data.length) {
      return;
    }
    
    // Clean up any existing chart
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
        // Dynamically import the library
        const LightweightCharts = await import('lightweight-charts');
        
        // Check if the container still exists (component might have unmounted)
        if (!chartContainerRef.current) {
          return;
        }
        
        // Create chart
        const chart = LightweightCharts.createChart(chartContainerRef.current, {
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
        
        // Format data for chart
        const formattedData = data.map(point => ({
          time: point.time,
          value: point.value,
        }));
        
        // Set data
        lineSeries.setData(formattedData);
        
        // Fit content
        chart.timeScale().fitContent();
        
        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current) {
            chart.resize(
              chartContainerRef.current.clientWidth,
              height
            );
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
  }, [data, theme, height]);
  
  if (error) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: `${height}px` }}>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  return <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />;
} 