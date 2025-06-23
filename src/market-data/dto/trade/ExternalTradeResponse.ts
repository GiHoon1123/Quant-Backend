export class ExternalTradeResponse {
  /** 이벤트 타입 (e.g., "trade") */
  e: string;

  /** 이벤트 발생 시간 (ms timestamp) */
  E: number;

  /** 심볼 (e.g., "BTCUSDT") */
  s: string;

  /** 트레이드 ID */
  t: number;

  /** 체결 가격 */
  p: string;

  /** 체결 수량 */
  q: string;

  /** 체결 시간 */
  T: number;

  /** 메이커 여부 */
  m: boolean;

  private constructor(
    e: string,
    E: number,
    s: string,
    t: number,
    p: string,
    q: string,
    T: number,
    m: boolean,
  ) {
    this.e = e;
    this.E = E;
    this.s = s;
    this.t = t;
    this.p = p;
    this.q = q;
    this.T = T;
    this.m = m;
  }

  /**
   * 외부 Binance 응답 객체를 DTO로 변환
   */
  static from(raw: any): ExternalTradeResponse {
    return new ExternalTradeResponse(
      raw.e,
      raw.E,
      raw.s,
      raw.t,
      raw.p,
      raw.q,
      raw.T,
      raw.m,
    );
  }
}
