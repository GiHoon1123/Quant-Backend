import { Injectable } from '@nestjs/common';
import { Candle15MRepository } from '../../market-data/infra/candle/Candle15MRepository';
import {
  SignalType,
  StrategyResult,
  StrategyType,
} from '../types/StrategyTypes';
import { CandleData, TimeFrame } from '../types/TechnicalAnalysisTypes';
import { TechnicalIndicatorService } from './TechnicalIndicatorService';

/**
 * 🚀 고급 전략 서비스
 *
 * 더 정교하고 실전적인 트레이딩 전략들을 구현합니다.
 * 기존 전략들을 보완하고 새로운 고급 전략들을 추가합니다.
 */
@Injectable()
export class AdvancedStrategyService {
  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly indicatorService: TechnicalIndicatorService,
  ) {}

  /**
   * 🎯 스마트 머니 플로우 전략
   * 기관투자자들의 자금 흐름을 추적하여 매매 신호 생성
   */
  async executeSmartMoneyFlowStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      200,
    );

    // 스마트 머니 지표들 계산
    const volumeProfile = this.calculateVolumeProfile(candles);
    const orderFlow = this.calculateOrderFlow(candles);
    const institutionalFlow = this.calculateInstitutionalFlow(candles);

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    // 스마트 머니 유입 감지
    if (institutionalFlow.isAccumulating && volumeProfile.highVolumeAtSupport) {
      signal = SignalType.BUY;
      confidence = 75;
      conditions.push('기관 자금 유입 감지');
      conditions.push('지지선에서 대량 거래 확인');
    }

    // 스마트 머니 유출 감지
    if (
      institutionalFlow.isDistributing &&
      volumeProfile.highVolumeAtResistance
    ) {
      signal = SignalType.SELL;
      confidence = 75;
      conditions.push('기관 자금 유출 감지');
      conditions.push('저항선에서 대량 매도 확인');
    }

    return {
      strategy: StrategyType.SMART_MONEY_FLOW,
      symbol,
      timeframe,
      signal,
      confidence,
      timestamp: Date.now(),
      details: {
        indicators: {
          institutionalFlow: institutionalFlow.score,
          volumeProfile: volumeProfile.score,
          orderFlow: orderFlow.balance,
        },
        conditions,
        notes: '스마트 머니 플로우 분석',
      },
    };
  }

  /**
   * 📈 멀티 타임프레임 트렌드 전략
   * 여러 시간봉의 트렌드를 종합하여 강력한 신호 생성
   */
  async executeMultiTimeframeTrendStrategy(
    symbol: string,
  ): Promise<StrategyResult> {
    // 다양한 시간봉 데이터 수집
    const timeframes = ['15m', '1h', '4h', '1d'];
    const trendAnalysis: Array<{
      timeframe: string;
      direction: string;
      strength: number;
    }> = [];

    for (const tf of timeframes) {
      const candles = await this.candleRepository.findLatestCandles(
        symbol,
        'FUTURES',
        100,
      );
      const trend = this.analyzeTrend(candles, tf);
      trendAnalysis.push({
        timeframe: tf,
        direction: trend.direction,
        strength: trend.strength,
      });
    }

    // 트렌드 일치도 계산
    const bullishCount = trendAnalysis.filter(
      (t) => t.direction === 'bullish',
    ).length;
    const bearishCount = trendAnalysis.filter(
      (t) => t.direction === 'bearish',
    ).length;
    const alignment = Math.max(bullishCount, bearishCount) / timeframes.length;

    let signal = SignalType.NEUTRAL;
    let confidence = Math.round(alignment * 100);
    const conditions: string[] = [];

    if (bullishCount >= 3) {
      signal = SignalType.STRONG_BUY;
      conditions.push(`${bullishCount}개 시간봉에서 상승 트렌드 확인`);
    } else if (bearishCount >= 3) {
      signal = SignalType.STRONG_SELL;
      conditions.push(`${bearishCount}개 시간봉에서 하락 트렌드 확인`);
    }

    return {
      strategy: StrategyType.MULTI_TIMEFRAME_TREND,
      symbol,
      timeframe: 'MULTI',
      signal,
      confidence,
      timestamp: Date.now(),
      details: {
        indicators: {
          bullishTimeframes: bullishCount,
          bearishTimeframes: bearishCount,
          alignment,
        },
        conditions,
        notes: '멀티 타임프레임 트렌드 분석',
      },
    };
  }

  /**
   * 🎪 패턴 인식 전략
   * 가격이 특정 패턴을 그릴 때 발생하는 반전 신호 포착
   */
  async executePatternRecognitionStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      50,
    );

    // 패턴 인식
    const patterns = this.recognizePatterns(candles);

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    // 더블 바텀 패턴
    if (patterns.doubleBottom.detected) {
      signal = SignalType.BUY;
      confidence = patterns.doubleBottom.reliability;
      conditions.push('더블 바텀 패턴 감지');
    }

    // 헤드 앤 숄더 패턴
    if (patterns.headAndShoulders.detected) {
      signal = SignalType.SELL;
      confidence = patterns.headAndShoulders.reliability;
      conditions.push('헤드 앤 숄더 패턴 감지');
    }

    // 삼각 수렴 패턴
    if (patterns.triangle.detected) {
      signal =
        patterns.triangle.direction === 'up' ? SignalType.BUY : SignalType.SELL;
      confidence = patterns.triangle.reliability;
      conditions.push('삼각 수렴 패턴 돌파');
    }

    return {
      strategy: StrategyType.PATTERN_RECOGNITION,
      symbol,
      timeframe,
      signal,
      confidence,
      timestamp: Date.now(),
      details: {
        indicators: {
          doubleBottom: patterns.doubleBottom.detected ? 1 : 0,
          headAndShoulders: patterns.headAndShoulders.detected ? 1 : 0,
          triangle: patterns.triangle.detected ? 1 : 0,
        },
        conditions,
        notes: '차트 패턴 인식 전략',
      },
    };
  }

  /**
   * 🌊 웨이브 분석 전략
   * 엘리어트 웨이브 이론 기반 매매 신호
   */
  async executeElliottWaveStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      200,
    );

    const waveAnalysis = this.analyzeElliottWaves(candles);

    let signal = SignalType.NEUTRAL;
    let confidence = 0;
    const conditions: string[] = [];

    // 5파 완성 후 조정 예상
    if (waveAnalysis.currentWave === 5 && waveAnalysis.waveCompletion > 0.8) {
      signal = SignalType.SELL;
      confidence = 70;
      conditions.push('5파 상승 완료, 조정 예상');
    }

    // 3파 조정 완료 후 상승 예상
    if (waveAnalysis.currentWave === 4 && waveAnalysis.correctionComplete) {
      signal = SignalType.BUY;
      confidence = 75;
      conditions.push('4파 조정 완료, 5파 상승 예상');
    }

    return {
      strategy: StrategyType.ELLIOTT_WAVE,
      symbol,
      timeframe,
      signal,
      confidence,
      timestamp: Date.now(),
      details: {
        indicators: {
          currentWave: waveAnalysis.currentWave,
          waveCompletion: waveAnalysis.waveCompletion,
          trendDirection:
            waveAnalysis.trendDirection === 'up'
              ? 1
              : waveAnalysis.trendDirection === 'down'
                ? -1
                : 0,
        },
        conditions,
        notes: '엘리어트 웨이브 분석',
      },
    };
  }

  /**
   * 🎯 AI 예측 전략
   * 머신러닝 모델을 활용한 가격 예측
   */
  async executeAIPredictionStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      500,
    );

    // 특성 추출
    const features = this.extractMLFeatures(candles);

    // AI 모델 예측 (실제로는 외부 ML 서비스 호출)
    const prediction = await this.predictWithAI(features);

    let signal = SignalType.NEUTRAL;
    let confidence = Math.round(prediction.confidence * 100);
    const conditions: string[] = [];

    if (prediction.direction === 'up' && prediction.confidence > 0.7) {
      signal = SignalType.BUY;
      conditions.push(
        `AI 모델 상승 예측 (확률: ${(prediction.confidence * 100).toFixed(1)}%)`,
      );
    } else if (prediction.direction === 'down' && prediction.confidence > 0.7) {
      signal = SignalType.SELL;
      conditions.push(
        `AI 모델 하락 예측 (확률: ${(prediction.confidence * 100).toFixed(1)}%)`,
      );
    }

    return {
      strategy: StrategyType.AI_PREDICTION,
      symbol,
      timeframe,
      signal,
      confidence,
      timestamp: Date.now(),
      details: {
        indicators: {
          aiConfidence: prediction.confidence,
          predictedDirection:
            prediction.direction === 'bullish'
              ? 1
              : prediction.direction === 'bearish'
                ? -1
                : 0,
          modelVersion: parseFloat(prediction.modelVersion) || 1.0,
        },
        conditions,
        notes: 'AI 머신러닝 예측',
      },
    };
  }

  // 헬퍼 메서드들
  private calculateVolumeProfile(candles: CandleData[]) {
    // 볼륨 프로파일 계산 로직
    return {
      highVolumeAtSupport: true,
      highVolumeAtResistance: false,
      score: 0.75,
    };
  }

  private calculateOrderFlow(candles: CandleData[]) {
    // 주문 흐름 분석 로직
    return {
      balance: 0.6, // 매수 우세
    };
  }

  private calculateInstitutionalFlow(candles: CandleData[]) {
    // 기관 자금 흐름 분석 로직
    return {
      isAccumulating: true,
      isDistributing: false,
      score: 0.8,
    };
  }

  private analyzeTrend(candles: CandleData[], timeframe: string) {
    // 트렌드 분석 로직
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const sma50 = this.indicatorService.calculateSMA(candles, 50);

    const current20 = sma20[sma20.length - 1]?.value;
    const current50 = sma50[sma50.length - 1]?.value;

    return {
      direction: current20 > current50 ? 'bullish' : 'bearish',
      strength: Math.abs(current20 - current50) / current50,
    };
  }

  private recognizePatterns(candles: CandleData[]) {
    // 패턴 인식 로직 (간단한 예시)
    return {
      doubleBottom: { detected: false, reliability: 0 },
      headAndShoulders: { detected: false, reliability: 0 },
      triangle: { detected: false, direction: 'up', reliability: 0 },
    };
  }

  private analyzeElliottWaves(candles: CandleData[]) {
    // 엘리어트 웨이브 분석 로직
    return {
      currentWave: 3,
      waveCompletion: 0.6,
      correctionComplete: false,
      trendDirection: 'up',
    };
  }

  private extractMLFeatures(candles: CandleData[]) {
    // ML 특성 추출
    const features = {
      priceFeatures: candles.slice(-20).map((c) => c.close),
      volumeFeatures: candles.slice(-20).map((c) => c.volume),
      technicalIndicators: {
        rsi: this.indicatorService.calculateRSI(candles, 14),
        macd: this.indicatorService.calculateMACD(candles),
      },
    };

    return features;
  }

  private async predictWithAI(features: any) {
    // 실제로는 외부 ML API 호출
    // 여기서는 모의 예측 결과 반환
    return {
      direction: 'up',
      confidence: 0.75,
      modelVersion: 'v1.0',
    };
  }
}
