/**
 * Binance REST API로부터 받은 Kline(캔들) 응답을 표현하는 DTO
 *
 * raw 배열 구조:
 * [
 *   0  openTime,
 *   1  open,
 *   2  high,
 *   3  low,
 *   4  close,
 *   5  baseVolume,
 *   6  closeTime,
 *   7  quoteVolume,
 *   8  numberOfTrades,
 *   9  takerBuyBaseVolume,
 *  10  takerBuyQuoteVolume,
 *  11  ignore
 * ]
 */
export class ExternalRestKlineResponse {
  constructor(
    public readonly openTime: number, // 0: 캔들 시작 시각 (timestamp in ms)
    public readonly open: string, // 1: 시가
    public readonly high: string, // 2: 고가
    public readonly low: string, // 3: 저가
    public readonly close: string, // 4: 종가
    public readonly baseVolume: string, // 5: 거래량 (base asset volume)
    public readonly closeTime: number, // 6: 캔들 종료 시각 (timestamp in ms)
    public readonly quoteVolume: string, // 7: 거래금액 (quote asset volume)
    public readonly numberOfTrades: number, // 8: 거래 건수
    public readonly takerBuyBaseVolume: string, // 9: 매수자 주도 거래량 (base)
    public readonly takerBuyQuoteVolume: string, // 10: 매수자 주도 거래금액 (quote)
    // 11번 인덱스는 사용하지 않음
  ) {}

  /**
   * Binance Kline REST 응답 배열 → DTO로 변환
   */
  static from(raw: any[]): ExternalRestKlineResponse {
    return new ExternalRestKlineResponse(
      raw[0],
      raw[1],
      raw[2],
      raw[3],
      raw[4],
      raw[5],
      raw[6],
      raw[7],
      raw[8],
      raw[9],
      raw[10],
    );
  }
}
