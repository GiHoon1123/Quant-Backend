import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { AnalysisCompletedEvent } from '../../common/dto/event/AnalysisCompletedEvent';
import technicalAnalysisConfig from '../../config/TechnicalAnalysisConfig';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
import { TechnicalAnalysisMapper } from '../mapper/TechnicalAnalysisMapper';
import {
  MultiStrategyResult,
  SignalType,
  StrategyResult,
  StrategyType,
} from '../types/StrategyTypes';
import { TimeFrame } from '../types/TechnicalAnalysisTypes';

import { AdvancedStrategyService } from './AdvancedStrategyService';
import { BasicStrategyService } from './BasicStrategyService';
import { TechnicalIndicatorService } from './TechnicalIndicatorService';

/**
 * 기술적 분석 메인 서비스
 *
 * 모든 기술적 분석 기능들을 통합하는 파사드(Facade) 서비스입니다.
 * 외부에서는 이 서비스를 통해 모든 기술적 분석 기능에 접근할 수 있습니다.
 *
 * 🎯 주요 기능:
 * - 통합된 전략 분석 인터페이스
 * - 다중 심볼 및 시간봉 배치 분석
 * - 실시간 신호 모니터링
 * - 성과 추적 및 백테스팅
 *
 * 🚀 사용 시나리오:
 * - 단일 코인 종합 분석
 * - 여러 코인 스크리닝
 * - 실시간 알림 시스템
 * - 자동 매매 신호 생성
 */
@Injectable()
export class TechnicalAnalysisService {
  private readonly logger = new Logger(TechnicalAnalysisService.name);
  private readonly DEFAULT_SYMBOLS: string[];
  private readonly ALERT_THRESHOLD: number;

  // 기본 전략 세트
  private readonly DEFAULT_STRATEGIES = [
    StrategyType.MA_20_BREAKOUT,
    StrategyType.MA_50_BREAKOUT,
    StrategyType.MA_200_BREAKOUT,
    StrategyType.GOLDEN_CROSS_50_200,
    StrategyType.RSI_OVERSOLD_BOUNCE,
    StrategyType.MACD_GOLDEN_CROSS,
    StrategyType.BOLLINGER_UPPER_BREAK,
    StrategyType.VOLUME_SURGE_UP,
    StrategyType.TRIPLE_CONFIRMATION,
  ];

  // 기본 시간봉 세트
  private readonly DEFAULT_TIMEFRAMES = [
    TimeFrame.FIFTEEN_MINUTES,
    TimeFrame.ONE_HOUR,
    TimeFrame.ONE_DAY,
  ];
  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly basicStrategyService: BasicStrategyService,
    private readonly advancedStrategyService: AdvancedStrategyService,
    private readonly indicatorService: TechnicalIndicatorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    const config = technicalAnalysisConfig();
    this.DEFAULT_SYMBOLS = this.configService.get<string[]>(
      'technicalAnalysis.defaultSymbols',
      config.defaultSymbols,
    );

    this.ALERT_THRESHOLD = this.configService.get<number>(
      'technicalAnalysis.alertThreshold',
      config.alertThreshold,
    );
  }

  /**
   * 단일 심볼 종합 분석
   *
   * @param symbol 분석할 심볼 (예: BTCUSDT)
   * @param strategies 실행할 전략들 (선택사항)
   * @param timeframes 분석할 시간봉들 (선택사항)
   * @returns 종합 분석 결과
   *
   * 🎯 활용:
   * - 특정 코인의 현재 상황 파악
   * - 진입/청산 타이밍 결정
   * - 리스크 평가
   *
   * 💡 사용 예시:
   * ```typescript
   * const analysis = await service.analyzeSymbol('BTCUSDT');
   * if (analysis.overallSignal === SignalType.BUY) {
   *   // 매수 신호 처리
   * }
   * ```
   */
  async analyzeSymbol(
    symbol: string,
    strategies: StrategyType[] = this.DEFAULT_STRATEGIES,
    timeframes: TimeFrame[] = this.DEFAULT_TIMEFRAMES,
  ): Promise<any> {
    this.logger.log(`🔍 심볼 종합 분석 시작: ${symbol}`);
    this.logger.log(
      `📊 전략: ${strategies.length}개, 시간봉: ${timeframes.length}개`,
    );

    try {
      const basicResults =
        await this.basicStrategyService.executeAllBasicStrategies(
          symbol,
          timeframes[0],
        );
      const advancedResults =
        await this.advancedStrategyService.executeAllAdvancedStrategies(
          symbol,
          timeframes[0],
        );

      const allResults = [...basicResults, ...advancedResults];
      const buySignals = allResults.filter(
        (r) => r.signal === 'BUY' || r.signal === 'STRONG_BUY',
      ).length;
      const sellSignals = allResults.filter(
        (r) => r.signal === 'SELL' || r.signal === 'STRONG_SELL',
      ).length;

      let overallSignal = SignalType.NEUTRAL;
      if (buySignals > sellSignals) overallSignal = SignalType.BUY;
      else if (sellSignals > buySignals) overallSignal = SignalType.SELL;

      const result = {
        symbol,
        timestamp: Date.now(),
        overallSignal,
        strategies: allResults,
        consensus:
          buySignals > sellSignals
            ? buySignals / allResults.length
            : sellSignals / allResults.length,
        timeframeSummary: {
          [timeframes[0]]: {
            signal: overallSignal,
            strategyCount: allResults.length,
          },
        },
      };
      this.logAnalysisResult(symbol, result);
      // 이벤트 발행 (공통 DTO 적용)
      const analysisCompletedEvent: AnalysisCompletedEvent = {
        eventId: uuidv4(),
        service: 'TechnicalAnalysisService',
        symbol,
        signal: result.overallSignal,
        analyzedAt: new Date(),
        timestamp: new Date(),
      };
      this.eventEmitter.emit(
        'technical.analysis.completed',
        analysisCompletedEvent,
      );
      // 매퍼 적용
      return TechnicalAnalysisMapper.toResultResponseFromMulti(result);
    } catch (error) {
      this.logger.error(`❌ 심볼 분석 실패: ${symbol}`, error);
      throw new Error(`${symbol} 분석에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * 다중 심볼 스크리닝
   *
   * @param symbols 분석할 심볼들 (선택사항, 기본값: 주요 10개 코인)
   * @param strategies 실행할 전략들 (선택사항)
   * @param timeframes 분석할 시간봉들 (선택사항)

   * @returns 심볼별 분석 결과 맵
   *
   * 🎯 활용:
   * - 매수 기회 스크리닝
   * - 시장 전체 동향 파악
   * - 상대적 강도 비교
   *
   * 💡 사용 예시:
   * ```typescript
   * const screening = await service.screenMultipleSymbols();
   * const buySignals = Array.from(screening.entries())
   *   .filter(([_, result]) => result.overallSignal === SignalType.BUY);
   * ```
   */
  async screenMultipleSymbols(
    symbols: string[] = this.DEFAULT_SYMBOLS,
    strategies: StrategyType[] = this.DEFAULT_STRATEGIES,
    timeframes: TimeFrame[] = this.DEFAULT_TIMEFRAMES,
  ): Promise<Map<string, MultiStrategyResult>> {
    this.logger.log(`🔍 다중 심볼 스크리닝 시작: ${symbols.length}개 심볼`);

    const results = new Map<string, MultiStrategyResult>();
    const errors: string[] = [];

    // 병렬 처리로 성능 최적화 (배치 크기 제한)
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      const batchPromises = batch.map(async (symbol) => {
        try {
          const result = await this.analyzeSymbol(
            symbol,
            strategies,
            timeframes,
          );

          results.set(symbol, result);
          this.logger.log(`✅ ${symbol}: ${result.overallSignal}`);
        } catch (error) {
          const errorMsg = `${symbol}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.warn(`⚠️ ${errorMsg}`);
        }
      });

      await Promise.all(batchPromises);

      // 배치 간 짧은 대기 (API 레이트 리밋 고려)
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(`✅ 다중 심볼 스크리닝 완료: ${results.size}개 유효 결과`);
    if (errors.length > 0) {
      this.logger.warn(`⚠️ 실패한 심볼들: ${errors.join(', ')}`);
    }

    return results;
  }

  /**
   * 강한 매수 신호 검색
   *
   * @param symbols 검색할 심볼들 (선택사항)

   * @returns 강한 매수 신호가 있는 심볼들과 분석 결과
   *
   * 🎯 활용:
   * - 즉시 매수 가능한 종목 찾기
   * - 고확률 기회 포착
   * - 알림 시스템 트리거
   */
  async findStrongBuySignals(
    symbols: string[] = this.DEFAULT_SYMBOLS,
  ): Promise<Array<{ symbol: string; result: MultiStrategyResult }>> {
    this.logger.log(`🔍 강한 매수 신호 검색: ${symbols.length}개 심볼`);

    const screening = await this.screenMultipleSymbols(
      symbols,
      undefined,
      undefined,
    );

    const strongBuySignals = Array.from(screening.entries())
      .filter(
        ([_, result]) =>
          result.overallSignal === SignalType.STRONG_BUY ||
          result.overallSignal === SignalType.BUY,
      )
      .map(([symbol, result]) => ({ symbol, result }));

    this.logger.log(`🎯 강한 매수 신호 발견: ${strongBuySignals.length}개`);
    strongBuySignals.forEach(({ symbol, result }) => {
      this.logger.log(
        `🚀 ${symbol}: ${result.overallSignal} (합의도: ${result.consensus})`,
      );
    });

    // 이벤트 발행
    if (strongBuySignals.length > 0) {
      this.eventEmitter.emit('technical.strong.buy.signal', {
        eventId: uuidv4(),
        service: 'TechnicalAnalysisService',
        symbols: strongBuySignals.map((s) => s.symbol),
        timestamp: new Date(),
      });
    }

    return strongBuySignals;
  }

  /**
   * 특정 전략의 전체 심볼 스캔
   *
   * @param strategy 실행할 전략
   * @param timeframe 분석할 시간봉
   * @param symbols 스캔할 심볼들 (선택사항)
   * @returns 전략별 심볼 결과들
   *
   * 🎯 활용:
   * - 특정 전략 성과 분석
   * - 전략별 기회 탐색
   * - 백테스팅 데이터 수집
   */
  async scanStrategyAcrossSymbols(
    strategy: StrategyType,
    timeframe: TimeFrame,
    symbols: string[] = this.DEFAULT_SYMBOLS,
  ): Promise<StrategyResult[]> {
    this.logger.log(
      `🔍 전략 스캔: ${strategy} - ${timeframe} (${symbols.length}개 심볼)`,
    );

    const results: StrategyResult[] = [];
    const errors: string[] = [];

    for (const symbol of symbols) {
      try {
        const basicResults =
          await this.basicStrategyService.executeAllBasicStrategies(
            symbol,
            timeframe,
          );
        const advancedResults =
          await this.advancedStrategyService.executeAllAdvancedStrategies(
            symbol,
            timeframe,
          );
        const allResults = [...basicResults, ...advancedResults];
        const result =
          allResults.find((r) => r.strategy === strategy) || allResults[0];
        results.push(result);
      } catch (error) {
        errors.push(`${symbol}: ${error.message}`);
      }
    }

    this.logger.log(`✅ 전략 스캔 완료: ${results.length}개 결과`);
    if (errors.length > 0) {
      this.logger.warn(`⚠️ 실패: ${errors.length}개 심볼`);
    }

    // 상위 결과들 로깅
    results.slice(0, 5).forEach((result, index) => {
      this.logger.log(`${index + 1}. ${result.symbol}: ${result.signal}`);
    });

    return results;
  }

  /**
   * 실시간 시장 모니터링
   *
   * @param symbols 모니터링할 심볼들
   * @param alertThreshold 알림 신뢰도 임계값
   * @returns 알림이 필요한 심볼들
   *
   * 🎯 활용:
   * - 실시간 기회 모니터링
   * - 자동 알림 시스템
   * - 시장 변화 감지
   */
  async monitorMarket(
    symbols: string[] = this.DEFAULT_SYMBOLS,
  ): Promise<
    Array<{ symbol: string; alert: string; result: MultiStrategyResult }>
  > {
    this.logger.log(`📡 실시간 시장 모니터링: ${symbols.length}개 심볼`);

    const alerts: Array<{
      symbol: string;
      alert: string;
      result: MultiStrategyResult;
    }> = [];

    // 빠른 스크리닝 (1분봉 + 15분봉만 사용)
    const quickTimeframes = [TimeFrame.ONE_MINUTE, TimeFrame.FIFTEEN_MINUTES];
    const quickStrategies = [
      StrategyType.MA_20_BREAKOUT,
      StrategyType.RSI_OVERSOLD_BOUNCE,
      StrategyType.VOLUME_SURGE_UP,
    ];

    const screening = await this.screenMultipleSymbols(
      symbols,
      quickStrategies,
      quickTimeframes,
    );

    const screeningEntries = Array.from(screening.entries());
    for (const [symbol, result] of screeningEntries) {
      let alertMessage = '';

      if (result.overallSignal === SignalType.STRONG_BUY) {
        alertMessage = `🚀 강한 매수 신호`;
      } else if (result.overallSignal === SignalType.BUY) {
        alertMessage = `📈 매수 신호`;
      } else if (result.overallSignal === SignalType.STRONG_SELL) {
        alertMessage = `🔴 강한 매도 신호`;
      }

      if (alertMessage) {
        alerts.push({ symbol, alert: alertMessage, result });
      }
    }

    this.logger.log(`🚨 알림 발생: ${alerts.length}개`);
    alerts.forEach(({ symbol, alert }) => {
      this.logger.log(`🔔 ${symbol}: ${alert}`);
    });

    // 이벤트 발행
    if (alerts.length > 0) {
      this.eventEmitter.emit('technical.market.alert', {
        eventId: uuidv4(),
        service: 'TechnicalAnalysisService',
        symbols: alerts.map((a) => a.symbol),
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * 기술적 지표 요약 조회
   *
   * @param symbol 조회할 심볼
   * @param timeframe 조회할 시간봉
   * @returns 주요 지표들의 현재 값
   *
   * 🎯 활용:
   * - 대시보드 표시용
   * - 빠른 현황 파악
   * - 지표 모니터링
   */ async getIndicatorSummary(symbol: string, timeframe: TimeFrame) {
    this.logger.log(`📊 지표 요약 조회: ${symbol} ${timeframe}`);

    // Market-data 도메인의 저장된 데이터 조회
    const candles = await this.candleRepository.findLatestCandles(
      symbol,
      'FUTURES',
      200,
    );

    // 주요 지표들 계산
    const sma20 = this.indicatorService.calculateSMA(candles, 20);
    const sma50 = this.indicatorService.calculateSMA(candles, 50);
    const sma200 = this.indicatorService.calculateSMA(candles, 200);
    const rsi = this.indicatorService.calculateRSI(candles);
    const macd = this.indicatorService.calculateMACD(candles);
    const bb = this.indicatorService.calculateBollingerBands(candles);
    const volume = this.indicatorService.calculateVolumeAnalysis(candles);

    const currentPrice = candles[candles.length - 1].close;
    const current = {
      sma20: sma20[sma20.length - 1]?.value,
      sma50: sma50[sma50.length - 1]?.value,
      sma200: sma200[sma200.length - 1]?.value,
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      bb: bb[bb.length - 1],
      volume: volume[volume.length - 1],
    };

    const summary = {
      symbol,
      timeframe,
      timestamp: Date.now(),
      currentPrice,
      indicators: {
        // 이동평균선 위치
        priceVsMA: {
          above20MA: currentPrice > current.sma20,
          above50MA: currentPrice > current.sma50,
          above200MA: currentPrice > current.sma200,
          ma20: current.sma20,
          ma50: current.sma50,
          ma200: current.sma200,
        },

        // RSI 상태
        rsi: {
          value: current.rsi.value,
          isOversold: current.rsi.isOversold,
          isOverbought: current.rsi.isOverbought,
          interpretation: current.rsi.isOversold
            ? '과매도'
            : current.rsi.isOverbought
              ? '과매수'
              : '중립',
        },

        // MACD 상태
        macd: {
          line: current.macd.macdLine,
          signal: current.macd.signalLine,
          histogram: current.macd.histogram,
          isGoldenCross: current.macd.isGoldenCross,
          interpretation: current.macd.isGoldenCross ? '강세' : '약세',
        },

        // 볼린저밴드 위치
        bollinger: {
          upper: current.bb.upper,
          middle: current.bb.middle,
          lower: current.bb.lower,
          percentB: current.bb.percentB,
          position:
            current.bb.percentB > 0.8
              ? '상단근접'
              : current.bb.percentB < 0.2
                ? '하단근접'
                : '중간위치',
        },

        // 거래량 분석
        volume: {
          ratio: current.volume.volumeRatio,
          isSurge: current.volume.isVolumeSurge,
          obv: current.volume.obv,
          interpretation: current.volume.isVolumeSurge
            ? '급증'
            : current.volume.volumeRatio > 1.5
              ? '증가'
              : '평균',
        },
      },
    };

    this.logger.log(`✅ 지표 요약 완료: ${symbol} ${timeframe}`);
    return summary;
  }

  /**
   * 분석 결과 로깅 (private)
   */
  private logAnalysisResult(symbol: string, result: MultiStrategyResult): void {
    this.logger.log(`\n📈 === ${symbol} 분석 결과 ===`);
    this.logger.log(`🎯 종합 신호: ${result.overallSignal}`);

    this.logger.log(`🤝 합의도: ${(result.consensus * 100).toFixed(1)}%`);

    // 시간봉별 요약
    this.logger.log(`\n⏰ 시간봉별 요약:`);
    Object.entries(result.timeframeSummary).forEach(([tf, summary]) => {
      this.logger.log(
        `  ${tf}: ${summary.signal} - ${summary.strategyCount}개 전략`,
      );
    });

    // 주요 신호들만 표시
    const significantResults = result.strategies
      .filter((s) => s.signal !== 'NEUTRAL')
      .slice(0, 5);

    if (significantResults.length > 0) {
      this.logger.log(`\n🔍 주요 신호들:`);
      significantResults.forEach((s, index) => {
        this.logger.log(
          `  ${index + 1}. ${s.strategy}: ${s.signal} - ${s.timeframe}`,
        );
      });
    }

    this.logger.log(`===============================\n`);
  }
}
