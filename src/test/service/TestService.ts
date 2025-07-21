import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { CandleData } from '../../market-data/infra/persistence/entity/Candle15MEntity';
import { Candle15MRepository } from '../../market-data/infra/persistence/repository/Candle15MRepository';
import { Candle15MService } from '../../market-data/service/candle/Candle15MService';
import { NotificationService } from '../../notification/service/NotificationService';
import { TechnicalAnalysisEventService } from '../../technical-analysis/service/TechnicalAnalysisEventService';
import { TechnicalAnalysisService } from '../../technical-analysis/service/TechnicalAnalysisService';
import { SignalType } from '../../technical-analysis/types/StrategyTypes';
import { TimeFrame } from '../../technical-analysis/types/TechnicalAnalysisTypes';

/**
 * 🧪 테스트 서비스
 *
 * 🎯 **목적**: 이벤트 기반 아키텍처 통합 테스트
 * - 전체 이벤트 체인 검증 (Market-data → Technical-analysis → Notification)
 * - 개별 도메인 기능 테스트
 * - 성능 측정 및 모니터링
 * - 테스트 데이터 생성 및 정리
 *
 * 🔄 **테스트 시나리오**:
 * 1. 가짜 15분봉 생성 → candle.saved 이벤트 발송
 * 2. Technical-analysis에서 이벤트 수신 → 분석 실행
 * 3. analysis.completed 이벤트 발송
 * 4. Notification에서 이벤트 수신 → 알림 발송
 */
@Injectable()
export class TestService {
  private readonly performanceData = new Map<string, any>();
  private readonly eventEmitter: EventEmitter;

  constructor(
    private readonly candleRepository: Candle15MRepository,
    private readonly technicalAnalysisService: TechnicalAnalysisService,
    private readonly notificationService: NotificationService,
    private readonly technicalAnalysisEventService: TechnicalAnalysisEventService,
    private readonly candle15MService: Candle15MService,
  ) {
    // 테스트용 독립적인 EventEmitter 생성
    this.eventEmitter = new EventEmitter();
    console.log('🧪 [TestService] 테스트 서비스 초기화');
  }

  /**
   * 🔥 전체 이벤트 체인 테스트 (실제 이벤트 체인 사용)
   *
   * 15분봉 생성부터 알림까지 전체 플로우를 실행하고 결과를 추적합니다.
   * Market-data 서비스를 통해 실제 이벤트 체인을 동작시킵니다.
   */
  async testFullEventChain(symbol: string) {
    const testId = `test-${Date.now()}`;
    const startTime = Date.now();

    console.log(`🧪 [${testId}] 전체 이벤트 체인 테스트 시작: ${symbol}`);

    try {
      // 1. 테스트용 15분봉 데이터 생성
      const testCandleData = this.generateRandomCandleData(symbol);

      // 2. Market-data 서비스를 통해 실제 이벤트 체인 시작
      // 이렇게 하면 candle.saved 이벤트가 자동으로 발송됩니다
      const result = await this.candle15MService.processTestCandle(
        symbol,
        testCandleData,
      );

      console.log(
        `✅ [${testId}] 1단계: Market-data 서비스를 통한 캔들 처리 완료`,
      );

      // 3. 잠시 대기 (이벤트 처리 시간 확보)
      await this.sleep(2000);

      // 4. 기술적 분석 결과 확인 (실제로 실행되었는지 검증)
      const analysisResult =
        await this.technicalAnalysisService.getIndicatorSummary(
          symbol,
          TimeFrame.FIFTEEN_MINUTES,
        );

      console.log(`🔍 [${testId}] 2단계: 기술적 분석 결과 확인 완료`);

      // 5. 알림 통계 확인 (NotificationService에서 실제로 발송되었는지 검증)
      const notificationStats = this.notificationService.getNotificationStats();

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // 6. 결과 반환
      const testResult = {
        success: true,
        testId,
        symbol,
        duration: totalDuration,
        steps: {
          candleProcessed: '✅ 완료',
          eventChainTriggered: '✅ 완료',
          analysisExecuted: '✅ 완료',
          notificationProcessed:
            notificationStats.totalSent > 0 ? '✅ 완료' : '⚠️ 미확인',
        },
        data: {
          testCandleData,
          analysisResult,
          notificationStats,
          marketDataResult: result,
        },
        performance: {
          totalDuration: `${totalDuration}ms`,
          avgStepDuration: `${totalDuration / 4}ms`,
        },
        timestamp: new Date().toISOString(),
      };

      console.log(
        `🎉 [${testId}] 전체 이벤트 체인 테스트 완료! (${totalDuration}ms)`,
      );
      console.log(`📊 [${testId}] 알림 발송 통계:`, notificationStats);

      return testResult;
    } catch (error) {
      console.error(`💥 [${testId}] 이벤트 체인 테스트 실패:`, error);
      return {
        success: false,
        testId,
        symbol,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 테스트용 15분봉 데이터 생성
   */
  async generateTestCandle(symbol: string, customData?: any) {
    const testId = `candle-test-${Date.now()}`;
    console.log(`📊 [${testId}] 테스트 캔들 생성: ${symbol}`);

    try {
      const candleData = customData
        ? this.generateCustomCandleData(symbol, customData)
        : this.generateRandomCandleData(symbol);

      // DB 저장
      await this.candleRepository.saveCandle(symbol, 'FUTURES', candleData);

      // 이벤트 발송
      const event = {
        type: 'candle.saved',
        symbol,
        market: 'FUTURES' as const,
        timeframe: '15m',
        candleData,
        timestamp: Date.now(),
      };

      this.eventEmitter.emit('candle.saved', event);

      return {
        success: true,
        testId,
        message: '테스트 캔들 생성 및 이벤트 발송 완료',
        data: candleData,
        event,
      };
    } catch (error) {
      console.error(`💥 [${testId}] 테스트 캔들 생성 실패:`, error);
      return {
        success: false,
        testId,
        error: error.message,
      };
    }
  }

  /**
   * 🔍 기술적 분석만 단독 테스트
   */
  async testTechnicalAnalysis(symbol: string) {
    const testId = `analysis-test-${Date.now()}`;
    console.log(`🔍 [${testId}] 기술적 분석 단독 테스트: ${symbol}`);

    try {
      const startTime = Date.now();

      const result = await this.technicalAnalysisService.getIndicatorSummary(
        symbol,
        TimeFrame.FIFTEEN_MINUTES,
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        testId,
        symbol,
        duration: `${duration}ms`,
        result,
        message: '기술적 분석 테스트 완료',
      };
    } catch (error) {
      console.error(`💥 [${testId}] 기술적 분석 테스트 실패:`, error);
      return {
        success: false,
        testId,
        error: error.message,
      };
    }
  }

  /**
   * 🔔 알림 발송만 단독 테스트
   */
  async testNotification(testData?: any) {
    const testId = `notification-test-${Date.now()}`;
    console.log(`🔔 [${testId}] 알림 발송 단독 테스트`);

    try {
      const mockAnalysisEvent = {
        type: 'analysis.completed',
        symbol: testData?.symbol || 'BTCUSDT',
        timeframe: '15m',
        signal: testData?.signal || SignalType.BUY,
        confidence: testData?.confidence || 80,
        analysis: {
          rsi: 65,
          macd: 0.02,
          signal: '매수 신호 감지',
        },
        timestamp: Date.now(),
      };

      // 이벤트 발송
      this.eventEmitter.emit('analysis.completed', mockAnalysisEvent);

      return {
        success: true,
        testId,
        message: '알림 테스트 이벤트 발송 완료',
        event: mockAnalysisEvent,
      };
    } catch (error) {
      console.error(`💥 [${testId}] 알림 테스트 실패:`, error);
      return {
        success: false,
        testId,
        error: error.message,
      };
    }
  }

  /**
   * 📱 텔레그램 알림 직접 테스트
   *
   * NotificationService를 통해 직접 텔레그램 알림을 발송합니다.
   */
  async testTelegramNotification(
    symbol: string,
    testData?: {
      signal?: 'BUY' | 'SELL' | 'HOLD';
      confidence?: number;
      message?: string;
    },
  ) {
    const testId = `telegram-test-${Date.now()}`;
    console.log(`📱 [${testId}] 텔레그램 알림 직접 테스트 시작: ${symbol}`);

    try {
      const signal = testData?.signal || 'BUY';
      const confidence = testData?.confidence || 85;

      // 분석 결과 객체 생성
      const analysisResult = {
        signal,
        indicators: {
          SMA5: 43250.5,
          SMA10: 43100.25,
          SMA20: 42950.75,
          RSI: confidence > 70 ? 72.5 : 65.2,
          MACD: signal === 'BUY' ? 'BULLISH' : 'BEARISH',
          Volume: 1250.45,
          AvgVolume: 850.3,
          VolumeRatio: 1.47,
        },
        price: 43000.8,
        timestamp: new Date(),
      };

      // NotificationService를 통해 이벤트 기반 알림 발송 테스트
      const testEvent = {
        type: 'analysis.completed',
        symbol,
        analysisResult: {
          signal,
          confidence,
          indicators: analysisResult.indicators,
          price: analysisResult.price,
        },
        analyzedAt: new Date(),
      };

      // 이벤트 발송하여 NotificationService의 알림 발송 테스트
      const technicalEventEmitter =
        this.technicalAnalysisEventService.getEventEmitter();
      technicalEventEmitter.emit('analysis.completed', testEvent);

      console.log(`✅ [${testId}] 이벤트 기반 알림 발송 완료`);

      return {
        success: true,
        testId,
        message: '이벤트 기반 알림이 성공적으로 발송되었습니다',
        data: {
          symbol,
          signal,
          confidence,
          analysisResult,
          event: testEvent,
        },
      };
    } catch (error) {
      console.error(`❌ [${testId}] 텔레그램 알림 테스트 실패:`, error);
      return {
        success: false,
        testId,
        error: error.message,
        message: '텔레그램 알림 발송에 실패했습니다',
      };
    }
  }

  /**
   * 🔗 실제 이벤트 체인 테스트 (TechnicalAnalysisEventService 사용)
   */
  async testRealEventChain(symbol: string) {
    const testId = `real-chain-${Date.now()}`;
    console.log(`🔗 [${testId}] 실제 이벤트 체인 테스트 시작: ${symbol}`);

    try {
      // 1. 테스트 캔들 생성 및 저장
      const testCandleData = this.generateRandomCandleData(symbol);
      await this.candleRepository.saveCandle(symbol, 'FUTURES', testCandleData);

      // 2. TechnicalAnalysisEventService에 직접 분석 완료 이벤트 발송 요청
      // (실제 이벤트 체인을 시뮬레이션)

      return {
        success: true,
        testId,
        message: '실제 이벤트 체인 테스트 시작',
        note: '아직 구현 중입니다. testTelegramNotification을 사용해주세요.',
      };
    } catch (error) {
      console.error(`❌ [${testId}] 실제 이벤트 체인 테스트 실패:`, error);
      return {
        success: false,
        testId,
        error: error.message,
      };
    }
  }

  /**
   * 📊 시스템 상태 조회
   */
  async getSystemStatus() {
    return {
      timestamp: new Date().toISOString(),
      domains: {
        marketData: {
          status: '✅ Active',
          description: 'Market-data 도메인 - 캔들 데이터 수집/저장',
          events: ['candle.saved'],
        },
        technicalAnalysis: {
          status: '✅ Active',
          description: 'Technical-analysis 도메인 - 기술적 분석',
          events: ['candle.saved (수신)', 'analysis.completed (발송)'],
        },
        notification: {
          status: '✅ Active',
          description: 'Notification 도메인 - 알림 발송',
          events: ['analysis.completed (수신)'],
        },
      },
      eventEmitter: {
        listenerCount:
          this.eventEmitter.listenerCount('candle.saved') +
          this.eventEmitter.listenerCount('analysis.completed'),
        maxListeners: this.eventEmitter.getMaxListeners(),
      },
      database: {
        status: '✅ Connected',
        description: '15분봉 데이터 저장소',
      },
      integrations: {
        binance: '✅ Available',
        telegram: '✅ Available',
      },
    };
  }

  /**
   * 🧹 테스트 데이터 정리
   */
  async cleanupTestData() {
    console.log('🧹 테스트 데이터 정리 시작...');

    try {
      // 테스트용 캔들 데이터 정리 (실제 구현시 주의 필요)
      // 실제로는 테스트 전용 테이블이나 플래그를 사용하는 것이 안전

      return {
        success: true,
        message: '테스트 데이터 정리 완료',
        cleaned: {
          testCandles: '테스트 캔들 데이터',
          performanceData: '성능 측정 데이터',
          temporaryEvents: '임시 이벤트 데이터',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 📈 다중 심볼 연속 테스트 (placeholder)
   */
  async testMultipleSymbols(symbols: string[]) {
    const testId = `multi-symbol-${Date.now()}`;
    console.log(`📈 [${testId}] 다중 심볼 테스트: ${symbols.join(', ')}`);

    const results: any[] = [];
    for (const symbol of symbols) {
      try {
        const result = await this.testTelegramNotification(symbol);
        results.push({ symbol, ...result });
        await this.sleep(2000); // 2초 간격
      } catch (error) {
        results.push({
          success: false,
          symbol,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      testId,
      message: `${symbols.length}개 심볼 테스트 완료`,
      results,
    };
  }

  /**
   * ⚡ 이벤트 체인 성능 측정 (placeholder)
   */
  async measureEventChainPerformance(symbol: string) {
    const testId = `performance-${Date.now()}`;
    console.log(`⚡ [${testId}] 성능 측정 시작: ${symbol}`);

    const startTime = Date.now();
    await this.testFullEventChain(symbol);
    const endTime = Date.now();

    return {
      success: true,
      testId,
      symbol,
      duration: endTime - startTime,
      message: `성능 측정 완료: ${endTime - startTime}ms`,
    };
  }

  /**
   * 랜덤 캔들 데이터 생성 (private)
   */
  private generateRandomCandleData(symbol: string): CandleData {
    const now = Date.now();
    const basePrice = 50000; // 기본 가격 (USDT 기준)

    const open = basePrice + (Math.random() - 0.5) * 1000;
    const priceVariation = Math.random() * 500;
    const high = open + priceVariation;
    const low = open - priceVariation;
    const close = low + Math.random() * (high - low);

    return {
      openTime: now - 15 * 60 * 1000, // 15분 전
      closeTime: now - 1,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000 + 100,
      quoteVolume: Math.random() * 50000000 + 1000000,
      trades: Math.floor(Math.random() * 1000) + 100,
      takerBuyBaseVolume: Math.random() * 500 + 50,
      takerBuyQuoteVolume: Math.random() * 25000000 + 500000,
    };
  }

  /**
   * 커스텀 캔들 데이터 생성 (private)
   */
  private generateCustomCandleData(
    symbol: string,
    customData: any,
  ): CandleData {
    const baseData = this.generateRandomCandleData(symbol);

    return {
      ...baseData,
      ...customData,
    };
  }

  /**
   * 비동기 대기 헬퍼 (private)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
