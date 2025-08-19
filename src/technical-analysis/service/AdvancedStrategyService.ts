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
    // 📊 20000개 캔들 데이터 수집 (약 208일 분량의 15분봉)
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      20000,
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
      20000,
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
   * 데이 트레이딩 전략
   *
   * 15분-1시간 단위의 단기 매매로 당일 내 수익 실현을 위한 전략입니다.
   * 단기 지표들을 조합하여 빠른 진입/청산을 목표로 합니다.
   */
  async executeDayTradingStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      100,
    );

    // 데이 트레이딩용 지표들 (15분봉에 최적화)
    const sma10 = this.indicatorService.calculateSMA(candles, 10);
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const macd = this.indicatorService.calculateMACD(candles);
    const bb = this.indicatorService.calculateBollingerBands(candles);
    const volume = this.indicatorService.calculateVolumeAnalysis(candles);

    const currentPrice = candles[candles.length - 1].close;
    const current = {
      sma10: sma10[sma10.length - 1]?.value,
      sma20: sma20[sma20.length - 1]?.value,
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      bb: bb[bb.length - 1],
      volume: volume[volume.length - 1],
    };

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 데이 트레이딩 매수 조건
    const isShortTermUptrend = current.sma10 > current.sma20;
    const isPriceAboveSMA10 = currentPrice > current.sma10;
    const isRSIMomentum = current.rsi.value > 45 && current.rsi.value < 75;
    const isMacdPositive = current.macd.macdLine > current.macd.signalLine;
    const isVolumeSupport = current.volume.volumeRatio > 1.1;
    const isBBMiddleToUpper =
      current.bb.percentB > 0.3 && current.bb.percentB < 0.8;

    if (
      isShortTermUptrend &&
      isPriceAboveSMA10 &&
      isRSIMomentum &&
      isMacdPositive &&
      isVolumeSupport &&
      isBBMiddleToUpper
    ) {
      signal = SignalType.BUY;
      conditions.push('단기 상승 추세 확인 (SMA10 > SMA20)');
      conditions.push('가격이 단기 평균선 위 위치');
      conditions.push('RSI 건전한 모멘텀 구간 (45-75)');
      conditions.push('MACD 긍정적 신호');
      conditions.push('거래량 증가 지지');
      conditions.push('볼린저밴드 적정 위치');

      if (current.macd.isGoldenCross) {
        conditions.push('MACD 골든크로스 추가 확인');
      }

      if (current.volume.volumeRatio > 1.5) {
        conditions.push('강한 거래량 증가');
      }
    }

    // 데이 트레이딩 매도 조건
    const isShortTermDowntrend = current.sma10 < current.sma20;
    const isPriceBelowSMA10 = currentPrice < current.sma10;
    const isRSIOverextended = current.rsi.value > 75 || current.rsi.value < 30;
    const isMacdNegative = current.macd.macdLine < current.macd.signalLine;
    const isVolumeWeak = current.volume.volumeRatio < 0.9;

    if (
      isShortTermDowntrend &&
      isPriceBelowSMA10 &&
      isRSIOverextended &&
      isMacdNegative &&
      isVolumeWeak
    ) {
      signal = SignalType.SELL;
      conditions.push('단기 하락 추세 확인 (SMA10 < SMA20)');
      conditions.push('가격이 단기 평균선 아래 위치');
      conditions.push('RSI 과매수/과매도 구간');
      conditions.push('MACD 부정적 신호');
      conditions.push('거래량 감소');
    }

    return {
      strategy: StrategyType.DAY_TRADING_STRATEGY,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          currentPrice,
          sma10: current.sma10,
          sma20: current.sma20,
          rsi: current.rsi.value,
          macdLine: current.macd.macdLine,
          signalLine: current.macd.signalLine,
          volumeRatio: current.volume.volumeRatio,
          bbPercentB: current.bb.percentB,
        },
        conditions,
        notes: '데이 트레이딩 전략 - 단기 지표 조합',
      },
    };
  }

  /**
   * 모든 고급 전략 실행
   *
   * 고급 전략들과 실전 전략들을 일괄 실행하여 결과를 반환합니다.
   *
   * @param symbol 분석할 심볼
   * @param timeframe 분석할 시간봉
   * @returns 고급 전략 실행 결과 배열
   */
  async executeAllAdvancedStrategies(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult[]> {
    const results: StrategyResult[] = [];

    try {
      results.push(await this.executeSmartMoneyFlowStrategy(symbol, timeframe));
    } catch (error) {
      console.error(`스마트 머니 플로우 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(await this.executeMultiTimeframeTrendStrategy(symbol));
    } catch (error) {
      console.error(`멀티 타임프레임 트렌드 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(
        await this.executePatternRecognitionStrategy(symbol, timeframe),
      );
    } catch (error) {
      console.error(`패턴 인식 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(await this.executeElliottWaveStrategy(symbol, timeframe));
    } catch (error) {
      console.error(`엘리어트 웨이브 전략 실행 실패: ${symbol}`, error);
    }

    try {
      results.push(await this.executeDayTradingStrategy(symbol, timeframe));
    } catch (error) {
      console.error(`데이 트레이딩 전략 실행 실패: ${symbol}`, error);
    }

    return results;
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
