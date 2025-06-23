import { ExternalKlineResponse } from './ExternalKlineResponse';

export class KlineResponse {
  /** 거래 심볼 (e.g., "BTCUSDT") */
  symbol: string;

  /** 캔들 간격 (e.g., "1m", "5m") */
  interval: string;

  /** 캔들 시작 시간 (밀리초 timestamp) */
  openTimestamp: number;

  /** 시가 (Open price) */
  openPrice: number;

  /** 고가 (High price) */
  highPrice: number;

  /** 저가 (Low price) */
  lowPrice: number;

  /** 종가 (Close price) */
  closePrice: number;

  /** 거래량 (Base Asset Volume) */
  baseVolume: number;

  /** 거래금액 (Quote Asset Volume) */
  quoteVolume: number;

  /** 매수자 기준 거래량 (Taker Buy Base Asset Volume) */
  takerBuyBaseVolume: number;

  /** 매수자 기준 거래금액 (Taker Buy Quote Asset Volume) */
  takerBuyQuoteVolume: number;

  /**
   * 외부 Binance 응답을 내부 도메인 응답 객체로 변환
   * @param ext 외부 응답 DTO
   * @returns 내부 변환된 KlineResponse 객체
   */
  static from(ext: ExternalKlineResponse): KlineResponse {
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
}
