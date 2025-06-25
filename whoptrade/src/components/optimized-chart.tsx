'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface ChartData {
  time: number;
  value: number;
}

interface OptimizedChartProps {
  data: ChartData[];
  height?: number;
  width?: number;
}

export default function OptimizedChart({ 
  data, 
  height = 400, 
  width = 800 
}: OptimizedChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    let cleanup: (() => void) | undefined;
    let chartInstance: any = null;
    
    const container = chartContainerRef.current;
    if (!container || !data || data.length === 0) return;
    
    // Clean up any existing children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    const loadAndCreateChart = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Dynamic import of the library
        const LightweightCharts = await import('lightweight-charts');
        
        // Create chart instance
        chartInstance = LightweightCharts.createChart(container, {
          width: container.clientWidth || width,
          height: height,
          layout: {
            background: { color: '#ffffff' },
            textColor: '#333333',
          },
          grid: {
            vertLines: { color: 'rgba(0, 0, 0, 0.1)' },
            horzLines: { color: 'rgba(0, 0, 0, 0.1)' },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        });
        
        // Add a line series
        const lineSeries = chartInstance.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
        
        // Set the data
        if (data && data.length > 0) {
          lineSeries.setData(data);
          chartInstance.timeScale().fitContent();
        }
        
        // Add resize handler
        const handleResize = () => {
          if (chartInstance && container) {
            chartInstance.resize(
              container.clientWidth || width,
              height
            );
            chartInstance.timeScale().fitContent();
          }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Define cleanup function
        cleanup = () => {
          window.removeEventListener('resize', handleResize);
          if (chartInstance) {
            try {
              chartInstance.remove();
              chartInstance = null;
            } catch (err) {
              console.error('Error during chart cleanup:', err);
            }
          }
        };
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error creating chart:', err);
        setError('Failed to create chart. Please try again later.');
        setIsLoading(false);
      }
    };
    
    loadAndCreateChart();
    
    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [data, height, width]);
  
  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
          <div className="flex items-center text-red-500">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}
      
      <div
        ref={chartContainerRef}
        className="w-full h-full"
      />
    </div>
  );
} 