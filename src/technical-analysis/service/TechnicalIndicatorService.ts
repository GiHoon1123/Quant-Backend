import { Injectable } from '@nestjs/common';
import {
  BollingerBandsResult,
  CandleData,
  MACDResult,
  MovingAverageResult,
  RSIResult,
  VWAPResult,
  VolumeAnalysisResult,
} from '../types/TechnicalAnalysisTypes';

/**
 * 기술적 지표 계산 서비스
 *
 * 모든 기술적 분석 지표들을 계산하는 핵심 서비스입니다.
 * 수학적으로 정확한 계산과 효율적인 알고리즘을 제공합니다.
 *
 * 🧮 지원 지표:
 * - 이동평균선 (SMA, EMA)
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence)
 * - 볼린저 밴드 (Bollinger Bands)
 * - 거래량 지표 (Volume Analysis, OBV)
 *
 * 📊 계산 특징:
 * - 정확한 수학적 공식 적용
 * - 효율적인 메모리 사용
 * - 점진적 업데이트 지원
 * - 대량 데이터 처리 최적화
 */
@Injectable()
export class TechnicalIndicatorService {
  /**
   * VWAP (Volume Weighted Average Price) 계산
   * @param candles 캔들 데이터 배열
   * @returns VWAP 값 (배열: 각 캔들별 VWAP)
   *
   * VWAP = (누적 거래대금) / (누적 거래량)
   * 거래대금 = (고가+저가+종가)/3 * 거래량
   */
  calculateVWAP(candles: CandleData[]): VWAPResult[] {
    if (!candles || candles.length === 0) return [];
    let cumulativeVolume = 0;
    let cumulativeAmount = 0;
    const results: VWAPResult[] = [];
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const amount = typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      cumulativeAmount += amount;
      const vwap = cumulativeVolume === 0 ? 0 : cumulativeAmount / cumulativeVolume;
      results.push({ timestamp: candle.closeTime, value: vwap });
    }
    return results;
  }
  /**
   * 단순 이동평균선(SMA) 계산
   *
   * @param candles 캔들 데이터 배열
   * @param period 이동평균 기간 (5, 20, 50, 200 등)
   * @returns SMA 계산 결과 배열
   *
   * 📐 계산 공식: SMA = (P1 + P2 + ... + Pn) / n
   *
   * 🎯 주요 용도:
   * - 트렌드 방향 확인
   * - 지지/저항선 역할
   * - 가격 돌파 신호 생성
   *
   * 💡 사용 예시:
   * ```typescript
   * const sma20 = await indicator.calculateSMA(candles, 20);
   * const currentSMA = sma20[sma20.length - 1].value;
   * ```
   */
  calculateSMA(candles: CandleData[], period: number): MovingAverageResult[] {
    if (candles.length < period) {
      throw new Error(
        `SMA 계산을 위한 데이터가 부족합니다. 필요: ${period}개, 현재: ${candles.length}개`,
      );
    }

    const results: MovingAverageResult[] = [];

    for (let i = period - 1; i < candles.length; i++) {
      // 지정된 기간의 종가 합계 계산
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }

      const smaValue = sum / period;

      results.push({
        timestamp: candles[i].closeTime,
        value: smaValue,
        type: 'SMA',
        period,
      });
    }

    console.log(`✅ SMA${period} 계산 완료: ${results.length}개 데이터`);
    return results;
  }

  /**
   * 지수 이동평균선(EMA) 계산
   *
   * @param candles 캔들 데이터 배열
   * @param period 이동평균 기간
   * @returns EMA 계산 결과 배열
   *
   * 📐 계산 공식:
   * - 첫 번째 EMA = SMA
   * - 이후 EMA = (현재가 × 승수) + (이전 EMA × (1 - 승수))
   * - 승수 = 2 / (기간 + 1)
   *
   * 🎯 SMA vs EMA:
   * - EMA는 최근 가격에 더 민감하게 반응
   * - 빠른 신호 생성, 하지만 노이즈 많음
   * - 단기 거래에 더 적합
   */
  calculateEMA(candles: CandleData[], period: number): MovingAverageResult[] {
    if (candles.length < period) {
      throw new Error(
        `EMA 계산을 위한 데이터가 부족합니다. 필요: ${period}개, 현재: ${candles.length}개`,
      );
    }

    const results: MovingAverageResult[] = [];
    const multiplier = 2 / (period + 1);

    // 첫 번째 EMA는 SMA로 계산
    let ema = 0;
    for (let i = 0; i < period; i++) {
      ema += candles[i].close;
    }
    ema = ema / period;

    results.push({
      timestamp: candles[period - 1].closeTime,
      value: ema,
      type: 'EMA',
      period,
    });

    // 이후 EMA 계산
    for (let i = period; i < candles.length; i++) {
      ema = candles[i].close * multiplier + ema * (1 - multiplier);

      results.push({
        timestamp: candles[i].closeTime,
        value: ema,
        type: 'EMA',
        period,
      });
    }

    console.log(`✅ EMA${period} 계산 완료: ${results.length}개 데이터`);
    return results;
  }

  /**
   * RSI(Relative Strength Index) 계산
   *
   * @param candles 캔들 데이터 배열
   * @param period RSI 기간 (기본값: 14)
   * @returns RSI 계산 결과 배열
   *
   * 📐 계산 공식:
   * 1. RS = 평균 상승폭 / 평균 하락폭
   * 2. RSI = 100 - (100 / (1 + RS))
   *
   * 📊 해석:
   * - 70 이상: 과매수 (매도 고려)
   * - 30 이하: 과매도 (매수 고려)
   * - 50: 중립선
   *
   * 🎯 활용법:
   * - 과매수/과매도 구간 판단
   * - 다이버전스 분석
   * - 트렌드 강도 측정
   */
  calculateRSI(candles: CandleData[], period: number = 14): RSIResult[] {
    if (candles.length < period + 1) {
      throw new Error(
        `RSI 계산을 위한 데이터가 부족합니다. 필요: ${period + 1}개, 현재: ${candles.length}개`,
      );
    }

    const results: RSIResult[] = [];
    let avgGain = 0;
    let avgLoss = 0;

    // 첫 번째 기간의 평균 상승/하락 계산
    for (let i = 1; i <= period; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) {
        avgGain += change;
      } else {
        avgLoss += Math.abs(change);
      }
    }

    avgGain = avgGain / period;
    avgLoss = avgLoss / period;

    // 첫 번째 RSI 계산
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - 100 / (1 + rs);

    results.push({
      timestamp: candles[period].closeTime,
      value: rsi,
      isOverbought: rsi >= 70,
      isOversold: rsi <= 30,
    });

    // 이후 RSI 계산 (Wilder's smoothing)
    for (let i = period + 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;

      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);

      results.push({
        timestamp: candles[i].closeTime,
        value: rsi,
        isOverbought: rsi >= 70,
        isOversold: rsi <= 30,
      });
    }

    console.log(`✅ RSI${period} 계산 완료: ${results.length}개 데이터`);
    return results;
  }

  /**
   * MACD(Moving Average Convergence Divergence) 계산
   *
   * @param candles 캔들 데이터 배열
   * @param fastPeriod 빠른 EMA 기간 (기본값: 12)
   * @param slowPeriod 느린 EMA 기간 (기본값: 26)
   * @param signalPeriod 시그널 EMA 기간 (기본값: 9)
   * @returns MACD 계산 결과 배열
   *
   * 📐 계산 공식:
   * 1. MACD Line = EMA12 - EMA26
   * 2. Signal Line = EMA9(MACD Line)
   * 3. Histogram = MACD Line - Signal Line
   *
   * 📊 신호 해석:
   * - MACD > Signal: 상승 신호 (골든크로스)
   * - MACD < Signal: 하락 신호 (데드크로스)
   * - MACD > 0: 강한 상승 모멘텀
   * - Histogram 증가: 모멘텀 강화
   */
  calculateMACD(
    candles: CandleData[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
  ): MACDResult[] {
    const requiredData = Math.max(slowPeriod, fastPeriod) + signalPeriod;

    if (candles.length < requiredData) {
      throw new Error(
        `MACD 계산을 위한 데이터가 부족합니다. 필요: ${requiredData}개, 현재: ${candles.length}개`,
      );
    }

    // 빠른/느린 EMA 계산
    const fastEMA = this.calculateEMA(candles, fastPeriod);
    const slowEMA = this.calculateEMA(candles, slowPeriod);

    // MACD 라인 계산 (두 EMA의 교집합 구간에서)
    const macdData: { timestamp: number; macd: number }[] = [];
    const startIndex = slowPeriod - fastPeriod; // 느린 EMA가 시작되는 지점

    for (let i = startIndex; i < fastEMA.length; i++) {
      const slowIndex = i - startIndex;
      if (slowIndex < slowEMA.length) {
        macdData.push({
          timestamp: fastEMA[i].timestamp,
          macd: fastEMA[i].value - slowEMA[slowIndex].value,
        });
      }
    }

    // Signal Line 계산 (MACD의 EMA)
    const results: MACDResult[] = [];
    const signalMultiplier = 2 / (signalPeriod + 1);

    // 첫 번째 Signal은 MACD의 SMA
    let signal = 0;
    for (let i = 0; i < signalPeriod; i++) {
      signal += macdData[i].macd;
    }
    signal = signal / signalPeriod;

    // 첫 번째 MACD 결과
    const firstMACD = macdData[signalPeriod - 1];
    results.push({
      timestamp: firstMACD.timestamp,
      value: firstMACD.macd,
      macdLine: firstMACD.macd,
      signalLine: signal,
      histogram: firstMACD.macd - signal,
      isGoldenCross: firstMACD.macd > signal,
      isDeadCross: firstMACD.macd < signal,
    });

    // 이후 MACD 결과들
    for (let i = signalPeriod; i < macdData.length; i++) {
      const currentMACD = macdData[i];

      // Signal EMA 업데이트
      signal =
        currentMACD.macd * signalMultiplier + signal * (1 - signalMultiplier);

      const histogram = currentMACD.macd - signal;

      results.push({
        timestamp: currentMACD.timestamp,
        value: currentMACD.macd,
        macdLine: currentMACD.macd,
        signalLine: signal,
        histogram,
        isGoldenCross: currentMACD.macd > signal,
        isDeadCross: currentMACD.macd < signal,
      });
    }

    console.log(
      `✅ MACD(${fastPeriod},${slowPeriod},${signalPeriod}) 계산 완료: ${results.length}개 데이터`,
    );
    return results;
  }

  /**
   * 볼린저 밴드(Bollinger Bands) 계산
   *
   * @param candles 캔들 데이터 배열
   * @param period 이동평균 기간 (기본값: 20)
   * @param stdDev 표준편차 배수 (기본값: 2)
   * @returns 볼린저 밴드 계산 결과 배열
   *
   * 📐 계산 공식:
   * 1. Middle Line = SMA(20)
   * 2. Upper Band = Middle + (2 × Standard Deviation)
   * 3. Lower Band = Middle - (2 × Standard Deviation)
   * 4. %B = (Price - Lower) / (Upper - Lower)
   *
   * 📊 해석:
   * - 상단 밴드 터치: 과매수 가능성
   * - 하단 밴드 터치: 과매도 가능성
   * - 밴드 수축: 변동성 감소, 큰 움직임 예고
   * - 밴드 확장: 변동성 증가, 트렌드 지속
   */
  calculateBollingerBands(
    candles: CandleData[],
    period: number = 20,
    stdDev: number = 2,
  ): BollingerBandsResult[] {
    if (candles.length < period) {
      throw new Error(
        `볼린저밴드 계산을 위한 데이터가 부족합니다. 필요: ${period}개, 현재: ${candles.length}개`,
      );
    }

    const results: BollingerBandsResult[] = [];

    for (let i = period - 1; i < candles.length; i++) {
      // SMA 계산 (중심선)
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      const sma = sum / period;

      // 표준편차 계산
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        variance += Math.pow(candles[j].close - sma, 2);
      }
      const standardDeviation = Math.sqrt(variance / period);

      // 상/하단 밴드 계산
      const upper = sma + stdDev * standardDeviation;
      const lower = sma - stdDev * standardDeviation;

      // %B 계산 (현재가의 밴드 내 위치)
      const currentPrice = candles[i].close;
      const percentB = (currentPrice - lower) / (upper - lower);

      // 밴드폭 계산
      const bandwidth = (upper - lower) / sma;

      results.push({
        timestamp: candles[i].closeTime,
        value: sma, // 중심선이 대표값
        middle: sma,
        upper,
        lower,
        percentB,
        bandwidth,
      });
    }

    console.log(
      `✅ 볼린저밴드(${period},${stdDev}) 계산 완료: ${results.length}개 데이터`,
    );
    return results;
  }

  /**
   * 거래량 분석 지표 계산
   *
   * @param candles 캔들 데이터 배열
   * @param period 거래량 이동평균 기간 (기본값: 20)
   * @returns 거래량 분석 결과 배열
   *
   * 📊 포함 지표:
   * - 거래량 이동평균
   * - 거래량 비율 (현재/평균)
   * - 거래량 급증 감지
   * - OBV (On Balance Volume)
   *
   * 🎯 활용법:
   * - 거래량 급증 시 가격 돌파 확인
   * - OBV와 가격의 다이버전스 분석
   * - 트렌드 확인용 보조 지표
   */
  calculateVolumeAnalysis(
    candles: CandleData[],
    period: number = 20,
  ): VolumeAnalysisResult[] {
    if (candles.length < period) {
      throw new Error(
        `거래량 분석을 위한 데이터가 부족합니다. 필요: ${period}개, 현재: ${candles.length}개`,
      );
    }

    const results: VolumeAnalysisResult[] = [];
    let obv = 0; // OBV 누적값

    for (let i = period - 1; i < candles.length; i++) {
      // 거래량 이동평균 계산
      let volumeSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        volumeSum += candles[j].volume;
      }
      const volumeMA = volumeSum / period;

      // 현재 거래량
      const currentVolume = candles[i].volume;

      // 거래량 비율
      const volumeRatio = currentVolume / volumeMA;

      // 거래량 급증 여부 (평균의 2배 이상)
      const isVolumeSurge = volumeRatio >= 2.0;

      // OBV 계산
      if (i > 0) {
        if (candles[i].close > candles[i - 1].close) {
          obv += currentVolume; // 상승 시 거래량 더함
        } else if (candles[i].close < candles[i - 1].close) {
          obv -= currentVolume; // 하락 시 거래량 뺌
        }
        // 동일 가격 시 OBV 변화 없음
      }

      results.push({
        timestamp: candles[i].closeTime,
        value: volumeRatio, // 거래량 비율을 대표값으로
        currentVolume,
        volumeMA,
        volumeRatio,
        isVolumeSurge,
        obv,
      });
    }

    console.log(
      `✅ 거래량 분석(${period}) 계산 완료: ${results.length}개 데이터`,
    );
    return results;
  }

  /**
   * 여러 이동평균선을 한 번에 계산
   *
   * @param candles 캔들 데이터 배열
   * @param periods 계산할 이동평균 기간들 (예: [5, 20, 50, 200])
   * @param type 이동평균 타입 ('SMA' 또는 'EMA')
   * @returns 기간별 이동평균 결과 맵
   *
   * 🎯 다중 이동평균 전략용:
   * - 정배열/역배열 확인
   * - 골든크로스/데드크로스 감지
   * - 지지/저항선 역할 확인
   */
  calculateMultipleMovingAverages(
    candles: CandleData[],
    periods: number[],
    type: 'SMA' | 'EMA' = 'SMA',
  ): Map<number, MovingAverageResult[]> {
    const results = new Map<number, MovingAverageResult[]>();

    for (const period of periods) {
      try {
        const ma =
          type === 'SMA'
            ? this.calculateSMA(candles, period)
            : this.calculateEMA(candles, period);

        results.set(period, ma);
      } catch (error) {
        console.warn(`⚠️ ${type}${period} 계산 실패: ${error.message}`);
      }
    }

    console.log(`✅ 다중 ${type} 계산 완료: ${results.size}개 기간`);
    return results;
  }

  /**
   * 임계값(평균선) 돌파/이탈 시그널 감지
   *
   * @param candles 캔들 데이터 배열
   * @param maResults 이동평균 결과 배열 (SMA, EMA, VWAP 등)
   * @param type 기준선 타입 ('SMA' | 'EMA' | 'VWAP')
   * @returns 각 시점별 돌파/이탈 시그널 배열
   *
   * - 상향 돌파: 이전 close < 평균선, 현재 close > 평균선
   * - 하향 이탈: 이전 close > 평균선, 현재 close < 평균선
   */
  detectThresholdSignals(
    candles: CandleData[],
    maResults: { timestamp: number; value: number }[],
    type: 'SMA' | 'EMA' | 'VWAP',
  ): Array<{
    timestamp: number;
    price: number;
    average: number;
    type: string;
    signal: 'UP_BREAK' | 'DOWN_BREAK' | null;
  }> {
    const signals: Array<{
      timestamp: number;
      price: number;
      average: number;
      type: string;
      signal: 'UP_BREAK' | 'DOWN_BREAK' | null;
    }> = [];

    for (let i = 1; i < maResults.length; i++) {
      const prevPrice = candles[i - 1 + (candles.length - maResults.length)].close;
      const currPrice = candles[i + (candles.length - maResults.length)].close;
      const prevAvg = maResults[i - 1].value;
      const currAvg = maResults[i].value;
      let signal: 'UP_BREAK' | 'DOWN_BREAK' | null = null;

      // 상향 돌파: 이전 close < 평균선, 현재 close > 평균선
      if (prevPrice < prevAvg && currPrice > currAvg) {
        signal = 'UP_BREAK';
      }
      // 하향 이탈: 이전 close > 평균선, 현재 close < 평균선
      else if (prevPrice > prevAvg && currPrice < currAvg) {
        signal = 'DOWN_BREAK';
      }

      signals.push({
        timestamp: maResults[i].timestamp,
        price: currPrice,
        average: currAvg,
        type,
        signal,
      });
    }
    return signals;
  }
}
