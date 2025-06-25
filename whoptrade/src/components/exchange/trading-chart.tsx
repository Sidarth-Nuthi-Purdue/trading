'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Volume2, Settings, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

const timeframes = [
  { value: '1m', label: '1M' },
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '30m', label: '30M' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' }
];

export default function TradingChart({ symbol, timeframe, onTimeframeChange }: TradingChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [basePrice, setBasePrice] = useState(0); // Store the consistent current price
  const [previousSymbol, setPreviousSymbol] = useState(symbol);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadChartData();
  }, [symbol, timeframe]);

  // Load current price when symbol changes
  useEffect(() => {
    if (symbol !== previousSymbol) {
      loadCurrentPrice();
    }
  }, [symbol, previousSymbol]);

  useEffect(() => {
    if (chartData.length > 0) {
      drawChart();
    }
  }, [chartData]);

  const loadCurrentPrice = async () => {
    try {
      // Use dedicated quote endpoint for current price
      const response = await fetch(`/api/market-data/quote?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        if (data.price && data.price > 0) {
          setBasePrice(data.price);
          setCurrentPrice(data.price);
          setPreviousSymbol(symbol);
        }
      }
    } catch (error) {
      console.error('Error loading current price:', error);
    }
  };

  const loadChartData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/market-data/bars?symbol=${symbol}&interval=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        const bars = data.bars || [];
        
        // Convert to chart data format with proper timestamp handling
        const formattedData: ChartData[] = bars.map((bar: any) => {
          let timestamp = bar.time;
          
          // Ensure timestamp is in seconds (not milliseconds)
          if (typeof timestamp === 'string') {
            timestamp = new Date(timestamp).getTime() / 1000;
          } else if (timestamp > 9999999999) {
            // If timestamp looks like milliseconds, convert to seconds
            timestamp = timestamp / 1000;
          }
          
          return {
            time: timestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume
          };
        }).filter(bar => {
          // Additional validation to ensure data quality
          const now = Date.now() / 1000;
          const isValidTime = bar.time > (now - 5 * 365 * 24 * 60 * 60) && bar.time <= (now + 24 * 60 * 60);
          const hasValidPrices = bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0;
          const hasValidOHLC = bar.high >= bar.low && bar.high >= bar.open && bar.high >= bar.close && bar.low <= bar.open && bar.low <= bar.close;
          
          return isValidTime && hasValidPrices && hasValidOHLC;
        });

        // Sort by time
        formattedData.sort((a, b) => a.time - b.time);
        
        setChartData(formattedData);
        
        // Calculate price change using base price vs timeframe data
        if (formattedData.length > 1 && basePrice > 0) {
          const previous = formattedData[formattedData.length - 2];
          const change = basePrice - previous.close;
          const changePercent = (change / previous.close) * 100;
          
          setPriceChange(change);
          setPriceChangePercent(changePercent);
        } else if (formattedData.length > 1) {
          // Fallback if no base price yet
          const current = formattedData[formattedData.length - 1];
          const previous = formattedData[formattedData.length - 2];
          const change = current.close - previous.close;
          const changePercent = (change / previous.close) * 100;
          
          setCurrentPrice(current.close);
          setPriceChange(change);
          setPriceChangePercent(changePercent);
        }
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Clear canvas
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Calculate price range
    const prices = chartData.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    // Add some padding to the price range
    const paddedMin = minPrice - priceRange * 0.1;
    const paddedMax = maxPrice + priceRange * 0.1;
    const paddedRange = paddedMax - paddedMin;

    // Chart dimensions
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Draw grid lines
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = padding + (chartHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding + (chartWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw candlesticks
    const candleWidth = Math.max(2, chartWidth / chartData.length * 0.8);
    
    chartData.forEach((data, index) => {
      const x = padding + (chartWidth / chartData.length) * index + (chartWidth / chartData.length - candleWidth) / 2;
      
      const highY = padding + (paddedMax - data.high) / paddedRange * chartHeight;
      const lowY = padding + (paddedMax - data.low) / paddedRange * chartHeight;
      const openY = padding + (paddedMax - data.open) / paddedRange * chartHeight;
      const closeY = padding + (paddedMax - data.close) / paddedRange * chartHeight;
      
      const isGreen = data.close >= data.open;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY);
      
      // Draw wick
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, highY);
      ctx.lineTo(x + candleWidth / 2, lowY);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.fillRect(x, bodyTop, candleWidth, Math.max(1, bodyHeight));
    });

    // Draw price labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const price = paddedMax - (paddedRange / 5) * i;
      const y = padding + (chartHeight / 5) * i;
      ctx.fillText(price.toFixed(2), width - padding - 5, y + 4);
    }

    // Draw current price line (show even if outside chart range)
    if (currentPrice > 0) {
      // If price is within range, draw line
      if (currentPrice >= paddedMin && currentPrice <= paddedMax) {
        const currentY = padding + (paddedMax - currentPrice) / paddedRange * chartHeight;
        ctx.strokeStyle = priceChange >= 0 ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding, currentY);
        ctx.lineTo(width - padding, currentY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Current price label
        ctx.fillStyle = priceChange >= 0 ? '#10b981' : '#ef4444';
        ctx.fillRect(width - padding - 60, currentY - 10, 55, 20);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(currentPrice.toFixed(2), width - padding - 32, currentY + 4);
      } else {
        // If price is outside range, show indicator at top or bottom
        const isAbove = currentPrice > paddedMax;
        const indicatorY = isAbove ? padding + 15 : height - padding - 15;
        
        ctx.fillStyle = priceChange >= 0 ? '#10b981' : '#ef4444';
        ctx.fillRect(width - padding - 60, indicatorY - 10, 55, 20);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${isAbove ? '↑' : '↓'} ${currentPrice.toFixed(2)}`, width - padding - 32, indicatorY + 3);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Chart Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-xl font-bold text-white">{symbol}</h2>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-medium text-white">
                {formatCurrency(currentPrice)}
              </span>
              <div className={`flex items-center space-x-1 ${
                priceChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {priceChange >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Timeframe Selector */}
          <div className="flex space-x-1">
            {timeframes.map((tf) => (
              <Button
                key={tf.value}
                size="sm"
                variant={timeframe === tf.value ? "default" : "ghost"}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-3 py-1 text-xs ${
                  timeframe === tf.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tf.label}
              </Button>
            ))}
          </div>

          <div className="border-l border-gray-700 pl-2 ml-2">
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>

      {/* Chart Footer */}
      <div className="flex items-center justify-between p-2 border-t border-gray-800 text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Volume: {chartData.length > 0 ? chartData[chartData.length - 1]?.volume?.toLocaleString() : 0}</span>
          <span>Bars: {chartData.length}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-gray-400 border-gray-600">
            {timeframe.toUpperCase()}
          </Badge>
          <span>Real-time data</span>
        </div>
      </div>
    </div>
  );
}