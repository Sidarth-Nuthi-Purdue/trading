'use client';

import React, { useState, useEffect } from 'react';
import { useSimulation } from '@/hooks/use-simulation';
import PracticeTradingSimulator, { SimulationConfig } from '@/components/practice-trading-simulator';
import TradingChart from '@/components/trading-chart';
import { fetchHistoricalBars } from '@/lib/alpaca-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info } from 'lucide-react';
import { format } from 'date-fns';

// Default symbols for practice trading
const DEFAULT_SYMBOLS = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'TSLA',
  'NVDA',
  'META',
  'BRK.B',
  'JPM',
  'JNJ'
];

export default function PracticeTradingPage() {
  // State for selected symbol
  const [symbol, setSymbol] = useState<string>('AAPL');
  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Get simulation hook
  const simulation = useSimulation();
  
  // Handle symbol change
  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol);
    
    // Reset the simulation when symbol changes
    if (simulation.isActive) {
      simulation.stop();
    }
    
    setHistoricalDataLoaded(false);
  };
  
  // Handle custom symbol entry
  const handleCustomSymbolSubmit = () => {
    if (customSymbol.trim()) {
      setSymbol(customSymbol.trim().toUpperCase());
      setCustomSymbol('');
      setHistoricalDataLoaded(false);
    }
  };
  
  // Handle simulation start
  const handleStartSimulation = async (config: SimulationConfig) => {
    setLoadingData(true);
    setErrorMessage(null);
    
    try {
      // Fetch historical data for the selected symbol and date range
      const bars = await fetchHistoricalBars(
        symbol,
        config.startDate,
        config.endDate,
        '1Min'
      );
      
      if (bars.length === 0) {
        throw new Error('No historical data available for the selected period');
      }
      
      // Initialize the simulation with the fetched data
      simulation.initialize(bars, config);
      setHistoricalDataLoaded(true);
      
      // Start the simulation
      simulation.start();
    } catch (error) {
      console.error('Error starting simulation:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load historical data');
    } finally {
      setLoadingData(false);
    }
  };
  
  // Format date for display
  const formatDateTime = (date: Date): string => {
    return format(date, 'MMM d, yyyy h:mm a');
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Practice Trading</h1>
        <p className="text-muted-foreground">
          Improve your trading skills by practicing with historical market data.
        </p>
      </div>
      
      {/* Symbol selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Select Symbol</CardTitle>
          <CardDescription>
            Choose a stock to practice trading with
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SYMBOLS.map((s) => (
              <Button
                key={s}
                variant={symbol === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSymbolChange(s)}
              >
                {s}
              </Button>
            ))}
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="Enter symbol..."
                className="px-3 py-1 border rounded-md w-32"
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSymbolSubmit()}
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCustomSymbolSubmit}
                disabled={!customSymbol.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation controls */}
        <div className="lg:col-span-1">
          <PracticeTradingSimulator
            onStart={handleStartSimulation}
            onPause={simulation.pause}
            onResume={simulation.resume}
            onReset={simulation.reset}
            onSpeedChange={simulation.setSpeed}
            isActive={simulation.isActive}
            isPaused={simulation.isPaused}
            currentDateTime={simulation.currentDateTime}
            progress={simulation.progress}
          />
          
          {loadingData && (
            <div className="mt-4 p-4 bg-card border rounded-lg text-center">
              <p>Loading historical data...</p>
            </div>
          )}
          
          {errorMessage && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error</p>
                  <p className="text-sm text-destructive/90">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
          
          {simulation.isActive && (
            <div className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Current Market Data</CardTitle>
                </CardHeader>
                <CardContent>
                  {simulation.currentBar ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-medium">${simulation.currentBar.c.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Open:</span>
                        <span>${simulation.currentBar.o.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">High:</span>
                        <span>${simulation.currentBar.h.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Low:</span>
                        <span>${simulation.currentBar.l.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Volume:</span>
                        <span>{simulation.currentBar.v.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Time:</span>
                        <span>{new Date(simulation.currentBar.t).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        {/* Trading chart and order panel */}
        <div className="lg:col-span-2">
          {simulation.isActive && historicalDataLoaded ? (
            <TradingChart 
              symbol={symbol}
              initialTimeframe="1Min"
              simulationMode={true}
              simulationData={simulation.visibleBars.map(bar => ({
                t: bar.t,
                o: bar.o,
                h: bar.h,
                l: bar.l,
                c: bar.c,
                v: bar.v
              }))}
            />
          ) : (
            <div className="bg-card border rounded-lg p-8 flex flex-col items-center justify-center min-h-[500px]">
              <h3 className="text-xl font-medium mb-4">Practice Trading Simulator</h3>
              <p className="text-center text-muted-foreground mb-6">
                Select a symbol, choose a date range, and start the simulation to practice trading with historical data.
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">Selected: {symbol}</Badge>
                {!simulation.isActive && (
                  <span>Configure and start the simulation to begin</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 