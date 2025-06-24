import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from 'src/common/response/CommonResponse';
import { WatchSymbolRequest } from 'src/market-data/dto/trade/WatchSymbolRequest';
import { TradeService } from '../../service/trade/TradeService';

@ApiTags('실시간 체결 관심 종목')
@Controller('market-data/watchlist')
export class TradeWatchlistController {
  constructor(private readonly tradeService: TradeService) {}

  @Post()
  @ApiOperation({ summary: '관심 종목 등록 (실시간 체결 데이터 수신)' })
  @ApiResponse({ status: 201, description: '관심 종목 등록 성공' })
  watch(@Body() dto: WatchSymbolRequest) {
    const symbol = dto.symbol.toUpperCase();
    this.tradeService.subscribe(symbol);
    return CommonResponse.success({
      status: 201,
      message: `${symbol} 등록에 성공했습니다.`,
      data: null,
    });
  }

  @Delete()
  @ApiOperation({ summary: '관심 종목 해제 (실시간 체결 데이터 중단)' })
  @ApiResponse({ status: 200, description: '관심 종목 해제 성공' })
  unwatch(@Body() dto: WatchSymbolRequest) {
    const symbol = dto.symbol.toUpperCase();
    this.tradeService.unsubscribe(symbol);
    return CommonResponse.success({
      status: 200,
      message: `${symbol} 해제에 성공했습니다.`,
      data: null,
    });
  }

  @Get()
  @ApiOperation({ summary: '관심 종목 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '등록된 관심 종목 목록 반환',
  })
  getWatchedSymbols() {
    const symbols = this.tradeService.getSubscribedSymbols();
    return CommonResponse.success({
      status: 200,
      message: '관심 종목 목록입니다.',
      data: symbols,
    });
  }
}
