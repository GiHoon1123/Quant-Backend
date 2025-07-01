import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from 'src/common/response/CommonResponse';
import { CancelOrderRequest } from '../dto/request/CancelOrderRequest';
import { LimitOrderRequest } from '../dto/request/LimitOrderRequest';
import { MarketBuyRequest } from '../dto/request/MarketBuyRequest';
import { MarketSellRequest } from '../dto/request/MarketSellRequest';
import { OrderService } from '../service/OrderService';

@ApiTags('주문')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('/market/buy')
  @ApiOperation({ summary: '시장가 매수 주문' })
  @ApiOkResponse({
    description: '시장가 매수 주문 성공',
    schema: {
      example: {
        status: 200,
        message: 'BTCUSDT 시장가 매수 주문이 완료되었습니다.',
        data: null,
      },
    },
  })
  async placeMarketBuy(@Body() dto: MarketBuyRequest) {
    const result = await this.orderService.placeMarketBuyOrder(
      dto.symbol,
      dto.usdtAmount,
    );
    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 시장가 매수 주문이 완료되었습니다.`,
      data: result,
    });
  }

  @Post('/market/sell')
  @ApiOperation({ summary: '시장가 매도 주문' })
  @ApiOkResponse({
    description: '시장가 매도 주문 성공',
    schema: {
      example: {
        status: 200,
        message: 'BTCUSDT 시장가 매도 주문이 완료되었습니다.',
        data: null,
      },
    },
  })
  async placeMarketSell(@Body() dto: MarketSellRequest) {
    const result = await this.orderService.placeMarketSellOrder(
      dto.symbol,
      dto.quantity,
    );
    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 시장가 매도 주문이 완료되었습니다.`,
      data: result,
    });
  }

  @Post('/limit/buy')
  @ApiOperation({ summary: '지정가 매수 주문' })
  @ApiOkResponse({
    description: '지정가 매수 주문 성공',
    schema: {
      example: {
        status: 200,
        message: 'ETHUSDT 지정가 매수 주문이 완료되었습니다.',
        data: null,
      },
    },
  })
  async placeLimitBuy(@Body() dto: LimitOrderRequest) {
    const result = await this.orderService.placeLimitBuyOrder(
      dto.symbol,
      dto.quantity,
      dto.price,
    );
    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 지정가 매수 주문이 완료되었습니다.`,
      data: result,
    });
  }

  @Post('/limit/sell')
  @ApiOperation({ summary: '지정가 매도 주문' })
  @ApiOkResponse({
    description: '지정가 매도 주문 성공',
    schema: {
      example: {
        status: 200,
        message: 'ETHUSDT 지정가 매도 주문이 완료되었습니다.',
        data: null,
      },
    },
  })
  async placeLimitSell(@Body() dto: LimitOrderRequest) {
    const result = await this.orderService.placeLimitSellOrder(
      dto.symbol,
      dto.quantity,
      dto.price,
    );
    return CommonResponse.success({
      status: 200,
      message: `${dto.symbol} 지정가 매도 주문이 완료되었습니다.`,
      data: result,
    });
  }

  @Post('/cancel')
  @ApiOperation({ summary: '주문 취소' })
  @ApiOkResponse({
    description: '주문 취소 성공',
    schema: {
      example: {
        status: 200,
        message: '주문이 취소되었습니다.',
        data: null,
      },
    },
  })
  async cancel(@Body() dto: CancelOrderRequest) {
    const result = await this.orderService.cancelOrder(dto.symbol, dto.orderId);
    return CommonResponse.success({
      status: 200,
      message: `주문이 취소되었습니다.`,
      data: result,
    });
  }

  @Get('/balances')
  @ApiOperation({ summary: '현재 잔고 조회' })
  @ApiOkResponse({
    description: '현재 잔고 반환',
    schema: {
      example: {
        status: 200,
        message: '현재 잔고입니다.',
        data: [
          {
            asset: 'USDT',
            free: 120.5,
            locked: 10.25,
          },
          {
            asset: 'BTC',
            free: 0.5,
            locked: 0.1,
          },
        ],
      },
    },
  })
  async getBalances() {
    const result = await this.orderService.getBalances();
    return CommonResponse.success({
      status: 200,
      message: `현재 잔고입니다.`,
      data: result,
    });
  }
}
