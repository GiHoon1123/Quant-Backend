import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  CandleSavedEvent,
  MARKET_DATA_EVENTS,
  TechnicalAnalysisCompletedEvent,
} from '../../market-data/types/MarketDataEvents';
import { TimeFrame } from '../types/TechnicalAnalysisTypes';
import { TechnicalAnalysisService } from './TechnicalAnalysisService';

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

      // 📊 기술적 분석 실행
      const analysisResult = await this.performComprehensiveAnalysis(
        symbol,
        timeframe as TimeFrame,
      );

      // 🔔 분석 완료 이벤트 발송 (notification 도메인에서 수신)
      await this.emitAnalysisCompletedEvent(
        symbol,
        timeframe,
        analysisResult,
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

      // 🔔 표준 이벤트 발송 (notification 도메인에서 수신)
      this.eventEmitter.emit(
        MARKET_DATA_EVENTS.TECHNICAL_ANALYSIS_COMPLETED,
        event,
      );

      // 🔔 확장된 이벤트 발송 (TestService 호환성을 위해)
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
   * 📤 이벤트 발송기 노출 (notification 도메인에서 이벤트 수신용)
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}
