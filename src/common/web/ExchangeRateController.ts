import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '../response/CommonResponse';
import { ExchangeRateService } from '../service/ExchangeRateService';

/**
 * 환율 API 컨트롤러
 *
 * 실시간 USD-KRW 환율 정보를 제공하는 API입니다.
 * 15분마다 캐싱되어 효율적으로 동작합니다.
 */
@ApiTags('환율')
@Controller('api/v1/exchange-rate')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * 현재 USD-KRW 환율 조회
   *
   * @returns 현재 환율 정보
   */
  @Get('usd-krw')
  @ApiOperation({
    summary: 'USD-KRW 환율 조회',
    description: '실시간 USD-KRW 환율을 조회합니다. 15분마다 캐싱됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '환율 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            rate: { type: 'number', description: 'USD-KRW 환율' },
            formattedRate: {
              type: 'string',
              description: '포맷된 환율 (₩1,330)',
            },
            lastUpdate: { type: 'string', description: '마지막 업데이트 시간' },
            nextUpdate: { type: 'string', description: '다음 업데이트 시간' },
            isExpired: { type: 'boolean', description: '캐시 만료 여부' },
          },
        },
      },
    },
  })
  async getUSDKRWRate(): Promise<CommonResponse<any>> {
    try {
      const rate = await this.exchangeRateService.getUSDKRWRate();
      const cacheStatus = this.exchangeRateService.getCacheStatus();

      return CommonResponse.success({
        status: 200,
        message: '환율 조회 성공',
        data: {
          rate,
          formattedRate: `₩${rate.toLocaleString()}`,
          lastUpdate: cacheStatus.lastUpdate.toISOString(),
          nextUpdate: cacheStatus.nextUpdate.toISOString(),
          isExpired: cacheStatus.isExpired,
        },
      });
    } catch (error) {
      return CommonResponse.error({
        status: 500,
        message: `환율 조회 실패: ${error.message}`,
        data: null,
      });
    }
  }

  /**
   * 환율 캐시 상태 조회
   *
   * @returns 캐시 상태 정보
   */
  @Get('cache-status')
  @ApiOperation({
    summary: '환율 캐시 상태 조회',
    description: '현재 환율 캐시의 상태를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 상태 조회 성공',
  })
  async getCacheStatus(): Promise<CommonResponse<any>> {
    try {
      const cacheStatus = this.exchangeRateService.getCacheStatus();

      return CommonResponse.success({
        status: 200,
        message: '캐시 상태 조회 성공',
        data: {
          currentRate: cacheStatus.currentRate,
          formattedRate: `₩${cacheStatus.currentRate.toLocaleString()}`,
          lastUpdate: cacheStatus.lastUpdate.toISOString(),
          nextUpdate: cacheStatus.nextUpdate.toISOString(),
          isExpired: cacheStatus.isExpired,
          timeUntilNextUpdate: Math.max(
            0,
            cacheStatus.nextUpdate.getTime() - Date.now(),
          ),
        },
      });
    } catch (error) {
      return CommonResponse.error({
        status: 500,
        message: `캐시 상태 조회 실패: ${error.message}`,
        data: null,
      });
    }
  }

  /**
   * 환율 캐시 강제 갱신
   *
   * @returns 갱신된 환율 정보
   */
  @Get('force-refresh')
  @ApiOperation({
    summary: '환율 캐시 강제 갱신',
    description: '캐시를 무시하고 새로운 환율을 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: '환율 갱신 성공',
  })
  async forceRefresh(): Promise<CommonResponse<any>> {
    try {
      const newRate = await this.exchangeRateService.forceRefresh();
      const cacheStatus = this.exchangeRateService.getCacheStatus();

      return CommonResponse.success({
        status: 200,
        message: '환율 강제 갱신 성공',
        data: {
          rate: newRate,
          formattedRate: `₩${newRate.toLocaleString()}`,
          lastUpdate: cacheStatus.lastUpdate.toISOString(),
          nextUpdate: cacheStatus.nextUpdate.toISOString(),
        },
      });
    } catch (error) {
      return CommonResponse.error({
        status: 500,
        message: `환율 갱신 실패: ${error.message}`,
        data: null,
      });
    }
  }
}
