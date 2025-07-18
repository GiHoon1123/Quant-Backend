import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TelegramNotificationService } from '../../../common/notification/TelegramNotificationService';
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
@ApiTags('15분봉 캔들')
export class Candle15MController {
  constructor(
    private readonly candle15MService: Candle15MService,
    private readonly candle15MRepository: Candle15MRepository,
    private readonly telegramNotificationService: TelegramNotificationService, // 공통 알림 서비스 추가
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

  /**
   * 텔레그램 알림 테스트 엔드포인트
   *
   * 다양한 알림 템플릿을 테스트할 수 있는 엔드포인트입니다.
   * 개발 환경에서 알림 시스템이 정상 작동하는지 확인용으로 사용합니다.
   */
  @Post('test/telegram/:type')
  @ApiOperation({
    summary: '텔레그램 알림 테스트',
    description: '다양한 유형의 텔레그램 알림을 테스트합니다.',
  })
  @ApiParam({
    name: 'type',
    description:
      '알림 유형 (analysis, price-rise, ma-breakout, rsi, bollinger, golden-cross, news)',
    enum: [
      'analysis',
      'price-rise',
      'price-drop',
      'break-high',
      'break-low',
      'new-high',
      'drop-from-high',
      'ma-breakout',
      'rsi',
      'bollinger',
      'golden-cross',
      'dead-cross',
      'news',
      'text',
    ],
  })
  async testTelegramAlert(
    @Param('type') type: string,
    @Body() testData?: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const symbol = testData?.symbol || 'BTCUSDT';
      const timestamp = new Date();

      switch (type) {
        case 'analysis':
          await this.telegramNotificationService.sendAnalysisResult(symbol, {
            signal: 'BUY',
            indicators: {
              SMA5: 42850.5,
              SMA10: 42500.25,
              SMA20: 42200.75,
              Volume: 1250.45,
              AvgVolume: 850.3,
              VolumeRatio: 1.47,
            },
            price: 43000.8,
            timestamp,
          });
          break;

        case 'price-rise':
          await this.telegramNotificationService.sendPriceRiseAlert(
            symbol,
            43000.8,
            42000.5,
            2.38,
            timestamp,
          );
          break;

        case 'price-drop':
          await this.telegramNotificationService.sendPriceDropAlert(
            symbol,
            41500.25,
            42000.5,
            -1.19,
            timestamp,
          );
          break;

        case 'break-high':
          await this.telegramNotificationService.sendBreakPreviousHighAlert(
            symbol,
            43500.75,
            43200.4,
            timestamp,
          );
          break;

        case 'break-low':
          await this.telegramNotificationService.sendBreakPreviousLowAlert(
            symbol,
            41800.6,
            42000.3,
            timestamp,
          );
          break;

        case 'new-high':
          await this.telegramNotificationService.sendNewHighAlert(
            symbol,
            44000.9,
            timestamp,
          );
          break;

        case 'drop-from-high':
          await this.telegramNotificationService.sendDropFromHighAlert(
            symbol,
            41000.25,
            44000.9,
            -6.82,
            timestamp,
            new Date(timestamp.getTime() - 2 * 60 * 60 * 1000), // 2시간 전
          );
          break;

        case 'ma-breakout':
          await this.telegramNotificationService.sendMABreakoutAlert(
            symbol,
            '15m',
            20,
            43200.5,
            43000.25,
            'breakout_up',
            timestamp,
          );
          break;

        case 'rsi':
          await this.telegramNotificationService.sendRSIAlert(
            symbol,
            '15m',
            72.5,
            'overbought',
            timestamp,
          );
          break;

        case 'bollinger':
          await this.telegramNotificationService.sendBollingerAlert(
            symbol,
            '15m',
            43500.8,
            43600.25,
            42800.75,
            'break_upper',
            timestamp,
          );
          break;

        case 'golden-cross':
          await this.telegramNotificationService.sendGoldenCrossAlert(
            symbol,
            43200.5,
            42800.25,
            timestamp,
          );
          break;

        case 'dead-cross':
          await this.telegramNotificationService.sendDeadCrossAlert(
            symbol,
            42500.25,
            42800.75,
            timestamp,
          );
          break;

        case 'news':
          await this.telegramNotificationService.sendNewsAlert(
            '비트코인, 새로운 최고가 경신으로 시장 관심 집중',
            '비트코인이 연일 상승세를 이어가며 새로운 최고가를 경신했습니다. 기관 투자자들의 지속적인 매수세와 긍정적인 시장 분위기가 주요 상승 동력으로 작용하고 있습니다.',
            'https://example.com/bitcoin-news',
            timestamp,
            symbol,
          );
          break;

        case 'text':
          await this.telegramNotificationService.sendTextMessage(
            `🧪 <b>텔레그램 알림 시스템 테스트</b>\n\n` +
              `📅 테스트 시각: ${timestamp.toISOString()}\n` +
              `🎯 대상 심볼: ${symbol}\n` +
              `✅ 알림 시스템이 정상적으로 작동하고 있습니다!`,
          );
          break;

        default:
          return {
            success: false,
            message: `지원하지 않는 알림 유형: ${type}`,
          };
      }

      return {
        success: true,
        message: `${type} 유형의 텔레그램 알림이 성공적으로 전송되었습니다.`,
      };
    } catch (error) {
      console.error(`텔레그램 알림 테스트 실패 (${type}):`, error);
      return {
        success: false,
        message: `텔레그램 알림 전송 실패: ${error.message}`,
      };
    }
  }
}
