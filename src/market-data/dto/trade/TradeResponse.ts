import { ExternalTradeResponse } from './ExternalTradeResponse';

export class TradeResponse {
  /** 거래 이벤트 유형 (e.g., "trade") */
  eventType: string;

  /** 이벤트 시간 (ms timestamp) */
  eventTime: number;

  /** 심볼 (e.g., "BTCUSDT") */
  symbol: string;

  /** 트레이드 ID */
  tradeId: number;

  /** 체결 가격 */
  price: number;

  /** 체결 수량 */
  quantity: number;

  /** 체결 시간 */
  tradeTime: number;

  /** 메이커 여부 (true이면 매도자 주도 체결) */
  isBuyerMaker: boolean;

  constructor(
    eventType: string,
    eventTime: number,
    symbol: string,
    tradeId: number,
    price: number,
    quantity: number,
    tradeTime: number,
    isBuyerMaker: boolean,
  ) {
    this.eventType = eventType;
    this.eventTime = eventTime;
    this.symbol = symbol;
    this.tradeId = tradeId;
    this.price = price;
    this.quantity = quantity;
    this.tradeTime = tradeTime;
    this.isBuyerMaker = isBuyerMaker;
  }

  static from(external: ExternalTradeResponse): TradeResponse {
    return new TradeResponse(
      external.e,
      external.E,
      external.s,
      external.t,
      parseFloat(external.p),
      parseFloat(external.q),
      external.T,
      external.m,
    );
  }
}
