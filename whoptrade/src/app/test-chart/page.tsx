'use client';

import React from 'react';
import ChartView from '@/components/chart-view';

export default function TestChartPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">TradingView Charts Test Page</h1>
      
      <div className="mb-6">
        <ChartView 
          symbol="AAPL" 
          height={500}
          className="shadow-xl"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">Features</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Candlestick chart with volume display</li>
            <li>Time interval selectors (1m, 5m, 15m, 30m, 1h, 4h, 1d)</li>
            <li>Interactive crosshair with price display</li>
            <li>Zoom and pan functionality</li>
            <li>Dark theme optimized for trading</li>
            <li>Smooth historical data loading on scroll</li>
            <li>Real-time price updates</li>
            <li>TradingView attribution as required by license</li>
          </ul>
        </div>
        
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">Instructions</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Click and drag to pan the chart</li>
            <li>Use mouse wheel to zoom in/out</li>
            <li>Click time interval buttons to change timeframe</li>
            <li>Scroll left to load more historical data</li>
            <li>Hover over candles to see price information</li>
            <li>Click the refresh button to update data</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 