import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { TradingConfigService } from '../config/TradingConfig';
import {
  CalculatedStopLossTakeProfit,
  StopLossConfig,
  StopLossTakeProfitType,
  TakeProfitConfig,
} from '../types/StopLossTakeProfit';
import { StopLossTakeProfitCalculator } from '../utils/StopLossTakeProfitCalculator';

/**
 * 현물 계산 요청 DTO
 */
class SpotCalculationRequest {
  @ApiProperty({
    example: 50000,
    description: '진입가 (USDT 기준)',
  })
  @IsNumber()
  entryPrice: number;

  @ApiProperty({
    example: { type: 'PERCENT', value: 0.05 },
    description: '손절 설정',
  })
  stopLoss: StopLossConfig;

  @ApiProperty({
    example: { type: 'PERCENT', value: 0.1 },
    description: '익절 설정',
  })
  takeProfit: TakeProfitConfig;
}

/**
 * 선물 계산 요청 DTO
 */
class FuturesCalculationRequest {
  @ApiProperty({
    example: 50000,
    description: '진입가 (USDT 기준)',
  })
  @IsNumber()
  entryPrice: number;

  @ApiProperty({
    example: 'LONG',
    enum: ['LONG', 'SHORT'],
    description: '포지션 방향',
  })
  @IsEnum(['LONG', 'SHORT'])
  positionSide: 'LONG' | 'SHORT';

  @ApiProperty({
    example: { type: 'PERCENT', value: 0.02 },
    description: '손절 설정',
  })
  stopLoss: StopLossConfig;

  @ApiProperty({
    example: { type: 'PERCENT', value: 0.04 },
    description: '익절 설정',
  })
  takeProfit: TakeProfitConfig;
}

/**
 * 자동매매 계산 요청 DTO
 */
class AutoTradingCalculationRequest {
  @ApiProperty({
    example: 50000,
    description: '진입가 (USDT 기준)',
  })
  @IsNumber()
  entryPrice: number;

  @ApiProperty({
    example: 'SPOT',
    enum: ['SPOT', 'FUTURES'],
    description: '거래 타입',
  })
  @IsEnum(['SPOT', 'FUTURES'])
  tradingType: 'SPOT' | 'FUTURES';

  @ApiProperty({
    example: 'LONG',
    enum: ['LONG', 'SHORT'],
    description: '포지션 방향 (선물 거래 시 필수)',
    required: false,
  })
  @IsOptional()
  @IsEnum(['LONG', 'SHORT'])
  positionSide?: 'LONG' | 'SHORT';
}

/**
 * 손절/익절 기능 테스트용 컨트롤러
 *
 * @description 손절/익절 계산 로직과 환경변수 설정을 테스트하기 위한 API들을 제공합니다.
 * 실제 거래는 하지 않고 계산 결과만 반환합니다.
 */
@ApiTags('손절/익절 테스트')
@Controller('api/test/stop-loss-take-profit')
export class StopLossTakeProfitTestController {
  constructor(
    private readonly calculator: StopLossTakeProfitCalculator,
    private readonly tradingConfig: TradingConfigService,
  ) {}

  /**
   * 현물 거래 손절/익절 계산 테스트
   *
   * @description 현물 거래에서 손절/익절 가격을 계산하는 로직을 테스트합니다.
   * 실제 주문은 하지 않고 계산 결과만 반환합니다.
   */
  @Post('spot/calculate')
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
   *
   * @description 선물 거래에서 포지션 방향에 따른 손절/익절 가격을 계산하는 로직을 테스트합니다.
   * 실제 포지션 진입은 하지 않고 계산 결과만 반환합니다.
   */
  @Post('futures/calculate')
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

  /**
   * 환경변수 기본값 조회 테스트
   *
   * @description 자동매매/전략에서 사용할 기본 손절/익절 비율을 조회합니다.
   * 환경변수 설정이 올바른지 확인할 수 있습니다.
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
   *
   * @description 자동매매/전략에서 환경변수 기본값을 사용하여 손절/익절을 계산하는 로직을 테스트합니다.
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
}
