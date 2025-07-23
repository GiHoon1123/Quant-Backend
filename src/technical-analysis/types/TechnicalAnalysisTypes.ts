// VWAP 결과 타입
export interface VWAPResult {
  timestamp: number;
  value: number;
}
/**
 * 캔들(OHLCV) 데이터 타입
 *
 * 바이낸스 API에서 받아오는 캔들스틱 데이터를 표준화한 형태입니다.
 * 모든 기술적 분석의 기반이 되는 기본 데이터 구조입니다.
 */
export interface CandleData {
  /** 캔들 시작 시간 (Unix timestamp, ms) */
  openTime: number;

  /** 시가 (Open) */
  open: number;

  /** 고가 (High) */
  high: number;

  /** 저가 (Low) */
  low: number;

  /** 종가 (Close) */
  close: number;

  /** 거래량 (Volume) */
  volume: number;

  /** 캔들 종료 시간 (Unix timestamp, ms) */
  closeTime: number;

  /** Quote 자산 거래량 (USDT 기준 거래대금) */
  quoteVolume: number;

  /** 거래 횟수 */
  trades: number;

  /** Taker buy base asset volume */
  takerBuyBaseVolume: number;

  /** Taker buy quote asset volume */
  takerBuyQuoteVolume: number;
}

/**
 * 지원하는 시간봉 타입
 *
 * 바이낸스 API 호환 시간봉 형식입니다.
 * 각 시간봉별로 다른 전략을 적용할 수 있습니다.
 */
export enum TimeFrame {
  /** 1분봉 - 스캘핑, 단기 매매 */
  ONE_MINUTE = '1m',

  /** 15분봉 - 단기 스윙 트레이딩 */
  FIFTEEN_MINUTES = '15m',

  /** 1시간봉 - 중기 트렌드 분석 */
  ONE_HOUR = '1h',

  /** 1일봉 - 장기 투자, 주요 트렌드 분석 */
  ONE_DAY = '1d',
}

/**
 * 기술적 지표 계산 결과 인터페이스
 *
 * 각 지표별로 고유한 값들을 포함하지만,
 * 공통적으로 타임스탬프와 값을 가집니다.
 */
export interface TechnicalIndicatorResult {
  /** 해당 지표가 계산된 시점의 타임스탬프 */
  timestamp: number;

  /** 지표의 주요 값 (예: MA값, RSI값 등) */
  value: number;

  /** 추가 메타데이터 (지표별로 다름) */
  metadata?: Record<string, any>;
}

/**
 * 이동평균선 계산 결과
 *
 * 단순이동평균(SMA)과 지수이동평균(EMA) 모두 지원합니다.
 */
export interface MovingAverageResult extends TechnicalIndicatorResult {
  /** 이동평균 타입 (SMA 또는 EMA) */
  type: 'SMA' | 'EMA';

  /** 이동평균 기간 (5일, 20일, 200일 등) */
  period: number;
}

/**
 * RSI(Relative Strength Index) 계산 결과
 *
 * 0~100 범위의 값을 가지며, 과매수/과매도 판단에 사용됩니다.
 */
export interface RSIResult extends TechnicalIndicatorResult {
  /** RSI 값 (0~100) */
  value: number;

  /** 과매수 여부 (일반적으로 70 이상) */
  isOverbought: boolean;

  /** 과매도 여부 (일반적으로 30 이하) */
  isOversold: boolean;
}

/**
 * MACD(Moving Average Convergence Divergence) 계산 결과
 *
 * MACD 라인, 시그널 라인, 히스토그램을 포함합니다.
 */
export interface MACDResult extends TechnicalIndicatorResult {
  /** MACD 라인 (12EMA - 26EMA) */
  macdLine: number;

  /** 시그널 라인 (MACD의 9EMA) */
  signalLine: number;

  /** 히스토그램 (MACD - Signal) */
  histogram: number;

  /** 골든크로스 여부 (MACD > Signal) */
  isGoldenCross: boolean;

  /** 데드크로스 여부 (MACD < Signal) */
  isDeadCross: boolean;
}

/**
 * 볼린저 밴드 계산 결과
 *
 * 중심선(이동평균)과 상/하단 밴드를 포함합니다.
 */
export interface BollingerBandsResult extends TechnicalIndicatorResult {
  /** 중심선 (보통 20일 이동평균) */
  middle: number;

  /** 상단 밴드 (중심선 + 2*표준편차) */
  upper: number;

  /** 하단 밴드 (중심선 - 2*표준편차) */
  lower: number;

  /** 현재가의 밴드 내 위치 (0~1) */
  percentB: number;

  /** 밴드폭 (상단-하단)/중심선 */
  bandwidth: number;
}

/**
 * 거래량 분석 결과
 *
 * 거래량 기반 지표들을 포함합니다.
 */
export interface VolumeAnalysisResult extends TechnicalIndicatorResult {
  /** 현재 거래량 */
  currentVolume: number;

  /** 거래량 이동평균 */
  volumeMA: number;

  /** 거래량 비율 (현재/평균) */
  volumeRatio: number;

  /** 거래량 급증 여부 (보통 2배 이상) */
  isVolumeSurge: boolean;

  /** OBV (On Balance Volume) */
  obv: number;
}

/**
 * 스토캐스틱 오실레이터 계산 결과
 *
 * 스토캐스틱은 현재 가격이 일정 기간의 고가-저가 범위에서 어느 위치에 있는지를 나타내는 모멘텀 지표입니다.
 * 0~100 범위의 값을 가지며, 과매수/과매도 구간을 판단하는 데 사용됩니다.
 *
 * 📊 해석 기준:
 * - 80 이상: 과매수 구간 (매도 고려)
 * - 20 이하: 과매도 구간 (매수 고려)
 * - %K가 %D를 상향 돌파: 매수 신호 (골든크로스)
 * - %K가 %D를 하향 돌파: 매도 신호 (데드크로스)
 *
 * 🎯 활용법:
 * - RSI와 함께 사용하여 과매수/과매도 확인
 * - 다이버전스 분석으로 추세 전환점 포착
 * - 골든크로스/데드크로스로 진입/청산 타이밍 결정
 */
export interface StochasticResult extends TechnicalIndicatorResult {
  /** %K 값 (Fast Stochastic) - 현재 위치를 나타내는 빠른 선 */
  percentK: number;

  /** %D 값 (Slow Stochastic) - %K의 이동평균으로 신호선 역할 */
  percentD: number;

  /** 과매수 여부 (일반적으로 80 이상) */
  isOverbought: boolean;

  /** 과매도 여부 (일반적으로 20 이하) */
  isOversold: boolean;

  /** 골든크로스 여부 (%K > %D) */
  isGoldenCross: boolean;

  /** 데드크로스 여부 (%K < %D) */
  isDeadCross: boolean;
}
