/**
 * Technical Indicators Library
 * Provides functions to calculate common technical indicators for financial charts
 */

import { AlpacaBar } from './alpaca-api';

interface OHLCData {
  timestamp: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Simple Moving Average (SMA)
 * @param data Array of price data
 * @param period Number of periods to average
 * @param key Data field to use for calculation (default: 'close')
 * @returns Array of SMA values aligned with input data (first period-1 values are undefined)
 */
export function calculateSMA(
  data: OHLCData[] | AlpacaBar[],
  period: number = 20,
  key: 'open' | 'high' | 'low' | 'close' = 'close'
): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  
  // Handle data format differences between OHLCData and AlpacaBar
  const getPriceValue = (item: OHLCData | AlpacaBar, k: 'open' | 'high' | 'low' | 'close'): number => {
    if ('t' in item) { // AlpacaBar format
      return item[k === 'open' ? 'o' : k === 'high' ? 'h' : k === 'low' ? 'l' : 'c'];
    }
    return item[k];
  };
  
  // Initial entries have no SMA value
  for (let i = 0; i < period - 1; i++) {
    result.push(undefined);
  }
  
  // Calculate SMA for each period
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += getPriceValue(data[i - j], key);
    }
    result.push(sum / period);
  }
  
  return result;
}

/**
 * Exponential Moving Average (EMA)
 * @param data Array of price data
 * @param period Number of periods for EMA calculation
 * @param key Data field to use for calculation (default: 'close')
 * @returns Array of EMA values aligned with input data (first period-1 values are undefined)
 */
export function calculateEMA(
  data: OHLCData[] | AlpacaBar[],
  period: number = 20,
  key: 'open' | 'high' | 'low' | 'close' = 'close'
): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  
  // Handle data format differences
  const getPriceValue = (item: OHLCData | AlpacaBar, k: 'open' | 'high' | 'low' | 'close'): number => {
    if ('t' in item) { // AlpacaBar format
      return item[k === 'open' ? 'o' : k === 'high' ? 'h' : k === 'low' ? 'l' : 'c'];
    }
    return item[k];
  };
  
  // Smoothing factor
  const multiplier = 2 / (period + 1);
  
  // Initial entries have no EMA value
  for (let i = 0; i < period - 1; i++) {
    result.push(undefined);
  }
  
  // First EMA value is SMA
  let ema = 0;
  for (let i = 0; i < period; i++) {
    ema += getPriceValue(data[i], key);
  }
  ema /= period;
  result.push(ema);
  
  // Calculate remaining EMA values
  for (let i = period; i < data.length; i++) {
    const currentPrice = getPriceValue(data[i], key);
    ema = (currentPrice - ema) * multiplier + ema;
    result.push(ema);
  }
  
  return result;
}

/**
 * Bollinger Bands
 * @param data Array of price data
 * @param period Period for SMA calculation
 * @param stdDev Number of standard deviations for bands (usually 2)
 * @param key Data field to use for calculation (default: 'close')
 * @returns Object with arrays for upper, middle (SMA), and lower bands
 */
export function calculateBollingerBands(
  data: OHLCData[] | AlpacaBar[],
  period: number = 20,
  stdDev: number = 2,
  key: 'open' | 'high' | 'low' | 'close' = 'close'
): { upper: (number | undefined)[]; middle: (number | undefined)[]; lower: (number | undefined)[] } {
  const middle = calculateSMA(data, period, key);
  const upper: (number | undefined)[] = [];
  const lower: (number | undefined)[] = [];
  
  // Handle data format differences
  const getPriceValue = (item: OHLCData | AlpacaBar, k: 'open' | 'high' | 'low' | 'close'): number => {
    if ('t' in item) { // AlpacaBar format
      return item[k === 'open' ? 'o' : k === 'high' ? 'h' : k === 'low' ? 'l' : 'c'];
    }
    return item[k];
  };
  
  // Initial entries have no Bollinger Band values
  for (let i = 0; i < period - 1; i++) {
    upper.push(undefined);
    lower.push(undefined);
  }
  
  // Calculate bands for each period
  for (let i = period - 1; i < data.length; i++) {
    // Calculate standard deviation
    let sum = 0;
    for (let j = 0; j < period; j++) {
      const price = getPriceValue(data[i - j], key);
      const middleValue = middle[i] as number;
      sum += Math.pow(price - middleValue, 2);
    }
    const stdev = Math.sqrt(sum / period);
    
    // Calculate upper and lower bands
    upper.push((middle[i] as number) + (stdev * stdDev));
    lower.push((middle[i] as number) - (stdev * stdDev));
  }
  
  return { upper, middle, lower };
}

/**
 * Relative Strength Index (RSI)
 * @param data Array of price data
 * @param period Number of periods for RSI calculation (usually 14)
 * @param key Data field to use for calculation (default: 'close')
 * @returns Array of RSI values (0-100) aligned with input data
 */
export function calculateRSI(
  data: OHLCData[] | AlpacaBar[],
  period: number = 14,
  key: 'open' | 'high' | 'low' | 'close' = 'close'
): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  
  // Handle data format differences
  const getPriceValue = (item: OHLCData | AlpacaBar, k: 'open' | 'high' | 'low' | 'close'): number => {
    if ('t' in item) { // AlpacaBar format
      return item[k === 'open' ? 'o' : k === 'high' ? 'h' : k === 'low' ? 'l' : 'c'];
    }
    return item[k];
  };
  
  // Need at least period+1 data points to calculate RSI
  if (data.length <= period) {
    return Array(data.length).fill(undefined);
  }
  
  // First values have no RSI
  for (let i = 0; i < period; i++) {
    result.push(undefined);
  }
  
  // Calculate initial gains and losses
  let sumGain = 0;
  let sumLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    const current = getPriceValue(data[i], key);
    const previous = getPriceValue(data[i - 1], key);
    const change = current - previous;
    
    if (change >= 0) {
      sumGain += change;
    } else {
      sumLoss += Math.abs(change);
    }
  }
  
  // Calculate initial average gain and loss
  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;
  
  // Calculate RSI for the first period
  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
  let rsi = 100 - (100 / (1 + rs));
  result.push(rsi);
  
  // Calculate RSI for remaining periods using smoothing
  for (let i = period + 1; i < data.length; i++) {
    const current = getPriceValue(data[i], key);
    const previous = getPriceValue(data[i - 1], key);
    const change = current - previous;
    
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
 * @param data Array of price data
 * @param fastPeriod Period for fast EMA (usually 12)
 * @param slowPeriod Period for slow EMA (usually 26)
 * @param signalPeriod Period for signal line EMA (usually 9)
 * @param key Data field to use for calculation (default: 'close')
 * @returns Object with arrays for MACD line, signal line, and histogram values
 */
export function calculateMACD(
  data: OHLCData[] | AlpacaBar[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
  key: 'open' | 'high' | 'low' | 'close' = 'close'
): { 
  macd: (number | undefined)[]; 
  signal: (number | undefined)[]; 
  histogram: (number | undefined)[]
} {
  const fastEMA = calculateEMA(data, fastPeriod, key);
  const slowEMA = calculateEMA(data, slowPeriod, key);
  
  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === undefined || slowEMA[i] === undefined) {
      macdLine.push(undefined);
    } else {
      macdLine.push((fastEMA[i] as number) - (slowEMA[i] as number));
    }
  }
  
  // Calculate signal line (EMA of MACD line)
  const signalLine: (number | undefined)[] = [];
  let macdValues: number[] = [];
  
  // Gather valid MACD values for EMA calculation
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== undefined) {
      macdValues.push(macdLine[i] as number);
    }
  }
  
  // Need at least signalPeriod values to calculate signal line
  if (macdValues.length < signalPeriod) {
    return {
      macd: macdLine,
      signal: Array(data.length).fill(undefined),
      histogram: Array(data.length).fill(undefined)
    };
  }
  
  // Calculate signal line as EMA of MACD values
  let signalEma = macdValues.slice(0, signalPeriod).reduce((sum, val) => sum + val, 0) / signalPeriod;
  const multiplier = 2 / (signalPeriod + 1);
  
  // Fill initial undefined values
  for (let i = 0; i < slowPeriod - 1 + signalPeriod; i++) {
    signalLine.push(undefined);
  }
  
  // First signal value
  signalLine.push(signalEma);
  
  // Calculate remaining signal values
  for (let i = slowPeriod - 1 + signalPeriod; i < macdLine.length - 1; i++) {
    if (macdLine[i + 1] !== undefined) {
      signalEma = ((macdLine[i + 1] as number) - signalEma) * multiplier + signalEma;
      signalLine.push(signalEma);
    } else {
      signalLine.push(undefined);
    }
  }
  
  // Calculate histogram (MACD line - signal line)
  const histogram: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === undefined || signalLine[i] === undefined) {
      histogram.push(undefined);
    } else {
      histogram.push((macdLine[i] as number) - (signalLine[i] as number));
    }
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Stochastic Oscillator
 * @param data Array of price data
 * @param kPeriod Period for %K line (usually 14)
 * @param dPeriod Period for %D line (usually 3)
 * @returns Object with arrays for %K and %D values
 */
export function calculateStochastic(
  data: OHLCData[] | AlpacaBar[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: (number | undefined)[]; d: (number | undefined)[] } {
  const kValues: (number | undefined)[] = [];
  const dValues: (number | undefined)[] = [];
  
  // Handle data format differences
  const getHighValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.h;
    return item.high;
  };
  
  const getLowValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.l;
    return item.low;
  };
  
  const getCloseValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.c;
    return item.close;
  };
  
  // Need at least kPeriod data points
  if (data.length < kPeriod) {
    return {
      k: Array(data.length).fill(undefined),
      d: Array(data.length).fill(undefined)
    };
  }
  
  // Fill initial values with undefined
  for (let i = 0; i < kPeriod - 1; i++) {
    kValues.push(undefined);
    dValues.push(undefined);
  }
  
  // Calculate %K values
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    // Find highest high and lowest low in the lookback period
    for (let j = 0; j < kPeriod; j++) {
      const high = getHighValue(data[i - j]);
      const low = getLowValue(data[i - j]);
      
      highestHigh = Math.max(highestHigh, high);
      lowestLow = Math.min(lowestLow, low);
    }
    
    // Calculate %K: (Current Close - Lowest Low) / (Highest High - Lowest Low) * 100
    const close = getCloseValue(data[i]);
    const range = highestHigh - lowestLow;
    
    if (range === 0) {
      kValues.push(100); // If there's no range, %K = 100
    } else {
      const k = ((close - lowestLow) / range) * 100;
      kValues.push(k);
    }
  }
  
  // Fill initial values for %D with undefined
  for (let i = 0; i < kPeriod - 1 + dPeriod - 1; i++) {
    dValues.push(undefined);
  }
  
  // Calculate %D values (simple moving average of %K)
  for (let i = kPeriod - 1 + dPeriod - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += kValues[i - j] as number;
    }
    dValues.push(sum / dPeriod);
  }
  
  return { k: kValues, d: dValues };
}

/**
 * Average True Range (ATR)
 * @param data Array of price data
 * @param period Period for ATR calculation (usually 14)
 * @returns Array of ATR values
 */
export function calculateATR(
  data: OHLCData[] | AlpacaBar[],
  period: number = 14
): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  
  // Handle data format differences
  const getHighValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.h;
    return item.high;
  };
  
  const getLowValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.l;
    return item.low;
  };
  
  const getCloseValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.c;
    return item.close;
  };
  
  // Need at least period+1 data points
  if (data.length <= period) {
    return Array(data.length).fill(undefined);
  }
  
  // Calculate true range values
  const trueRanges: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const high = getHighValue(data[i]);
    const low = getLowValue(data[i]);
    const prevClose = getCloseValue(data[i - 1]);
    
    // True Range is the greatest of:
    // 1. Current High - Current Low
    // 2. |Current High - Previous Close|
    // 3. |Current Low - Previous Close|
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  // First values are undefined
  for (let i = 0; i < period; i++) {
    result.push(undefined);
  }
  
  // First ATR is simple average of first 'period' true ranges
  let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
  result.push(atr);
  
  // Calculate remaining ATR values using smoothing
  for (let i = period; i < trueRanges.length; i++) {
    // Wilder's smoothing method: ATR = ((period-1) * previousATR + currentTR) / period
    atr = ((period - 1) * atr + trueRanges[i]) / period;
    result.push(atr);
  }
  
  return result;
}

/**
 * Ichimoku Cloud
 * @param data Array of price data
 * @param tenkanPeriod Period for Tenkan-sen (usually 9)
 * @param kijunPeriod Period for Kijun-sen (usually 26)
 * @param senkouSpanBPeriod Period for Senkou Span B (usually 52)
 * @param displacement Displacement period (usually 26)
 * @returns Object with arrays for Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span
 */
export function calculateIchimoku(
  data: OHLCData[] | AlpacaBar[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouSpanBPeriod: number = 52,
  displacement: number = 26
): {
  tenkanSen: (number | undefined)[];
  kijunSen: (number | undefined)[];
  senkouSpanA: (number | undefined)[];
  senkouSpanB: (number | undefined)[];
  chikouSpan: (number | undefined)[];
} {
  const tenkanSen: (number | undefined)[] = [];
  const kijunSen: (number | undefined)[] = [];
  const senkouSpanA: (number | undefined)[] = [];
  const senkouSpanB: (number | undefined)[] = [];
  const chikouSpan: (number | undefined)[] = [];
  
  // Handle data format differences
  const getHighValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.h;
    return item.high;
  };
  
  const getLowValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.l;
    return item.low;
  };
  
  const getCloseValue = (item: OHLCData | AlpacaBar): number => {
    if ('t' in item) return item.c;
    return item.close;
  };
  
  // Calculate Tenkan-sen (Conversion Line)
  for (let i = 0; i < data.length; i++) {
    if (i < tenkanPeriod - 1) {
      tenkanSen.push(undefined);
    } else {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      
      for (let j = 0; j < tenkanPeriod; j++) {
        const high = getHighValue(data[i - j]);
        const low = getLowValue(data[i - j]);
        
        highestHigh = Math.max(highestHigh, high);
        lowestLow = Math.min(lowestLow, low);
      }
      
      tenkanSen.push((highestHigh + lowestLow) / 2);
    }
  }
  
  // Calculate Kijun-sen (Base Line)
  for (let i = 0; i < data.length; i++) {
    if (i < kijunPeriod - 1) {
      kijunSen.push(undefined);
    } else {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      
      for (let j = 0; j < kijunPeriod; j++) {
        const high = getHighValue(data[i - j]);
        const low = getLowValue(data[i - j]);
        
        highestHigh = Math.max(highestHigh, high);
        lowestLow = Math.min(lowestLow, low);
      }
      
      kijunSen.push((highestHigh + lowestLow) / 2);
    }
  }
  
  // Calculate Senkou Span A (Leading Span A)
  for (let i = 0; i < data.length; i++) {
    if (i < Math.max(tenkanPeriod, kijunPeriod) - 1) {
      senkouSpanA.push(undefined);
    } else {
      const tenkan = tenkanSen[i] as number;
      const kijun = kijunSen[i] as number;
      
      // Project forward by displacement periods
      const spanA = (tenkan + kijun) / 2;
      
      // If we're calculating for a position that would be projected into the future beyond our data,
      // just append to the current array
      senkouSpanA.push(spanA);
    }
  }
  
  // Calculate Senkou Span B (Leading Span B)
  for (let i = 0; i < data.length; i++) {
    if (i < senkouSpanBPeriod - 1) {
      senkouSpanB.push(undefined);
    } else {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      
      for (let j = 0; j < senkouSpanBPeriod; j++) {
        const high = getHighValue(data[i - j]);
        const low = getLowValue(data[i - j]);
        
        highestHigh = Math.max(highestHigh, high);
        lowestLow = Math.min(lowestLow, low);
      }
      
      // Project forward by displacement periods
      const spanB = (highestHigh + lowestLow) / 2;
      
      // If we're calculating for a position that would be projected into the future beyond our data,
      // just append to the current array
      senkouSpanB.push(spanB);
    }
  }
  
  // Calculate Chikou Span (Lagging Span)
  for (let i = 0; i < data.length; i++) {
    if (i < displacement) {
      // Not enough data to calculate yet
      chikouSpan.push(undefined);
    } else {
      // Current close shifted back by displacement periods
      chikouSpan.push(getCloseValue(data[i - displacement]));
    }
  }
  
  // Adjust for displacement in visualization
  // Note: This is typically handled by the charting library, not the calculation
  
  return {
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    chikouSpan
  };
}

/**
 * Calculates various technical indicators for a given dataset
 * @param data Array of OHLC data
 * @param indicators Object specifying which indicators to calculate and their parameters
 * @returns Object with calculated indicator values
 */
export function calculateIndicators(
  data: OHLCData[] | AlpacaBar[],
  indicators: {
    sma?: { periods: number[] };
    ema?: { periods: number[] };
    bollinger?: { period: number; stdDev: number };
    rsi?: { period: number };
    macd?: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
    stochastic?: { kPeriod: number; dPeriod: number };
    atr?: { period: number };
    ichimoku?: { tenkanPeriod: number; kijunPeriod: number; senkouSpanBPeriod: number; displacement: number };
  }
) {
  const results: Record<string, any> = {};
  
  if (indicators.sma) {
    results.sma = {};
    for (const period of indicators.sma.periods) {
      results.sma[period] = calculateSMA(data, period);
    }
  }
  
  if (indicators.ema) {
    results.ema = {};
    for (const period of indicators.ema.periods) {
      results.ema[period] = calculateEMA(data, period);
    }
  }
  
  if (indicators.bollinger) {
    results.bollinger = calculateBollingerBands(
      data, 
      indicators.bollinger.period, 
      indicators.bollinger.stdDev
    );
  }
  
  if (indicators.rsi) {
    results.rsi = calculateRSI(data, indicators.rsi.period);
  }
  
  if (indicators.macd) {
    results.macd = calculateMACD(
      data,
      indicators.macd.fastPeriod,
      indicators.macd.slowPeriod,
      indicators.macd.signalPeriod
    );
  }
  
  if (indicators.stochastic) {
    results.stochastic = calculateStochastic(
      data,
      indicators.stochastic.kPeriod,
      indicators.stochastic.dPeriod
    );
  }
  
  if (indicators.atr) {
    results.atr = calculateATR(data, indicators.atr.period);
  }
  
  if (indicators.ichimoku) {
    results.ichimoku = calculateIchimoku(
      data,
      indicators.ichimoku.tenkanPeriod,
      indicators.ichimoku.kijunPeriod,
      indicators.ichimoku.senkouSpanBPeriod,
      indicators.ichimoku.displacement
    );
  }
  
  return results;
} 