/**
 * 바이낸스 선물 포지션 진입 API 응답 DTO
 *
 * 바이낸스 /fapi/v1/order 엔드포인트에서 반환하는 응답 구조를 정의합니다.
 * 실제 포지션 진입 후 바이낸스에서 제공하는 모든 정보가 포함됩니다.
 */
export class ExternalFuturesOrderResponse {
  /** 주문 ID (바이낸스에서 할당하는 고유 식별자) */
  orderId: number;

  /** 거래 심볼 (예: BTCUSDT) */
  symbol: string;

  /** 주문 상태 (NEW, PARTIALLY_FILLED, FILLED, CANCELED, REJECTED 등) */
  status: string;

  /** 클라이언트가 지정한 주문 ID (선택사항) */
  clientOrderId: string;

  /** 주문 가격 (시장가의 경우 "0.00000000") */
  price: string;

  /** 평균 체결 가격 (실제 체결된 평균 가격) */
  avgPrice: string;

  /** 원래 주문 수량 */
  origQty: string;

  /** 체결된 수량 */
  executedQty: string;

  /** 누적 체결 금액 (USDT 기준) */
  cumQuote: string;

  /** 시간 효력 (GTC, IOC, FOK 등) */
  timeInForce: string;

  /** 주문 타입 (MARKET, LIMIT, STOP 등) */
  type: string;

  /** 포지션 사이드 (LONG 또는 SHORT) */
  side: string;

  /** Reduce Only 여부 (포지션 감소만 가능한지) */
  reduceOnly: boolean;

  /** 포지션 사이드 (BOTH, LONG, SHORT) */
  positionSide: string;

  /** 스톱 가격 (스톱 주문의 경우) */
  stopPrice: string;

  /** 작업 시간 효력 (스톱 주문의 경우) */
  workingType: string;

  /** 가격 보호 여부 */
  priceProtect: boolean;

  /** 주문 타입 (MARKET, LIMIT 등) */
  origType: string;

  /** 주문 생성 시간 (Unix timestamp) */
  updateTime: number;

  /**
   * 바이낸스 API 원시 응답을 이 DTO로 변환하는 정적 메서드
   * @param raw 바이낸스 API에서 받은 원시 응답 데이터
   * @returns 변환된 ExternalFuturesOrderResponse 객체
   */
  static from(raw: any): ExternalFuturesOrderResponse {
    const response = new ExternalFuturesOrderResponse();
    response.orderId = raw.orderId;
    response.symbol = raw.symbol;
    response.status = raw.status;
    response.clientOrderId = raw.clientOrderId;
    response.price = raw.price;
    response.avgPrice = raw.avgPrice;
    response.origQty = raw.origQty;
    response.executedQty = raw.executedQty;
    response.cumQuote = raw.cumQuote;
    response.timeInForce = raw.timeInForce;
    response.type = raw.type;
    response.side = raw.side;
    response.reduceOnly = raw.reduceOnly;
    response.positionSide = raw.positionSide;
    response.stopPrice = raw.stopPrice;
    response.workingType = raw.workingType;
    response.priceProtect = raw.priceProtect;
    response.origType = raw.origType;
    response.updateTime = raw.updateTime;
    return response;
  }
}
