import { ApiProperty } from '@nestjs/swagger';
import { ExternalLimitOrderResponse } from '../external/ExternalLimitOrderResponse';

export class LimitOrderResponse {
  @ApiProperty({ example: 'BTCUSDT', description: '거래 심볼' })
  symbol: string;

  @ApiProperty({ example: 45464533328, description: '주문 ID' })
  orderId: number;

  @ApiProperty({ example: '0.00019000', description: '주문 수량' })
  quantity: string;

  @ApiProperty({ example: '0.00000000', description: '실제 체결 수량' })
  executedQty: string;

  @ApiProperty({ example: '62000.00000000', description: '지정가 주문 가격' })
  price: string;

  @ApiProperty({ example: 'LIMIT', description: '주문 유형' })
  type: string;

  @ApiProperty({ example: 'BUY', description: '매수/매도 구분' })
  side: string;

  @ApiProperty({ example: 'NEW', description: '주문 상태' })
  status: string;

  static from(ext: ExternalLimitOrderResponse): LimitOrderResponse {
    const dto = new LimitOrderResponse();
    dto.symbol = ext.symbol;
    dto.orderId = ext.orderId;
    dto.quantity = ext.origQty;
    dto.executedQty = ext.executedQty;
    dto.price = ext.price;
    dto.type = ext.type;
    dto.side = ext.side;
    dto.status = ext.status;
    return dto;
  }
}
