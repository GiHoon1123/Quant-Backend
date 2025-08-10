import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '../../common/response/CommonResponse';
import { AutoTradingService } from '../service/AutoTradingService';

/**
 * 자동 매매 컨트롤러
 *
 * 자동 매매 시스템의 상태 조회 및 제어를 위한 API 엔드포인트를 제공합니다.
 *
 * 📊 주요 기능:
 * - 자동 매매 시스템 상태 조회
 * - 자동 매매 설정 조회/수정
 * - 수동 매매 신호 발생
 * - 백테스팅 결과 조회
 */
@ApiTags('자동 매매')
@Controller('auto-trading')
export class AutoTradingController {
  constructor(private readonly autoTradingService: AutoTradingService) {}

  @Get('status')
  @ApiOperation({
    summary: '자동 매매 시스템 상태 조회',
    description:
      '현재 자동 매매 시스템의 활성화 상태와 설정 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '자동 매매 시스템 상태 조회 성공',
    schema: {
      example: {
        status: 200,
        message: '자동 매매 시스템 상태 조회 완료',
        data: {
          isActive: true,
          lastAnalysisTime: '2024-01-01T00:00:00.000Z',
          totalSignals: 150,
          successfulTrades: 120,
          failedTrades: 30,
          winRate: 80.0,
          settings: {
            minConfidence: 80,
            minVolumeRatio: 1.2,
            positionSizePercent: 2,
            stopLossPercent: -2,
            takeProfitPercent: 4,
          },
        },
      },
    },
  })
  async getStatus() {
    // TODO: 실제 상태 정보 반환
    const status = {
      isActive: true,
      lastAnalysisTime: new Date(),
      totalSignals: 150,
      successfulTrades: 120,
      failedTrades: 30,
      winRate: 80.0,
      settings: {
        minConfidence: 80,
        minVolumeRatio: 1.2,
        positionSizePercent: 2,
        stopLossPercent: -2,
        takeProfitPercent: 4,
      },
    };

    return CommonResponse.success({
      status: 200,
      message: '자동 매매 시스템 상태 조회 완료',
      data: status,
    });
  }

  @Post('manual-signal')
  @ApiOperation({
    summary: '수동 매매 신호 발생',
    description:
      '자동 매매 시스템을 우회하여 수동으로 매매 신호를 발생시킵니다.',
  })
  @ApiResponse({
    status: 200,
    description: '수동 매매 신호 발생 성공',
    schema: {
      example: {
        status: 200,
        message: '수동 매매 신호가 성공적으로 발생했습니다.',
        data: {
          signalId: 'manual_123456789',
          symbol: 'BTCUSDT',
          signal: 'LONG',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async emitManualSignal(
    @Body() body: { symbol: string; signal: 'LONG' | 'SHORT' | 'CLOSE' },
  ) {
    // TODO: 실제 수동 신호 발생 로직 구현
    const signalId = `manual_${Date.now()}`;

    return CommonResponse.success({
      status: 200,
      message: '수동 매매 신호가 성공적으로 발생했습니다.',
      data: {
        signalId,
        symbol: body.symbol,
        signal: body.signal,
        timestamp: new Date(),
      },
    });
  }

  @Get('backtest/:symbol')
  @ApiOperation({
    summary: '백테스팅 결과 조회',
    description: '특정 심볼에 대한 백테스팅 결과를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '백테스팅 결과 조회 성공',
    schema: {
      example: {
        status: 200,
        message: '백테스팅 결과 조회 완료',
        data: {
          symbol: 'BTCUSDT',
          period: '30일',
          totalTrades: 45,
          winningTrades: 32,
          losingTrades: 13,
          winRate: 71.1,
          totalPnl: 1250.5,
          maxDrawdown: -350.25,
          sharpeRatio: 1.85,
          averageReturn: 2.78,
        },
      },
    },
  })
  async getBacktestResult(@Param('symbol') symbol: string) {
    // TODO: 실제 백테스팅 결과 반환
    const backtestResult = {
      symbol,
      period: '30일',
      totalTrades: 45,
      winningTrades: 32,
      losingTrades: 13,
      winRate: 71.1,
      totalPnl: 1250.5,
      maxDrawdown: -350.25,
      sharpeRatio: 1.85,
      averageReturn: 2.78,
    };

    return CommonResponse.success({
      status: 200,
      message: '백테스팅 결과 조회 완료',
      data: backtestResult,
    });
  }
}
