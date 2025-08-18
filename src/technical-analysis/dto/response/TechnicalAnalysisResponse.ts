import { ApiProperty } from '@nestjs/swagger';
import {
  MultiStrategyResult,
  SignalType,
  StrategyType,
} from '../../types/StrategyTypes';
import { TimeFrame } from '../../types/TechnicalAnalysisTypes';

/**
 * 기본 API 응답 구조
 *
 * 모든 기술적 분석 API 응답에서 사용되는 기본 구조입니다.
 *
 * 🎯 주요 필드:
 * - success: 요청 성공 여부
 * - message: 응답 메시지
 * - data: 실제 응답 데이터
 * - timestamp: 응답 시간 (선택사항)
 */
export class BaseApiResponse<T> {
  @ApiProperty({
    description: '요청 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '응답 메시지',
    example: '요청이 성공적으로 처리되었습니다',
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
  })
  data: T;

  @ApiProperty({
    description: '응답 시간 (Unix timestamp)',
    example: 1703123456789,
    required: false,
  })
  timestamp?: number;
}

/**
 * 단일 심볼 분석 응답 데이터
 */
export class SymbolAnalysisData {
  @ApiProperty({
    description: '분석된 심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '분석 시간',
    example: 1703123456789,
  })
  timestamp: number;

  @ApiProperty({
    description: '종합 분석 결과',
  })
  analysis: MultiStrategyResult;
}

/**
 * 단일 심볼 분석 응답 DTO
 *
 * 특정 암호화폐에 대한 기술적 분석 결과를 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "분석이 성공적으로 완료되었습니다",
 *   "data": {
 *     "symbol": "BTCUSDT",
 *     "timestamp": 1703123456789,
 *     "analysis": {
 *       "overallSignal": "BUY",
 *       "overallConfidence": 75,
 *       "consensus": 0.8,
 *       "strategies": [...],
 *       "timeframeSummary": {...}
 *     }
 *   }
 * }
 * ```
 */
export class SymbolAnalysisResponse extends BaseApiResponse<SymbolAnalysisData> {}

/**
 * 심볼별 분석 결과
 */
export class SymbolResult {
  @ApiProperty({
    description: '심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '분석 결과',
  })
  analysis: MultiStrategyResult;
}

/**
 * 다중 심볼 스크리닝 응답 데이터
 */
export class MultiSymbolScreeningData {
  @ApiProperty({
    description: '총 분석 대상 심볼 수',
    example: 10,
  })
  totalSymbols: number;

  @ApiProperty({
    description: '유효한 결과 수',
    example: 7,
  })
  validResults: number;

  @ApiProperty({
    description: '분석 시간',
    example: 1703123456789,
  })
  timestamp: number;

  @ApiProperty({
    description: '심볼별 분석 결과',
    type: [SymbolResult],
  })
  results: SymbolResult[];
}

/**
 * 다중 심볼 스크리닝 응답 DTO
 *
 * 여러 암호화폐에 대한 스크리닝 결과를 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "7개 심볼 스크리닝이 완료되었습니다",
 *   "data": {
 *     "totalSymbols": 10,
 *     "validResults": 7,
 *     "timestamp": 1703123456789,
 *     "results": [...]
 *   }
 * }
 * ```
 */
export class MultiSymbolScreeningResponse extends BaseApiResponse<MultiSymbolScreeningData> {}

/**
 * 지표 요약 응답 DTO
 *
 * 특정 심볼의 기술적 지표 요약 정보를 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "지표 요약 조회가 완료되었습니다",
 *   "data": {
 *     "symbol": "BTCUSDT",
 *     "timeframe": "1h",
 *     "currentPrice": 43250.5,
 *     "indicators": {
 *       "priceVsMA": {...},
 *       "rsi": {...},
 *       "macd": {...},
 *       "bollinger": {...},
 *       "volume": {...}
 *     }
 *   }
 * }
 * ```
 */
export class IndicatorSummaryResponse extends BaseApiResponse<any> {}

/**
 * 시장 알림 정보
 */
export class MarketAlert {
  @ApiProperty({
    description: '알림 대상 심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '알림 메시지',
    example: '🚀 강한 매수 신호 (85%)',
  })
  alertMessage: string;

  @ApiProperty({
    description: '신호 유형',
    enum: SignalType,
    example: SignalType.STRONG_BUY,
  })
  signal: SignalType;

  @ApiProperty({
    description: '합의도',
    example: 0.9,
  })
  consensus: number;
}

/**
 * 시장 알림 응답 데이터
 */
export class MarketAlertData {
  @ApiProperty({
    description: '총 알림 수',
    example: 3,
  })
  alertCount: number;

  @ApiProperty({
    description: '알림 임계값',
    example: 80,
  })
  alertThreshold: number;

  @ApiProperty({
    description: '모니터링 시간',
    example: 1703123456789,
  })
  timestamp: number;

  @ApiProperty({
    description: '알림 목록',
    type: [MarketAlert],
  })
  alerts: MarketAlert[];
}

/**
 * 시장 알림 응답 DTO
 *
 * 실시간 시장 모니터링에서 발생한 알림들을 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "시장 모니터링 완료: 3개 알림",
 *   "data": {
 *     "alertCount": 3,
 *     "alertThreshold": 80,
 *     "timestamp": 1703123456789,
 *     "alerts": [...]
 *   }
 * }
 * ```
 */
export class MarketAlertResponse extends BaseApiResponse<MarketAlertData> {}

/**
 * 전략 실행 결과 (요약)
 */
export class StrategyResultSummary {
  @ApiProperty({
    description: '심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '신호 유형',
    enum: SignalType,
    example: SignalType.BUY,
  })
  signal: SignalType;

  @ApiProperty({
    description: '분석 근거',
    example: 'MA20 상향 돌파 + 거래량 증가',
  })
  reasoning: string;

  @ApiProperty({
    description: '사용된 지표 값들',
  })
  indicators: Record<string, any>;
}

/**
 * 전략 스크리닝 응답 데이터
 */
export class StrategyScreeningData {
  @ApiProperty({
    description: '실행된 전략',
    enum: StrategyType,
    example: StrategyType.MA_20_BREAKOUT,
  })
  strategy: StrategyType;

  @ApiProperty({
    description: '분석 시간봉',
    enum: TimeFrame,
    example: TimeFrame.ONE_HOUR,
  })
  timeframe: TimeFrame;

  @ApiProperty({
    description: '총 분석 심볼 수',
    example: 10,
  })
  totalSymbols: number;

  @ApiProperty({
    description: '결과 수',
    example: 8,
  })
  resultCount: number;

  @ApiProperty({
    description: '분석 시간',
    example: 1703123456789,
  })
  timestamp: number;

  @ApiProperty({
    description: '전략 실행 결과들',
    type: [StrategyResultSummary],
  })
  results: StrategyResultSummary[];
}

/**
 * 전략 스크리닝 응답 DTO
 *
 * 특정 전략을 여러 심볼에 적용한 결과를 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "전략 스캔 완료: 8개 결과",
 *   "data": {
 *     "strategy": "MA_20_BREAKOUT",
 *     "timeframe": "1h",
 *     "totalSymbols": 10,
 *     "resultCount": 8,
 *     "timestamp": 1703123456789,
 *     "results": [...]
 *   }
 * }
 * ```
 */
export class StrategyScreeningResponse extends BaseApiResponse<StrategyScreeningData> {}

/**
 * 강한 매수 신호 정보
 */
export class StrongBuySignal {
  @ApiProperty({
    description: '심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '신호 유형',
    enum: SignalType,
    example: SignalType.STRONG_BUY,
  })
  signal: SignalType;

  @ApiProperty({
    description: '신뢰도',
    example: 85,
  })
  confidence: number;

  @ApiProperty({
    description: '합의도',
    example: 0.9,
  })
  consensus: number;

  @ApiProperty({
    description: '상위 전략들',
  })
  topStrategies: Array<{
    strategy: StrategyType;
    signal: SignalType;
    confidence: number;
    timeframe: TimeFrame;
  }>;
}

/**
 * 강한 매수 신호 응답 데이터
 */
export class StrongBuySignalsData {
  @ApiProperty({
    description: '발견된 신호 수',
    example: 3,
  })
  count: number;

  @ApiProperty({
    description: '최소 신뢰도',
    example: 75,
  })
  minConfidence: number;

  @ApiProperty({
    description: '검색 시간',
    example: 1703123456789,
  })
  timestamp: number;

  @ApiProperty({
    description: '강한 매수 신호들',
    type: [StrongBuySignal],
  })
  signals: StrongBuySignal[];
}

/**
 * 강한 매수 신호 응답 DTO
 *
 * 높은 신뢰도의 매수 신호들을 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "3개의 강한 매수 신호를 발견했습니다",
 *   "data": {
 *     "count": 3,
 *     "minConfidence": 75,
 *     "timestamp": 1703123456789,
 *     "signals": [...]
 *   }
 * }
 * ```
 */
export class StrongBuySignalsResponse extends BaseApiResponse<StrongBuySignalsData> {}

/**
 * 배치 분석 결과
 */
export class BatchAnalysisResult {
  @ApiProperty({
    description: '심볼',
    example: 'BTCUSDT',
  })
  symbol: string;

  @ApiProperty({
    description: '분석 상태',
    example: 'success',
    enum: ['success', 'failed', 'skipped'],
  })
  status: 'success' | 'failed' | 'skipped';

  @ApiProperty({
    description: '분석 결과 (성공시)',
    required: false,
  })
  analysis?: MultiStrategyResult;

  @ApiProperty({
    description: '오류 메시지 (실패시)',
    example: '데이터를 가져올 수 없습니다',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: '처리 시간 (밀리초)',
    example: 2500,
  })
  processingTime: number;
}

/**
 * 배치 분석 응답 데이터
 */
export class BatchAnalysisData {
  @ApiProperty({
    description: '총 요청 심볼 수',
    example: 10,
  })
  totalRequested: number;

  @ApiProperty({
    description: '성공한 분석 수',
    example: 8,
  })
  successful: number;

  @ApiProperty({
    description: '실패한 분석 수',
    example: 2,
  })
  failed: number;

  @ApiProperty({
    description: '총 처리 시간 (밀리초)',
    example: 15000,
  })
  totalProcessingTime: number;

  @ApiProperty({
    description: '분석 시간',
    example: 1703123456789,
  })
  timestamp: number;

  @ApiProperty({
    description: '배치 분석 결과들',
    type: [BatchAnalysisResult],
  })
  results: BatchAnalysisResult[];
}

/**
 * 배치 분석 응답 DTO
 *
 * 여러 심볼에 대한 배치 분석 결과를 반환하는 응답 구조입니다.
 *
 * 💡 응답 예시:
 * ```json
 * {
 *   "success": true,
 *   "message": "배치 분석 완료: 10개 중 8개 성공",
 *   "data": {
 *     "totalRequested": 10,
 *     "successful": 8,
 *     "failed": 2,
 *     "totalProcessingTime": 15000,
 *     "timestamp": 1703123456789,
 *     "results": [...]
 *   }
 * }
 * ```
 */
export class BatchAnalysisResponse extends BaseApiResponse<BatchAnalysisData> {}

/**
 * 헬스체크 응답 데이터
 */
export class HealthCheckData {
  @ApiProperty({
    description: '시스템 상태',
    example: 'healthy',
  })
  status: string;

  @ApiProperty({
    description: '서비스 버전',
    example: '1.0.0',
  })
  version: string;

  @ApiProperty({
    description: '지원 기능 목록',
    type: [String],
    example: ['단일 심볼 분석', '다중 심볼 스크리닝', '실시간 모니터링'],
  })
  features: string[];

  @ApiProperty({
    description: '응답 시간',
    example: 1703123456789,
  })
  timestamp: number;
}

/**
 * 헬스체크 응답 DTO
 *
 * 서비스 상태 확인 결과를 반환하는 응답 구조입니다.
 */
export class HealthCheckResponse extends BaseApiResponse<HealthCheckData> {}
