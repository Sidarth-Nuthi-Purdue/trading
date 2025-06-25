'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ChartData {
  time: number;
  value: number;
}

interface NextJSChartProps {
  data: ChartData[];
  height?: number;
}

export default function NextJSChart({ data, height = 400 }: NextJSChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || !data.length) {
      return;
    }

    // Clean up existing content
    const container = chartContainerRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Dynamic import of lightweight-charts
    import('lightweight-charts')
      .then(({ createChart }) => {
        try {
          // Create chart
          const chart = createChart(container, {
            width: container.clientWidth,
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

          // Add line series
          const lineSeries = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
          });

          // Set data
          lineSeries.setData(data);

          // Fit content
          chart.timeScale().fitContent();

          // Handle resize
          const handleResize = () => {
            chart.resize(
              container.clientWidth,
              height
            );
          };

          window.addEventListener('resize', handleResize);

          // Cleanup function
          return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
          };
        } catch (err) {
          console.error('Error creating chart:', err);
          setError('Failed to create chart');
        }
      })
      .catch(err => {
        console.error('Error loading chart library:', err);
        setError('Failed to load chart library');
      });
  }, [data, isClient, height]);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center text-red-500" style={{ height: `${height}px` }}>
        {error}
      </div>
    );
  }

  return <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />;
} 