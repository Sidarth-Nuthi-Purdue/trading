/**
 * Technical Indicators Library
 * Provides functions to calculate common technical indicators for financial charts
 */

import { AlpacaBar } from './alpaca-api';

/**
 * Simple Moving Average (SMA)
 * @param data Array of price data with 'close' property
 * @param period Number of periods to average
 * @returns Array of SMA values aligned with input data
 */
export function calculateSMA(data: AlpacaBar[], period: number = 20): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(0); // Placeholder for periods with insufficient data
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].c;
      }
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Exponential Moving Average (EMA)
 * @param data Array of price data with 'close' property
 * @param period Number of periods for EMA calculation
 * @returns Array of EMA values aligned with input data
 */
export function calculateEMA(data: AlpacaBar[], period: number = 20): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA value is SMA
  let ema = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    ema += data[i].c;
  }
  ema /= Math.min(period, data.length);
  
  result.push(ema);
  
  // Calculate remaining EMA values
  for (let i = 1; i < data.length; i++) {
    ema = (data[i].c - ema) * multiplier + ema;
    result.push(ema);
  }
  
  return result;
}

/**
 * Bollinger Bands
 * @param data Array of price data with 'close' property
 * @param period Period for SMA calculation
 * @param stdDev Number of standard deviations for bands (usually 2)
 * @returns Object with arrays for upper, middle (SMA), and lower bands
 */
export function calculateBollingerBands(
  data: AlpacaBar[], 
  period: number = 20, 
  stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(data[i].c);
      lower.push(data[i].c);
    } else {
      // Calculate standard deviation
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += Math.pow(data[i - j].c - middle[i], 2);
      }
      const stdev = Math.sqrt(sum / period);
      
      // Calculate upper and lower bands
      upper.push(middle[i] + (stdev * stdDev));
      lower.push(middle[i] - (stdev * stdDev));
    }
  }
  
  return { upper, middle, lower };
}

/**
 * Relative Strength Index (RSI)
 * @param data Array of price data with 'close' property
 * @param period Number of periods for RSI calculation (usually 14)
 * @returns Array of RSI values (0-100) aligned with input data
 */
export function calculateRSI(data: AlpacaBar[], period: number = 14): number[] {
  const result: number[] = [];
  
  if (data.length <= period) {
    // Not enough data
    return Array(data.length).fill(50);
  }
  
  // Calculate initial gains and losses
  let sumGain = 0;
  let sumLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = data[i].c - data[i - 1].c;
    
    if (change >= 0) {
      sumGain += change;
    } else {
      sumLoss += Math.abs(change);
    }
  }
  
  // Calculate initial average gain and loss
  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;
  
  // Fill initial values
  for (let i = 0; i < period; i++) {
    result.push(50); // Default value for early periods
  }
  
  // Calculate first true RSI
  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
  let rsi = 100 - (100 / (1 + rs));
  result.push(rsi);
  
  // Calculate RSI for remaining periods
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].c - data[i - 1].c;
    
    let currentGain = 0;
    let currentLoss = 0;
    
    if (change >= 0) {
      currentGain = change;
    } else {
      currentLoss = Math.abs(change);
    }
    
    // Use Wilder's smoothing method
    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
    
    rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    rsi = 100 - (100 / (1 + rs));
    
    result.push(rsi);
  }
  
  return result;
}

/**
 * Moving Average Convergence Divergence (MACD)
 * @param data Array of price data with 'close' property
 * @param fastPeriod Period for fast EMA (usually 12)
 * @param slowPeriod Period for slow EMA (usually 26)
 * @param signalPeriod Period for signal line EMA (usually 9)
 * @returns Object with arrays for MACD line, signal line, and histogram values
 */
export function calculateMACD(
  data: AlpacaBar[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  // Use calculateEMA for full dataset to ensure proper alignment
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: number[] = [];
  for (let i = 0; i < data.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  
  // Create a copy of data just for the MACD values to calculate signal
  const macdData = macdLine.map((value, index) => ({
    t: data[index].t,
    o: value,
    h: value,
    l: value,
    c: value,
    v: 0
  }));
  
  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdData, signalPeriod);
  
  // Calculate histogram (MACD line - signal line)
  const histogram: number[] = [];
  for (let i = 0; i < data.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
} 