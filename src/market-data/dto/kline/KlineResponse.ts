import { ExternalKlineResponse } from './ExternalKlineResponse';
import { ExternalRestKlineResponse } from './ExternalRestKlineResponse';

export class KlineResponse {
  symbol: string;
  interval: string;
  openTimestamp: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  baseVolume: number;
  quoteVolume: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;

  /**
   * ✅ WebSocket용 변환
   */
  static fromWebSocket(ext: ExternalKlineResponse): KlineResponse {
    const k = ext.k;
    return {
      symbol: ext.s,
      interval: k.i,
      openTimestamp: k.t,
      openPrice: parseFloat(k.o),
      highPrice: parseFloat(k.h),
      lowPrice: parseFloat(k.l),
      closePrice: parseFloat(k.c),
      baseVolume: parseFloat(k.v),
      quoteVolume: parseFloat(k.q),
      takerBuyBaseVolume: parseFloat(k.V),
      takerBuyQuoteVolume: parseFloat(k.Q),
    };
  }

  /**
   * ✅ REST용 변환
   */
  static fromRest(
    symbol: string,
    interval: string,
    ext: ExternalRestKlineResponse,
  ): KlineResponse {
    return {
      symbol,
      interval,
      openTimestamp: ext.openTime,
      openPrice: parseFloat(ext.open),
      highPrice: parseFloat(ext.high),
      lowPrice: parseFloat(ext.low),
      closePrice: parseFloat(ext.close),
      baseVolume: parseFloat(ext.baseVolume),
      quoteVolume: parseFloat(ext.quoteVolume),
      takerBuyBaseVolume: parseFloat(ext.takerBuyBaseVolume),
      takerBuyQuoteVolume: parseFloat(ext.takerBuyQuoteVolume),
    };
  }
}
