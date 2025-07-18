import { Injectable } from '@nestjs/common';
import { Candle15MRepository } from '../../market-data/infra/candle/Candle15MRepository';
import {
  MultiStrategyResult,
  SignalType,
  StrategyConfig,
  StrategyResult,
  StrategyType,
} from '../types/StrategyTypes';
import { CandleData, TimeFrame } from '../types/TechnicalAnalysisTypes';
import { TechnicalIndicatorService } from './TechnicalIndicatorService';

/**
 * 전략 실행 서비스
 *
 * 모든 기술적 분석 전략들을 실행하고 매매 신호를 생성하는 핵심 서비스입니다.
 * 각 전략별로 세밀하게 조정된 알고리즘과 신뢰도 평가 시스템을 제공합니다.
 *
 * 🎯 주요 기능:
 * - 20+ 가지 전략 실행 (이동평균, RSI, MACD, 볼린저밴드 등)
 * - 다중 시간봉 종합 분석
 * - 신호 강도 및 신뢰도 평가
 * - 복합 전략 조합
 * - 실시간 신호 생성
 *
 * 📊 지원 전략:
 * - 이동평균선 돌파/교차 전략
 * - 모멘텀 지표 기반 전략
 * - 볼린저밴드 및 변동성 전략
 * - 거래량 확인 전략
 * - 복합 확인 전략
 */
@Injectable()
export class StrategyExecutionService {
  // 기본 전략 설정값들
  private readonly DEFAULT_CONFIGS = {
    RSI_PERIOD: 14,
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD: 2,
    VOLUME_PERIOD: 20,
    VOLUME_SURGE: 2.0,
  };
  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly indicatorService: TechnicalIndicatorService,
  ) {}

  /**
   * 단일 전략 실행
   *
   * @param strategy 실행할 전략 타입
   * @param symbol 분석 대상 심볼
   * @param timeframe 분석 시간봉
   * @param config 전략별 설정 (선택사항)
   * @returns 전략 실행 결과
   */
  async executeStrategy(
    strategy: StrategyType,
    symbol: string,
    timeframe: TimeFrame,
    config?: Partial<StrategyConfig>,
  ): Promise<StrategyResult> {
    try {
      console.log(`🔄 전략 실행 시작: ${strategy} - ${symbol} ${timeframe}`); // 필요한 캔들 데이터 조회 (충분한 양 확보)
      const candles = await this.candleRepository.findLatestCandles(
        symbol,
        'FUTURES',
        500,
      );

      // 전략별 실행
      const result = await this.executeSpecificStrategy(
        strategy,
        symbol,
        timeframe,
        candles,
        config,
      );

      console.log(
        `✅ 전략 실행 완료: ${strategy} - 신호: ${result.signal} (신뢰도: ${result.confidence}%)`,
      );
      return result;
    } catch (error) {
      console.error(
        `❌ 전략 실행 실패: ${strategy} - ${symbol} ${timeframe}`,
        error,
      );

      // 실패 시 중립 신호 반환
      return {
        strategy,
        symbol,
        timeframe,
        signal: SignalType.NEUTRAL,
        confidence: 0,
        timestamp: Date.now(),
        details: {
          indicators: {},
          conditions: [`전략 실행 실패: ${error.message}`],
          notes: '데이터 부족 또는 계산 오류',
        },
      };
    }
  }

  /**
   * 다중 전략 종합 분석
   *
   * @param strategies 실행할 전략들
   * @param symbol 분석 대상 심볼
   * @param timeframes 분석할 시간봉들
   * @returns 다중 전략 종합 결과
   */
  async executeMultipleStrategies(
    strategies: StrategyType[],
    symbol: string,
    timeframes: TimeFrame[],
  ): Promise<MultiStrategyResult> {
    console.log(
      `🔄 다중 전략 분석 시작: ${symbol} - ${strategies.length}개 전략, ${timeframes.length}개 시간봉`,
    );

    const allResults: StrategyResult[] = [];

    // 모든 전략을 모든 시간봉에서 실행
    for (const timeframe of timeframes) {
      for (const strategy of strategies) {
        try {
          const result = await this.executeStrategy(
            strategy,
            symbol,
            timeframe,
          );
          allResults.push(result);
        } catch (error) {
          console.warn(
            `⚠️ 전략 실행 스킵: ${strategy} ${timeframe} - ${error.message}`,
          );
        }
      }
    }

    // 종합 분석
    const overallAnalysis = this.analyzeMultipleResults(allResults);

    console.log(
      `✅ 다중 전략 분석 완료: ${symbol} - 종합 신호: ${overallAnalysis.overallSignal} (신뢰도: ${overallAnalysis.overallConfidence}%)`,
    );

    return {
      symbol,
      timestamp: Date.now(),
      strategies: allResults,
      ...overallAnalysis,
    };
  }

  /**
   * 특정 전략 실행 (private)
   */
  private async executeSpecificStrategy(
    strategy: StrategyType,
    symbol: string,
    timeframe: string,
    candles: CandleData[],
    config?: Partial<StrategyConfig>,
  ): Promise<StrategyResult> {
    const baseResult = {
      strategy,
      symbol,
      timeframe,
      timestamp: Date.now(),
    };

    switch (strategy) {
      // 이동평균선 돌파 전략들
      case StrategyType.MA_20_BREAKOUT:
        return this.executeMaBreakoutStrategy(candles, 20, baseResult);
      case StrategyType.MA_50_BREAKOUT:
        return this.executeMaBreakoutStrategy(candles, 50, baseResult);
      case StrategyType.MA_100_BREAKOUT:
        return this.executeMaBreakoutStrategy(candles, 100, baseResult);
      case StrategyType.MA_150_BREAKOUT:
        return this.executeMaBreakoutStrategy(candles, 150, baseResult);
      case StrategyType.MA_200_BREAKOUT:
        return this.executeMaBreakoutStrategy(candles, 200, baseResult);

      // 골든크로스 전략들
      case StrategyType.GOLDEN_CROSS_5_20:
        return this.executeGoldenCrossStrategy(candles, 5, 20, baseResult);
      case StrategyType.GOLDEN_CROSS_20_60:
        return this.executeGoldenCrossStrategy(candles, 20, 60, baseResult);
      case StrategyType.GOLDEN_CROSS_50_200:
        return this.executeGoldenCrossStrategy(candles, 50, 200, baseResult);

      // RSI 전략들
      case StrategyType.RSI_OVERSOLD_BOUNCE:
        return this.executeRsiOversoldStrategy(candles, baseResult);
      case StrategyType.RSI_MOMENTUM_70:
        return this.executeRsiMomentumStrategy(candles, baseResult);

      // MACD 전략들
      case StrategyType.MACD_GOLDEN_CROSS:
        return this.executeMacdGoldenCrossStrategy(candles, baseResult);
      case StrategyType.MACD_ZERO_CROSS:
        return this.executeMacdZeroCrossStrategy(candles, baseResult);

      // 볼린저밴드 전략들
      case StrategyType.BOLLINGER_UPPER_BREAK:
        return this.executeBollingerUpperBreakStrategy(candles, baseResult);
      case StrategyType.BOLLINGER_LOWER_BOUNCE:
        return this.executeBollingerLowerBounceStrategy(candles, baseResult);

      // 거래량 전략들
      case StrategyType.VOLUME_SURGE_UP:
        return this.executeVolumeSurgeStrategy(candles, baseResult);

      // 복합 전략들
      case StrategyType.TRIPLE_CONFIRMATION:
        return this.executeTripleConfirmationStrategy(candles, baseResult);

      default:
        throw new Error(`지원되지 않는 전략입니다: ${strategy}`);
    }
  }

  /**
   * 이동평균선 돌파 전략 실행
   */
  private executeMaBreakoutStrategy(
    candles: CandleData[],
    period: number,
    baseResult: any,
  ): StrategyResult {
    const sma = this.indicatorService.calculateSMA(candles, period);
    const currentPrice = candles[candles.length - 1].close;
    const currentMA = sma[sma.length - 1].value;
    const previousMA = sma[sma.length - 2]?.value;
    const previousPrice = candles[candles.length - 2].close;

    // 돌파 조건 확인
    const isPriceAboveMA = currentPrice > currentMA;
    const wasPriceBelowMA = previousPrice <= previousMA;
    const isBreakout = isPriceAboveMA && wasPriceBelowMA;

    // 추가 확인 조건들
    const breakoutStrength = ((currentPrice - currentMA) / currentMA) * 100;
    const maSlope = ((currentMA - previousMA) / previousMA) * 100;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (isBreakout) {
      signal = SignalType.BUY;
      confidence = Math.min(60 + Math.abs(breakoutStrength) * 10, 90);
      conditions.push(`${period}일선 상향 돌파 확인`);

      if (maSlope > 0) {
        confidence += 10;
        conditions.push('이동평균선 상승 기울기 확인');
      }
    } else if (isPriceAboveMA) {
      signal = SignalType.WEAK_BUY;
      confidence = Math.min(30 + Math.abs(breakoutStrength) * 5, 50);
      conditions.push(`${period}일선 위 위치 유지`);
    } else {
      signal = SignalType.WEAK_SELL;
      confidence = Math.min(20 + Math.abs(breakoutStrength) * 5, 40);
      conditions.push(`${period}일선 아래 위치`);
    }

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          currentPrice,
          currentMA,
          breakoutStrength,
          maSlope,
        },
        conditions,
        notes: `${period}일선 돌파 전략`,
      },
      entryPrice: isBreakout ? currentPrice : undefined,
      stopLoss: isBreakout ? currentMA * 0.98 : undefined,
    };
  }

  /**
   * 골든크로스 전략 실행
   */
  private executeGoldenCrossStrategy(
    candles: CandleData[],
    fastPeriod: number,
    slowPeriod: number,
    baseResult: any,
  ): StrategyResult {
    const fastMA = this.indicatorService.calculateSMA(candles, fastPeriod);
    const slowMA = this.indicatorService.calculateSMA(candles, slowPeriod);

    const currentFast = fastMA[fastMA.length - 1].value;
    const currentSlow = slowMA[slowMA.length - 1].value;
    const previousFast = fastMA[fastMA.length - 2]?.value;
    const previousSlow = slowMA[slowMA.length - 2]?.value;

    // 골든크로스 조건 확인
    const isCurrentCross = currentFast > currentSlow;
    const wasPreviousCross = previousFast <= previousSlow;
    const isGoldenCross = isCurrentCross && wasPreviousCross;

    // 크로스 강도 계산
    const crossGap = ((currentFast - currentSlow) / currentSlow) * 100;
    const fastSlope = ((currentFast - previousFast) / previousFast) * 100;
    const slowSlope = ((currentSlow - previousSlow) / previousSlow) * 100;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (isGoldenCross) {
      signal = SignalType.STRONG_BUY;
      confidence = Math.min(70 + Math.abs(crossGap) * 20, 95);
      conditions.push(
        `${fastPeriod}일선이 ${slowPeriod}일선 상향 돌파 (골든크로스)`,
      );

      if (fastSlope > 0 && slowSlope > 0) {
        confidence += 10;
        conditions.push('두 이동평균선 모두 상승 기울기');
      }
    } else if (isCurrentCross) {
      signal = SignalType.BUY;
      confidence = Math.min(40 + Math.abs(crossGap) * 10, 70);
      conditions.push(`${fastPeriod}일선이 ${slowPeriod}일선 위 위치 유지`);
    } else {
      signal = SignalType.WEAK_SELL;
      confidence = Math.min(30 + Math.abs(crossGap) * 5, 50);
      conditions.push(`${fastPeriod}일선이 ${slowPeriod}일선 아래 위치`);
    }

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          fastMA: currentFast,
          slowMA: currentSlow,
          crossGap,
          fastSlope,
          slowSlope,
        },
        conditions,
        notes: `${fastPeriod}일선 × ${slowPeriod}일선 골든크로스 전략`,
      },
    };
  }

  /**
   * RSI 과매도 반등 전략 실행
   */
  private executeRsiOversoldStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const rsi = this.indicatorService.calculateRSI(
      candles,
      this.DEFAULT_CONFIGS.RSI_PERIOD,
    );
    const currentRSI = rsi[rsi.length - 1];
    const previousRSI = rsi[rsi.length - 2];

    // 과매도 반등 조건
    const isCurrentOversold =
      currentRSI.value <= this.DEFAULT_CONFIGS.RSI_OVERSOLD;
    const wasMoreOversold = previousRSI?.value < currentRSI.value;
    const isRsiBouncing = isCurrentOversold && wasMoreOversold;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (isRsiBouncing) {
      signal = SignalType.BUY;
      confidence = Math.min(60 + (30 - currentRSI.value) * 2, 85);
      conditions.push('RSI 과매도 구간에서 반등 시작');
      conditions.push(
        `RSI: ${currentRSI.value.toFixed(2)} (이전: ${previousRSI?.value.toFixed(2)})`,
      );
    } else if (currentRSI.isOversold) {
      signal = SignalType.WEAK_BUY;
      confidence = Math.min(40 + (30 - currentRSI.value), 60);
      conditions.push('RSI 과매도 구간 진입');
    } else if (currentRSI.isOverbought) {
      signal = SignalType.WEAK_SELL;
      confidence = Math.min(40 + (currentRSI.value - 70), 60);
      conditions.push('RSI 과매수 구간');
    }

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          currentRSI: currentRSI.value,
          previousRSI: previousRSI?.value,
          isOversold: currentRSI.isOversold,
          isOverbought: currentRSI.isOverbought,
        },
        conditions,
        notes: 'RSI 과매도 반등 전략',
      },
    };
  }

  /**
   * MACD 골든크로스 전략 실행
   */
  private executeMacdGoldenCrossStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const macd = this.indicatorService.calculateMACD(candles);
    const current = macd[macd.length - 1];
    const previous = macd[macd.length - 2];

    // MACD 골든크로스 조건
    const isCurrentGolden = current.isGoldenCross;
    const wasPreviousDead = previous && !previous.isGoldenCross;
    const isMacdGoldenCross = isCurrentGolden && wasPreviousDead;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (isMacdGoldenCross) {
      signal = SignalType.BUY;
      confidence = Math.min(65 + Math.abs(current.histogram) * 100, 90);
      conditions.push('MACD 골든크로스 발생');
      conditions.push(`히스토그램: ${current.histogram.toFixed(4)}`);

      if (current.macdLine > 0) {
        confidence += 10;
        conditions.push('MACD 라인이 0선 위에서 골든크로스');
      }
    } else if (isCurrentGolden) {
      signal = SignalType.WEAK_BUY;
      confidence = Math.min(40 + Math.abs(current.histogram) * 50, 70);
      conditions.push('MACD 골든크로스 상태 유지');
    } else {
      signal = SignalType.WEAK_SELL;
      confidence = Math.min(30 + Math.abs(current.histogram) * 30, 50);
      conditions.push('MACD 데드크로스 상태');
    }

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          macdLine: current.macdLine,
          signalLine: current.signalLine,
          histogram: current.histogram,
          isGoldenCross: current.isGoldenCross,
        },
        conditions,
        notes: 'MACD 골든크로스 전략',
      },
    };
  }

  /**
   * 볼린저 상단 돌파 전략 실행
   */
  private executeBollingerUpperBreakStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const bb = this.indicatorService.calculateBollingerBands(candles);
    const current = bb[bb.length - 1];
    const currentPrice = candles[candles.length - 1].close;
    const previousPrice = candles[candles.length - 2].close;
    const previous = bb[bb.length - 2];

    // 상단 밴드 돌파 조건
    const isAboveUpper = currentPrice > current.upper;
    const wasInsideBand = previousPrice <= previous?.upper;
    const isUpperBreakout = isAboveUpper && wasInsideBand;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (isUpperBreakout) {
      signal = SignalType.BUY;
      const breakoutStrength =
        ((currentPrice - current.upper) / current.upper) * 100;
      confidence = Math.min(60 + breakoutStrength * 20, 85);
      conditions.push('볼린저 상단 밴드 돌파');
      conditions.push(`돌파 강도: ${breakoutStrength.toFixed(2)}%`);

      if (current.bandwidth < 0.1) {
        confidence += 15;
        conditions.push('밴드 수축 후 돌파 (스퀴즈 브레이크아웃)');
      }
    } else if (isAboveUpper) {
      signal = SignalType.WEAK_BUY;
      confidence = 50;
      conditions.push('볼린저 상단 밴드 위 위치 유지');
    } else if (current.percentB > 0.8) {
      signal = SignalType.WEAK_BUY;
      confidence = 40;
      conditions.push('볼린저 밴드 상단 근접');
    }

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          currentPrice,
          upperBand: current.upper,
          percentB: current.percentB,
          bandwidth: current.bandwidth,
        },
        conditions,
        notes: '볼린저 상단 돌파 전략',
      },
    };
  }

  /**
   * 거래량 급증 + 상승 전략 실행
   */
  private executeVolumeSurgeStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const volume = this.indicatorService.calculateVolumeAnalysis(candles);
    const current = volume[volume.length - 1];
    const currentPrice = candles[candles.length - 1].close;
    const previousPrice = candles[candles.length - 2].close;

    // 거래량 급증 + 상승 조건
    const isPriceUp = currentPrice > previousPrice;
    const isVolumeSurge = current.isVolumeSurge;
    const isConfirmedSignal = isPriceUp && isVolumeSurge;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (isConfirmedSignal) {
      signal = SignalType.BUY;
      confidence = Math.min(65 + (current.volumeRatio - 2) * 10, 90);
      conditions.push('거래량 급증과 함께 가격 상승');
      conditions.push(`거래량 비율: ${current.volumeRatio.toFixed(2)}배`);

      if (current.obv > 0) {
        confidence += 10;
        conditions.push('OBV 상승세 확인');
      }
    } else if (isVolumeSurge && !isPriceUp) {
      signal = SignalType.WEAK_SELL;
      confidence = 40;
      conditions.push('거래량 급증하지만 가격 하락');
    } else if (isPriceUp && current.volumeRatio > 1.5) {
      signal = SignalType.WEAK_BUY;
      confidence = 45;
      conditions.push('가격 상승 + 거래량 증가');
    }

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          volumeRatio: current.volumeRatio,
          isVolumeSurge: current.isVolumeSurge,
          obv: current.obv,
          priceChange: ((currentPrice - previousPrice) / previousPrice) * 100,
        },
        conditions,
        notes: '거래량 급증 + 상승 전략',
      },
    };
  }

  /**
   * 3중 확인 전략 (MA + RSI + Volume)
   */
  private executeTripleConfirmationStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    // 개별 전략 결과들을 가져와서 종합 판단
    const maResult = this.executeMaBreakoutStrategy(candles, 20, {
      ...baseResult,
    });
    const rsiResult = this.executeRsiOversoldStrategy(candles, {
      ...baseResult,
    });
    const volumeResult = this.executeVolumeSurgeStrategy(candles, {
      ...baseResult,
    });

    // 신호 점수 계산
    const signalScores = {
      [SignalType.STRONG_BUY]: 3,
      [SignalType.BUY]: 2,
      [SignalType.WEAK_BUY]: 1,
      [SignalType.NEUTRAL]: 0,
      [SignalType.WEAK_SELL]: -1,
      [SignalType.SELL]: -2,
      [SignalType.STRONG_SELL]: -3,
    };

    const totalScore =
      signalScores[maResult.signal] +
      signalScores[rsiResult.signal] +
      signalScores[volumeResult.signal];

    const avgConfidence =
      (maResult.confidence + rsiResult.confidence + volumeResult.confidence) /
      3;

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    if (totalScore >= 4) {
      signal = SignalType.STRONG_BUY;
      confidence = Math.min(avgConfidence + 20, 95);
      conditions.push('3중 확인 강한 매수 신호');
    } else if (totalScore >= 2) {
      signal = SignalType.BUY;
      confidence = Math.min(avgConfidence + 10, 85);
      conditions.push('3중 확인 매수 신호');
    } else if (totalScore >= 1) {
      signal = SignalType.WEAK_BUY;
      confidence = Math.min(avgConfidence, 70);
      conditions.push('부분적 매수 신호');
    } else if (totalScore <= -2) {
      signal = SignalType.SELL;
      confidence = Math.min(avgConfidence + 10, 85);
      conditions.push('3중 확인 매도 신호');
    }

    // 개별 전략 결과 추가
    conditions.push(`MA 신호: ${maResult.signal}`);
    conditions.push(`RSI 신호: ${rsiResult.signal}`);
    conditions.push(`Volume 신호: ${volumeResult.signal}`);

    return {
      ...baseResult,
      signal,
      confidence: Math.round(confidence),
      details: {
        indicators: {
          totalScore,
          maConfidence: maResult.confidence,
          rsiConfidence: rsiResult.confidence,
          volumeConfidence: volumeResult.confidence,
        },
        conditions,
        notes: '3중 확인 전략 (MA + RSI + Volume)',
      },
    };
  }

  /**
   * 다중 전략 결과 종합 분석 (private)
   */
  private analyzeMultipleResults(
    results: StrategyResult[],
  ): Omit<MultiStrategyResult, 'symbol' | 'timestamp' | 'strategies'> {
    if (results.length === 0) {
      return {
        overallSignal: SignalType.NEUTRAL,
        overallConfidence: 0,
        consensus: 0,
        timeframeSummary: {},
      };
    }

    // 신호별 가중치 계산
    const signalWeights = {
      [SignalType.STRONG_BUY]: 3,
      [SignalType.BUY]: 2,
      [SignalType.WEAK_BUY]: 1,
      [SignalType.NEUTRAL]: 0,
      [SignalType.WEAK_SELL]: -1,
      [SignalType.SELL]: -2,
      [SignalType.STRONG_SELL]: -3,
    };

    // 가중 평균 점수 계산
    let totalWeightedScore = 0;
    let totalConfidence = 0;

    for (const result of results) {
      const weight = result.confidence / 100;
      totalWeightedScore += signalWeights[result.signal] * weight;
      totalConfidence += result.confidence;
    }

    const avgScore = totalWeightedScore / results.length;
    const avgConfidence = totalConfidence / results.length;

    // 종합 신호 결정
    let overallSignal = SignalType.NEUTRAL;
    if (avgScore >= 2) overallSignal = SignalType.STRONG_BUY;
    else if (avgScore >= 1) overallSignal = SignalType.BUY;
    else if (avgScore >= 0.5) overallSignal = SignalType.WEAK_BUY;
    else if (avgScore <= -2) overallSignal = SignalType.STRONG_SELL;
    else if (avgScore <= -1) overallSignal = SignalType.SELL;
    else if (avgScore <= -0.5) overallSignal = SignalType.WEAK_SELL;

    // 합의도 계산 (같은 방향 신호 비율)
    const positiveSignals = results.filter(
      (r) => signalWeights[r.signal] > 0,
    ).length;
    const negativeSignals = results.filter(
      (r) => signalWeights[r.signal] < 0,
    ).length;
    const consensus =
      Math.max(positiveSignals, negativeSignals) / results.length;

    // 시간봉별 요약
    const timeframeSummary: any = {};
    const timeframes = [...new Set(results.map((r) => r.timeframe))];

    for (const timeframe of timeframes) {
      const tfResults = results.filter((r) => r.timeframe === timeframe);
      const tfAvgScore =
        tfResults.reduce((sum, r) => sum + signalWeights[r.signal], 0) /
        tfResults.length;
      const tfAvgConfidence =
        tfResults.reduce((sum, r) => sum + r.confidence, 0) / tfResults.length;

      let tfSignal = SignalType.NEUTRAL;
      if (tfAvgScore >= 1) tfSignal = SignalType.BUY;
      else if (tfAvgScore >= 0.5) tfSignal = SignalType.WEAK_BUY;
      else if (tfAvgScore <= -1) tfSignal = SignalType.SELL;
      else if (tfAvgScore <= -0.5) tfSignal = SignalType.WEAK_SELL;

      timeframeSummary[timeframe] = {
        signal: tfSignal,
        confidence: Math.round(tfAvgConfidence),
        strategyCount: tfResults.length,
      };
    }

    return {
      overallSignal,
      overallConfidence: Math.round(avgConfidence),
      consensus: Math.round(consensus * 100) / 100,
      timeframeSummary,
    };
  }

  // 다른 전략들도 필요에 따라 추가 구현...
  private executeRsiMomentumStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    // RSI 70 돌파 모멘텀 전략 구현
    return {
      ...baseResult,
      signal: SignalType.NEUTRAL,
      confidence: 0,
      details: { indicators: {}, conditions: ['구현 예정'] },
    };
  }

  private executeMacdZeroCrossStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    // MACD 0선 돌파 전략 구현
    return {
      ...baseResult,
      signal: SignalType.NEUTRAL,
      confidence: 0,
      details: { indicators: {}, conditions: ['구현 예정'] },
    };
  }

  private executeBollingerLowerBounceStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    // 볼린저 하단 반등 전략 구현
    return {
      ...baseResult,
      signal: SignalType.NEUTRAL,
      confidence: 0,
      details: { indicators: {}, conditions: ['구현 예정'] },
    };
  }
}
