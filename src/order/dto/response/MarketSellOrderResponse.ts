import { ApiProperty } from '@nestjs/swagger';
import { ExternalMarketSellResponse } from '../external/ExternalMarketSellResponse';

export class MarketSellOrderResponse {
  @ApiProperty({ example: 'BTCUSDT', description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ example: 45465024558, description: '주문 ID' })
  orderId: number;

  @ApiProperty({ example: 'web_abc123', description: '클라이언트 주문 ID' })
  clientOrderId: string;

  @ApiProperty({ example: '0.00009000', description: '판매한 수량' })
  executedQty: string;

  @ApiProperty({ example: '106794.99', description: '평균 체결 가격' })
  avgPrice: string;

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
    dto.clientOrderId = ext.clientOrderId;
    dto.executedQty = ext.executedQty;
    dto.cummulativeQuoteQty = ext.cummulativeQuoteQty;
    dto.status = ext.status;
    dto.fills = ext.fills || [];

    // fills 배열에서 평균 가격 계산
    if (dto.fills.length > 0) {
      const totalValue = dto.fills.reduce(
        (sum, fill) => sum + parseFloat(fill.price) * parseFloat(fill.qty),
        0,
      );
      const totalQty = dto.fills.reduce(
        (sum, fill) => sum + parseFloat(fill.qty),
        0,
      );
      dto.avgPrice = totalQty > 0 ? (totalValue / totalQty).toFixed(8) : '0';
    } else {
      dto.avgPrice = '0';
    }

    return dto;
  }
}
