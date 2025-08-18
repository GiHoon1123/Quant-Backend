import { Injectable } from '@nestjs/common';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
import {
  SignalType,
  StrategyResult,
  StrategyType,
} from '../types/StrategyTypes';
import { TimeFrame } from '../types/TechnicalAnalysisTypes';
import { TechnicalIndicatorService } from './TechnicalIndicatorService';

/**
 * 기본 전략 서비스
 *
 * 단일 지표 기반의 기본적인 기술적 분석 전략들을 실행합니다.
 * 이동평균, RSI, MACD, 볼린저밴드 등 표준적인 지표들을 활용한 전략들을 제공합니다.
 *
 * 주요 특징:
 * - 단일 지표 기반 분석
 * - 빠른 실행 속도
 * - 높은 빈도의 신호 생성
 * - 표준적인 기술적 분석 기법
 */
@Injectable()
export class BasicStrategyService {
  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly indicatorService: TechnicalIndicatorService,
  ) {}

  /**
   * 이동평균 크로스오버 전략
   *
   * 빠른 이동평균선이 느린 이동평균선을 상향/하향 돌파할 때 발생하는 신호를 감지합니다.
   *
   * 계산 방법:
   * 1. SMA20과 SMA50 계산
   * 2. 이전 캔들에서 현재 캔들로의 크로스오버 감지
   * 3. 거래량 확인으로 신호 강화
   *
   * 핵심 아이디어:
   * - 골든크로스: SMA20 > SMA50 (상승 신호)
   * - 데드크로스: SMA20 < SMA50 (하락 신호)
   * - 거래량 증가 시 신호 강화
   */
  async executeMovingAverageCrossoverStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      100,
    );

    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const sma50 = this.indicatorService.calculateSMA(candles, 50);

    const currentSMA20 = sma20[sma20.length - 1]?.value;
    const currentSMA50 = sma50[sma50.length - 1]?.value;
    const prevSMA20 = sma20[sma20.length - 2]?.value;
    const prevSMA50 = sma50[sma50.length - 2]?.value;

    const currentVolume = candles[candles.length - 1].volume;
    const avgVolume =
      candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeRatio = currentVolume / avgVolume;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (prevSMA20 < prevSMA50 && currentSMA20 > currentSMA50) {
      signal = SignalType.STRONG_BUY;
      conditions.push('골든크로스 발생 - SMA20이 SMA50 상향 돌파');

      if (volumeRatio > 1.5) {
        conditions.push(
          `거래량 급증 확인 - 평균 대비 ${volumeRatio.toFixed(1)}배`,
        );
        signal = SignalType.STRONG_BUY;
      } else {
        conditions.push(`거래량 정상 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
      }
    } else if (prevSMA20 > prevSMA50 && currentSMA20 < currentSMA50) {
      signal = SignalType.STRONG_SELL;
      conditions.push('데드크로스 발생 - SMA20이 SMA50 하향 돌파');

      if (volumeRatio > 1.5) {
        conditions.push(
          `거래량 급증 확인 - 평균 대비 ${volumeRatio.toFixed(1)}배`,
        );
        signal = SignalType.STRONG_SELL;
      } else {
        conditions.push(`거래량 정상 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
      }
    } else {
      if (currentSMA20 > currentSMA50) {
        signal = SignalType.WEAK_BUY;
        conditions.push('상승 트렌드 유지 - SMA20 > SMA50');
      } else {
        signal = SignalType.WEAK_SELL;
        conditions.push('하락 트렌드 유지 - SMA20 < SMA50');
      }
    }

    return {
      strategy: StrategyType.MA_CROSSOVER,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          sma20: currentSMA20,
          sma50: currentSMA50,
          crossoverStrength:
            (Math.abs(currentSMA20 - currentSMA50) / currentSMA50) * 100,
          volumeRatio,
        },
        conditions,
        notes: '이동평균 크로스오버 전략 - 표준 20/50 크로스오버',
      },
    };
  }

  /**
   * 볼린저 밴드 반전 전략
   *
   * 가격이 볼린저 밴드 상단/하단에 터치한 후 반전될 때 발생하는 신호를 감지합니다.
   *
   * 계산 방법:
   * 1. 볼린저 밴드 계산 (20일, 2 표준편차)
   * 2. RSI 계산 (14일)
   * 3. 상단 터치 + RSI 과매수 = 하락 반전 신호
   * 4. 하단 터치 + RSI 과매도 = 상승 반전 신호
   *
   * 핵심 아이디어:
   * - 상단 터치 + RSI > 70 = 과매수 → 매도 신호
   * - 하단 터치 + RSI < 30 = 과매도 → 매수 신호
   * - 밴드폭 확인으로 변동성 측정
   */
  async executeBollingerBandsReversalStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      50,
    );

    const bb = this.indicatorService.calculateBollingerBands(candles, 20, 2);
    const rsi = this.indicatorService.calculateRSI(candles, 14);

    const currentBB = bb[bb.length - 1];
    const currentRSI = rsi[rsi.length - 1];
    const currentPrice = candles[candles.length - 1].close;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (currentPrice >= currentBB.upper && currentRSI.value > 70) {
      signal = SignalType.STRONG_SELL;
      conditions.push('볼린저 밴드 상단 터치');
      conditions.push(`RSI 과매수 확인: ${currentRSI.value.toFixed(1)}`);
      conditions.push('하락 반전 신호 - 과매수 구간에서 매도');
    } else if (currentPrice <= currentBB.lower && currentRSI.value < 30) {
      signal = SignalType.STRONG_BUY;
      conditions.push('볼린저 밴드 하단 터치');
      conditions.push(`RSI 과매도 확인: ${currentRSI.value.toFixed(1)}`);
      conditions.push('상승 반전 신호 - 과매도 구간에서 매수');
    } else {
      const bandPosition = currentBB.percentB;

      if (bandPosition > 0.8) {
        signal = SignalType.WEAK_SELL;
        conditions.push('밴드 상단 근접 - 매도 고려');
      } else if (bandPosition < 0.2) {
        signal = SignalType.WEAK_BUY;
        conditions.push('밴드 하단 근접 - 매수 고려');
      } else {
        conditions.push('밴드 중간 위치 - 중립');
      }
    }

    return {
      strategy: StrategyType.BOLLINGER_REVERSAL,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          upper: currentBB.upper,
          middle: currentBB.middle,
          lower: currentBB.lower,
          percentB: currentBB.percentB,
          rsi: currentRSI.value,
          bandwidth: currentBB.bandwidth,
        },
        conditions,
        notes: '볼린저 밴드 반전 전략 - 표준 20/2 설정',
      },
    };
  }

  /**
   * MACD 크로스오버 전략
   *
   * MACD 라인이 시그널 라인을 상향/하향 돌파할 때 발생하는 신호를 감지합니다.
   *
   * 계산 방법:
   * 1. MACD 계산 (12, 26, 9)
   * 2. 이전 캔들에서 현재 캔들로의 크로스오버 감지
   * 3. 히스토그램 변화 확인
   * 4. 0선 위치 확인으로 신호 강화
   *
   * 핵심 아이디어:
   * - 골든크로스: MACD > Signal (상승 신호)
   * - 데드크로스: MACD < Signal (하락 신호)
   * - 0선 위에서 골든크로스 = 강한 상승 신호
   * - 히스토그램 증가 = 모멘텀 강화
   */
  async executeMACDCrossoverStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      100,
    );

    const macd = this.indicatorService.calculateMACD(candles, 12, 26, 9);

    const current = macd[macd.length - 1];
    const previous = macd[macd.length - 2];

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (
      previous.macdLine < previous.signalLine &&
      current.macdLine > current.signalLine
    ) {
      signal = SignalType.STRONG_BUY;
      conditions.push('MACD 골든크로스 발생');

      if (current.macdLine > 0) {
        conditions.push('0선 위에서 골든크로스 - 강한 상승 신호');
        signal = SignalType.STRONG_BUY;
      } else {
        conditions.push('0선 아래에서 골든크로스 - 약한 상승 신호');
        signal = SignalType.BUY;
      }

      if (current.histogram > previous.histogram) {
        conditions.push('히스토그램 증가 - 모멘텀 강화');
      }
    } else if (
      previous.macdLine > previous.signalLine &&
      current.macdLine < current.signalLine
    ) {
      signal = SignalType.STRONG_SELL;
      conditions.push('MACD 데드크로스 발생');

      if (current.macdLine < 0) {
        conditions.push('0선 아래에서 데드크로스 - 강한 하락 신호');
        signal = SignalType.STRONG_SELL;
      } else {
        conditions.push('0선 위에서 데드크로스 - 약한 하락 신호');
        signal = SignalType.SELL;
      }

      if (current.histogram < previous.histogram) {
        conditions.push('히스토그램 감소 - 모멘텀 약화');
      }
    } else {
      if (current.isGoldenCross) {
        signal = SignalType.WEAK_BUY;
        conditions.push('MACD 상승 트렌드 유지');
      } else {
        signal = SignalType.WEAK_SELL;
        conditions.push('MACD 하락 트렌드 유지');
      }
    }

    return {
      strategy: StrategyType.MACD_CROSSOVER,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          macdLine: current.macdLine,
          signalLine: current.signalLine,
          histogram: current.histogram,
          isGoldenCross: current.isGoldenCross ? 1 : 0,
          isDeadCross: current.isDeadCross ? 1 : 0,
        },
        conditions,
        notes: 'MACD 크로스오버 전략 - 표준 12/26/9 설정',
      },
    };
  }

  /**
   * 피벗 반전 전략
   *
   * 피벗 포인트 레벨에서 가격이 반전될 때 발생하는 신호를 감지합니다.
   *
   * 계산 방법:
   * 1. 피벗 포인트 계산 (PP, R1, R2, R3, S1, S2, S3)
   * 2. 현재 가격이 피벗 레벨 근처에서 반전 감지
   * 3. RSI 확인으로 과매수/과매도 구간 판단
   * 4. 거래량 확인으로 신호 강화
   *
   * 핵심 아이디어:
   * - 지지선 터치 + RSI 과매도 = 매수 신호
   * - 저항선 터치 + RSI 과매수 = 매도 신호
   * - 거래량 증가 시 신호 강화
   */
  async executePivotReversalStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      50,
    );

    const previousCandle = candles[candles.length - 2];
    const pp =
      (previousCandle.high + previousCandle.low + previousCandle.close) / 3;

    const r1 = 2 * pp - previousCandle.low;
    const r2 = pp + (previousCandle.high - previousCandle.low);
    const r3 = previousCandle.high + 2 * (pp - previousCandle.low);

    const s1 = 2 * pp - previousCandle.high;
    const s2 = pp - (previousCandle.high - previousCandle.low);
    const s3 = previousCandle.low - 2 * (previousCandle.high - pp);

    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const currentRSI = rsi[rsi.length - 1];

    const currentPrice = candles[candles.length - 1].close;
    const currentVolume = candles[candles.length - 1].volume;
    const avgVolume =
      candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeRatio = currentVolume / avgVolume;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    if (
      (currentPrice <= s1 * 1.005 || currentPrice <= s2 * 1.005) &&
      currentRSI.value < 30
    ) {
      signal = SignalType.STRONG_BUY;
      conditions.push('피벗 지지선 터치');
      conditions.push(`RSI 과매도 확인: ${currentRSI.value.toFixed(1)}`);

      if (volumeRatio > 1.5) {
        conditions.push(`거래량 급증 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
        signal = SignalType.STRONG_BUY;
      } else {
        conditions.push(`거래량 정상 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
        signal = SignalType.BUY;
      }
    } else if (
      (currentPrice >= r1 * 0.995 || currentPrice >= r2 * 0.995) &&
      currentRSI.value > 70
    ) {
      signal = SignalType.STRONG_SELL;
      conditions.push('피벗 저항선 터치');
      conditions.push(`RSI 과매수 확인: ${currentRSI.value.toFixed(1)}`);

      if (volumeRatio > 1.5) {
        conditions.push(`거래량 급증 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
        signal = SignalType.STRONG_SELL;
      } else {
        conditions.push(`거래량 정상 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
        signal = SignalType.SELL;
      }
    } else {
      if (currentPrice > pp && currentPrice < r1) {
        signal = SignalType.WEAK_BUY;
        conditions.push('피벗 중간 레벨 - 상승 모멘텀');
      } else if (currentPrice < pp && currentPrice > s1) {
        signal = SignalType.WEAK_SELL;
        conditions.push('피벗 중간 레벨 - 하락 모멘텀');
      } else {
        conditions.push('피벗 중립 구간');
      }
    }

    return {
      strategy: StrategyType.PIVOT_REVERSAL,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          pivotPoint: pp,
          resistance1: r1,
          resistance2: r2,
          resistance3: r3,
          support1: s1,
          support2: s2,
          support3: s3,
          currentPrice,
          rsi: currentRSI.value,
          volumeRatio,
        },
        conditions,
        notes: '피벗 반전 전략 - 표준 피벗 포인트 계산',
      },
    };
  }

  /**
   * 삼중 확인 전략
   *
   * 이동평균, RSI, 거래량 세 가지 지표를 동시에 확인하여 신뢰도를 높이는 전략입니다.
   *
   * 매수 조건:
   * 1. 가격이 20일선 위에 위치
   * 2. RSI가 30-70 구간에 있음 (과매수/과매도 아님)
   * 3. 거래량이 평균 대비 1.2배 이상
   *
   * 매도 조건:
   * 1. 가격이 20일선 아래에 위치
   * 2. RSI가 70 이상 (과매수)
   * 3. 거래량이 평균 대비 0.8배 이하
   */
  async executeTripleConfirmationStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      100,
    );

    // 필요한 지표들 계산
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const volume = this.indicatorService.calculateVolumeAnalysis(candles);

    const currentPrice = candles[candles.length - 1].close;
    const currentSMA20 = sma20[sma20.length - 1]?.value;
    const currentRSI = rsi[rsi.length - 1];
    const currentVolume = volume[volume.length - 1];

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 매수 조건 확인
    const isPriceAboveMA20 = currentPrice > currentSMA20;
    const isRSIHealthy = currentRSI.value >= 30 && currentRSI.value <= 70;
    const isVolumeHigh = currentVolume.volumeRatio >= 1.2;

    // 매도 조건 확인
    const isPriceBelowMA20 = currentPrice < currentSMA20;
    const isRSIOverbought = currentRSI.value >= 70;
    const isVolumeLow = currentVolume.volumeRatio <= 0.8;

    // 삼중 확인 매수 신호
    if (isPriceAboveMA20 && isRSIHealthy && isVolumeHigh) {
      signal = SignalType.STRONG_BUY;
      conditions.push('가격이 20일선 위 위치');
      conditions.push(`RSI 건전 구간: ${currentRSI.value.toFixed(1)}`);
      conditions.push(
        `거래량 증가: 평균 대비 ${currentVolume.volumeRatio.toFixed(1)}배`,
      );
      conditions.push('삼중 확인 매수 신호 - 높은 신뢰도');
    }
    // 삼중 확인 매도 신호
    else if (isPriceBelowMA20 && isRSIOverbought && isVolumeLow) {
      signal = SignalType.STRONG_SELL;
      conditions.push('가격이 20일선 아래 위치');
      conditions.push(`RSI 과매수: ${currentRSI.value.toFixed(1)}`);
      conditions.push(
        `거래량 감소: 평균 대비 ${currentVolume.volumeRatio.toFixed(1)}배`,
      );
      conditions.push('삼중 확인 매도 신호 - 높은 신뢰도');
    }
    // 부분 확인 신호들
    else {
      let buyScore = 0;
      let sellScore = 0;

      if (isPriceAboveMA20) buyScore++;
      if (isRSIHealthy) buyScore++;
      if (isVolumeHigh) buyScore++;

      if (isPriceBelowMA20) sellScore++;
      if (isRSIOverbought) sellScore++;
      if (isVolumeLow) sellScore++;

      if (buyScore >= 2) {
        signal = SignalType.BUY;
        conditions.push(`부분 확인 매수 신호 (${buyScore}/3 조건 충족)`);
      } else if (sellScore >= 2) {
        signal = SignalType.SELL;
        conditions.push(`부분 확인 매도 신호 (${sellScore}/3 조건 충족)`);
      } else {
        conditions.push('삼중 확인 조건 미충족 - 중립');
      }
    }

    return {
      strategy: StrategyType.TRIPLE_CONFIRMATION,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          currentPrice,
          sma20: currentSMA20,
          rsi: currentRSI.value,
          volumeRatio: currentVolume.volumeRatio,
        },
        conditions,
        notes: '삼중 확인 전략 - 이동평균 + RSI + 거래량 동시 확인',
      },
    };
  }

  /**
   * 모든 기본 전략 실행
   *
   * 기본 전략들과 복합 전략들을 일괄 실행하여 결과를 반환합니다.
   *
   * @param symbol 분석할 심볼
   * @param timeframe 분석할 시간봉
   * @returns 기본 전략 실행 결과 배열
   */
  async executeAllBasicStrategies(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult[]> {
    const results: StrategyResult[] = [];

    try {
      results.push(
        await this.executeMovingAverageCrossoverStrategy(symbol, timeframe),
      );
    } catch (error) {
      console.error(`이동평균 크로스오버 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(
        await this.executeBollingerBandsReversalStrategy(symbol, timeframe),
      );
    } catch (error) {
      console.error(`볼린저 밴드 반전 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(await this.executeMACDCrossoverStrategy(symbol, timeframe));
    } catch (error) {
      console.error(`MACD 크로스오버 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(await this.executePivotReversalStrategy(symbol, timeframe));
    } catch (error) {
      console.error(`피벗 반전 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(
        await this.executeTripleConfirmationStrategy(symbol, timeframe),
      );
    } catch (error) {
      console.error(`삼중 확인 전략 실행 실패: ${symbol}`, error);
    }

    return results;
  }
}
