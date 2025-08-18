import { Injectable } from '@nestjs/common';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
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

      console.log(`✅ 전략 실행 완료: ${strategy} - 신호: ${result.signal}`);
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
      `✅ 다중 전략 분석 완료: ${symbol} - 종합 신호: ${overallAnalysis.overallSignal}`,
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
    const maSlope = ((currentMA - previousMA) / previousMA) * 100;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (isBreakout) {
      signal = SignalType.BUY;
      conditions.push(`${period}일선 상향 돌파 확인`);

      if (maSlope > 0) {
        conditions.push('이동평균선 상승 기울기 확인');
      }
    } else if (isPriceAboveMA) {
      signal = SignalType.WEAK_BUY;
      conditions.push(`${period}일선 위 위치 유지`);
    } else {
      signal = SignalType.WEAK_SELL;
      conditions.push(`${period}일선 아래 위치`);
    }

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          currentPrice,
          currentMA,
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
    const conditions: string[] = [];

    if (isGoldenCross) {
      signal = SignalType.STRONG_BUY;
      conditions.push(
        `${fastPeriod}일선이 ${slowPeriod}일선 상향 돌파 (골든크로스)`,
      );

      if (fastSlope > 0 && slowSlope > 0) {
        conditions.push('두 이동평균선 모두 상승 기울기');
      }
    } else if (isCurrentCross) {
      signal = SignalType.BUY;
      conditions.push(`${fastPeriod}일선이 ${slowPeriod}일선 위 위치 유지`);
    } else {
      signal = SignalType.WEAK_SELL;
      conditions.push(`${fastPeriod}일선이 ${slowPeriod}일선 아래 위치`);
    }

    return {
      ...baseResult,
      signal,
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
    const conditions: string[] = [];

    if (isRsiBouncing) {
      signal = SignalType.BUY;
      conditions.push('RSI 과매도 구간에서 반등 시작');
      conditions.push(
        `RSI: ${currentRSI.value.toFixed(2)} (이전: ${previousRSI?.value.toFixed(2)})`,
      );
    } else if (currentRSI.isOversold) {
      signal = SignalType.WEAK_BUY;
      conditions.push('RSI 과매도 구간 진입');
    } else if (currentRSI.isOverbought) {
      signal = SignalType.WEAK_SELL;
      conditions.push('RSI 과매수 구간');
    }

    return {
      ...baseResult,
      signal,
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
    const conditions: string[] = [];

    if (isMacdGoldenCross) {
      signal = SignalType.BUY;
      conditions.push('MACD 골든크로스 발생');
      conditions.push(`히스토그램: ${current.histogram.toFixed(4)}`);

      if (current.macdLine > 0) {
        conditions.push('MACD 라인이 0선 위에서 골든크로스');
      }
    } else if (isCurrentGolden) {
      signal = SignalType.WEAK_BUY;
      conditions.push('MACD 골든크로스 상태 유지');
    } else {
      signal = SignalType.WEAK_SELL;
      conditions.push('MACD 데드크로스 상태');
    }

    return {
      ...baseResult,
      signal,
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
    const conditions: string[] = [];

    if (isUpperBreakout) {
      signal = SignalType.BUY;
      conditions.push('볼린저 상단 밴드 돌파');

      if (current.bandwidth < 0.1) {
        conditions.push('밴드 수축 후 돌파 (스퀴즈 브레이크아웃)');
      }
    } else if (isAboveUpper) {
      signal = SignalType.WEAK_BUY;
      conditions.push('볼린저 상단 밴드 위 위치 유지');
    } else if (current.percentB > 0.8) {
      signal = SignalType.WEAK_BUY;
      conditions.push('볼린저 밴드 상단 근접');
    }

    return {
      ...baseResult,
      signal,
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
    const conditions: string[] = [];

    if (isConfirmedSignal) {
      signal = SignalType.BUY;
      conditions.push('거래량 급증과 함께 가격 상승');
      conditions.push(`거래량 비율: ${current.volumeRatio.toFixed(2)}배`);

      if (current.obv > 0) {
        conditions.push('OBV 상승세 확인');
      }
    } else if (isVolumeSurge && !isPriceUp) {
      signal = SignalType.WEAK_SELL;
      conditions.push('거래량 급증하지만 가격 하락');
    } else if (isPriceUp && current.volumeRatio > 1.5) {
      signal = SignalType.WEAK_BUY;
      conditions.push('가격 상승 + 거래량 증가');
    }

    return {
      ...baseResult,
      signal,
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

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (totalScore >= 4) {
      signal = SignalType.STRONG_BUY;
      conditions.push('3중 확인 강한 매수 신호');
    } else if (totalScore >= 2) {
      signal = SignalType.BUY;
      conditions.push('3중 확인 매수 신호');
    } else if (totalScore >= 1) {
      signal = SignalType.WEAK_BUY;
      conditions.push('부분적 매수 신호');
    } else if (totalScore <= -2) {
      signal = SignalType.SELL;
      conditions.push('3중 확인 매도 신호');
    }

    // 개별 전략 결과 추가
    conditions.push(`MA 신호: ${maResult.signal}`);
    conditions.push(`RSI 신호: ${rsiResult.signal}`);
    conditions.push(`Volume 신호: ${volumeResult.signal}`);

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          totalScore,
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
    for (const result of results) {
      const weight = 1; // 신뢰도 대신 동일 가중치 사용
      totalWeightedScore += signalWeights[result.signal] * weight;
    }

    const avgScore = totalWeightedScore / results.length;

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
    const uniqueTimeframes = new Set(results.map((r) => r.timeframe));
    const timeframes = Array.from(uniqueTimeframes);

    for (const timeframe of timeframes) {
      const tfResults = results.filter((r) => r.timeframe === timeframe);
      const tfAvgScore =
        tfResults.reduce((sum, r) => sum + signalWeights[r.signal], 0) /
        tfResults.length;

      let tfSignal = SignalType.NEUTRAL;
      if (tfAvgScore >= 1) tfSignal = SignalType.BUY;
      else if (tfAvgScore >= 0.5) tfSignal = SignalType.WEAK_BUY;
      else if (tfAvgScore <= -1) tfSignal = SignalType.SELL;
      else if (tfAvgScore <= -0.5) tfSignal = SignalType.WEAK_SELL;

      timeframeSummary[timeframe] = {
        signal: tfSignal,

        strategyCount: tfResults.length,
      };
    }

    return {
      overallSignal,

      consensus: Math.round(consensus * 100) / 100,
      timeframeSummary,
    };
  }

  /**
   * RSI 70 돌파 모멘텀 전략 실행
   */
  private executeRsiMomentumStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const rsi = this.indicatorService.calculateRSI(
      candles,
      this.DEFAULT_CONFIGS.RSI_PERIOD,
    );
    const currentRSI = rsi[rsi.length - 1];
    const previousRSI = rsi[rsi.length - 2];
    const volume = this.indicatorService.calculateVolumeAnalysis(candles);
    const currentVolume = volume[volume.length - 1];

    // RSI 70 돌파 모멘텀 조건
    const isRsiBreakout = currentRSI.value > 70 && previousRSI?.value <= 70;
    const isStrongMomentum = currentRSI.value > 75;
    const isVolumeConfirmed = currentVolume.volumeRatio > 1.5;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (isRsiBreakout && isVolumeConfirmed) {
      signal = SignalType.BUY;
      conditions.push('RSI 70선 상향 돌파 (강한 모멘텀)');
      conditions.push(
        `RSI: ${currentRSI.value.toFixed(2)} (이전: ${previousRSI?.value.toFixed(2)})`,
      );
      conditions.push('거래량 증가로 모멘텀 확인');

      if (isStrongMomentum) {
        conditions.push('RSI 75 이상 - 매우 강한 모멘텀');
      }
    } else if (isStrongMomentum && !isVolumeConfirmed) {
      signal = SignalType.WEAK_BUY;
      conditions.push('RSI 강세이지만 거래량 부족');
    } else if (currentRSI.value > 85) {
      signal = SignalType.WEAK_SELL;
      conditions.push('RSI 극도 과매수 (85 이상)');
    }

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          currentRSI: currentRSI.value,
          previousRSI: previousRSI?.value,
          volumeRatio: currentVolume.volumeRatio,
          isBreakout: isRsiBreakout,
        },
        conditions,
        notes: 'RSI 70 돌파 모멘텀 전략',
      },
    };
  }

  /**
   * MACD 0선 돌파 전략 실행
   */
  private executeMacdZeroCrossStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const macd = this.indicatorService.calculateMACD(candles);
    const current = macd[macd.length - 1];
    const previous = macd[macd.length - 2];
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const currentPrice = candles[candles.length - 1].close;
    const currentSMA20 = sma20[sma20.length - 1]?.value;

    // MACD 0선 돌파 조건
    const isZeroCrossUp = current.macdLine > 0 && previous?.macdLine <= 0;
    const isZeroCrossDown = current.macdLine < 0 && previous?.macdLine >= 0;
    const isAboveSMA20 = currentPrice > currentSMA20;
    const histogramStrength = Math.abs(current.histogram);

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (isZeroCrossUp) {
      signal = SignalType.BUY;
      conditions.push('MACD 0선 상향 돌파');
      conditions.push(`MACD 라인: ${current.macdLine.toFixed(4)}`);

      if (isAboveSMA20) {
        conditions.push('가격이 SMA20 위에서 돌파 (추가 확인)');
      }

      if (current.isGoldenCross) {
        conditions.push('MACD 골든크로스도 함께 발생');
      }
    } else if (isZeroCrossDown) {
      signal = SignalType.SELL;
      conditions.push('MACD 0선 하향 돌파');
      conditions.push(`MACD 라인: ${current.macdLine.toFixed(4)}`);
    } else if (current.macdLine > 0 && current.isGoldenCross) {
      signal = SignalType.WEAK_BUY;
      conditions.push('MACD 0선 위에서 골든크로스 유지');
    } else if (current.macdLine < 0 && !current.isGoldenCross) {
      signal = SignalType.WEAK_SELL;
      conditions.push('MACD 0선 아래에서 데드크로스 유지');
    }

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          macdLine: current.macdLine,
          signalLine: current.signalLine,
          histogram: current.histogram,
          isZeroCrossUp,
          isZeroCrossDown,
        },
        conditions,
        notes: 'MACD 0선 돌파 전략',
      },
    };
  }

  /**
   * 볼린저 하단 반등 전략 실행
   */
  private executeBollingerLowerBounceStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const bb = this.indicatorService.calculateBollingerBands(candles);
    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const current = bb[bb.length - 1];
    const previous = bb[bb.length - 2];
    const currentPrice = candles[candles.length - 1].close;
    const previousPrice = candles[candles.length - 2].close;
    const currentRSI = rsi[rsi.length - 1];

    // 볼린저 하단 반등 조건
    const isTouchingLower = currentPrice <= current.lower * 1.01; // 하단 1% 이내
    const wasBelowLower = previousPrice < previous?.lower;
    const isBouncing = currentPrice > previousPrice;
    const isRSIOversold = currentRSI.value < 35;
    const bandwidthNormal = current.bandwidth > 0.02; // 밴드가 너무 좁지 않음

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (isTouchingLower && isBouncing && isRSIOversold && bandwidthNormal) {
      signal = SignalType.BUY;
      conditions.push('볼린저 하단 터치 후 반등 시작');
      conditions.push(
        `%B: ${(current.percentB * 100).toFixed(1)}% (하단 근처)`,
      );
      conditions.push(`RSI: ${currentRSI.value.toFixed(1)} (과매도)`);
      conditions.push('가격 반등 확인');

      if (current.bandwidth < 0.05) {
        conditions.push('밴드 수축 상태 - 변동성 확대 예상');
      }
    } else if (isTouchingLower && !isBouncing) {
      signal = SignalType.WEAK_BUY;
      conditions.push('볼린저 하단 근처 - 반등 대기');
    } else if (wasBelowLower && currentPrice > current.lower) {
      signal = SignalType.WEAK_BUY;
      conditions.push('볼린저 하단 이탈 - 반등 시작 가능성');
    } else if (current.percentB < 0.1 && !isRSIOversold) {
      signal = SignalType.NEUTRAL;
      conditions.push('하단 근처이지만 RSI 과매도 아님');
    }

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          currentPrice,
          lowerBand: current.lower,
          percentB: current.percentB,
          bandwidth: current.bandwidth,
          rsi: currentRSI.value,
          isBouncing,
        },
        conditions,
        notes: '볼린저 하단 반등 전략',
      },
      entryPrice: signal === SignalType.BUY ? currentPrice : undefined,
      stopLoss: signal === SignalType.BUY ? current.lower * 0.99 : undefined,
      takeProfit: signal === SignalType.BUY ? current.middle : undefined,
    };
  }

  /**
   * RSI 다이버전스 전략 실행
   */
  private executeRsiDivergenceStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const recentCandles = candles.slice(-20); // 최근 20개 캔들
    const recentRSI = rsi.slice(-20);

    // 가격과 RSI의 고점/저점 찾기
    const priceHighs = this.findPeaks(recentCandles.map((c) => c.high));
    const priceLows = this.findTroughs(recentCandles.map((c) => c.low));
    const rsiHighs = this.findPeaks(recentRSI.map((r) => r.value));
    const rsiLows = this.findTroughs(recentRSI.map((r) => r.value));

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 강세 다이버전스 (가격 저점 하락, RSI 저점 상승)
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const latestPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      const latestRSILow = rsiLows[rsiLows.length - 1];
      const prevRSILow = rsiLows[rsiLows.length - 2];

      if (
        latestPriceLow.value < prevPriceLow.value &&
        latestRSILow.value > prevRSILow.value
      ) {
        signal = SignalType.BUY;
        conditions.push('강세 다이버전스 감지');
        conditions.push('가격 저점은 하락, RSI 저점은 상승');
        conditions.push('상승 반전 가능성 높음');
      }
    }

    // 약세 다이버전스 (가격 고점 상승, RSI 고점 하락)
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const latestPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const latestRSIHigh = rsiHighs[rsiHighs.length - 1];
      const prevRSIHigh = rsiHighs[rsiHighs.length - 2];

      if (
        latestPriceHigh.value > prevPriceHigh.value &&
        latestRSIHigh.value < prevRSIHigh.value
      ) {
        signal = SignalType.SELL;
        conditions.push('약세 다이버전스 감지');
        conditions.push('가격 고점은 상승, RSI 고점은 하락');
        conditions.push('하락 반전 가능성 높음');
      }
    }

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          currentRSI: rsi[rsi.length - 1].value,
          priceHighsCount: priceHighs.length,
          priceLowsCount: priceLows.length,
          rsiHighsCount: rsiHighs.length,
          rsiLowsCount: rsiLows.length,
        },
        conditions,
        notes: 'RSI 다이버전스 전략',
      },
    };
  }

  /**
   * MACD 히스토그램 전환 전략 실행
   */
  private executeMacdHistogramTurnStrategy(
    candles: CandleData[],
    baseResult: any,
  ): StrategyResult {
    const macd = this.indicatorService.calculateMACD(candles);
    const recent = macd.slice(-5); // 최근 5개 데이터

    if (recent.length < 3) {
      return {
        ...baseResult,
        signal: SignalType.NEUTRAL,
        details: { indicators: {}, conditions: ['데이터 부족'] },
      };
    }

    const current = recent[recent.length - 1];
    const previous = recent[recent.length - 2];
    const beforePrevious = recent[recent.length - 3];

    // 히스토그램 전환점 감지
    const isHistogramTurningUp =
      current.histogram > previous.histogram &&
      previous.histogram < beforePrevious.histogram;

    const isHistogramTurningDown =
      current.histogram < previous.histogram &&
      previous.histogram > beforePrevious.histogram;

    const histogramMomentum = Math.abs(current.histogram - previous.histogram);

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (isHistogramTurningUp && current.histogram < 0) {
      signal = SignalType.BUY;
      conditions.push('MACD 히스토그램 상승 전환');
      conditions.push('음수 구간에서 전환 (강한 신호)');
      conditions.push(`히스토그램: ${current.histogram.toFixed(4)}`);

      if (current.macdLine > current.signalLine) {
        conditions.push('MACD 라인이 시그널 라인 위에 위치');
      }
    } else if (isHistogramTurningDown && current.histogram > 0) {
      signal = SignalType.SELL;
      conditions.push('MACD 히스토그램 하락 전환');
      conditions.push('양수 구간에서 전환 (강한 신호)');
      conditions.push(`히스토그램: ${current.histogram.toFixed(4)}`);
    } else if (isHistogramTurningUp) {
      signal = SignalType.WEAK_BUY;
      conditions.push('MACD 히스토그램 상승 전환 (약한 신호)');
    } else if (isHistogramTurningDown) {
      signal = SignalType.WEAK_SELL;
      conditions.push('MACD 히스토그램 하락 전환 (약한 신호)');
    }

    return {
      ...baseResult,
      signal,
      details: {
        indicators: {
          currentHistogram: current.histogram,
          previousHistogram: previous.histogram,
          histogramMomentum,
          macdLine: current.macdLine,
          signalLine: current.signalLine,
        },
        conditions,
        notes: 'MACD 히스토그램 전환 전략',
      },
    };
  }

  // 헬퍼 메서드들
  private findPeaks(data: number[]): Array<{ index: number; value: number }> {
    const peaks: Array<{ index: number; value: number }> = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push({ index: i, value: data[i] });
      }
    }

    return peaks;
  }

  private findTroughs(data: number[]): Array<{ index: number; value: number }> {
    const troughs: Array<{ index: number; value: number }> = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        troughs.push({ index: i, value: data[i] });
      }
    }

    return troughs;
  }
}
