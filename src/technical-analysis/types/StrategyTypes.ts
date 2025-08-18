/**
 * 트레이딩 전략 타입 열거형
 *
 * 구현할 모든 기술적 분석 전략들을 정의합니다.
 * 새로운 전략을 추가할 때 이 열거형에 추가하면 됩니다.
 */
export enum StrategyType {
  // 이동평균선 기반 전략
  MA_20_BREAKOUT = 'MA_20_BREAKOUT', // 20일선 돌파
  MA_50_BREAKOUT = 'MA_50_BREAKOUT', // 50일선 돌파
  MA_100_BREAKOUT = 'MA_100_BREAKOUT', // 100일선 돌파
  MA_150_BREAKOUT = 'MA_150_BREAKOUT', // 150일선 돌파
  MA_200_BREAKOUT = 'MA_200_BREAKOUT', // 200일선 돌파

  // 이동평균선 교차 전략
  GOLDEN_CROSS_5_20 = 'GOLDEN_CROSS_5_20', // 5일선이 20일선 상향 돌파
  GOLDEN_CROSS_20_60 = 'GOLDEN_CROSS_20_60', // 20일선이 60일선 상향 돌파
  GOLDEN_CROSS_50_200 = 'GOLDEN_CROSS_50_200', // 50일선이 200일선 상향 돌파

  // RSI 기반 전략
  RSI_OVERSOLD_BOUNCE = 'RSI_OVERSOLD_BOUNCE', // RSI 30 이하에서 반등
  RSI_MOMENTUM_70 = 'RSI_MOMENTUM_70', // RSI 70 돌파 (강한 모멘텀)
  RSI_DIVERGENCE = 'RSI_DIVERGENCE', // RSI 다이버전스

  // MACD 기반 전략
  MACD_GOLDEN_CROSS = 'MACD_GOLDEN_CROSS', // MACD 골든크로스
  MACD_ZERO_CROSS = 'MACD_ZERO_CROSS', // MACD 0선 돌파
  MACD_HISTOGRAM_TURN = 'MACD_HISTOGRAM_TURN', // MACD 히스토그램 전환

  // 볼린저 밴드 전략
  BOLLINGER_UPPER_BREAK = 'BOLLINGER_UPPER_BREAK', // 볼린저 상단 돌파
  BOLLINGER_LOWER_BOUNCE = 'BOLLINGER_LOWER_BOUNCE', // 볼린저 하단 반등
  BOLLINGER_SQUEEZE = 'BOLLINGER_SQUEEZE', // 볼린저 밴드 스퀴즈

  // 거래량 기반 전략
  VOLUME_SURGE_UP = 'VOLUME_SURGE_UP', // 거래량 급증 + 상승
  VOLUME_MA_BREAK = 'VOLUME_MA_BREAK', // 거래량 이동평균 돌파
  OBV_TREND = 'OBV_TREND', // OBV 상승 트렌드

  // 복합 전략
  TRIPLE_CONFIRMATION = 'TRIPLE_CONFIRMATION', // MA + RSI + Volume 3중 확인
  MOMENTUM_BREAKOUT = 'MOMENTUM_BREAKOUT', // 모멘텀 + 돌파 복합
  TREND_FOLLOWING = 'TREND_FOLLOWING', // 다중 시간봉 트렌드 추종

  // 고급 전략들
  SMART_MONEY_FLOW = 'SMART_MONEY_FLOW', // 스마트 머니 플로우
  MULTI_TIMEFRAME_TREND = 'MULTI_TIMEFRAME_TREND', // 다중 시간봉 트렌드
  PATTERN_RECOGNITION = 'PATTERN_RECOGNITION', // 패턴 인식
  ELLIOTT_WAVE = 'ELLIOTT_WAVE', // 엘리어트 파동
  AI_PREDICTION = 'AI_PREDICTION', // AI 예측

  // 실전 전략들
  DAY_TRADING_STRATEGY = 'DAY_TRADING_STRATEGY', // 데이 트레이딩 전략
  SWING_TRADING = 'SWING_TRADING', // 스윙 트레이딩
  POSITION_TRADING = 'POSITION_TRADING', // 포지션 트레이딩
  MEAN_REVERSION = 'MEAN_REVERSION', // 평균 회귀
}

/**
 * 전략 신호 타입
 *
 * 각 전략에서 생성되는 신호의 강도와 방향을 나타냅니다.
 */
export enum SignalType {
  /** 강한 매수 신호 */
  STRONG_BUY = 'STRONG_BUY',

  /** 매수 신호 */
  BUY = 'BUY',

  /** 약한 매수 신호 */
  WEAK_BUY = 'WEAK_BUY',

  /** 중립 (신호 없음) */
  NEUTRAL = 'NEUTRAL',

  /** 약한 매도 신호 */
  WEAK_SELL = 'WEAK_SELL',

  /** 매도 신호 */
  SELL = 'SELL',

  /** 강한 매도 신호 */
  STRONG_SELL = 'STRONG_SELL',
}

/**
 * 전략 실행 결과
 *
 * 각 전략이 분석한 결과와 생성된 신호 정보를 포함합니다.
 */
export interface StrategyResult {
  /** 전략 타입 */
  strategy: StrategyType;

  /** 분석 대상 심볼 */
  symbol: string;

  /** 분석 시간봉 */
  timeframe: string;

  /** 생성된 신호 */
  signal: SignalType;

  /** 신호 생성 시간 */
  timestamp: number;

  /** 신호 생성 근거 */
  reasoning?: string;

  /** 사용된 지표 값들 */
  indicators?: Record<string, any>;

  /** 분석 상세 정보 */
  details: {
    /** 전략별 상세 데이터 */
    indicators: Record<string, number>;

    /** 신호 생성 조건 */
    conditions: string[];

    /** 추가 메모 */
    notes?: string;
  };

  /** 추천 진입가격 (있는 경우) */
  entryPrice?: number;

  /** 추천 손절가격 (있는 경우) */
  stopLoss?: number;

  /** 추천 목표가격 (있는 경우) */
  takeProfit?: number;
}

/**
 * 전략 설정 인터페이스
 *
 * 각 전략의 파라미터를 설정할 수 있습니다.
 */
export interface StrategyConfig {
  /** 전략 타입 */
  strategy: StrategyType;

  /** 전략 활성화 여부 */
  enabled: boolean;

  /** 전략별 파라미터 */
  parameters: {
    /** 이동평균 기간 (이동평균 전략용) */
    maPeriods?: number[];

    /** RSI 기간 및 임계값 */
    rsiConfig?: {
      period: number;
      oversoldLevel: number;
      overboughtLevel: number;
    };

    /** MACD 설정 */
    macdConfig?: {
      fastPeriod: number;
      slowPeriod: number;
      signalPeriod: number;
    };

    /** 볼린저 밴드 설정 */
    bollingerConfig?: {
      period: number;
      standardDeviation: number;
    };

    /** 거래량 설정 */
    volumeConfig?: {
      period: number;
      surgeThreshold: number;
    };

    /** 기타 커스텀 파라미터 */
    customParams?: Record<string, any>;
  };

  /** 적용할 시간봉들 */
  timeframes: string[];
}

/**
 * 다중 전략 분석 결과
 *
 * 여러 전략을 동시에 실행한 결과를 종합합니다.
 */
export interface MultiStrategyResult {
  /** 분석 대상 심볼 */
  symbol: string;

  /** 분석 시간 */
  timestamp: number;

  /** 각 전략별 결과 */
  strategies: StrategyResult[];

  /** 종합 신호 (모든 전략 고려) */
  overallSignal: SignalType;

  /** 신호 일치도 (같은 방향 신호 비율) */
  consensus: number;

  /** 시간봉별 신호 요약 */
  timeframeSummary: {
    [timeframe: string]: {
      signal: SignalType;
      strategyCount: number;
    };
  };
}
