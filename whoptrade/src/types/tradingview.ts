/**
 * TradingView Charting Library Types
 * These types represent the interfaces required for implementing a custom datafeed.
 */

export type ResolutionString = string;

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface LibrarySymbolInfo {
  name: string;
  ticker: string;
  full_name: string;
  description: string;
  type: string;
  session: string;
  exchange: string;
  listed_exchange?: string;
  timezone: string;
  format?: string;
  pricescale: number;
  minmov: number;
  minmov2?: number;
  has_intraday: boolean;
  has_daily?: boolean;
  has_weekly_and_monthly?: boolean;
  visible_plots_set?: string;
  supported_resolutions: ResolutionString[];
  data_status?: 'streaming' | 'endofday' | 'delayed_streaming' | 'pulsed';
  volume_precision?: number;
}

export interface SearchSymbolResultItem {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: string;
}

export interface DatafeedConfiguration {
  supports_search?: boolean;
  supports_group_request?: boolean;
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  supports_time?: boolean;
  exchanges?: Exchange[];
  symbols_types?: SymbolType[];
  supported_resolutions?: string[];
}

export interface Exchange {
  value: string;
  name: string;
  desc: string;
}

export interface SymbolType {
  name: string;
  value: string;
}

export type HistoryCallback = (
  bars: Bar[],
  meta: { noData?: boolean; nextTime?: number }
) => void;

export type ErrorCallback = (reason: string) => void;

export type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;

export type SubscribeBarsCallback = (bar: Bar) => void;

export interface IDatafeedChartApi {
  onReady: (callback: (configuration: DatafeedConfiguration) => void) => void;
  searchSymbols: (
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (result: SearchSymbolResultItem[]) => void
  ) => void;
  resolveSymbol: (
    symbolName: string,
    onResolve: ResolveCallback,
    onError: ErrorCallback,
    extension?: any
  ) => void;
  getBars: (
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: {
      from: number;
      to: number;
      countBack: number;
      firstDataRequest: boolean;
    },
    onResult: HistoryCallback,
    onError: ErrorCallback
  ) => void;
  subscribeBars: (
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
    onResetCacheNeededCallback: () => void
  ) => void;
  unsubscribeBars: (listenerGuid: string) => void;
  getServerTime?: (callback: (time: number) => void) => void;
}

export interface QuoteData {
  s: 'ok' | 'error';
  n: string;
  v: {
    ch?: number;
    chp?: number;
    short_name?: string;
    exchange?: string;
    original_name?: string;
    description?: string;
    lp?: number;
    ask?: number;
    bid?: number;
    spread?: number;
    open_price?: number;
    high_price?: number;
    low_price?: number;
    prev_close_price?: number;
    volume?: number;
    format?: string;
  };
}

export interface DOMData {
  asks: DOMLevel[];
  bids: DOMLevel[];
}

export interface DOMLevel {
  price: number;
  volume: number;
}

export interface Mark {
  id: string | number;
  time: number;
  color: string;
  text: string;
  label: string;
  labelFontColor: string;
  minSize: number;
}

export interface TimescaleMark {
  id: string | number;
  time: number;
  color: string;
  label: string;
  tooltip: string[];
}

// Additional interfaces for Trading Platform
export interface IDatafeedQuotesApi {
  getQuotes: (
    symbols: string[],
    onDataCallback: (data: QuoteData[]) => void,
    onErrorCallback: (reason: string) => void
  ) => void;
  subscribeQuotes: (
    symbols: string[],
    fastSymbols: string[],
    onRealtimeCallback: (data: QuoteData[]) => void,
    listenerGUID: string
  ) => void;
  unsubscribeQuotes: (listenerGUID: string) => void;
}

export interface IDatafeedChartApiWithQuotes extends IDatafeedChartApi, IDatafeedQuotesApi {}

// Widget constructor options
export interface ChartingLibraryWidgetOptions {
  symbol: string;
  interval: ResolutionString;
  container: string | HTMLElement;
  datafeed: IDatafeedChartApi | IDatafeedChartApiWithQuotes;
  library_path: string;
  locale: string;
  disabled_features?: string[];
  enabled_features?: string[];
  theme?: 'Light' | 'Dark';
  custom_css_url?: string;
  auto_save_delay?: number;
  charts_storage_url?: string;
  charts_storage_api_version?: string;
  client_id?: string;
  user_id?: string;
  fullscreen?: boolean;
  autosize?: boolean;
  studies_overrides?: Record<string, any>;
  overrides?: Record<string, any>;
  loading_screen?: { backgroundColor?: string; foregroundColor?: string };
  timezone?: string;
  time_frames?: Array<{ text: string; resolution: string; description?: string }>;
  symbol_search_request_delay?: number;
  width?: number;
  height?: number;
} 