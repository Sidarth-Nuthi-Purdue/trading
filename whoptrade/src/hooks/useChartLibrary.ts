'use client';

import { useState, useEffect } from 'react';
import type * as LightweightChartsType from 'lightweight-charts';

export default function useChartLibrary() {
  const [chartLibrary, setChartLibrary] = useState<typeof LightweightChartsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    let isMounted = true;
    
    const loadLibrary = async () => {
      try {
        setIsLoading(true);
        
        // Dynamic import of the library
        const module = await import('lightweight-charts');
        
        if (isMounted) {
          setChartLibrary(module);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load chart library:', err);
          setError(err instanceof Error ? err : new Error('Failed to load chart library'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadLibrary();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return { chartLibrary, isLoading, error };
} 