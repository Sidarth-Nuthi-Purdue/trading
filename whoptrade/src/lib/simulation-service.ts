import { 
  startOfDay, 
  addMinutes, 
  isWeekend, 
  isAfter,
  isBefore,
  isSameDay,
  set,
  differenceInMinutes
} from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { EventEmitter } from 'events';

// Type definitions
export interface SimulationBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SimulationConfig {
  startDate: Date;
  endDate: Date;
  speed: number;
  skipWeekends: boolean;
  skipAfterHours: boolean;
  showRealTimePrices: boolean;
}

export interface SimulationState {
  currentDateTime: Date;
  isActive: boolean;
  isPaused: boolean;
  progress: number;
  currentBar?: SimulationBar;
  visibleBars: SimulationBar[];
}

// Market hours (Eastern Time)
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MINUTE = 0;

// Define types for event handlers
export type DataUpdateHandler = (state: SimulationState) => void;
export type SimulationEndHandler = () => void;

/**
 * Service to handle practice trading simulation
 */
export class SimulationService {
  private config: SimulationConfig | null = null;
  private allBars: SimulationBar[] = [];
  private visibleBars: SimulationBar[] = [];
  private currentIndex: number = 0;
  private currentDateTime: Date | null = null;
  private isActive: boolean = false;
  private isPaused: boolean = false;
  private simulationInterval: NodeJS.Timeout | null = null;
  private eventEmitter = new EventEmitter();
  private lastUpdateTime: number = 0;
  private timeFactor: number = 1;
  
  /**
   * Initialize the simulation with historical data and config
   */
  initialize(bars: SimulationBar[], config: SimulationConfig): void {
    this.allBars = [...bars].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    this.config = config;
    this.visibleBars = [];
    this.currentIndex = 0;
    this.currentDateTime = new Date(config.startDate);
    this.isActive = false;
    this.isPaused = false;
    this.timeFactor = config.speed;
    
    // Adjust start time to market open if during market hours
    if (config.skipAfterHours) {
      this.setToMarketOpenTime(this.currentDateTime);
    }
    
    // Skip weekend if needed
    if (config.skipWeekends && isWeekend(this.currentDateTime)) {
      this.advanceToNextWeekday(this.currentDateTime);
    }
    
    // Find the starting index in the data
    this.currentIndex = this.findClosestBarIndex(this.currentDateTime);
    
    // Emit initial state
    this.emitUpdate();
  }
  
  /**
   * Start the simulation
   */
  start(): void {
    if (!this.config || this.isActive) return;
    
    this.isActive = true;
    this.isPaused = false;
    this.lastUpdateTime = Date.now();
    
    // Start the simulation interval
    this.simulationInterval = setInterval(() => {
      this.updateSimulation();
    }, 1000); // Update every second
    
    this.emitUpdate();
  }
  
  /**
   * Pause the simulation
   */
  pause(): void {
    if (!this.isActive || this.isPaused) return;
    
    this.isPaused = true;
    this.emitUpdate();
  }
  
  /**
   * Resume the simulation
   */
  resume(): void {
    if (!this.isActive || !this.isPaused) return;
    
    this.isPaused = false;
    this.lastUpdateTime = Date.now();
    this.emitUpdate();
  }
  
  /**
   * Reset the simulation
   */
  reset(): void {
    if (!this.config) return;
    
    // Stop the current simulation
    this.stop();
    
    // Reset to initial state
    this.currentDateTime = new Date(this.config.startDate);
    this.visibleBars = [];
    this.currentIndex = this.findClosestBarIndex(this.currentDateTime);
    
    // Adjust start time if needed
    if (this.config.skipAfterHours) {
      this.setToMarketOpenTime(this.currentDateTime);
    }
    
    if (this.config.skipWeekends && isWeekend(this.currentDateTime)) {
      this.advanceToNextWeekday(this.currentDateTime);
    }
    
    this.emitUpdate();
  }
  
  /**
   * Stop the simulation
   */
  stop(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    this.isActive = false;
    this.isPaused = false;
    this.emitUpdate();
  }
  
  /**
   * Change the simulation speed
   */
  setSpeed(speed: number): void {
    if (!this.config) return;
    
    this.timeFactor = speed;
    this.config.speed = speed;
    this.emitUpdate();
  }
  
  /**
   * Subscribe to data updates
   */
  onDataUpdate(handler: DataUpdateHandler): () => void {
    this.eventEmitter.on('update', handler);
    return () => {
      this.eventEmitter.off('update', handler);
    };
  }
  
  /**
   * Subscribe to simulation end event
   */
  onSimulationEnd(handler: SimulationEndHandler): () => void {
    this.eventEmitter.on('end', handler);
    return () => {
      this.eventEmitter.off('end', handler);
    };
  }
  
  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    return {
      currentDateTime: this.currentDateTime || new Date(),
      isActive: this.isActive,
      isPaused: this.isPaused,
      progress: this.calculateProgress(),
      currentBar: this.getCurrentBar(),
      visibleBars: [...this.visibleBars]
    };
  }
  
  /**
   * Update the simulation state based on elapsed time
   */
  private updateSimulation(): void {
    if (!this.config || !this.currentDateTime || !this.isActive || this.isPaused) return;
    
    const now = Date.now();
    const elapsedMs = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Calculate simulated time advancement
    // For example, if speed is 10x, then 1 second of real time = 10 seconds of simulated time
    const simulatedMinutes = (elapsedMs / 1000) * (this.timeFactor / 60);
    let newDateTime = addMinutes(this.currentDateTime, simulatedMinutes);
    
    // Check if we've reached the end date
    if (isAfter(newDateTime, this.config.endDate)) {
      newDateTime = new Date(this.config.endDate);
      this.currentDateTime = newDateTime;
      this.updateVisibleBars();
      this.emitUpdate();
      this.stop();
      this.eventEmitter.emit('end');
      return;
    }
    
    // Handle weekend skipping
    if (this.config.skipWeekends && isWeekend(newDateTime) && !isWeekend(this.currentDateTime)) {
      this.advanceToNextWeekday(newDateTime);
      newDateTime = this.currentDateTime;
    }
    
    // Handle after-hours skipping
    if (this.config.skipAfterHours && !this.isMarketHours(newDateTime)) {
      if (this.isBeforeMarketOpen(newDateTime) && this.isMarketDay(newDateTime)) {
        // If before market open on a market day, jump to market open
        newDateTime = this.setToMarketOpenTime(newDateTime);
      } else {
        // If after market close, jump to next day's market open
        newDateTime = addMinutes(newDateTime, 1);
        // Check if we need to skip the weekend
        if (this.config.skipWeekends && isWeekend(newDateTime)) {
          this.advanceToNextWeekday(newDateTime);
          newDateTime = this.currentDateTime;
        }
        if (this.isMarketDay(newDateTime)) {
          newDateTime = this.setToMarketOpenTime(newDateTime);
        }
      }
    }
    
    // Update the current time and bar index
    this.currentDateTime = newDateTime;
    this.updateVisibleBars();
    
    // Emit the update
    this.emitUpdate();
  }
  
  /**
   * Update the visible bars based on current time
   */
  private updateVisibleBars(): void {
    if (!this.currentDateTime) return;
    
    // Find all bars up to the current time
    const newIndex = this.findClosestBarIndex(this.currentDateTime);
    
    // If we have advanced to new bars, add them to visible bars
    if (newIndex > this.currentIndex) {
      for (let i = this.currentIndex; i <= newIndex; i++) {
        if (i < this.allBars.length) {
          this.visibleBars.push(this.allBars[i]);
        }
      }
      this.currentIndex = newIndex;
    }
  }
  
  /**
   * Find the index of the bar closest to the current time
   */
  private findClosestBarIndex(date: Date): number {
    const targetTime = date.getTime();
    
    // Find the last bar that has a timestamp less than or equal to the target time
    for (let i = 0; i < this.allBars.length; i++) {
      const barTime = new Date(this.allBars[i].timestamp).getTime();
      if (barTime > targetTime) {
        return Math.max(0, i - 1);
      }
    }
    
    // If all bars are before the target time, return the last index
    return this.allBars.length - 1;
  }
  
  /**
   * Emit an update event with the current state
   */
  private emitUpdate(): void {
    this.eventEmitter.emit('update', this.getState());
  }
  
  /**
   * Calculate the progress percentage of the simulation
   */
  private calculateProgress(): number {
    if (!this.config || !this.currentDateTime) return 0;
    
    const startTime = this.config.startDate.getTime();
    const endTime = this.config.endDate.getTime();
    const currentTime = this.currentDateTime.getTime();
    
    const totalDuration = endTime - startTime;
    if (totalDuration <= 0) return 100;
    
    const elapsed = currentTime - startTime;
    const progress = (elapsed / totalDuration) * 100;
    
    return Math.min(100, Math.max(0, progress));
  }
  
  /**
   * Get the current bar based on the simulation time
   */
  private getCurrentBar(): SimulationBar | undefined {
    if (this.currentIndex < 0 || this.currentIndex >= this.allBars.length) {
      return undefined;
    }
    
    return this.allBars[this.currentIndex];
  }
  
  /**
   * Check if the given date is during market hours
   */
  private isMarketHours(date: Date): boolean {
    // Convert to Eastern Time for market hours
    const easternDate = this.convertToEasternTime(date);
    const hours = easternDate.getHours();
    const minutes = easternDate.getMinutes();
    
    // Market hours are 9:30 AM - 4:00 PM Eastern
    if (hours < MARKET_OPEN_HOUR) return false;
    if (hours === MARKET_OPEN_HOUR && minutes < MARKET_OPEN_MINUTE) return false;
    if (hours > MARKET_CLOSE_HOUR) return false;
    if (hours === MARKET_CLOSE_HOUR && minutes > MARKET_CLOSE_MINUTE) return false;
    
    return true;
  }
  
  /**
   * Check if the given date is before market open
   */
  private isBeforeMarketOpen(date: Date): boolean {
    const easternDate = this.convertToEasternTime(date);
    const hours = easternDate.getHours();
    const minutes = easternDate.getMinutes();
    
    if (hours < MARKET_OPEN_HOUR) return true;
    if (hours === MARKET_OPEN_HOUR && minutes < MARKET_OPEN_MINUTE) return true;
    
    return false;
  }
  
  /**
   * Check if the given date is a market day (not a weekend)
   */
  private isMarketDay(date: Date): boolean {
    return !isWeekend(date);
  }
  
  /**
   * Convert a date to Eastern Time
   */
  private convertToEasternTime(date: Date): Date {
    // This is a simplified conversion - in a real app you'd use a proper timezone library
    return zonedTimeToUtc(date, 'America/New_York');
  }
  
  /**
   * Set the time to market open (9:30 AM Eastern)
   */
  private setToMarketOpenTime(date: Date): Date {
    const marketOpen = set(date, {
      hours: MARKET_OPEN_HOUR,
      minutes: MARKET_OPEN_MINUTE,
      seconds: 0,
      milliseconds: 0
    });
    
    this.currentDateTime = marketOpen;
    return marketOpen;
  }
  
  /**
   * Advance the date to the next weekday (Monday if currently on a weekend)
   */
  private advanceToNextWeekday(date: Date): void {
    let nextDay = new Date(date);
    
    // If it's Saturday, advance to Monday
    if (nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 2);
    } 
    // If it's Sunday, advance to Monday
    else if (nextDay.getDay() === 0) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    // Set to market open time
    nextDay = set(nextDay, {
      hours: MARKET_OPEN_HOUR,
      minutes: MARKET_OPEN_MINUTE,
      seconds: 0,
      milliseconds: 0
    });
    
    this.currentDateTime = nextDay;
  }
} 