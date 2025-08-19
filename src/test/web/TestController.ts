import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TestService } from '../service/TestService';

/**
 * 🧪 테스트 컨트롤러
 *
 * 🎯 **목적**: 이벤트 기반 아키텍처 테스트
 * - Market-data → Technical-analysis → Notification 체인 검증
 * - 개별 도메인 기능 테스트
 * - 성능 및 안정성 테스트
 *
 * 📡 **테스트 가능한 플로우**:
 * 1. 15분봉 생성 → candle.saved 이벤트
 * 2. 기술적 분석 실행 → analysis.completed 이벤트
 * 3. 알림 발송 (텔레그램)
 */
@Controller('api/v1/test/legacy')
@ApiTags('🧪 테스트')
export class TestController {
  constructor(private readonly testService: TestService) {}

  /**
   * 🧪 15분봉 캔들 직접 입력 테스트
   *
   * 심볼과 캔들 데이터를 직접 입력하면 DB 저장 및 이벤트 발송까지 전체 체인을 트리거합니다.
   */
  @Post('candle15m')
  @ApiOperation({
    summary: '15분봉 캔들 직접 입력',
    description:
      '임의의 15분봉 캔들 데이터를 입력하면 DB 저장 및 이벤트 발송까지 전체 체인을 트리거합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          example: 'BTCUSDT',
          description: '거래 심볼',
        },
        candleData: {
          type: 'object',
          properties: {
            openTime: {
              type: 'number',
              example: 1721700000000,
              description: '캔들 시작 시간(Unix timestamp)',
            },
            closeTime: {
              type: 'number',
              example: 1721700899999,
              description: '캔들 종료 시간(Unix timestamp)',
            },
            open: { type: 'number', example: 30000.0, description: '시가' },
            high: { type: 'number', example: 30100.0, description: '고가' },
            low: { type: 'number', example: 29900.0, description: '저가' },
            close: { type: 'number', example: 30050.0, description: '종가' },
            volume: { type: 'number', example: 123.45, description: '거래량' },
            quoteVolume: {
              type: 'number',
              example: 3700000.0,
              description: '거래대금',
            },
            trades: { type: 'number', example: 100, description: '거래 횟수' },
            takerBuyBaseVolume: {
              type: 'number',
              example: 60.0,
              description: '능동 매수 거래량',
            },
            takerBuyQuoteVolume: {
              type: 'number',
              example: 1800000.0,
              description: '능동 매수 거래대금',
            },
          },
          required: [
            'openTime',
            'closeTime',
            'open',
            'high',
            'low',
            'close',
            'volume',
            'quoteVolume',
            'trades',
            'takerBuyBaseVolume',
            'takerBuyQuoteVolume',
          ],
        },
      },
      required: ['symbol', 'candleData'],
      example: {
        symbol: 'BTCUSDT',
        candleData: {
          openTime: 1721700000000,
          closeTime: 1721700899999,
          open: 30000.0,
          high: 30100.0,
          low: 29900.0,
          close: 30050.0,
          volume: 123.45,
          quoteVolume: 3700000.0,
          trades: 100,
          takerBuyBaseVolume: 60.0,
          takerBuyQuoteVolume: 1800000.0,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '테스트 성공 시',
    schema: {
      example: {
        success: true,
        result: {
          /* 저장된 엔티티 정보 */
        },
      },
    },
  })
  async testCandle15m(@Body() body: { symbol: string; candleData: any }) {
    const { symbol, candleData } = body;
    const result = await this.testService.testCandle15m(symbol, candleData);
    return { success: true, result };
  }
  @Post('event-chain/:symbol')
  @ApiOperation({
    summary: '전체 이벤트 체인 테스트',
    description: '15분봉 생성 → 기술분석 → 알림 전체 플로우 테스트',
  })
  @ApiResponse({ status: 200, description: '테스트 성공' })
  async testEventChain(@Param('symbol') symbol: string) {
    return this.testService.testFullEventChain(symbol);
  }

  /**
   * 📊 가짜 15분봉 데이터 생성 테스트
   */
  @Post('candle/generate/:symbol')
  @ApiOperation({
    summary: '가짜 15분봉 생성',
    description: '테스트용 15분봉 데이터를 생성하여 이벤트 발송',
  })
  async generateTestCandle(
    @Param('symbol') symbol: string,
    @Body()
    candleData?: {
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number;
    },
  ) {
    return this.testService.generateTestCandle(symbol, candleData);
  }

  /**
   * 🔍 기술적 분석만 단독 테스트
   */
  @Post('analysis/:symbol')
  @ApiOperation({
    summary: '기술적 분석 단독 테스트',
    description: '저장된 캔들 데이터로 기술적 분석만 실행',
  })
  async testAnalysis(@Param('symbol') symbol: string) {
    return this.testService.testTechnicalAnalysis(symbol);
  }

  /**
   * 🔔 알림 발송만 단독 테스트
   */
  @Post('notification')
  @ApiOperation({
    summary: '알림 발송 단독 테스트',
    description: '가짜 분석 결과로 알림 발송 테스트',
  })
  async testNotification(
    @Body()
    testData?: {
      symbol?: string;
      signal?: string;
    },
  ) {
    return this.testService.testNotification(testData);
  }

  /**
   * 📈 다중 심볼 연속 테스트
   */
  @Post('multi-symbol')
  @ApiOperation({
    summary: '다중 심볼 연속 테스트',
    description: '여러 심볼에 대해 연속으로 이벤트 체인 테스트',
  })
  async testMultiSymbol(@Body() symbols: string[]) {
    return this.testService.testMultipleSymbols(symbols);
  }

  /**
   * 🕒 이벤트 지연시간 측정
   */
  @Get('performance/:symbol')
  @ApiOperation({
    summary: '이벤트 체인 성능 측정',
    description: '각 단계별 처리 시간과 전체 지연시간 측정',
  })
  async testPerformance(@Param('symbol') symbol: string) {
    return this.testService.measureEventChainPerformance(symbol);
  }

  /**
   * 📊 현재 시스템 상태 조회
   */
  @Get('status')
  @ApiOperation({
    summary: '시스템 상태 조회',
    description: '각 도메인별 이벤트 리스너 상태 및 통계',
  })
  async getSystemStatus() {
    return this.testService.getSystemStatus();
  }

  /**
   * 🧹 테스트 데이터 정리
   */
  @Post('cleanup')
  @ApiOperation({
    summary: '테스트 데이터 정리',
    description: '테스트로 생성된 데이터들을 정리',
  })
  async cleanupTestData() {
    return this.testService.cleanupTestData();
  }

  /**
   * 📱 텔레그램 알림 강제 발송 테스트
   */
  @Post('telegram/:symbol')
  @ApiOperation({
    summary: '텔레그램 알림 강제 발송',
    description: '실제 텔레그램으로 테스트 알림을 강제 발송합니다',
  })
  async testTelegramNotification(
    @Param('symbol') symbol: string,
    @Body()
    testData?: {
      signal?: 'BUY' | 'SELL' | 'HOLD';
      message?: string;
    },
  ) {
    return this.testService.testTelegramNotification(symbol, testData);
  }

  /**
   * 🔗 실제 이벤트 체인으로 알림 테스트
   */
  @Post('real-event-chain/:symbol')
  @ApiOperation({
    summary: '실제 이벤트 체인으로 알림 테스트',
    description: '실제 TechnicalAnalysisEventService를 통해 이벤트 발송',
  })
  async testRealEventChain(@Param('symbol') symbol: string) {
    return this.testService.testRealEventChain(symbol);
  }

  /**
   * 🧪 종합 리포트 생성 테스트
   */
  @Post('comprehensive-report/:symbol')
  @ApiOperation({
    summary: '종합 리포트 생성 테스트',
    description:
      '이동평균선 퍼센트 계산이 수정된 종합 리포트를 생성하는 테스트',
  })
  @ApiResponse({
    status: 200,
    description: '종합 리포트 생성 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        testId: {
          type: 'string',
          example: 'comprehensive-report-test-1234567890',
        },
        message: {
          type: 'string',
          example: '종합 리포트가 성공적으로 생성되었습니다',
        },
        data: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTCUSDT' },
            report: {
              type: 'string',
              example: '📌 [BTCUSDT] 비트코인 (메이저코인)...',
            },
            currentPrice: { type: 'number', example: 50700 },
            smaValues: { type: 'object' },
          },
        },
      },
    },
  })
  async testComprehensiveReport(@Param('symbol') symbol: string) {
    return this.testService.testComprehensiveReport(symbol);
  }
}
