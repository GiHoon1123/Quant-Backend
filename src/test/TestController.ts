import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TestService } from './TestService';

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
@Controller('test')
@ApiTags('🧪 테스트')
export class TestController {
  constructor(private readonly testService: TestService) {}

  /**
   * 🔥 전체 이벤트 체인 테스트
   *
   * 15분봉 생성부터 알림까지 전체 플로우를 한번에 테스트합니다.
   */
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
      confidence?: number;
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
      confidence?: number;
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
}
