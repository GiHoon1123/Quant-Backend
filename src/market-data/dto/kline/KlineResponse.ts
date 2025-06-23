import { ExternalKlineResponse } from './ExternalKlineResponse';

export class KlineResponse {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;

  static from(raw: ExternalKlineResponse): KlineResponse {
    return {
      symbol: raw.symbol,
      interval: raw.interval,
      open: raw.open,
      high: raw.high,
      low: raw.low,
      close: raw.close,
      volume: raw.volume,
      timestamp: raw.openTime,
    };
  }
}
