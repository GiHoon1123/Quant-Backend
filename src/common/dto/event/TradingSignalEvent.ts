/**
 * 자동 매매 신호 이벤트 DTO
 *
 * AutoTradingService에서 생성되는 매매 신호를 정의합니다.
 * 이 이벤트는 FuturesService가 수신하여 실제 포지션 진입을 수행합니다.
 *
 * 🔄 이벤트 흐름:
 * AutoTradingService → trading.signal → FuturesService → 실제 포지션 진입
 */
export interface TradingSignalEvent {
  /** 이벤트 고유 ID */
  eventId: string;

  /** 이벤트 발생 시간 */
  timestamp: Date;

  /** 거래 심볼 */
  symbol: string;

  /** 매매 신호 타입 */
  signal: 'LONG' | 'SHORT' | 'CLOSE';

  /** 신호 신뢰도 (0-100) */
  confidence: number;

  /** 사용된 전략명 */
  strategy: string;

  /** 진입 가격 */
  entryPrice: number;

  /** 손절 가격 */
  stopLoss: number;

  /** 익절 가격 */
  takeProfit: number;

  /** 포지션 수량 */
  quantity: number;

  /** 신호 발생 소스 */
  source: string;

  /** 추가 메타데이터 */
  metadata: {
    /** 원본 분석 결과 */
    analysis?: any;

    /** 진입 조건 설명 */
    conditions?: string;

    /** 기타 추가 정보 */
    [key: string]: any;
  };
}
