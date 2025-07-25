import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TradingConfigService } from '../../common/config/TradingConfig';
import {
  CalculatedStopLossTakeProfit,
  StopLossConfig,
  StopLossTakeProfitType,
  TakeProfitConfig,
} from '../../common/types/StopLossTakeProfit';
import { StopLossTakeProfitCalculator } from '../../common/utils/StopLossTakeProfitCalculator';

/**
 * 통합 테스트 컨트롤러
 *
 * @description 개발/테스트 환경에서 사용하는 모든 테스트 API를 통합 관리합니다.
 * - 손절/익절 계산 테스트
 * - 환경변수 설정 테스트
 * - 자동매매 기본값 테스트
 * - 시스템 헬스체크
 */
@ApiTags('🧪 Integrated Tests')
@Controller('api/v1/test')
export class IntegratedTestController {
  constructor(
    private readonly calculator: StopLossTakeProfitCalculator,
    private readonly tradingConfig: TradingConfigService,
  ) {}

  // ==========================================
  // 📊 손절/익절 계산 테스트
  // ==========================================

  /**
   * 현물 거래 손절/익절 계산 테스트
   */
  @Post('spot/stop-loss-take-profit')
  @ApiOperation({
    summary: '현물 손절/익절 계산 테스트',
    description: '현물 거래에서 진입가 기준으로 손절/익절 가격을 계산합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '계산 성공',
    schema: {
      example: {
        entryPrice: 50000,
        stopLossPrice: 47500,
        takeProfitPrice: 55000,
        calculations: {
          stopLoss: { type: 'PERCENT', value: 0.05, calculatedPrice: 47500 },
          takeProfit: { type: 'PERCENT', value: 0.1, calculatedPrice: 55000 },
        },
      },
    },
  })
  async calculateSpotStopLossTakeProfit(@Body() request: any) {
    const { entryPrice, stopLoss, takeProfit } = request;

    // 입력값 검증
    const validation = this.calculator.validateStopLossTakeProfit(
      stopLoss,
      takeProfit,
      'LONG',
    );

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    // 손절/익절 가격 계산
    const result = this.calculator.calculateSpotStopLossTakeProfit(
      entryPrice,
      stopLoss,
      takeProfit,
    );

    return {
      success: true,
      entryPrice,
      stopLossPrice: result.stopLossPrice,
      takeProfitPrice: result.takeProfitPrice,
      calculations: {
        stopLoss: {
          type: stopLoss.type,
          value: stopLoss.value,
          calculatedPrice: result.stopLossPrice,
        },
        takeProfit: {
          type: takeProfit.type,
          value: takeProfit.value,
          calculatedPrice: result.takeProfitPrice,
        },
      },
    };
  }

  /**
   * 선물 거래 손절/익절 계산 테스트
   */
  @Post('futures/stop-loss-take-profit')
  @ApiOperation({
    summary: '선물 손절/익절 계산 테스트',
    description:
      '선물 거래에서 포지션 방향과 진입가 기준으로 손절/익절 가격을 계산합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '계산 성공',
    schema: {
      example: {
        entryPrice: 50000,
        positionSide: 'LONG',
        stopLossPrice: 49000,
        takeProfitPrice: 52000,
        calculations: {
          stopLoss: { type: 'PERCENT', value: 0.02, calculatedPrice: 49000 },
          takeProfit: { type: 'PERCENT', value: 0.04, calculatedPrice: 52000 },
        },
      },
    },
  })
  async calculateFuturesStopLossTakeProfit(@Body() request: any) {
    const { entryPrice, positionSide, stopLoss, takeProfit } = request;

    // 입력값 검증
    const validation = this.calculator.validateStopLossTakeProfit(
      stopLoss,
      takeProfit,
      positionSide,
    );

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    // 손절/익절 가격 계산
    const result = this.calculator.calculateFuturesStopLossTakeProfit(
      entryPrice,
      positionSide,
      stopLoss,
      takeProfit,
    );

    return {
      success: true,
      entryPrice,
      positionSide,
      stopLossPrice: result.stopLossPrice,
      takeProfitPrice: result.takeProfitPrice,
      calculations: {
        stopLoss: {
          type: stopLoss.type,
          value: stopLoss.value,
          calculatedPrice: result.stopLossPrice,
        },
        takeProfit: {
          type: takeProfit.type,
          value: takeProfit.value,
          calculatedPrice: result.takeProfitPrice,
        },
      },
    };
  }

  // ==========================================
  // ⚙️ 환경변수 설정 테스트
  // ==========================================

  /**
   * 환경변수 기본값 조회 테스트
   */
  @Post('config/defaults')
  @ApiOperation({
    summary: '기본 손절/익절 설정 조회',
    description: '환경변수에서 설정된 기본 손절/익절 비율을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
    schema: {
      example: {
        spot: {
          stopLossPercent: 0.03,
          takeProfitPercent: 0.06,
        },
        futures: {
          stopLossPercent: 0.02,
          takeProfitPercent: 0.04,
        },
      },
    },
  })
  async getDefaultConfig() {
    return {
      spot: this.tradingConfig.getSpotDefaultConfig(),
      futures: this.tradingConfig.getFuturesDefaultConfig(),
    };
  }

  /**
   * 자동매매용 기본값 적용 테스트
   */
  @Post('auto-trading/calculate')
  @ApiOperation({
    summary: '자동매매용 기본값 적용 테스트',
    description: '환경변수 기본값을 사용하여 손절/익절 가격을 계산합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '계산 성공',
  })
  async calculateWithDefaults(@Body() request: any) {
    const { entryPrice, tradingType, positionSide } = request;

    let stopLossPercent: number;
    let takeProfitPercent: number;

    // 거래 타입에 따른 기본값 적용
    if (tradingType === 'SPOT') {
      const config = this.tradingConfig.getSpotDefaultConfig();
      stopLossPercent = config.stopLossPercent;
      takeProfitPercent = config.takeProfitPercent;
    } else {
      const config = this.tradingConfig.getFuturesDefaultConfig();
      stopLossPercent = config.stopLossPercent;
      takeProfitPercent = config.takeProfitPercent;
    }

    // 기본값으로 손절/익절 설정 생성
    const stopLoss: StopLossConfig = {
      type: StopLossTakeProfitType.PERCENT,
      value: stopLossPercent,
    };

    const takeProfit: TakeProfitConfig = {
      type: StopLossTakeProfitType.PERCENT,
      value: takeProfitPercent,
    };

    // 계산 실행
    let result: CalculatedStopLossTakeProfit;

    if (tradingType === 'SPOT') {
      result = this.calculator.calculateSpotStopLossTakeProfit(
        entryPrice,
        stopLoss,
        takeProfit,
      );
    } else {
      result = this.calculator.calculateFuturesStopLossTakeProfit(
        entryPrice,
        positionSide || 'LONG',
        stopLoss,
        takeProfit,
      );
    }

    return {
      success: true,
      tradingType,
      positionSide: positionSide || 'LONG',
      entryPrice,
      appliedDefaults: {
        stopLossPercent,
        takeProfitPercent,
      },
      stopLossPrice: result.stopLossPrice,
      takeProfitPrice: result.takeProfitPrice,
    };
  }

  // ==========================================
  // 🏥 헬스체크 및 시스템 상태
  // ==========================================

  /**
   * 시스템 헬스체크
   */
  @Post('health')
  @ApiOperation({
    summary: '시스템 헬스체크',
    description: '손절/익절 관련 서비스들의 상태를 확인합니다.',
  })
  async healthCheck() {
    try {
      // 환경변수 로드 테스트
      const spotConfig = this.tradingConfig.getSpotDefaultConfig();
      const futuresConfig = this.tradingConfig.getFuturesDefaultConfig();

      // 계산기 테스트
      const testResult = this.calculator.calculateSpotStopLossTakeProfit(
        50000,
        { type: StopLossTakeProfitType.PERCENT, value: 0.05 },
        { type: StopLossTakeProfitType.PERCENT, value: 0.1 },
      );

      return {
        success: true,
        message: '모든 서비스가 정상 작동 중입니다.',
        services: {
          tradingConfig: {
            status: 'healthy',
            spot: spotConfig,
            futures: futuresConfig,
          },
          calculator: {
            status: 'healthy',
            testResult: {
              stopLossPrice: testResult.stopLossPrice,
              takeProfitPrice: testResult.takeProfitPrice,
            },
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: '서비스 상태 확인 중 오류가 발생했습니다.',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
