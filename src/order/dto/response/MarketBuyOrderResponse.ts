import { ApiProperty } from '@nestjs/swagger';
import { ExternalMarketBuyResponse } from '../external/ExternalMarketBuyResponse';

export class MarketBuyOrderResponse {
  @ApiProperty({ example: 'BTCUSDT', description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ example: 45464999819, description: '주문 ID' })
  orderId: number;

  @ApiProperty({ example: '10.00000000', description: '주문 금액 (USDT 기준)' })
  origQuoteOrderQty: string;

  @ApiProperty({
    example: '0.00009000',
    description: '체결된 수량 (코인 수량)',
  })
  executedQty: string;

  @ApiProperty({ example: 'FILLED', description: '주문 상태' })
  status: string;

  @ApiProperty({
    description: '체결 정보 목록',
    example: [
      {
        price: '106791.97000000',
        qty: '0.00009000',
        commission: '0.00000009',
        commissionAsset: 'BTC',
        tradeId: 5055836731,
      },
    ],
  })
  fills: any[];

  static from(ext: ExternalMarketBuyResponse): MarketBuyOrderResponse {
    const dto = new MarketBuyOrderResponse();
    dto.symbol = ext.symbol;
    dto.orderId = ext.orderId;
    dto.origQuoteOrderQty = ext.origQuoteOrderQty;
    dto.executedQty = ext.executedQty;
    dto.status = ext.status;
    dto.fills = ext.fills || [];
    return dto;
  }
}
