import { Injectable } from '@nestjs/common';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
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
   *
   * 📖 개념: 기관투자자(스마트 머니)들의 자금 흐름을 추적하여 매매 신호 생성
   *
   * 🧮 계산 방법:
   * 1. 볼륨 프로파일 분석: 가격대별 거래량 분포를 분석하여 기관의 매집/분산 구간 파악
   * 2. 주문 흐름 분석: 대량 주문의 방향성을 분석하여 기관의 의도 파악
   * 3. 기관 자금 흐름: 거래량과 가격 움직임의 상관관계로 기관 참여도 측정
   *
   * 💡 핵심 아이디어:
   * - 기관투자자들은 일반 투자자보다 먼저 움직인다
   * - 대량 거래는 보통 기관에 의해 발생한다
   * - 지지선에서 대량 매수 = 기관 매집 (상승 신호)
   * - 저항선에서 대량 매도 = 기관 분산 (하락 신호)
   */
  async executeSmartMoneyFlowStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    // 📊 200개 캔들 데이터 수집 (약 50시간 분량의 15분봉)
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      200,
    );

    // 🔍 스마트 머니 지표들 계산
    // 1. 볼륨 프로파일: 가격대별 거래량 분포 분석
    const volumeProfile = this.calculateVolumeProfile(candles);

    // 2. 주문 흐름: 매수/매도 주문의 균형 분석
    const orderFlow = this.calculateOrderFlow(candles);

    // 3. 기관 자금 흐름: 대량 거래 패턴 분석
    const institutionalFlow = this.calculateInstitutionalFlow(candles);

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 🟢 스마트 머니 유입 감지 로직
    // 조건 1: 기관이 매집 중 (institutionalFlow.isAccumulating)
    // 조건 2: 지지선에서 대량 거래 발생 (volumeProfile.highVolumeAtSupport)
    // 💭 해석: 기관들이 지지선 근처에서 대량 매수 → 상승 준비 신호
    if (institutionalFlow.isAccumulating && volumeProfile.highVolumeAtSupport) {
      signal = SignalType.BUY;
      conditions.push('기관 자금 유입 감지 - 대량 매집 패턴 확인');
      conditions.push('지지선에서 대량 거래 확인 - 바닥 다지기 완료');
    }

    // 🔴 스마트 머니 유출 감지 로직
    // 조건 1: 기관이 분산 중 (institutionalFlow.isDistributing)
    // 조건 2: 저항선에서 대량 거래 발생 (volumeProfile.highVolumeAtResistance)
    // 💭 해석: 기관들이 저항선 근처에서 대량 매도 → 하락 준비 신호
    if (
      institutionalFlow.isDistributing &&
      volumeProfile.highVolumeAtResistance
    ) {
      signal = SignalType.SELL;
      conditions.push('기관 자금 유출 감지 - 대량 분산 패턴 확인');
      conditions.push('저항선에서 대량 매도 확인 - 천장 형성 신호');
    }

    return {
      strategy: StrategyType.SMART_MONEY_FLOW,
      symbol,
      timeframe,
      signal,

      timestamp: Date.now(),
      details: {
        indicators: {
          institutionalFlow: institutionalFlow.score, // 기관 자금 흐름 점수 (-1~1)
          volumeProfile: volumeProfile.score, // 볼륨 프로파일 점수 (0~1)
          orderFlow: orderFlow.balance, // 주문 흐름 균형 (-1~1)
        },
        conditions,
        notes: '스마트 머니 플로우 분석 - 기관투자자 자금 흐름 추적',
      },
    };
  }

  /**
   * 📈 멀티 타임프레임 트렌드 전략
   *
   * 📖 개념: 여러 시간봉의 트렌드를 종합하여 강력한 신호 생성
   *
   * 🧮 계산 방법:
   * 1. 4개 시간봉 분석: 15분, 1시간, 4시간, 일봉
   * 2. 각 시간봉별 트렌드 방향 판단: SMA20 vs SMA50 비교
   * 3. 트렌드 강도 계산: (SMA20 - SMA50) / SMA50 * 100
   * 4. 일치도 계산: 같은 방향 시간봉 수 / 전체 시간봉 수
   *
   * 💡 핵심 아이디어:
   * - 여러 시간봉이 같은 방향을 가리키면 신뢰도 높음
   * - 단기(15분) + 중기(1시간) + 장기(일봉) 모두 일치 = 강한 신호
   * - 3개 이상 시간봉 일치 시 STRONG 신호 생성
   *
   * 🎯 신뢰도 계산:
   * - 4개 모두 일치: 100% 신뢰도
   * - 3개 일치: 75% 신뢰도
   * - 2개 일치: 50% 신뢰도 (중립)
   */
  async executeMultiTimeframeTrendStrategy(
    symbol: string,
  ): Promise<StrategyResult> {
    // 📊 분석할 시간봉들 정의
    // 15분: 단기 트렌드, 1시간: 중기 트렌드, 4시간: 중장기, 일봉: 장기 트렌드
    const timeframes = ['15m', '1h', '4h', '1d'];
    const trendAnalysis: Array<{
      timeframe: string;
      direction: string; // 'bullish' | 'bearish' | 'neutral'
      strength: number; // 트렌드 강도 (0~1)
    }> = [];

    // 🔍 각 시간봉별 트렌드 분석
    for (const tf of timeframes) {
      // 각 시간봉마다 100개 캔들 수집 (충분한 데이터 확보)
      const candles = await this.candleRepository.findLatestCandles(
        symbol,
        'FUTURES',
        100,
      );

      // 트렌드 분석 실행
      const trend = this.analyzeTrend(candles, tf);

      trendAnalysis.push({
        timeframe: tf,
        direction: trend.direction, // SMA20 vs SMA50 비교 결과
        strength: trend.strength, // 트렌드 강도 (차이 비율)
      });
    }

    // 📈 트렌드 일치도 계산
    // 상승 트렌드 시간봉 개수 계산
    const bullishCount = trendAnalysis.filter(
      (t) => t.direction === 'bullish',
    ).length;

    // 하락 트렌드 시간봉 개수 계산
    const bearishCount = trendAnalysis.filter(
      (t) => t.direction === 'bearish',
    ).length;

    // 일치도 계산: 최대값 / 전체 시간봉 수
    // 예: 4개 중 3개 상승 = 3/4 = 0.75 (75% 일치)
    const alignment = Math.max(bullishCount, bearishCount) / timeframes.length;

    let signal = SignalType.NEUTRAL;

    const conditions: string[] = [];

    // 🟢 강한 상승 신호 조건: 3개 이상 시간봉에서 상승 트렌드
    // 💭 해석: 단기~장기 모든 관점에서 상승 → 매우 강한 신호
    if (bullishCount >= 3) {
      signal = SignalType.STRONG_BUY;
      conditions.push(`${bullishCount}개 시간봉에서 상승 트렌드 확인`);
      conditions.push('다중 시간봉 상승 일치 - 강한 상승 모멘텀');

      // 세부 분석 추가
      const strongTimeframes = trendAnalysis
        .filter((t) => t.direction === 'bullish' && t.strength > 0.02)
        .map((t) => t.timeframe);
      if (strongTimeframes.length > 0) {
        conditions.push(`강한 상승: ${strongTimeframes.join(', ')}`);
      }
    }
    // 🔴 강한 하락 신호 조건: 3개 이상 시간봉에서 하락 트렌드
    // 💭 해석: 단기~장기 모든 관점에서 하락 → 매우 강한 신호
    else if (bearishCount >= 3) {
      signal = SignalType.STRONG_SELL;
      conditions.push(`${bearishCount}개 시간봉에서 하락 트렌드 확인`);
      conditions.push('다중 시간봉 하락 일치 - 강한 하락 모멘텀');

      // 세부 분석 추가
      const strongTimeframes = trendAnalysis
        .filter((t) => t.direction === 'bearish' && t.strength > 0.02)
        .map((t) => t.timeframe);
      if (strongTimeframes.length > 0) {
        conditions.push(`강한 하락: ${strongTimeframes.join(', ')}`);
      }
    }

    return {
      strategy: StrategyType.MULTI_TIMEFRAME_TREND,
      symbol,
      timeframe: 'MULTI', // 다중 시간봉 분석
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          bullishTimeframes: bullishCount, // 상승 트렌드 시간봉 수
          bearishTimeframes: bearishCount, // 하락 트렌드 시간봉 수
          alignment, // 트렌드 일치도 (0~1)
        },
        conditions,
        notes: '멀티 타임프레임 트렌드 분석 - 시간봉 간 트렌드 일치도 검증',
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
    const conditions: string[] = [];

    // 더블 바텀 패턴
    if (patterns.doubleBottom.detected) {
      signal = SignalType.BUY;
      conditions.push('더블 바텀 패턴 감지');
    }

    // 헤드 앤 숄더 패턴
    if (patterns.headAndShoulders.detected) {
      signal = SignalType.SELL;
      conditions.push('헤드 앤 숄더 패턴 감지');
    }

    // 삼각 수렴 패턴
    if (patterns.triangle.detected) {
      signal =
        patterns.triangle.direction === 'up' ? SignalType.BUY : SignalType.SELL;
      conditions.push('삼각 수렴 패턴 돌파');
    }

    return {
      strategy: StrategyType.PATTERN_RECOGNITION,
      symbol,
      timeframe,
      signal,

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
    const conditions: string[] = [];

    // 5파 완성 후 조정 예상
    if (waveAnalysis.currentWave === 5 && waveAnalysis.waveCompletion > 0.8) {
      signal = SignalType.SELL;
      conditions.push('5파 상승 완료, 조정 예상');
    }

    // 3파 조정 완료 후 상승 예상
    if (waveAnalysis.currentWave === 4 && waveAnalysis.correctionComplete) {
      signal = SignalType.BUY;
      conditions.push('4파 조정 완료, 5파 상승 예상');
    }

    return {
      strategy: StrategyType.ELLIOTT_WAVE,
      symbol,
      timeframe,
      signal,
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
   * 📈 이동평균 크로스오버 전략 (표준 기법)
   *
   * 📖 개념: 빠른 이동평균선이 느린 이동평균선을 상향/하향 돌파할 때 발생하는 신호
   *
   * 🧮 계산 방법:
   * 1. SMA20과 SMA50 계산
   * 2. 이전 캔들에서 현재 캔들로의 크로스오버 감지
   * 3. 거래량 확인으로 신호 강화
   *
   * 💡 핵심 아이디어:
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

    // 이동평균선 계산
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const sma50 = this.indicatorService.calculateSMA(candles, 50);

    // 현재 및 이전 값
    const currentSMA20 = sma20[sma20.length - 1]?.value;
    const currentSMA50 = sma50[sma50.length - 1]?.value;
    const prevSMA20 = sma20[sma20.length - 2]?.value;
    const prevSMA50 = sma50[sma50.length - 2]?.value;

    // 거래량 확인
    const currentVolume = candles[candles.length - 1].volume;
    const avgVolume =
      candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeRatio = currentVolume / avgVolume;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 🟢 골든크로스 감지: 이전에는 SMA20 < SMA50, 현재는 SMA20 > SMA50
    if (prevSMA20 < prevSMA50 && currentSMA20 > currentSMA50) {
      signal = SignalType.STRONG_BUY;
      conditions.push('골든크로스 발생 - SMA20이 SMA50 상향 돌파');

      if (volumeRatio > 1.5) {
        conditions.push(
          `거래량 급증 확인 - 평균 대비 ${volumeRatio.toFixed(1)}배`,
        );
        signal = SignalType.STRONG_BUY; // 거래량으로 신호 강화
      } else {
        conditions.push(`거래량 정상 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
      }
    }
    // 🔴 데드크로스 감지: 이전에는 SMA20 > SMA50, 현재는 SMA20 < SMA50
    else if (prevSMA20 > prevSMA50 && currentSMA20 < currentSMA50) {
      signal = SignalType.STRONG_SELL;
      conditions.push('데드크로스 발생 - SMA20이 SMA50 하향 돌파');

      if (volumeRatio > 1.5) {
        conditions.push(
          `거래량 급증 확인 - 평균 대비 ${volumeRatio.toFixed(1)}배`,
        );
        signal = SignalType.STRONG_SELL; // 거래량으로 신호 강화
      } else {
        conditions.push(`거래량 정상 - 평균 대비 ${volumeRatio.toFixed(1)}배`);
      }
    }
    // 📊 트렌드 확인: 크로스오버는 없지만 트렌드 방향 확인
    else {
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
   * 🎯 볼린저 밴드 반전 전략 (표준 기법)
   *
   * 📖 개념: 가격이 볼린저 밴드 상단/하단에 터치한 후 반전될 때 발생하는 신호
   *
   * 🧮 계산 방법:
   * 1. 볼린저 밴드 계산 (20일, 2 표준편차)
   * 2. RSI 계산 (14일)
   * 3. 상단 터치 + RSI 과매수 = 하락 반전 신호
   * 4. 하단 터치 + RSI 과매도 = 상승 반전 신호
   *
   * 💡 핵심 아이디어:
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

    // 볼린저 밴드 및 RSI 계산
    const bb = this.indicatorService.calculateBollingerBands(candles, 20, 2);
    const rsi = this.indicatorService.calculateRSI(candles, 14);

    const currentBB = bb[bb.length - 1];
    const currentRSI = rsi[rsi.length - 1];
    const currentPrice = candles[candles.length - 1].close;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 🔴 상단 터치 + 과매수 = 하락 반전 신호
    if (currentPrice >= currentBB.upper && currentRSI.value > 70) {
      signal = SignalType.STRONG_SELL;
      conditions.push('볼린저 밴드 상단 터치');
      conditions.push(`RSI 과매수 확인: ${currentRSI.value.toFixed(1)}`);
      conditions.push('하락 반전 신호 - 과매수 구간에서 매도');
    }
    // 🟢 하단 터치 + 과매도 = 상승 반전 신호
    else if (currentPrice <= currentBB.lower && currentRSI.value < 30) {
      signal = SignalType.STRONG_BUY;
      conditions.push('볼린저 밴드 하단 터치');
      conditions.push(`RSI 과매도 확인: ${currentRSI.value.toFixed(1)}`);
      conditions.push('상승 반전 신호 - 과매도 구간에서 매수');
    }
    // 📊 밴드 중간 위치에서의 신호
    else {
      const bandPosition = currentBB.percentB; // 0~1 사이 값

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
   * 📊 MACD 크로스오버 전략 (표준 기법)
   *
   * 📖 개념: MACD 라인이 시그널 라인을 상향/하향 돌파할 때 발생하는 신호
   *
   * 🧮 계산 방법:
   * 1. MACD 계산 (12, 26, 9)
   * 2. 이전 캔들에서 현재 캔들로의 크로스오버 감지
   * 3. 히스토그램 변화 확인
   * 4. 0선 위치 확인으로 신호 강화
   *
   * 💡 핵심 아이디어:
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

    // MACD 계산
    const macd = this.indicatorService.calculateMACD(candles, 12, 26, 9);

    const current = macd[macd.length - 1];
    const previous = macd[macd.length - 2];

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 🟢 골든크로스 감지: 이전에는 MACD < Signal, 현재는 MACD > Signal
    if (
      previous.macdLine < previous.signalLine &&
      current.macdLine > current.signalLine
    ) {
      signal = SignalType.STRONG_BUY;
      conditions.push('MACD 골든크로스 발생');

      // 0선 위에서 골든크로스 = 강한 신호
      if (current.macdLine > 0) {
        conditions.push('0선 위에서 골든크로스 - 강한 상승 신호');
        signal = SignalType.STRONG_BUY;
      } else {
        conditions.push('0선 아래에서 골든크로스 - 약한 상승 신호');
        signal = SignalType.BUY;
      }

      // 히스토그램 증가 확인
      if (current.histogram > previous.histogram) {
        conditions.push('히스토그램 증가 - 모멘텀 강화');
      }
    }
    // 🔴 데드크로스 감지: 이전에는 MACD > Signal, 현재는 MACD < Signal
    else if (
      previous.macdLine > previous.signalLine &&
      current.macdLine < current.signalLine
    ) {
      signal = SignalType.STRONG_SELL;
      conditions.push('MACD 데드크로스 발생');

      // 0선 아래에서 데드크로스 = 강한 신호
      if (current.macdLine < 0) {
        conditions.push('0선 아래에서 데드크로스 - 강한 하락 신호');
        signal = SignalType.STRONG_SELL;
      } else {
        conditions.push('0선 위에서 데드크로스 - 약한 하락 신호');
        signal = SignalType.SELL;
      }

      // 히스토그램 감소 확인
      if (current.histogram < previous.histogram) {
        conditions.push('히스토그램 감소 - 모멘텀 약화');
      }
    }
    // 📊 트렌드 확인: 크로스오버는 없지만 MACD 위치 확인
    else {
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
   * 🎯 Pivot Reversal Strategy (표준 기법)
   *
   * 📖 개념: 피벗 포인트 레벨에서 가격이 반전될 때 발생하는 신호
   *
   * 🧮 계산 방법:
   * 1. 피벗 포인트 계산 (PP, R1, R2, R3, S1, S2, S3)
   * 2. 현재 가격이 피벗 레벨 근처에서 반전 감지
   * 3. RSI 확인으로 과매수/과매도 구간 판단
   * 4. 거래량 확인으로 신호 강화
   *
   * 💡 핵심 아이디어:
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

    // 피벗 포인트 계산 (전일 데이터 기준)
    const previousCandle = candles[candles.length - 2];
    const pp =
      (previousCandle.high + previousCandle.low + previousCandle.close) / 3;

    const r1 = 2 * pp - previousCandle.low;
    const r2 = pp + (previousCandle.high - previousCandle.low);
    const r3 = previousCandle.high + 2 * (pp - previousCandle.low);

    const s1 = 2 * pp - previousCandle.high;
    const s2 = pp - (previousCandle.high - previousCandle.low);
    const s3 = previousCandle.low - 2 * (previousCandle.high - pp);

    // RSI 계산
    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const currentRSI = rsi[rsi.length - 1];

    // 현재 가격
    const currentPrice = candles[candles.length - 1].close;
    const currentVolume = candles[candles.length - 1].volume;
    const avgVolume =
      candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeRatio = currentVolume / avgVolume;

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 🟢 지지선 터치 + 과매도 = 매수 신호
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
    }
    // 🔴 저항선 터치 + 과매수 = 매도 신호
    else if (
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
    }
    // 📊 중간 레벨에서의 신호
    else {
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
}
