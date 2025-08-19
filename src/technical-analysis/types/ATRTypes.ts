/**
 * ATR 계산 결과 인터페이스
 * ATR 계산 후 반환되는 결과를 정의합니다.
 */
export interface ATRResult {
  /** 거래 심볼 */
  symbol: string;
  /** ATR 값 */
  atr: number;
  /** 계산 시간 */
  timestamp: Date;
  /** ATR 계산 기간 */
  period: number;
  /** 사용된 캔들 개수 */
  candlesUsed: number;
}

/**
 * ATR 설정 인터페이스
 * ATR 기반 손절/익절 설정을 정의합니다.
 */
export interface ATRConfig {
  /** ATR 손절 승수 */
  stopLossMultiplier: number;
  /** ATR 익절 승수 */
  takeProfitMultiplier: number;
  /** 리스크/리워드 비율 */
  riskRewardRatio: number;
}

/**
 * 긴급 상황 설정 인터페이스
 * 긴급 손절/익절 설정을 정의합니다.
 */
export interface EmergencyConfig {
  /** 긴급 손절 비율 (%) */
  stopLossPercent: number;
  /** 긴급 익절 비율 (%) */
  takeProfitPercent: number;
  /** 긴급 상황 대응 활성화 여부 */
  enabled: boolean;
}
