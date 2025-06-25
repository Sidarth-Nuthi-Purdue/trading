'use client';

import { useEffect, useRef, useState } from 'react';

// Function to dynamically import the chart library only on client-side
const getChartLibrary = async () => {
  // Only import in browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    // Dynamic import to ensure it only happens on client side
    const LightweightCharts = await import('lightweight-charts');
    return LightweightCharts;
  } catch (error) {
    console.error('Failed to load chart library:', error);
    return null;
  }
};

/**
 * Custom hook for safely using the lightweight-charts library
 * @param containerRef Reference to the container element
 * @param options Chart options
 * @returns Object containing chart instance and loading state
 */
export function useChart(
  containerRef: React.RefObject<HTMLDivElement>,
  options: any = {}
) {
  const chartRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartLibrary, setChartLibrary] = useState<any>(null);
  
  // Load the chart library on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadLibrary = async () => {
      try {
        const lib = await getChartLibrary();
        if (isMounted) {
          setChartLibrary(lib);
          if (!lib) {
            setError('Failed to load chart library');
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error loading chart library:', error);
          setError('Failed to load chart library');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadLibrary();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Create the chart when the library and container are available
  useEffect(() => {
    if (!chartLibrary || !containerRef.current || chartRef.current) {
      return;
    }
    
    try {
      console.log('Creating chart...');
      
      // Default chart options
      const defaultOptions = {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      };
      
      // Create the chart with combined options
      const chart = chartLibrary.createChart(
        containerRef.current,
        { ...defaultOptions, ...options }
      );
      
      // Store the chart instance
      chartRef.current = chart;
      
      // Handle resize
      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chart.resize(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight
          );
        }
      };
      
      // Add resize listener
      window.addEventListener('resize', handleResize);
      
      // Log success
      console.log('Chart created successfully');
      
      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize);
        
        if (chartRef.current) {
          console.log('Cleaning up chart');
          chartRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error creating chart:', error);
      setError('Failed to create chart');
    }
  }, [chartLibrary, containerRef, options]);
  
  // Helper function to create a series with error handling
  const createSeries = (type: string, seriesOptions: any = {}) => {
    if (!chartRef.current) {
      console.error('Cannot create series - chart not initialized');
      return null;
    }
    
    try {
      let series;
      
      switch (type) {
        case 'line':
          series = chartRef.current.addLineSeries(seriesOptions);
          break;
        case 'area':
          series = chartRef.current.addAreaSeries(seriesOptions);
          break;
        case 'bar':
          series = chartRef.current.addBarSeries(seriesOptions);
          break;
        case 'candlestick':
          series = chartRef.current.addCandlestickSeries(seriesOptions);
          break;
        case 'histogram':
          series = chartRef.current.addHistogramSeries(seriesOptions);
          break;
        default:
          console.error(`Unknown series type: ${type}`);
          return null;
      }
      
      return series;
    } catch (error) {
      console.error(`Error creating ${type} series:`, error);
      return null;
    }
  };
  
  // Helper function to set data with error handling
  const setSeriesData = (series: any, data: any[]) => {
    if (!series) {
      console.error('Cannot set data - series not initialized');
      return false;
    }
    
    try {
      series.setData(data);
      return true;
    } catch (error) {
      console.error('Error setting series data:', error);
      return false;
    }
  };
  
  // Helper function to remove a series with error handling
  const removeSeries = (series: any) => {
    if (!chartRef.current || !series) {
      return false;
    }
    
    try {
      chartRef.current.removeSeries(series);
      return true;
    } catch (error) {
      console.error('Error removing series:', error);
      return false;
    }
  };
  
  // Fit content to visible range
  const fitContent = () => {
    if (!chartRef.current) {
      return false;
    }
    
    try {
      chartRef.current.timeScale().fitContent();
      return true;
    } catch (error) {
      console.error('Error fitting content:', error);
      return false;
    }
  };
  
  return {
    chart: chartRef.current,
    loading,
    error,
    library: chartLibrary,
    createSeries,
    setSeriesData,
    removeSeries,
    fitContent,
  };
}

export default useChart; 