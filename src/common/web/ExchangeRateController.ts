import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '../response/CommonResponse';
import { ExchangeRateService } from '../service/ExchangeRateService';

/**
 * 환율 API 컨트롤러
 *
 * 실시간 USD-KRW 환율 정보를 제공하는 API입니다.
 * 매번 실시간으로 조회하여 최신 환율 정보를 제공합니다.
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
    description:
      '실시간 USD-KRW 환율을 조회합니다. 매번 실시간으로 조회됩니다.',
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
            timestamp: { type: 'string', description: '조회 시간' },
          },
        },
      },
    },
  })
  async getUSDKRWRate(): Promise<CommonResponse<any>> {
    try {
      const rate = await this.exchangeRateService.getUSDKRWRate();

      return CommonResponse.success({
        status: 200,
        message: '환율 조회 성공',
        data: {
          rate,
          formattedRate: `₩${rate.toLocaleString()}`,
          timestamp: new Date().toISOString(),
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
   * 환율 서비스 상태 조회
   *
   * @returns 서비스 상태 정보
   */
  @Get('service-status')
  @ApiOperation({
    summary: '환율 서비스 상태 조회',
    description: '현재 환율 서비스의 상태를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '서비스 상태 조회 성공',
  })
  async getServiceStatus(): Promise<CommonResponse<any>> {
    try {
      const serviceStatus = this.exchangeRateService.getServiceStatus();

      return CommonResponse.success({
        status: 200,
        message: '서비스 상태 조회 성공',
        data: {
          defaultRate: serviceStatus.defaultRate,
          formattedDefaultRate: `₩${serviceStatus.defaultRate.toLocaleString()}`,
          apiSources: serviceStatus.apiSources,
        },
      });
    } catch (error) {
      return CommonResponse.error({
        status: 500,
        message: `서비스 상태 조회 실패: ${error.message}`,
        data: null,
      });
    }
  }

  /**
   * 환율 실시간 재조회
   *
   * @returns 새로운 환율 정보
   */
  @Get('force-refresh')
  @ApiOperation({
    summary: '환율 실시간 재조회',
    description: '새로운 환율을 실시간으로 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: '환율 재조회 성공',
  })
  async forceRefresh(): Promise<CommonResponse<any>> {
    try {
      const newRate = await this.exchangeRateService.forceRefresh();

      return CommonResponse.success({
        status: 200,
        message: '환율 실시간 재조회 성공',
        data: {
          rate: newRate,
          formattedRate: `₩${newRate.toLocaleString()}`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return CommonResponse.error({
        status: 500,
        message: `환율 재조회 실패: ${error.message}`,
        data: null,
      });
    }
  }
}
