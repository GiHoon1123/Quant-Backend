import { ApiProperty } from '@nestjs/swagger';
import { ExternalMarketBuyResponse } from '../external/ExternalMarketBuyResponse';

export class MarketBuyOrderResponse {
  @ApiProperty({ example: 'BTCUSDT', description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ example: 45464999819, description: '주문 ID' })
  orderId: number;

  @ApiProperty({ example: 'web_abc123', description: '클라이언트 주문 ID' })
  clientOrderId: string;

  @ApiProperty({ example: '10.00000000', description: '주문 금액 (USDT 기준)' })
  origQuoteOrderQty: string;

  @ApiProperty({ example: '106791.97', description: '평균 체결 가격' })
  avgPrice: string;

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
    dto.clientOrderId = ext.clientOrderId;
    dto.origQuoteOrderQty = ext.origQuoteOrderQty;
    dto.executedQty = ext.executedQty;
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
