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
 * 🎯 실전 전략 서비스
 *
 * 실제 트레이딩에서 자주 사용되는 검증된 전략들을 구현합니다.
 * 각 전략은 리스크 관리와 수익률 최적화에 중점을 둡니다.
 */
@Injectable()
export class PracticalStrategyService {
  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly indicatorService: TechnicalIndicatorService,
  ) {}

  /**
   * 📊 데이 트레이딩 전략
   * 15분-1시간 단위의 단기 매매로 당일 내 수익 실현
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
    const sma10 = this.indicatorService.calculateSMA(candles, 10); // 단기
    const sma20 = this.indicatorService.calculateSMA(candles, 20); // 중기
    const rsi = this.indicatorService.calculateRSI(candles, 14); // 표준 RSI
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

    // 데이 트레이딩 매수 조건 (15분봉 기준)
    const isShortTermUptrend = current.sma10 > current.sma20; // 단기 상승 추세
    const isPriceAboveSMA10 = currentPrice > current.sma10; // 가격이 단기 평균 위
    const isRSIMomentum = current.rsi.value > 45 && current.rsi.value < 75; // 건전한 모멘텀
    const isMacdPositive = current.macd.macdLine > current.macd.signalLine; // MACD 긍정적
    const isVolumeSupport = current.volume.volumeRatio > 1.1; // 거래량 지지
    const isBBMiddleToUpper =
      current.bb.percentB > 0.3 && current.bb.percentB < 0.8; // 볼린저 중간~상단

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

      // 추가 확인 조건들
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
      isShortTermDowntrend ||
      isPriceBelowSMA10 ||
      isRSIOverextended ||
      (isMacdNegative && isVolumeWeak)
    ) {
      signal = SignalType.SELL;
      conditions.push('데이 트레이딩 청산 조건 충족');

      if (isShortTermDowntrend) conditions.push('단기 하락 추세 전환');
      if (isPriceBelowSMA10) conditions.push('단기 평균선 이탈');
      if (isRSIOverextended) conditions.push('RSI 과매수/과매도');
      if (isMacdNegative && isVolumeWeak)
        conditions.push('MACD 약세 + 거래량 감소');
    }

    return {
      strategy: StrategyType.DAY_TRADING_STRATEGY,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          sma10: current.sma10,
          sma20: current.sma20,
          rsi: current.rsi.value,
          macdLine: current.macd.macdLine,
          macdSignal: current.macd.signalLine,
          bbPercentB: current.bb.percentB,
          volumeRatio: current.volume.volumeRatio,
        },
        conditions,
        notes: '데이 트레이딩 전략 - 당일 내 진입/청산',
      },
      entryPrice: signal === SignalType.BUY ? currentPrice : undefined,
      stopLoss: signal === SignalType.BUY ? current.sma20 * 0.985 : undefined, // SMA20 아래 1.5%
      takeProfit: signal === SignalType.BUY ? currentPrice * 1.025 : undefined, // 2.5% 목표
    };
  }

  /**
   * 🌊 스윙 트레이딩 전략
   * 며칠~몇 주 단위의 중기 트렌드를 활용한 매매
   */
  async executeSwingTradingStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      200,
    );

    // 스윙 트레이딩용 지표들
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const sma50 = this.indicatorService.calculateSMA(candles, 50);
    const rsi = this.indicatorService.calculateRSI(candles, 14);
    const macd = this.indicatorService.calculateMACD(candles);
    const bb = this.indicatorService.calculateBollingerBands(candles);

    const currentPrice = candles[candles.length - 1].close;
    const current = {
      sma20: sma20[sma20.length - 1]?.value,
      sma50: sma50[sma50.length - 1]?.value,
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      bb: bb[bb.length - 1],
    };

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 스윙 매수 조건 (트렌드 + 조정 완료)
    const isTrendUp = current.sma20 > current.sma50;
    const isPullbackComplete =
      currentPrice > current.sma20 && currentPrice < current.bb.upper;
    const isMacdPositive = current.macd.isGoldenCross;
    const isRsiHealthy = current.rsi.value > 40 && current.rsi.value < 70;

    if (isTrendUp && isPullbackComplete && isMacdPositive && isRsiHealthy) {
      signal = SignalType.BUY;
      conditions.push('상승 트렌드 확인 (SMA20 > SMA50)');
      conditions.push('조정 완료 후 재상승 시작');
      conditions.push('MACD 골든크로스 확인');
      conditions.push('RSI 건전한 수준');

      // 볼린저밴드 위치 확인
      if (current.bb.percentB > 0.2 && current.bb.percentB < 0.8) {
        conditions.push('볼린저밴드 중간 위치 (안전 구간)');
      }
    }

    // 스윙 매도 조건
    const isTrendDown = current.sma20 < current.sma50;
    const isOverextended = current.bb.percentB > 0.9;
    const isRsiOverbought = current.rsi.value > 75;

    if (isTrendDown || isOverextended || isRsiOverbought) {
      signal = SignalType.SELL;
      conditions.push('스윙 매도 조건 충족');

      if (isTrendDown) conditions.push('트렌드 전환 감지');
      if (isOverextended) conditions.push('과도한 상승 (볼린저 상단)');
      if (isRsiOverbought) conditions.push('RSI 과매수');
    }

    return {
      strategy: StrategyType.SWING_TRADING,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          sma20: current.sma20,
          sma50: current.sma50,
          rsi: current.rsi.value,
          macdGolden: current.macd.isGoldenCross ? 1 : 0,
          bbPercentB: current.bb.percentB,
        },
        conditions,
        notes: '스윙 트레이딩 - 중기 트렌드 추종',
      },
      entryPrice: signal === SignalType.BUY ? currentPrice : undefined,
      stopLoss: signal === SignalType.BUY ? current.sma50 * 0.98 : undefined, // SMA50 아래 2%
      takeProfit: signal === SignalType.BUY ? currentPrice * 1.08 : undefined, // 8% 목표
    };
  }

  /**
   * 📊 포지션 트레이딩 전략
   * 몇 주~몇 달 단위의 장기 트렌드 추종
   */
  async executePositionTradingStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      300,
    );

    // 장기 트렌드 분석용 지표들
    const sma50 = this.indicatorService.calculateSMA(candles, 50);
    const sma200 = this.indicatorService.calculateSMA(candles, 200);
    const rsi = this.indicatorService.calculateRSI(candles, 21); // 장기 RSI
    const macd = this.indicatorService.calculateMACD(candles);

    const currentPrice = candles[candles.length - 1].close;
    const current = {
      sma50: sma50[sma50.length - 1]?.value,
      sma200: sma200[sma200.length - 1]?.value,
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
    };

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 장기 상승 트렌드 확인
    const isLongTermBullish = current.sma50 > current.sma200;
    const isPriceAboveMAs =
      currentPrice > current.sma50 && currentPrice > current.sma200;
    const isMacdBullish =
      current.macd.macdLine > 0 && current.macd.isGoldenCross;
    const isRsiStrong = current.rsi.value > 50;

    if (isLongTermBullish && isPriceAboveMAs && isMacdBullish && isRsiStrong) {
      signal = SignalType.STRONG_BUY;
      conditions.push('장기 상승 트렌드 확인 (SMA50 > SMA200)');
      conditions.push('가격이 주요 이동평균선 위 위치');
      conditions.push('MACD 강세 신호');
      conditions.push('RSI 강세 구간');

      // 골든크로스 추가 확인
      const previous50 = sma50[sma50.length - 2]?.value;
      const previous200 = sma200[sma200.length - 2]?.value;
      if (current.sma50 > current.sma200 && previous50 <= previous200) {
        conditions.push('🌟 골든크로스 발생 (SMA50 > SMA200)');
      }
    }

    // 장기 하락 트렌드 또는 약세 전환
    const isLongTermBearish = current.sma50 < current.sma200;
    const isPriceBelowMAs = currentPrice < current.sma50;
    const isMacdBearish = current.macd.macdLine < 0;

    if (isLongTermBearish && isPriceBelowMAs && isMacdBearish) {
      signal = SignalType.STRONG_SELL;
      conditions.push('장기 하락 트렌드 또는 약세 전환');
    }

    return {
      strategy: StrategyType.POSITION_TRADING,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          sma50: current.sma50,
          sma200: current.sma200,
          rsi: current.rsi.value,
          macdLine: current.macd.macdLine,
          isGoldenCross: isLongTermBullish ? 1 : 0,
        },
        conditions,
        notes: '포지션 트레이딩 - 장기 트렌드 추종',
      },
      entryPrice: signal === SignalType.STRONG_BUY ? currentPrice : undefined,
      stopLoss:
        signal === SignalType.STRONG_BUY ? current.sma200 * 0.95 : undefined, // SMA200 아래 5%
      takeProfit:
        signal === SignalType.STRONG_BUY ? currentPrice * 1.25 : undefined, // 25% 목표
    };
  }

  /**
   * 🔄 평균 회귀 전략
   * 가격이 평균에서 과도하게 벗어났을 때 반대 방향 베팅
   */
  async executeMeanReversionStrategy(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult> {
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      100,
    );

    // 평균 회귀 분석용 지표들
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const bb = this.indicatorService.calculateBollingerBands(candles);
    const rsi = this.indicatorService.calculateRSI(candles, 14);

    const currentPrice = candles[candles.length - 1].close;
    const current = {
      sma20: sma20[sma20.length - 1]?.value,
      bb: bb[bb.length - 1],
      rsi: rsi[rsi.length - 1],
    };

    let signal = SignalType.NEUTRAL;
    const conditions: string[] = [];

    // 과매도 상태에서 평균 회귀 매수
    const isOversold = current.bb.percentB < 0.1; // 볼린저 하단 근처
    const isRsiOversold = current.rsi.value < 25; // 극도 과매도
    const isPriceBelowMA = currentPrice < current.sma20 * 0.98; // MA 아래 2%

    if (isOversold && isRsiOversold && isPriceBelowMA) {
      signal = SignalType.BUY;
      conditions.push('극도 과매도 상태 - 평균 회귀 예상');
      conditions.push(`볼린저 %B: ${(current.bb.percentB * 100).toFixed(1)}%`);
      conditions.push(`RSI: ${current.rsi.value.toFixed(1)} (극도 과매도)`);

      // 추가 확인: 볼린저밴드 수축
      if (current.bb.bandwidth < 0.05) {
        conditions.push('볼린저밴드 수축 - 변동성 확대 예상');
      }
    }

    // 과매수 상태에서 평균 회귀 매도
    const isOverbought = current.bb.percentB > 0.9; // 볼린저 상단 근처
    const isRsiOverbought = current.rsi.value > 75; // 극도 과매수
    const isPriceAboveMA = currentPrice > current.sma20 * 1.02; // MA 위 2%

    if (isOverbought && isRsiOverbought && isPriceAboveMA) {
      signal = SignalType.SELL;
      conditions.push('극도 과매수 상태 - 평균 회귀 예상');
      conditions.push(`볼린저 %B: ${(current.bb.percentB * 100).toFixed(1)}%`);
      conditions.push(`RSI: ${current.rsi.value.toFixed(1)} (극도 과매수)`);
    }

    return {
      strategy: StrategyType.MEAN_REVERSION,
      symbol,
      timeframe,
      signal,
      timestamp: Date.now(),
      details: {
        indicators: {
          sma20: current.sma20,
          bbPercentB: current.bb.percentB,
          bbBandwidth: current.bb.bandwidth,
          rsi: current.rsi.value,
        },
        conditions,
        notes: '평균 회귀 전략 - 극단 상황 역방향 베팅',
      },
      entryPrice: currentPrice,
      stopLoss:
        signal === SignalType.BUY
          ? current.bb.lower * 0.99
          : signal === SignalType.SELL
            ? current.bb.upper * 1.01
            : undefined,
      takeProfit:
        signal === SignalType.BUY
          ? current.sma20
          : signal === SignalType.SELL
            ? current.sma20
            : undefined,
    };
  }

  /**
   * 🎯 통합 실전 전략 실행
   * 모든 실전 전략을 실행하고 최적의 신호를 선택
   */
  async executeAllPracticalStrategies(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<StrategyResult[]> {
    console.log(`🎯 통합 실전 전략 실행: ${symbol} ${timeframe}`);

    const strategies = [
      this.executeDayTradingStrategy(symbol, timeframe),
      this.executeSwingTradingStrategy(symbol, timeframe),
      this.executePositionTradingStrategy(symbol, timeframe),
      this.executeMeanReversionStrategy(symbol, timeframe),
    ];

    const results = await Promise.all(strategies);

    console.log(`✅ 실전 전략 실행 완료: ${results.length}개 전략`);
    results.forEach((result, index) => {
      if (result.signal !== 'NEUTRAL') {
        console.log(`${index + 1}. ${result.strategy}: ${result.signal}`);
      }
    });

    return results;
  }
}
