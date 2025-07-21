/**
 * 거래 실행 이벤트
 *
 * 현물 또는 선물 거래가 실행되었을 때 발행되는 이벤트입니다.
 * 이 이벤트를 통해 거래 내역 저장과 온체인 트랜잭션 파싱이 트리거됩니다.
 */

export interface BaseTradeExecutedEvent {
  // 이벤트 메타데이터
  eventId: string;
  eventType: 'TRADE_EXECUTED';
  timestamp: Date;

  // 거래 기본 정보
  symbol: string; // BTCUSDT, ETHUSDT 등
  orderId: string; // 바이낸스 주문 ID
  clientOrderId?: string; // 클라이언트 주문 ID
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';

  // 거래 수량 및 가격
  quantity: number; // 거래 수량
  price: number; // 체결 가격
  totalAmount: number; // 총 거래 금액

  // 수수료 정보
  fee: number; // 수수료
  feeAsset: string; // 수수료 자산
  feeRate?: number; // 수수료율

  // 거래 상태
  status: string; // FILLED, PARTIALLY_FILLED 등
  executedAt: Date; // 체결 시간

  // 추가 정보
  source: string; // API, AUTO, MANUAL
  strategyId?: string; // 자동매매 전략 ID
  metadata?: any; // 추가 메타데이터
}

/**
 * 현물 거래 실행 이벤트
 */
export interface SpotTradeExecutedEvent extends BaseTradeExecutedEvent {
  tradeType: 'SPOT';

  // 현물 거래 특화 정보 (필요시 추가)
  // 현재는 기본 필드들로 충분
}

/**
 * 선물 거래 실행 이벤트
 */
export interface FuturesTradeExecutedEvent extends BaseTradeExecutedEvent {
  tradeType: 'FUTURES';

  // 선물 거래 특화 정보
  leverage: number; // 레버리지 배수
  marginType: 'ISOLATED' | 'CROSS'; // 마진 타입
  initialMargin: number; // 초기 마진
  maintenanceMargin?: number; // 유지 마진
  positionSide: 'LONG' | 'SHORT'; // 포지션 방향
  liquidationPrice?: number; // 청산 가격
  markPrice?: number; // 마크 가격
  marginRatio?: number; // 마진 비율
}

/**
 * 통합 거래 실행 이벤트 타입
 */
export type TradeExecutedEvent =
  | SpotTradeExecutedEvent
  | FuturesTradeExecutedEvent;

/**
 * 이벤트 생성 헬퍼 함수들
 */
export class TradeExecutedEventFactory {
  /**
   * 현물 거래 이벤트 생성
   */
  static createSpotTradeEvent(
    data: Omit<
      SpotTradeExecutedEvent,
      'eventId' | 'eventType' | 'timestamp' | 'tradeType'
    >,
  ): SpotTradeExecutedEvent {
    return {
      ...data,
      eventId: this.generateEventId(),
      eventType: 'TRADE_EXECUTED',
      timestamp: new Date(),
      tradeType: 'SPOT',
    };
  }

  /**
   * 선물 거래 이벤트 생성
   */
  static createFuturesTradeEvent(
    data: Omit<
      FuturesTradeExecutedEvent,
      'eventId' | 'eventType' | 'timestamp' | 'tradeType'
    >,
  ): FuturesTradeExecutedEvent {
    return {
      ...data,
      eventId: this.generateEventId(),
      eventType: 'TRADE_EXECUTED',
      timestamp: new Date(),
      tradeType: 'FUTURES',
    };
  }

  /**
   * 이벤트 ID 생성
   */
  private static generateEventId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * 이벤트 유틸리티 함수들
 */
export class TradeEventUtils {
  /**
   * 심볼에서 코인 추출
   */
  static extractCoinFromSymbol(symbol: string): string {
    return symbol.replace('USDT', '').replace('BUSD', '').replace('BTC', '');
  }

  /**
   * 현물 거래 이벤트인지 확인
   */
  static isSpotTradeEvent(
    event: TradeExecutedEvent,
  ): event is SpotTradeExecutedEvent {
    return event.tradeType === 'SPOT';
  }

  /**
   * 선물 거래 이벤트인지 확인
   */
  static isFuturesTradeEvent(
    event: TradeExecutedEvent,
  ): event is FuturesTradeExecutedEvent {
    return event.tradeType === 'FUTURES';
  }

  /**
   * 매수 이벤트인지 확인
   */
  static isBuyEvent(event: TradeExecutedEvent): boolean {
    return event.side === 'BUY';
  }

  /**
   * 매도 이벤트인지 확인
   */
  static isSellEvent(event: TradeExecutedEvent): boolean {
    return event.side === 'SELL';
  }

  /**
   * 비트코인 관련 이벤트인지 확인
   */
  static isBitcoinEvent(event: TradeExecutedEvent): boolean {
    return event.symbol.startsWith('BTC');
  }

  /**
   * 이더리움 관련 이벤트인지 확인
   */
  static isEthereumEvent(event: TradeExecutedEvent): boolean {
    return event.symbol.startsWith('ETH');
  }
}
