import { ExternalFuturesOrderResponse } from '../external/ExternalFuturesOrderResponse';

/**
 * 선물 포지션 진입 결과 응답 DTO
 *
 * 외부 바이낸스 API 응답을 사용자 친화적인 형태로 변환한 응답입니다.
 * 프론트엔드에서 사용하기 쉬운 형태로 데이터를 제공합니다.
 */
export class PositionOpenResponse {
  /** 주문 ID (바이낸스에서 할당한 고유 식별자) */
  orderId: number;

  /** 거래 심볼 (예: BTCUSDT) */
  symbol: string;

  /** 포지션 방향 (LONG: 롱, SHORT: 숏) */
  side: string;

  /** 주문한 수량 */
  quantity: number;

  /** 실제 체결된 수량 */
  executedQuantity: number;

  /** 평균 체결 가격 (실제 포지션 진입 가격) */
  avgPrice: number;

  /** 총 체결 금액 (USDT 기준) */
  totalAmount: number;

  /** 주문 상태 (FILLED: 체결완료, PARTIALLY_FILLED: 부분체결 등) */
  status: string;

  /** 주문 생성/업데이트 시간 */
  timestamp: Date;

  /**
   * 외부 바이낸스 API 응답을 내부 응답 DTO로 변환
   * @param external 바이낸스 API에서 받은 외부 응답 DTO
   * @returns 변환된 PositionOpenResponse 객체
   */
  static from(external: ExternalFuturesOrderResponse): PositionOpenResponse {
    const response = new PositionOpenResponse();

    response.orderId = external.orderId;
    response.symbol = external.symbol;
    response.side = external.side;

    // 문자열을 숫자로 변환 (바이낸스는 숫자를 문자열로 반환)
    response.quantity = parseFloat(external.origQty);
    response.executedQuantity = parseFloat(external.executedQty);
    response.avgPrice = parseFloat(external.avgPrice);
    response.totalAmount = parseFloat(external.cumQuote);

    response.status = external.status;
    response.timestamp = new Date(external.updateTime);

    return response;
  }
}
