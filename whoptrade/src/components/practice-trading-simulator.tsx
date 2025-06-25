import React, { useState } from 'react';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, Play, Pause, RotateCcw, Clock, Settings, FastForward } from 'lucide-react';
import { format, addDays, startOfDay, isAfter, isWeekend } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';

// Simulation speed options
const SPEED_OPTIONS = [
  { value: '1', label: '1x (Real-time)' },
  { value: '5', label: '5x' },
  { value: '10', label: '10x' },
  { value: '30', label: '30x' },
  { value: '60', label: '1 Hour / Min' },
  { value: '360', label: '6 Hours / Min' },
  { value: '1440', label: '1 Day / Min' },
];

export interface SimulationConfig {
  startDate: Date;
  endDate: Date;
  speed: number;
  skipWeekends: boolean;
  skipAfterHours: boolean;
  showRealTimePrices: boolean;
}

interface PracticeTradingSimulatorProps {
  onStart: (config: SimulationConfig) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  isActive: boolean;
  isPaused: boolean;
  currentDateTime?: Date;
  progress?: number;
}

export default function PracticeTradingSimulator({
  onStart,
  onPause,
  onResume,
  onReset,
  onSpeedChange,
  isActive = false,
  isPaused = false,
  currentDateTime,
  progress = 0
}: PracticeTradingSimulatorProps) {
  // Default to yesterday as start date and today as end date
  const yesterday = startOfDay(addDays(new Date(), -1));
  const today = startOfDay(new Date());
  
  // State for configuration
  const [startDate, setStartDate] = useState<Date>(yesterday);
  const [endDate, setEndDate] = useState<Date>(today);
  const [speed, setSpeed] = useState<string>('10');
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true);
  const [skipAfterHours, setSkipAfterHours] = useState<boolean>(false);
  const [showRealTimePrices, setShowRealTimePrices] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Handle start button click
  const handleStart = () => {
    onStart({
      startDate,
      endDate,
      speed: parseInt(speed, 10),
      skipWeekends,
      skipAfterHours,
      showRealTimePrices
    });
  };
  
  // Handle speed change
  const handleSpeedChange = (newSpeed: string) => {
    setSpeed(newSpeed);
    if (isActive) {
      onSpeedChange(parseInt(newSpeed, 10));
    }
  };
  
  // Format time from the simulation
  const formatSimulationTime = (date?: Date) => {
    if (!date) return 'N/A';
    return format(date, 'MMM d, yyyy h:mm a');
  };
  
  return (
    <div className="bg-card border rounded-lg p-4 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Practice Trading Simulator</h3>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      
      {!isActive ? (
        // Setup mode - show date pickers and configuration
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    id="start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    disabled={(date) => isAfter(date, endDate) || isAfter(date, new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    id="end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={(date) => isAfter(date, new Date()) || isAfter(startDate, date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="simulation-speed">Simulation Speed</Label>
            <Select value={speed} onValueChange={handleSpeedChange}>
              <SelectTrigger id="simulation-speed">
                <SelectValue placeholder="Select speed" />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {showSettings && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="skip-weekends">Skip Weekends</Label>
                    <p className="text-sm text-muted-foreground">Jump over Saturday and Sunday</p>
                  </div>
                  <Switch
                    id="skip-weekends"
                    checked={skipWeekends}
                    onCheckedChange={setSkipWeekends}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="skip-after-hours">Skip After Hours</Label>
                    <p className="text-sm text-muted-foreground">Only simulate market hours (9:30 AM - 4 PM ET)</p>
                  </div>
                  <Switch
                    id="skip-after-hours"
                    checked={skipAfterHours}
                    onCheckedChange={setSkipAfterHours}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="real-time-prices">Show Real-time Prices</Label>
                    <p className="text-sm text-muted-foreground">Display current market prices alongside simulation</p>
                  </div>
                  <Switch
                    id="real-time-prices"
                    checked={showRealTimePrices}
                    onCheckedChange={setShowRealTimePrices}
                  />
                </div>
              </div>
            </>
          )}
          
          <Button 
            className="w-full" 
            onClick={handleStart}
          >
            <Play className="mr-2 h-4 w-4" /> Start Simulation
          </Button>
        </div>
      ) : (
        // Active simulation - show controls and progress
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatSimulationTime(currentDateTime)}</span>
            {skipWeekends && isWeekend(currentDateTime || new Date()) && (
              <Badge variant="outline" className="ml-2">Weekend</Badge>
            )}
          </div>
          
          <div className="w-full bg-secondary rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className="bg-primary h-2.5 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {format(startDate, 'MMM d')}
            </span>
            <span className="text-sm text-muted-foreground">
              {format(endDate, 'MMM d')}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Select value={speed} onValueChange={handleSpeedChange}>
              <SelectTrigger className="w-40">
                <FastForward className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex-1 flex space-x-2">
              {isPaused ? (
                <Button className="flex-1" onClick={onResume}>
                  <Play className="mr-2 h-4 w-4" /> Resume
                </Button>
              ) : (
                <Button className="flex-1" onClick={onPause}>
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
              )}
              
              <Button variant="outline" onClick={onReset}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 