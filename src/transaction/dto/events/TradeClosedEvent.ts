/**
 * 거래 종료 이벤트
 *
 * 선물 포지션이 종료되었을 때 발행되는 이벤트입니다.
 * 포지션 종료 정보를 업데이트하고 최종 손익을 기록합니다.
 */

export interface TradeClosedEvent {
  // 이벤트 메타데이터
  eventId: string;
  eventType: 'TRADE_CLOSED';
  timestamp: Date;

  // 기본 정보
  symbol: string; // BTCUSDT 등
  originalOrderId: string; // 원래 진입 주문 ID
  closeOrderId: string; // 종료 주문 ID

  // 종료 정보
  closeType: 'TP' | 'SL' | 'MANUAL' | 'LIQUIDATION'; // 종료 유형
  closePrice: number; // 종료 가격
  closeQuantity: number; // 종료 수량
  closedAt: Date; // 종료 시간

  // 손익 정보
  pnl: number; // 실현 손익 (USDT)
  pnlPercent: number; // 손익률 (%)
  roe: number; // ROE (Return on Equity) %

  // 거래 성과
  entryPrice: number; // 진입 가격
  holdingDuration: number; // 보유 시간 (초)
  maxDrawdown?: number; // 최대 손실
  maxProfit?: number; // 최대 수익

  // 추가 정보
  source: string; // 종료 소스 (API, AUTO, MANUAL)
  strategyId?: string; // 자동매매 전략 ID
  metadata?: any; // 추가 메타데이터
}

/**
 * 거래 종료 이벤트 생성 헬퍼
 */
export class TradeClosedEventFactory {
  /**
   * 거래 종료 이벤트 생성
   */
  static createTradeClosedEvent(
    data: Omit<TradeClosedEvent, 'eventId' | 'eventType' | 'timestamp'>,
  ): TradeClosedEvent {
    return {
      ...data,
      eventId: this.generateEventId(),
      eventType: 'TRADE_CLOSED',
      timestamp: new Date(),
    };
  }

  /**
   * 수동 종료 이벤트 생성
   */
  static createManualCloseEvent(
    symbol: string,
    originalOrderId: string,
    closeOrderId: string,
    closePrice: number,
    closeQuantity: number,
    pnl: number,
    pnlPercent: number,
    roe: number,
    entryPrice: number,
    holdingDuration: number,
    source: string = 'MANUAL',
    strategyId?: string,
    metadata?: any,
  ): TradeClosedEvent {
    return this.createTradeClosedEvent({
      symbol,
      originalOrderId,
      closeOrderId,
      closeType: 'MANUAL',
      closePrice,
      closeQuantity,
      closedAt: new Date(),
      pnl,
      pnlPercent,
      roe,
      entryPrice,
      holdingDuration,
      source,
      strategyId,
      metadata,
    });
  }

  /**
   * 익절 이벤트 생성
   */
  static createTakeProfitEvent(
    symbol: string,
    originalOrderId: string,
    closeOrderId: string,
    closePrice: number,
    closeQuantity: number,
    pnl: number,
    pnlPercent: number,
    roe: number,
    entryPrice: number,
    holdingDuration: number,
    source: string = 'AUTO',
    strategyId?: string,
    metadata?: any,
  ): TradeClosedEvent {
    return this.createTradeClosedEvent({
      symbol,
      originalOrderId,
      closeOrderId,
      closeType: 'TP',
      closePrice,
      closeQuantity,
      closedAt: new Date(),
      pnl,
      pnlPercent,
      roe,
      entryPrice,
      holdingDuration,
      source,
      strategyId,
      metadata,
    });
  }

  /**
   * 손절 이벤트 생성
   */
  static createStopLossEvent(
    symbol: string,
    originalOrderId: string,
    closeOrderId: string,
    closePrice: number,
    closeQuantity: number,
    pnl: number,
    pnlPercent: number,
    roe: number,
    entryPrice: number,
    holdingDuration: number,
    source: string = 'AUTO',
    strategyId?: string,
    metadata?: any,
  ): TradeClosedEvent {
    return this.createTradeClosedEvent({
      symbol,
      originalOrderId,
      closeOrderId,
      closeType: 'SL',
      closePrice,
      closeQuantity,
      closedAt: new Date(),
      pnl,
      pnlPercent,
      roe,
      entryPrice,
      holdingDuration,
      source,
      strategyId,
      metadata,
    });
  }

  /**
   * 청산 이벤트 생성
   */
  static createLiquidationEvent(
    symbol: string,
    originalOrderId: string,
    closeOrderId: string,
    closePrice: number,
    closeQuantity: number,
    pnl: number,
    pnlPercent: number,
    roe: number,
    entryPrice: number,
    holdingDuration: number,
    metadata?: any,
  ): TradeClosedEvent {
    return this.createTradeClosedEvent({
      symbol,
      originalOrderId,
      closeOrderId,
      closeType: 'LIQUIDATION',
      closePrice,
      closeQuantity,
      closedAt: new Date(),
      pnl,
      pnlPercent,
      roe,
      entryPrice,
      holdingDuration,
      source: 'SYSTEM',
      metadata,
    });
  }

  /**
   * 이벤트 ID 생성
   */
  private static generateEventId(): string {
    return `close_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * 거래 종료 이벤트 유틸리티
 */
export class TradeClosedEventUtils {
  /**
   * 수익 거래인지 확인
   */
  static isProfitable(event: TradeClosedEvent): boolean {
    return event.pnl > 0;
  }

  /**
   * 손실 거래인지 확인
   */
  static isLoss(event: TradeClosedEvent): boolean {
    return event.pnl < 0;
  }

  /**
   * 손익분기점인지 확인
   */
  static isBreakeven(event: TradeClosedEvent): boolean {
    return Math.abs(event.pnl) < 0.01; // 0.01 USDT 이하는 손익분기점으로 간주
  }

  /**
   * 익절인지 확인
   */
  static isTakeProfit(event: TradeClosedEvent): boolean {
    return event.closeType === 'TP';
  }

  /**
   * 손절인지 확인
   */
  static isStopLoss(event: TradeClosedEvent): boolean {
    return event.closeType === 'SL';
  }

  /**
   * 수동 종료인지 확인
   */
  static isManualClose(event: TradeClosedEvent): boolean {
    return event.closeType === 'MANUAL';
  }

  /**
   * 청산인지 확인
   */
  static isLiquidation(event: TradeClosedEvent): boolean {
    return event.closeType === 'LIQUIDATION';
  }

  /**
   * 단기 거래인지 확인 (1시간 이하)
   */
  static isShortTerm(event: TradeClosedEvent): boolean {
    return event.holdingDuration <= 3600; // 1시간 = 3600초
  }

  /**
   * 장기 거래인지 확인 (24시간 이상)
   */
  static isLongTerm(event: TradeClosedEvent): boolean {
    return event.holdingDuration >= 86400; // 24시간 = 86400초
  }

  /**
   * 고수익 거래인지 확인 (10% 이상)
   */
  static isHighReturn(event: TradeClosedEvent): boolean {
    return Math.abs(event.pnlPercent) >= 10;
  }

  /**
   * 심볼에서 코인 추출
   */
  static extractCoinFromSymbol(symbol: string): string {
    return symbol.replace('USDT', '').replace('BUSD', '');
  }
}
