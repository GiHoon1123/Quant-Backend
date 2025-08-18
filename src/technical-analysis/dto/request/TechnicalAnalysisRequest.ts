import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { StrategyType } from '../../types/StrategyTypes';
import { TimeFrame } from '../../types/TechnicalAnalysisTypes';

/**
 * 단일 심볼 분석 요청 DTO
 *
 * 특정 암호화폐에 대한 기술적 분석을 요청할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - symbol: 분석할 암호화폐 심볼 (필수)
 * - strategies: 실행할 전략들 (선택사항)
 * - timeframes: 분석할 시간봉들 (선택사항)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "symbol": "BTCUSDT",
 *   "strategies": ["MA_20_BREAKOUT", "GOLDEN_CROSS_50_200"],
 *   "timeframes": ["15m", "1h", "1d"]
 * }
 * ```
 */
export class AnalyzeSymbolDto {
  @ApiProperty({
    description: '분석할 암호화폐 심볼 (USDT 페어)',
    example: 'BTCUSDT',
    pattern: '^[A-Z]+USDT$',
  })
  @IsString()
  symbol: string;

  @ApiPropertyOptional({
    description: '실행할 전략들 (선택사항)',
    enum: StrategyType,
    isArray: true,
    example: [StrategyType.MA_20_BREAKOUT, StrategyType.GOLDEN_CROSS_50_200],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(StrategyType, { each: true })
  strategies?: StrategyType[];

  @ApiPropertyOptional({
    description: '분석할 시간봉들 (선택사항)',
    enum: TimeFrame,
    isArray: true,
    example: [TimeFrame.FIFTEEN_MINUTES, TimeFrame.ONE_HOUR, TimeFrame.ONE_DAY],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TimeFrame, { each: true })
  timeframes?: TimeFrame[];
}

/**
 * 다중 심볼 스크리닝 요청 DTO
 *
 * 여러 암호화폐를 동시에 스크리닝할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - symbols: 스크리닝할 심볼들 (선택사항, 기본값: 주요 10개 코인)
 * - strategies: 실행할 전략들 (선택사항)
 * - timeframes: 분석할 시간봉들 (선택사항)
 * - minConfidence: 최소 신뢰도 필터 (선택사항, 기본값: 60)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT"],
 *   "strategies": ["MA_20_BREAKOUT", "RSI_OVERSOLD_BOUNCE"],
 *   "timeframes": ["15m", "1h"],
 *   "minConfidence": 70
 * }
 * ```
 */
export class ScreenMultipleSymbolsDto {
  @ApiPropertyOptional({
    description: '스크리닝할 암호화폐 심볼들 (선택사항)',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];

  @ApiPropertyOptional({
    description: '실행할 전략들 (선택사항)',
    enum: StrategyType,
    isArray: true,
    example: [StrategyType.MA_20_BREAKOUT, StrategyType.RSI_OVERSOLD_BOUNCE],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(StrategyType, { each: true })
  strategies?: StrategyType[];

  @ApiPropertyOptional({
    description: '분석할 시간봉들 (선택사항)',
    enum: TimeFrame,
    isArray: true,
    example: [TimeFrame.FIFTEEN_MINUTES, TimeFrame.ONE_HOUR],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TimeFrame, { each: true })
  timeframes?: TimeFrame[];
}

/**
 * 지표 요약 조회 요청 DTO
 *
 * 특정 심볼의 기술적 지표 요약을 요청할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - symbol: 조회할 암호화폐 심볼 (필수)
 * - timeframe: 조회할 시간봉 (필수)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "symbol": "BTCUSDT",
 *   "timeframe": "1h"
 * }
 * ```
 */
export class IndicatorSummaryDto {
  @ApiProperty({
    description: '조회할 암호화폐 심볼',
    example: 'BTCUSDT',
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: '조회할 시간봉',
    enum: TimeFrame,
    example: TimeFrame.ONE_HOUR,
  })
  @IsEnum(TimeFrame)
  timeframe: TimeFrame;
}

/**
 * 시장 모니터링 요청 DTO
 *
 * 실시간 시장 모니터링을 요청할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - symbols: 모니터링할 심볼들 (선택사항)
 * - alertThreshold: 알림 신뢰도 임계값 (선택사항, 기본값: 80)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "symbols": ["BTCUSDT", "ETHUSDT"],
 *   "alertThreshold": 85
 * }
 * ```
 */
export class MonitorMarketDto {
  @ApiPropertyOptional({
    description: '모니터링할 암호화폐 심볼들 (선택사항)',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];
}

/**
 * 전략 스크리닝 요청 DTO
 *
 * 특정 전략을 여러 심볼에 적용하여 스크리닝할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - strategy: 실행할 전략 (필수)
 * - timeframe: 분석할 시간봉 (필수)
 * - symbols: 스캔할 심볼들 (선택사항)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "strategy": "MA_20_BREAKOUT",
 *   "timeframe": "1h",
 *   "symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT"]
 * }
 * ```
 */
export class StrategyScreeningDto {
  @ApiProperty({
    description: '실행할 전략',
    enum: StrategyType,
    example: StrategyType.MA_20_BREAKOUT,
  })
  @IsEnum(StrategyType)
  strategy: StrategyType;

  @ApiProperty({
    description: '분석할 시간봉',
    enum: TimeFrame,
    example: TimeFrame.ONE_HOUR,
  })
  @IsEnum(TimeFrame)
  timeframe: TimeFrame;

  @ApiPropertyOptional({
    description: '스캔할 암호화폐 심볼들 (선택사항)',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];
}

/**
 * 강한 매수 신호 검색 요청 DTO
 *
 * 높은 신뢰도의 매수 신호를 검색할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - symbols: 검색할 심볼들 (선택사항)
 * - minConfidence: 최소 신뢰도 (선택사항, 기본값: 75)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "symbols": ["BTCUSDT", "ETHUSDT"],
 *   "minConfidence": 80
 * }
 * ```
 */
export class FindStrongBuySignalsDto {
  @ApiPropertyOptional({
    description: '검색할 암호화폐 심볼들 (선택사항)',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];

  @ApiPropertyOptional({
    description: '최소 신뢰도 (0-100)',
    minimum: 0,
    maximum: 100,
    example: 75,
    default: 75,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  minConfidence?: number;
}

/**
 * 배치 분석 요청 DTO
 *
 * 여러 심볼에 대해 배치로 분석을 요청할 때 사용되는 데이터 구조입니다.
 *
 * 🎯 주요 필드:
 * - symbols: 분석할 심볼들 (필수, 최소 1개)
 * - strategies: 실행할 전략들 (선택사항)
 * - timeframes: 분석할 시간봉들 (선택사항)
 * - parallel: 병렬 처리 여부 (선택사항, 기본값: true)
 *
 * 💡 사용 예시:
 * ```json
 * {
 *   "symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT"],
 *   "strategies": ["MA_20_BREAKOUT", "RSI_OVERSOLD_BOUNCE"],
 *   "timeframes": ["15m", "1h"],
 *   "parallel": true
 * }
 * ```
 */
export class BatchAnalysisDto {
  @ApiProperty({
    description: '분석할 암호화폐 심볼들 (최소 1개)',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  symbols: string[];

  @ApiPropertyOptional({
    description: '실행할 전략들 (선택사항)',
    enum: StrategyType,
    isArray: true,
    example: [StrategyType.MA_20_BREAKOUT, StrategyType.RSI_OVERSOLD_BOUNCE],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(StrategyType, { each: true })
  strategies?: StrategyType[];

  @ApiPropertyOptional({
    description: '분석할 시간봉들 (선택사항)',
    enum: TimeFrame,
    isArray: true,
    example: [TimeFrame.FIFTEEN_MINUTES, TimeFrame.ONE_HOUR],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TimeFrame, { each: true })
  timeframes?: TimeFrame[];

  @ApiPropertyOptional({
    description: '병렬 처리 여부',
    example: true,
    default: true,
  })
  @IsOptional()
  parallel?: boolean;
}
