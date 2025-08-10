import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ExchangeRateService } from '../../common/service/ExchangeRateService';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
import {
  CandleSavedEvent,
  MARKET_DATA_EVENTS,
  TechnicalAnalysisCompletedEvent,
} from '../../market-data/types/MarketDataEvents';
import { TimeFrame } from '../types/TechnicalAnalysisTypes';
import { AdvancedStrategyService } from './AdvancedStrategyService';
import { PracticalStrategyService } from './PracticalStrategyService';
import { RiskManagementService } from './RiskManagementService';
import { TechnicalAnalysisService } from './TechnicalAnalysisService';
import { TechnicalIndicatorService } from './TechnicalIndicatorService';

/**
 * 🔍 기술적 분석 이벤트 처리 서비스
 *
 * 🎯 **핵심 책임**: 이벤트 기반 기술적 분석 실행
 * - market-data 도메인의 candle.saved 이벤트 수신
 * - 새로운 캔들 데이터 기반으로 기술적 분석 실행
 * - 분석 완료 후 analysis.completed 이벤트 발송
 *
 * 🔄 **이벤트 플로우**:
 * candle.saved 수신 → 기술적 분석 실행 → analysis.completed 발송
 *
 * 📡 **수신 이벤트**:
 * - candle.saved: 캔들 저장 완료 시
 *
 * 📡 **발송 이벤트**:
 * - analysis.completed: 분석 완료 시
 */
@Injectable()
export class TechnicalAnalysisEventService implements OnModuleInit {
  private readonly eventEmitter: EventEmitter;

  constructor(
    private readonly technicalAnalysisService: TechnicalAnalysisService,
    private readonly technicalIndicatorService: TechnicalIndicatorService,
    private readonly candleRepository: Candle15MRepository,
    private readonly advancedStrategyService: AdvancedStrategyService,
    private readonly practicalStrategyService: PracticalStrategyService,
    private readonly riskManagementService: RiskManagementService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {
    this.eventEmitter = new EventEmitter();
    console.log(
      '🔍 [TechnicalAnalysisEventService] 기술적 분석 이벤트 서비스 초기화',
    );
  }

  /**
   * 모듈 초기화 시 이벤트 핸들러 설정
   */
  async onModuleInit(): Promise<void> {
    // Market-data 도메인의 EventEmitter와 연결은
    // AppModule에서 처리됩니다.
    console.log('🔍 [TechnicalAnalysisEventService] 이벤트 핸들러 준비 완료');
  }

  /**
   * 📡 Market-data 도메인의 EventEmitter 연결
   *
   * AppModule에서 의존성 주입 후 호출됩니다.
   *
   * @param marketDataEventEmitter Market-data 도메인의 EventEmitter
   */
  connectToMarketDataEvents(marketDataEventEmitter: EventEmitter): void {
    // 캔들 저장 완료 이벤트 구독
    marketDataEventEmitter.on(
      MARKET_DATA_EVENTS.CANDLE_SAVED,
      this.handleCandleSaved.bind(this),
    );

    console.log(
      '🔗 [TechnicalAnalysisEventService] Market-data 이벤트 연결 완료',
    );
  }

  /**
   * 📊 캔들 저장 완료 이벤트 처리
   *
   * 새로운 캔들이 저장되면 해당 심볼에 대한 기술적 분석을 실행합니다.
   * 동시에 개별 전략들의 임계값 돌파를 감지하고 개별 알림을 발송합니다.
   *
   * @param event 캔들 저장 이벤트
   */
  private async handleCandleSaved(event: CandleSavedEvent): Promise<void> {
    try {
      const { symbol, isNewCandle, timeframe, candleData } = event;

      // 새로운 캔들인 경우에만 분석 실행 (업데이트는 무시)
      if (!isNewCandle) {
        return;
      }

      console.log(
        `🔍 [TechnicalAnalysis] 새 캔들 감지 - 분석 시작: ${symbol} ${timeframe}`,
      );

      // 📊 1. 15분봉 종합 리포트 생성 및 전송 (기존 개별 전략 알림 대체)
      if (timeframe === '15m') {
        await this.generateAndSendComprehensiveReport(symbol, candleData);
      }

      // 📊 2. 종합 기술적 분석 실행
      const analysisResult = await this.performComprehensiveAnalysis(
        symbol,
        timeframe as TimeFrame,
      );

      // 🚀 3. 고급 전략 분석 실행
      const advancedResults = await this.executeAdvancedStrategies(
        symbol,
        timeframe as TimeFrame,
      );

      // 💼 4. 실전 전략 분석 실행
      const practicalResults = await this.executePracticalStrategies(
        symbol,
        timeframe as TimeFrame,
      );

      // 🔔 5. 분석 완료 이벤트 발송 (notification 도메인에서 수신)
      await this.emitAnalysisCompletedEvent(
        symbol,
        timeframe,
        {
          ...analysisResult,
          advancedStrategies: advancedResults,
          practicalStrategies: practicalResults,
        },
        candleData,
      );

      console.log(
        `✅ [TechnicalAnalysis] 분석 완료: ${symbol} - 시그널: ${analysisResult.overallSignal}`,
      );
    } catch (error) {
      console.error(
        '❌ [TechnicalAnalysis] 캔들 저장 이벤트 처리 실패:',
        error,
      );

      // 에러 이벤트 발송
      this.eventEmitter.emit(MARKET_DATA_EVENTS.ANALYSIS_ERROR, {
        symbol: event.symbol,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 📊 캔들 데이터 조회 헬퍼
   */
  private async getCandleData(symbol: string, limit: number): Promise<any[]> {
    try {
      return await this.candleRepository.findLatestCandles(
        symbol,
        'FUTURES',
        limit,
      );
    } catch (error) {
      console.error(`❌ 캔들 데이터 조회 실패: ${symbol}`, error);
      return [];
    }
  }

  /**
   * 🔍 종합적인 기술적 분석 실행
   *
   * 여러 전략을 조합하여 신뢰도 높은 분석 결과를 생성합니다.
   *
   * @param symbol 분석할 심볼
   * @param timeframe 시간봉
   * @returns 종합 분석 결과
   */
  private async performComprehensiveAnalysis(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<any> {
    try {
      // 🎯 지표 요약 조회 (구체적인 데이터 포함)
      const indicatorSummary =
        await this.technicalAnalysisService.getIndicatorSummary(
          symbol,
          timeframe,
        );

      // 🎯 전략 분석도 실행
      const strategyResult = await this.technicalAnalysisService.analyzeSymbol(
        symbol,
        undefined, // 모든 전략 사용
        [timeframe], // 해당 시간봉만 분석
      );

      // 두 결과를 통합하여 완전한 분석 결과 생성
      const comprehensiveResult = {
        // 기본 정보
        symbol,
        timeframe,
        currentPrice: indicatorSummary.currentPrice,
        timestamp: indicatorSummary.timestamp,

        // 전략 시그널 정보
        overallSignal: strategyResult.overallSignal || 'HOLD',
        confidence: strategyResult.overallConfidence || 50,
        strategies: strategyResult.strategies || [],

        // 상세 지표 정보 (실제 데이터 구조에 맞게 수정)
        indicators: {
          // 실제 SMA 값들 (20, 50, 200일선을 5, 10, 20으로 표시)
          SMA5: indicatorSummary.indicators?.priceVsMA?.ma20 || null,
          SMA10: indicatorSummary.indicators?.priceVsMA?.ma50 || null,
          SMA20: indicatorSummary.indicators?.priceVsMA?.ma200 || null,

          // RSI 값
          RSI: indicatorSummary.indicators?.rsi?.value || null,

          // MACD 해석 (강세/약세)
          MACD: indicatorSummary.indicators?.macd?.interpretation || 'N/A',

          // 거래량 관련 데이터
          Volume: indicatorSummary.indicators?.volume?.ratio || null,
          AvgVolume: 1.0, // 기준값
          VolumeRatio: indicatorSummary.indicators?.volume?.ratio || null,
        },

        // 원본 데이터 보존
        originalIndicatorSummary: indicatorSummary,
        originalStrategyResult: strategyResult,
      };

      console.log(`🔍 [TechnicalAnalysis] 종합 분석 완료: ${symbol}`, {
        signal: comprehensiveResult.overallSignal,
        confidence: comprehensiveResult.confidence,
        price: comprehensiveResult.currentPrice,
      });

      return comprehensiveResult;
    } catch (error) {
      console.error(`❌ [TechnicalAnalysis] ${symbol} 분석 실패:`, error);

      // 에러 시 기본값 반환
      return {
        symbol,
        timeframe,
        currentPrice: 0,
        timestamp: Date.now(),
        overallSignal: 'HOLD',
        confidence: 0,
        strategies: [],
        indicators: {
          SMA5: null,
          SMA10: null,
          SMA20: null,
          RSI: null,
          MACD: 'N/A',
          Volume: null,
          AvgVolume: 1.0,
          VolumeRatio: null,
        },
        error: error.message,
      };
    }
  }

  /**
   * 📡 기술적 분석 완료 이벤트 발송
   *
   * notification 도메인에서 이 이벤트를 수신하여 알림을 발송합니다.
   *
   * @param symbol 심볼
   * @param timeframe 시간봉
   * @param analysisResult 분석 결과
   * @param candleData 캔들 데이터
   */
  private async emitAnalysisCompletedEvent(
    symbol: string,
    timeframe: string,
    analysisResult: any,
    candleData: any,
  ): Promise<void> {
    try {
      // TechnicalAnalysisCompletedEvent 타입에 맞는 기본 이벤트
      const event: TechnicalAnalysisCompletedEvent = {
        symbol,
        timeframe,
        analysisResult: {
          signal: analysisResult.overallSignal || 'HOLD',
          confidence:
            analysisResult.overallConfidence || analysisResult.confidence || 50,
          indicators: analysisResult.indicators || {
            SMA5: 'N/A',
            SMA10: 'N/A',
            SMA20: 'N/A',
            RSI: 'N/A',
            MACD: 'N/A',
            Volume: 'N/A',
            AvgVolume: 'N/A',
            VolumeRatio: 'N/A',
          },
          strategies: this.extractStrategyResults(analysisResult),
        },
        candleData,
        analyzedAt: new Date(),
      };

      // 확장된 이벤트 (analysis.completed용 - TestService와 NotificationService 호환)
      const extendedEvent = {
        ...event,
        analysisResult: {
          ...event.analysisResult,
          // 확장된 데이터 추가
          overallSignal: analysisResult.overallSignal || 'HOLD',
          overallConfidence:
            analysisResult.overallConfidence || analysisResult.confidence || 50,
          currentPrice: analysisResult.currentPrice || 0,
          timestamp: analysisResult.timestamp || Date.now(),
        },
      };

      console.log(`📡 [AnalysisEvent] 이벤트 발송 데이터:`, {
        symbol: event.symbol,
        signal: event.analysisResult.signal,
        confidence: event.analysisResult.confidence,
        currentPrice: analysisResult.currentPrice || 0,
        indicators: event.analysisResult.indicators,
      });

      // 🔔 분석 완료 이벤트 발송 (중복 방지: analysis.completed만 emit)
      this.eventEmitter.emit('analysis.completed', extendedEvent);

      // HOLD 시그널이 아닌 경우에만 로그 출력
      if (event.analysisResult.signal !== 'HOLD') {
        console.log(
          `📡 [AnalysisCompleted Event] 분석 완료 이벤트 발송: ${symbol} - ${event.analysisResult.signal} (신뢰도: ${event.analysisResult.confidence}%)`,
        );
      }
    } catch (error) {
      console.error(
        `❌ [AnalysisCompleted Event] 이벤트 발송 실패: ${symbol}`,
        error,
      );
    }
  }

  /**
   * 📊 주요 지표 추출
   *
   * @param analysisResult 분석 결과
   * @returns 주요 지표들
   */
  private extractKeyIndicators(analysisResult: any): Record<string, any> {
    // 분석 결과에서 주요 지표들을 추출
    return {
      // 기본적으로 빈 객체 반환, 실제 구현에서는 analysisResult 구조에 맞게 수정
      timestamp: new Date().toISOString(),
      // TODO: 실제 지표 값들 추출 로직 구현
    };
  }

  /**
   * 🎯 전략 결과 추출
   *
   * @param analysisResult 분석 결과
   * @returns 전략 결과들
   */
  private extractStrategyResults(analysisResult: any): Array<{
    name: string;
    signal: string;
    confidence: number;
  }> {
    // 분석 결과에서 전략별 결과를 추출
    return [
      // 기본적으로 빈 배열 반환, 실제 구현에서는 analysisResult 구조에 맞게 수정
      // TODO: 실제 전략 결과 추출 로직 구현
    ];
  }

  /**
   * 🚀 고급 전략 분석 실행
   *
   * 새로운 캔들 데이터를 기반으로 고급 전략들을 실행합니다.
   *
   * @param symbol 심볼
   * @param timeframe 시간봉
   * @returns 고급 전략 분석 결과
   */
  private async executeAdvancedStrategies(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<any[]> {
    try {
      console.log(`🚀 [AdvancedStrategies] 고급 전략 분석 시작: ${symbol}`);

      const results: any[] = [];

      // 1. 스마트 머니 플로우 전략
      try {
        const smartMoneyResult =
          await this.advancedStrategyService.executeSmartMoneyFlowStrategy(
            symbol,
            timeframe,
          );
        results.push({
          type: 'SMART_MONEY_FLOW',
          ...smartMoneyResult,
        });
      } catch (error) {
        console.error(
          `❌ [SmartMoney] 스마트 머니 전략 실패: ${symbol}`,
          error,
        );
      }

      // 2. 다중 시간봉 트렌드 전략
      try {
        const multiTimeframeResult =
          await this.advancedStrategyService.executeMultiTimeframeTrendStrategy(
            symbol,
          );
        results.push({
          type: 'MULTI_TIMEFRAME_TREND',
          ...multiTimeframeResult,
        });
      } catch (error) {
        console.error(
          `❌ [MultiTimeframe] 다중 시간봉 전략 실패: ${symbol}`,
          error,
        );
      }

      // 3. 패턴 인식 전략
      try {
        const patternResult =
          await this.advancedStrategyService.executePatternRecognitionStrategy(
            symbol,
            timeframe,
          );
        results.push({
          type: 'PATTERN_RECOGNITION',
          ...patternResult,
        });
      } catch (error) {
        console.error(`❌ [Pattern] 패턴 인식 전략 실패: ${symbol}`, error);
      }

      console.log(
        `✅ [AdvancedStrategies] 고급 전략 분석 완료: ${symbol} (${results.length}개 전략)`,
      );
      return results;
    } catch (error) {
      console.error(
        `❌ [AdvancedStrategies] 고급 전략 분석 실패: ${symbol}`,
        error,
      );
      return [];
    }
  }

  /**
   * 💼 실전 전략 분석 실행
   *
   * 새로운 캔들 데이터를 기반으로 실전 전략들을 실행합니다.
   *
   * @param symbol 심볼
   * @param timeframe 시간봉
   * @returns 실전 전략 분석 결과
   */
  private async executePracticalStrategies(
    symbol: string,
    timeframe: TimeFrame,
  ): Promise<any[]> {
    try {
      console.log(`💼 [PracticalStrategies] 실전 전략 분석 시작: ${symbol}`);

      // 모든 실전 전략을 한번에 실행
      const practicalResults =
        await this.practicalStrategyService.executeAllPracticalStrategies(
          symbol,
          timeframe,
        );

      // 결과를 표준 형태로 변환
      const formattedResults = practicalResults.map((result) => ({
        type: result.strategy,
        symbol: result.symbol,
        timeframe: result.timeframe,
        signal: result.signal,
        confidence: result.confidence,
        reasoning: result.reasoning,
        indicators: result.details?.indicators || {},
        conditions: result.details?.conditions || [],
        timestamp: result.timestamp,
      }));

      // 높은 신뢰도의 신호들만 로그 출력
      const highConfidenceSignals = formattedResults.filter(
        (result) => result.confidence >= 70 && result.signal !== 'NEUTRAL',
      );

      if (highConfidenceSignals.length > 0) {
        console.log(
          `🎯 [PracticalStrategies] 높은 신뢰도 신호 발견: ${symbol}`,
          highConfidenceSignals
            .map((s) => `${s.type}: ${s.signal} (${s.confidence}%)`)
            .join(', '),
        );
      }

      console.log(
        `✅ [PracticalStrategies] 실전 전략 분석 완료: ${symbol} (${formattedResults.length}개 전략)`,
      );
      return formattedResults;
    } catch (error) {
      console.error(
        `❌ [PracticalStrategies] 실전 전략 분석 실패: ${symbol}`,
        error,
      );
      return [];
    }
  }

  /**
   * ⚠️ 리스크 관리 분석 실행
   *
   * 현재 시장 상황에 대한 리스크 평가를 수행합니다.
   *
   * @param symbol 심볼
   * @param analysisResult 기본 분석 결과
   * @returns 리스크 분석 결과
   */
  private async executeRiskAnalysis(
    symbol: string,
    analysisResult: any,
  ): Promise<any> {
    try {
      console.log(`⚠️ [RiskAnalysis] 리스크 분석 시작: ${symbol}`);

      // 기본 리스크 파라미터 (실제 환경에서는 사용자 설정이나 DB에서 가져와야 함)
      const defaultRiskParams = {
        accountBalance: 10000, // 기본 계좌 잔고 (USDT)
        winRate: 60, // 기본 승률 60%
        avgWin: 2.5, // 평균 수익 2.5%
        avgLoss: 1.5, // 평균 손실 1.5%
      };

      // 포지션 사이징 계산
      const positionSizing = this.riskManagementService.calculatePositionSize(
        defaultRiskParams.accountBalance,
        defaultRiskParams.winRate / 100,
        defaultRiskParams.avgWin,
        defaultRiskParams.avgLoss,
      );

      // 현재 신호의 신뢰도에 따른 리스크 조정
      const signalConfidence = analysisResult.confidence || 50;
      const adjustedRisk =
        positionSizing.recommendedSize * (signalConfidence / 100);

      const riskAnalysis = {
        symbol,
        timestamp: Date.now(),
        positionSizing,
        adjustedRisk,
        riskLevel: this.calculateRiskLevel(
          signalConfidence,
          analysisResult.overallSignal,
        ),
        recommendations: this.generateRiskRecommendations(
          signalConfidence,
          analysisResult.overallSignal,
        ),
      };

      console.log(
        `✅ [RiskAnalysis] 리스크 분석 완료: ${symbol} (리스크 레벨: ${riskAnalysis.riskLevel})`,
      );
      return riskAnalysis;
    } catch (error) {
      console.error(`❌ [RiskAnalysis] 리스크 분석 실패: ${symbol}`, error);
      return {
        symbol,
        timestamp: Date.now(),
        error: error.message,
        riskLevel: 'UNKNOWN',
      };
    }
  }

  /**
   * 📊 리스크 레벨 계산
   */
  private calculateRiskLevel(confidence: number, signal: string): string {
    if (signal === 'NEUTRAL' || signal === 'HOLD') {
      return 'LOW';
    }

    if (confidence >= 80) {
      return 'LOW';
    } else if (confidence >= 60) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * 💡 리스크 관리 권장사항 생성
   */
  private generateRiskRecommendations(
    confidence: number,
    signal: string,
  ): string[] {
    const recommendations: string[] = [];

    if (confidence < 60) {
      recommendations.push('신뢰도가 낮으므로 포지션 크기를 줄이세요');
      recommendations.push('추가 확인 신호를 기다리는 것을 권장합니다');
    }

    if (signal === 'STRONG_BUY' || signal === 'STRONG_SELL') {
      recommendations.push('강한 신호이므로 손절매를 반드시 설정하세요');
      recommendations.push('수익 실현 목표가를 미리 정하세요');
    }

    if (confidence >= 80) {
      recommendations.push('높은 신뢰도의 신호입니다');
      recommendations.push('적절한 포지션 사이즈로 진입을 고려하세요');
    }

    return recommendations;
  }

  /**
   * 📊 15분봉 종합 리포트 생성 및 전송
   *
   * 기존의 개별 임계값 돌파 알림 대신, 모든 지표의 현재 상태를 종합한
   * 리포트를 생성하여 텔레그램으로 전송합니다.
   *
   * @param symbol 심볼 (예: BTCUSDT)
   * @param candleData 최신 캔들 데이터
   */
  private async generateAndSendComprehensiveReport(
    symbol: string,
    candleData: any,
  ): Promise<void> {
    try {
      console.log(`📊 [ComprehensiveReport] 종합 리포트 생성 시작: ${symbol}`);

      // 필요한 캔들 데이터 조회 (200개 캔들로 충분한 지표 계산)
      const candles = await this.getCandleData(symbol, 200);
      if (candles.length < 50) {
        console.log(
          `⚠️ [ComprehensiveReport] 충분한 캔들 데이터 없음: ${symbol} (${candles.length}개)`,
        );
        return;
      }

      // USD-KRW 환율 가져오기 (실시간 API 사용)
      let usdToKrwRate: number | null = null;
      try {
        const rate = await this.exchangeRateService.getUSDKRWRate();
        usdToKrwRate = rate;
        console.log(
          `💱 [환율] 실시간 API에서 로드: $1 = ₩${usdToKrwRate.toLocaleString()}`,
        );
      } catch (error) {
        console.warn(
          `⚠️ [환율] 실시간 환율 로드 실패, 원화 표시 생략: ${error.message}`,
        );
        // 환율 조회 실패 시 null 유지 (원화 표시 생략)
      }

      // 종합 리포트 생성
      const comprehensiveReport =
        this.technicalIndicatorService.generateComprehensiveReport(
          candles,
          usdToKrwRate || undefined,
        );

      // 알림 요청 이벤트 발송 (notification 도메인에서 텔레그램 전송)
      this.eventEmitter.emit(MARKET_DATA_EVENTS.NOTIFICATION_REQUEST, {
        type: 'TELEGRAM' as const,
        symbol,
        priority: 'MEDIUM' as const,
        content: {
          title: `🔔 ${symbol} 15분 종합 분석`,
          message: comprehensiveReport,
          data: {
            currentPrice: candleData.close,
            high: candleData.high,
            low: candleData.low,
            volume: candleData.volume,
            exchangeRate: usdToKrwRate,
          },
        },
        requestedAt: new Date(),
      });

      console.log(`✅ [ComprehensiveReport] 종합 리포트 전송 완료: ${symbol}`);
    } catch (error) {
      console.error(
        `❌ [ComprehensiveReport] 종합 리포트 생성 실패: ${error.message}`,
      );
    }
  }

  /**
   * 📤 이벤트 발송기 노출 (notification 도메인에서 이벤트 수신용)
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}
