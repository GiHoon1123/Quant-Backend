/**
 * 캐시 엔트리 인터페이스
 * 캐시에 저장되는 데이터의 구조를 정의합니다.
 */
export interface CacheEntry {
  /** 캐시에 저장된 값 */
  value: any;
  /** 캐시 저장 시간 (밀리초) */
  timestamp: number;
  /** 캐시 유효 시간 (밀리초) */
  ttl: number;
}

/**
 * ATR 결과 인터페이스
 * ATR 계산 결과를 캐시에 저장할 때 사용합니다.
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
 * 캐시 키 패턴
 * 캐시 키의 구조를 정의합니다.
 */
export enum CacheKeyPattern {
  ATR = 'atr:{symbol}',
  ATR_TIMESTAMP = 'atr:{symbol}:timestamp',
  ATR_PERIOD = 'atr:{symbol}:period',
  CONFIG_ATR_STOP_LOSS = 'config:atr_stop_loss_multiplier',
  CONFIG_ATR_TAKE_PROFIT = 'config:atr_take_profit_multiplier',
  CONFIG_EMERGENCY_STOP_LOSS = 'config:emergency_stop_loss',
  CONFIG_EMERGENCY_TAKE_PROFIT = 'config:emergency_take_profit',
  POSITION = 'position:{symbol}',
  POSITION_ENTRY_TIME = 'position:{symbol}:entry_time',
}
