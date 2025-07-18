import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BinanceHistoryDataService } from '../../service/candle/BinanceHistoryDataService';

/**
 * 히스토리컬 데이터 수집 컨트롤러
 *
 * 바이낸스에서 과거 15분봉 데이터를 대량으로 수집하여
 * 데이터베이스에 저장하는 API를 제공합니다.
 *
 * 주요 기능:
 * - 4년치 히스토리컬 데이터 수집
 * - 특정 기간 데이터 수집
 * - 데이터 통계 조회
 * - 수집 진행 상황 모니터링
 */
@Controller('candles/15m/history')
@ApiTags('히스토리컬 데이터 수집')
export class BinanceHistoryController {
  constructor(
    private readonly historyDataService: BinanceHistoryDataService,
  ) {}

  /**
   * 전체 히스토리컬 데이터 수집
   *
   * 2020년 1월 1일부터 현재까지의 15분봉 데이터를 수집합니다.
   * 기존 데이터가 있다면 마지막 시점부터 재개합니다.
   *
   * ⚠️ 주의사항:
   * - 처리 시간이 매우 오래 걸릴 수 있습니다 (수시간)
   * - 바이낸스 Rate Limit을 준수하여 순차 처리됩니다
   * - 서버 재시작 시 마지막 저장 시점부터 재개 가능합니다
   */
  @Post('collect/:symbol')
  @ApiOperation({ 
    summary: '전체 히스토리컬 데이터 수집',
    description: '2020년부터 현재까지의 모든 15분봉 데이터를 수집합니다. 처리 시간이 매우 오래 걸릴 수 있습니다.'
  })
  @ApiParam({ 
    name: 'symbol', 
    description: '수집할 심볼 (예: BTCUSDT)',
    example: 'BTCUSDT'
  })
  @ApiResponse({
    status: 200,
    description: '데이터 수집 완료',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        totalCandles: { type: 'number', example: 140000 },
        newCandles: { type: 'number', example: 5000 },
        duplicateCandles: { type: 'number', example: 135000 },
        startTime: { type: 'string', example: '2020-01-01T00:00:00.000Z' },
        endTime: { type: 'string', example: '2025-01-18T14:30:00.000Z' },
        duration: { type: 'number', example: 3600000 },
        errors: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @ApiResponse({ status: 400, description: '잘못된 심볼 형식' })
  @ApiResponse({ status: 429, description: 'Rate Limit 초과' })
  @ApiResponse({ status: 500, description: '서버 내부 오류' })
  async collectHistoricalData(
    @Param('symbol') symbol: string,
  ): Promise<{
    success: boolean;
    totalCandles: number;
    newCandles: number;
    duplicateCandles: number;
    startTime: Date;
    endTime: Date;
    duration: number;
    errors: any[];
    message: string;
  }> {
    console.log(`🚀 [API] ${symbol} 히스토리컬 데이터 수집 요청 시작`);

    try {
      // 심볼 형식 검증
      if (!symbol || !/^[A-Z]+USDT$/.test(symbol.toUpperCase())) {
        throw new Error('유효하지 않은 심볼 형식입니다. (예: BTCUSDT)');
      }

      const normalizedSymbol = symbol.toUpperCase();
      const result = await this.historyDataService.collectHistoricalData(normalizedSymbol);

      console.log(`✅ [API] ${normalizedSymbol} 히스토리컬 데이터 수집 완료`);

      return {
        ...result,
        message: result.success 
          ? `${normalizedSymbol} 히스토리컬 데이터 수집이 성공적으로 완료되었습니다.`
          : `${normalizedSymbol} 히스토리컬 데이터 수집 중 오류가 발생했습니다.`,
      };

    } catch (error) {
      console.error(`❌ [API] ${symbol} 히스토리컬 데이터 수집 실패:`, error.message);
      
      return {
        success: false,
        totalCandles: 0,
        newCandles: 0,
        duplicateCandles: 0,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        errors: [{ error: error.message, timestamp: new Date() }],
        message: `히스토리컬 데이터 수집 실패: ${error.message}`,
      };
    }
  }

  /**
   * 특정 기간 데이터 수집
   *
   * 사용자가 지정한 시작일과 종료일 사이의 15분봉 데이터를 수집합니다.
   * 테스트용이나 특정 기간 보완용으로 사용할 수 있습니다.
   */
  @Post('collect/:symbol/range')
  @ApiOperation({ 
    summary: '특정 기간 데이터 수집',
    description: '지정된 기간의 15분봉 데이터를 수집합니다.'
  })
  @ApiParam({ 
    name: 'symbol', 
    description: '수집할 심볼 (예: BTCUSDT)',
    example: 'BTCUSDT'
  })
  @ApiQuery({ 
    name: 'startDate', 
    description: '시작일 (YYYY-MM-DD 형식)',
    example: '2024-01-01'
  })
  @ApiQuery({ 
    name: 'endDate', 
    description: '종료일 (YYYY-MM-DD 형식)',
    example: '2024-01-31'
  })
  async collectDataInRange(
    @Param('symbol') symbol: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{
    success: boolean;
    totalCandles: number;
    newCandles: number;
    duplicateCandles: number;
    startTime: Date;
    endTime: Date;
    duration: number;
    errors: any[];
    message: string;
  }> {
    console.log(`🚀 [API] ${symbol} 기간별 데이터 수집 요청: ${startDate} ~ ${endDate}`);

    try {
      // 파라미터 검증
      if (!symbol || !/^[A-Z]+USDT$/.test(symbol.toUpperCase())) {
        throw new Error('유효하지 않은 심볼 형식입니다. (예: BTCUSDT)');
      }

      if (!startDate || !endDate) {
        throw new Error('시작일과 종료일을 모두 입력해주세요. (YYYY-MM-DD 형식)');
      }

      // 날짜 파싱 및 검증
      const startTime = new Date(`${startDate}T00:00:00Z`);
      const endTime = new Date(`${endDate}T23:59:59Z`);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식으로 입력해주세요.');
      }

      if (startTime >= endTime) {
        throw new Error('시작일은 종료일보다 이전이어야 합니다.');
      }

      const today = new Date();
      if (endTime > today) {
        throw new Error('종료일은 오늘 날짜보다 이전이어야 합니다.');
      }

      const normalizedSymbol = symbol.toUpperCase();
      const result = await this.historyDataService.collectDataInRange(
        normalizedSymbol,
        startTime,
        endTime,
      );

      console.log(`✅ [API] ${normalizedSymbol} 기간별 데이터 수집 완료`);

      return {
        ...result,
        message: result.success 
          ? `${normalizedSymbol} ${startDate}~${endDate} 기간 데이터 수집이 완료되었습니다.`
          : `${normalizedSymbol} 기간별 데이터 수집 중 오류가 발생했습니다.`,
      };

    } catch (error) {
      console.error(`❌ [API] ${symbol} 기간별 데이터 수집 실패:`, error.message);
      
      return {
        success: false,
        totalCandles: 0,
        newCandles: 0,
        duplicateCandles: 0,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        errors: [{ error: error.message, timestamp: new Date() }],
        message: `기간별 데이터 수집 실패: ${error.message}`,
      };
    }
  }

  /**
   * 데이터 통계 조회
   *
   * 특정 심볼의 현재 저장된 데이터 통계를 조회합니다.
   * 수집 진행 상황 확인이나 데이터 품질 점검에 사용할 수 있습니다.
   */
  @Get('stats/:symbol')
  @ApiOperation({ 
    summary: '데이터 통계 조회',
    description: '심볼의 현재 저장된 캔들 데이터 통계를 조회합니다.'
  })
  @ApiParam({ 
    name: 'symbol', 
    description: '조회할 심볼 (예: BTCUSDT)',
    example: 'BTCUSDT'
  })
  @ApiResponse({
    status: 200,
    description: '데이터 통계 조회 성공',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', example: 'BTCUSDT' },
        totalCandles: { type: 'number', example: 140000 },
        firstCandle: { type: 'string', example: '2020-01-01T00:00:00.000Z' },
        lastCandle: { type: 'string', example: '2025-01-18T14:30:00.000Z' },
        dataGaps: { type: 'array', items: { type: 'object' } },
        estimatedCompleteness: { type: 'number', example: 98.5 }
      }
    }
  })
  async getDataStatistics(
    @Param('symbol') symbol: string,
  ): Promise<{
    symbol: string;
    totalCandles: number;
    firstCandle?: Date;
    lastCandle?: Date;
    dataGaps: { start: Date; end: Date; missingCandles: number }[];
    estimatedCompleteness?: number;
    message: string;
  }> {
    console.log(`📊 [API] ${symbol} 데이터 통계 조회 요청`);

    try {
      // 심볼 형식 검증
      if (!symbol || !/^[A-Z]+USDT$/.test(symbol.toUpperCase())) {
        throw new Error('유효하지 않은 심볼 형식입니다. (예: BTCUSDT)');
      }

      const normalizedSymbol = symbol.toUpperCase();
      const stats = await this.historyDataService.getDataStatistics(normalizedSymbol);

      // 데이터 완성도 추정 계산
      let estimatedCompleteness: number | undefined;
      if (stats.firstCandle && stats.lastCandle && stats.totalCandles > 0) {
        const timeRangeMs = stats.lastCandle.getTime() - stats.firstCandle.getTime();
        const expectedCandles = Math.floor(timeRangeMs / (15 * 60 * 1000)); // 15분 간격
        estimatedCompleteness = (stats.totalCandles / expectedCandles) * 100;
        estimatedCompleteness = Math.min(100, Math.max(0, estimatedCompleteness)); // 0-100% 범위
      }

      console.log(`✅ [API] ${normalizedSymbol} 데이터 통계 조회 완료`);

      return {
        symbol: normalizedSymbol,
        ...stats,
        estimatedCompleteness,
        message: stats.totalCandles > 0 
          ? `${normalizedSymbol} 데이터가 ${stats.totalCandles.toLocaleString()}개 저장되어 있습니다.`
          : `${normalizedSymbol} 데이터가 없습니다. 히스토리컬 데이터 수집을 먼저 실행해주세요.`,
      };

    } catch (error) {
      console.error(`❌ [API] ${symbol} 데이터 통계 조회 실패:`, error.message);
      
      return {
        symbol: symbol.toUpperCase(),
        totalCandles: 0,
        dataGaps: [],
        message: `데이터 통계 조회 실패: ${error.message}`,
      };
    }
  }

  /**
   * 수집 가능한 심볼 목록 조회
   *
   * 바이낸스 선물에서 지원하는 USDT 마진 심볼 목록을 조회합니다.
   */
  @Get('symbols')
  @ApiOperation({ 
    summary: '수집 가능한 심볼 목록',
    description: '바이낸스 선물에서 수집 가능한 USDT 마진 심볼들을 조회합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '심볼 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        symbols: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT']
        },
        totalCount: { type: 'number', example: 4 },
        message: { type: 'string', example: '수집 가능한 심볼 목록입니다.' }
      }
    }
  })
  async getSupportedSymbols(): Promise<{
    symbols: string[];
    totalCount: number;
    message: string;
  }> {
    // 현재 지원하는 주요 심볼들 (실제로는 바이낸스 API에서 동적 조회 가능)
    const supportedSymbols = [
      'BTCUSDT',   // 비트코인
      'ETHUSDT',   // 이더리움
      'ADAUSDT',   // 에이다
      'SOLUSDT',   // 솔라나
      'DOGEUSDT',  // 도지코인
      'XRPUSDT',   // 리플
      'DOTUSDT',   // 폴카닷
      'AVAXUSDT',  // 아발란체
      'MATICUSDT', // 폴리곤
      'LINKUSDT',  // 체인링크
    ];

    return {
      symbols: supportedSymbols,
      totalCount: supportedSymbols.length,
      message: `총 ${supportedSymbols.length}개의 심볼에 대해 히스토리컬 데이터 수집이 가능합니다.`,
    };
  }
}
