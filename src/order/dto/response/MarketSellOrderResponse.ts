import { ApiProperty } from '@nestjs/swagger';
import { ExternalMarketSellResponse } from '../external/ExternalMarketSellResponse';

export class MarketSellOrderResponse {
  @ApiProperty({ example: 'BTCUSDT', description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ example: 45465024558, description: '주문 ID' })
  orderId: number;

  @ApiProperty({ example: '0.00009000', description: '판매한 수량' })
  executedQty: string;

  @ApiProperty({ example: '9.61154910', description: '총 체결 금액 (USDT)' })
  cummulativeQuoteQty: string;

  @ApiProperty({ example: 'FILLED', description: '주문 상태' })
  status: string;

  @ApiProperty({
    description: '체결 정보 목록',
    example: [
      {
        price: '106794.99000000',
        qty: '0.00009000',
        commission: '0.00961155',
        commissionAsset: 'USDT',
        tradeId: 5055838030,
      },
    ],
  })
  fills: any[];

  static from(ext: ExternalMarketSellResponse): MarketSellOrderResponse {
    const dto = new MarketSellOrderResponse();
    dto.symbol = ext.symbol;
    dto.orderId = ext.orderId;
    dto.executedQty = ext.executedQty;
    dto.cummulativeQuoteQty = ext.cummulativeQuoteQty;
    dto.status = ext.status;
    dto.fills = ext.fills || [];
    return dto;
  }
}
