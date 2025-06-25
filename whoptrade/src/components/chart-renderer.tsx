'use client';

import React, { useEffect, useRef } from 'react';
import * as LightweightCharts from 'lightweight-charts';

interface ChartPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartRendererProps {
  data: ChartPoint[];
  theme?: string;
}

export function ChartRenderer({ data, theme = 'light' }: ChartRendererProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return;

    try {
      // Clean up any existing chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }

      // Set theme colors
      const isDarkTheme = theme === 'dark';
      const textColor = isDarkTheme ? '#E1E1E6' : '#1D1D1F';
      const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      const backgroundColor = isDarkTheme ? '#1A1A1A' : '#FFFFFF';

      // Create chart
      const chart = LightweightCharts.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
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

      // Store reference
      chartRef.current = chart;

      // Create series
      const lineSeries = chart.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
      });

      // Store reference
      seriesRef.current = lineSeries;

      // Format data
      const formattedData = data.map(d => ({
        time: Math.floor(d.time / 1000), // Convert to seconds for chart
        value: d.close,
      }));

      // Set data
      lineSeries.setData(formattedData);

      // Fit content
      chart.timeScale().fitContent();

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.resize(
            chartContainerRef.current.clientWidth,
            chartContainerRef.current.clientHeight
          );
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          seriesRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error rendering chart:', error);
      // Chart rendering failed - clean up any partial state
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Ignore errors during cleanup
        }
        chartRef.current = null;
        seriesRef.current = null;
      }
    }
  }, [data, theme]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !data.length) return;

    try {
      // Update data when it changes
      const formattedData = data.map(d => ({
        time: Math.floor(d.time / 1000),
        value: d.close,
      }));

      seriesRef.current.setData(formattedData);
      chartRef.current.timeScale().fitContent();
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
} 