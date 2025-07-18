/**
 * Market Data 도메인 이벤트 타입 정의
 *
 * 이벤트 드리븐 아키텍처를 위한 타입 안전성을 제공합니다.
 */

import { CandleData } from '../infra/candle/Candle15MEntity';

/**
 * 캔들 저장 완료 이벤트
 */
export interface CandleSavedEvent {
  symbol: string;
  market: 'FUTURES' | 'SPOT';
  timeframe: string;
  candleData: CandleData;
  isNewCandle: boolean; // 새로운 캔들인지 업데이트인지
  savedAt: Date;
  candleId: number;
}

/**
 * 기술적 분석 완료 이벤트
 */
export interface TechnicalAnalysisCompletedEvent {
  symbol: string;
  timeframe: string;
  analysisResult: {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    indicators: Record<string, any>;
    strategies: Array<{
      name: string;
      signal: string;
      confidence: number;
    }>;
  };
  candleData: CandleData;
  analyzedAt: Date;
}

/**
 * 알림 발송 요청 이벤트
 */
export interface NotificationRequestEvent {
  type: 'TELEGRAM' | 'WEBSOCKET' | 'KAKAO' | 'EMAIL';
  symbol: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  content: {
    title: string;
    message: string;
    data?: any;
  };
  recipients?: string[]; // 특정 수신자 지정 (선택)
  requestedAt: Date;
}

/**
 * 이벤트 이름 상수
 */
export const MARKET_DATA_EVENTS = {
  CANDLE_SAVED: 'candle.saved',
  TECHNICAL_ANALYSIS_COMPLETED: 'technical.analysis.completed',
  NOTIFICATION_REQUEST: 'notification.request',
  NOTIFICATION_SENT: 'notification.sent',
  ANALYSIS_ERROR: 'analysis.error',
} as const;

export type MarketDataEventName =
  (typeof MARKET_DATA_EVENTS)[keyof typeof MARKET_DATA_EVENTS];
