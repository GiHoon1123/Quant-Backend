import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from 'src/common/response/CommonResponse';
import { SubscribeDto } from 'src/market-data/dto/trade/SubscribeDto';
import { TradeService } from '../../service/trade/TradeService';

@ApiTags('실시간 체결 내역')
@Controller('market-data/trade')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Post('subscribe')
  @ApiOperation({ summary: '실시간 체결 데이터 구독' })
  @ApiResponse({ status: 201, description: '구독 성공' })
  subscribe(@Body() dto: SubscribeDto) {
    const symbol = dto.symbol.toUpperCase();
    this.tradeService.subscribe(symbol);
    return CommonResponse.success({
      status: 201,
      message: `${symbol} 구독에 성공했습니다.`,
      data: null,
    });
  }

  @Delete('unsubscribe')
  @ApiOperation({ summary: '실시간 체결 데이터 구독 해제' })
  @ApiResponse({ status: 200, description: '구독 해제 성공' })
  unsubscribe(@Body() dto: SubscribeDto) {
    const symbol = dto.symbol.toUpperCase();
    this.tradeService.unsubscribe(symbol);
    return CommonResponse.success({
      status: 200,
      message: `${symbol} 구독 해제에 성공했습니다.`,
      data: null,
    });
  }

  @Get('subscribed')
  @ApiOperation({ summary: '현재 구독 중인 심볼 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '구독 중인 심볼 목록',
  })
  getSubscribed() {
    const symbols = this.tradeService.getSubscribedSymbols();
    return CommonResponse.success({
      status: 200,
      message: '구독 중인 심볼 목록입니다.',
      data: symbols,
    });
  }
}
