'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import StockChart, { TimeframeType, ChartType } from './stock-chart';
import { PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

// Default stocks to display
const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'TSLA', 'META'];

type ChartData = {
  id: string;
  symbol: string;
  timeframe: TimeframeType;
  chartType: ChartType;
};

export default function MultiChartView() {
  const [chartLayout, setChartLayout] = useState<ChartData[]>(
    DEFAULT_STOCKS.map((symbol, index) => ({
      id: `chart-${index}`,
      symbol,
      timeframe: '1Day',
      chartType: 'candle'
    }))
  );
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [isAddChartDialogOpen, setIsAddChartDialogOpen] = useState(false);
  const [newChartSymbol, setNewChartSymbol] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);

  // Use useEffect to ensure rendering only happens on client side for drag and drop
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Handle drag end to reorder charts
  const handleDragEnd = (result: DropResult) => {
    // Dropped outside the list
    if (!result.destination) {
      return;
    }

    const items = Array.from(chartLayout);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setChartLayout(items);
  };

  // Handle chart timeframe change
  const handleTimeframeChange = (chartId: string, newTimeframe: TimeframeType) => {
    setChartLayout(prev => 
      prev.map(chart => 
        chart.id === chartId ? { ...chart, timeframe: newTimeframe } : chart
      )
    );
  };
  
  // Handle chart type change
  const handleChartTypeChange = (chartId: string, newChartType: ChartType) => {
    setChartLayout(prev => 
      prev.map(chart => 
        chart.id === chartId ? { ...chart, chartType: newChartType } : chart
      )
    );
  };

  // Handle chart expansion
  const handleExpandChart = (chartId: string) => {
    setExpandedChart(expandedChart === chartId ? null : chartId);
  };

  // Handle chart removal
  const handleRemoveChart = (chartId: string) => {
    setChartLayout(prev => prev.filter(chart => chart.id !== chartId));
  };

  // Add a new chart
  const handleAddChart = () => {
    if (!newChartSymbol) return;
    
    const newChart: ChartData = {
      id: `chart-${Date.now()}`,
      symbol: newChartSymbol.toUpperCase(),
      timeframe: '1Day',
      chartType: 'candle'
    };
    
    setChartLayout(prev => [...prev, newChart]);
    setNewChartSymbol('');
    setIsAddChartDialogOpen(false);
  };

  // Determine grid layout based on number of charts
  const getGridClass = () => {
    if (expandedChart !== null) {
      return 'grid-cols-1';
    }
    
    switch (chartLayout.length) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 md:grid-cols-2';
      case 3: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default: return 'grid-cols-1 md:grid-cols-2';
    }
  };

  // Only render the DragDropContext on the client side
  if (!isBrowser) {
    // Return a placeholder until client-side rendering is available
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Market Overview</h2>
          <Button 
            onClick={() => setIsAddChartDialogOpen(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" /> Add Chart
          </Button>
        </div>
        <div className={`grid ${getGridClass()} gap-4`}>
          {chartLayout.map((chart) => (
            <div key={chart.id} className="relative">
              <StockChart
                symbol={chart.symbol}
                timeframe={chart.timeframe}
                initialChartType={chart.chartType}
                onTimeframeChange={(timeframe) => handleTimeframeChange(chart.id, timeframe)}
                onClose={() => handleRemoveChart(chart.id)}
                onExpand={() => handleExpandChart(chart.id)}
                showExpandButton={true}
                expanded={expandedChart === chart.id}
                isFullWidth={expandedChart === chart.id}
                height={expandedChart === chart.id ? 500 : 350}
                showVolume={true}
                showMA={true}
                maLength={20}
              />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Market Overview</h2>
        <Button 
          onClick={() => setIsAddChartDialogOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" /> Add Chart
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="charts" direction="horizontal" isDropDisabled={false}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`grid ${getGridClass()} gap-4`}
            >
              {chartLayout.map((chart, index) => {
                // Determine if this chart is currently expanded
                const isExpanded = expandedChart === chart.id;
                // Only show this chart if it's expanded, or if no chart is expanded
                const shouldShow = isExpanded || expandedChart === null;
                
                return shouldShow ? (
                  <Draggable key={chart.id} draggableId={chart.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="relative"
                      >
                        <StockChart
                          symbol={chart.symbol}
                          timeframe={chart.timeframe}
                          initialChartType={chart.chartType}
                          onTimeframeChange={(timeframe) => handleTimeframeChange(chart.id, timeframe)}
                          onClose={() => handleRemoveChart(chart.id)}
                          onExpand={() => handleExpandChart(chart.id)}
                          showExpandButton={true}
                          expanded={isExpanded}
                          isFullWidth={isExpanded}
                          height={isExpanded ? 500 : 350}
                          showVolume={true}
                          showMA={true}
                          maLength={20}
                        />
                      </div>
                    )}
                  </Draggable>
                ) : null;
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Chart Dialog */}
      <Dialog open={isAddChartDialogOpen} onOpenChange={setIsAddChartDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Chart</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter stock symbol (e.g., AAPL)"
              value={newChartSymbol}
              onChange={(e) => setNewChartSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddChart()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddChartDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddChart}>Add Chart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 