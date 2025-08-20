import { Body, Controller, Get, Logger, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CacheService } from '../../common/cache/CacheService';
import {
  ATRConfig,
  EmergencyConfig,
} from '../../technical-analysis/types/ATRTypes';

/**
 * ATR 설정 관리 컨트롤러
 * ATR 기반 손절/익절 설정과 긴급 상황 설정을 관리합니다.
 */
@ApiTags('ATR Configuration')
@Controller('auto-trading/atr')
export class ATRController {
  private readonly logger = new Logger(ATRController.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 현재 ATR 설정을 조회합니다.
   * @returns ATR 설정과 긴급 상황 설정
   */
  @Get('config')
  @ApiOperation({
    summary: 'ATR 설정 조회',
    description: '현재 ATR 기반 손절/익절 설정과 긴급 상황 설정을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '설정 조회 성공',
  })
  async getATRConfig() {
    this.logger.log('ATR 설정 조회 요청');

    const atrConfig: ATRConfig = {
      stopLossMultiplier:
        this.cacheService.get('config:atr_stop_loss_multiplier') ||
        Number(process.env.ATR_STOP_LOSS_MULTIPLIER) ||
        2.8, // ATR 배수 (ATR의 2.8배)
      takeProfitMultiplier:
        this.cacheService.get('config:atr_take_profit_multiplier') ||
        Number(process.env.ATR_TAKE_PROFIT_MULTIPLIER) ||
        1.3, // ATR 배수 (ATR의 1.3배)
      riskRewardRatio:
        this.cacheService.get('config:atr_risk_reward_ratio') ||
        Number(process.env.ATR_RISK_REWARD_RATIO) ||
        2.0,
    };

    const emergencyConfig: EmergencyConfig = {
      stopLossPercent:
        this.cacheService.get('config:emergency_stop_loss') ||
        Number(process.env.EMERGENCY_STOP_LOSS_PERCENT) ||
        0.03,
      takeProfitPercent:
        this.cacheService.get('config:emergency_take_profit') ||
        Number(process.env.EMERGENCY_TAKE_PROFIT_PERCENT) ||
        0.06,
      enabled:
        this.cacheService.get('config:emergency_enabled') !== false ||
        process.env.EMERGENCY_ENABLED === 'true',
    };

    return {
      success: true,
      data: {
        atr: atrConfig,
        emergency: emergencyConfig,
        timestamp: new Date(),
      },
    };
  }

  /**
   * ATR 설정을 업데이트합니다.
   * @param config 업데이트할 설정
   * @returns 업데이트 결과
   */
  @Put('config')
  @ApiOperation({
    summary: 'ATR 설정 업데이트',
    description: 'ATR 기반 손절/익절 설정과 긴급 상황 설정을 업데이트합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '설정 업데이트 성공',
  })
  async updateATRConfig(@Body() config: Partial<ATRConfig & EmergencyConfig>) {
    this.logger.log(`ATR 설정 업데이트 요청: ${JSON.stringify(config)}`);

    // ATR 설정 업데이트
    if (config.stopLossMultiplier !== undefined) {
      this.cacheService.set(
        'config:atr_stop_loss_multiplier',
        config.stopLossMultiplier,
      );
    }
    if (config.takeProfitMultiplier !== undefined) {
      this.cacheService.set(
        'config:atr_take_profit_multiplier',
        config.takeProfitMultiplier,
      );
    }
    if (config.riskRewardRatio !== undefined) {
      this.cacheService.set(
        'config:atr_risk_reward_ratio',
        config.riskRewardRatio,
      );
    }

    // 긴급 상황 설정 업데이트
    if (config.stopLossPercent !== undefined) {
      this.cacheService.set(
        'config:emergency_stop_loss',
        config.stopLossPercent,
      );
    }
    if (config.takeProfitPercent !== undefined) {
      this.cacheService.set(
        'config:emergency_take_profit',
        config.takeProfitPercent,
      );
    }
    if (config.enabled !== undefined) {
      this.cacheService.set('config:emergency_enabled', config.enabled);
    }

    return {
      success: true,
      message: 'ATR 설정이 업데이트되었습니다.',
      data: {
        updatedAt: new Date(),
      },
    };
  }

  /**
   * 현재 ATR 캐시 상태를 조회합니다.
   * @returns ATR 캐시 정보
   */
  @Get('cache/status')
  @ApiOperation({
    summary: 'ATR 캐시 상태 조회',
    description: '현재 ATR 캐시의 상태와 저장된 데이터를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '캐시 상태 조회 성공',
  })
  async getATRCacheStatus() {
    this.logger.log('ATR 캐시 상태 조회 요청');

    const atrCache = this.cacheService.getByPattern('atr:');
    const configCache = this.cacheService.getByPattern('config:');

    return {
      success: true,
      data: {
        atrEntries: atrCache.size,
        configEntries: configCache.size,
        totalCacheSize: this.cacheService.size(),
        atrSymbols: Array.from(atrCache.keys()).map((key) =>
          key.replace('atr:', ''),
        ),
        timestamp: new Date(),
      },
    };
  }
}
