import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CandleQueryOptions } from '../../infra/candle/Candle15MEntity';
import { Candle15MRepository } from '../../infra/candle/Candle15MRepository';
import { Candle15MService } from '../../service/candle/Candle15MService';

/**
 * 15분봉 캔들 데이터 REST API 컨트롤러
 *
 * 15분봉 캔들 데이터 조회 및 관리를 위한 REST API 엔드포인트를 제공합니다.
 * 웹소켓과 함께 사용하여 실시간 데이터와 히스토리 데이터 모두 제공합니다.
 *
 * 주요 기능:
 * - 최신 캔들 데이터 조회
 * - 히스토리 캔들 데이터 조회
 * - 구독 상태 관리
 * - 통계 정보 제공
 * - 서비스 상태 모니터링
 */
@Controller('api/candle15m')
export class Candle15MController {
  constructor(
    private readonly candle15MService: Candle15MService,
    private readonly candle15MRepository: Candle15MRepository,
  ) {}

  /**
   * 특정 심볼의 최신 캔들 데이터 조회
   *
   * @param symbol 조회할 심볼 (예: BTCUSDT)
   * @returns 최신 캔들 데이터
   */
  @Get('latest/:symbol')
  async getLatestCandle(@Param('symbol') symbol: string) {
    try {
      const latestCandle = this.candle15MService.getLatestCandle(symbol);

      if (!latestCandle) {
        return {
          success: false,
          message: `${symbol}의 캔들 데이터를 찾을 수 없습니다.`,
          data: null,
        };
      }

      return {
        success: true,
        message: '최신 캔들 데이터 조회 성공',
        data: {
          symbol,
          candle: latestCandle.toCandleData(),
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '최신 캔들 데이터 조회 실패',
        error: error.message,
      };
    }
  }

  /**
   * 모든 심볼의 최신 캔들 데이터 조회
   *
   * @returns 모든 심볼의 최신 캔들 데이터
   */
  @Get('latest')
  async getAllLatestCandles() {
    try {
      const allCandles = this.candle15MService.getAllLatestCandles();
      const candleData: Record<string, any> = {};

      for (const [symbol, candle] of allCandles) {
        candleData[symbol] = candle.toCandleData();
      }

      return {
        success: true,
        message: '모든 심볼의 최신 캔들 데이터 조회 성공',
        data: {
          candles: candleData,
          symbolCount: allCandles.size,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '최신 캔들 데이터 조회 실패',
        error: error.message,
      };
    }
  }

  /**
   * 특정 심볼의 히스토리 캔들 데이터 조회
   *
   * @param symbol 조회할 심볼
   * @param limit 조회할 개수 (기본값: 100)
   * @param startTime 시작 시간 (Unix 타임스탬프)
   * @param endTime 종료 시간 (Unix 타임스탬프)
   * @returns 히스토리 캔들 데이터
   */
  @Get('history/:symbol')
  async getCandleHistory(
    @Param('symbol') symbol: string,
    @Query('limit') limit: string = '100',
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    try {
      const queryOptions: CandleQueryOptions = {
        limit: parseInt(limit, 10),
      };

      if (startTime) {
        queryOptions.startTime = parseInt(startTime, 10);
      }

      if (endTime) {
        queryOptions.endTime = parseInt(endTime, 10);
      }

      const candles = await this.candle15MRepository.findLatestCandles(
        symbol,
        'FUTURES',
        queryOptions.limit,
      );

      return {
        success: true,
        message: '히스토리 캔들 데이터 조회 성공',
        data: {
          symbol,
          candles,
          count: candles.length,
          queryOptions,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '히스토리 캔들 데이터 조회 실패',
        error: error.message,
      };
    }
  }

  /**
   * 캔들 데이터 통계 조회
   *
   * @returns 캔들 통계 정보
   */
  @Get('statistics')
  async getCandleStatistics() {
    try {
      const statistics = await this.candle15MRepository.getStatistics();

      return {
        success: true,
        message: '캔들 통계 조회 성공',
        data: {
          statistics,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '캔들 통계 조회 실패',
        error: error.message,
      };
    }
  }

  /**
   * 서비스 구독 상태 조회
   *
   * @returns 현재 구독 상태 정보
   */
  @Get('subscription/status')
  getSubscriptionStatus() {
    try {
      const status = this.candle15MService.getSubscriptionStatus();

      return {
        success: true,
        message: '구독 상태 조회 성공',
        data: {
          ...status,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '구독 상태 조회 실패',
        error: error.message,
      };
    }
  }

  /**
   * 특정 심볼 구독 추가
   *
   * @param symbol 구독할 심볼
   * @returns 구독 결과
   */
  @Post('subscription/add/:symbol')
  async addSubscription(@Param('symbol') symbol: string) {
    try {
      await this.candle15MService.subscribeSymbol(symbol);

      return {
        success: true,
        message: `${symbol} 구독이 추가되었습니다.`,
        data: {
          symbol,
          addedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `${symbol} 구독 추가 실패`,
        error: error.message,
      };
    }
  }

  /**
   * 특정 심볼 구독 해제
   *
   * @param symbol 구독 해제할 심볼
   * @returns 구독 해제 결과
   */
  @Post('subscription/remove/:symbol')
  removeSubscription(@Param('symbol') symbol: string) {
    try {
      this.candle15MService.unsubscribeSymbol(symbol);

      return {
        success: true,
        message: `${symbol} 구독이 해제되었습니다.`,
        data: {
          symbol,
          removedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `${symbol} 구독 해제 실패`,
        error: error.message,
      };
    }
  }

  /**
   * 진행 중인 캔들 데이터 조회
   *
   * @param symbol 조회할 심볼
   * @returns 진행 중인 캔들 데이터
   */
  @Get('ongoing/:symbol')
  getOngoingCandle(@Param('symbol') symbol: string) {
    try {
      const ongoingCandle = this.candle15MService.getOngoingCandle(symbol);

      if (!ongoingCandle) {
        return {
          success: false,
          message: `${symbol}의 진행 중인 캔들 데이터가 없습니다.`,
          data: null,
        };
      }

      return {
        success: true,
        message: '진행 중인 캔들 데이터 조회 성공',
        data: {
          symbol,
          candle: ongoingCandle,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '진행 중인 캔들 데이터 조회 실패',
        error: error.message,
      };
    }
  }

  /**
   * 캔들 완성 이벤트 수동 트리거 (테스트용)
   *
   * @param symbol 트리거할 심볼
   * @returns 트리거 결과
   */
  @Post('trigger/complete/:symbol')
  async triggerCandleComplete(@Param('symbol') symbol: string) {
    try {
      await this.candle15MService.triggerCandleComplete(symbol);

      return {
        success: true,
        message: `${symbol}의 캔들 완성 이벤트가 트리거되었습니다.`,
        data: {
          symbol,
          triggeredAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '캔들 완성 이벤트 트리거 실패',
        error: error.message,
      };
    }
  }
}
