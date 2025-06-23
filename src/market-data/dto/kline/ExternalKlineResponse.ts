export class ExternalKlineResponse {
  /** 심볼 (e.g., "BTCUSDT") */
  s: string;

  /** 캔들 정보 */
  k: {
    /** 시작 시간 (timestamp, open time) */
    t: number;

    /** 캔들 간격 (e.g., "1m", "5m") */
    i: string;

    /** 시가 */
    o: string;

    /** 고가 */
    h: string;

    /** 저가 */
    l: string;

    /** 종가 */
    c: string;

    /** 거래량 (base asset volume) */
    v: string;

    /** 종료 시간 */
    T: number;

    /** 거래 금액 (quote asset volume) */
    q: string;

    /** 매수자 거래량 (taker buy base asset volume) */
    V: string;

    /** 매수자 거래 금액 (taker buy quote asset volume) */
    Q: string;
  };

  private constructor(s: string, k: ExternalKlineResponse['k']) {
    this.s = s;
    this.k = k;
  }

  /**
   * Binance WebSocket 응답을 ExternalKlineResponse로 변환
   */
  static from(raw: any): ExternalKlineResponse {
    return new ExternalKlineResponse(raw.s, raw.k);
  }
}
